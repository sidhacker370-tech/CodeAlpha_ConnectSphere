/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(8, 8, 10)',
        foreground: 'rgb(243, 244, 246)',
        border: 'rgb(31, 41, 55)',
        input: 'rgb(31, 41, 55)',
        ring: 'rgb(99, 102, 241)',
        brand: {
          dark: 'rgb(8, 8, 10)',
          indigo: 'rgb(99, 102, 241)',
          purple: 'rgb(139, 92, 246)',
          accent: 'rgb(168, 85, 247)'
        }
      },
    },
  },
  plugins: [],
}
