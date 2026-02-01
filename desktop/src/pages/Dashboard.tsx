import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Clipboard,
  Volume2,
  VolumeX,
  Activity,
  Zap,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { apiPost } from '../hooks/useApi';

type SttStatus = 'idle' | 'recording' | 'processing';
type TtsStatus = 'idle' | 'playing' | 'paused';

interface ActivityItem {
  id: string;
  type: 'stt' | 'tts' | 'note';
  text: string;
  time: string;
}

const mockActivity: ActivityItem[] = [
  { id: '1', type: 'stt', text: 'Transcribed meeting notes', time: '2 min ago' },
  { id: '2', type: 'tts', text: 'Read "Project Update" note aloud', time: '15 min ago' },
  { id: '3', type: 'note', text: 'Created note "API Design v2"', time: '1 hr ago' },
  { id: '4', type: 'stt', text: 'Voice memo captured', time: '3 hrs ago' },
];

export default function Dashboard() {
  const [sttStatus, setSttStatus] = useState<SttStatus>('idle');
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle');

  const toggleRecording = async () => {
    if (sttStatus === 'idle') {
      setSttStatus('recording');
      try {
        await apiPost('/stt/start');
      } catch {
        // Backend may not be running yet
      }
    } else {
      setSttStatus('idle');
      try {
        await apiPost('/stt/stop');
      } catch {}
    }
  };

  const readClipboard = async () => {
    setTtsStatus('playing');
    try {
      await apiPost('/tts/read-clipboard');
    } catch {}
    setTimeout(() => setTtsStatus('idle'), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-orion-text">Dashboard</h2>
        <p className="text-sm text-orion-text-tertiary mt-1">
          Voice assistant status and quick actions
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* STT Status */}
        <div className="orion-card group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-orion-text-tertiary uppercase tracking-wider">
              Speech to Text
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'glow-dot',
                  sttStatus === 'recording'
                    ? 'bg-red-400 text-red-400 animate-pulse'
                    : sttStatus === 'processing'
                    ? 'bg-orion-warning text-orion-warning'
                    : 'bg-orion-text-tertiary text-orion-text-tertiary'
                )}
              />
              <span className="text-xs text-orion-text-secondary capitalize">
                {sttStatus}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-orion flex items-center justify-center transition-all duration-300',
                sttStatus === 'recording'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-orion-surface-2 text-orion-text-tertiary'
              )}
            >
              {sttStatus === 'recording' ? (
                <Activity size={20} className="animate-pulse" />
              ) : (
                <Mic size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-orion-text font-medium">
                {sttStatus === 'recording'
                  ? 'Listening...'
                  : sttStatus === 'processing'
                  ? 'Processing audio...'
                  : 'Ready to record'}
              </p>
              <p className="text-xs text-orion-text-tertiary mt-0.5">
                Press hotkey or click Start
              </p>
            </div>
          </div>
        </div>

        {/* TTS Status */}
        <div className="orion-card group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-orion-text-tertiary uppercase tracking-wider">
              Text to Speech
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'glow-dot',
                  ttsStatus === 'playing'
                    ? 'bg-orion-primary text-orion-primary animate-pulse'
                    : 'bg-orion-text-tertiary text-orion-text-tertiary'
                )}
              />
              <span className="text-xs text-orion-text-secondary capitalize">
                {ttsStatus}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-orion flex items-center justify-center transition-all duration-300',
                ttsStatus === 'playing'
                  ? 'bg-orion-primary/20 text-orion-primary'
                  : 'bg-orion-surface-2 text-orion-text-tertiary'
              )}
            >
              {ttsStatus === 'playing' ? (
                <Volume2 size={20} className="animate-pulse" />
              ) : (
                <VolumeX size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-orion-text font-medium">
                {ttsStatus === 'playing'
                  ? 'Speaking...'
                  : ttsStatus === 'paused'
                  ? 'Paused'
                  : 'Idle'}
              </p>
              <p className="text-xs text-orion-text-tertiary mt-0.5">
                No active playback
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-medium text-orion-text-secondary mb-3">
          Quick Actions
        </h3>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={toggleRecording}
            className={clsx(
              'flex items-center gap-2.5 px-5 py-3 rounded-orion-lg font-medium text-sm transition-all duration-200',
              sttStatus === 'recording'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                : 'bg-gradient-orion text-white shadow-orion-glow hover:shadow-orion-glow-strong'
            )}
          >
            {sttStatus === 'recording' ? <MicOff size={16} /> : <Mic size={16} />}
            {sttStatus === 'recording' ? 'Stop Recording' : 'Start Recording'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={readClipboard}
            className="orion-btn-ghost flex items-center gap-2.5 border border-orion-border"
          >
            <Clipboard size={16} />
            Read Clipboard
          </motion.button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-orion-text-tertiary" />
          <h3 className="text-sm font-medium text-orion-text-secondary">
            Recent Activity
          </h3>
        </div>
        <div className="space-y-1">
          {mockActivity.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-orion-surface/60 transition-colors duration-150 group"
            >
              <div
                className={clsx(
                  'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                  item.type === 'stt'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : item.type === 'tts'
                    ? 'bg-orion-primary/10 text-orion-accent'
                    : 'bg-amber-500/10 text-amber-400'
                )}
              >
                {item.type === 'stt' ? (
                  <Mic size={14} />
                ) : item.type === 'tts' ? (
                  <Volume2 size={14} />
                ) : (
                  <Zap size={14} />
                )}
              </div>
              <span className="text-sm text-orion-text-secondary group-hover:text-orion-text transition-colors flex-1">
                {item.text}
              </span>
              <span className="text-xs text-orion-text-tertiary shrink-0">
                {item.time}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
