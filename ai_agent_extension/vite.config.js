import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html')
      },
      external: ['chrome', 'browser']
    },
    minify: false,
    sourcemap: true
  },
  publicDir: false, // We'll handle assets manually
  define: {
    global: 'globalThis'
  }
});
