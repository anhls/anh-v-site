// R22: Selected Work cards generated from the project image pool (src/data/work-pool.json, built by tools/work-pool.mjs).
// Every pick and every per-card value (tier, depth, side, start position) comes from the image's own hash mixed with
// POOL.seed, so adding an image to the pool does not change the cards that already exist (apart from the one image it
// may replace in its project's share). Output records have the shape the section already uses; positions are the
// starting point for generateLayout (layout.js), which does the scatter and relaxation.
// R22c: a card sits near its own project. The cards scroll through the project index, where the centre title swaps row 1 -> 2 -> 3
// (INDEX.swap), so each indexed project gets a band of start y (vh from the section top) where its title is the one showing at the
// centre; projects without a title in the index (and extras with no project) go in the two swap zones, where one title slides out
// and the next in.
import { POOL, CARD_SIZE, INDEX, CARD_LAYOUT, BAND_LIMITS, BAND_RULES, CARD_HOVER, LAYOUT } from '../timeline.js';
import { generateLayout } from './layout.js';
import { scrollPx, dist } from '../scale.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mix = (h, seed) => (Math.imul(h ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b) ^ (h >>> 13)) >>> 0;

// Page-scroll position (px) at which a card at y (vh from the section top) crosses the screen centre, and back.
const scrollToY = (px) => ((px - dist(CARD_LAYOUT.sectionTopCappedVh) + innerHeight / 2) / innerHeight) * 100;

// The vertical bands (y in vh from the section top). rows = slugs of the indexed projects in index order. Band i is where row i's
// title is showing and no swap is running; zones are the two swap spans (INDEX.swap).
export function cardBands(rows) {
  const zones = INDEX.swap.slice(0, rows.length - 1).map(([a, b]) => [scrollToY(scrollPx(a)), scrollToY(scrollPx(b))]);
  const edges = [CARD_SIZE.yTop, ...zones.flat(), CARD_SIZE.yBottom];
  const bands = rows.map((slug, i) => ({ slug, lo: edges[i * 2], hi: edges[i * 2 + 1] }));
  return { bands, zones };
}

// Fit the image's own ratio (clamped to maxRatio, the rest is cropped by cover) inside the tier box; short side >= minShort.
export function fit(srcW, srcH, box) {
  let r = srcW / srcH;
  r = Math.min(Math.max(r, 1 / CARD_SIZE.maxRatio), CARD_SIZE.maxRatio);
  let w = Math.min(box.w, box.h * r);
  let h = w / r;
  const short = Math.min(w, h);
  if (short < CARD_SIZE.minShort) { const k = CARD_SIZE.minShort / short; w *= k; h *= k; }
  return { w: Math.round(w), h: Math.round(h) };
}

// The five bands in page order: row 1, swap zone 1, row 2, swap zone 2, row 3 (limits from BAND_LIMITS, same order).
function bandList(rows) {
  const { bands, zones } = cardBands(rows);
  const out = [];
  bands.forEach((b, i) => {
    out.push({ kind: 'row', slug: b.slug, lo: b.lo, hi: b.hi });
    if (zones[i]) out.push({ kind: 'zone', slug: null, lo: zones[i][0], hi: zones[i][1] });
  });
  out.forEach((b, i) => { b.limits = BAND_LIMITS[i] || { minN: 0, maxN: Infinity, minA: 0, maxA: Infinity }; });
  return out;
}

const area = (c) => c.w * c.h;
const sum = (list) => list.reduce((a, c) => a + area(c), 0);
const TIER_MOUSE = [[20, 25], [50, 75], [100, 100]];

function setTier(c, e, tier, mouse) {
  const { w, h } = fit(e.w, e.h, CARD_SIZE.tiers[tier]);
  Object.assign(c, { tier, w, h, mouse, z: tier === 2 ? 5 : mouse === 20 ? 2 : 3 }); // small back cards z 2, the rest 3, large front cards 5
}

