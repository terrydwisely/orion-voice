from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Literal

import numpy as np

logger = logging.getLogger(__name__)

ModelSize = Literal["tiny", "base", "small", "medium", "large-v3"]

SAMPLE_RATE = 16000
VAD_FRAME_MS = 30
VAD_FRAME_SAMPLES = int(SAMPLE_RATE * VAD_FRAME_MS / 1000)
ENERGY_THRESHOLD_DEFAULT = 0.01
SILENCE_LIMIT_S = 1.5


@dataclass
class TranscriptionResult:
    text: str
    language: str | None = None
    language_probability: float = 0.0
    segments: list[dict] = field(default_factory=list)


class EnergyVAD:
    """Simple energy-based voice activity detection."""

    def __init__(self, threshold: float = ENERGY_THRESHOLD_DEFAULT):
        self.threshold = threshold

    def is_speech(self, audio: np.ndarray) -> bool:
        if audio.size == 0:
            return False
        rms = np.sqrt(np.mean(audio.astype(np.float32) ** 2))
        return float(rms) > self.threshold


class STTEngine:
    def __init__(
        self,
        model_size: ModelSize = "base",
        device: str = "auto",
        compute_type: str = "auto",
        vad_threshold: float = ENERGY_THRESHOLD_DEFAULT,
        silence_limit: float = SILENCE_LIMIT_S,
        on_partial: Callable[[str], None] | None = None,
        on_final: Callable[[TranscriptionResult], None] | None = None,
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.silence_limit = silence_limit
        self.on_partial = on_partial
        self.on_final = on_final

        self._model = None
        self._model_lock = threading.Lock()
        self._vad = EnergyVAD(threshold=vad_threshold)
        self._listening = False

    def _ensure_model(self):
        if self._model is not None:
            return
        with self._model_lock:
            if self._model is not None:
                return
            from faster_whisper import WhisperModel

            logger.info("Loading faster-whisper model: %s", self.model_size)
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
            logger.info("Model loaded.")

    def transcribe(
        self,
        audio: np.ndarray | str | Path,
        language: str | None = None,
    ) -> TranscriptionResult:
        self._ensure_model()

        if isinstance(audio, (str, Path)):
            audio_input = str(audio)
        else:
            audio_input = self._prepare_audio(audio)

        segments_iter, info = self._model.transcribe(
            audio_input,
            language=language,
            beam_size=5,
            vad_filter=True,
        )

        segments = []
        text_parts = []
        for seg in segments_iter:
            segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
            })
            text_parts.append(seg.text.strip())
            if self.on_partial:
                self.on_partial(seg.text.strip())

        result = TranscriptionResult(
            text=" ".join(text_parts),
            language=info.language,
            language_probability=info.language_probability,
            segments=segments,
        )
        if self.on_final:
            self.on_final(result)
        return result

    def listen(
        self,
        language: str | None = None,
        sample_rate: int = SAMPLE_RATE,
    ) -> TranscriptionResult:
        """Record from microphone until silence, then transcribe."""
        import sounddevice as sd

        self._ensure_model()
        self._listening = True

        chunk_samples = VAD_FRAME_SAMPLES
        silence_chunks = int(self.silence_limit * sample_rate / chunk_samples)

        audio_chunks: list[np.ndarray] = []
        silent_count = 0
        speech_started = False

        logger.info("Listening... speak now.")

        try:
            with sd.InputStream(
                samplerate=sample_rate,
                channels=1,
                dtype="float32",
                blocksize=chunk_samples,
            ) as stream:
                while self._listening:
                    chunk, _ = stream.read(chunk_samples)
                    mono = chunk[:, 0] if chunk.ndim > 1 else chunk

                    if self._vad.is_speech(mono):
                        speech_started = True
                        silent_count = 0
                        audio_chunks.append(mono.copy())
                    elif speech_started:
                        silent_count += 1
                        audio_chunks.append(mono.copy())
                        if silent_count >= silence_chunks:
                            break
        except sd.PortAudioError as exc:
            raise RuntimeError(
                "No audio input device available. Check your microphone."
            ) from exc

        if not audio_chunks:
            return TranscriptionResult(text="")

        audio = np.concatenate(audio_chunks)
        return self.transcribe(audio, language=language)

    def stop_listening(self):
        self._listening = False

    @staticmethod
    def _prepare_audio(audio: np.ndarray) -> np.ndarray:
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if audio.dtype != np.float32:
            if np.issubdtype(audio.dtype, np.integer):
                audio = audio.astype(np.float32) / np.iinfo(audio.dtype).max
            else:
                audio = audio.astype(np.float32)
        return audio
