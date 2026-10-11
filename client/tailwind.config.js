/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cloth: { DEFAULT: '#1B2547', deep: '#121A33', soft: '#27335E' },
        ivory: { DEFAULT: '#F1E8D2', dim: '#C9BFA3' },
        marigold: '#F2A623'
      },
      fontFamily: {
        display: ['"Yatra One"', 'Georgia', 'serif'],
        sans: ['Hind', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
