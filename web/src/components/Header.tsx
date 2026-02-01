import { Mic, RefreshCw, Check, WifiOff, Minus, Square, X, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type SyncStatus = 'synced' | 'syncing' | 'offline';

interface HeaderProps {
  syncStatus: SyncStatus;
  onSync: () => void;
}

const isElectron = typeof window !== 'undefined' && !!(window as any).require;

function useIsMaximized() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!isElectron) return;
    const ipc = (window as any).require('electron').ipcRenderer;
    const check = async () => setMaximized(await ipc.invoke('window-is-maximized'));
    check();
    const onResize = () => check();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return maximized;
}

function WindowControls() {
  if (!isElectron) return null;
  const ipc = (window as any).require('electron').ipcRenderer;
  const maximized = useIsMaximized();

  return (
    <div className="flex items-center gap-0 ml-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <button
        onClick={() => ipc.send('window-minimize')}
        className="w-11 h-8 flex items-center justify-center text-orion-text-tertiary hover:bg-white/10 hover:text-orion-text transition-colors"
        title="Minimize"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={() => ipc.send('window-maximize')}
        className="w-11 h-8 flex items-center justify-center text-orion-text-tertiary hover:bg-white/10 hover:text-orion-text transition-colors"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
      </button>
      <button
        onClick={() => ipc.send('window-close')}
        className="w-11 h-8 flex items-center justify-center text-orion-text-tertiary hover:bg-red-500 hover:text-white transition-colors"
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Header({ syncStatus, onSync }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 glass-strong safe-top select-none"
      style={{ WebkitAppRegion: isElectron ? 'drag' : undefined } as any}
    >
      <div className="flex items-center justify-between px-4 py-2 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-orion bg-gradient-orion flex items-center justify-center shadow-orion-glow">
            <Mic size={16} className="text-white" />
          </div>
          <h1 className="text-base font-semibold text-orion-text hidden sm:block">
            Orion Notes
          </h1>
        </div>

        <div className="flex items-center">
          {/* Sync indicator */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onSync}
            className="flex items-center gap-2 px-3 py-1.5 rounded-orion text-xs font-medium transition-colors hover:bg-orion-surface-2"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {syncStatus === 'synced' && (
              <>
                <span className="glow-dot bg-orion-success text-orion-success" />
                <span className="text-orion-text-tertiary hidden sm:inline">Synced</span>
                <Check size={14} className="text-orion-success sm:hidden" />
              </>
            )}
            {syncStatus === 'syncing' && (
              <>
                <RefreshCw size={14} className="text-orion-warning animate-spin" />
                <span className="text-orion-text-tertiary hidden sm:inline">Syncing...</span>
              </>
            )}
            {syncStatus === 'offline' && (
              <>
                <WifiOff size={14} className="text-orion-danger" />
                <span className="text-orion-text-tertiary hidden sm:inline">Offline</span>
              </>
            )}
          </motion.button>

          <WindowControls />
        </div>
      </div>
    </header>
  );
}
