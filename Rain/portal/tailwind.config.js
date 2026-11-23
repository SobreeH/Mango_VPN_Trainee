/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mango: {
          yellow: {
            DEFAULT: '#f59e0b',
            hover: '#d97706',
            light: '#fef08a',
            pill: '#7a4918',
          },
          green: {
            DEFAULT: '#10b981',
            dark: '#064e3b',
            badge: '#162a1e',
            mint: '#bbf7d0',
          },
          dark: {
            bg: '#141311',
            card: '#1e1d1a',
            input: '#262420',
            border: '#2e2c27',
          },
          light: {
            bg: '#fcfbf7',
            card: '#ffffff',
            input: '#ffffff',
            border: '#e7e5e0',
          },
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Sarabun', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
