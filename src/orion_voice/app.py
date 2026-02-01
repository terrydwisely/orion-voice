"""Application orchestrator for Orion Voice."""
from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional

from orion_voice.core.clipboard import insert_at_cursor, read_clipboard
from orion_voice.core.config import OrionConfig
from orion_voice.core.hotkeys import HotkeyManager, create_default_bindings

logger = logging.getLogger(__name__)

PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent
DESKTOP_DIR: Path = PROJECT_ROOT / "desktop"


class OrionVoiceApp:
    """Ties together STT, TTS, hotkeys, API server, and optional Electron GUI."""

    def __init__(self, config: Optional[OrionConfig] = None) -> None:
        self.config: OrionConfig = config or OrionConfig.load()

        # Lazy-initialised engines (created in start() so imports happen after
        # logging is fully configured and only when actually needed).
        self.stt: object = None  # orion_voice.stt.engine.STTEngine
        self.tts: object = None  # orion_voice.tts.engine.TTSManager
        self.recorder: object = None  # orion_voice.stt.recorder.AudioRecorder

        # Hotkey manager (always constructed, but only started in desktop/headless)
        self.hotkeys: HotkeyManager = HotkeyManager()

        # Internal state
        self._server_thread: Optional[threading.Thread] = None
        self._electron_proc: Optional[subprocess.Popen[bytes]] = None
        self._shutdown_event: threading.Event = threading.Event()
        self._recording_lock: threading.Lock = threading.Lock()
        self._uvicorn_server: object = None

    # ------------------------------------------------------------------
    # Lazy engine initialisation
    # ------------------------------------------------------------------

    def _init_engines(self) -> None:
        """Import and create STT / TTS engines."""
        from orion_voice.stt.engine import STTEngine  # type: ignore[import-untyped]
        from orion_voice.stt.recorder import AudioRecorder  # type: ignore[import-untyped]
        from orion_voice.tts.engine import TTSManager  # type: ignore[import-untyped]

        self.stt = STTEngine(
            model_size=self.config.stt.model_size,
            device=self.config.stt.device,
            on_final=self._on_transcription,
        )
        self.tts = TTSManager()
        self._configure_tts()
        self.recorder = AudioRecorder()

    # ------------------------------------------------------------------
    # Configuration helpers
    # ------------------------------------------------------------------

    def _configure_tts(self) -> None:
        try:
            self.tts.set_voice(self.config.tts.voice, self.config.tts.engine)  # type: ignore[union-attr]
        except Exception:
            logger.warning("Could not set configured TTS voice, using defaults")
        self.tts.set_speed(self.config.tts.speed)  # type: ignore[union-attr]

    # ------------------------------------------------------------------
    # Recording flow: hotkey -> record -> transcribe -> insert at cursor
    # ------------------------------------------------------------------

    def _start_recording(self) -> None:
        with self._recording_lock:
            if self.recorder is None or self.recorder.is_recording:  # type: ignore[union-attr]
                return
            logger.info("Recording started (hotkey)")
            try:
                self.recorder.start()  # type: ignore[union-attr]
            except RuntimeError as exc:
                logger.error("Failed to start recording: %s", exc)

    def _stop_recording(self) -> None:
        with self._recording_lock:
            if self.recorder is None or not self.recorder.is_recording:  # type: ignore[union-attr]
                return
            logger.info("Recording stopped (hotkey)")
            audio = self.recorder.stop()  # type: ignore[union-attr]

        if audio.size == 0:
            logger.info("No audio captured")
            return

        # Transcribe in a background thread so the hotkey listener is not blocked
        threading.Thread(
            target=self._transcribe_and_insert,
            args=(audio,),
            daemon=True,
        ).start()

    def _transcribe_and_insert(self, audio: object) -> None:
        try:
            result = self.stt.transcribe(audio, language=self.config.stt.language)  # type: ignore[union-attr]
            if result.text.strip():
                logger.info("Transcription: %s", result.text)
                insert_at_cursor(result.text)
        except Exception:
            logger.exception("Transcription failed")

    def _on_transcription(self, result: object) -> None:
        """Called by STTEngine.on_final when streaming transcription completes."""
        logger.debug("Transcription result: %s", getattr(result, "text", result))

    # ------------------------------------------------------------------
    # Clipboard read flow: hotkey -> read clipboard -> TTS speak
    # ------------------------------------------------------------------

    def _read_clipboard_and_speak(self) -> None:
        threading.Thread(target=self._do_read_clipboard, daemon=True).start()

    def _do_read_clipboard(self) -> None:
        try:
            text = read_clipboard()
            if text.strip():
                logger.info("Speaking clipboard text (%d chars)", len(text))
                self.tts.speak(text)  # type: ignore[union-attr]
            else:
                logger.info("Clipboard is empty")
        except Exception:
            logger.exception("Failed to read clipboard or speak")

    # ------------------------------------------------------------------
    # TTS controls (exposed to hotkeys)
    # ------------------------------------------------------------------

    def _pause_tts(self) -> None:
        from orion_voice.tts.engine import PlaybackState  # type: ignore[import-untyped]

        if self.tts.playback_state == PlaybackState.PAUSED:  # type: ignore[union-attr]
            self.tts.resume()  # type: ignore[union-attr]
        else:
            self.tts.pause()  # type: ignore[union-attr]

    def _stop_tts(self) -> None:
        if self.tts is not None:
            self.tts.stop()  # type: ignore[union-attr]

    # ------------------------------------------------------------------
    # Hotkey registration
    # ------------------------------------------------------------------

    def _register_hotkeys(self) -> None:
        bindings = create_default_bindings(
            self.config.hotkeys,
            start_recording=self._start_recording,
            stop_recording=self._stop_recording,
            read_clipboard=self._read_clipboard_and_speak,
            pause_tts=self._pause_tts,
            stop_tts=self._stop_tts,
        )
        for name, binding in bindings.items():
            self.hotkeys.register(name, binding)
        logger.info("Hotkeys registered")

    # ------------------------------------------------------------------
    # API server (FastAPI via uvicorn)
    # ------------------------------------------------------------------

    def _run_server(self, host: str, port: int) -> None:
        import uvicorn

        from orion_voice.api.server import create_app  # type: ignore[import-untyped]

        fastapi_app = create_app()
        server_config = uvicorn.Config(
            fastapi_app, host=host, port=port, log_level="info",
        )
        server = uvicorn.Server(server_config)
        self._uvicorn_server = server
        server.run()

    def _start_api_server(self, host: str, port: int) -> None:
        """Start the FastAPI server in a background daemon thread."""
        self._server_thread = threading.Thread(
            target=self._run_server,
            args=(host, port),
            daemon=True,
        )
        self._server_thread.start()
        logger.info("API server starting on %s:%d", host, port)

    # ------------------------------------------------------------------
    # Electron desktop app
    # ------------------------------------------------------------------

    def _launch_electron(self, port: int) -> None:
        """Launch the Electron desktop app as a child process."""
        if not DESKTOP_DIR.is_dir():
            logger.warning("Desktop directory not found: %s", DESKTOP_DIR)
            return

        npm_cmd: str = "npm.cmd" if sys.platform == "win32" else "npm"
        env = {**os.environ, "ORION_API_PORT": str(port)}

        try:
            self._electron_proc = subprocess.Popen(
                [npm_cmd, "run", "dev"],
                cwd=str(DESKTOP_DIR),
                env=env,
            )
            logger.info("Electron app launched (pid=%d)", self._electron_proc.pid)
        except FileNotFoundError:
            logger.error("npm not found. Install Node.js to use the desktop app.")
        except Exception:
            logger.exception("Failed to launch Electron app")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(
        self,
        mode: str = "server",
        host: str = "127.0.0.1",
        port: int = 8432,
    ) -> None:
        """Start the application in the given *mode*.

        Modes
        -----
        server   -- FastAPI backend only.
        desktop  -- Backend + Electron GUI + hotkeys.
        headless -- Backend + hotkeys, no GUI.
        """
        logger.info("Starting Orion Voice in '%s' mode", mode)

        # Initialise engines for modes that need STT/TTS
        if mode in ("desktop", "headless"):
            self._init_engines()

        # Always start the API server
        self._start_api_server(host=host, port=port)

        # Register hotkeys for desktop and headless modes
        if mode in ("desktop", "headless"):
            self._register_hotkeys()
            self.hotkeys.start()

        # Launch Electron for desktop mode
        if mode == "desktop":
            self._launch_electron(port=port)

        logger.info("Orion Voice is running")

    def wait(self) -> None:
        """Block until shutdown is signalled."""
        try:
            self._shutdown_event.wait()
        except KeyboardInterrupt:
            pass

    def stop(self) -> None:
        """Gracefully shut down all components."""
        if self._shutdown_event.is_set():
            # Avoid double-stop
            return
        self._shutdown_event.set()

        logger.info("Shutting down Orion Voice")

        # Stop hotkeys
        self.hotkeys.stop()

        # Stop any active recording
        if self.recorder is not None and getattr(self.recorder, "is_recording", False):
            self.recorder.stop()  # type: ignore[union-attr]

        # Stop TTS playback
        if self.tts is not None:
            self.tts.stop()  # type: ignore[union-attr]

        # Terminate Electron
        if self._electron_proc is not None:
            try:
                self._electron_proc.terminate()
                self._electron_proc.wait(timeout=5)
            except Exception:
                self._electron_proc.kill()
            self._electron_proc = None

        # Stop uvicorn
        if self._uvicorn_server is not None:
            self._uvicorn_server.should_exit = True  # type: ignore[union-attr]

        logger.info("Orion Voice stopped")

    def request_shutdown(self) -> None:
        """Signal the app to shut down (can be called from any thread)."""
        self._shutdown_event.set()
