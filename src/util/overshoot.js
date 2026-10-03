// R22e: overshoot for the Work page animations (src/work.js). Two tools, both exact at the end (the final value is always the target) and both
// the identity when the amount is 0.
//
// 1. withOvershoot(ease, amount, window): for animations that run on a clock (the snap drift, the toggle morph, the drag release). The main move
//    keeps its shape; a bump (sin^2 over the last `window` share of the time, zero value and zero slope at both ends) is added, so the curve passes
//    the target by about `amount` (of the distance) once and settles back to exactly 1. The base ease must end with zero slope (easeInOutCirc and
//    the morph's own landing do).
// 2. overshootFollower(amount, settleSec): for values that follow a moving target (the focus progress): an underdamped second-order follower
//    whose step response passes the target by `amount` once (damping ratio from the overshoot, frequency from the settle time); amount 0 = the
//    value is the input. Never below 0 (nothing shrinks below its resting size while the focus unwinds).
export const bump = (t, window) => {
  const w = Math.min(Math.max(window, 0.02), 1);
  const u = (t - (1 - w)) / w;
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2;
};

// The bump's height is calibrated (once per ease / amount / window, cached) so that the curve's PEAK is exactly 1 + amount: a plain bump of height
// `amount` would barely clear 1, because the base ease is still short of 1 where the bump is tall. `key` names the ease's own parameters.
const cache = new WeakMap();
export const withOvershoot = (ease, amount, window, key = '') => {
  if (!(amount > 0)) return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : ease(t)); // the old curve, untouched
  const id = `${key}|${amount}|${window}`;
  let hit = cache.get(ease);
  if (!hit) cache.set(ease, (hit = new Map()));
  let A = hit.get(id);
  if (hit.size > 200) hit.clear();
  if (A === undefined) {
    const peak = (h) => { let m = 0; for (let i = 1; i < 240; i++) { const t = i / 240; m = Math.max(m, ease(t) + h * bump(t, window)); } return m; };
    let lo = 0, hi = Math.max(amount * 4, 0.2);
    while (peak(hi) < 1 + amount && hi < 1e3) hi *= 2;
    for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (peak(mid) < 1 + amount) lo = mid; else hi = mid; }
    A = (lo + hi) / 2;
    hit.set(id, A);
  }
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : ease(t) + A * bump(t, window));
};

// 2. settleBump(n): for the focus progress (fP, 0..1, driven by position and by the rest gate, not by a clock). When a value completes its build (reaches
//    1 from below) a short clock starts and the DRAWN value becomes fP + amount * sin^2(pi t): it passes 1 by exactly `amount` once, then settles on
//    exactly 1. The bump fades out as fP leaves 1, so an unwind (new input) starts from the plain value with no pop. amount 0 = the value is fP.
export function settleBump(n) {
  const x = new Float64Array(n), prev = new Float64Array(n), t0 = new Float64Array(n).fill(-1), g = new Float64Array(n); // g: the force latched when the build completed
  return {
    x,
    step(fP, nowMs, amount, settleSec, force = 1) {
      let moving = false;
      for (let i = 0; i < n; i++) {
        const f = fP[i];
        if (f >= 0.999 && prev[i] < 0.999) { t0[i] = nowMs; g[i] = force; } // the build just completed: its force is kept for the whole bump
        prev[i] = f;
        let v = f;
        if (amount * g[i] > 0 && t0[i] >= 0) {
          const t = (nowMs - t0[i]) / 1000 / Math.max(settleSec, 0.05);
          if (t < 1) { v += amount * g[i] * Math.sin(Math.PI * t) ** 2 * Math.min(1, Math.max(0, (f - 0.9) / 0.1)); moving = true; } else t0[i] = -1;
        }
        if (v !== x[i]) moving = true;
        x[i] = v;
      }
      return moving;
    },
  };
}
