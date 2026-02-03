from __future__ import annotations

import json
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


_data_dir = os.environ.get("ORION_DATA_DIR")
CONFIG_DIR = Path(_data_dir) if _data_dir else Path.home() / ".orion-voice"
CONFIG_PATH = CONFIG_DIR / "config.json"


@dataclass
class HotkeySettings:
    push_to_talk: str = "ctrl+shift+a"
    toggle_recording: str = "ctrl+shift+t"
    read_clipboard: str = "ctrl+shift+r"
    pause_tts: str = "ctrl+shift+p"
    stop_tts: str = "ctrl+shift+s"


@dataclass
class STTSettings:
    model_size: str = "base"
    language: Optional[str] = None
    device: str = "auto"


@dataclass
class TTSSettings:
    engine: str = "edge"
    voice: str = "en-US-AriaNeural"
    speed: float = 1.0
    volume: float = 1.0


@dataclass
class OrionConfig:
    stt: STTSettings = field(default_factory=STTSettings)
    tts: TTSSettings = field(default_factory=TTSSettings)
    hotkeys: HotkeySettings = field(default_factory=HotkeySettings)
    auto_start: bool = False
    minimize_to_tray: bool = True

    def save(self, path: Path = CONFIG_PATH) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path = CONFIG_PATH) -> OrionConfig:
        if not path.exists():
            config = cls()
            config.save(path)
            return config

        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            stt=STTSettings(**data.get("stt", {})),
            tts=TTSSettings(**data.get("tts", {})),
            hotkeys=HotkeySettings(**data.get("hotkeys", {})),
            auto_start=data.get("auto_start", False),
            minimize_to_tray=data.get("minimize_to_tray", True),
        )

    def update(self, **kwargs: object) -> None:
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.save()
