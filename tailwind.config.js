/** @type {import('tailwindcss').Config} */
export default {
  // ✅ Rutas de archivos donde Tailwind buscará clases
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  // ✅ Habilita el modo oscuro controlado por clase "dark"
  //    (se activa cuando agregás "dark" al <html> o <body>)
  darkMode: 'class',

  theme: {
    extend: {
      // 🔹 Acá podés agregar tus colores o fuentes personalizadas si querés
      colors: {
        vafoodRed: '#991b1b', // color principal de tu app
      },
    },
  },

  plugins: [],
};
