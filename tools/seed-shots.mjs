// R22 seed audition: node tools/seed-shots.mjs [count=20] [first=1]
// Renders the Selected Work section at 1920x1080 for several ?seed values into tools/scratch/r22-shots/ (needs `npx vite` running).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const count = Number(process.argv[2] || 20), first = Number(process.argv[3] || 1);
mkdirSync('tools/scratch/r22-shots', { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (let s = first; s < first + count; s++) {
  await p.goto(`http://localhost:5199/?seed=${s}`);
  await p.waitForFunction(() => window.__siteReady);
  const top = await p.evaluate(() => document.getElementById('selected-work').getBoundingClientRect().top + scrollY);
  for (const [vh, n] of [[60, 'a'], [160, 'b']]) {
    await p.evaluate((y) => window.scrollTo(0, y), top + vh * 10.8);
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `tools/scratch/r22-shots/seed-${String(s).padStart(2, '0')}${n}.png` });
  }
  console.log('seed', s);
}
await b.close();
