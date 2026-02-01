import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import TitleBar from './TitleBar';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-orion-bg overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-orion-bg border-r border-orion-border-subtle flex flex-col">
          {/* Brand area */}
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-orion bg-gradient-orion flex items-center justify-center shadow-orion-glow">
                <Mic size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-orion-text leading-tight">
                  Orion Notes
                </h1>
                <p className="text-[11px] text-orion-text-tertiary">v2.0.0</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 space-y-0.5">
            {navItems.map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname === to;
              return (
                <NavLink key={to} to={to} className="block relative">
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-orion-surface-2 border border-orion-border-subtle"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <div
                    className={clsx(
                      'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'text-orion-text'
                        : 'text-orion-text-tertiary hover:text-orion-text-secondary'
                    )}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                    <span>{label}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          {/* Status footer */}
          <div className="p-4 border-t border-orion-border-subtle">
            <div className="flex items-center gap-2 text-xs">
              <span className="glow-dot bg-orion-success text-orion-success" />
              <span className="text-orion-text-tertiary">Backend connected</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="p-6 h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
