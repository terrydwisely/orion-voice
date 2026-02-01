from __future__ import annotations

import asyncio
import io
import logging
import tempfile
import wave
from contextlib import asynccontextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from orion_voice.api.notes import router as notes_router
from orion_voice.api.sync import router as sync_router
from orion_voice.core.config import OrionConfig
from orion_voice.stt.engine import STTEngine, TranscriptionResult, SAMPLE_RATE
from orion_voice.tts.engine import TTSManager
from orion_voice.tts.voices import EdgeVoiceLister, PiperVoiceManager

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parent.parent / "web" / "static"

_tts: Optional[TTSManager] = None
_stt: Optional[STTEngine] = None
_config: Optional[OrionConfig] = None


def _get_config() -> OrionConfig:
    global _config
    if _config is None:
        _config = OrionConfig.load()
    return _config


def _get_tts() -> TTSManager:
    global _tts
    if _tts is None:
        config = _get_config()
        _tts = TTSManager()
        try:
            _tts.set_voice(config.tts.voice, config.tts.engine)
        except Exception:
            logger.warning("Could not set configured voice, using defaults")
        _tts.set_speed(config.tts.speed)
    return _tts


def _get_stt() -> STTEngine:
    global _stt
    if _stt is None:
        config = _get_config()
        _stt = STTEngine(
            model_size=config.stt.model_size,  # type: ignore[arg-type]
            device=config.stt.device,
        )
    return _stt


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Orion Voice API starting")
    yield
    logger.info("Orion Voice API shutting down")
    global _tts, _stt, _config
    if _tts:
        _tts.stop()
    _tts = None
    _stt = None
    _config = None


def create_app() -> FastAPI:
    app = FastAPI(title="Orion Voice", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(notes_router)
    app.include_router(sync_router)

    if STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    register_tts_routes(app)
    register_stt_routes(app)
    register_config_routes(app)

    return app


# --- TTS ---

class SpeakRequest(BaseModel):
    text: str
    stream: bool = False


class TTSSettingsUpdate(BaseModel):
    voice: Optional[str] = None
    engine: Optional[str] = None
    speed: Optional[float] = None
    volume: Optional[float] = None


def register_tts_routes(app: FastAPI) -> None:

    @app.post("/api/tts/speak")
    async def tts_speak(body: SpeakRequest):
        tts = _get_tts()
        if not body.text.strip():
            raise HTTPException(status_code=400, detail="Text is required")

        if body.stream:
            loop = asyncio.get_running_loop()
            pcm, sr = await loop.run_in_executor(None, tts._synthesize, body.text)

            buf = io.BytesIO()
            with wave.open(buf, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sr)
                wf.writeframes(pcm)
            buf.seek(0)

            return StreamingResponse(buf, media_type="audio/wav", headers={
                "Content-Disposition": "inline; filename=speech.wav"
            })

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, tts.speak, body.text)
        return {"status": "playing"}

    @app.post("/api/tts/stop")
    async def tts_stop():
        _get_tts().stop()
        return {"status": "stopped"}

    @app.post("/api/tts/pause")
    async def tts_pause():
        _get_tts().pause()
        return {"status": "paused"}

    @app.post("/api/tts/resume")
    async def tts_resume():
        _get_tts().resume()
        return {"status": "resumed"}

    @app.get("/api/tts/voices")
    async def tts_voices(engine: Optional[str] = None, language: Optional[str] = None):
        results: dict[str, list] = {}

        if engine in (None, "edge"):
            try:
                loop = asyncio.get_running_loop()
                edge_voices = await loop.run_in_executor(None, EdgeVoiceLister.list_voices, language)
                results["edge"] = edge_voices
            except Exception as exc:
                logger.warning("Failed to list Edge voices: %s", exc)
                results["edge"] = []

        if engine in (None, "piper"):
            try:
                mgr = PiperVoiceManager()
                installed = mgr.list_installed()
                results["piper"] = [{"name": v, "installed": True} for v in installed]
            except Exception as exc:
                logger.warning("Failed to list Piper voices: %s", exc)
                results["piper"] = []

        return results

    @app.put("/api/tts/settings")
    async def tts_update_settings(body: TTSSettingsUpdate):
        tts = _get_tts()
        config = _get_config()

        if body.voice is not None:
            try:
                tts.set_voice(body.voice, body.engine)
                config.tts.voice = body.voice
                if body.engine:
                    config.tts.engine = body.engine
            except Exception as exc:
                raise HTTPException(status_code=400, detail=str(exc))

        if body.speed is not None:
            tts.set_speed(body.speed)
            config.tts.speed = body.speed

        if body.volume is not None:
            config.tts.volume = body.volume

        config.save()
        return {"status": "updated", "settings": asdict(config.tts)}


