import { Mic, RefreshCw, Check, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

type SyncStatus = 'synced' | 'syncing' | 'offline';

interface HeaderProps {
  syncStatus: SyncStatus;
  onSync: () => void;
}

export default function Header({ syncStatus, onSync }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 glass-strong safe-top">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-orion bg-gradient-orion flex items-center justify-center shadow-orion-glow">
            <Mic size={16} className="text-white" />
          </div>
          <h1 className="text-base font-semibold text-orion-text hidden sm:block">
            Orion Voice
          </h1>
        </div>

        {/* Sync indicator */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onSync}
          className="flex items-center gap-2 px-3 py-1.5 rounded-orion text-xs font-medium transition-colors hover:bg-orion-surface-2"
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
      </div>
    </header>
  );
}
