/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette nano conservée pour compatibilité ascendante
        nano: {
          50: '#f0f4f8', 100: '#d9e2ec', 200: '#bcccdc', 300: '#9fb3c8',
          400: '#829ab1', 500: '#627d98', 600: '#486581', 700: '#334e68',
          800: '#243b53', 900: '#102a43',
        },
        // Palette BigOne — stone chaude (remplace gray-*)
        stone: {
          50:  '#FAFAF8',
          100: '#F5F4F1',
          200: '#EEECEA',
          300: '#E8E6E0',
          400: '#D5D2CA',
          500: '#B4B2A9',
          600: '#888780',
          700: '#5F5E5A',
          800: '#3D3C3A',
          900: '#1A1A18',
        },
        // Brand purple BigOne
        brand: {
          50:  '#EEECFC',
          100: '#DDD9F8',
          200: '#C4BDF2',
          300: '#A99DE8',
          400: '#8A7FDC',
          500: '#6B52C8',
          600: '#5A43B0',
          700: '#493597',
          800: '#38287E',
          900: '#271C5C',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', '"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
      },
      borderRadius: {
        lg:  '10px',
        xl:  '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
