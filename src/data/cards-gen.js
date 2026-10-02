// R22: Selected Work cards generated from the project image pool (src/data/work-pool.json, built by tools/work-pool.mjs).
// Every pick and every per-card value (tier, depth, side, start position) comes from the image's own hash mixed with
// POOL.seed, so adding an image to the pool does not change the cards that already exist (apart from the one image it
// may replace in its project's share). Output records have the shape the section already uses; positions are the
// starting point for generateLayout (layout.js), which does the scatter and relaxation.
import { POOL, CARD_SIZE } from '../timeline.js';

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

// How many cards each project gets: as even as possible, a project with fewer stills gives its share to the others.
function quotas(counts, total) {
  const q = counts.map(() => 0);
  let left = total;
  while (left > 0) {
    let gave = false;
    for (let i = 0; i < counts.length && left > 0; i++) if (q[i] < counts[i]) { q[i]++; left--; gave = true; }
    if (!gave) break;
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

export function generateCards(allPool, seed = POOL.seed, count = POOL.count) {
  // R22b: only featured images (src/data/selected.json, marked by tools/work-pool.mjs); none featured = the whole pool
  let pool = allPool.filter((e) => e.selected);
  if (!pool.length) { pool = allPool; if (import.meta.env?.DEV) console.warn('selected.json is empty or missing: Selected Work uses the whole pool'); }
  // 1. picks: per project (a featured image with no project is a group of its own), images ranked by their seeded hash; the
  // project's share is taken from the top. Shares are as even as possible, so a project with few featured images gives its share away.
  const grp = (e) => e.slug || e.key;
  const slugs = [...new Set(pool.map(grp))].sort();
  const byProject = slugs.map((s) => pool.filter((e) => grp(e) === s).sort((a, b) => mix(a.hash, seed) - mix(b.hash, seed)));
  const q = quotas(byProject.map((l) => l.length), Math.min(count, pool.length));
  const picked = byProject.flatMap((l, i) => l.slice(0, q[i]));

  // 2. each card from its own hash
  const cards = picked.map((e) => {
    const r = rng(mix(e.hash, seed + 7));
    const t = r();
    const tier = t < CARD_SIZE.weights[0] ? 0 : t < CARD_SIZE.weights[0] + CARD_SIZE.weights[1] ? 1 : 2;
    const { w, h } = fit(e.w, e.h, CARD_SIZE.tiers[tier]);
    const mouse = [[20, 25], [50, 75], [100, 100]][tier][r() < 0.5 ? 0 : 1];
    return {
      id: 0, slug: e.slug, grp: grp(e), key: e.key, tier, w, h, mouse, scroll: true,
      z: tier === 2 ? 5 : mouse === 20 ? 2 : 3, // small back cards z 2, the rest 3, large front cards 5 (as before)
      dark: e.lum < CARD_SIZE.darkLum,
      src: `/media/${e.key}.webp`,
      x: (r() < 0.5 ? -1 : 1) * (CARD_SIZE.xMin + r() * (CARD_SIZE.xMax - CARD_SIZE.xMin)),
      y: CARD_SIZE.yTop + r() * (CARD_SIZE.yBottom - CARD_SIZE.yTop),
    };
  });

  // 3. balance: the y slots stay as drawn; walking down them, each slot takes the next card (top to bottom) of the group with
  // the most cards left that is not the previous slot's group, so no two neighbours share a project whenever that is possible
  cards.sort((a, b) => a.y - b.y);
  const slots = cards.map((c) => c.y);
  const left = new Map();
  cards.forEach((c) => { if (!left.has(c.grp)) left.set(c.grp, []); left.get(c.grp).push(c); });
  const order = [];
  let prev = null;
  for (let i = 0; i < slots.length; i++) {
    let best = null;
    for (const [g, l] of left) if (l.length && g !== prev && (!best || l.length > left.get(best).length || (l.length === left.get(best).length && l[0].y < left.get(best)[0].y))) best = g;
    if (best === null) best = [...left.keys()].find((g) => left.get(g).length); // only the previous group is left: unavoidable
    const c = left.get(best).shift();
    c.y = slots[i];
    order.push(c);
    prev = best;
  }
  cards.splice(0, cards.length, ...order);
  cards.forEach((c, i) => { c.id = i + 1; });
  return cards;
}
