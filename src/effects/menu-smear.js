import { HOME_FLIGHT as F, WORK_PTR } from '../timeline.js';
import { TALL_MENU as TM } from '../settings/tall.js';
import { gsap } from 'gsap';
import { createHomeFlight } from './home-flight.js';

// R48 rounds 6 + 7: the phone menu's open / close = the Home -> Work flight's PIXEL SWIPE language, sideways. The renderer is the flight's (home-flight.js, look 'pixel': the Work hover-smear grid in SCREEN
// space, WORK_PTR.pixelGrid columns across the width, so one block is the same number of CSS px as in the flight; block shift = pixelStrength, RGB split = pixelRgb). What is new is only how the grid is
// filled: not a brush simulation but a SMEAR ZONE that travels with the panel's edge:
//   - the panel's edge is RAGGED PER ROW: every grid row has its own offset (noise), the edges snapped to whole cells (tall-menu.js clips the panel with the polygon this module returns);
//   - ahead of the edge (the page side) a zone TM.zoneShare of the width wide: the page's own pictures are pulled sideways in blocks (a per-cell offset with noise), strongest at the edge, fading to exactly 0
//     at the zone's leading edge; a cell the zone does not touch stays transparent = the page itself (smear exactly 0 at rest).
//   - open: the edge sweeps left -> right; close: the exact reverse (right -> left), the sweep time is given by the caller (the close is twice as fast).
// What is smeared: the page's pictures taken from the DOM at the tap (the hero video on Home, the Work cards, the media of a project page). Everything is time-based.
const MAX_SRC = 5, PRIME_MAX_AGE = 2500;
const smooth = (q) => { q = Math.min(1, Math.max(0, q)); return q * q * (3 - 2 * q); };
export const unsmooth = (s) => { s = Math.min(1, Math.max(0, s)); let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (smooth(m) < s) lo = m; else hi = m; } return (lo + hi) / 2; };
// R48 r15: the band front follows MENU_SWEEP.ease over the sweep (default 'power2.inOut' = smooth start, fast middle, smooth landing; Anh can try 'none' = linear or 'power2.out' = starts with speed, the r14 look).
// Open: s = ease(u); close: s = 1 - ease(u) (the exact reverse). sweepInv() is the inverse (for frontTime()). Each block's pull follows the same curve of its distance to the front (see the frame loop).
const easeFn = () => (MENU_SWEEP.ease && MENU_SWEEP.ease !== 'none' ? gsap.parseEase(MENU_SWEEP.ease) : (x) => x);
export const sweepEase = (u) => easeFn()(Math.min(1, Math.max(0, u)));
export const sweepInv = (s) => { const E = easeFn(); s = Math.min(1, Math.max(0, s)); let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (E(m) < s) lo = m; else hi = m; } return (lo + hi) / 2; };
export const outEase = sweepEase; // (the page's wordmark small <-> big moves with the same curve)
// the sweep time of the open (the flight's own cross-fade stretch), the close is twice as fast
// R48 r9: the MENU has its own block size (blockPx, css px at the 430 px reference width, scaling with the screen width; ~4 columns across a phone), no longer the flight's grid
export const MENU_SWEEP = { openSec: F.sec * (F.crossTo - F.crossFrom), closeDiv: TM.closeSpeed || 2, blockPx: 28, ease: 'power2.inOut', glide: 1.3, lead: 0.8 };
try { const q = new URLSearchParams(location.search).get('ease'); if (q) MENU_SWEEP.ease = q; } catch { /* */ } // ?ease=none | power2.out | power2.inOut ... to try another curve on a phone // glide = the largest pull of a block, in block widths; lead = where the front starts, as a share of the zone width off the left edge (1 = the whole zone off-screen: with an S-curve that is a dead stretch at the start) // R48 r15: 56 -> 28 (about 15 across a phone)
export const gridCols = () => Math.max(2, Math.round(430 / Math.max(8, MENU_SWEEP.blockPx))); // whole columns across the screen
export const gridBlockPx = (W = innerWidth) => W / gridCols(); // one smear block in CSS px (the flight uses the same grid)
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// the geometry of the sweep for a screen width: the mean edge position f runs from -zone (all of it off the left side) to W + jag (all of it off the right side)
export const sweepGeom = (W = innerWidth) => { const cell = gridBlockPx(W), zone = Math.max(1, Math.round((TM.zoneShare * W) / cell)) * cell, jag = Math.max(1, Math.round((TM.jagCells * 56) / MENU_SWEEP.blockPx)) * cell; /* (TM.jagCells counts the old 56 px blocks: the ragged edge keeps its width in px when the blocks shrink) */ return { cell, zone, jag, from: -zone * MENU_SWEEP.lead, to: W + jag }; };
export const frontAt = (s, W = innerWidth) => { const g = sweepGeom(W); return g.from + (g.to - g.from) * s; }; // s = the open-equivalent progress 0..1 (eased)
export const frontTime = (x, sec, W = innerWidth) => { const g = sweepGeom(W); return sweepInv((x - g.from) / (g.to - g.from)) * sec; }; // when (s into the open sweep) the mean edge reaches x

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
  const stats = { frames: 0, avgMs: 0, maxMs: 0, last: 0, long: 0, first3: [], tapToFirst: null, primeMs: null, primedAgo: null, usedPrimed: false };
  let primed = null, unwarmT = 0;
  fl.onLost = () => { api.lost = true; };
  const api = {
    lost: false, stats, lastOpen: null,
    // R48 r12: everything that costs is done BEFORE the tap: prime() takes the page snapshot (the on-screen pictures; images are uploaded once per file, the hero / card video frame at every call) and is called on idle,
    // on pointerdown of the burger and never in the tap frame. play() uses a snapshot at most PRIME_MAX_AGE ms old; with none it takes it itself.
    prime() {
      if (api.lost || fl.dead || active) return false;
      const t = performance.now(), src = collectSources();
      src.forEach((q, i) => { q.slot = i; fl.setPicture(i, q.el, q.el.tagName === 'IMG' ? q.el.currentSrc || q.el.src : undefined); });
      primed = { src, t: performance.now() }; stats.primeMs = performance.now() - t;
      // the canvas layer is created BEFORE the tap (display:block at opacity 0, drawn once clear): the tap only sets opacity 1; released again when no sweep follows
      canvas.style.display = 'block'; canvas.style.opacity = '0'; clearTimeout(unwarmT); unwarmT = setTimeout(() => { if (!active) { canvas.style.display = 'none'; canvas.style.opacity = ''; } }, 2500);
      return true;
    },
    // one throw-away draw with a zero grid: the shader / texture paths are finished before the first real frame (does nothing visible: the canvas stays display:none)
    warmDraw() {
      if (api.lost || fl.dead || active || !primed) return;
      try { const cols = gridCols(), rows = Math.max(4, Math.round((cols * innerHeight) / innerWidth)), g = new Float32Array(cols * rows * 4); for (let i = 3; i < g.length; i += 4) g[i] = 1; fl.begin(); fl.setGrid(g, cols, rows, [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb]); primed.src.forEach((q) => fl.layer(q.box, q.box, { bend: 0, mix: 0 }, { bend: 0, mix: 0 }, [q.slot, q.slot], { frontPx: -1e9, gain: 1, skipZero: false, glide: true })); fl.begin(); } catch { /* */ }
    },
    get playing() { return !!active; },
    get canvas() { return canvas; }, // R49: the loader sits this layer between the hero and the wordmark (z-index)
    get dpr() { return canvas.width / Math.max(1, innerWidth); },
    // open = true: the edge sweeps left -> right; false: right -> left (the exact reverse). sec = the sweep time; delay = seconds to wait first (the panel stays whole).
    // onFrame({ s, f, clip }) every frame: s = the open-equivalent progress 0..1, f = the mean edge x (px), clip = the panel's clip-path (css string); onDone() after the last frame.
    // R49 mirror = true (the loader's ending, open only): the sweep is the same but the PANEL is the part RIGHT of the edge and goes away (the page appears on its left): the smear zone trails the edge on the page side,
    // the blocks under the panel keep the full pull. onFrame also gets edges (the ragged edge x of every row, px) and rh (row height) so the caller can clip its own layers.
    play({ open, sec, delay = 0, onFrame, onDone, tapT, mirror = false }) {
      if (api.lost || fl.dead) return false;
      api.cancel();
      const tPlay = performance.now(); let src;
      if (primed && tPlay - primed.t < PRIME_MAX_AGE) { src = primed.src; stats.usedPrimed = true; stats.primedAgo = Math.round(tPlay - primed.t); } else { stats.usedPrimed = false; stats.primedAgo = null; src = collectSources(); src.forEach((q, i) => { q.slot = i; fl.setPicture(i, q.el, q.el.tagName === 'IMG' ? q.el.currentSrc || q.el.src : undefined); }); }
      primed = null; stats.first3 = []; stats.frameT = []; stats.tapToFirst = null;
      const W = innerWidth, H = innerHeight, G = sweepGeom(W), cols = gridCols(), rows = Math.max(4, Math.round((cols * H) / W)), cell = W / cols, rh = H / rows;
      const grid = new Float32Array(cols * rows * 4); for (let i = 3; i < grid.length; i += 4) grid[i] = 1;
      const rowOff = Array.from({ length: rows }, (_, r) => hash(r * 1.913 + 4.1)); // 0..1: how far behind the mean edge each row's own edge sits
      if (mirror) G.to += G.zone; // the zone trails the edge here: the sweep runs on until the zone has left the screen too, so the smear ends at exactly 0 (no pop when the layer is removed)
      const dir = open ? 1 : -1, amp = WORK_PTR.pixelVelMax;
      clearTimeout(unwarmT); canvas.style.display = 'block'; canvas.style.opacity = '1';
      stats.frames = 0; stats.avgMs = 0; stats.maxMs = 0; stats.last = 0; stats.long = 0;
      const t0 = performance.now() + delay * 1000;
      let nFr = 0;
      const frame = (now) => {
        if (tapT && stats.frameT.length < 4) stats.frameT.push(+(performance.now() - tapT).toFixed(1));
        if (tapT) { if (nFr === 0) stats.tapSync = +(performance.now() - tapT).toFixed(1); else if (nFr === 1) stats.tapToFirst = +(performance.now() - tapT).toFixed(1); } nFr++;
        if (stats.last) { const ms = now - stats.last; if (stats.first3.length < 3) stats.first3.push(+ms.toFixed(1)); stats.frames++; stats.avgMs += (ms - stats.avgMs) / stats.frames; stats.maxMs = Math.max(stats.maxMs, ms); if (ms > 20) stats.long++; } stats.last = now;
        let t = (now - t0) / 1000;
        if (import.meta.env.DEV && mirror && window.__lsAt !== undefined) t = Math.min(0.999, window.__lsAt) * sec; // dev checks: freeze the loader's swipe at a progress
        const u = Math.min(1, Math.max(0, t / sec)), s = open ? sweepEase(u) : 1 - sweepEase(u), f = G.from + (G.to - G.from) * s;
        const waiting = t < 0;
        const pts = [], edges = []; let nZero = 0, nFull = 0;
        grid.fill(0); for (let i = 3; i < grid.length; i += 4) grid[i] = 1;
        // R48 r15: ALL MOTION IS CONTINUOUS and every block GLIDES. Row edges = the mean front minus a continuous per-row offset; a block's pull (in block widths, sub-pixel) = MENU_SWEEP.glide * ease(1 - distance to its row's edge / zone):
        // the same S-curve as the front, so the blocks ease into and out of their slide; the blocks behind the edge (hidden by the panel) keep the full pull so no gap opens at the panel's edge.
        const E = easeFn();
        for (let r = 0; r < rows; r++) {
          const eu = f - G.jag * rowOff[r], e = Math.max(0, Math.min(W, eu));
          if (e <= 0) nZero++; if (e >= W) nFull++; edges.push(e);
          pts.push(`${e.toFixed(2)}px ${(r * rh).toFixed(2)}px`, `${e.toFixed(2)}px ${((r + 1) * rh).toFixed(2)}px`);
          for (let c = mirror ? 0 : Math.max(0, Math.floor(eu / cell) - 3); c < cols; c++) {
            const x = (c + 0.5) * cell, d = Math.max(0, mirror ? eu - x : x - eu);
            if (mirror && x > eu + 3 * cell) break; // (beyond the panel's hidden stretch: nothing to draw)
            if (d >= G.zone) { if (mirror) continue; break; }
            const v = MENU_SWEEP.glide * E(1 - d / G.zone) * (0.45 + 0.55 * hash(c * 3.17 + r * 7.71)) * (0.6 + 0.4 * rowOff[r]);
            grid[(r * cols + c) * 4] = dir * v;
          }
        }
        if (window.__smTrace) { const rr = window.__smTrace.row ?? Math.floor(rows / 2), cc = window.__smTrace.col ?? Math.floor(cols / 2); (window.__smTrace.pts ||= []).push([+now.toFixed(1), +(cc * cell + grid[(rr * cols + cc) * 4] * cell).toFixed(3)]); }
        fl.begin();
        if (!waiting) {
          fl.setGrid(grid, cols, rows, [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb]);
          const fo = { frontPx: -1e9, gain: 1, vertical: false, flip: false, skipZero: true, glide: true }, still = { bend: 0, mix: 0 };
          src.forEach((q) => fl.layer(q.box, q.box, still, still, [q.slot, q.slot], fo));
        }
        const clip = nFull === rows ? 'none' : nZero === rows ? 'polygon(0 0, 0 0, 0 0)' : `polygon(0 0, ${pts.join(', ')}, 0 ${H}px)`;
        onFrame?.({ s: waiting ? (open ? 0 : 1) : s, f: waiting ? (open ? G.from : G.to) : f, clip: waiting ? (open ? 'polygon(0 0, 0 0, 0 0)' : 'none') : clip, edges, rh });
        if (t >= sec) { finish(); return; }
        raf = requestAnimationFrame(frame);
      };
      const finish = () => { if (open) api.lastOpen = { tapSync: stats.tapSync, tapToFirst: stats.tapToFirst, first3: stats.first3.slice(), frameT: (stats.frameT || []).slice(), usedPrimed: stats.usedPrimed, primedAgo: stats.primedAgo, primeMs: stats.primeMs }; cancelAnimationFrame(raf); raf = 0; active = null; fl.begin(); canvas.style.display = 'none'; onFrame?.({ s: open ? 1 : 0, f: open ? G.to : G.from, clip: open ? 'none' : 'polygon(0 0, 0 0, 0 0)' }); onDone?.(); };
      active = { finish };
      frame(performance.now());
      return true;
    },
    cancel() { if (!active) return; cancelAnimationFrame(raf); raf = 0; active = null; fl.begin(); canvas.style.display = 'none'; },
    dispose() { api.cancel(); fl.dispose(); },
  };
  return api;
}
