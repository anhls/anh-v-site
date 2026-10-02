// R22: the pool of project stills the Selected Work cards (and later the Work page) are generated from.
// Reads data.json (project pages) + media-manifest.json, writes src/data/work-pool.json. Only the sized WebPs the media
// pipeline already made are referenced. Eligible = still image, short side of the original >= MIN_SHORT px.
// Run alone: node tools/work-pool.mjs   (also runs at the end of npm run media)
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_SHORT = 600;

// FNV-1a, 32 bit: stable per key, so a card's look never depends on the other images.
const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };

export async function buildPool() {
  const data = JSON.parse(readFileSync(resolve(ROOT, 'src/data/data.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'src/data/media-manifest.json'), 'utf8'));
  const pool = [];
  const seen = new Set();
  for (const p of data.projects) {
    const strings = [];
    const walk = (o) => { if (typeof o === 'string') strings.push(o); else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    walk(p.page);
    for (const s of strings) {
      const m = manifest[s];
      if (!s.startsWith(`${p.slug}/`) || !m || m.type !== 'image' || seen.has(s)) continue;
      seen.add(s);
      const { width, height } = m.source;
      if (Math.min(width, height) < MIN_SHORT) continue;
      const files = [...m.files].sort((a, b) => a.width - b.width);
      const small = resolve(ROOT, 'public/media', files[0].file);
      const { channels } = await sharp(small).resize(32, 32, { fit: 'inside' }).flatten({ background: '#000' }).greyscale().stats();
      pool.push({ slug: p.slug, key: s, hash: hash(s), w: width, h: height, lum: Math.round(channels[0].mean) });
    }
  }
  pool.sort((a, b) => (a.key < b.key ? -1 : 1));
  writeFileSync(resolve(ROOT, 'src/data/work-pool.json'), JSON.stringify(pool, null, 1) + '\n');
  const per = {};
  for (const e of pool) per[e.slug] = (per[e.slug] || 0) + 1;
  console.log(`work pool: ${pool.length} stills`, per);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPool();