// One card from an image: tier, size, depth and start x from the image's own hash (salt makes a duplicate differ from its twin).
function makeCard(e, band, seed, salt = 0) {
  const r = rng(mix(e.hash, seed + 7 + salt * 977));
  const t = r();
  const tier = t < CARD_SIZE.weights[0] ? 0 : t < CARD_SIZE.weights[0] + CARD_SIZE.weights[1] ? 1 : 2;
  const mouse = TIER_MOUSE[tier][r() < 0.5 ? 0 : 1];
  const c = { id: 0, slug: e.slug, key: e.key, hash: e.hash, band, dup: false, dark: false, scroll: true, src: `/media/${e.key}.webp`, srcSize: { w: e.w, h: e.h } };
  setTier(c, e, tier, mouse);
  c.x = (r() < 0.5 ? -1 : 1) * (CARD_SIZE.xMin + r() * (CARD_SIZE.xMax - CARD_SIZE.xMin));
  const ry = rng(mix(e.hash, seed + 11 + salt * 977));
  c.y = band.lo + ry() * (band.hi - band.lo);
  c.yMin = band.lo - CARD_SIZE.bandSlack;
  c.yMax = band.hi + CARD_SIZE.bandSlack;
  return c;
}

const warn = (...a) => { if (import.meta.env?.DEV) console.warn('[cards]', ...a); };

