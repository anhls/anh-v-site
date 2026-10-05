// R33 item 6: the pointer smear + distortion trail on the CENTRE project image of the Work v2 page. A small vector field (RG8, WORK_PTR.res cells across) lives in the image's own
// space: moving the pointer over the image pushes the field along the pointer's direction (a gaussian brush), every cell then springs back to exactly 0 (stiffness / damping). The
// picture shader (cards-gl.js, uFx) reads the field to displace the lookup, smear it along the vector and split the colours. Cost: nothing while the pointer is still and the field is
// 0 (no CPU work, no upload, the shader branch is not taken); about 5000 cells while it is moving.
import { WORK_PTR } from '../timeline.js';

export function createPointerFx(gl) {
  let w = 0, h = 0, X, Y, VX, VY, bytes;
  let active = false, gate = 0, lastIdx = -1, lastPx = NaN, lastPy = NaN, ex = 0, ey = 0, sentOff = true, aspect = 1.9;
  const alloc = () => {
    w = Math.max(16, Math.round(WORK_PTR.res)); h = Math.max(9, Math.round(w / 1.9));
    X = new Float32Array(w * h); Y = new Float32Array(w * h); VX = new Float32Array(w * h); VY = new Float32Array(w * h);
    bytes = new Uint8Array(w * h * 4);
    for (let i = 3; i < bytes.length; i += 4) bytes[i] = 255;
    active = false;
  };
  const clear = () => { X.fill(0); Y.fill(0); VX.fill(0); VY.fill(0); active = false; };
  alloc();
  const encode = () => {
    for (let i = 0; i < w * h; i++) { bytes[i * 4] = Math.round(127.5 + 127.5 * Math.max(-1, Math.min(1, X[i]))); bytes[i * 4 + 1] = Math.round(127.5 + 127.5 * Math.max(-1, Math.min(1, Y[i]))); }
  };
  // s = { dt, idx (the centre project), px, py (pointer, screen px, NaN = unknown), rect {x, y, w, h} (the image on screen), allowed, warp (|image warp amount|) }
  const update = (s) => {
    if (!WORK_PTR.on) { if (!sentOff) { clear(); gl.setField(lastIdx, 0, null, null); sentOff = true; } return; }
    if (Math.round(WORK_PTR.res) !== w) alloc();
    const dt = Math.min(s.dt, 0.05);
    if (s.idx !== lastIdx) { clear(); gate = 0; lastIdx = s.idx; ex = ey = 0; } // the field resets on a project swap
    // the gate: 1 while the effect may run, eases to 0 in clickSec otherwise (a click, a drag, the strip moving, a transition)
    gate = s.allowed ? Math.min(1, gate + dt / 0.12) : Math.max(0, gate - dt / Math.max(WORK_PTR.clickSec, 0.02));
    const moved = Number.isFinite(s.px) && (s.px !== lastPx || s.py !== lastPy);
    if (moved && s.allowed && Number.isFinite(lastPx) && dt > 0) {
      const u = (s.px - s.rect.x) / s.rect.w, v = (s.py - s.rect.y) / s.rect.h;
      if (u > -0.1 && u < 1.1 && v > -0.1 && v < 1.1) {
        aspect = s.rect.w / s.rect.h;
        const vx = (s.px - lastPx) / s.rect.w / dt, vy = (s.py - lastPy) / s.rect.h / dt; // image widths / heights per second
        ex += (vx - ex) * 0.5; ey += (vy - ey) * 0.5;
        const sp = Math.hypot(ex * aspect, ey), over = sp - WORK_PTR.startSpeed;
        if (over > 0) {
          const k = Math.min(1, over / Math.max(WORK_PTR.fullSpeed - WORK_PTR.startSpeed, 0.01)) * WORK_PTR.gain, dx = (ex * aspect) / sp, dy = ey / sp, r = Math.max(WORK_PTR.brush, 0.02), inv = 1 / (2 * r * r);
          const j0 = Math.max(0, Math.floor((v - 2.5 * r) * h)), j1 = Math.min(h - 1, Math.ceil((v + 2.5 * r) * h)), i0 = Math.max(0, Math.floor((u - (2.5 * r) / aspect) * w)), i1 = Math.min(w - 1, Math.ceil((u + (2.5 * r) / aspect) * w));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const ddx = ((i + 0.5) / w - u) * aspect, ddy = (j + 0.5) / h - v, wgt = Math.exp(-(ddx * ddx + ddy * ddy) * inv);
            if (wgt < 0.01) continue;
            const c = j * w + i;
            X[c] = Math.max(-1, Math.min(1, X[c] + dx * k * wgt)); Y[c] = Math.max(-1, Math.min(1, Y[c] + dy * k * wgt));
          }
          active = true;
        }
      }
    } else if (!moved) { ex *= 0.8; ey *= 0.8; }
    if (Number.isFinite(s.px)) { lastPx = s.px; lastPy = s.py; }
    // the springs: every cell back to exactly 0
    if (active) {
      const k = WORK_PTR.stiffness, c = WORK_PTR.damping, steps = Math.max(1, Math.ceil(dt / 0.008)), hh = dt / steps;
      let any = false;
      for (let i = 0; i < w * h; i++) {
        let x = X[i], y = Y[i], vx = VX[i], vy = VY[i];
        if (x === 0 && y === 0 && vx === 0 && vy === 0) continue;
        for (let q = 0; q < steps; q++) { vx += (-k * x - c * vx) * hh; vy += (-k * y - c * vy) * hh; x += vx * hh; y += vy * hh; }
        if (Math.abs(x) < 0.002 && Math.abs(y) < 0.002 && Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) { x = y = vx = vy = 0; } else any = true;
        X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy;
      }
      active = any;
      encode();
    }
    // hand it to the picture shader. Capped together with the scroll warp: the effect fades out as the warp grows (the sum never passes the warp's own clamp, no new fold is possible: the
    // displacement is inside the picture's own lookup, clamped at its edges).
    if (active && gate === 0 && !s.allowed) { clear(); encode(); } // eased out: the field is dropped (the next frame sends the zero field once)
    const amt = active ? Math.max(1e-4, gate * Math.max(0, 1 - Math.min(1, s.warp * WORK_PTR.warpCap))) : 0;
    if (active) { gl.setField(lastIdx, amt, [WORK_PTR.strength, WORK_PTR.smear, WORK_PTR.rgb, 0], bytes, w, h); sentOff = false; }
    else if (!sentOff) { encode(); gl.setField(lastIdx, 0, null, bytes, w, h); sentOff = true; }
  };
  return { update, get active() { return active; }, get gate() { return gate; } };
}
