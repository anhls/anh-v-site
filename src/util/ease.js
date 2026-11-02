// R22f: the Work page's shared ease curves (snap drift, focus build, toggle morph). WORK.easeType picks the curve, WORK.easeSoftness (0..1)
// blends it with a straight line (0 = the pure curve, 1 = linear). The blend fades out over the last SOFT_END of the time, so the curve still
// ends with zero slope (the overshoot helper needs that) and exactly on 1; softness 0 is the pure curve untouched.
const SOFT_END = 0.25;
export const EASES = {
  expoOut: (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  circ: (t) => (t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  quad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

// blendSoft(curve, softness): the curve pulled toward a "steady" curve by `softness`: constant speed that only brakes over the last SOFT_END of the
// time (speed 1 until 1 - SOFT_END, then falling to 0 on a smoothstep). Blending the SPEED keeps the result single-peaked (speed rises once, then
// falls: no dip, R22h) and ending with zero slope, exactly on 1. Returns `curve` itself at 0.
const T0 = 1 - SOFT_END, KC = 1 / (T0 + SOFT_END / 2);
const steady = (t) => { if (t <= T0) return KC * t; const u = (t - T0) / SOFT_END; return KC * (T0 + SOFT_END * (u - u * u * u + (u * u * u * u) / 2)); };
export const blendSoft = (curve, softness) => {
  const s = Math.min(Math.max(softness, 0), 1);
  if (!(s > 0)) return curve;
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : curve(t) * (1 - s) + steady(t) * s);
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

// Work project expansion: finish the cubic move early, then hold for the settling overshoot.
const heldCubics = new Map();
export const heldCubic = (landAt) => {
  const end = Math.max(0.01, Math.min(1, landAt));
  if (!heldCubics.has(end)) {
    if (heldCubics.size > 64) heldCubics.clear();
    heldCubics.set(end, t => t <= 0 ? 0 : t >= end ? 1 : EASES.cubic(t / end));
  }
  return heldCubics.get(end);
};
