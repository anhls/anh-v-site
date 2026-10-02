// R23b: the cards of the Work page. Every project's main image owns its cards: they sit along its two edges (top and bottom in the
// side scroll, left and right in the vertical one), overlapping the edge by 10-20% of the card's size across the strip, centre clear,
// and ride with their project. The same rules as the homepage bands (R22d, cards-gen.js): count and area limits per project (WORK_LIMITS:
// over a max the extras are dropped by the seeded hash, under a min the project's own images are duplicated), even edges (top and
// bottom differ by at most 1), a seeded dark rest layer (CARD_HOVER.darkShare, at most BAND_RULES.maxDarkRun in a row along the strip,
// duplicates always dark and exempt). Cards come from the WHOLE pool of the project (not only the featured images), tiers and fit as
// on the homepage (CARD_SIZE).
//
// Two steps: buildProjectCards() decides WHICH cards a project has (mode independent: images, tiers, edges, dark flags, the
// along-the-strip fraction of the originals); placeCards() turns that into pixel positions for one mode (side or vertical). A card is the
// same card in both modes, which is what lets the toggle morph every card from its place in one layout to its place in the other.
import { WORK, WORK_LIMITS, CARD_SIZE, BAND_RULES, CARD_HOVER } from '../timeline.js';
import { rng, mix, fit } from '../data/cards-gen.js';

const TIER_MOUSE = [[20, 25], [50, 75], [100, 100]];
const warn = (...a) => { if (import.meta.env?.DEV) console.warn('[work cards]', ...a); };
const area = (c) => c.w * c.h;
const sum = (l) => l.reduce((a, c) => a + area(c), 0);

// w, h in px at 1920 (as CARD_SIZE); the pixel size is these x scale
function make(e, pi, seed, salt = 0) {
  const r = rng(mix(e.hash, seed + pi * 131 + 7 + salt * 977));
  const t = r();
  const tier = t < CARD_SIZE.weights[0] ? 0 : t < CARD_SIZE.weights[0] + CARD_SIZE.weights[1] ? 1 : 2;
  const mouse = TIER_MOUSE[tier][r() < 0.5 ? 0 : 1];
  const ov = WORK.overlapMin + r() * (WORK.overlapMax - WORK.overlapMin);
  const s = fit(e.w, e.h, CARD_SIZE.tiers[tier]);
  return { slug: e.slug, key: e.key, hash: e.hash, src: `/media/${e.key}.webp`, srcSize: { w: e.w, h: e.h }, tier, mouse, z: tier === 2 ? 5 : mouse === 20 ? 2 : 3, w: s.w, h: s.h, ov, dup: false, dark: false, edge: 0, f: 0 };
}
function setTier(c, tier, mouse) {
  const s = fit(c.srcSize.w, c.srcSize.h, CARD_SIZE.tiers[tier]);
  Object.assign(c, { tier, mouse, z: tier === 2 ? 5 : mouse === 20 ? 2 : 3, w: s.w, h: s.h });
}

