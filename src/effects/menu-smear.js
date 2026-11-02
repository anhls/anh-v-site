import { HOME_FLIGHT as F, WORK_PTR } from '../timeline.js';
import { TALL_MENU as TM } from '../settings/tall.js';
import { createHomeFlight } from './home-flight.js';

// R48 rounds 6 + 7: the phone menu's open / close = the Home -> Work flight's PIXEL SWIPE language, sideways. The renderer is the flight's (home-flight.js, look 'pixel': the Work hover-smear grid in SCREEN
// space, WORK_PTR.pixelGrid columns across the width, so one block is the same number of CSS px as in the flight; block shift = pixelStrength, RGB split = pixelRgb). What is new is only how the grid is
// filled: not a brush simulation but a SMEAR ZONE that travels with the panel's edge:
//   - the panel's edge is RAGGED PER ROW: every grid row has its own offset (noise), the edges snapped to whole cells (tall-menu.js clips the panel with the polygon this module returns);
//   - ahead of the edge (the page side) a zone TM.zoneShare of the width wide: the page's own pictures are pulled sideways in blocks (a per-cell offset with noise), strongest at the edge, fading to exactly 0
//     at the zone's leading edge; a cell the zone does not touch stays transparent = the page itself (smear exactly 0 at rest).
//   - open: the edge sweeps left -> right; close: the exact reverse (right -> left), the sweep time is given by the caller (the close is twice as fast).
// What is smeared: the page's pictures taken from the DOM at the tap (the hero video on Home, the Work cards, the media of a project page). Everything is time-based.
const MAX_SRC = 5;
const smooth = (q) => { q = Math.min(1, Math.max(0, q)); return q * q * (3 - 2 * q); };
export const unsmooth = (s) => { s = Math.min(1, Math.max(0, s)); let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (smooth(m) < s) lo = m; else hi = m; } return (lo + hi) / 2; };
// the sweep time of the open (the flight's own cross-fade stretch), the close is twice as fast
export const MENU_SWEEP = { openSec: F.sec * (F.crossTo - F.crossFrom), closeDiv: 2 };
export const gridCols = () => Math.max(8, Math.round(WORK_PTR.pixelGrid));
export const gridBlockPx = (W = innerWidth) => W / gridCols(); // one smear block in CSS px (the flight uses the same grid)
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// the geometry of the sweep for a screen width: the mean edge position f runs from -zone (all of it off the left side) to W + jag (all of it off the right side)
export const sweepGeom = (W = innerWidth) => { const cell = gridBlockPx(W), zone = TM.zoneShare * W, jag = TM.jagCells * cell; return { cell, zone, jag, from: -zone, to: W + jag }; };
export const frontAt = (s, W = innerWidth) => { const g = sweepGeom(W); return g.from + (g.to - g.from) * s; }; // s = the open-equivalent progress 0..1 (eased)
export const frontTime = (x, sec, W = innerWidth) => { const g = sweepGeom(W); return unsmooth((x - g.from) / (g.to - g.from)) * sec; }; // when (s into the open sweep) the mean edge reaches x

const SKIP = '.tmenu, .tmenu__btn, .spawner, a.wordmark, a.twm, nav.nav, .loader, .skip';
// the page's pictures that are on screen: [{ el, box }] (box = where the picture is drawn, css px)
export function collectSources() {
  const W = innerWidth, H = innerHeight, out = [];
  for (const el of document.querySelectorAll('img, video')) {
    if (el.closest(SKIP)) continue;
    const isV = el.tagName === 'VIDEO', nw = isV ? el.videoWidth : el.naturalWidth, nh = isV ? el.videoHeight : el.naturalHeight;
    if (!nw || !nh || (isV ? el.readyState < 2 : !el.complete)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40 || r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || (+cs.opacity < 0.05 && !el.closest('.work__frame, .work__item'))) continue; // (the Work cards are drawn by the page canvas: their DOM pictures are at opacity 0)
    let box = { x: r.x, y: r.y, w: r.width, h: r.height };
    if (cs.objectFit === 'contain' || cs.objectFit === 'scale-down') { const k = Math.min(r.width / nw, r.height / nh); box = { x: r.x + (r.width - nw * k) / 2, y: r.y + (r.height - nh * k) / 2, w: nw * k, h: nh * k }; }
    out.push({ el, box, area: box.w * box.h });
  }
  const same = (a, b) => Math.abs(a.box.x - b.box.x) < 1 && Math.abs(a.box.y - b.box.y) < 1 && Math.abs(a.box.w - b.box.w) < 1 && Math.abs(a.box.h - b.box.h) < 1;
  const keep = out.filter((s, i) => !(s.el.tagName === 'IMG' && out.some((o, j) => j !== i && o.el.tagName === 'VIDEO' && same(o, s)))); // (a poster under its video)
  return keep.sort((a, b) => b.area - a.area).slice(0, MAX_SRC).sort((a, b) => out.indexOf(a) - out.indexOf(b));
}

