// Compare the rebuild with the live Framer site at a real 1920x1080 (headless Chrome).
// Prints ONLY mismatches beyond tolerance + a one-line summary, to keep logs short.
// Usage: npm run compare                       (local = http://localhost:5173, dev server must be running)
//        npm run compare -- --local http://localhost:4173 --points 0,30,60
// Needs: npm i -D playwright-core (uses your installed Google Chrome, no browser download).
// Live selectors are Framer class names from the current publish; if Anh republishes Framer they may change.
import { chromium } from 'playwright-core';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const LOCAL = arg('local', 'http://localhost:5173/');
const LIVE = arg('live', 'https://www.anh-v.com/');
const POINTS = arg('points', '0,15,30,45,60,75,90,140,150,157,165,178,189,200,213,220,330,345,420,500,535,560').split(',').map(Number);
const SETTLE = +arg('settle', 2000);

// name: [liveSelector, localSelector, kind, tolerance]
// kinds: ty (translateY px), sc (scale), op (own opacity), opc (opacity incl. ancestors), w (width vw), ctr (centre % of viewport height), top (top % of viewport height)
const PROBES = {
  maskW: ['[data-framer-name=wrapper]:nth-of-type(n)@1', '.hero__wrapper', 'w', 1.5],
  maskCtr: ['[data-framer-name=wrapper]:nth-of-type(n)@1', '.hero__wrapper', 'ctr', 1.5],
  s1y: ['.framer-pq8oj2', '.hero__s1', 'ty', 12], s1sc: ['.framer-pq8oj2', '.hero__s1', 'sc', 0.02],
  s2y: ['.framer-i2mh4w', '.hero__s2', 'ty', 12],
  s3y: ['.framer-1fyez4a', '.hero__s3', 'ty', 25], s3sc: ['.framer-1fyez4a', '.hero__s3', 'sc', 0.02],
  peelTop: ['.framer-g3h1jl', '.hero__gallery@2', 'ty', 40], peelMid: ['.framer-12gb5tm', '.hero__gallery@1', 'ty', 40],
  video: ['.framer-1wyli73-container', '.hero__video', 'op', 0.06],
  ticker: ['.framer-sk6i4y-container', '.ticker__track', 'opc', 0.06],
  overlay: ['.framer-3xg1dm', '.hero__overlay', 'op', 0.06],
  row1: ['.framer-11eb7tc', '.index__inner@0', 'ty', 12], row2: ['.framer-1o8mqob', '.index__inner@1', 'ty', 12], row3: ['.framer-1z84ym', '.index__inner@2', 'ty', 12],
  aboutTop: ['ABOUT_LIVE', '.about__text', 'top', 1.5],
};

const probeFn = ({ probes, side }) => {
  const vh = innerHeight / 100;
  const pick = (sel) => {
    if (sel === 'ABOUT_LIVE') { const c = [...document.querySelectorAll('*')].filter((e) => e.textContent.includes('Vu Tuan Anh') && e.querySelectorAll('span').length > 100); return c[c.length - 1]; }
    const [s, n] = sel.split('@'); const all = document.querySelectorAll(s.replace(':nth-of-type(n)', '')); return all[n ? +n : 0];
  };
  const out = {};
  for (const [name, p] of Object.entries(probes)) {
    const el = pick(side === 'live' ? p[0] : p[1]); if (!el) { out[name] = null; continue; }
    const cs = getComputedStyle(el); const m = new DOMMatrix(cs.transform); const r = el.getBoundingClientRect();
    let v;
    switch (p[2]) {
      case 'ty': v = m.f; break; case 'sc': v = m.a; break; case 'op': v = +cs.opacity; break;
      case 'opc': { v = 1; let x = el; while (x && x !== document.body) { v *= +getComputedStyle(x).opacity; x = x.parentElement; } break; }
      case 'w': v = (r.width / innerWidth) * 100; break; case 'ctr': v = (r.top + r.height / 2) / vh; break; case 'top': v = r.top / vh; break;
    }
    out[name] = Math.round(v * 100) / 100;
  }
  return out;
};

async function run(side, url, browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url); await page.waitForTimeout(side === 'live' ? 15000 : 8000);
  const res = {};
  for (const v of POINTS) {
    await page.evaluate((v) => window.scrollTo(0, (v * innerHeight) / 100), v); await page.waitForTimeout(SETTLE);
    for (let t = 0; t < 3; t++) { try { res[v] = await page.evaluate(probeFn, { probes: PROBES, side }); break; } catch { await page.waitForTimeout(1500); } }
  }
  await page.close(); return res;
}

const browser = await chromium.launch({ channel: 'chrome' });
const [live, local] = [await run('live', LIVE, browser), await run('local', LOCAL, browser)];
await browser.close();
let bad = 0, total = 0;
for (const v of POINTS) for (const [name, p] of Object.entries(PROBES)) {
  const a = live[v]?.[name], b = local[v]?.[name]; if (a == null || b == null) continue; total++;
  if (Math.abs(a - b) > p[3]) { bad++; console.log(`${String(v).padStart(3)}vh ${name.padEnd(9)} live ${a}  local ${b}`); }
}
console.log(`compare: ${total - bad}/${total} within tolerance, ${bad} mismatches (1920x1080, settle ${SETTLE}ms)`);
