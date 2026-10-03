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
