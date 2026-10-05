// R29: the stored card layouts (src/data/layouts.json, written by tools/layout-solve.mjs, verified by tools/layout-check.mjs). The Work page just reads them:
// no layout work at load. Positions are px at the real window size of the size they were solved for (WxH key), along / cross per card per mode.
import { WORK, CARDS, BAND_RULES, LAYOUT_STATES, CARD_SIZE, WORK_LIMITS } from '../timeline.js';
import { slugSeed } from './states.js';

export const SIZES = { '16:9': [[1920, 1080], [2560, 1440], [3840, 2160]], '16:10': [[1440, 900], [1512, 982], [1728, 1117]] };
export const sizeKey = (W, H) => `${W}x${H}`;
export const cardId = (c) => `${c.key}${c.dup ? '#d' : ''}`;
const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// the numbers a stored layout depends on besides the cards: the rules, the states, the focus / ambient numbers the states use, the card bands
export function ruleSignature() {
  const amb = {}; for (const k of Object.keys(WORK)) if (/^amb/.test(k) || /^focus(Scale|Push|PushOthers|Neighbour|PushRadius)$/.test(k) || ['seed', 'overlapMax', 'slack', 'minGap', 'wheel', 'gapSide', 'gapVert', 'frameW', 'frameH', 'dupGap'].includes(k)) amb[k] = WORK[k];
  return fnv(JSON.stringify({ rules: [BAND_RULES.pairOverlapMax, BAND_RULES.clusterLink, BAND_RULES.maxDarkPerCluster, BAND_RULES.minLightShare, BAND_RULES.maxDarkRun], states: LAYOUT_STATES, amb, cards: [CARDS.depthRange, CARDS.mouseStrength], band: CARD_SIZE.bandSlack, limits: WORK_LIMITS }));
}
// one project in one mode at one size: the cards (their ids, sizes, depth, side) + the metrics + the rule signature
export function projectHash(list, M) {
  return fnv(JSON.stringify([slugSeed(list[0]?.slug || ''), list.map((c) => [cardId(c), c.w, c.h, r(c.mouse, 1), c.edge, c.dup ? 1 : 0, c.hasDup ? 1 : 0]), r(M.alongF), r(M.crossF), r(M.gap), r(M.scale, 4), r(M.viewCross), ruleSignature()]));
}

// The stored size to use for a window: the class (16:9 or 16:10) by the aspect, the entry with the nearest width. exact = that size itself; otherwise the layout is
// scaled by the width ratio (exact below 1920, where everything scales together; an approximation above it, where the cards are capped and the images are not)
export function pickSize(layouts, W, H) {
  const cls = Math.abs(H / W - 9 / 16) <= Math.abs(H / W - 10 / 16) ? '16:9' : '16:10';
  const list = SIZES[cls].filter(([w, h]) => layouts?.work?.[sizeKey(w, h)]);
  if (!list.length) return null;
  const best = list.reduce((a, b) => (Math.abs(b[0] - W) < Math.abs(a[0] - W) ? b : a));
  return { key: sizeKey(best[0], best[1]), exact: best[0] === W && best[1] === H, ratio: W / best[0] };
}

// The homepage's stored layout for a window: the class by the aspect, the entry with the nearest width (the homepage units are px at 1920 and vh, so any size of a
// class can use it); { cards: { id: [ax px, ay vh] }, dark: { id: bool } } or null
export function pickHome(layouts, W, H) {
  const cls = Math.abs(H / W - 9 / 16) <= Math.abs(H / W - 10 / 16) ? '16:9' : '16:10';
  const list = SIZES[cls].filter(([w, h]) => layouts?.home?.[sizeKey(w, h)]);
  if (!list.length || !layouts.homeDark || layouts.signature !== ruleSignature()) return null;
  const best = list.reduce((a, b) => (Math.abs(b[0] - W) < Math.abs(a[0] - W) ? b : a));
  return { cards: layouts.home[sizeKey(best[0], best[1])].cards, dark: layouts.homeDark };
}

// Placed cards from a stored layout for one mode, aligned with `projects` like placeCards(); null when any card has no stored position (the caller falls back).
export function placeStored(layouts, projects, M, mode, pick) {
  const entry = layouts?.work?.[pick.key]?.[mode];
  if (!entry) return null;
  const k = pick.exact ? 1 : pick.ratio, sc = M.scale;
  const out = [];
  for (const list of projects) {
    const e = entry[list[0]?.slug];
    if (!e) return null;
    const row = [];
    for (const c of list) {
      const p = e.cards[cardId(c)];
      if (!p) return null;
      const w = c.w * sc, h = c.h * sc;
      row.push({ along: p[0] * k, cross: p[1] * k, w, h, alongSize: M.vertical ? h : w, crossSize: M.vertical ? w : h });
    }
    out.push(row);
  }
  return out;
}
// The stored dark flags (one per card, the same in both modes and every size). Returns false when a card is unknown.
export function applyStoredDark(layouts, projects) {
  const d = layouts?.dark;
  if (!d) return false;
  for (const list of projects) { const e = d[list[0]?.slug]; if (!e) return false; for (const c of list) { if (!(cardId(c) in e)) return false; c.dark = !!e[cardId(c)]; } }
  return true;
}

// R24b: the landscape TABLET sizes (aspect classes 3:2 and 4:3; src/data/layouts-tablet.json, tools/layout-solve-tablet.mjs, checked by tools/layout-check-tablet.mjs).
// Windows with H / W above TABLET_ABOVE (closer to 3:2 than to 16:10) and landscape use the nearest of these; 16:9 / 16:10 windows never do (pickSize is unchanged).
export const TABLET_SIZES = { '3:2': [[1440, 960], [1180, 820]], '4:3': [[1024, 768], [1366, 1024]] };
export const TABLET_ABOVE = 0.646;
export const isTabletAspect = (W, H) => H / W > TABLET_ABOVE && H < W;
export function pickTablet(layouts, W, H) {
  if (!isTabletAspect(W, H) || layouts?.signature !== ruleSignature()) return null;
  const list = Object.values(TABLET_SIZES).flat().filter(([w, h]) => layouts?.work?.[sizeKey(w, h)]);
  if (!list.length) return null;
  const d = ([w, h]) => Math.abs(H / W - h / w) * 4 + Math.abs(Math.log(W / w));
  const best = list.reduce((a, b) => (d(b) < d(a) ? b : a));
  return { key: sizeKey(best[0], best[1]), exact: best[0] === W && best[1] === H, ratio: W / best[0] };
}
