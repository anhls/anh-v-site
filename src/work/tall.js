// R24a: the Work page's TALL layout (phones, tablet portrait): side scroll only, a square main image from the short side, cards from `scaleTall`, fewer cards.
// Metrics, the card limits, the stored layouts (src/data/layouts-tall.json, tools/layout-solve-tall.mjs, checked by tools/layout-check.mjs) and the states they
// are solved in (rest only: tall has no mouse drift, no ambient drift, no focus enlarge). Nothing here is read by the wide code.
import { TALL, WORK, LAYOUT_STATES } from '../timeline.js';
import { ruleSignature, sizeKey } from './layout-store.js';

export const TALL_SIZES = [[390, 844], [412, 915], [360, 800], [375, 667], [320, 568], [768, 1024], [820, 1180]];
export const TALL_STATES = { rest: true, drift: 0, focus: false, ambientEnd: false, aura: 0 };
// run fn with LAYOUT_STATES set to the tall states (the shared state / scenario code reads that object); restored afterwards
export const withTallStates = (fn) => { const keep = { ...LAYOUT_STATES }; Object.assign(LAYOUT_STATES, TALL_STATES); try { return fn(); } finally { Object.assign(LAYOUT_STATES, keep); } };

// the square frame's side (px): TALL.frame of the width, the width itself capped for tablets (TALL.baseW x TALL.tabletCap)
export const tallFrame = (W) => TALL.frame * Math.min(W, TALL.baseW * TALL.tabletCap);
export const scaleTall = (W) => tallFrame(W) / TALL.frameRef; // the card size scale (cards are px at 1920 x scale)
export function tallMetrics(W, H) {
  const fs = tallFrame(W), scale = fs / TALL.frameRef;
  const side = { vertical: false, alongF: fs, crossF: fs, scale, gap: (WORK.gapSide / WORK.frameW) * fs, gapPx: (WORK.dupGap * W) / 100, viewAlong: W, viewCross: H };
  return { side, vertical: side }; // (`vertical` only so the load-time fallback pass has both keys; tall has one mode)
}
export const tallLimits = () => ({ minN: Math.min(4, TALL.cardsMax), maxN: TALL.cardsMax, minA: 120000, maxA: 70000 * TALL.cardsMax });

const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
export const tallSignature = () => fnv(`${ruleSignature()}|${JSON.stringify([TALL.cardsMax, TALL.baseW, TALL.tabletCap, TALL.frame, TALL.frameRef, TALL_STATES])}`);

// the stored size for a window: the nearest by width and height (log distance); exact = that size itself, else positions scale with the frame size
export function pickTall(layouts, W, H) {
  const list = TALL_SIZES.filter(([w, h]) => layouts?.work?.[sizeKey(w, h)]);
  if (!list.length || layouts.signature !== tallSignature()) return null;
  const d = ([w, h]) => Math.abs(Math.log(W / w)) + Math.abs(Math.log(H / h));
  const best = list.reduce((a, b) => (d(b) < d(a) ? b : a));
  return { key: sizeKey(best[0], best[1]), exact: best[0] === W && best[1] === H, ratio: tallFrame(W) / tallFrame(best[0]) };
}
