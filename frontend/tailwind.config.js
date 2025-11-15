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
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
