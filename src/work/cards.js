// R23b / R23c: the cards of the Work page. Every project's main image owns its cards: they scatter around it (above and below in the side
// scroll, left and right in the vertical one) the way the homepage cards do, centre clear, and ride with their project. The same rules as the homepage bands (R22d, cards-gen.js): count and area limits per project (WORK_LIMITS:
// over a max the extras are dropped by the seeded hash, under a min the project's own images are duplicated), even edges (top and
// bottom differ by at most 1), a seeded dark rest layer (CARD_HOVER.darkShare, at most BAND_RULES.maxDarkRun in a row along the strip,
// duplicates always dark and exempt). Cards come from the WHOLE pool of the project (not only the featured images), tiers and fit as
// on the homepage (CARD_SIZE).
//
// Two steps: buildProjectCards() decides WHICH cards a project has (mode independent: images, tiers, edges, dark flags, the
// along-the-strip fraction of the originals); placeCards() turns that into pixel positions for one mode (side or vertical). A card is the
// same card in both modes, which is what lets the toggle morph every card from its place in one layout to its place in the other.
import { WORK, WORK_LIMITS, CARD_SIZE, BAND_RULES, CARD_HOVER, LAYOUT } from '../timeline.js';
import { generateLayout } from '../data/layout.js';
import { cardDepth } from '../data/depth.js';
import { rng, mix, fit } from '../data/cards-gen.js';

const warn = (...a) => { if (import.meta.env?.DEV) console.warn('[work cards]', ...a); };
const area = (c) => c.w * c.h;
const sum = (l) => l.reduce((a, c) => a + area(c), 0);

