/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        orion: {
          bg: '#0f0f13',
          'bg-soft': '#141419',
          surface: '#1a1a24',
          'surface-2': '#24243a',
          'surface-3': '#2a2a40',
          border: '#2e2e48',
          'border-subtle': '#23233a',
          primary: '#6366f1',
          'primary-hover': '#7577f5',
          'primary-muted': '#4f46e5',
          accent: '#818cf8',
          'accent-2': '#a78bfa',
          text: '#f0f0f4',
          'text-secondary': '#a0a0b8',
          'text-tertiary': '#6b6b80',
          success: '#34d399',
          warning: '#fbbf24',
          danger: '#f87171',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        orion: '10px',
        'orion-lg': '14px',
      },
      boxShadow: {
        'orion-sm': '0 2px 8px rgba(0, 0, 0, 0.3)',
        orion: '0 4px 24px rgba(0, 0, 0, 0.4)',
        'orion-glow': '0 0 20px rgba(99, 102, 241, 0.15)',
        'orion-glow-strong': '0 0 30px rgba(99, 102, 241, 0.25)',
      },
      backgroundImage: {
        'gradient-orion':
          'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)',
        'gradient-surface':
          'linear-gradient(180deg, rgba(36, 36, 58, 0.5) 0%, rgba(26, 26, 36, 0.5) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};
