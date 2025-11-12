/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "12px" },
    extend: {
      screens: {
        xs: "360px",     // móvil chico
      },
      maxWidth: {
        'content': '1120px',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [
    require("@tailwindcss/line-clamp"),
    // Si usas formularios nativos:
    // require("@tailwindcss/forms"),
  ],
}
