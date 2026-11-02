// R13f: displacement vs scroll for 4 representative cards, live's parting formula (on the cards' original Framer positions)
// against our aura (on the generated layout), at constant scroll speed. Writes tools/scratch/r13f-data.json.
//   node tools/scratch/r13f-measure.mjs [WxH] [speed px/s]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [W, H] = (process.argv[2] || '1920x1080').split('x').map(Number);
const SPEED = +(process.argv[3] || 1000);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto('http://localhost:5199/'); await p.waitForFunction(() => window.__siteReady); await p.waitForTimeout(1200);
const BASE = await p.evaluate(() => ({ ...window.__CARDS }));
const run = async (cfg) => { await p.evaluate(([b, c]) => Object.assign(window.__CARDS, b, c), [BASE, cfg || {}]); return p.evaluate(async ([W, H, SPEED]) => {
  const data = (await import('/src/data/data.json')).default.selectedWorkCards;
  const scale = Math.min(W, 1920) / 1920;
  const sec = document.getElementById('selected-work');
  const top = sec.getBoundingClientRect().top + scrollY;
  const dbg = () => window.__cards.debug();
  const posL = window.__cards.positions(); // live's formula is applied to OUR generated layout, so curves compare card by card
  const sel = data.map((c, i) => ({ name: 'card ' + c.id, i, id: c.id, mouse: c.mouse, x0: c.x }));
  // live's model: target from the card's on-screen rect centre INCLUDING its offset; offset eased 0.2 per 60 fps frame
  const live = sel.map(() => ({ x: 0, y: 0, armed: false, tx: 0, ty: 0 }));
  const K = window.__CARDS ? 1.15 : 1; // Anh's tuned parting strength (R13b)
  const P = { xMax: 0.2, xMin: 0.01, yMax: 0.3, yMin: 0.01, z: 1.1, armed: 0.1 };
  const rec = sel.map(() => []);
  const y0 = top - H * 1.1, y1 = top + H * 2.85;
  window.scrollTo(0, y0);
  await new Promise((r) => setTimeout(r, 1500));
  let y = y0, last = performance.now();
  await new Promise((resolve) => {
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      y += SPEED * dt; window.scrollTo(0, y);
      const sy = window.scrollY;
      const d = dbg();
      sel.forEach((s, k) => {
        const c = data[s.i], L = live[k];
        const bxL = W / 2 + posL[s.i].x * scale, byL = top + (posL[s.i].y * H) / 100, h = c.h * scale;
        const cx = bxL + L.x, cy = byL - sy + L.y;
        if (!L.armed && cy - h / 2 < H - P.armed * h && cy + h / 2 > P.armed * h) L.armed = true;
        if (L.armed) {
          const dx = cx - W / 2, f = Math.min(Math.abs(dx) / (W / 2), 1), g = 1 - Math.min(Math.max((cy + h) / (H + 2 * h), 0), 1);
          if (g > 0 && g < 1) { const t = (1 - Math.abs(g - 0.5) * 2) * K; L.tx = t * (W * P.xMin + (W * P.xMax - W * P.xMin) * (1 - f)) * (dx < 0 ? -1 : 1) * P.z; L.ty = t * (H * P.yMin + (H * P.yMax - H * P.yMin) * (1 - f)) * P.z; }
        }
        const a = 1 - Math.pow(0.8, dt * 60);
        L.x += (L.tx - L.x) * a; L.y += (L.ty - L.y) * a;
        rec[k].push({ sy, t: now, liveX: L.x, liveY: L.y, liveTX: L.tx, liveTY: L.ty, ourX: d.px[s.i], ourY: d.py[s.i], ourTX: d.tpx[s.i], ourTY: d.tpy[s.i], cyOur: d.by[s.i] - sy });
      });
      if (y < y1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  return { W, H, SPEED, sel, rec, top };
}, [W, H, SPEED]); };
const metrics = (out) => {
  let sx = 0, sy = 0, n = 0, ax = 0, ay = 0, lx = 0, ly = 0, jx = 0, jy = 0;
  out.rec.forEach((r) => {
    for (let i = 0; i < r.length; i++) { sx += (r[i].ourX - r[i].liveX) ** 2; sy += (r[i].ourY - r[i].liveY) ** 2; n++; ax = Math.max(ax, Math.abs(r[i].ourX)); lx = Math.max(lx, Math.abs(r[i].liveX)); ay = Math.max(ay, Math.abs(r[i].ourY)); ly = Math.max(ly, Math.abs(r[i].liveY)); if (i && r[i].cyOur > 0 && r[i].cyOur < out.H) { jx = Math.max(jx, Math.abs(r[i].ourTX - r[i - 1].ourTX)); jy = Math.max(jy, Math.abs(r[i].ourTY - r[i - 1].ourTY)); } }
  });
  return { rmsX: Math.sqrt(sx / n), rmsY: Math.sqrt(sy / n), ampX: ax, ampLX: lx, ampY: ay, ampLY: ly, jumpX: jx, jumpY: jy };
};
if (process.argv[4]) { // grid: JSON array of {param: value} configs
  const rows = [];
  for (const cfg of JSON.parse(process.argv[4])) { const m = metrics(await run(cfg)); rows.push({ cfg, m }); console.log(JSON.stringify(cfg), 'rmsX', m.rmsX.toFixed(1), 'rmsY', m.rmsY.toFixed(1), 'maxX', m.ampX.toFixed(0) + '/' + m.ampLX.toFixed(0), 'maxY', m.ampY.toFixed(0) + '/' + m.ampLY.toFixed(0), 'jump', m.jumpX.toFixed(0), m.jumpY.toFixed(0)); }
  await b.close(); process.exit(0);
}
const out = await run({});
fs.writeFileSync(new URL('./r13f-data.json', import.meta.url), JSON.stringify(out));
// per-class summary (front = layer value >= 75, back = <= 25)
const stat = (k) => { const r = out.rec[k]; let jx = 0, jy = 0, jlx = 0, jly = 0; for (let i = 1; i < r.length; i++) { if (r[i].cyOur <= 0 || r[i].cyOur >= out.H) continue; jx = Math.max(jx, Math.abs(r[i].ourTX - r[i - 1].ourTX)); jy = Math.max(jy, Math.abs(r[i].ourTY - r[i - 1].ourTY)); jlx = Math.max(jlx, Math.abs(r[i].liveTX - r[i - 1].liveTX)); jly = Math.max(jly, Math.abs(r[i].liveTY - r[i - 1].liveTY)); } return { mx: Math.max(...r.map((q) => Math.abs(q.ourX))), my: Math.max(...r.map((q) => Math.abs(q.ourY))), mlx: Math.max(...r.map((q) => Math.abs(q.liveX))), mly: Math.max(...r.map((q) => Math.abs(q.liveY))), jx, jy, jlx, jly }; };
for (const [label, test] of [['front', (m) => m >= 75], ['back', (m) => m <= 25]]) {
  const ks = out.sel.map((s, k) => k).filter((k) => test(out.sel[k].mouse)); const S = ks.map(stat);
  const avg = (f) => (S.reduce((a, s) => a + f(s), 0) / S.length).toFixed(0);
  console.log(`${label} (${ks.length} cards): mean max |x| ours ${avg((s) => s.mx)} live ${avg((s) => s.mlx)} | mean max |y| ours ${avg((s) => s.my)} live ${avg((s) => s.mly)} | worst one-frame target jump ours x ${Math.max(...S.map((s) => s.jx)).toFixed(0)} y ${Math.max(...S.map((s) => s.jy)).toFixed(0)}, live x ${Math.max(...S.map((s) => s.jlx)).toFixed(0)} y ${Math.max(...S.map((s) => s.jly)).toFixed(0)}`);
}
await b.close();
