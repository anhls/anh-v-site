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
// Old curated cards with no matching project image keep their selected-work/card-img-* file and join the pool as extras (R22b).
// Project slug where it is clear from the picture, null = no click target (hover only).
const EXTRA_SLUGS = { 'selected-work/card-img-01': 'bitis09', 'selected-work/card-img-07': 'bitis09', 'selected-work/card-img-12': 'tcb-priority', 'selected-work/card-img-13': 'tcb-priority', 'selected-work/card-img-14': 'tcb-priority', 'selected-work/card-img-27': 'tcb-priority', 'selected-work/card-img-28': 'tcb-priority' };

// FNV-1a, 32 bit: stable per key, so a card's look never depends on the other images.
const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };

export async function buildPool() {
  const data = JSON.parse(readFileSync(resolve(ROOT, 'src/data/data.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'src/data/media-manifest.json'), 'utf8'));
  const selected = new Set(JSON.parse(readFileSync(resolve(ROOT, 'src/data/selected.json'), 'utf8')));
  const pool = [];
  const lumOf = async (key) => {
    const files = [...manifest[key].files].sort((a, b) => a.width - b.width);
    const { channels } = await sharp(resolve(ROOT, 'public/media', files[0].file)).resize(32, 32, { fit: 'inside' }).flatten({ background: '#000' }).greyscale().stats();
    return Math.round(channels[0].mean);
  };
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
      pool.push({ slug: p.slug, key: s, hash: hash(s), w: width, h: height, lum: await lumOf(s), selected: selected.has(s) });
    }
  }
  for (const key of selected) {
    if (!key.startsWith('selected-work/') || !manifest[key] || manifest[key].type !== 'image') continue;
    pool.push({ slug: EXTRA_SLUGS[key] || null, key, hash: hash(key), w: manifest[key].source.width, h: manifest[key].source.height, lum: await lumOf(key), selected: true, extra: true });
  }
  for (const k of selected) if (!pool.some((e) => e.key === k)) console.warn('selected.json: not in the pool:', k);
  pool.sort((a, b) => (a.key < b.key ? -1 : 1));
  writeFileSync(resolve(ROOT, 'src/data/work-pool.json'), JSON.stringify(pool, null, 1) + '\n');
  const per = {};
  for (const e of pool) per[e.slug] = (per[e.slug] || 0) + 1;
  console.log(`work pool: ${pool.length} stills, ${pool.filter((e) => e.selected).length} featured`, per);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPool();
