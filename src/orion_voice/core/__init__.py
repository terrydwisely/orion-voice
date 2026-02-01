from orion_voice.core.config import OrionConfig, STTSettings, TTSSettings, HotkeySettings, WebSyncSettings

try:
    from orion_voice.core.hotkeys import HotkeyManager, HotkeyBinding, HotkeyMode, create_default_bindings
    from orion_voice.core.clipboard import read_clipboard, write_clipboard, insert_at_cursor, ClipboardMonitor
except ImportError:
    HotkeyManager = None  # type: ignore[assignment,misc]
    HotkeyBinding = None  # type: ignore[assignment,misc]
    HotkeyMode = None  # type: ignore[assignment,misc]
    create_default_bindings = None  # type: ignore[assignment,misc]
    read_clipboard = None  # type: ignore[assignment,misc]
    write_clipboard = None  # type: ignore[assignment,misc]
    insert_at_cursor = None  # type: ignore[assignment,misc]
    ClipboardMonitor = None  # type: ignore[assignment,misc]

__all__ = [
    "OrionConfig",
    "STTSettings",
    "TTSSettings",
    "HotkeySettings",
    "WebSyncSettings",
    "HotkeyManager",
    "HotkeyBinding",
    "HotkeyMode",
    "create_default_bindings",
    "read_clipboard",
    "write_clipboard",
    "insert_at_cursor",
    "ClipboardMonitor",
]
