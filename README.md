# Orion Notes

A personal notes application with text-to-speech and speech-to-text for Windows.

## Features
- **Notes Management**: Create, edit, and organize your notes
- **Speech-to-Text**: Hold a hotkey, speak, release - text appears at your cursor
- **Text-to-Speech**: Copy text, press a hotkey, hear it read aloud
- **100% Offline STT** using faster-whisper
- **Local TTS** using Piper TTS with Edge-TTS fallback
- **Global hotkeys** that work from any application
- **System tray app** that runs quietly in the background
- **Speed control, pause/resume, voice selection**

## Tech Stack
- Python 3.10+
- faster-whisper (STT)
- Piper TTS + Edge-TTS (TTS)
- PyQt6 (GUI/System Tray)
- pynput (Global Hotkeys)
- sounddevice (Microphone)

## Setup
```bash
pip install -r requirements.txt
python -m orion_voice
```

## License
MIT
