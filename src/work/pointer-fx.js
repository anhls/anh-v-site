// R33b item 2: the Codrops pixel-distortion method on the Work v2 strip (https://tympanus.net/codrops/2022/01/12/pixel-distortion-effect-with-three-js/). ONE low-resolution grid in
// SCREEN space covers the whole page (a sweep over a gap carries onto the next picture): each cell holds an x / y displacement; the cells within the brush radius of the pointer take
// the pointer's velocity, every cell relaxes by pixelRelax per 1/60 s and snaps to exactly 0 under an epsilon. The picture shader (cards-gl.js, uFx / uGrid) moves each lookup by
// strength x the cell's value, so the picture breaks into blocky steps; pixels pushed past a picture's edge may spill onto a margin (uPad) around it. Cost: nothing while the
// pointer is still and the grid is 0 (no CPU work, no upload, the shader branch is not taken); about 600 cells while it is moving.
import { WORK_PTR } from '../timeline.js';

export function createPointerFx(gl, N) {
  let cols = 0, rows = 0, data = null, X = null, Y = null, W = 0, H = 0;
  let active = false, gate = 0, lastIdx = -1, lastPx = NaN, lastPy = NaN, sentOff = true;
  const amt = new Float32Array(N);
  const alloc = (w, h) => {
    W = w; H = h; cols = Math.max(8, Math.round(WORK_PTR.pixelGrid)); rows = Math.max(4, Math.round((cols * h) / w));
    X = new Float32Array(cols * rows); Y = new Float32Array(cols * rows); data = new Float32Array(cols * rows * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 1;
    active = false; sentOff = false; // (a new size: the next frame sends a zero grid once)
  };
  const clear = () => { X.fill(0); Y.fill(0); data.fill(0); for (let i = 3; i < data.length; i += 4) data[i] = 1; active = false; };
  // s = { dt, idx (the centre project), px, py (pointer, screen px, NaN = unknown), W, H (screen px), frameH (image height px), allowed, warp (|image warp amount|), scale (screen scale 0..1),
  //       gapAlong (px between two pictures along the strip), vertical }
  const update = (s) => {
    if (!WORK_PTR.on) { if (!sentOff && data) { clear(); gl.setPixelFx(null); sentOff = true; } return; }
    if (!data || s.W !== W || s.H !== H || Math.round(WORK_PTR.pixelGrid) !== cols) alloc(s.W, s.H);
    const dt = Math.min(s.dt, 0.05);
    if (s.idx !== lastIdx) { clear(); gate = 0; lastIdx = s.idx; } // the grid resets on a project swap
    gate = s.allowed ? Math.min(1, gate + dt / 0.12) : Math.max(0, gate - dt / Math.max(WORK_PTR.clickSec, 0.02)); // eases out in clickSec on a press / drag / transition / the strip moving
    const moved = Number.isFinite(s.px) && Number.isFinite(lastPx) && (s.px !== lastPx || s.py !== lastPy);
    if (moved && s.allowed && dt > 0) {
      // the pointer's velocity as a share of the screen width per frame (x100, as the Codrops demo), clamped so a fast flick cannot tear the picture
      const k = (100 * 1) / s.W, vmax = WORK_PTR.pixelVelMax;
      const vx = Math.max(-vmax, Math.min(vmax, (s.px - lastPx) * k)), vy = Math.max(-vmax, Math.min(vmax, (s.py - lastPy) * k));
      if (Math.abs(vx) + Math.abs(vy) > 1e-4) {
        const cw = s.W / cols, ch = s.H / rows, r = Math.max(WORK_PTR.pixelBrush * s.frameH, Math.min(cw, ch) * 0.75);
        const c0 = Math.max(0, Math.floor((s.px - r) / cw)), c1 = Math.min(cols - 1, Math.floor((s.px + r) / cw)), r0 = Math.max(0, Math.floor((s.py - r) / ch)), r1 = Math.min(rows - 1, Math.floor((s.py + r) / ch));
        for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
          const dx = (i + 0.5) * cw - s.px, dy = (j + 0.5) * ch - s.py, d = Math.hypot(dx, dy);
          if (d >= r) continue;
          const pw = 1 - d / r, c = j * cols + i; // (Codrops: the nearer to the pointer, the more of its velocity)
          X[c] = Math.max(-vmax, Math.min(vmax, X[c] + vx * pw)); Y[c] = Math.max(-vmax, Math.min(vmax, Y[c] + vy * pw));
        }
        active = true;
      }
    }
    if (Number.isFinite(s.px)) { lastPx = s.px; lastPy = s.py; }
    if (active) { // relaxation, frame-rate independent: pixelRelax per 1/60 s
      const f = Math.pow(WORK_PTR.pixelRelax, dt * 60);
      let any = false;
      for (let c = 0; c < cols * rows; c++) {
        let x = X[c] * f, y = Y[c] * f;
        if (Math.abs(x) < 0.003 && Math.abs(y) < 0.003) { x = 0; y = 0; } else any = true;
        X[c] = x; Y[c] = y; data[c * 4] = x; data[c * 4 + 1] = y;
      }
      active = any;
    }
    if (active && gate === 0 && !s.allowed) { clear(); } // eased out: dropped (the next frame sends the zero grid once)
    if (active) {
      const warpF = Math.max(0, 1 - Math.min(1, s.warp * WORK_PTR.warpCap)) * gate; // capped together with the scroll warp
      for (let i = 0; i < N; i++) amt[i] = warpF * (i === s.idx ? 1 : WORK_PTR.pixelSideMul);
      // the spill margin: pixelSpill px (x the screen scale) across the strip; along the strip at most half the gap to the next picture, so two pictures never draw over each other
      const sp = WORK_PTR.pixelSpill * s.scale, along = Math.max(0, Math.min(sp, s.gapAlong / 2 - 1));
      gl.setPixelFx(amt, [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb], data, cols, rows, s.vertical ? [sp, along] : [along, sp]);
      sentOff = false;
    } else if (!sentOff) { gl.setPixelFx(null); sentOff = true; }
  };
  return { update, get active() { return active; }, get gate() { return gate; }, get cells() { return cols * rows; } };
}
