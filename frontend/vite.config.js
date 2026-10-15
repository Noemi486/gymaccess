import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend nunca habla con MySQL: todo pasa por la API REST del backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    // face-api (con TensorFlow) pesa ~1,3 MB y se carga de forma diferida solo en las pantallas de cámara.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
