from __future__ import annotations

import asyncio
import io
import logging
import subprocess
import threading
import wave
from abc import ABC, abstractmethod
from enum import Enum, auto
from pathlib import Path
from typing import Callable, Optional

import numpy as np

from orion_voice.tts.voices import PiperVoiceManager

logger = logging.getLogger(__name__)


class PlaybackState(Enum):
    IDLE = auto()
    PLAYING = auto()
    PAUSED = auto()
    STOPPED = auto()


class TTSEngine(ABC):
    @abstractmethod
    def synthesize(self, text: str) -> bytes:
        """Return raw PCM/WAV audio bytes for the given text."""

    @abstractmethod
    def set_voice(self, name: str) -> None: ...

    @abstractmethod
    def set_speed(self, speed: float) -> None: ...

    @property
    @abstractmethod
    def sample_rate(self) -> int: ...

    @property
    @abstractmethod
    def available(self) -> bool: ...


class PiperEngine(TTSEngine):
    def __init__(self, models_dir: Optional[Path] = None) -> None:
        self._manager = PiperVoiceManager(models_dir)
        self._voice: Optional[str] = None
        self._speed: float = 1.0
        self._piper_exe: Optional[Path] = self._find_piper()

    def _find_piper(self) -> Optional[Path]:
        import shutil

        exe = shutil.which("piper") or shutil.which("piper.exe")
        if exe:
            return Path(exe)
        bundled = self._manager.models_dir.parent / "piper" / "piper.exe"
        return bundled if bundled.exists() else None

    @property
    def available(self) -> bool:
        if self._piper_exe is None:
            return False
        if self._voice:
            return self._manager.get_model_path(self._voice) is not None
        return bool(self._manager.list_installed())

    @property
    def sample_rate(self) -> int:
        return 22050

    def set_voice(self, name: str) -> None:
        path = self._manager.get_model_path(name)
        if path is None:
            raise FileNotFoundError(f"Piper voice model not found: {name}")
        self._voice = name

    def set_speed(self, speed: float) -> None:
        self._speed = max(0.5, min(2.0, speed))

    def _resolve_model(self) -> Path:
        if self._voice:
            path = self._manager.get_model_path(self._voice)
            if path:
                return path
        installed = self._manager.list_installed()
        if not installed:
            raise RuntimeError("No Piper voice models installed")
        return self._manager.get_model_path(installed[0])  # type: ignore[return-value]

    def synthesize(self, text: str) -> bytes:
        if not self._piper_exe:
            raise RuntimeError("Piper executable not found")

        model_path = self._resolve_model()
        length_scale = 1.0 / self._speed

        proc = subprocess.run(
            [
                str(self._piper_exe),
                "--model", str(model_path),
                "--length-scale", str(length_scale),
                "--output-raw",
            ],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"Piper failed: {proc.stderr.decode(errors='replace')}")
        return proc.stdout


class EdgeEngine(TTSEngine):
    DEFAULT_VOICE = "en-US-AriaNeural"

    def __init__(self) -> None:
        self._voice: str = self.DEFAULT_VOICE
        self._speed: float = 1.0

    @property
    def available(self) -> bool:
        try:
            import edge_tts  # noqa: F401
            return True
        except ImportError:
            return False

    @property
    def sample_rate(self) -> int:
        return 24000

    def set_voice(self, name: str) -> None:
        self._voice = name

    def set_speed(self, speed: float) -> None:
        self._speed = max(0.5, min(2.0, speed))

    def _speed_str(self) -> str:
        pct = int((self._speed - 1.0) * 100)
        return f"{pct:+d}%"

    def synthesize(self, text: str) -> bytes:
        import edge_tts

        async def _run() -> bytes:
            comm = edge_tts.Communicate(text, self._voice, rate=self._speed_str())
            buf = io.BytesIO()
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            return buf.getvalue()

        # Always use a new event loop in a separate thread to avoid
        # conflicts with FastAPI's running loop
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            mp3_bytes = pool.submit(lambda: asyncio.run(_run())).result(timeout=30)

        return self._decode_mp3(mp3_bytes)

    @staticmethod
    def _decode_mp3(data: bytes) -> bytes:
        # Try av (PyAV) first - already installed via faster-whisper
        try:
            import av
            container = av.open(io.BytesIO(data), format="mp3")
            resampler = av.AudioResampler(format="s16", layout="mono", rate=24000)
            pcm_chunks = []
            for frame in container.decode(audio=0):
                resampled = resampler.resample(frame)
                for r in resampled:
                    pcm_chunks.append(r.to_ndarray().tobytes())
            container.close()
            return b"".join(pcm_chunks)
        except Exception:
            pass

        # Try pydub
        try:
            from pydub import AudioSegment
            seg = AudioSegment.from_mp3(io.BytesIO(data))
            seg = seg.set_frame_rate(24000).set_channels(1).set_sample_width(2)
            return seg.raw_data
        except ImportError:
            pass

        # Try ffmpeg
        proc = subprocess.run(
            ["ffmpeg", "-i", "pipe:0", "-f", "s16le", "-ar", "24000", "-ac", "1", "pipe:1"],
            input=data,
            capture_output=True,
            timeout=15,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                "Cannot decode MP3. Install pydub or ffmpeg. "
                f"ffmpeg stderr: {proc.stderr.decode(errors='replace')}"
            )
        return proc.stdout


