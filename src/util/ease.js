// R22f: the Work page's shared ease curves (snap drift, focus build, toggle morph). WORK.easeType picks the curve, WORK.easeSoftness (0..1)
// blends it with a straight line (0 = the pure curve, 1 = linear). The blend fades out over the last SOFT_END of the time, so the curve still
// ends with zero slope (the overshoot helper needs that) and exactly on 1; softness 0 is the pure curve untouched.
const SOFT_END = 0.25;
export const EASES = {
  circ: (t) => (t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  quad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

// blendSoft(curve, softness): the same curve, pulled toward a straight line by `softness` except near the end. Returns `curve` itself at 0.
export const blendSoft = (curve, softness) => {
  const s = Math.min(Math.max(softness, 0), 1);
  if (!(s > 0)) return curve;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const u = Math.min(Math.max((t - (1 - SOFT_END)) / SOFT_END, 0), 1);
    const m = s * (1 - u * u * (3 - 2 * u)); // blend weight: s, then smoothly 0 at the end
    return curve(t) * (1 - m) + t * m;
  };
};

// workEase(WORK): the shared curve for the current settings. Cached per type + softness (the overshoot helper caches by function identity).
const made = new Map();
export const workEase = (W) => {
  const type = EASES[W.easeType] ? W.easeType : 'sine';
  const key = `${type}|${W.easeSoftness}`;
  let f = made.get(key);
  if (!f) {
    if (made.size > 64) made.clear();
    made.set(key, (f = blendSoft(EASES[type], W.easeSoftness)));
  }
  return f;
};

// R22g: overshoot force from the move's own speed. peakSpeed = distance x the ease's steepest slope / duration (px/s at the 1920 reference).
// force = smoothstep((peakSpeed - forceFrom) / (forceTo - forceFrom)); forceTo <= forceFrom is a hard step at forceFrom (0, 0 = always 1, the old
// fixed behaviour). The overshoot amount of every Work animation is its base amount x force.
const slopes = new WeakMap();
export const maxSlope = (curve) => {
  let s = slopes.get(curve);
  if (s === undefined) { s = 0; for (let i = 1; i <= 400; i++) s = Math.max(s, (curve(i / 400) - curve((i - 1) / 400)) * 400); slopes.set(curve, s); }
  return s;
};
export const forceOf = (peakSpeed, W) => {
  const a = W.forceFrom, b = W.forceTo;
  if (!(b > a)) return peakSpeed >= a ? 1 : 0;
  const u = Math.min(Math.max((peakSpeed - a) / (b - a), 0), 1);
  return u * u * (3 - 2 * u);
};
export const moveForce = (distPx, scale, curve, sec, W) => forceOf((Math.abs(distPx) / Math.max(scale, 1e-6) * maxSlope(curve)) / Math.max(sec, 0.05), W);

// The card settle after the toggle: a shove = a velocity added over a short smooth ramp (KICK_RAMP s, so there is no speed step) to a spring (k, c).
// kickWeight(t) = the share of the shove given by time t; peakPerKick(k, c) = how far a unit shove takes the card (simulated once, cached).
export const KICK_RAMP = 0.14;
export const kickWeight = (t) => { const u = Math.min(Math.max(t / KICK_RAMP, 0), 1); return u * u * (3 - 2 * u); };
const kicks = new Map();
export const peakPerKick = (k, c) => {
  const key = `${k}|${c}`;
  let p = kicks.get(key);
  if (p === undefined) {
    // simulated the way work.js steps it: 8 ms frames, the shove added at the frame start, two 4 ms spring sub-steps
    let x = 0, v = 0, m = 0, w0 = 0;
    for (let t = 0; t < 8; t += 0.008) { const w = kickWeight(t + 0.008); v += w - w0; w0 = w; for (let q = 0; q < 2; q++) { v += (k * (0 - x) - c * v) * 0.004; x += v * 0.004; if (x > m) m = x; } }
    kicks.set(key, (p = m));
  }
  return p;
};
