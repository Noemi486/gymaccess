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
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
