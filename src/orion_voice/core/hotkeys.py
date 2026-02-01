from __future__ import annotations

import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

from pynput import keyboard


class HotkeyMode(Enum):
    HOLD = "hold"
    TOGGLE = "toggle"


@dataclass
class HotkeyBinding:
    keys: str
    on_activate: Callable[[], None]
    on_deactivate: Optional[Callable[[], None]] = None
    mode: HotkeyMode = HotkeyMode.HOLD


def _parse_keys(combo: str) -> frozenset[keyboard.Key | keyboard.KeyCode]:
    mapping: dict[str, keyboard.Key] = {
        "ctrl": keyboard.Key.ctrl_l,
        "shift": keyboard.Key.shift,
        "alt": keyboard.Key.alt_l,
        "cmd": keyboard.Key.cmd,
        "space": keyboard.Key.space,
        "tab": keyboard.Key.tab,
        "enter": keyboard.Key.enter,
        "esc": keyboard.Key.esc,
    }
    parts = [p.strip().lower() for p in combo.split("+")]
    keys: list[keyboard.Key | keyboard.KeyCode] = []
    for part in parts:
        if part in mapping:
            keys.append(mapping[part])
        elif len(part) == 1:
            keys.append(keyboard.KeyCode.from_char(part))
        else:
            raise ValueError(f"Unknown key: {part}")
    return frozenset(keys)


class HotkeyManager:
    def __init__(self) -> None:
        self._bindings: dict[str, HotkeyBinding] = {}
        self._pressed: set[keyboard.Key | keyboard.KeyCode] = set()
        self._active_holds: set[str] = set()
        self._active_toggles: set[str] = set()
        self._listener: Optional[keyboard.Listener] = None
        self._lock = threading.Lock()

    def register(self, name: str, binding: HotkeyBinding) -> None:
        with self._lock:
            self._bindings[name] = binding

    def unregister(self, name: str) -> None:
        with self._lock:
            self._bindings.pop(name, None)
            self._active_holds.discard(name)
            self._active_toggles.discard(name)

    def _normalize_key(self, key: keyboard.Key | keyboard.KeyCode) -> keyboard.Key | keyboard.KeyCode:
        if isinstance(key, keyboard.Key):
            if key in (keyboard.Key.ctrl_l, keyboard.Key.ctrl_r):
                return keyboard.Key.ctrl_l
            if key in (keyboard.Key.alt_l, keyboard.Key.alt_r):
                return keyboard.Key.alt_l
            if key in (keyboard.Key.shift, keyboard.Key.shift_l, keyboard.Key.shift_r):
                return keyboard.Key.shift
        if isinstance(key, keyboard.KeyCode) and key.char:
            return keyboard.KeyCode.from_char(key.char.lower())
        return key

    def _on_press(self, key: keyboard.Key | keyboard.KeyCode) -> None:
        nk = self._normalize_key(key)
        self._pressed.add(nk)

        with self._lock:
            for name, binding in self._bindings.items():
                required = _parse_keys(binding.keys)
                if not required.issubset(self._pressed):
                    continue

                if binding.mode == HotkeyMode.HOLD:
                    if name not in self._active_holds:
                        self._active_holds.add(name)
                        binding.on_activate()

                elif binding.mode == HotkeyMode.TOGGLE:
                    if name in self._active_toggles:
                        self._active_toggles.discard(name)
                        if binding.on_deactivate:
                            binding.on_deactivate()
                    else:
                        self._active_toggles.add(name)
                        binding.on_activate()

    def _on_release(self, key: keyboard.Key | keyboard.KeyCode) -> None:
        nk = self._normalize_key(key)
        self._pressed.discard(nk)

        with self._lock:
            for name in list(self._active_holds):
                binding = self._bindings.get(name)
                if binding is None:
                    self._active_holds.discard(name)
                    continue
                required = _parse_keys(binding.keys)
                if not required.issubset(self._pressed):
                    self._active_holds.discard(name)
                    if binding.on_deactivate:
                        binding.on_deactivate()

    def start(self) -> None:
        if self._listener is not None:
            return
        self._listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release,
        )
        self._listener.daemon = True
        self._listener.start()

    def stop(self) -> None:
        if self._listener is not None:
            self._listener.stop()
            self._listener = None
            self._pressed.clear()
            self._active_holds.clear()


def create_default_bindings(
    hotkey_settings: object,
    *,
    start_recording: Callable[[], None],
    stop_recording: Callable[[], None],
    read_clipboard: Callable[[], None],
    pause_tts: Callable[[], None],
    stop_tts: Callable[[], None],
) -> dict[str, HotkeyBinding]:
    hs = hotkey_settings
    return {
        "push_to_talk": HotkeyBinding(
            keys=getattr(hs, "push_to_talk", "ctrl+shift+a"),
            on_activate=start_recording,
            on_deactivate=stop_recording,
            mode=HotkeyMode.HOLD,
        ),
        "toggle_recording": HotkeyBinding(
            keys=getattr(hs, "toggle_recording", "ctrl+shift+t"),
            on_activate=start_recording,
            on_deactivate=stop_recording,
            mode=HotkeyMode.TOGGLE,
        ),
        "read_clipboard": HotkeyBinding(
            keys=getattr(hs, "read_clipboard", "ctrl+shift+r"),
            on_activate=read_clipboard,
            mode=HotkeyMode.TOGGLE,
        ),
        "pause_tts": HotkeyBinding(
            keys=getattr(hs, "pause_tts", "ctrl+shift+p"),
            on_activate=pause_tts,
            mode=HotkeyMode.TOGGLE,
        ),
        "stop_tts": HotkeyBinding(
            keys=getattr(hs, "stop_tts", "ctrl+shift+s"),
            on_activate=stop_tts,
            mode=HotkeyMode.TOGGLE,
        ),
    }
