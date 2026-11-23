/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mango: {
          blue: {
            DEFAULT: '#007dfc',
            dark: '#005fca',
            light: '#e8f2fe',
            mid: '#4a9ff8',
            surface: '#f0f7ff',
          },
          navy: {
            DEFAULT: '#0d1b2a',
            mid: '#0f2233',
            dark: '#080e18',
            card: '#0c1524',
            border: '#1c2838',
          },
          orange: {
            DEFAULT: '#f97316',
            amber: '#f59e0b',
            light: '#ffedd5',
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
