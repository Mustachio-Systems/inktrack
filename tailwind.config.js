/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          black: "#0F0F0F",
          dark: "#1A1A1A",
          red: "#D62828",
          gold: "#C89B3C",
        }
      },
    },
  },
  plugins: [],
}