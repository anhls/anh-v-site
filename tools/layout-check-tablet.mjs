// R24b / R24e: the BUILD GATE for the landscape tablet Work layouts (src/data/layouts-tablet.json, tools/layout-solve-tablet.mjs); runs after tools/layout-check.mjs.
// Since R24e the tablet strip has no cards (TABLET.cards = 0): every stored size must have one entry per project with the hash of today's frame metrics and no card, so a
// changed frame rule (TABLET.frameH, the desktop image ratio, the gap) or a missing project / size fails the build until `npm run layout:tablet` is run again.
import fs from 'node:fs';
import { installShims } from './lib/node-shims.mjs';
installShims();
const T = await import('../src/timeline.js'); const LS = await import('../src/work/layout-store.js'); const TL = await import('../src/work/tall.js');
const OUT = 'src/data/layouts-tablet.json', fail = [];
if (!fs.existsSync(OUT)) { console.error('layout:check (tablet): src/data/layouts-tablet.json is missing: run `npm run layout:tablet`'); process.exit(1); }
const L = JSON.parse(fs.readFileSync(OUT, 'utf8')), slugs = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')).projects.map((p) => p.slug);
if (T.TABLET.cards > 0) { console.log('layout:check (tablet): TABLET.cards > 0: no stored tablet layout is used (the Work page runs its load-time pass), nothing to check'); process.exit(0); }
if (L.signature !== TL.tabletSignature()) fail.push(`tablet signature changed (stored ${L.signature}, now ${TL.tabletSignature()}): run npm run layout:tablet`);
let checked = 0;
for (const [W, H] of Object.values(LS.TABLET_SIZES).flat()) {
  const key = LS.sizeKey(W, H), entry = L.work?.[key]?.side, M = TL.tabletMetrics(W, H).side;
  if (!entry) { fail.push(`tablet: no stored layout for ${key}`); continue; }
  for (const slug of slugs) { const e = entry[slug]; if (!e) fail.push(`tablet ${key}: project ${slug} has no entry`); else if (e.hash !== LS.projectHash([], M)) fail.push(`tablet ${key} ${slug}: out of date (the frame size / the rules changed)`); else if (Object.keys(e.cards).length) fail.push(`tablet ${key} ${slug}: stored cards but TABLET.cards is 0`); }
  checked++;
}
if (fail.length) { console.error(`layout:check (tablet): FAILED\n  ${fail.join('\n  ')}`); process.exit(1); }
console.log(`layout:check (tablet): ${checked} sizes OK (images only)`);