// Creates the renderer once (call it when the page is idle: the shader compile must not happen at the tap). Returns null when WebGL2 is unavailable.
export function createMenuSmear() {
  const fl = createHomeFlight(document.body, MAX_SRC + 1);
  if (!fl) return null;
  const canvas = fl.canvas;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:49;display:none';
  let raf = 0, active = null;
  const stats = { frames: 0, avgMs: 0, maxMs: 0, last: 0 };
  fl.onLost = () => { api.lost = true; };
  const api = {
    lost: false, stats,
    get playing() { return !!active; },
    get dpr() { return canvas.width / Math.max(1, innerWidth); },
    // open = true: the edge sweeps left -> right; false: right -> left (the exact reverse). sec = the sweep time; delay = seconds to wait first (the panel stays whole).
    // onFrame({ s, f, clip }) every frame: s = the open-equivalent progress 0..1, f = the mean edge x (px), clip = the panel's clip-path (css string); onDone() after the last frame.
    play({ open, sec, delay = 0, onFrame, onDone }) {
      if (api.lost || fl.dead) return false;
      api.cancel();
      const src = collectSources();
      src.forEach((s, i) => { s.slot = i; fl.setPicture(i, s.el); });
      const W = innerWidth, H = innerHeight, G = sweepGeom(W), cols = gridCols(), rows = Math.max(4, Math.round((cols * H) / W)), cell = W / cols, rh = H / rows;
      const grid = new Float32Array(cols * rows * 4); for (let i = 3; i < grid.length; i += 4) grid[i] = 1;
      const rowOff = Array.from({ length: rows }, (_, r) => hash(r * 1.913 + 4.1)); // 0..1: how far behind the mean edge each row's own edge sits
      const dir = open ? 1 : -1, amp = WORK_PTR.pixelVelMax;
      canvas.style.display = 'block';
      stats.frames = 0; stats.avgMs = 0; stats.maxMs = 0; stats.last = 0;
      const t0 = performance.now() + delay * 1000;
      const frame = (now) => {
        if (stats.last) { const ms = now - stats.last; stats.frames++; stats.avgMs += (ms - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, ms); } stats.last = now;
        const t = (now - t0) / 1000, u = Math.min(1, Math.max(0, t / sec)), s = open ? smooth(u) : 1 - smooth(u), f = G.from + (G.to - G.from) * s;
        const waiting = t < 0;
        const pts = []; let nZero = 0, nFull = 0;
        grid.fill(0); for (let i = 3; i < grid.length; i += 4) grid[i] = 1;
        for (let r = 0; r < rows; r++) {
          const e = Math.max(0, Math.min(W, Math.round((f - G.jag * rowOff[r]) / cell) * cell));
          if (e <= 0) nZero++; if (e >= W) nFull++;
          pts.push(`${e}px ${(r * rh).toFixed(2)}px`, `${e}px ${((r + 1) * rh).toFixed(2)}px`);
          const zoneN = Math.min(cols, Math.ceil((e + G.zone) / cell));
          for (let c = Math.floor(e / cell); c < zoneN; c++) {
            const d = (c + 0.5) * cell - e; if (d <= 0 || d >= G.zone) continue;
            const k = 1 - d / G.zone, prof = Math.pow(k, 1.3), v = prof * amp * (0.45 + 0.55 * hash(c * 3.17 + r * 7.71)) * (0.6 + 0.4 * rowOff[r]);
            grid[(r * cols + c) * 4] = dir * v;
          }
        }
        fl.begin();
        if (!waiting) {
          fl.setGrid(grid, cols, rows, [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb]);
          const fo = { frontPx: -1e9, gain: 1, vertical: false, flip: false, skipZero: true }, still = { bend: 0, mix: 0 };
          src.forEach((q) => fl.layer(q.box, q.box, still, still, [q.slot, q.slot], fo));
        }
        const clip = nFull === rows ? 'none' : nZero === rows ? 'polygon(0 0, 0 0, 0 0)' : `polygon(0 0, ${pts.join(', ')}, 0 ${H}px)`;
        onFrame?.({ s: waiting ? (open ? 0 : 1) : s, f: waiting ? (open ? G.from : G.to) : f, clip: waiting ? (open ? 'polygon(0 0, 0 0, 0 0)' : 'none') : clip });
        if (t >= sec) { finish(); return; }
        raf = requestAnimationFrame(frame);
      };
      const finish = () => { cancelAnimationFrame(raf); raf = 0; active = null; fl.begin(); canvas.style.display = 'none'; onFrame?.({ s: open ? 1 : 0, f: open ? G.to : G.from, clip: open ? 'none' : 'polygon(0 0, 0 0, 0 0)' }); onDone?.(); };
      active = { finish };
      frame(performance.now());
      return true;
    },
    cancel() { if (!active) return; cancelAnimationFrame(raf); raf = 0; active = null; fl.begin(); canvas.style.display = 'none'; },
    dispose() { api.cancel(); fl.dispose(); },
  };
  return api;
}
