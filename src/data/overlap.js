// R22e / R29: ONE overlap rule set for the Selected Work cards (homepage, cards-gen.js) and the Work page cards (work/cards.js). Rules (BAND_RULES in
// timeline.js, all tunable), checked in the states of LAYOUT_STATES (the ones Anh mostly sees: rest, the drift at half, the focus push, the ambient drift at
// its end; NOT the extremes):
//   1. any pair overlaps by at most pairOverlapMax of the smaller card's area (a card never mostly hides another);
//   2. a CLUSTER (cards linked by an overlap of at least clusterLink of the smaller card, in any checked state) holds at most maxDarkPerCluster cards with
//      the dark rest layer (the black-blob problem only comes from dark cards merging; light cards may overlap freely up to rule 1);
//   3. at least minLightShare of the cards of a project (Work, per mode) / of the homepage are light.
// R29: rules 2 and 3 are met by UNDARKING only (cards never move for them). The fix pass below (nudge along the band, swap depth, drop) is the FALLBACK for
// a project without a stored layout; the offline solver (tools/layout-solve.mjs) writes src/data/layouts.json and the runtime just loads it.
// Everything is deterministic: same cards in, same layout out.
export const OVERLAP_EPS = 1e-6;

// x, y = centres, w, h = sizes (same unit), dark[] flags (unused now); returns a list of { type: 'pair', cards: [i, j], excess }
export function findViolations(x, y, w, h, dark, n, rules, only = -1, dx = null, dy = null) {
  // `only`: -1 = all, an index, or an array of indices: only the violations that involve one of them (what a move of those cards can change)
  const oset = Array.isArray(only) ? new Set(only) : null;
  const has = (i) => (oset ? oset.has(i) : i === only);
  const all = !oset && only < 0;
  // positions are x[i] + dx[i], y[i] + dy[i] (the scenario's shifts; null = none), added once per call
  let px = x, py = y;
  if (dx) { px = new Float64Array(n); for (let i = 0; i < n; i++) px[i] = x[i] + dx[i]; }
  if (dy) { py = new Float64Array(n); for (let i = 0; i < n; i++) py[i] = y[i] + dy[i]; }
  const out = [];
  const members = all ? null : (oset ? [...oset] : [only]).sort((a, b) => a - b); // with `only`, visit just the pairs that involve one of them
  const pair = (i, j) => {
    const ox = (w[i] + w[j]) / 2 - Math.abs(px[i] - px[j]);
    if (ox <= 0) return;
    const oy = (h[i] + h[j]) / 2 - Math.abs(py[i] - py[j]);
    if (oy <= 0) return;
    const frac = (ox * oy) / Math.min(w[i] * h[i], w[j] * h[j]);
    if (frac > rules.pairOverlapMax + OVERLAP_EPS) out.push({ type: 'pair', cards: [i, j], excess: frac - rules.pairOverlapMax });
  };
  if (all) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pair(i, j);
  } else {
    for (let i = 0; i < n; i++) {
      if (has(i)) for (let j = i + 1; j < n; j++) pair(i, j);
      else for (const m of members) if (m > i && m < n) pair(i, m);
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
// R29: the pairs linked (overlap >= rules.clusterLink of the smaller card) in ANY scenario, as [i, j] pairs (i < j)
export function linkedPairs(ctx, rules) {
  const base = ctx.base ? ctx.base() : null, set = new Set(), out = [];
  for (const sc of ctx.scenarios()) {
    const x = sc.x || base.x, y = sc.y || base.y, w = sc.w || ctx.w, h = sc.h || ctx.h, n = x.length, dx = sc.x ? null : sc.dx, dy = sc.x ? null : sc.dy;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const ox = (w[i] + w[j]) / 2 - Math.abs(x[i] + (dx ? dx[i] : 0) - x[j] - (dx ? dx[j] : 0));
      if (ox <= 0) continue;
      const oy = (h[i] + h[j]) / 2 - Math.abs(y[i] + (dy ? dy[i] : 0) - y[j] - (dy ? dy[j] : 0));
      if (oy <= 0) continue;
      if ((ox * oy) / Math.min(w[i] * h[i], w[j] * h[j]) >= rules.clusterLink) { const k = i * 4096 + j; if (!set.has(k)) { set.add(k); out.push([i, j]); } }
    }
  }
  return out;
}
// clusters (arrays of card indices, size >= 2) from the linked pairs
export function clustersOf(n, pairs) {
  const par = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (const [i, j] of pairs) par[find(i)] = find(j);
  const m = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r).push(i); }
  return [...m.values()].filter((c) => c.length > 1);
}
// R29 rules 2 and 3 by undarking only. ctx.dark() = flags (edited through ctx.setDark(i, false)), ctx.rank(i) (higher = gives way first), ctx.isDup(i) (forced
// dark: never touched), ctx.groups() = arrays of card indices for the light-share floor (a project in one mode / the homepage), ctx.n = card count.
// Returns { clusters: [clusters still over the limit], floor: [groups still under the floor], undarked }.
export function enforceDark(ctx, rules) {
  const n = ctx.n, dark = ctx.dark(); let undarked = 0;
  const pairs = linkedPairs(ctx, rules), clusters = clustersOf(n, pairs);
  const rankOf = (a, b) => ctx.rank(b) - ctx.rank(a);
  const stuckClusters = [];
  for (const cl of clusters) {
    for (;;) {
      const d = cl.filter((i) => dark[i]);
      if (d.length <= rules.maxDarkPerCluster) break;
      const cand = d.filter((i) => !ctx.isDup(i)).sort(rankOf)[0];
      if (cand === undefined) { stuckClusters.push({ cards: d, dups: d.length }); break; } // an all-duplicate cluster: the caller nudges the pair apart
      ctx.setDark(cand, false); undarked++;
    }
  }
  const floor = [];
  for (const g of ctx.groups()) {
    const need = Math.ceil(rules.minLightShare * g.length - 1e-9);
    for (;;) {
      const light = g.filter((i) => !dark[i]).length;
      if (light >= need) break;
      const cand = g.filter((i) => dark[i] && !ctx.isDup(i)).sort(rankOf)[0];
      if (cand === undefined) { floor.push({ group: g, light, need }); break; } // the duplicates alone break the floor: reported
      ctx.setDark(cand, false); undarked++;
    }
  }
  return { clusters: stuckClusters, floor, undarked };
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
