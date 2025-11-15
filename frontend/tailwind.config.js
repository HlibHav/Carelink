/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          50: '#f2f6ff',
          100: '#e1e9ff',
          200: '#c6cffc',
          300: '#a0b1ff',
          400: '#7483ff',
          500: '#4a52ff',
          600: '#3a3de5',
          700: '#2c2fc0',
          800: '#202393',
          900: '#151950',
        },
        blush: '#f87272',
        sand: '#f8f4ee',
        forest: '#0f8c79',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', '"Source Sans 3"', 'serif'],
      },
      keyframes: {
        orbPulse: {
          '0%, 100%': { transform: 'scale(0.92)', boxShadow: '0 0 40px rgba(255,255,255,0.25)' },
          '50%': { transform: 'scale(1.04)', boxShadow: '0 0 60px rgba(255,255,255,0.45)' },
        },
        orbSpeak: {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.12)', filter: 'brightness(1.2)' },
        },
        aurora: {
          '0%, 100%': {
            transform: 'translate3d(0,0,0) scale(1)',
            opacity: 0.8,
          },
          '50%': {
            transform: 'translate3d(-5%, -5%, 0) scale(1.05)',
            opacity: 1,
          },
        },
      },
      animation: {
        orbPulse: 'orbPulse 2.8s ease-in-out infinite',
        orbSpeak: 'orbSpeak 1.6s ease-in-out infinite',
        aurora: 'aurora 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
