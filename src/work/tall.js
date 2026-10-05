// R24a / R24d / R24e: the Work page of the "lite" modes: TALL (phones, tablet portrait) and TABLET LANDSCAPE. One strip of the project images only (cards are a flag:
// TALL.cardsMax / TALL.cardsMaxTablet / TABLET.cards, all 0 now), side scroll only, no toggle, the frame keeps the DESKTOP image ratio (read from WORK.frameW / frameH).
// Metrics, the card limits, the stored layouts (src/data/layouts-tall.json via tools/layout-solve-tall.mjs, src/data/layouts-tablet.json via tools/layout-solve-tablet.mjs, gates
// tools/layout-check-tall.mjs / -tablet.mjs) and the states they are solved in. Nothing here is read by the wide (desktop) code.
import { TALL, TABLET, WORK, LAYOUT_STATES } from '../timeline.js';
import { ruleSignature, sizeKey } from './layout-store.js';

export const TALL_SIZES = [[390, 844], [430, 932], [412, 915], [360, 800], [375, 667], [320, 568], [768, 1024], [820, 1180], [834, 1194], [1024, 1366]];
export const TALL_STATES = { rest: true, drift: 0, focus: false, ambientEnd: false, aura: 0 };
// run fn with LAYOUT_STATES set to the tall states (the shared state / scenario code reads that object); restored afterwards
export const withTallStates = (fn) => { const keep = { ...LAYOUT_STATES }; Object.assign(LAYOUT_STATES, TALL_STATES); try { return fn(); } finally { Object.assign(LAYOUT_STATES, keep); } };

// the desktop frame's ratio (width / height at 1920x1080: WORK.frameW vw x WORK.frameH vh): the one ratio every project image keeps, on every screen
export const frameRatio = () => ((WORK.frameW * 1920) / 100) / ((WORK.frameH * 1080) / 100);
// tablet portrait: the short side is 600 px or more (a phone is under it); one code path, the card count is a separate knob
export const isTabletPortrait = (W, H) => Math.min(W, H) >= 600;
export const cardsMaxFor = (kind, W, H) => (kind === 'tablet' ? TABLET.cards : isTabletPortrait(W, H) ? TALL.cardsMaxTablet : TALL.cardsMax);

// the frame (px): tall = TALL.frame of the viewport width, the height from the desktop ratio; tablet landscape = TABLET.frameH of the viewport height, the width from
// the ratio (never wider than 90 % of the viewport). Centred by the strip.
export function liteFrame(kind, W, H) {
  const r = frameRatio();
  if (kind === 'tablet') { const fw = Math.min(r * TABLET.frameH * H, 0.9 * W); return { w: fw, h: fw / r }; }
  const fw = TALL.frame * W; return { w: fw, h: fw / r };
}
export const liteScale = (kind, W, H) => { const f = liteFrame(kind, W, H); return Math.sqrt(f.w * f.h) / TALL.frameRef; }; // the cards' size scale (only used when cards are on)
// R24f: tall = a VERTICAL strip (the image centred across the width, the gap TALL.gapV of the image height, along = the screen height); tablet / phone landscape = the horizontal strip
export function liteMetrics(kind, W, H) {
  const f = liteFrame(kind, W, H), scale = liteScale(kind, W, H);
  const m = kind === 'tablet'
    ? { vertical: false, alongF: f.w, crossF: f.h, scale, gap: (WORK.gapSide / WORK.frameW) * f.w, gapPx: (WORK.dupGap * W) / 100, viewAlong: W, viewCross: H }
    : { vertical: true, alongF: f.h, crossF: f.w, scale, gap: TALL.gapV * f.h, gapPx: (WORK.dupGap * H) / 100, viewAlong: H, viewCross: W };
  return { side: m, vertical: m }; // (both keys hold the one strip of the mode, so the load-time fallback pass has both)
}
export const liteMode = (kind) => (kind === 'tablet' ? 'side' : 'vertical');
export const tallMetrics = (W, H) => liteMetrics('tall', W, H);
export const tabletMetrics = (W, H) => liteMetrics('tablet', W, H);
export const tallFrame = (W, H = 0) => liteFrame('tall', W, H).w; // (kept for the stored-size ratio)
export const scaleTall = (W, H = 0) => liteScale('tall', W, H);
export const limitsFor = (max) => ({ minN: Math.min(4, max), maxN: max, minA: 120000, maxA: 70000 * max });
export const tallLimits = (W = 390, H = 844) => limitsFor(cardsMaxFor('tall', W, H));
// the card lists of the lite modes: none at all when the limit is 0 (buildProjectCards always keeps one card per project)
export const liteCards = (build, pool, slugs, seed, max) => (max <= 0 ? slugs.map(() => []) : build(pool, slugs, seed, limitsFor(max)));

