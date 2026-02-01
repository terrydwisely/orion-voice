import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FileText, Volume2, HelpCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import Header from './components/Header';
import MobileNav from './components/MobileNav';
import Notes from './pages/Notes';
import TTS from './pages/TTS';
import Help from './pages/Help';
import { getAuthToken, setAuthToken } from './hooks/useApi';

type SyncStatus = 'synced' | 'syncing' | 'offline';

const sidebarItems = [
  { to: '/', icon: FileText, label: 'Notes' },
  { to: '/tts', icon: Volume2, label: 'TTS' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
];

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (res.ok) {
        setAuthToken(token.trim());
        onLogin();
      } else {
        setError('Invalid token');
      }
    } catch {
      setError('Cannot reach server');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-orion-bg p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-orion-primary/15 flex items-center justify-center mx-auto mb-3">
            <Lock size={22} className="text-orion-primary" />
          </div>
          <h1 className="text-xl font-semibold text-orion-text">Orion Notes</h1>
          <p className="text-sm text-orion-text-tertiary mt-1">Enter your access token</p>
        </div>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Access token"
          className="orion-input w-full"
          autoFocus
        />
        {error && <p className="text-sm text-orion-danger text-center">{error}</p>}
        <button
          type="submit"
          disabled={checking || !token.trim()}
          className="orion-btn-primary w-full py-2.5"
        >
          {checking ? 'Verifying...' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    async function checkAuth() {
      const token = getAuthToken();
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setAuthenticated(!data.auth_required || !!token);
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(true);
      }
    }
    checkAuth();
  }, []);

  const handleSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      setSyncStatus(res.ok ? 'synced' : 'offline');
    } catch {
      setSyncStatus('offline');
    }
  }, []);

  if (authenticated === null) {
    return <div className="h-full flex items-center justify-center bg-orion-bg text-orion-text-tertiary text-sm">Loading...</div>;
  }

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

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
              <Route path="/help" element={<Help />} />
            </Routes>
          </motion.div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
