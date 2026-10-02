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

export function generateCards(pool, seed = POOL.seed, count = POOL.count) {
  // 1. picks: per project, images ranked by their seeded hash; the project's quota is taken from the top
  const slugs = [...new Set(pool.map((e) => e.slug))].sort();
  const byProject = slugs.map((s) => pool.filter((e) => e.slug === s).sort((a, b) => mix(a.hash, seed) - mix(b.hash, seed)));
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
      id: 0, slug: e.slug, key: e.key, tier, w, h, mouse, scroll: true,
      z: tier === 2 ? 5 : mouse === 20 ? 2 : 3, // small back cards z 2, the rest 3, large front cards 5 (as before)
      dark: e.lum < CARD_SIZE.darkLum,
      src: `/media/${e.key}.webp`,
      x: (r() < 0.5 ? -1 : 1) * (CARD_SIZE.xMin + r() * (CARD_SIZE.xMax - CARD_SIZE.xMin)),
      y: CARD_SIZE.yTop + r() * (CARD_SIZE.yBottom - CARD_SIZE.yTop),
    };
  });

  // 3. balance: in top-to-bottom order no two neighbours from the same project (swap the lower one's y with the next card that differs)
  cards.sort((a, b) => a.y - b.y);
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].slug !== cards[i - 1].slug) continue;
    const j = cards.findIndex((c, k) => k > i && c.slug !== cards[i].slug && (k + 1 >= cards.length || cards[k + 1].slug !== cards[i].slug));
    if (j < 0) continue;
    [cards[i].y, cards[j].y] = [cards[j].y, cards[i].y];
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.forEach((c, i) => { c.id = i + 1; });
  return cards;
}
