// R22e: ONE overlap rule set + ONE deterministic fix pass for the Selected Work cards (homepage, cards-gen.js) and the Work page cards
// (work/cards.js). Rules (BAND_RULES in timeline.js, all tunable):
//   1. no point is covered by 3 or more cards (any pair may overlap);
//   2. two cards that both carry the dark rest layer overlap by at most darkOverlapMax of the smaller card's area (they merge into one
//      black blob otherwise: the near-black layers are identical);
//   3. any pair overlaps by at most pairOverlapMax of the smaller card's area (a card never mostly hides another).
// They are checked on the laid-out positions at rest AND in every "scenario" the caller supplies (the cards move by depth: mouse drift at
// its extremes, the aura / parting, the Work page's focus push, the other mode ...): a pair that looks safe can stack once cards shift.
// The fix pass nudges the violating card along its band (the smallest move that lowers the violations, inside the band), then undarks it
// (never a duplicate) or swaps its depth with another card, and as a last resort drops it (only if its band stays at its minimum).
// Everything is deterministic: same cards in, same layout out.
export const OVERLAP_EPS = 1e-6;

// x, y = centres, w, h = sizes (same unit), dark[] flags; returns a list of { type: 'pair' | 'dark' | 'triple', cards: [i, j(, k)], excess }
export function findViolations(x, y, w, h, dark, n, rules, only = -1, dx = null, dy = null) {
  // `only`: -1 = all, an index, or an array of indices: only the violations that involve one of them (what a move of those cards can change)
  const oset = Array.isArray(only) ? new Set(only) : null;
  const has = (i) => (oset ? oset.has(i) : i === only);
  const all = !oset && only < 0;
  // positions are x[i] + dx[i], y[i] + dy[i] (the scenario's shifts; null = none), added once per call
  let px = x, py = y;
  if (dx) { px = new Float64Array(n); for (let i = 0; i < n; i++) px[i] = x[i] + dx[i]; }
  if (dy) { py = new Float64Array(n); for (let i = 0; i < n; i++) py[i] = y[i] + dy[i]; }
  const X = (i) => px[i];
  const Y = (i) => py[i];
  const out = [];
  const near = new Array(n); // per card, created on its first neighbour (most calls touch only a few)
  const members = all ? null : (oset ? [...oset] : [only]).sort((a, b) => a - b); // R22j: with `only`, visit just the pairs that involve one of them
  const pair = (i, j) => {
    const ox = (w[i] + w[j]) / 2 - Math.abs(px[i] - px[j]);
    if (ox <= 0) return;
    const oy = (h[i] + h[j]) / 2 - Math.abs(py[i] - py[j]);
    if (oy <= 0) return;
    (near[i] || (near[i] = [])).push(j); (near[j] || (near[j] = [])).push(i);
    const frac = (ox * oy) / Math.min(w[i] * h[i], w[j] * h[j]);
    if (frac > rules.pairOverlapMax + OVERLAP_EPS) out.push({ type: 'pair', cards: [i, j], excess: frac - rules.pairOverlapMax });
    else if (dark[i] && dark[j] && frac > rules.darkOverlapMax + OVERLAP_EPS) out.push({ type: 'dark', cards: [i, j], excess: frac - rules.darkOverlapMax });
  };
  if (all) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pair(i, j);
  } else {
    for (let i = 0; i < n; i++) {
      if (has(i)) for (let j = i + 1; j < n; j++) pair(i, j);
      else for (const m of members) if (m > i && m < n) pair(i, m);
    }
  }
  for (let i = 0; i < n; i++) {
    const ni = near[i];
    if (!ni || (!all && !has(i) && !ni.some(has))) continue;
    for (const j of ni) {
      if (j <= i) continue;
      for (const k of ni) {
        if (!all && !has(i) && !has(j) && !has(k)) continue;
        if (k <= j) continue;
        // k must border j as well, and the three rectangles must share a region (not just pairwise corners)
        const xi = X(i), xj = X(j), xk = X(k), yi = Y(i), yj = Y(j), yk = Y(k);
        const ix = Math.min(xi + w[i] / 2, xj + w[j] / 2, xk + w[k] / 2) - Math.max(xi - w[i] / 2, xj - w[j] / 2, xk - w[k] / 2);
        const iy = Math.min(yi + h[i] / 2, yj + h[j] / 2, yk + h[k] / 2) - Math.max(yi - h[i] / 2, yj - h[j] / 2, yk - h[k] / 2);
        if (ix > 0.5 && iy > 0.5) out.push({ type: 'triple', cards: [i, j, k], excess: Math.min(ix, iy) / 100 });
      }
    }
  }
  return out;
}