const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
export const tallSignature = () => fnv(`${ruleSignature()}|${JSON.stringify([TALL.cardsMax, TALL.cardsMaxTablet, TALL.frame, TALL.gapV, TALL.frameRef, frameRatio(), TALL_STATES, 'vertical'])}`);

export const tabletSignature = () => fnv(`${ruleSignature()}|${JSON.stringify([TABLET.cards, TABLET.frameH, frameRatio()])}`);

// the stored size for a window: the nearest by width and height (log distance); exact = that size itself, else positions scale with the frame size
export function pickTall(layouts, W, H) {
  const list = TALL_SIZES.filter(([w, h]) => layouts?.work?.[sizeKey(w, h)]);
  if (!list.length || layouts.signature !== tallSignature()) return null;
  const d = ([w, h]) => Math.abs(Math.log(W / w)) + Math.abs(Math.log(H / h));
  const best = list.reduce((a, b) => (d(b) < d(a) ? b : a));
  return { key: sizeKey(best[0], best[1]), exact: best[0] === W && best[1] === H, ratio: tallFrame(W) / tallFrame(best[0]) };
}

// R24h: the PLANNED LANDING of a flick. At the lift the glide is planned to END on an image: v0 = the release speed (px/s, signed) x flingGain x the curve; the glide covers
// D = target - from in time T along x(t) = from + D x (1 - (1 - t / T)^GLIDE_P): the speed starts at v0 (no jump from the finger) and falls smoothly to exactly 0 on the image
// (no velocity step at the end, no hand-over to the soft snap). The natural end is from + v0 x F (F = TALL.dragFriction); when that is over the cap (TALL.dragMaxCoast pitches)
// F is KEPT and v0 is soft-limited so the distance stays at the cap (the old way shortened F, which stopped the hardest flicks abruptly). The target = the nearest image to the
// natural end, never behind the direction of travel, at least one image on (a deliberate flick moves on); then the glide time F' = D / v0 is kept inside [0.75 F, 1.25 F]
// (outside it the speed is scaled instead), T = GLIDE_P x F'.
export const GLIDE_P = 3.5;
export function flingPlan({ raw, len, pitch, from }, P = TALL) {
  const dir = Math.sign(raw) || 1, shape = Math.pow(Math.max(Math.abs(raw) / len / P.flingRef, 0.05), P.flingPow - 1);
  const F = Math.max(P.dragFriction, 0.05), cap = P.dragMaxCoast * pitch;
  let v = Math.abs(raw) * P.flingGain * shape;
  if (v * F > cap) v = cap / F; // soft limit: keep F, shorten the speed
  const E = from + dir * v * F, k0 = Math.round(from / pitch);
  let k = Math.round(E / pitch);
  if (dir > 0) k = Math.max(k, k0); else k = Math.min(k, k0);
  if (k === k0) k += dir;
  const D = k * pitch - from, Dabs = Math.abs(D);
  const Fe = Math.min(1.25 * F, Math.max(0.75 * F, Dabs / v)), v0 = Dabs / Fe;
  return { v0: dir * v0, D, T: GLIDE_P * Fe, F: Fe, p: GLIDE_P, k, pitches: Dabs / pitch };
}
