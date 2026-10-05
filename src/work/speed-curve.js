// R24j: the Work page's own speed shaping (the homepage's tanh bend in cards-gl.js is untouched).
// frameAmount: image-warp amount 0..1 from the strip speed in SCREEN LENGTHS per second along the strip (vL). a = (1 - exp(-knee x (v/ref)^pow)) / (1 - exp(-knee)), 1 at ref and above:
// strictly increasing, no flat top below ref. Defaults ref 5, pow 1.4, knee 2: 0.5 L/s .09, 1 .22, 1.5 .36, 2.5 .62, 4 .89, 5 1.0.
export const FRAME_STRENGTH_REF = 1.39; // the strength the shape was drawn at (strength / this = the shape factor k that scales the curl)
export function frameAmount(vL, wp) {
  const x = Math.abs(vL) / Math.max(wp.speedRef, 0.01);
  if (x >= 1) return Math.sign(vL);
  const k = Math.max(wp.speedKnee, 0.01);
  return Math.sign(vL) * ((1 - Math.exp(-k * Math.pow(x, wp.speedPow))) / (1 - Math.exp(-k)));
}
// flingPitches: how many images a touch release (speed in screen lengths per second) glides: a monotone curve through the knots, then a soft approach to the cap (maxCoast pitches)
export const FLING_KNOTS = [[0, 0], [0.5, 0.6], [1, 1.5], [1.5, 2.5], [2.5, 4.5], [4, 7], [6, 9.5], [8, 11]];
export function flingPitches(sL, P) {
  const s = Math.abs(sL), K = FLING_KNOTS;
  const last = K[K.length - 1];
  if (s >= last[0]) { const cap = Math.max(P.dragMaxCoast, last[1]); return last[1] + (cap - last[1]) * (1 - Math.exp(-(s - last[0]) / Math.max(P.flingKnee, 0.1))); }
  let i = 1; while (K[i][0] < s) i++;
  const [x0, y0] = K[i - 1], [x1, y1] = K[i], t = (s - x0) / (x1 - x0);
  return Math.min(y0 + (y1 - y0) * t, P.dragMaxCoast);
}
