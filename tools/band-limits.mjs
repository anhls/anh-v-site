// R22d: counts the OLD curated cards (git commit bdc4e14, data.json selectedWorkCards) per band, with the bands of cardBands() at
// 1920x1080 (needs `npx vite` running), and prints BAND_LIMITS for timeline.js: min = 75%, max = 130% of the old count and area.
// Usage: node tools/band-limits.mjs [commit]
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
const commit = process.argv[2] || 'bdc4e14';
const old = JSON.parse(execFileSync('git', ['show', `${commit}:src/data/data.json`], { maxBuffer: 1 << 26 }).toString()).selectedWorkCards;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5199/'); await p.waitForFunction(() => window.__siteReady);
const edges = await p.evaluate(async () => {
  const { cardBands } = await import('/src/data/cards-gen.js');
  const { bands, zones } = cardBands(['tcb-priority', 'bitis09', 'sulwhasoo']);
  return { b: bands.map((x) => [x.lo, x.hi]), z: zones };
});
await b.close();
const list = [['tcb', edges.b[0]], ['zone1', edges.z[0]], ['bitis', edges.b[1]], ['zone2', edges.z[1]], ['sulwhasoo', edges.b[2]]];
const out = {};
for (const [name, [lo, hi]] of list) {
  const cs = old.filter((c) => c.y >= lo && c.y < hi + (name === 'sulwhasoo' ? 1e9 : 0));
  const area = cs.reduce((a, c) => a + c.w * c.h, 0);
  const L = cs.filter((c) => c.x < 0).length;
  out[name] = { vh: +(hi - lo).toFixed(1), n: cs.length, L, R: cs.length - L, areaM: +(area / 1e6).toFixed(2) };
  out[name].limits = { minN: Math.round(cs.length * 0.75), maxN: Math.round(cs.length * 1.3), minA: Math.round((area * 0.75) / 1e4) * 1e4, maxA: Math.round((area * 1.3) / 1e4) * 1e4 };
}
console.log(JSON.stringify(out, null, 1));