export function buildProjectCards(pool, slugs, seed = WORK.seed, lim = WORK_LIMITS) {
  return slugs.map((slug, pi) => {
    const rank = (e, salt) => mix(e.hash, seed + pi * 131 + salt);
    let list = pool.filter((e) => e.slug === slug).sort((a, b) => rank(a, 31) - rank(b, 31)).map((e) => make(e, pi, seed));
    // over a max (count or area): drop by the seeded hash
    while (list.length > 1 && (list.length > lim.maxN || sum(list) > lim.maxA)) list.pop();
    // under a min: duplicates of the project's own images (other tier, always dark), one per image at most, within the maxima
    const base = list.slice();
    if (base.length * 2 < lim.minN) warn(`${slug}: ${base.length} image(s) for a min of ${lim.minN}, at most one duplicate each`);
    for (const twin of base) {
      if ((list.length >= lim.minN && sum(list) >= lim.minA) || list.length >= lim.maxN) break;
      const d = make({ hash: twin.hash, key: twin.key, slug, w: twin.srcSize.w, h: twin.srcSize.h }, pi, seed, 1);
      const others = [0, 1, 2].filter((t) => t !== twin.tier);
      const tier = others[Math.floor(rng(mix(twin.hash, seed + 61))() * others.length)];
      setTier(d, tier, TIER_MOUSE[tier][rng(mix(twin.hash, seed + 62))() < 0.5 ? 0 : 1]);
      if (sum(list) + area(d) > lim.maxA) continue;
      d.dup = true; d.dark = true; d.twin = twin; twin.hasDup = true;
      list.push(d);
    }
    if (list.length < lim.minN) warn(`${slug}: ${list.length} cards, min ${lim.minN} (images ran out)`);

    // edges: alternate along a seeded order, duplicates on the opposite edge of their twin, then even out (|top - bottom| <= 1)
    const originals = list.filter((c) => !c.dup).sort((a, b) => rank(a, 41) - rank(b, 41));
    const first = rng(mix(seed, pi + 17))() < 0.5 ? -1 : 1;
    originals.forEach((c, k) => { c.edge = k % 2 ? -first : first; });
    list.filter((c) => c.dup).forEach((d) => { d.edge = -d.twin.edge; });
    for (let it = 0; it < 20; it++) {
      const top = list.filter((c) => c.edge < 0).length;
      const diff = top - (list.length - top);
      if (Math.abs(diff) <= 1) break;
      const maj = diff > 0 ? -1 : 1;
      const cand = originals.filter((c) => !c.hasDup && c.edge === maj).pop(); // the last-ranked free card on the crowded edge
      if (!cand) break;
      cand.edge = -maj;
    }
    // along the strip: per edge, slots spread over the frame (-1 .. 1), the two edges phase-shifted, a little jitter
    for (const edge of [-1, 1]) {
      const cs = originals.filter((c) => c.edge === edge);
      cs.forEach((c, k) => {
        const jr = rng(mix(c.hash, seed + 53 + pi))();
        c.f = Math.max(-1, Math.min(1, (((k + (edge < 0 ? 0.35 : 0.65)) / cs.length) * 2 - 1) + (jr - 0.5) * (0.6 / cs.length)));
      });
    }
    // dark rest layer: a seeded share, duplicates always dark and exempt from the run limit
    const nDup = list.filter((c) => c.dup).length;
    const need = Math.max(0, Math.min(originals.length, Math.round(CARD_HOVER.darkShare * list.length) - nDup));
    const byRank = originals.slice().sort((a, b) => rank(a, 53) - rank(b, 53));
    originals.forEach((c) => { c.dark = false; });
    byRank.slice(0, need).forEach((c) => { c.dark = true; });
    const alongOrder = originals.slice().sort((a, b) => a.f - b.f);
    const runBreak = () => { let run = 0; for (const c of alongOrder) { run = c.dark ? run + 1 : 0; if (run > BAND_RULES.maxDarkRun) return c; } return null; };
    for (let it = 0; it < 40; it++) {
      const bad = runBreak();
      if (!bad) break;
      bad.dark = false;
      byRank.find((c) => { if (c.dark || c === bad) return false; c.dark = true; if (runBreak()) { c.dark = false; return false; } return true; });
    }
    return list;
  });
}

// Pixel positions for one mode. M = { vertical, alongF, crossF (frame size along / across the strip, px), scale, gapPx (the least
// distance between a duplicate and its twin, px) }. Returns per project an array aligned with its cards:
// { along (px from the frame centre), cross (px from the strip's centre line), w, h (px), alongSize, crossSize }.
export function placeCards(projects, M) {
  return projects.map((list, pi) => list.map((c) => {
    const w = c.w * M.scale, h = c.h * M.scale;
    const alongSize = M.vertical ? h : w;
    const crossSize = M.vertical ? w : h;
    const reach = M.alongF / 2 + WORK.edgeReach * alongSize;
    let along;
    if (!c.dup) along = c.f * reach;
    else {
      const ta = c.twin.f * (M.alongF / 2 + WORK.edgeReach * (M.vertical ? c.twin.h : c.twin.w) * M.scale);
      const u = rng(mix(c.hash, WORK.seed + pi + 63))();
      let dir = ta >= 0 ? -1 : 1;
      const room = (d) => d * (d * reach - (ta + d * M.gapPx)); // how far the farthest allowed point lies beyond the least distance
      if (room(dir) < 0 && room(-dir) >= 0) dir = -dir;
      const near = ta + dir * M.gapPx;
      along = room(dir) >= 0 ? near + dir * u * room(dir) : dir * reach; // no room either way: the far end (a warning in the check)
    }
    return { along, cross: c.edge * (M.crossF / 2 - c.ov * crossSize + crossSize / 2), w, h, alongSize, crossSize };
  }));
}
