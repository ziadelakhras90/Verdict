/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        ink:    { DEFAULT: '#0D0C0A', 50: '#F5F3EE', 100: '#EAE6DC', 200: '#D4CCBA', 300: '#B8AC94', 400: '#8E8270', 500: '#6B6055', 600: '#4D453C', 700: '#352E28', 800: '#1E1915', 900: '#0D0C0A' },
        gold:   { DEFAULT: '#C9A84C', 50: '#FDF8EC', 100: '#F9EDC9', 200: '#F2D98B', 300: '#E8C05A', 400: '#C9A84C', 500: '#A8883A', 600: '#856A2C', 700: '#624E1F', 800: '#403313', 900: '#201907' },
        parch:  { DEFAULT: '#F0E6CC', 50: '#FDFAF4', 100: '#F8F0DC', 200: '#F0E6CC', 300: '#E4D3AA', 400: '#D4BB82', 500: '#C0A05A' },
        blood:  { DEFAULT: '#8B1A1A', 50: '#FDF2F2', 100: '#FBDADA', 200: '#F5AAAA', 300: '#ED7272', 400: '#D94444', 500: '#B82222', 600: '#8B1A1A', 700: '#651313', 800: '#400D0D', 900: '#1E0606' },
        judge:  { DEFAULT: '#2D1B69', 50: '#F5F0FF', 100: '#EBE0FF', 200: '#D1BFFF', 300: '#A98BFF', 400: '#7C52FF', 500: '#5526FF', 600: '#3D0FE0', 700: '#2D1B69', 800: '#1C1044', 900: '#0D0822' },
      },
      animation: {
        'gavel':        'gavel 0.4s ease-out',
        'card-reveal':  'cardReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up':      'fadeUp 0.5s ease-out',
        'shimmer':      'shimmer 2s infinite',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker':      'flicker 4s infinite',
      },
      keyframes: {
        gavel:      { '0%': { transform: 'rotate(-30deg) translateY(-10px)' }, '60%': { transform: 'rotate(10deg) translateY(4px)' }, '100%': { transform: 'rotate(0deg) translateY(0)' } },
        cardReveal: { '0%': { opacity: '0', transform: 'rotateY(90deg) scale(0.8)' }, '100%': { opacity: '1', transform: 'rotateY(0deg) scale(1)' } },
        fadeUp:     { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer:    { '0%': { backgroundPosition: '-200% center' }, '100%': { backgroundPosition: '200% center' } },
        flicker:    { '0%, 100%': { opacity: '1' }, '92%': { opacity: '1' }, '93%': { opacity: '0.8' }, '94%': { opacity: '1' }, '96%': { opacity: '0.9' }, '97%': { opacity: '1' } },
      },
      backgroundImage: {
        'noise':       "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E\")",
        'parchment':   'radial-gradient(ellipse at 20% 20%, #F5EDD6 0%, #E8D5A8 40%, #D4BC82 100%)',
        'courtroom':   'radial-gradient(ellipse at 50% 0%, #1E1510 0%, #0D0C0A 60%)',
      },
    },
  },
  plugins: [],
}
