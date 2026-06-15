module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        garden: {
          soil: '#f3f4f6',
          sprout: '#dcfce7',
          leaf: '#86efac',
          growth: '#16a34a',
          lush: '#14532d',
        }
      }
    },
  },
  plugins: [],
}