// All scenarios together: the violations (deduplicated by type + cards) with the worst excess seen.
export function allViolations(ctx, rules, only = -1) {
  const map = new Map();
  const base = ctx.base ? ctx.base() : null;
  const dark = ctx.dark(); // once per call (it does not change between scenarios)
  for (const sc of ctx.scenarios()) {
    // a scenario either shifts the shared base (dx, dy) or carries its own absolute positions (x, y: the Work page, one set per mode / view)
    const list = sc.x ? findViolations(sc.x, sc.y, sc.w || ctx.w, sc.h || ctx.h, dark, sc.x.length, rules, only) : findViolations(base.x, base.y, ctx.w, ctx.h, dark, ctx.n, rules, only, sc.dx, sc.dy);
    for (const v of list) {
      if (sc.mode !== undefined) v.mode = sc.mode;
      const key = `${sc.mode ?? ''}${v.type}:${v.cards.join(',')}`;
      const old = map.get(key);
      if (!old || v.excess > old.excess) map.set(key, v);
    }
  }
  return [...map.values()];
}
const score = (list) => list.reduce((a, v) => a + 1 + v.excess, 0);

// ctx = {
//   n, w[], h[],            sizes (same unit as the scenarios' x / y)
//   dark(): bool[]          current dark flags
//   base(): {x, y}          the laid-out positions of the CURRENT state, nudges included (arrays, edited in place by nudge())
//   scenarios(): [{dx, dy}] the shifts of each scenario (index 0 = at rest, all zero); fixed until refresh()
//   rank(i)                 stable priority (higher = gives way first)
//   locked(i)               true: the card may not be dropped / swapped (a duplicate pair)
//   isDup(i)                a duplicate: its dark layer is forced
//   nudgeRange(i)           { lo, hi } the along-the-band distance the card may still move (px)
//   nudge(i, d)             add d to the card's along-the-band adjustment (and clamp inside the range); returns the d applied
//   structural?: { undark(i), swapDepth(i), drop(i) } each returns true if it changed something; after a change `refresh()` is called
//   refresh()               recompute whatever the scenarios depend on (the layout)
// }
// returns { fixed, remaining[] (violations left), steps }
// R22j: written as a generator that yields between steps (and between candidates): fixOverlaps runs it to the end (same result, synchronous);
// the Work page drives it in time slices (work/cards.js fixWorkLayoutIdle) so the load never has a long task.
export const drain = (gen) => { let r; while (!(r = gen.next()).done); return r.value; };
export const fixOverlaps = (ctx, rules, opts) => drain(fixOverlapsGen(ctx, rules, opts));
export function* fixOverlapsGen(ctx, rules, { maxSteps = 80, step = 8, range = 36 } = {}) {
  let steps = 0;
  let list = allViolations(ctx, rules);
  const stuck = new Set();
  while (list.length && steps < maxSteps) {
    steps++;
    yield;
    list.sort((a, b) => b.excess - a.excess || (a.cards.join() < b.cards.join() ? -1 : 1));
    const v = list.find((q) => !stuck.has(`${q.mode ?? ''}${q.type}:${q.cards.join(',')}`));
    if (!v) break;
    const cand = v.cards.slice().sort((a, b) => ctx.rank(b) - ctx.rank(a)); // highest rank first
    const before = score(list);
    let done = false;
    // (a) nudge along the band: the smallest move that lowers the total
    for (const t of cand) {
      yield;
      const { lo, hi } = ctx.nudgeRange(t, v.mode);
      const group = ctx.group ? ctx.group(t) : [t]; // the cards that move together (a duplicate pair translates as one)
      const mine = score(allViolations(ctx, rules, group)); // only the violations that involve them change when they move
      let bestD = null, bestS = mine - 1e-9;
      for (let k = 1; k <= range; k++) {
        for (const sgn of [1, -1]) {
          const d = sgn * k * step;
          if (d < lo - 1e-9 || d > hi + 1e-9) continue;
          const applied = ctx.nudge(t, d, v.mode);
          const sc = score(allViolations(ctx, rules, group));
          ctx.nudge(t, -applied, v.mode);
          if (sc < bestS - 1e-9) { bestS = sc; bestD = d; }
          if (sc <= 1e-9) break;
        }
        if (bestD !== null && bestS <= 1e-9) break; // clean: the smallest move that clears it
      }
      if (bestD !== null) { ctx.nudge(t, bestD, v.mode); list = allViolations(ctx, rules); done = true; break; }
    }
    if (done) continue;
    // (a2) across the strip: outward / inward in the card's own side (the band and the side stay), the smallest move that lowers the total
    if (ctx.nudgeX) {
      for (const t of cand) {
        const { lo, hi } = ctx.nudgeXRange(t, v.mode);
        const mine = score(allViolations(ctx, rules, [t]));
        let bestD = null, bestS = mine - 1e-9;
        for (let k = 1; k <= range; k++) {
          for (const sgn of [1, -1]) {
            const d = sgn * k * step;
            if (d < lo - 1e-9 || d > hi + 1e-9) continue;
            const applied = ctx.nudgeX(t, d, v.mode);
            const sc = score(allViolations(ctx, rules, [t]));
            ctx.nudgeX(t, -applied, v.mode);
            if (sc < bestS - 1e-9) { bestS = sc; bestD = d; }
          }
          if (bestD !== null && bestS <= 1e-9) break;
        }
        if (bestD !== null) { ctx.nudgeX(t, bestD, v.mode); list = allViolations(ctx, rules); done = true; break; }
      }
    }
    if (done) continue;
    // (b) structural: undark (not a duplicate), or swap the depth
    if (ctx.structural) {
      for (const t of cand) {
        for (const act of ['undark', 'swapDepth']) {
          if (act === 'undark' && (v.type !== 'dark' || ctx.isDup(t))) continue;
          if (act === 'swapDepth' && ctx.locked(t)) continue;
          for (let attempt = 0; attempt < (act === 'swapDepth' ? 2 : 1) && !done; attempt++) {
            const undo = ctx.structural[act](t, attempt);
            if (!undo) break;
            if (undo.layout !== false) ctx.refresh();
            const now = allViolations(ctx, rules);
            if (score(now) < before - 1e-9) { list = now; done = true; break; }
            undo.revert(); if (undo.layout !== false) ctx.refresh();
          }
          if (done) break;
        }
        if (done) break;
      }
      if (done) continue;
      // (c) drop a card (only if its band stays at its minimum)
      for (const t of cand) {
        if (ctx.locked(t)) continue;
        const undo = ctx.structural.drop(t);
        if (!undo) continue;
        ctx.refresh();
        const now = allViolations(ctx, rules);
        if (score(now) < before - 1e-9) { list = now; done = true; break; }
        undo.revert(); ctx.refresh();
      }
      if (done) continue;
    }
    // (d) R22j: two cards together. When no single card can move out without running into a third one (a crowded band), move BOTH (a coarse grid:
    // every 3rd step, within the band) and take the pair of moves that lowers the total of everything that involves either card. Only reached for
    // violations the steps above could not fix, so layouts that were already clean do not change.
    if (v.cards.length === 2 && v.type !== 'triple' && ctx.nudgeRange) {
      const [ta, tb] = cand, grp = [...new Set([...(ctx.group ? ctx.group(ta) : [ta]), ...(ctx.group ? ctx.group(tb) : [tb])])];
      const ra = ctx.nudgeRange(ta, v.mode), rb = ctx.nudgeRange(tb, v.mode), g = step * 3, lim = range * step;
      let bestS = score(allViolations(ctx, rules, grp)) - 1e-9, bestA = null, bestB = null;
      for (let da = Math.max(ra.lo, -lim); da <= Math.min(ra.hi, lim); da += g) {
        yield;
        const ap = ctx.nudge(ta, da, v.mode);
        for (let db = Math.max(rb.lo, -lim); db <= Math.min(rb.hi, lim); db += g) {
          const bp = ctx.nudge(tb, db, v.mode);
          const sc = score(allViolations(ctx, rules, grp));
          ctx.nudge(tb, -bp, v.mode);
          if (sc < bestS - 1e-9) { bestS = sc; bestA = da; bestB = db; }
        }
        ctx.nudge(ta, -ap, v.mode);
      }
      if (bestA !== null) { ctx.nudge(ta, bestA, v.mode); ctx.nudge(tb, bestB, v.mode); list = allViolations(ctx, rules); continue; }
    }
    stuck.add(`${v.mode ?? ''}${v.type}:${v.cards.join(',')}`);
    list = list; // this one cannot be fixed; carry on with the others
  }
  return { fixed: list.length === 0, remaining: list, steps };
}
