import { HOME_FLIGHT as F, WORK_PTR } from '../timeline.js';
import { createHomeFlight, firstCardRect } from './home-flight.js';
import { createPointerFx } from '../work/pointer-fx.js';

// R48 round 6: the phone menu's open / close = the Home -> Work flight's PIXEL SWIPE, sideways. Nothing new is drawn here: the renderer is the flight's (home-flight.js, look 'pixel' = the Work hover-smear grid
// in SCREEN space: WORK_PTR.pixelGrid columns across the width, so one block is the same number of CSS px as in the flight; block shift = pixelStrength, RGB split = pixelRgb, relax = pixelRelax) and the brush is
// the flight's synthetic brush (pointer-fx.js, fixed 1/60 s steps) except that it is a full-height VERTICAL BAND (`band`) sweeping left -> right on open, right -> left on close.
// What is smeared: the page's own pictures under the band (the hero video on Home, the Work cards, the media of a project page), taken from the DOM at the moment of the tap. A cell the brush has not touched stays
// transparent (= the page itself: smear exactly 0 at rest); a cell the band has passed shows the panel colour (open) / the page picture (close). The panel is clipped to the same cell columns (tall-menu.js).
const MAX_SRC = 5, SD = 1 / 60;
const smooth = (q) => { q = Math.min(1, Math.max(0, q)); return q * q * (3 - 2 * q); };
export const unsmooth = (s) => { s = Math.min(1, Math.max(0, s)); let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (smooth(m) < s) lo = m; else hi = m; } return (lo + hi) / 2; };
// the sweep time of the open (the flight's own cross-fade stretch), the close is twice as fast
export const MENU_SWEEP = { openSec: F.sec * (F.crossTo - F.crossFrom), closeDiv: 2 };
export const gridBlockPx = (W = innerWidth) => W / Math.max(8, Math.round(WORK_PTR.pixelGrid)); // one smear block in CSS px (the flight uses the same grid)

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
  const canvas = fl.canvas, BG = MAX_SRC;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:49;display:none';
  const bgc = document.createElement('canvas'); bgc.width = bgc.height = 4;
  let raf = 0, zero = null, active = null;
  fl.onLost = () => { api.lost = true; };
  const api = {
    lost: false,
    get playing() { return !!active; },
    // open = true: band left -> right, page -> panel colour; false: right -> left, panel colour -> page. sec = the sweep time. bg = the panel colour (css).
    // onEdge(px) = the panel's visible width in px (whole cells; W = all of it, 0 = none) every frame, onDone() after the last frame. Returns false when it could not start (the caller then fades).
    play({ open, sec, bg, onEdge, onDone }) {
      if (api.lost || fl.dead) return false;
      api.cancel();
      const src = collectSources();
      const x = bgc.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 4, 4);
      src.forEach((s, i) => { s.slot = i; fl.setPicture(i, s.el); });
      fl.setPicture(BG, bgc);
      const W = innerWidth, H = innerHeight, cols = Math.max(8, Math.round(WORK_PTR.pixelGrid)), rows = Math.max(4, Math.round((cols * H) / W)), cell = W / cols, lo = -cell, hi = W + cell;
      if (!zero || zero.length !== cols * rows * 4) zero = new Float32Array(cols * rows * 4);
      let grid = null, simT = 0;
      const fx = createPointerFx({ setPixelFx: (amt, params, data) => { grid = amt ? { data, params } : null; } }, 1);
      const frameH = firstCardRect(W, H).h, tail = open ? 0 : sec * (1 - F.crossTo) / (F.crossTo - F.crossFrom), total = sec + tail;
      const alongAt = (t) => lo + (hi - lo) * smooth(t / sec); // the front along the sweep (0.. W): x for the open, W - x for the close
      const step = (t) => { const live = t > 0 && t < sec, a = alongAt(t); fx.update({ dt: SD, idx: 0, px: live ? (open ? a : W - a) : NaN, py: H / 2, W, H, frameH, allowed: true, warp: 0, scale: W / 1920, gapAlong: 1e9, vertical: false, band: true }); };
      canvas.style.display = 'block';
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(total, (now - t0) / 1000);
        while (simT + SD <= t + 1e-6) { simT += SD; step(Math.min(sec, simT)); }
        const a = alongAt(t), gain = t <= sec ? 1 : 1 - Math.min(1, (t - sec) / Math.max(tail, 1e-3));
        fl.begin();
        fl.setGrid(grid ? grid.data : zero, cols, rows, grid ? grid.params : [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb]);
        const fo = { frontPx: open ? a : a - W, gain, vertical: false, flip: !open, skipZero: true }, still = { bend: 0, mix: 0 };
        src.forEach((s) => fl.layer(s.box, s.box, still, still, open ? [s.slot, BG] : [BG, s.slot], fo));
        // the panel: the columns that are on the panel side of the front (open: behind it; close: ahead of it)
        const lim = open ? a : W - a; let n = 0; while (n < cols && (n + 0.5) * cell < lim) n++;
        onEdge?.(t >= sec ? (open ? W : 0) : n * cell);
        if (t >= total) { finish(); return; }
        raf = requestAnimationFrame(frame);
      };
      const finish = () => { cancelAnimationFrame(raf); raf = 0; active = null; fl.begin(); canvas.style.display = 'none'; onDone?.(); };
      active = { finish };
      frame(performance.now());
      return true;
    },
    cancel() { if (!active) return; cancelAnimationFrame(raf); raf = 0; active = null; fl.begin(); canvas.style.display = 'none'; },
    dispose() { api.cancel(); fl.dispose(); },
  };
  return api;
}
