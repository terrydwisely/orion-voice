import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Volume2,
  Gauge,
  Keyboard,
  Moon,
  Sun,
  Power,
  ChevronDown,
  Mic,
  Square,
  Clipboard,
  Pause,
  Info,
} from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../hooks/useTheme';
import { apiPut } from '../hooks/useApi';

const API_BASE = 'http://127.0.0.1:8432';

interface SettingSection {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SettingSection) {
  return (
    <div className="orion-card space-y-4">
      <h3 className="text-sm font-semibold text-orion-text">{title}</h3>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: any;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-orion-surface-2 flex items-center justify-center text-orion-text-tertiary shrink-0">
          <Icon size={15} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-orion-text">{label}</p>
          {description && (
            <p className="text-xs text-orion-text-tertiary mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={clsx(
        'w-10 h-[22px] rounded-full relative transition-colors duration-200',
        enabled ? 'bg-orion-primary' : 'bg-orion-surface-3'
      )}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

const SHORTCUTS = [
  { keys: 'Ctrl + Shift + A', action: 'Push to Talk', description: 'Hold to record, release to stop', icon: Mic },
  { keys: 'Ctrl + Shift + T', action: 'Toggle Recording', description: 'Press to start/stop recording', icon: Mic },
  { keys: 'Ctrl + Shift + R', action: 'Read Clipboard', description: 'Read clipboard contents aloud', icon: Clipboard },
  { keys: 'Ctrl + Shift + P', action: 'Pause / Resume TTS', description: 'Pause or resume text-to-speech playback', icon: Pause },
  { keys: 'Ctrl + Shift + S', action: 'Stop TTS', description: 'Stop text-to-speech playback', icon: Square },
];

export default function Settings() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [voice, setVoice] = useState('en-US-AriaNeural');
  const [speed, setSpeed] = useState(1.0);
  const [autoStart, setAutoStart] = useState(false);

  // Load current settings from backend
  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.tts?.voice) setVoice(cfg.tts.voice);
        if (cfg.tts?.speed) setSpeed(cfg.tts.speed);
      })
      .catch(() => {});
  }, []);

  const updateVoice = async (v: string) => {
    setVoice(v);
    try {
      await apiPut('/api/tts/settings', { voice: v });
    } catch {}
  };

  const updateSpeed = async (s: number) => {
    setSpeed(s);
    try {
      await apiPut('/api/tts/settings', { speed: s });
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-orion-text">Settings</h2>
        <p className="text-sm text-orion-text-tertiary mt-1">
          Configure your voice assistant
        </p>
      </div>

      {/* Voice */}
      <Section title="Voice">
        <SettingRow icon={Volume2} label="Voice" description="Microsoft Edge Neural TTS voice">
          <div className="relative">
            <select
              value={voice}
              onChange={(e) => updateVoice(e.target.value)}
              className="appearance-none orion-input w-56 pr-8 cursor-pointer"
            >
              <optgroup label="Microsoft Neural - Female">
                <option value="en-US-AriaNeural">Aria (US)</option>
                <option value="en-US-JennyNeural">Jenny (US)</option>
                <option value="en-US-MichelleNeural">Michelle (US)</option>
                <option value="en-US-AnaNeural">Ana (US)</option>
                <option value="en-US-SaraNeural">Sara (US)</option>
                <option value="en-GB-SoniaNeural">Sonia (UK)</option>
                <option value="en-GB-LibbyNeural">Libby (UK)</option>
                <option value="en-GB-MaisieNeural">Maisie (UK)</option>
                <option value="en-AU-NatashaNeural">Natasha (AU)</option>
              </optgroup>
              <optgroup label="Microsoft Neural - Male">
                <option value="en-US-GuyNeural">Guy (US)</option>
                <option value="en-US-DavisNeural">Davis (US)</option>
                <option value="en-US-JasonNeural">Jason (US)</option>
                <option value="en-US-TonyNeural">Tony (US)</option>
                <option value="en-US-BrandonNeural">Brandon (US)</option>
                <option value="en-GB-RyanNeural">Ryan (UK)</option>
                <option value="en-GB-ThomasNeural">Thomas (UK)</option>
                <option value="en-AU-WilliamNeural">William (AU)</option>
              </optgroup>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-orion-text-tertiary pointer-events-none"
            />
          </div>
        </SettingRow>

        <SettingRow
          icon={Gauge}
          label="Speed"
          description={`${speed.toFixed(1)}x playback speed`}
        >
          <div className="flex items-center gap-3 w-48">
            <span className="text-xs text-orion-text-tertiary">0.5</span>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={speed}
              onChange={(e) => updateSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-orion-primary h-1 bg-orion-surface-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orion-primary [&::-webkit-slider-thumb]:shadow-orion-glow"
            />
            <span className="text-xs text-orion-text-tertiary">2.0</span>
          </div>
        </SettingRow>
      </Section>

      {/* Keyboard Shortcuts */}
      <Section title="Keyboard Shortcuts">
        <div className="space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-orion-surface-2 flex items-center justify-center text-orion-text-tertiary shrink-0">
                  <s.icon size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-orion-text">{s.action}</p>
                  <p className="text-xs text-orion-text-tertiary mt-0.5">{s.description}</p>
                </div>
              </div>
              <div className="orion-input w-48 text-center text-xs font-mono shrink-0">
                {s.keys}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <SettingRow
          icon={theme === 'dark' ? Moon : Sun}
          label="Dark Mode"
          description="Toggle dark/light theme"
        >
          <Toggle enabled={theme === 'dark'} onChange={toggleTheme} />
        </SettingRow>
      </Section>

      {/* System */}
      <Section title="System">
        <SettingRow
          icon={Power}
          label="Launch at Startup"
          description="Start Orion Notes when you log in"
        >
          <Toggle enabled={autoStart} onChange={setAutoStart} />
        </SettingRow>
      </Section>
    </div>
  );
}
