import { HOME_FLIGHT as F, WORK_PTR, LOADER as L } from '../timeline.js';
import { createHomeFlight, isPixel, homeFlightOK } from './home-flight.js';
import { isTall } from '../util/layout-mode.js';
import { createPointerFx } from '../work/pointer-fx.js';

// R49: the loader's ending = the Home <-> Work pixel swipe (home-flight.js 'pixel' look: the Work page's hover smear driven by a synthetic brush) over the whole screen. Picture A = the loader's own
// snapshot (background, digits, top text, drawn by loader.js); the swiped-away cells are TRANSPARENT, so the live homepage (the hero video with its own dim, everything on it) shows through the gaps: no copy of the hero is drawn, so it cannot differ from the settled page. The brush front sweeps left -> right (the counter's travel
// direction); each screen cell flips A -> B behind the front, hidden by the displacement; the grid, block size, strength, RGB split and time are the flight's (HOME_FLIGHT, WORK_PTR). The smear is
// exactly zero at rest: the displacement fades out over the last stretch, so the last frame is the plain video. Time-based (fixed 1/60 s brush steps), same at 60 and 144 Hz.
const FULL = (W, H) => ({ x: 0, y: 0, w: W, h: H });
const REST = { bend: 0, mix: 0 };

// Builds the renderer behind the loader (context, shader, one warm-up draw). Returns null when it cannot be used.
export function prepareSwipe() {
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
      // tall screens: block size / brush / pull in css px (LOADER.swipe*); wide screens: the flight's own numbers
      const tall = isTall(), savedGrid = WORK_PTR.pixelGrid;
      if (tall) WORK_PTR.pixelGrid = Math.max(8, Math.round(W2 / L.swipeBlockPx)); // (pointer-fx reads the grid size from here; put back at the end)
      const cols = Math.max(8, Math.round(WORK_PTR.pixelGrid)), rows = Math.max(4, Math.round((cols * H2) / W2)), zero = new Float32Array(cols * rows * 4);
      let grid = null, simT = 0;
      const fx = createPointerFx({ setPixelFx: (amt, params, data) => { grid = amt ? { data, params } : null; } }, 1);
      const cellPx = W2 / cols, jit = tall ? L.swipeJitterBlocks * cellPx : 0, lo = -cellPx - jit / 2, hi = W2 + cellPx + jit / 2;
      const pull = tall ? Math.max(1, L.swipePullRefW / W2) : 1, frameH = tall ? L.swipeBrushPx / Math.max(WORK_PTR.pixelBrush, 0.01) : H2 * L.brushFrame;
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
          r.setGrid(grid ? grid.data : zero, cols, rows, [WORK_PTR.pixelStrength * pull, WORK_PTR.pixelRgb]);
          r.begin(); r.layer(box, box, REST, REST, [0, 1], { frontPx: frontAt(p), gain, vertical: false, jitterPx: jit, clear: true });
          onProgress?.(p, frontAt(p), cellPx);
          if (first) { first = false; onFirstFrame?.(); }
          if (p >= 1) { WORK_PTR.pixelGrid = savedGrid; dispose(); resolve(); return; }
          requestAnimationFrame(draw);
        };
        draw(performance.now());
      });
    },
  };
}