export function generateCards(allPool, rows = [], seed = POOL.seed, count = POOL.count) {
  // R22b: only featured images (src/data/selected.json, marked by tools/work-pool.mjs); none featured = the whole pool
  let pool = allPool.filter((e) => e.selected);
  if (!pool.length) { pool = allPool; warn('selected.json is empty or missing: Selected Work uses the whole pool'); }
  const bands = bandList(rows);
  const rank = (e, salt) => mix(e.hash, seed + salt);

  // 1. images -> bands: an indexed project's images go to its band; the rest (no title in the index) alternate over the swap zones
  const zoneBands = bands.filter((b) => b.kind === 'zone');
  const imgs = new Map(bands.map((b) => [b, []]));
  pool.filter((e) => rows.includes(e.slug)).forEach((e) => imgs.get(bands.find((b) => b.slug === e.slug)).push(e));
  pool.filter((e) => !rows.includes(e.slug)).sort((a, b) => rank(a, 5) - rank(b, 5)).forEach((e, k) => { if (zoneBands.length) imgs.get(zoneBands[k % zoneBands.length]).push(e); });

  let cards = [];
  for (const b of bands) {
    const lim = b.limits;
    const list = imgs.get(b).map((e) => makeCard(e, b, seed));
    // 2. too many (count or area): drop by the seeded hash (the max wins over the min; the top-up below may add a duplicate back)
    list.sort((p, q) => rank(p, 31) - rank(q, 31));
    while (list.length > 1 && (list.length > lim.maxN || sum(list) > lim.maxA)) list.pop();
    // 3. too few (count or area): duplicates of the band's own images, one per image at most, within the maxima
    const base = list.slice();
    if (base.length * 2 < lim.minN) warn(`band ${b.slug || 'swap zone'}: ${base.length} featured image(s) for a min of ${lim.minN}, at most one duplicate each`);
    for (const twin of base) {
      if ((list.length >= lim.minN && sum(list) >= lim.minA) || list.length >= lim.maxN) break;
      const e = { hash: twin.hash, key: twin.key, slug: twin.slug, w: twin.srcSize.w, h: twin.srcSize.h };
      const d = makeCard(e, b, seed, 1);
      const others = [0, 1, 2].filter((t) => t !== twin.tier);
      const tier = others[Math.floor(rng(mix(twin.hash, seed + 61))() * others.length)];
      setTier(d, e, tier, TIER_MOUSE[tier][rng(mix(twin.hash, seed + 62))() < 0.5 ? 0 : 1]);
      if (sum(list) + area(d) > lim.maxA) continue;
      // opposite side, >= dupMinGapVh apart along y (the pair is pinned in y and side so the layout cannot undo it)
      const gap = BAND_RULES.dupMinGapVh;
      const ry = rng(mix(twin.hash, seed + 63));
      let up = ry() < 0.5;
      const room = (dir) => (dir ? twin.yMax - twin.y : twin.y - twin.yMin);
      if (room(up) < gap && room(!up) >= gap) up = !up;
      if (room(up) < gap) twin.y = up ? twin.yMin : twin.yMax; // neither way fits: the twin goes to the far edge of the band
      d.y = up ? Math.min(twin.y + gap + ry() * Math.max(0, twin.yMax - twin.y - gap), twin.yMax) : Math.max(twin.y - gap - ry() * Math.max(0, twin.y - gap - twin.yMin), twin.yMin);
      d.x = -Math.sign(twin.x) * Math.abs(d.x);
      d.dup = true; d.dark = true; d.twin = twin;
      twin.pinY = d.pinY = true; twin.keepSide = d.keepSide = true; twin.hasDup = true;
      list.push(d);
    }
    if (list.length < lim.minN) warn(`band ${b.slug || 'swap zone'}: ${list.length} cards, min ${lim.minN} (stills ran out)`);
    cards.push(...list);
  }
  // total cap (POOL.count): drop the lowest-priority originals by hash, never a pair member
  if (cards.length > count) {
    const drop = cards.filter((c) => !c.dup && !c.hasDup).sort((a, b) => rank(b, 71) - rank(a, 71)).slice(0, cards.length - count);
    cards = cards.filter((c) => !drop.includes(c));
  }

  // Order and ids first: the layout (scatter + relaxation, layout.js) works per card index, and steps 4 and 5 look at where it puts the cards.
  cards.sort((a, b) => a.y - b.y);
  cards.forEach((c, i) => { c.id = i + 1; });
  const layout = () => generateLayout(cards, { ...LAYOUT, seed: LAYOUT.seed + seed });

  // 4. even sides inside each band, on the laid-out positions: left and right differ by at most 1 per band and by at most
  // sideSliceMax in any slice of sideSlice cards (y order). The card flipped is the one whose flip costs least (smallest |x| =
  // smallest shift); duplicate pairs stay put. The layout is re-run after every flip (deterministic, a fraction of a millisecond).
  // violation score of a band: how far left minus right is over 1 for the whole band (x10), plus how far it is over sideSliceMax in each slice
  const score = (signs) => {
    let sc = Math.max(0, Math.abs(signs.reduce((a, v) => a + v, 0)) - 1) * 10;
    for (let i = 0; i + BAND_RULES.sideSlice <= signs.length; i++) sc += Math.max(0, Math.abs(signs.slice(i, i + BAND_RULES.sideSlice).reduce((a, v) => a + v, 0)) - BAND_RULES.sideSliceMax);
    return sc;
  };
  for (let it = 0; it < 200; it++) { // one flip per round (a flip can move other cards through the relaxation), until every band passes
    const pos = layout();
    let flipped = false;
    for (const b of bands) {
      const list = cards.map((c, i) => ({ c, i })).filter((o) => o.c.band === b).sort((p, q) => pos[p.i].y - pos[q.i].y);
      const signs = list.map((o) => (pos[o.i].x < 0 ? -1 : 1));
      const now = score(signs);
      if (!now) continue;
      // the flip (of a card that may move) that lowers the score most; ties: the cheapest one (smallest |x|)
      let best = null;
      list.forEach((o, k) => {
        if (o.c.keepSide) return;
        signs[k] = -signs[k];
        const sc = score(signs);
        signs[k] = -signs[k];
        if (sc < now && (!best || sc < best.sc || (sc === best.sc && Math.abs(pos[o.i].x) < Math.abs(pos[best.o.i].x)))) best = { o, sc };
      });
      if (best) { best.o.c.x = -best.o.c.x; flipped = true; break; }
    }
    if (!flipped) break;
  }
  const finalPos = layout();
  cards.forEach((c, i) => { c.py = finalPos[i].y; });

  // 5. dark rest layer: a seeded draw per card (not the image's brightness). Duplicates are always dark; the others are drawn so the
  // overall share lands near CARD_HOVER.darkShare, and no more than maxDarkRun in a row in y order inside a band (duplicates skipped).
  const others = cards.filter((c) => !c.dup);
  const nDup = cards.length - others.length;
  const need = Math.max(0, Math.min(others.length, Math.round(CARD_HOVER.darkShare * cards.length) - nDup));
  const byRank = others.slice().sort((p, q) => rank(p, 53) - rank(q, 53));
  others.forEach((c) => { c.dark = false; });
  byRank.slice(0, need).forEach((c) => { c.dark = true; });
  const runBreak = (b) => { // the first card that makes a run longer than maxDarkRun, or null
    const l = others.filter((c) => c.band === b).sort((p, q) => p.py - q.py);
    let run = 0;
    for (const c of l) { run = c.dark ? run + 1 : 0; if (run > BAND_RULES.maxDarkRun) return c; }
    return null;
  };
  for (const b of bands) {
    for (let it = 0; it < 40; it++) {
      const bad = runBreak(b);
      if (!bad) break;
      bad.dark = false;
      // darken the best-ranked light card elsewhere if that makes no new run; otherwise the share just ends a little lower
      byRank.find((c) => { if (c.dark || c === bad) return false; c.dark = true; if (runBreak(c.band)) { c.dark = false; return false; } return true; });
    }
  }

  return cards;
}