// w, h in px at 1920 (as CARD_SIZE); the pixel size is these x scale
function make(e, pi, seed, salt = 0) {
  const r = rng(mix(e.hash, seed + pi * 131 + 7 + salt * 977));
  const t = r();
  const tier = t < CARD_SIZE.weights[0] ? 0 : t < CARD_SIZE.weights[0] + CARD_SIZE.weights[1] ? 1 : 2;
  const dp = cardDepth(e.hash, seed + pi * 131 + 3 + salt * 977);
  const s = fit(e.w, e.h, CARD_SIZE.tiers[tier]);
  return { slug: e.slug, key: e.key, hash: e.hash, src: `/media/${e.key}.webp`, srcSize: { w: e.w, h: e.h }, tier, mouse: dp.mouse, z: dp.z, depth: dp.depth, front: dp.front, w: s.w, h: s.h, dup: false, dark: false, edge: 0, f: 0 };
}
function setTier(c, tier) {
  const s = fit(c.srcSize.w, c.srcSize.h, CARD_SIZE.tiers[tier]);
  Object.assign(c, { tier, w: s.w, h: s.h });
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
      setTier(d, tier);
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

// Pixel positions for one mode (R23c: the homepage scatter). Every project's cards scatter around ITS image, anywhere in the allowed area:
// across the strip from just outside the image (a card may overlap the image edge by up to WORK.overlapMax of its size, never has to) to
// the screen edge, along the strip through the project's length (a little past it into the gap). The positions come from layout.js, the
// same seeded scatter + relaxation (minimum gap between neighbouring depths) that places the homepage cards, run once for all projects
// (so cards of neighbouring projects keep apart too), in the homepage units (x = px at 1920 from the centre line, y = vh). The side
// scroll is the same thing turned 90 degrees: x is then the screen's y, y the screen's x, and w / h swap. Each card's side of the strip
// (c.edge) is kept, so the counts per side stay even; a duplicate pair is pinned (distance along the strip, opposite sides).
// M = { vertical, alongF, crossF (frame size along / across the strip, px), gap (px between frames), viewCross (screen size across the
// strip, px), scale, gapPx (the least distance between a duplicate and its twin, px) }. Returns per project an array aligned with its
// cards: { along (px from the frame centre), cross (px from the strip's centre line), w, h (px), alongSize, crossSize }.
export function placeCards(projects, M) {
  const VH = 10.8; // px per vh at the 1080 reference (layout.js)
  const sc = M.scale;
  const fhRef = M.crossF / 2 / sc; // half the image's width across the strip, px at 1920
  const vhRef = M.viewCross / 2 / sc; // half the screen's size across the strip
  const hb = (M.alongF / 2 + M.gap / 2) / sc / VH; // half the project's length along the strip (image + half a gap), vh
  const pitchVh = (M.alongF + M.gap) / sc / VH;
  const gapVh = M.gapPx / sc / VH;
  const slack = Math.max(CARD_SIZE.bandSlack, WORK.slack * pitchVh); // a card may drift this far past its project's length (the relaxation needs room)
  const flat = [];
  projects.forEach((list, pi) => {
    const base = pi * pitchVh;
    const mk = (c) => {
      const wl = M.vertical ? c.w : c.h; // across the strip
      const hl = M.vertical ? c.h : c.w; // along the strip
      const xLo = fhRef - WORK.overlapMax * wl + wl / 2;
      const xHi = Math.max(xLo + 1, vhRef - wl / 2 - 6);
      const t = rng(mix(c.hash, WORK.seed + pi + 71))();
      return { c, pi, base, lc: { x: c.edge * (xLo + t * (xHi - xLo)), y: 0, w: wl, h: hl, mouse: c.mouse, yMin: base - hb - slack, yMax: base + hb + slack, xLo, xHi } };
    };
    const items = list.map(mk);
    items.forEach((it) => { if (!it.c.dup) it.lc.y = base + it.c.f * hb; });
    items.forEach((it) => {
      if (!it.c.dup) return;
      const twin = items[list.indexOf(it.c.twin)];
      const ta = twin.lc.y - base;
      const u = rng(mix(it.c.hash, WORK.seed + pi + 63))();
      let dir = ta >= 0 ? -1 : 1;
      const room = (d) => hb - gapVh - d * ta; // how far the farthest allowed point lies beyond the least distance
      if (room(dir) < 0 && room(-dir) >= 0) dir = -dir;
      it.lc.y = base + (room(dir) >= 0 ? ta + dir * (gapVh + u * room(dir)) : dir * hb);
      it.lc.pinY = twin.lc.pinY = true;
      it.lc.keepSide = twin.lc.keepSide = true;
    });
    flat.push(...items);
  });
  // centre pull off (the strip's image stays clear); the scatter shrinks with the room across the strip (the homepage values at 1920 wide)
  const room = Math.max(0.15, Math.min(1.3, (vhRef - fhRef) / (960 - 330)));
  const pos = generateLayout(flat.map((f) => f.lc), { ...LAYOUT, seed: LAYOUT.seed + WORK.seed + (M.vertical ? 0 : 101), centreShare: 0, scatter: LAYOUT.scatter * room, minGap: WORK.minGap, passes: 160 });
  // what the relaxation could not clear (the strip is narrow in the side scroll): neighbouring-depth cards still overlapping by more than
  // half the minimum gap are pushed apart along the strip, free of the project's length limit, pairs (pinned) moving only their partner
  const lc = flat.map((f, i) => ({ x: pos[i].x, y: pos[i].y * VH, w: f.lc.w, h: f.lc.h, m: f.lc.mouse, pin: !!f.lc.pinY }));
  const need = WORK.minGap * 0.5;
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let i = 0; i < lc.length; i++) {
      for (let j = i + 1; j < lc.length; j++) {
        const a = lc[i], b = lc[j];
        if (Math.abs(a.m - b.m) > 30) continue;
        const ox = (a.w + b.w) / 2 - Math.abs(b.x - a.x), oy = (a.h + b.h) / 2 - Math.abs(b.y - a.y);
        if (ox <= need || oy <= need) continue;
        const dir = b.y >= a.y ? 1 : -1, d = oy - need + 1;
        if (a.pin && b.pin) continue;
        if (a.pin) b.y += dir * d; else if (b.pin) a.y -= dir * d; else { a.y -= (dir * d) / 2; b.y += (dir * d) / 2; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  lc.forEach((c, i) => { pos[i].y = c.y / VH; });
  const out = projects.map((list) => new Array(list.length));
  flat.forEach((f, i) => {
    const k = projects[f.pi].indexOf(f.c);
    const w = f.c.w * sc, h = f.c.h * sc;
    out[f.pi][k] = { along: (pos[i].y - f.base) * VH * sc, cross: pos[i].x * sc, w, h, alongSize: M.vertical ? h : w, crossSize: M.vertical ? w : h };
  });
  return out;
}

// R23c: the dark flags were drawn along each project's nominal order; the scatter reorders the cards along the strip and differently in the
// two modes. So once both layouts are known, runs of more than BAND_RULES.maxDarkRun dark cards in a row along the strip (duplicates are
// exempt) are broken in BOTH orders: the card that makes the run too long goes light and the best-ranked light card that makes no new
// run goes dark instead (the share ends a little lower when none fits). placedModes = [placeCards(...) for each mode].
export function balanceDark(projects, placedModes) {
  projects.forEach((list, pi) => {
    const orig = list.map((c, k) => k).filter((k) => !list[k].dup);
    const rk = (k) => mix(list[k].hash, WORK.seed + pi + 53);
    const byRank = orig.slice().sort((a, b) => rk(a) - rk(b));
    const orders = placedModes.map((pl) => orig.slice().sort((a, b) => pl[pi][a].along - pl[pi][b].along));
    const bad = () => {
      for (const ord of orders) { let run = 0; for (const k of ord) { run = list[k].dark ? run + 1 : 0; if (run > BAND_RULES.maxDarkRun) return k; } }
      return -1;
    };
    for (let it = 0; it < 60; it++) {
      const b = bad();
      if (b < 0) break;
      list[b].dark = false;
      for (const k of byRank) { if (list[k].dark || k === b) continue; list[k].dark = true; if (bad() >= 0) list[k].dark = false; else break; }
    }
  });
}
