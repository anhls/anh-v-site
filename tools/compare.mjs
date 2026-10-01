// Compare the rebuild with the live Framer site in real headless Chrome. Prints ONLY mismatches beyond tolerance
// plus one summary line per size, to keep logs short.
//   npm run compare                                        full run, 1920x1080 (dev server on http://localhost:5199/ must be running)
//   npm run compare -- --sizes 1920x1080,2560x1440         several sizes at the same time (required before every commit)
//   npm run compare -- --only aboutRev,aboutTop --points 60,75,90    tuning mode: fewer probes / points
//   npm run compare -- --refresh-live                      re-measure the live site (do it once at the start of a motion request,
//                                                          and after every Framer republish); otherwise live values come from
//                                                          tools/live-cache/<W>x<H>.json, and any point missing there is measured and added
//   --moved                                            also compare the More Projects label / names (moved up on purpose in R13g)
//   --cards                                            also compare the Selected Work cards (off since R13c: they differ from live by design)
//   other options: --points 0,15,..  --settle 2000 (max ms to wait for values to stop changing)  --dump file.json
//                  --local http://localhost:5199/  --live https://www.anh-v.com/  (--width/--height still work for one size)
// Needs: npm i -D playwright-core (uses your installed Google Chrome, no browser download).
// Live selectors are Framer class names from the current publish; if Anh republishes Framer they may change
// (then run with --refresh-live).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const LOCAL = arg('local', 'http://localhost:5199/');
const LIVE = arg('live', 'https://www.anh-v.com/');
const POINTS = arg('points', '0,15,30,45,60,75,90,140,150,157,165,178,189,200,213,220,250,270,290,310,330,345,370,395,420,445,470,500,535,560,600,630').split(',').map(Number);
const SETTLE = +arg('settle', 2000);
const SIZES = arg('sizes', `${arg('width', 1920)}x${arg('height', 1080)}`).split(',').map((s) => s.split('x').map(Number));
const DUMP = arg('dump', ''); // --dump file.json writes every probe value, per size (live + local), for fitting ranges
const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'live-cache');

