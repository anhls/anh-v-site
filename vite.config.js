import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// One HTML entry per page. Add more project pages here as they are built.
export default defineConfig({
  // Fixed port: tools/compare.mjs measures http://localhost:5199/, so an old server elsewhere can't be measured by mistake.
  server: { port: 5199, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bitis09: resolve(__dirname, 'work/bitis09.html'),
        similac: resolve(__dirname, 'work/similac.html'),
        forbes: resolve(__dirname, 'work/forbes.html'),
        sulwhasoo: resolve(__dirname, 'work/sulwhasoo.html'),
        'tcb-priority': resolve(__dirname, 'work/tcb-priority.html'),
        work: resolve(__dirname, 'work/index.html'), // placeholder Works page
      },
    },
  },
});
