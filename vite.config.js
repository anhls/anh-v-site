import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { visible } from './tools/lib/visible-data.mjs';

// R46 Part B: projects with "hidden": true in src/data/data.json are left out of the data the site imports and get no build page (/work/<slug> then answers 404).
const rawData = JSON.parse(fs.readFileSync(resolve(__dirname, 'src/data/data.json'), 'utf8'));
const data = visible(rawData);
const hiddenData = () => ({
  name: 'r46-hidden-projects',
  enforce: 'pre',
  transform(code, id) { if (id.split('?')[0].endsWith('/src/data/data.json')) return { code: JSON.stringify(visible(JSON.parse(code))), map: null }; return null; },
});

// One HTML entry per page: the homepage, the Work page, the 404, and one project page per VISIBLE project (work/<slug>.html).
const projectPages = Object.fromEntries(data.projects.map((p) => [p.slug, resolve(__dirname, `work/${p.slug}.html`)]));

// R46 Part D: sitemap.xml is generated from the visible projects with the clean URLs (/work/<slug>); the canonical host is www.anh-v.com
const sitemap = () => ({
  name: 'r46-sitemap',
  generateBundle() {
    const loc = (p) => `  <url><loc>https://www.anh-v.com${p}</loc></url>`;
    const urls = [loc('/'), loc('/work/'), ...data.projects.map((p) => loc(`/work/${p.slug}`))];
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join(String.fromCharCode(10))}
</urlset>
` });
  },
});

export default defineConfig({
  plugins: [hiddenData(), sitemap()],
  appType: 'mpa', // /work/<slug> -> work/<slug>.html (as Cloudflare Pages does), an unknown path -> 404.html with a 404 status
  // Each mode can use its own strict port; desktop remains the default.
  server: { port: Number(process.env.PORT || 5199), strictPort: true },
  build: {
    target: 'es2022', // top-level await in work.js (R22j)
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...projectPages,
        work: resolve(__dirname, 'work/index.html'), // the Works page
        notfound: resolve(__dirname, '404.html'), // R22j: the 404 page (static hosts serve /404.html for unknown paths)
      },
    },
  },
});
