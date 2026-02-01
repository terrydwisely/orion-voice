from __future__ import annotations

import asyncio
import json
import logging
import shutil
import urllib.request
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_MODELS_DIR = Path.home() / ".orion-voice" / "models" / "piper"

PIPER_VOICES_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json"

PIPER_MODEL_URL_TEMPLATE = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/{key}/{model_file}"
)


class PiperVoiceManager:
    def __init__(self, models_dir: Optional[Path] = None) -> None:
        self.models_dir = models_dir or DEFAULT_MODELS_DIR
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._remote_cache: Optional[dict] = None

    def list_installed(self) -> list[str]:
        voices: list[str] = []
        for onnx in self.models_dir.rglob("*.onnx"):
            json_cfg = onnx.with_suffix(".onnx.json")
            if json_cfg.exists():
                voices.append(onnx.stem)
        return sorted(voices)

    def get_model_path(self, name: str) -> Optional[Path]:
        for onnx in self.models_dir.rglob("*.onnx"):
            if onnx.stem == name:
                return onnx
        return None

    def fetch_remote_voices(self, timeout: int = 10) -> dict:
        if self._remote_cache is not None:
            return self._remote_cache
        try:
            req = urllib.request.Request(PIPER_VOICES_URL, headers={"User-Agent": "orion-voice"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                self._remote_cache = json.loads(resp.read())
                return self._remote_cache  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("Failed to fetch Piper voice list: %s", exc)
            return {}

    def download_voice(
        self,
        voice_key: str,
        quality: str = "medium",
        progress_callback: Optional[callable] = None,
    ) -> Path:
        voices = self.fetch_remote_voices()
        if voice_key not in voices:
            raise ValueError(f"Unknown voice: {voice_key}. Use list_remote_voices() to see options.")

        info = voices[voice_key]
        files = info.get("files", {})

        model_entry = None
        config_entry = None
        for file_key, meta in files.items():
            if quality in file_key and file_key.endswith(".onnx"):
                model_entry = file_key
            elif quality in file_key and file_key.endswith(".onnx.json"):
                config_entry = file_key

        if not model_entry:
            for file_key in files:
                if file_key.endswith(".onnx"):
                    model_entry = file_key
                elif file_key.endswith(".onnx.json"):
                    config_entry = file_key

        if not model_entry:
            raise ValueError(f"No model file found for voice {voice_key}")

        dest_dir = self.models_dir / voice_key.replace("/", "_")
        dest_dir.mkdir(parents=True, exist_ok=True)

        model_filename = Path(model_entry).name
        dest_model = dest_dir / model_filename

        if not dest_model.exists():
            url = PIPER_MODEL_URL_TEMPLATE.format(key=voice_key, model_file=model_entry.split("/")[-1])
            full_url = f"https://huggingface.co/rhasspy/piper-voices/resolve/main/{model_entry}"
            self._download_file(full_url, dest_model, progress_callback)

        if config_entry:
            config_filename = Path(config_entry).name
            dest_config = dest_dir / config_filename
            if not dest_config.exists():
                full_url = f"https://huggingface.co/rhasspy/piper-voices/resolve/main/{config_entry}"
                self._download_file(full_url, dest_config)

        return dest_model

    @staticmethod
    def _download_file(
        url: str,
        dest: Path,
        progress_callback: Optional[callable] = None,
    ) -> None:
        logger.info("Downloading %s -> %s", url, dest)
        req = urllib.request.Request(url, headers={"User-Agent": "orion-voice"})
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                total = int(resp.headers.get("Content-Length", 0))
                downloaded = 0
                with open(tmp, "wb") as f:
                    while True:
                        chunk = resp.read(1 << 16)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if progress_callback and total:
                            progress_callback(downloaded, total)
            shutil.move(str(tmp), str(dest))
        except Exception:
            tmp.unlink(missing_ok=True)
            raise

    def delete_voice(self, name: str) -> bool:
        path = self.get_model_path(name)
        if path is None:
            return False
        parent = path.parent
        shutil.rmtree(parent, ignore_errors=True)
        return True

    def list_remote_voices(self, language: Optional[str] = None) -> list[dict]:
        voices = self.fetch_remote_voices()
        results: list[dict] = []
        for key, info in voices.items():
            lang = info.get("language", {})
            lang_code = lang.get("code", "")
            if language and not lang_code.startswith(language):
                continue
            results.append({
                "key": key,
                "name": info.get("name", key),
                "language": lang_code,
                "quality": list(info.get("quality", {}).keys()) if isinstance(info.get("quality"), dict) else [],
                "description": info.get("description", ""),
            })
        return results


class EdgeVoiceLister:
    @staticmethod
    def list_voices(language: Optional[str] = None) -> list[dict]:
        import edge_tts

        async def _fetch() -> list[dict]:
            all_voices = await edge_tts.list_voices()
            if language:
                return [v for v in all_voices if v.get("Locale", "").startswith(language)]
            return all_voices

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            future = asyncio.run_coroutine_threadsafe(_fetch(), loop)
            return future.result(timeout=10)
        return asyncio.run(_fetch())


def preview_voice(
    text: str = "Hello, this is a voice preview.",
    voice: Optional[str] = None,
    engine: str = "edge",
) -> None:
    from orion_voice.tts.engine import EdgeEngine, PiperEngine

    if engine == "piper":
        eng = PiperEngine()
        if voice:
            eng.set_voice(voice)
        pcm = eng.synthesize(text)
        sr = eng.sample_rate
    else:
        eng_edge = EdgeEngine()
        if voice:
            eng_edge.set_voice(voice)
        pcm = eng_edge.synthesize(text)
        sr = eng_edge.sample_rate

    try:
        import sounddevice as sd
        import numpy as np

        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        sd.play(samples, samplerate=sr, blocking=True)
    except ImportError:
        import pygame

        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=sr, size=-16, channels=1)

        import io
        import wave

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(pcm)
        buf.seek(0)
        sound = pygame.mixer.Sound(buf)
        sound.play()
        while pygame.mixer.get_busy():
            pygame.time.wait(50)