class _AudioPlayer:
    """Manages playback of raw PCM s16le mono audio with pause/resume/stop."""

    def __init__(self) -> None:
        self._state = PlaybackState.IDLE
        self._lock = threading.Lock()
        self._pause_event = threading.Event()
        self._pause_event.set()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @property
    def state(self) -> PlaybackState:
        return self._state

    def play(self, pcm_data: bytes, sample_rate: int, on_done: Optional[Callable[[], None]] = None) -> None:
        self.stop()
        self._stop_event.clear()
        self._pause_event.set()
        self._state = PlaybackState.PLAYING
        self._thread = threading.Thread(
            target=self._playback_loop,
            args=(pcm_data, sample_rate, on_done),
            daemon=True,
        )
        self._thread.start()

    def _playback_loop(self, pcm_data: bytes, sample_rate: int, on_done: Optional[Callable[[], None]]) -> None:
        try:
            self._play_with_sounddevice(pcm_data, sample_rate)
        except Exception:
            try:
                self._play_with_pygame(pcm_data, sample_rate)
            except Exception as exc:
                logger.error("No audio backend available: %s", exc)
        finally:
            with self._lock:
                if self._state != PlaybackState.STOPPED:
                    self._state = PlaybackState.IDLE
            if on_done:
                on_done()

    def _play_with_sounddevice(self, pcm_data: bytes, sample_rate: int) -> None:
        import sounddevice as sd

        samples = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32) / 32768.0
        chunk_size = sample_rate // 10
        for i in range(0, len(samples), chunk_size):
            self._pause_event.wait()
            if self._stop_event.is_set():
                return
            chunk = samples[i : i + chunk_size]
            sd.play(chunk, samplerate=sample_rate, blocking=True)

    def _play_with_pygame(self, pcm_data: bytes, sample_rate: int) -> None:
        import pygame

        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=sample_rate, size=-16, channels=1)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_data)
        buf.seek(0)

        sound = pygame.mixer.Sound(buf)
        channel = sound.play()
        if channel is None:
            return

        while channel.get_busy():
            self._pause_event.wait()
            if self._stop_event.is_set():
                channel.stop()
                return
            pygame.time.wait(50)

    def pause(self) -> None:
        with self._lock:
            if self._state == PlaybackState.PLAYING:
                self._pause_event.clear()
                self._state = PlaybackState.PAUSED

    def resume(self) -> None:
        with self._lock:
            if self._state == PlaybackState.PAUSED:
                self._pause_event.set()
                self._state = PlaybackState.PLAYING

    def stop(self) -> None:
        with self._lock:
            self._stop_event.set()
            self._pause_event.set()
            self._state = PlaybackState.STOPPED
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        self._state = PlaybackState.IDLE


class TTSManager:
    """High-level TTS interface. Tries Piper (offline) first, falls back to Edge (online)."""

    def __init__(self, models_dir: Optional[Path] = None) -> None:
        self.piper = PiperEngine(models_dir)
        self.edge = EdgeEngine()
        self._player = _AudioPlayer()
        self._preferred: Optional[str] = None

    @property
    def playback_state(self) -> PlaybackState:
        return self._player.state

    def set_voice(self, name: str, engine: Optional[str] = None) -> None:
        if engine == "piper" or (engine is None and not name.endswith("Neural")):
            try:
                self.piper.set_voice(name)
                self._preferred = "piper"
                return
            except FileNotFoundError:
                if engine == "piper":
                    raise
        self.edge.set_voice(name)
        self._preferred = "edge"

    def set_speed(self, speed: float) -> None:
        self.piper.set_speed(speed)
        self.edge.set_speed(speed)

    def speak(
        self,
        text: str,
        blocking: bool = False,
        on_done: Optional[Callable[[], None]] = None,
    ) -> None:
        if not text.strip():
            return

        pcm, sr = self._synthesize(text)
        if blocking:
            self._player.play(pcm, sr, on_done)
            if self._player._thread:
                self._player._thread.join()
        else:
            self._player.play(pcm, sr, on_done)

    def synthesize_to_file(self, text: str, path: Path) -> None:
        pcm, sr = self._synthesize(text)
        with wave.open(str(path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(pcm)

    def _synthesize(self, text: str) -> tuple[bytes, int]:
        engines = self._engine_order()
        last_err: Optional[Exception] = None
        for engine in engines:
            try:
                pcm = engine.synthesize(text)
                return pcm, engine.sample_rate
            except Exception as exc:
                logger.warning("Engine %s failed: %s", type(engine).__name__, exc)
                last_err = exc
        raise RuntimeError(f"All TTS engines failed. Last error: {last_err}")

    def _engine_order(self) -> list[TTSEngine]:
        if self._preferred == "edge":
            return [self.edge, self.piper]
        return [self.piper, self.edge]

    def pause(self) -> None:
        self._player.pause()

    def resume(self) -> None:
        self._player.resume()

    def stop(self) -> None:
        self._player.stop()