// name: [liveSelector, localSelector, kind, tolerance]
// kinds: cxp (centre x from the window centre, px), cyp (centre y from the window top, px), share (% of leaf spans lit), ty (translateY px), sc (scale), op (own opacity), opc (opacity incl. ancestors), w (width vw), ctr (centre % of viewport height), top (top % of viewport height)
const ALL_PROBES = {
  maskW: ['.framer-2w3dnm', '.hero__wrapper', 'w', 1.5],
  maskCtr: ['.framer-2w3dnm', '.hero__wrapper', 'ctr', 1.5],
  s1y: ['.framer-pq8oj2', '.hero__s1', 'ty', 12], s1sc: ['.framer-pq8oj2', '.hero__s1', 'sc', 0.02],
  s2y: ['.framer-i2mh4w', '.hero__s2', 'ty', 12],
  s3y: ['.framer-1fyez4a', '.hero__s3', 'ty', 25], s3sc: ['.framer-1fyez4a', '.hero__s3', 'sc', 0.02],
  peelTop: ['.framer-g3h1jl', '.hero__gallery@2', 'ty', 40], peelMid: ['.framer-12gb5tm', '.hero__gallery@1', 'ty', 40],
  video: ['.framer-1wyli73-container', '.hero__video', 'op', 0.06],
  ticker: ['.framer-sk6i4y-container', '.ticker__track', 'opc', 0.06],
  overlay: ['.framer-3xg1dm', '.hero__overlay', 'op', 0.06],
  row1: ['.framer-11eb7tc', '.index__inner@0', 'ty', 12], row2: ['.framer-1o8mqob', '.index__inner@1', 'ty', 12], row3: ['.framer-1z84ym', '.index__inner@2', 'ty', 12],
  aboutTop: ['ABOUT_LIVE', '.about__text', 'top', 1.5],
  mpLabel: ['.framer-385i7c', '.more-projects__label', 'top', 1.5],          // More Projects label ("Client" on live)
  mpName1: ['.framer-1ry0rr0-con', '.more-projects__list li@0', 'top', 1.5],  // first name (Forbes)
  mpName3: ['.framer-1i6cfbr-con', '.more-projects__list li@2', 'top', 1.5],  // third name (Sulwhasoo)
  footLink: ['.framer-195hxhu', '.footer .footer__top', 'top', 1.5],                   // Go Back To Top
  // Selected Work: one card per layer (back 13, layer1 17, layer2 30, layer3 26, layer4 8), centre x / y in px at settled scroll points, mouse parked.
  swBackX: ['SW@12', 'SW@12', 'cxp', 8], swBackY: ['SW@12', 'SW@12', 'cyp', 8],
  swL1X: ['SW@16', 'SW@16', 'cxp', 8], swL1Y: ['SW@16', 'SW@16', 'cyp', 8],
  swL2X: ['SW@29', 'SW@29', 'cxp', 8], swL2Y: ['SW@29', 'SW@29', 'cyp', 8],
  swL3X: ['SW@25', 'SW@25', 'cxp', 8], swL3Y: ['SW@25', 'SW@25', 'cyp', 8],
  swL4X: ['SW@7', 'SW@7', 'cxp', 8], swL4Y: ['SW@7', 'SW@7', 'cyp', 8],
  aboutRev: ['ABOUT_LIVE', '.about__text', 'share', 6], // % of the About words/letters that are mostly lit (opacity > 0.6)
};
const LATE_PROBES = new Set(['mpLabel', 'mpName1', 'mpName3', 'footLink']); // the only probes compared at 600vh and beyond
const ONLY = arg('only', '');
// R13c: the Selected Work card probes (sw*) differ from live by design (depth parting, push-away, new layout): skipped unless --cards.
// R13g: the More Projects label / names moved up on purpose (the list now clears the returning wordmark): skipped unless --moved.
const MOVED = new Set(['mpLabel', 'mpName1', 'mpName3']);
const DEFAULT_PROBES = Object.fromEntries(Object.entries(ALL_PROBES).filter(([n]) => (flag('cards') || !n.startsWith('sw')) && (flag('moved') || !MOVED.has(n))));
const PROBES = ONLY ? Object.fromEntries(ONLY.split(',').map((n) => { if (!ALL_PROBES[n]) throw new Error(`unknown probe ${n}`); return [n, ALL_PROBES[n]]; })) : DEFAULT_PROBES;

const probeFn = ({ probes, side }) => {
  const vh = innerHeight / 100;
  const pick = (sel) => {
    if (sel === 'ABOUT_LIVE') { const c = [...document.querySelectorAll('*')].filter((e) => e.textContent.includes('Vu Tuan Anh') && e.querySelectorAll('span').length > 100); return c[c.length - 1]; }
    if (sel.startsWith('SW@')) return document.querySelectorAll(side === 'live' ? 'section.framer-1uw4ebn img' : '.sw__card')[+sel.slice(3)];
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
      case 'share': { const sp = [...el.querySelectorAll('span')].filter((x) => !x.querySelector('span')); v = (sp.filter((x) => +getComputedStyle(x).opacity > 0.6).length / sp.length) * 100; break; }
      case 'cxp': v = r.left + r.width / 2 - innerWidth / 2; break; case 'cyp': v = r.top + r.height / 2; break;
      case 'w': v = (r.width / innerWidth) * 100; break; case 'ctr': v = (r.top + r.height / 2) / vh; break; case 'top': v = r.top / vh; break;
    }
    out[name] = Math.round(v * 100) / 100;
  }
  return out;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = async (page, side, probes) => { for (let t = 0; t < 3; t++) { try { return await page.evaluate(probeFn, { probes, side }); } catch { await sleep(1000); } } return {}; };

// Open a page and wait until the site is ready: local sets window.__siteReady (10s fallback); live needs its .pin-spacer
// (its scripts sometimes fail to start, so reload until it appears), then a few seconds for its loader.
async function open(browser, side, url, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(url);
  if (side === 'local') await page.waitForFunction(() => window.__siteReady === true, null, { timeout: 10000 }).catch(() => {});
  else {
    for (let t = 0; t < 4; t++) {
      if (await page.waitForSelector('.pin-spacer', { timeout: 30000 }).then(() => true, () => false)) break;
      console.log(`live ${w}x${h} not initialised, reloading`); await page.reload();
    }
    await sleep(5000);
  }
  return page;
}

