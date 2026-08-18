/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ECFDFF',
          100: '#CFFAFE',
          200: '#A5F0F7',
          300: '#6FE2EE',
          400: '#33CBDD',
          500: '#0FB5C9', // primary
          600: '#0C93A5',
          700: '#0D7482',
          800: '#125D68',
          900: '#144D57',
        },
        ink: '#0B1220',
        body: '#475569',
        meta: '#94A3B8',
        surface: '#FAFAFA',
        hairline: '#E2E8F0',
        ok: '#059669',
        warn: '#D97706',
        danger: '#DC2626',
        neutralstatus: '#64748B',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // 15px base, 1.6 line height
        base: ['0.9375rem', { lineHeight: '1.6' }],
        'display-lg': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'display-md': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
      },
      maxWidth: {
        // Tailwind stops at 7xl (80rem). 8xl fills a 1440 viewport with room
        // for the page gutters either side.
        '8xl': '88rem',
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 24px -12px rgba(11, 18, 32, 0.10)',
        lift: '0 2px 4px rgba(11, 18, 32, 0.05), 0 16px 32px -16px rgba(11, 18, 32, 0.16)',
        panel: '-12px 0 40px -20px rgba(11, 18, 32, 0.28)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.86)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Draws the eye to a row that has just arrived, then gets out of the
        // way. Three passes, not an endless blink: a permanently flashing row
        // stops being a signal and becomes noise.
        'arrive-flash': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '30%': { backgroundColor: 'rgb(236 253 255)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'slide-up': 'slide-up 200ms ease-out both',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-bottom': 'slide-in-bottom 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'soft-pulse': 'soft-pulse 1.8s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'arrive-flash': 'arrive-flash 1.1s ease-in-out 3',
      },
    },
  },
  plugins: [],
};
