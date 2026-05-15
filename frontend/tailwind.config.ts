import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './stores/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Geist', 'Manrope', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        ink: '#05070d',
        panel: '#0b1020',
        graphite: '#111827',

      },
      boxShadow: {
        glow: '0 0 60px rgba(0, 172, 105, 0.18)',
        premium: '0 24px 80px rgba(0,0,0,0.45)'
      },
      backgroundImage: {
        'radial-emerald': 'radial-gradient(circle at 20% 20%, rgba(0,172,105,0.22), transparent 28rem)',
        'radial-lime': 'radial-gradient(circle at 80% 0%, rgba(132,204,22,0.12), transparent 26rem)',
        'noise-grid': 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)'
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } }
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 7s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

export default config;
