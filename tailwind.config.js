/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts,jsx,js}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      colors: {
        void: '#01010a',
        deep: '#030310',
        panel: '#06060f',
        card: '#0a0a18',
        border: 'rgba(255,255,255,0.05)',
        t1: '#f1f5f9',
        t2: '#94a3b8',
        t3: '#475569',
        t4: '#1e293b',
        pb: '#a855f7',
        accent: {
          cyan: '#22d3ee',
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          blue: '#3b82f6',
          pink: '#ec4899',
          purple: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
}
