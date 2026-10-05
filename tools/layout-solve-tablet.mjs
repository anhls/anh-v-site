// R24b / R24e: the stored layouts of the LANDSCAPE TABLET Work page (aspect classes 3:2 and 4:3, work/layout-store.js TABLET_SIZES). Since R24e the tablet strip shows the project
// images only (TABLET.cards = 0): there is nothing to place, so each size keeps one entry per project holding the hash of today's frame metrics (work/tall.js tabletMetrics) and no
// card; the build gate (tools/layout-check-tablet.mjs) then fails on a stale file or a missing project. `npm run layout:tablet`, `-- --sizes 1024x768`.
// Cards on the tablet (TABLET.cards > 0) need their own solve (the R29 method) and are not supported here yet: the Work page falls back to its load-time pass in that case.
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const T = await import('../src/timeline.js'); const LS = await import('../src/work/layout-store.js'); const TL = await import('../src/work/tall.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const sizeList = (arg('--sizes', null) || Object.values(LS.TABLET_SIZES).flat().map(([w, h]) => `${w}x${h}`).join(',')).split(',').map((s) => s.split('x').map(Number));
const OUT = arg('--out', 'src/data/layouts-tablet.json');
if (T.TABLET.cards > 0) { console.error('TABLET.cards > 0: the tablet solver does not place cards yet (see the header of this file)'); process.exit(1); }
const slugs = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')).projects.map((p) => p.slug);
const result = { v: 2, signature: TL.tabletSignature(), cards: 0, work: {}, dark: {} };
const sortKeys = (o) => (Array.isArray(o) || o === null || typeof o !== 'object' ? o : Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])));
for (const [W, H] of sizeList) {
  const M = TL.tabletMetrics(W, H).side, entry = {};
  slugs.forEach((slug) => { entry[slug] = { hash: LS.projectHash([], M), cards: {} }; });
  result.work[LS.sizeKey(W, H)] = { side: entry };
  console.log(`${LS.sizeKey(W, H)}: no cards (frame ${Math.round(M.alongF)} x ${Math.round(M.crossF)} px, ratio ${(M.alongF / M.crossF).toFixed(4)})`);
}
slugs.forEach((slug) => { result.dark[slug] = {}; });
fs.writeFileSync(OUT, JSON.stringify(sortKeys(result)) + '\n');
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} kB): images only`);
