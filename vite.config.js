import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// One HTML entry per page. Add more project pages here as they are built.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bitis09: resolve(__dirname, 'work/bitis09.html'),
      },
    },
  },
});