# --- STT ---

class TranscriptionResponse(BaseModel):
    text: str
    language: Optional[str] = None
    language_probability: float = 0.0
    segments: list[dict] = []


def register_stt_routes(app: FastAPI) -> None:

    @app.post("/api/stt/transcribe", response_model=TranscriptionResponse)
    async def stt_transcribe(file: UploadFile, language: Optional[str] = None):
        if file.content_type and not file.content_type.startswith(("audio/", "application/octet-stream")):
            raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty audio file")

        suffix = Path(file.filename or "audio.wav").suffix or ".wav"
        tmp = Path(tempfile.gettempdir()) / f"orion_stt_{id(data)}{suffix}"
        try:
            tmp.write_bytes(data)
            stt = _get_stt()
            loop = asyncio.get_running_loop()
            result: TranscriptionResult = await loop.run_in_executor(
                None, stt.transcribe, str(tmp), language
            )
            return TranscriptionResponse(
                text=result.text,
                language=result.language,
                language_probability=result.language_probability,
                segments=result.segments,
            )
        finally:
            tmp.unlink(missing_ok=True)

    @app.websocket("/api/stt/stream")
    async def stt_stream(ws: WebSocket):
        await ws.accept()
        stt = _get_stt()
        audio_buffer: list[bytes] = []

        try:
            while True:
                message = await ws.receive()

                if "bytes" in message:
                    chunk = message["bytes"]
                    audio_buffer.append(chunk)

                    audio_data = b"".join(audio_buffer)
                    samples = np.frombuffer(audio_data, dtype=np.float32)

                    if len(samples) >= SAMPLE_RATE * 2:
                        loop = asyncio.get_running_loop()
                        result: TranscriptionResult = await loop.run_in_executor(
                            None, stt.transcribe, samples
                        )
                        await ws.send_json({
                            "type": "transcription",
                            "text": result.text,
                            "language": result.language,
                            "segments": result.segments,
                        })
                        audio_buffer.clear()

                elif "text" in message:
                    text = message["text"]
                    if text == "flush":
                        if audio_buffer:
                            audio_data = b"".join(audio_buffer)
                            samples = np.frombuffer(audio_data, dtype=np.float32)
                            if samples.size > 0:
                                loop = asyncio.get_running_loop()
                                result = await loop.run_in_executor(
                                    None, stt.transcribe, samples
                                )
                                await ws.send_json({
                                    "type": "transcription",
                                    "text": result.text,
                                    "language": result.language,
                                    "segments": result.segments,
                                    "final": True,
                                })
                            audio_buffer.clear()
                    elif text == "reset":
                        audio_buffer.clear()
                        await ws.send_json({"type": "reset", "status": "ok"})

        except WebSocketDisconnect:
            logger.info("STT WebSocket client disconnected")
        except Exception as exc:
            logger.error("STT WebSocket error: %s", exc)
            try:
                await ws.send_json({"type": "error", "detail": str(exc)})
            except Exception:
                pass


# --- Config ---

def register_config_routes(app: FastAPI) -> None:

    @app.get("/api/config")
    async def get_config():
        return asdict(_get_config())

    @app.put("/api/config")
    async def update_config(body: dict):
        config = _get_config()
        for section_key, section_val in body.items():
            if not hasattr(config, section_key):
                continue
            current = getattr(config, section_key)
            if isinstance(section_val, dict) and hasattr(current, "__dataclass_fields__"):
                for k, v in section_val.items():
                    if hasattr(current, k):
                        setattr(current, k, v)
            else:
                setattr(config, section_key, section_val)
        config.save()
        return asdict(config)


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    import uvicorn
    app = create_app()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
