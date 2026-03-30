/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#080d1a', // Page background
          850: '#0e1628', // Cards
          800: '#1e2d45', // Borders / UI elements
          700: '#1a2332',
          600: '#202938',
        },
        neon: {
          cyan: '#06b6d4',
          amber: '#f97316',
          red: '#ef4444',
          green: '#22c55e',
        },
        shield: {
          benign: '#22c55e',
          suspicious: '#eab308',
          medium: '#f97316',
          high: '#ef4444',
          critical: '#991b1b',
          confirmed: '#991b1b',
        },
      },
      backgroundImage: {
        'gradient-to-neon': 'linear-gradient(to right, #00d9ff, #ffa500, #ff4444)',
      },
    },
  },
  plugins: [],
}
