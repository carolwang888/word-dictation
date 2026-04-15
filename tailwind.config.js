/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          50: '#fff5f5',
          100: '#ffe3e3',
          200: '#ffc9c9',
          300: '#ffa8a8',
          400: '#ff8787',
          500: '#ff6b6b',
          600: '#fa5252',
          700: '#f03e3e',
        },
        sakura: {
          50: '#fff0f3',
          100: '#ffecf0',
          200: '#fce4ec',
          300: '#f8bbd9',
        }
      },
      fontFamily: {
        handwritten: ['Caveat', 'cursive'],
        chinese: ['Noto Sans SC', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
