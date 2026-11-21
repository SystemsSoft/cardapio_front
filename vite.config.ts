import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o backend roda em http://localhost:3333 (python src/main.py).
// Em produção o próprio backend serve a pasta dist/ e tudo fica na mesma origem.
const API = process.env.API_URL || 'http://localhost:3333';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
