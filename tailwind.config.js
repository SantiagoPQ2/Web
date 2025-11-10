/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // 👈 esto activa el dark mode global
  theme: {
    extend: {
      colors: {
        vafoodRed: '#991b1b', // color principal de tu app
      },
    },
  },
  plugins: [],
};
