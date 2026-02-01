import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Volume2,
  Gauge,
  Keyboard,
  Moon,
  Sun,
  Power,
  Server,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

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

export default function Settings() {
  const [voice, setVoice] = useState('nova');
  const [speed, setSpeed] = useState(1.0);
  const [darkMode, setDarkMode] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [syncUrl, setSyncUrl] = useState('http://localhost:8432');
  const [hotkey, setHotkey] = useState('Ctrl+Shift+Space');

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
        <SettingRow icon={Volume2} label="Voice" description="TTS voice model">
          <div className="relative">
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="appearance-none orion-input w-40 pr-8 cursor-pointer"
            >
              <option value="alloy">Alloy</option>
              <option value="echo">Echo</option>
              <option value="fable">Fable</option>
              <option value="nova">Nova</option>
              <option value="onyx">Onyx</option>
              <option value="shimmer">Shimmer</option>
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
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-orion-primary h-1 bg-orion-surface-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orion-primary [&::-webkit-slider-thumb]:shadow-orion-glow"
            />
            <span className="text-xs text-orion-text-tertiary">2.0</span>
          </div>
        </SettingRow>
      </Section>

      {/* Controls */}
      <Section title="Controls">
        <SettingRow
          icon={Keyboard}
          label="Recording Hotkey"
          description="Global shortcut to toggle recording"
        >
          <div className="orion-input w-48 text-center text-xs font-mono cursor-pointer hover:border-orion-primary transition-colors">
            {hotkey}
          </div>
        </SettingRow>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <SettingRow
          icon={darkMode ? Moon : Sun}
          label="Dark Mode"
          description="Toggle dark/light theme"
        >
          <Toggle enabled={darkMode} onChange={setDarkMode} />
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

        <SettingRow
          icon={Server}
          label="Sync Server"
          description="Backend API endpoint"
        >
          <input
            type="text"
            value={syncUrl}
            onChange={(e) => setSyncUrl(e.target.value)}
            className="orion-input w-56 text-xs font-mono"
          />
        </SettingRow>
      </Section>
    </div>
  );
}
