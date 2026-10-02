// R22: Selected Work cards generated from the project image pool (src/data/work-pool.json, built by tools/work-pool.mjs).
// Every pick and every per-card value (tier, depth, side, start position) comes from the image's own hash mixed with
// POOL.seed, so adding an image to the pool does not change the cards that already exist (apart from the one image it
// may replace in its project's share). Output records have the shape the section already uses; positions are the
// starting point for generateLayout (layout.js), which does the scatter and relaxation.
// R22c: a card sits near its own project. The cards scroll through the project index, where the centre title swaps row 1 -> 2 -> 3
// (INDEX.swap), so each indexed project gets a band of start y (vh from the section top) where its title is the one showing at the
// centre; projects without a title in the index (and extras with no project) go in the two swap zones, where one title slides out
// and the next in.
import { POOL, CARD_SIZE, INDEX, CARD_LAYOUT } from '../timeline.js';
import { scrollPx, dist } from '../scale.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (h, seed) => (Math.imul(h ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b) ^ (h >>> 13)) >>> 0;

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

// How many cards each group gets: in proportion to its weight (its scroll length), no more than it has, the leftover shared on.
function quotas(counts, weights, total) {
  const q = counts.map(() => 0);
  let left = total;
  while (left > 0) {
    const open = counts.map((c, i) => i).filter((i) => q[i] < counts[i]);
    if (!open.length) break;
    const wsum = open.reduce((a, i) => a + weights[i], 0);
    const share = open.map((i) => Math.min(counts[i] - q[i], Math.floor((left * weights[i]) / wsum)));
    let gave = share.reduce((a, b) => a + b, 0);
    open.forEach((i, k) => { q[i] += share[k]; });
    left -= gave;
    if (gave === 0) { // rounding: one card to the open group furthest below its share
      const i = open.reduce((m, j) => (weights[j] / (q[j] + 1) > weights[m] / (q[m] + 1) ? j : m));
      q[i]++; left--;
    }
  }
  return q;
}

// Fit the image's own ratio (clamped to maxRatio, the rest is cropped by cover) inside the tier box; short side >= minShort.
function fit(srcW, srcH, box) {
  let r = srcW / srcH;
  r = Math.min(Math.max(r, 1 / CARD_SIZE.maxRatio), CARD_SIZE.maxRatio);
  let w = Math.min(box.w, box.h * r);
  let h = w / r;
  const short = Math.min(w, h);
  if (short < CARD_SIZE.minShort) { const k = CARD_SIZE.minShort / short; w *= k; h *= k; }
  return { w: Math.round(w), h: Math.round(h) };
}

export function generateCards(allPool, rows = [], seed = POOL.seed, count = POOL.count) {
  // R22b: only featured images (src/data/selected.json, marked by tools/work-pool.mjs); none featured = the whole pool
  let pool = allPool.filter((e) => e.selected);
  if (!pool.length) { pool = allPool; if (import.meta.env?.DEV) console.warn('selected.json is empty or missing: Selected Work uses the whole pool'); }
  // 1. picks: groups = the indexed projects (own band each) + everything else (the swap zones); images ranked by their seeded
  // hash, each group's share (by band length) taken from the top. Not forced to be even.
  const { bands, zones } = cardBands(rows);
  const zoneLen = zones.reduce((a, z) => a + z[1] - z[0], 0);
  const groups = [...bands.map((b) => ({ band: b, items: pool.filter((e) => e.slug === b.slug), w: b.hi - b.lo })), { band: null, items: pool.filter((e) => !rows.includes(e.slug)), w: zoneLen || 1 }];
  groups.forEach((g) => g.items.sort((a, b) => mix(a.hash, seed) - mix(b.hash, seed)));
  const q = quotas(groups.map((g) => g.items.length), groups.map((g) => g.w), Math.min(count, pool.length));
  const picked = groups.flatMap((g, i) => g.items.slice(0, q[i]).map((e) => ({ e, band: g.band })));

  // 2. each card from its own hash
  const cards = picked.map(({ e, band }) => {
    const r = rng(mix(e.hash, seed + 7));
    const t = r();
    const tier = t < CARD_SIZE.weights[0] ? 0 : t < CARD_SIZE.weights[0] + CARD_SIZE.weights[1] ? 1 : 2;
    const { w, h } = fit(e.w, e.h, CARD_SIZE.tiers[tier]);
    const mouse = [[20, 25], [50, 75], [100, 100]][tier][r() < 0.5 ? 0 : 1];
    return {
      id: 0, slug: e.slug, key: e.key, tier, w, h, mouse, scroll: true,
      z: tier === 2 ? 5 : mouse === 20 ? 2 : 3, // small back cards z 2, the rest 3, large front cards 5 (as before)
      dark: e.lum < CARD_SIZE.darkLum,
      src: `/media/${e.key}.webp`,
      x: (r() < 0.5 ? -1 : 1) * (CARD_SIZE.xMin + r() * (CARD_SIZE.xMax - CARD_SIZE.xMin)),
      y: 0, yMin: 0, yMax: 0,
    };
  });
  // start y inside the card's own band (small slack so layout may drift it a little over the edge), or in one of the swap zones
  cards.forEach((c, i) => {
    const r = rng(mix(picked[i].e.hash, seed + 11));
    const [lo, hi] = picked[i].band ? [picked[i].band.lo, picked[i].band.hi] : zones.length ? zones[Math.floor(r() * zones.length)] : [CARD_SIZE.yTop, CARD_SIZE.yBottom];
    c.y = lo + r() * (hi - lo);
    c.yMin = lo - CARD_SIZE.bandSlack;
    c.yMax = hi + CARD_SIZE.bandSlack;
  });

  cards.sort((a, b) => a.y - b.y);
  cards.forEach((c, i) => { c.id = i + 1; });
  return cards;
}
