/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        canvas: '#F4F6FA',
        line: { DEFAULT: '#E2E8F0', soft: '#F1F5F9' },
        ink: { DEFAULT: '#0F172A', soft: '#334155', muted: '#64748B' },
        brand: { DEFAULT: '#0369A1', dark: '#075985', soft: '#E0F2FE' },
        success: { DEFAULT: '#059669', soft: '#ECFDF5', ring: '#A7F3D0', ink: '#065F46' },
        danger: { DEFAULT: '#DC2626', soft: '#FEE2E2', ink: '#991B1B' },
        warning: { DEFAULT: '#D97706', soft: '#FEF3C7', ink: '#92400E' },
        violet: { DEFAULT: '#7C3AED', soft: '#F3E8FF', ink: '#6B21A8' },
        slate: { column: '#EAEFF5' },
      },
      borderRadius: {
        card: '14px',
        hero: '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.04)',
        item: '0 1px 2px rgba(15,23,42,.05)',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in .22s ease-out',
        'fade-in': 'fade-in .18s ease-out',
      },
    },
  },
  plugins: [],
}
