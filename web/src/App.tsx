import { useState, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FileText, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import Header from './components/Header';
import MobileNav from './components/MobileNav';
import Notes from './pages/Notes';
import TTS from './pages/TTS';

type SyncStatus = 'synced' | 'syncing' | 'offline';

const sidebarItems = [
  { to: '/', icon: FileText, label: 'Notes' },
  { to: '/tts', icon: Volume2, label: 'TTS' },
];

export default function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const location = useLocation();

  const handleSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      setSyncStatus(res.ok ? 'synced' : 'offline');
    } catch {
      setSyncStatus('offline');
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-orion-bg">
      <Header syncStatus={syncStatus} onSync={handleSync} />

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-52 shrink-0 border-r border-orion-border-subtle flex-col">
          <nav className="flex-1 p-3 space-y-0.5">
            {sidebarItems.map(({ to, icon: Icon, label }) => {
              const active = location.pathname === to;
              return (
                <NavLink key={to} to={to} className="block relative">
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-orion-surface-2 border border-orion-border-subtle"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <div
                    className={clsx(
                      'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active ? 'text-orion-text' : 'text-orion-text-tertiary hover:text-orion-text-secondary'
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                    <span>{label}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full"
          >
            <Routes>
              <Route path="/" element={<Notes />} />
              <Route path="/tts" element={<TTS />} />
            </Routes>
          </motion.div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
