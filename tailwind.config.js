/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nx-dark-blue': '#12354c',
        'nx-blue': '#0075c1',
        'nx-light-blue': '#4198d0',
        'nx-green': '#10bd59',
        'nx-green-dark': '#0c8e43',
        'nx-yellow': '#ffc107',
        'nx-gray': '#4d6879',
        'nx-gray-light': '#e2e2e2',
        'nx-bg': '#f2f2f2',
      },
      fontFamily: {
        sans: ['"Open Sans"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
