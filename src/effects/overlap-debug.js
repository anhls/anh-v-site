// R29 (dev only, `?overlap`): shows, in the CURRENT frame and in WHATEVER state the cards are in (also the unchecked extremes: mouse drift corners, the speed lead,
// transitions), every pair that breaks the pair rule (red), every cluster with more dark cards than allowed (orange) and every point under 3 cards (magenta), with a
// small readout. So when something looks wrong the cause can be named and the state added to LAYOUT_STATES (timeline.js). Reads the cards' DOM boxes (the loops write
// their transforms every frame), 5 times a second; nothing runs without ?overlap and nothing of it ships.
import { BAND_RULES, LAYOUT_STATES } from '../timeline.js';
import { linkedPairs, clustersOf } from '../data/overlap.js';

export function mountOverlapDebug(selector, getState) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none';
  const readout = document.createElement('div');
  readout.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;padding:8px 10px;background:rgba(0,0,0,.85);color:#fff;font:12px/1.4 system-ui,sans-serif;border:1px solid #666;pointer-events:none;white-space:pre';
  document.body.append(layer, readout);
  const box = (r, color, w = 2) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;border:${w}px solid ${color};box-sizing:border-box`; layer.append(d); };
  const tick = () => {
    layer.textContent = '';
    const els = [...document.querySelectorAll(selector)].filter((e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden'; });
    const rs = els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, dark: e.dataset.dark === '1' }; }).filter((r) => r.w > 4 && r.x < innerWidth && r.x + r.w > 0 && r.y < innerHeight && r.y + r.h > 0);
    const n = rs.length; const pairs = [];
    let nPair = 0, nTriple = 0;
    const near = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = rs[i], b = rs[j], ox = (a.w + b.w) / 2 - Math.abs(a.x + a.w / 2 - b.x - b.w / 2), oy = (a.h + b.h) / 2 - Math.abs(a.y + a.h / 2 - b.y - b.h / 2);
      if (ox <= 0 || oy <= 0) continue;
      near[i].push(j); near[j].push(i);
      const f = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
      if (f >= BAND_RULES.clusterLink) pairs.push([i, j]);
      if (f > BAND_RULES.pairOverlapMax + 1e-6) { nPair++; box(a, '#ff2b2b'); box(b, '#ff2b2b'); }
    }
    for (let i = 0; i < n; i++) for (const j of near[i]) { if (j <= i) continue; for (const k of near[i]) { if (k <= j) continue; const a = rs[i], b = rs[j], c = rs[k]; const x0 = Math.max(a.x, b.x, c.x), x1 = Math.min(a.x + a.w, b.x + b.w, c.x + c.w), y0 = Math.max(a.y, b.y, c.y), y1 = Math.min(a.y + a.h, b.y + b.h, c.y + c.h); if (x1 - x0 > 0.5 && y1 - y0 > 0.5) { nTriple++; box({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, '#ff00d0', 3); } } }
    let nCl = 0;
    for (const cl of clustersOf(n, pairs)) { const d = cl.filter((i) => rs[i].dark); if (d.length > BAND_RULES.maxDarkPerCluster) { nCl++; d.forEach((i) => box(rs[i], '#ff9a00', 3)); } }
    readout.textContent = `?overlap  ${n} cards on screen\npair overlap over ${BAND_RULES.pairOverlapMax}: ${nPair}\nclusters over ${BAND_RULES.maxDarkPerCluster} dark: ${nCl}\npoints under 3 cards: ${nTriple}\nstate: ${getState ? getState() : 'live'}\nchecked: ${Object.entries(LAYOUT_STATES).filter(([, v]) => v).map(([k, v]) => (v === true ? k : `${k} ${v}`)).join(', ')}`;
  };
  setInterval(tick, 200); tick();
}
