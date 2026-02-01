from __future__ import annotations

import threading
import time
from typing import Callable, Optional

import win32clipboard
import win32con
import win32api
import win32gui


def read_clipboard() -> str:
    win32clipboard.OpenClipboard()
    try:
        if win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
            return str(win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT))
        return ""
    finally:
        win32clipboard.CloseClipboard()


def write_clipboard(text: str) -> None:
    win32clipboard.OpenClipboard()
    try:
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
    finally:
        win32clipboard.CloseClipboard()


def insert_at_cursor(text: str) -> None:
    previous = read_clipboard()
    write_clipboard(text)
    hwnd = win32gui.GetForegroundWindow()
    if hwnd:
        win32api.SendMessage(hwnd, win32con.WM_PASTE, 0, 0)
        time.sleep(0.05)
    write_clipboard(previous)


class ClipboardMonitor:
    def __init__(self, callback: Callable[[str], None], poll_interval: float = 0.5) -> None:
        self._callback = callback
        self._interval = poll_interval
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_content: str = ""

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._last_content = read_clipboard()
        self._thread = threading.Thread(target=self._poll, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def _poll(self) -> None:
        while self._running:
            try:
                current = read_clipboard()
                if current and current != self._last_content:
                    self._last_content = current
                    self._callback(current)
            except Exception:
                pass
            time.sleep(self._interval)
