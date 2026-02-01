"""Entry point for ``python -m orion_voice``."""
from __future__ import annotations

import argparse
import logging
import signal
import sys
from types import FrameType
from typing import Optional


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="orion-voice",
        description="Orion Notes - Speech-to-Text and Text-to-Speech for Windows",
    )
    parser.add_argument(
        "--mode",
        choices=("server", "desktop", "headless"),
        default="server",
        help="Run mode: server (API only), desktop (API + Electron GUI), "
             "headless (API + hotkeys, no GUI). Default: server",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="API server bind address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8432,
        help="API server port (default: 8432)",
    )
    parser.add_argument(
        "--log-level",
        choices=("debug", "info", "warning", "error"),
        default="info",
        help="Logging level (default: info)",
    )
    return parser


def _setup_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%H:%M:%S",
    )


def main(argv: Optional[list[str]] = None) -> None:
    args = _build_parser().parse_args(argv)
    _setup_logging(args.log_level)

    logger = logging.getLogger("orion_voice")
    logger.info("Orion Notes starting (mode=%s)", args.mode)

    # Late import so logging is configured before any module-level loggers fire
    from orion_voice.app import OrionVoiceApp
    from orion_voice.core.config import OrionConfig

    config = OrionConfig.load()
    app = OrionVoiceApp(config=config)

    # Graceful shutdown on Ctrl+C / SIGTERM
    def _signal_handler(sig: int, _frame: Optional[FrameType]) -> None:
        logger.info("Received signal %s, shutting down", signal.Signals(sig).name)
        app.request_shutdown()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    try:
        app.start(mode=args.mode, host=args.host, port=args.port)
        app.wait()
    except Exception:
        logger.exception("Fatal error")
        sys.exit(1)
    finally:
        app.stop()


if __name__ == "__main__":
    main()
