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
        // Brand: a refined forest-green ramp for chrome, accents and CTAs.
        garden: {
          50: '#f0f8f1',
          100: '#dcefde',
          200: '#bbe0c0',
          300: '#8fca98',
          400: '#5cae6b',
          500: '#389150',
          600: '#287a41',
          700: '#206035',
          800: '#1c4d2d',
          900: '#163d25',
          // Named surface/ink tokens for the "garden journal" look.
          soil: '#f3f4f6',
          sprout: '#dcfce7',
          leaf: '#86efac',
          growth: '#16a34a',
          lush: '#14532d',
          paper: '#f8f9f5',
          canvas: '#eef1ea',
        },
        // Warm hairline border that reads softer than cool grays.
        line: '#e7e5df',
      },
      boxShadow: {
        // A two-part shadow: a crisp contact edge plus a soft ambient lift.
        card: '0 1px 2px rgba(20, 32, 20, 0.04), 0 10px 28px -16px rgba(20, 32, 20, 0.14)',
        'card-hover': '0 2px 4px rgba(20, 32, 20, 0.05), 0 18px 40px -18px rgba(20, 32, 20, 0.22)',
        hero: '0 1px 2px rgba(20, 32, 20, 0.04), 0 22px 60px -28px rgba(20, 32, 20, 0.28)',
        pill: '0 1px 2px rgba(20, 32, 20, 0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'grow-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        sprout: {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.7)' },
          '60%': { opacity: '1', transform: 'translateY(-1px) scale(1.06)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-2.5deg)' },
          '50%': { transform: 'rotate(2.5deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'grow-in': 'grow-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        sprout: 'sprout 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        sway: 'sway 3.5s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
}
