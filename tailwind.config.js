/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Instrument Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        blue: { DEFAULT: '#2352ff', dark: '#1538d4', soft: '#e8ecff', mid: '#b8c4ff' },
        teal: { DEFAULT: '#00c48c', soft: '#e0faf2' },
        amber: { DEFAULT: '#f59e0b', soft: '#fef3c7' },
        ink: { DEFAULT: '#0b0f1e', 2: '#3a4068', 3: '#8b92b8' },
        paper: { DEFAULT: '#fff', 2: '#f5f6fc', 3: '#eef0f8' },
      },
    },
  },
  plugins: [],
}
