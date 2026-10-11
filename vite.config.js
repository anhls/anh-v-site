import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// One HTML entry per page. Add more project pages here as they are built.
export default defineConfig({
  // Each mode can use its own strict port; desktop remains the default.
  server: { port: Number(process.env.PORT || 5199), strictPort: true },
  build: {
    target: 'es2022', // top-level await in work.js (R22j)
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bitis09: resolve(__dirname, 'work/bitis09.html'),
        similac: resolve(__dirname, 'work/similac.html'),
        duhat: resolve(__dirname, 'work/duhat.html'),
        'nam-long': resolve(__dirname, 'work/nam-long.html'),
        forbes: resolve(__dirname, 'work/forbes.html'),
        sulwhasoo: resolve(__dirname, 'work/sulwhasoo.html'),
        'tcb-priority': resolve(__dirname, 'work/tcb-priority.html'),
        work: resolve(__dirname, 'work/index.html'), // placeholder Works page
        notfound: resolve(__dirname, '404.html'), // R22j: the 404 page (static hosts serve /404.html for unknown paths)
      },
    },
  },
});
