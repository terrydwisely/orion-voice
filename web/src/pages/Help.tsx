import { Keyboard, Mic, Volume2, FileText, Globe, Info } from 'lucide-react';

const shortcuts = [
  { keys: 'Ctrl + Shift + A', action: 'Push-to-talk', description: 'Hold to record speech, release to transcribe' },
  { keys: 'Ctrl + Shift + T', action: 'Toggle recording', description: 'Start/stop continuous speech recording' },
  { keys: 'Ctrl + Shift + R', action: 'Read clipboard', description: 'Read aloud whatever text is on your clipboard' },
  { keys: 'Ctrl + Shift + P', action: 'Pause TTS', description: 'Pause or resume text-to-speech playback' },
  { keys: 'Ctrl + Shift + S', action: 'Stop TTS', description: 'Stop text-to-speech playback completely' },
];

const sections = [
  {
    icon: Volume2,
    title: 'Text-to-Speech (TTS)',
    items: [
      'Go to the TTS page from the sidebar',
      'Type or paste text into the text box',
      'Pick a voice from the dropdown (English voices from Microsoft Edge)',
      'Adjust speed with the slider',
      'Click "Speak" to hear it read aloud',
      'Use Ctrl+Shift+R to read whatever you copied to your clipboard',
    ],
  },
  {
    icon: Mic,
    title: 'Speech-to-Text (STT)',
    items: [
      'Hold Ctrl+Shift+A and speak - release to transcribe',
      'Or press Ctrl+Shift+T to toggle continuous recording',
      'Transcribed text appears in your active text field',
      'Works best in a quiet environment with a good microphone',
    ],
  },
  {
    icon: FileText,
    title: 'Notes',
    items: [
      'Create notes from the Notes page (+ button)',
      'Notes are stored locally on your computer',
      'Search notes using the search bar',
      'Notes sync between desktop and web when sync is enabled',
    ],
  },
  {
    icon: Globe,
    title: 'Remote Access (Tailscale)',
    items: [
      'Install Tailscale on your phone or work computer',
      'Log in with the same account as your home PC',
      'Open Chrome and go to http://100.120.124.15:5173',
      'Your home PC must be running Orion Notes for this to work',
      'All traffic is encrypted end-to-end, no public exposure',
    ],
  },
];

export default function Help() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-orion-text flex items-center gap-2">
            <Info size={22} />
            How to Use Orion Notes
          </h2>
          <p className="text-sm text-orion-text-secondary mt-2">
            Your personal text-to-speech and speech-to-text assistant.
          </p>
        </div>

        {/* Keyboard shortcuts */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-orion-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Keyboard size={16} />
            Keyboard Shortcuts
          </h3>
          <div className="rounded-xl border border-orion-border-subtle overflow-hidden">
            {shortcuts.map((s, i) => (
              <div
                key={s.keys}
                className={`flex items-start gap-4 px-4 py-3 ${i > 0 ? 'border-t border-orion-border-subtle' : ''}`}
              >
                <kbd className="shrink-0 px-2.5 py-1 rounded-lg bg-orion-surface-2 border border-orion-border-subtle text-xs font-mono text-orion-text whitespace-nowrap">
                  {s.keys}
                </kbd>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-orion-text">{s.action}</div>
                  <div className="text-xs text-orion-text-tertiary">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature sections */}
        {sections.map(({ icon: Icon, title, items }) => (
          <div key={title} className="space-y-3">
            <h3 className="text-sm font-semibold text-orion-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Icon size={16} />
              {title}
            </h3>
            <ul className="space-y-2 pl-1">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-orion-text-secondary">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-orion-surface-2 border border-orion-border-subtle flex items-center justify-center text-[10px] font-bold text-orion-text-tertiary mt-0.5">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="text-xs text-orion-text-tertiary border-t border-orion-border-subtle pt-4">
          Orion Notes v2.0.0
        </div>
      </div>
    </div>
  );
}
