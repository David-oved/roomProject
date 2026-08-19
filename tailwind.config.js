/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Assistant', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // לספרות בכרטיס היתרה — מראה "מסמך פיננסי" ולא רק טקסט מודגש
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 4px 16px -4px rgba(15,23,42,.08)',
        lifted: '0 2px 4px rgba(15,23,42,.06), 0 12px 28px -8px rgba(15,23,42,.16)',
        fab: '0 4px 14px -2px rgba(13,148,136,.45)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'glass-in': {
          from: { transform: 'scale(.94) translateY(8px)', opacity: '0' },
          to: { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'check-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'slide-up': 'slide-up .28s cubic-bezier(.22,1,.36,1)',
        'fade-in': 'fade-in .18s ease-out',
        'sheet-in': 'sheet-in .3s cubic-bezier(.22,1,.36,1)',
        'glass-in': 'glass-in .32s cubic-bezier(.22,1,.36,1)',
        'check-pop': 'check-pop .45s cubic-bezier(.34,1.56,.64,1)',
      },
    },
  },
  plugins: [],
};
