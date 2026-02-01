import { NavLink, useLocation } from 'react-router-dom';
import { FileText, Volume2, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const items = [
  { to: '/', icon: FileText, label: 'Notes' },
  { to: '/tts', icon: Volume2, label: 'TTS' },
  { to: '/help', icon: HelpCircle, label: 'Help' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-strong safe-bottom">
      <div className="flex items-center justify-around h-14">
        {items.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink key={to} to={to} className="relative flex flex-col items-center gap-0.5 px-6 py-1">
              {active && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute -top-0.5 w-8 h-1 rounded-full bg-orion-primary"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.5}
                className={clsx(
                  'transition-colors',
                  active ? 'text-orion-text' : 'text-orion-text-tertiary'
                )}
              />
              <span
                className={clsx(
                  'text-[10px] font-medium transition-colors',
                  active ? 'text-orion-text' : 'text-orion-text-tertiary'
                )}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
