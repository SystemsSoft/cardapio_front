/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Cor da marca do restaurante (definida em tempo real via CSS: --marca = "r g b").
        marca: {
          DEFAULT: 'rgb(var(--marca) / <alpha-value>)',
          escura: 'rgb(var(--marca-escura) / <alpha-value>)',
          clara: 'rgb(var(--marca-clara) / <alpha-value>)',
        },
        fundo: '#f6f4f1',
      },
      boxShadow: {
        cartao: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px -4px rgb(0 0 0 / 0.08)',
        flutuante: '0 10px 40px -8px rgb(0 0 0 / 0.25)',
      },
      keyframes: {
        subir: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        surgir: { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        pulsar: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: {
        subir: 'subir .25s cubic-bezier(.2,.8,.2,1)',
        surgir: 'surgir .18s ease-out',
        pulsar: 'pulsar 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
