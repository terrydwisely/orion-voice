import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Volume2, Loader2 } from 'lucide-react';
import { ttsSpeak, useTtsVoices } from '../hooks/useApi';

export default function TTS() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: voices } = useTtsVoices();

  // Set default voice
  useEffect(() => {
    if (voices.length > 0 && !voice) {
      const aria = voices.find((v) => v.ShortName === 'en-US-AriaNeural');
      setVoice(aria ? aria.ShortName : voices[0].ShortName);
    }
  }, [voices, voice]);

  async function handlePlay() {
    if (playing) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }

    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const audio = await ttsSpeak(text, voice || undefined, speed);
      audioRef.current = audio;
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('error', () => {
        setPlaying(false);
        setError('Playback error');
      });
      await audio.play();
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TTS failed');
    } finally {
      setLoading(false);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-orion-text mb-4 flex items-center gap-2">
        <Volume2 size={20} className="text-orion-primary" />
        Text to Speech
      </h2>

      {/* Text input */}
      <div className="orion-card flex-1 flex flex-col mb-4 min-h-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-transparent text-sm text-orion-text-secondary leading-relaxed border-none outline-none resize-none placeholder:text-orion-text-tertiary min-h-[160px]"
          placeholder="Type or paste text to read aloud..."
        />
        <div className="flex items-center justify-between pt-3 border-t border-orion-border-subtle text-xs text-orion-text-tertiary">
          <span>{text.length} characters</span>
          <span>{text.split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>

      {/* Controls */}
      <div className="orion-card space-y-4">
        {/* Voice selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-orion-text-secondary shrink-0 w-16">Voice</label>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="orion-input"
          >
            {voices.length === 0 && <option value="">Loading voices...</option>}
            {voices.map((v) => (
              <option key={v.ShortName} value={v.ShortName}>
                {v.FriendlyName || v.ShortName}
              </option>
            ))}
          </select>
        </div>

        {/* Speed slider */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-orion-text-secondary shrink-0 w-16">Speed</label>
          <div className="flex-1 flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1 accent-orion-primary"
            />
            <span className="text-sm text-orion-text-secondary font-mono w-10 text-right">
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Play button */}
        <div className="flex items-center gap-3 pt-1">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handlePlay}
            disabled={loading || (!text.trim() && !playing)}
            className="orion-btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : playing ? (
              <Square size={16} />
            ) : (
              <Play size={16} />
            )}
            {loading ? 'Generating...' : playing ? 'Stop' : 'Play'}
          </motion.button>

          {error && <span className="text-xs text-orion-danger">{error}</span>}
        </div>
      </div>
    </div>
  );
}
