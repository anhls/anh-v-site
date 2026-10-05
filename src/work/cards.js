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
import { WORK, WORK_LIMITS, CARD_SIZE, BAND_RULES, CARD_HOVER, LAYOUT, CARDS, LAYOUT_STATES } from '../timeline.js';
import { applyFocus } from './focus.js';
import { fixOverlapsGen, allViolations, drain, enforceDark } from '../data/overlap.js';
import { stateData, workScenarios, slugSeed } from './states.js';
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
  return slugs.map((slug) => {
    const pi = slugSeed(slug); // R29: a project's seed comes from its slug, so adding or removing a project never changes another project's cards
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
  // R29: ONE project at a time (a project's seed comes from its slug, nothing about the other projects enters): adding a project never moves another one's
  // cards. What neighbouring projects do to each other (the gap between two frames, the loop seam) is decided by the offline solver (tools/layout-solve.mjs).
  const VH = 10.8; // px per vh at the 1080 reference (layout.js)
  const sc = M.scale;
  const fhRef = M.crossF / 2 / sc; // half the image's width across the strip, px at 1920
  const vhRef = M.viewCross / 2 / sc; // half the screen's size across the strip
  const hb = (M.alongF / 2 + M.gap / 2) / sc / VH; // half the project's length along the strip (image + half a gap), vh
  const pitchVh = (M.alongF + M.gap) / sc / VH;
  const gapVh = M.gapPx / sc / VH;
  const slack = Math.max(CARD_SIZE.bandSlack, WORK.slack * pitchVh); // a card may drift this far past its project's length (the relaxation needs room)
  const room = Math.max(0.15, Math.min(1.3, (vhRef - fhRef) / (960 - 330)));
  return projects.map((list) => {
    const ps = slugSeed(list[0]?.slug || '');
    const mk = (c) => {
      const wl = M.vertical ? c.w : c.h; // across the strip
      const hl = M.vertical ? c.h : c.w; // along the strip
      const xLo = fhRef - WORK.overlapMax * wl + wl / 2;
      const xHi = Math.max(xLo + 1, vhRef - wl / 2 - 6);
      const t = rng(mix(c.hash, WORK.seed + ps + 71))();
      return { c, lc: { x: c.edge * (xLo + t * (xHi - xLo)), y: 0, w: wl, h: hl, mouse: c.mouse, yMin: -hb - slack, yMax: hb + slack, xLo, xHi } };
    };
    const items = list.map(mk);
    items.forEach((it) => { if (!it.c.dup) it.lc.y = it.c.f * hb; });
    items.forEach((it) => {
      if (!it.c.dup) return;
      const twin = items[list.indexOf(it.c.twin)];
      const ta = twin.lc.y;
      const u = rng(mix(it.c.hash, WORK.seed + ps + 63))();
      let dir = ta >= 0 ? -1 : 1;
      const rm = (d) => hb - gapVh - d * ta; // how far the farthest allowed point lies beyond the least distance
      if (rm(dir) < 0 && rm(-dir) >= 0) dir = -dir;
      it.lc.y = rm(dir) >= 0 ? ta + dir * (gapVh + u * rm(dir)) : dir * hb;
      it.lc.pinY = twin.lc.pinY = true;
      it.lc.keepSide = twin.lc.keepSide = true;
    });
    // centre pull off (the strip's image stays clear); the scatter shrinks with the room across the strip (the homepage values at 1920 wide)
    const pos = generateLayout(items.map((f) => f.lc), { ...LAYOUT, seed: LAYOUT.seed + WORK.seed + (ps % 100003) + (M.vertical ? 0 : 101), centreShare: 0, scatter: LAYOUT.scatter * room, minGap: WORK.minGap, passes: 160 });
    // what the relaxation could not clear: neighbouring-depth cards still overlapping by more than half the minimum gap are pushed apart along the strip,
    // free of the project's length limit, pairs (pinned) moving only their partner
    const lc = items.map((f, i) => ({ x: pos[i].x, y: pos[i].y * VH, w: f.lc.w, h: f.lc.h, m: f.lc.mouse, pin: !!f.lc.pinY }));
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
    return items.map((f, i) => {
      const w = f.c.w * sc, h = f.c.h * sc;
      // R22e: f.c.nudge[mode] (px at 1920) = a layout move along the strip (the load-time fallback pass)
      return { along: pos[i].y * VH * sc + (f.c.nudge?.[M.vertical ? 'vertical' : 'side'] || 0) * sc, cross: pos[i].x * sc + (f.c.nudgeX?.[M.vertical ? 'vertical' : 'side'] || 0) * sc, w, h, alongSize: M.vertical ? h : w, crossSize: M.vertical ? w : h };
    });
  });
}

// R23c: the dark flags were drawn along each project's nominal order; the scatter reorders the cards along the strip and differently in the
// two modes. So once both layouts are known, runs of more than BAND_RULES.maxDarkRun dark cards in a row along the strip (duplicates are
// exempt) are broken in BOTH orders: the card that makes the run too long goes light and the best-ranked light card that makes no new
// run goes dark instead (the share ends a little lower when none fits). placedModes = [placeCards(...) for each mode].
export function balanceDark(projects, placedModes) {
  projects.forEach((list, pj) => {
    const pi = slugSeed(list[0]?.slug || ''), pi2 = pj;
    const orig = list.map((c, k) => k).filter((k) => !list[k].dup);
    const rk = (k) => mix(list[k].hash, WORK.seed + pi + 53);
    const byRank = orig.slice().sort((a, b) => rk(a) - rk(b));
    const orders = placedModes.map((pl) => orig.slice().sort((a, b) => pl[pi2][a].along - pl[pi2][b].along));
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

// ---- R22e: overlap rules on the Work page ------------------------------------------------------------------------------------------------
// The frame sizes of both modes for a window (the same numbers work.js lays out with).
export function workMetrics(W, H, scale) {
  const fw = (WORK.frameW * W) / 100, fh = (WORK.frameH * H) / 100;
  const mk = (v) => ({ vertical: v, alongF: v ? fh : fw, crossF: v ? fw : fh, scale, gap: v ? (WORK.gapVert * H) / 100 : (WORK.gapSide * W) / 100, gapPx: (WORK.dupGap * (v ? H : W)) / 100, viewAlong: v ? H : W, viewCross: v ? W : H });
  return { side: mk(false), vertical: mk(true) };
}

// R29: the LOAD-TIME FALLBACK pass, only for a project that has no stored layout (src/data/layouts.json, tools/layout-solve.mjs) or when the rule numbers
// were changed in ?tune: the rules of overlap.js in the states of LAYOUT_STATES (work/states.js), both modes, the view centred on each project (the loop seam
// is covered). Fixes: nudge along the strip (per mode, stored in card.nudge[mode], px at 1920), across it (nudgeX), swap depth, drop; then undark for the
// cluster rule and the light-share floor. structural = false (a resize): nudges only. Returns { fixed, remaining, steps, dark }.
export const fixWorkLayout = (projects, Ms, opts) => drain(fixWorkLayoutGen(projects, Ms, opts));
// the same pass in time slices: runs the generator for about sliceMs, then gives the main thread back (paint, input) and goes on. Result identical.
export async function fixWorkLayoutIdle(projects, Ms, opts, sliceMs = 10) {
  const gen = fixWorkLayoutGen(projects, Ms, opts);
  const pause = () => (globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r)));
  let t0 = performance.now(), r;
  while (!(r = gen.next()).done) if (performance.now() - t0 > sliceMs) { await pause(); t0 = performance.now(); }
  return r.value;
}
export function* fixWorkLayoutGen(projects, Ms, { structural = true, check = false } = {}) {
  let placed = null, flat = [], scen = [], darkArr = [];
  const modes = ['side', 'vertical'];
  let builds = 0;
  const build = () => {
    builds++;
    placed = { side: placeCards(projects, Ms.side), vertical: placeCards(projects, Ms.vertical) };
    flat = [];
    projects.forEach((list, pi) => list.forEach((c, k) => flat.push({ c, pi, k })));
    darkArr = flat.map((f) => !!f.c.dark);
    scen = [];
    for (const mode of modes) scen.push(...workScenarios(stateData(projects, Ms[mode], placed[mode]), mode, true));
  };
  const idxOf = (c) => flat.findIndex((f) => f.c === c);
  const bound = (mode) => { const M = Ms[mode], pitchVh = (M.alongF + M.gap) / M.scale / 10.8; return M.alongF / 2 + M.gap / 2 + Math.max(CARD_SIZE.bandSlack, WORK.slack * pitchVh) * 10.8 * M.scale; };
  const rankOf = (i) => mix(flat[i].c.hash, WORK.seed + 53);
  let belowMin = false; // the very last resort (see the end): a band may go under its minimum card count
  const ctx = {
    get n() { return flat.length; },
    dark: () => darkArr,
    setDark: (i, v) => { flat[i].c.dark = v; darkArr[i] = v; },
    groups: () => projects.map((list, pi) => flat.map((f, i) => (f.pi === pi ? i : -1)).filter((i) => i >= 0)),
    scenarios: () => scen,
    rank: rankOf,
    locked: (i) => !!(flat[i].c.dup || flat[i].c.hasDup),
    isDup: (i) => !!flat[i].c.dup,
    // a duplicate pair translates as one along the strip (its distance is kept), inside both cards' bands
    nudgeRange: (i, mode) => {
      let lo = -Infinity, hi = Infinity;
      for (const g of ctx.group(i)) { const f = flat[g], along = placed[mode][f.pi][f.k].along, b = bound(mode); lo = Math.max(lo, -b - along); hi = Math.min(hi, b - along); }
      return { lo, hi };
    },
    nudge: (i, d, mode) => {
      const { lo, hi } = ctx.nudgeRange(i, mode), a = Math.max(lo, Math.min(hi, d)), M = Ms[mode];
      for (const g of ctx.group(i)) {
        const f = flat[g];
        f.c.nudge = f.c.nudge || { side: 0, vertical: 0 };
        f.c.nudge[mode] += a / M.scale;
        placed[mode][f.pi][f.k].along += a;
        for (const s of scen) if (s.mode === mode) s.y[g] += a; // the scenarios follow (the focus push is kept as computed: checked again at the end)
      }
      return a;
    },
    // across the strip (the side and the band stay): between the image edge (a card may overlap it by overlapMax) and the screen edge
    nudgeXRange: (i, mode) => {
      const f = flat[i], M = Ms[mode], q = placed[mode][f.pi][f.k], cs = q.crossSize;
      const xLo = M.crossF / 2 - WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6), x = q.cross;
      return x >= 0 ? { lo: xLo - x, hi: xHi - x } : { lo: -xHi - x, hi: -xLo - x };
    },
    nudgeX: (i, d, mode) => {
      const f = flat[i], { lo, hi } = ctx.nudgeXRange(i, mode), a = Math.max(lo, Math.min(hi, d)), M = Ms[mode];
      f.c.nudgeX = f.c.nudgeX || { side: 0, vertical: 0 };
      f.c.nudgeX[mode] += a / M.scale;
      placed[mode][f.pi][f.k].cross += a;
      for (const s of scen) if (s.mode === mode) s.x[i] += a;
      return a;
    },
    group: (i) => { const c = flat[i].c, t = c.dup ? c.twin : c.hasDup ? flat.find((g) => g.c.dup && g.c.twin === c)?.c : null; const ti = t ? idxOf(t) : -1; return ti >= 0 ? [i, ti] : [i]; },
    refresh: () => build(),
    structural: structural ? {
      swapDepth: (i, attempt) => {
        const f = flat[i], c = f.c;
        const others = projects[f.pi].filter((o) => o !== c && !o.dup && !o.hasDup && Math.abs(o.mouse - c.mouse) >= 10).sort((p, q) => Math.abs(q.mouse - c.mouse) - Math.abs(p.mouse - c.mouse) || mix(p.hash, WORK.seed + 53) - mix(q.hash, WORK.seed + 53));
        const o = others[attempt];
        if (!o) return null;
        const swap = () => { for (const k of ['mouse', 'z', 'depth', 'front']) { const t = c[k]; c[k] = o[k]; o[k] = t; } };
        swap();
        return { revert: swap };
      },
      drop: (i) => {
        const f = flat[i], c = f.c, list = projects[f.pi];
        if (c.dup || c.hasDup || (list.length <= WORK_LIMITS.minN && !belowMin)) return null;
        const top = list.filter((o) => o.edge < 0).length - (c.edge < 0 ? 1 : 0);
        if (Math.abs(list.length - 1 - 2 * top) > 1) return null; // the edges stay even
        const at = list.indexOf(c);
        list.splice(at, 1);
        return { revert: () => { list.splice(at, 0, c); } };
      },
    } : null,
  };
  build();
  if (check) { const l = allViolations(ctx, BAND_RULES); const copy = darkArr.slice(), d = enforceDark({ ...ctx, n: flat.length, setDark: (i, v) => { copy[i] = v; }, dark: () => copy }, BAND_RULES); /* on a copy: report only */ return { fixed: l.length === 0, remaining: l, steps: 0, dark: d }; } // report only
  let res = yield* fixOverlapsGen(ctx, BAND_RULES);
  for (let round = 0; round < 3; round++) {
    yield;
    balanceDark(projects, [placed.side, placed.vertical]);
    build();
    const left = allViolations(ctx, BAND_RULES);
    if (!left.length) { res = { fixed: true, remaining: [], steps: res.steps }; break; }
    res = yield* fixOverlapsGen(ctx, BAND_RULES);
    if (res.fixed) { balanceDark(projects, [placed.side, placed.vertical]); build(); const l2 = allViolations(ctx, BAND_RULES); res = { fixed: l2.length === 0, remaining: l2, steps: res.steps }; if (!l2.length) break; }
  }
  // a band so crowded that nothing above could clear its last violation: the rules win over the minimum card count (only reached when violations are left)
  if (!res.fixed && structural) {
    belowMin = true;
    res = yield* fixOverlapsGen(ctx, BAND_RULES);
    balanceDark(projects, [placed.side, placed.vertical]); build();
    const l3 = allViolations(ctx, BAND_RULES); res = { fixed: l3.length === 0, remaining: l3, steps: res.steps };
  }
  // R29 rules 2 and 3: undark (cards never move for them)
  res.dark = enforceDark(ctx, BAND_RULES);
  res.builds = builds;
  return res;
}
