/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        figmagreen: {
          50: '#E8F5E9',
          100: '#E6F4EA',
          500: '#00A854',
          600: '#00A34D',
          700: '#00873D',
        },
        figmaorange: {
          bg: '#FFF2E8',
          border: '#FFBB96',
          text: '#D4380D',
        },
      },
    },
  },
  plugins: [],
};