// Scroll to each point and read the probes once they stop changing (two reads 100ms apart within 1% of tolerance), max SETTLE ms.
async function measure(page, side, w, h, points, probes) {
  const res = {};
  for (const v of points) {
    await page.evaluate((v) => window.scrollTo(0, (v * innerHeight) / 100), v);
    await sleep(300);
    let prev = await read(page, side, probes); let cur = prev;
    for (let waited = 300; waited < SETTLE; waited += 100) {
      await sleep(100); cur = await read(page, side, probes);
      if (Object.entries(probes).every(([n, p]) => cur[n] == null || prev[n] == null || Math.abs(cur[n] - prev[n]) <= p[3] * 0.01)) break;
      prev = cur;
    }
    res[v] = cur;
  }
  await page.context().close();
  return res;
}

// Live values come from tools/live-cache/<W>x<H>.json, per point: { date, v: { probe: value } }.
const cachePath = (w, h) => path.join(CACHE_DIR, `${w}x${h}.json`);
const loadCache = (w, h) => { try { return JSON.parse(fs.readFileSync(cachePath(w, h), 'utf8')); } catch { return { points: {} }; } };
const hasAll = (entry, probes) => entry && Object.keys(probes).every((n) => n in entry.v);

async function runSize(browser, w, h) {
  const t0 = Date.now();
  const cache = loadCache(w, h);
  // Measure live for the points that are not cached (or all requested points with --refresh-live). The cache always stores every probe.
  const need = POINTS.filter((v) => flag('refresh-live') || !hasAll(cache.points[v], ALL_PROBES));
  const liveJob = need.length ? open(browser, 'live', LIVE, w, h).then((p) => measure(p, 'live', w, h, need, ALL_PROBES)) : Promise.resolve({});
  const localJob = open(browser, 'local', LOCAL, w, h).then((p) => measure(p, 'local', w, h, POINTS, PROBES));
  const [fresh, local] = await Promise.all([liveJob, localJob]);
  if (need.length) {
    const date = new Date().toISOString().slice(0, 10);
    for (const v of need) cache.points[v] = { date, v: fresh[v] };
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(w, h), JSON.stringify(cache));
  }
  const live = Object.fromEntries(POINTS.map((v) => [v, cache.points[v].v]));
  let bad = 0, total = 0;
  for (const v of POINTS) for (const [name, p] of Object.entries(PROBES)) {
    if (v >= 600 && !LATE_PROBES.has(name)) continue; // past 585vh the hero deliberately differs from live (R11b: ours fades to black, live's image vanishes)
    const a = live[v]?.[name], b = local[v]?.[name]; if (a == null || b == null) continue;
    // Selected Work cards: a card that has scrolled off the screen keeps a stale parting offset that depends on the exact scroll path; only compare cards that are on screen on live.
    if (name.startsWith('sw')) { const y = live[v]?.[name.replace(/X$/, 'Y')]; if (y != null && (y < -100 || y > h + 100)) continue; }
    total++;
    if (Math.abs(a - b) > p[3]) { bad++; console.log(`${w}x${h} ${String(v).padStart(3)}vh ${name.padEnd(9)} live ${a}  local ${b}`); }
  }
  console.log(`compare: ${total - bad}/${total} within tolerance, ${bad} mismatches (${w}x${h}, ${need.length ? `live measured at ${need.length} point${need.length > 1 ? 's' : ''}` : 'live from cache'}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  return { size: `${w}x${h}`, live, local };
}

const browser = await chromium.launch({ channel: 'chrome' });
const results = await Promise.all(SIZES.map(([w, h]) => runSize(browser, w, h)));
await browser.close();
if (DUMP) fs.writeFileSync(DUMP, JSON.stringify(Object.fromEntries(results.map((r) => [r.size, { live: r.live, local: r.local }]))));
