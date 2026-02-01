from __future__ import annotations

import logging
import threading
import time
from typing import Callable

import numpy as np

logger = logging.getLogger(__name__)

DEFAULT_SAMPLE_RATE = 16000
DEFAULT_CHANNELS = 1


class AudioRecorder:
    def __init__(
        self,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        channels: int = DEFAULT_CHANNELS,
        dtype: str = "float32",
        device: int | str | None = None,
        on_audio: Callable[[np.ndarray], None] | None = None,
    ):
        self.sample_rate = sample_rate
        self.channels = channels
        self.dtype = dtype
        self.device = device
        self.on_audio = on_audio

        self._chunks: list[np.ndarray] = []
        self._lock = threading.Lock()
        self._stream = None
        self._recording = False

    @property
    def is_recording(self) -> bool:
        return self._recording

    def start(self) -> None:
        if self._recording:
            return

        import sounddevice as sd

        self._chunks.clear()
        self._recording = True

        try:
            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype=self.dtype,
                device=self.device,
                callback=self._audio_callback,
            )
            self._stream.start()
            logger.info("Recording started.")
        except sd.PortAudioError as exc:
            self._recording = False
            raise RuntimeError(
                "No audio input device available. Check your microphone."
            ) from exc

    def stop(self) -> np.ndarray:
        if not self._recording:
            return np.array([], dtype=np.float32)

        self._recording = False
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

        with self._lock:
            if not self._chunks:
                return np.array([], dtype=np.float32)
            audio = np.concatenate(self._chunks)
            self._chunks.clear()

        logger.info("Recording stopped. Captured %.2f seconds.", len(audio) / self.sample_rate)
        return audio

    def record(self, duration: float) -> np.ndarray:
        self.start()
        time.sleep(duration)
        return self.stop()

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info, status) -> None:
        if status:
            logger.warning("Audio callback status: %s", status)
        chunk = indata.copy()
        with self._lock:
            self._chunks.append(chunk)
        if self.on_audio:
            self.on_audio(chunk)


class PushToTalkRecorder:
    """Records audio while a key is held down."""

    def __init__(
        self,
        key: str = "space",
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        channels: int = DEFAULT_CHANNELS,
        on_release: Callable[[np.ndarray], None] | None = None,
    ):
        self.key = key
        self.on_release = on_release
        self._recorder = AudioRecorder(sample_rate=sample_rate, channels=channels)
        self._running = False
        self._thread: threading.Thread | None = None

    def run(self) -> None:
        """Blocking loop: hold key to record, release to process. Press Esc to quit."""
        try:
            import keyboard
        except ImportError:
            raise RuntimeError(
                "The 'keyboard' package is required for push-to-talk. "
                "Install it with: pip install keyboard"
            )

        self._running = True
        logger.info("Push-to-talk ready. Hold '%s' to record, Esc to quit.", self.key)

        while self._running:
            keyboard.wait(self.key)
            if not self._running:
                break

            self._recorder.start()
            keyboard.wait(self.key, suppress=True, trigger_on_release=True)

            audio = self._recorder.stop()
            if audio.size > 0 and self.on_release:
                self.on_release(audio)

            if keyboard.is_pressed("esc"):
                break

    def run_background(self) -> None:
        self._thread = threading.Thread(target=self.run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    @staticmethod
    def list_devices() -> str:
        import sounddevice as sd
        return str(sd.query_devices())
