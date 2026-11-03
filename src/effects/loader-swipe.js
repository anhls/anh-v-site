import { HOME_FLIGHT as F, WORK_PTR, LOADER as L } from '../timeline.js';
import { createHomeFlight, isPixel, homeFlightOK } from './home-flight.js';
import { isTall } from '../util/layout-mode.js';
import { createPointerFx } from '../work/pointer-fx.js';
import { createMenuSmear, MENU_SWEEP } from './menu-smear.js';

// R49 (phones / tablets in portrait: prepareGlide below = R48's menu-smear.js, the phone menu's own sweep, run mirrored): see there. Wide screens:
// R49: the loader's ending = the Home <-> Work pixel swipe (home-flight.js 'pixel' look: the Work page's hover smear driven by a synthetic brush) over the whole screen. Picture A = the loader's own
// snapshot (background, digits, top text, drawn by loader.js); the swiped-away cells are TRANSPARENT, so the live homepage (the hero video with its own dim, everything on it) shows through the gaps: no copy of the hero is drawn, so it cannot differ from the settled page. The brush front sweeps left -> right (the counter's travel
// direction); each screen cell flips A -> B behind the front, hidden by the displacement; the grid, block size, strength, RGB split and time are the flight's (HOME_FLIGHT, WORK_PTR). The smear is
// exactly zero at rest: the displacement fades out over the last stretch, so the last frame is the plain video. Time-based (fixed 1/60 s brush steps), same at 60 and 144 Hz.
const FULL = (W, H) => ({ x: 0, y: 0, w: W, h: H });
const REST = { bend: 0, mix: 0 };

// Builds the renderer behind the loader (context, shader, one warm-up draw). Returns null when it cannot be used.
export function prepareSwipe() {
  if (isTall()) return prepareGlide();
  if (!homeFlightOK() || !isPixel()) return null;
  const canvas = document.createElement('div'); // (the renderer appends its own canvas here: below the wordmark / nav, above the hero)
  canvas.className = 'loader-swipe';
  document.body.append(canvas);
  const r = createHomeFlight(canvas);
  if (!r) { canvas.remove(); return null; }
  let lost = false;
  r.onLost = () => { lost = true; };
  const W = innerWidth, H = innerHeight;
  r.begin(); r.layer(FULL(W, H), FULL(W, H), REST, REST, [0, 1], { gain: 0 }); // warm-up: the driver compiles / links now, behind the loader
  const dispose = () => { r.dispose(); canvas.remove(); };
  return {
    ok: () => !lost && !r.dead,
    dispose,
    // snap = the loader's 2D canvas, onFirstFrame() runs right after the first frame (identical to the loader) is drawn. Resolves after the last frame.
    play({ snap, onFirstFrame, onProgress }) {
      const W2 = innerWidth, H2 = innerHeight, box = FULL(W2, H2), sec = F.sec;
      r.setPicture(0, snap, 'loader-snap');
      const cols = Math.max(8, Math.round(WORK_PTR.pixelGrid)), rows = Math.max(4, Math.round((cols * H2) / W2)), zero = new Float32Array(cols * rows * 4);
      let grid = null, simT = 0;
      const fx = createPointerFx({ setPixelFx: (amt, params, data) => { grid = amt ? { data, params } : null; } }, 1);
      const cellPx = W2 / cols, lo = -cellPx, hi = W2 + cellPx, frameH = H2 * L.brushFrame;
      const cross = (p) => { const q = Math.min(1, Math.max(0, (p - F.crossFrom) / Math.max(F.crossTo - F.crossFrom, 0.01))); return q * q * (3 - 2 * q); };
      const frontAt = (p) => lo + (hi - lo) * cross(p);
      const stepBrush = (p, dt) => { const f = cross(p), live = f > 0 && f < 1; fx.update({ dt, idx: 0, px: live ? frontAt(p) : NaN, py: live ? H2 / 2 : NaN, W: W2, H: H2, frameH, allowed: true, warp: 0, scale: W2 / 1920, gapAlong: 1e9, vertical: false }); };
      return new Promise((resolve) => {
        const t0 = performance.now();
        let first = true;
        const draw = (now) => {
          let p = Math.min(1, (now - t0) / (sec * 1000));
          if (import.meta.env.DEV && window.__lsAt !== undefined) p = Math.min(0.999, window.__lsAt); // dev checks: freeze the swipe at a progress
          const target = p * sec, SD = 1 / 60;
          while (simT + SD <= target + 1e-6) { simT += SD; stepBrush(Math.min(1, simT / sec), SD); }
          const gain = 1 - Math.min(1, Math.max(0, (p - F.crossTo) / Math.max(1 - F.crossTo, 0.01)));
          r.setGrid(grid ? grid.data : zero, cols, rows, [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb]);
          r.begin(); r.layer(box, box, REST, REST, [0, 1], { frontPx: frontAt(p), gain, vertical: false, clear: true });
          onProgress?.(p, frontAt(p), cellPx);
          if (first) { first = false; onFirstFrame?.(); }
          if (p >= 1) { dispose(); resolve(); return; }
          requestAnimationFrame(draw);
        };
        draw(performance.now());
      });
    },
  };
}

// R49: the PHONE ending = R48's menu-smear.js (the phone menu's open sweep: continuous glide, S-curve, ragged per-row edge, smear zone, pre-warm), run mirrored: the loader is the "panel" and goes away to the right,
// the page (hero video) appears on its left. The loader's own layers stay real DOM and are clipped by the same ragged edge (loader.js applies the rows' edges to them), so there is no snapshot and the live page
// shows through where the loader is gone. Block size = LOADER.swipeBlockPx (css px at the 430 px reference width, like MENU_SWEEP.blockPx; default 28 = the menu's), everything else is the menu's.
function prepareGlide() {
  if (!homeFlightOK()) return null;
  let smear = null;
  const withBlock = (fn) => { const keep = MENU_SWEEP.blockPx; MENU_SWEEP.blockPx = L.swipeBlockPx; try { return fn(); } finally { MENU_SWEEP.blockPx = keep; } };
  try { smear = createMenuSmear(); } catch { smear = null; }
  if (!smear) return null;
  smear.canvas.style.zIndex = '8'; // above the hero, below the wordmark / nav (like the wide swipe's canvas)
  let primedOk = false;
  return {
    glide: true,
    ok: () => !smear.lost,
    dispose: () => smear.dispose(),
    // take the page's pictures (the hero video frame) and draw once with a zero grid: the textures / shader paths are finished before the sweep (call it ~1 s before play; play() uses it if it is under 2.5 s old)
    prime() { withBlock(() => { primedOk = smear.prime(); if (primedOk) smear.warmDraw(); }); },
    // onEdges(edges, rowH) every frame: the ragged edge x (px) of every grid row, the loader is the part to the RIGHT of it. Resolves true after the last frame (false: it could not start).
    play({ onEdges }) {
      return new Promise((resolve) => {
        const ok = withBlock(() => smear.play({ open: true, mirror: true, sec: MENU_SWEEP.openSec, onFrame: ({ edges, rh }) => { if (edges) onEdges(edges, rh); }, onDone: () => { smear.dispose(); resolve(true); } }));
        if (!ok) { smear.dispose(); resolve(false); }
      });
    },
  };
}
