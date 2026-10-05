// R29: the OFFLINE card layout solver. `npm run layout` (all projects, all sizes), `npm run layout -- --relayout <slug>` (re-solve one project from scratch),
// `--sizes 1920x1080,2560x1440` (only those), `--iters 120000`, `--quick`.
// Per window size (16:9: 1920x1080, 2560x1440, 3840x2160; 16:10: 1440x900, 1512x982, 1728x1117) and per Work mode (side, vertical): the cards of every project
// start from the seeded placement (work/cards.js placeCards: a project's seed comes from its slug) and a seeded simulated annealing moves them (along / across the
// strip, inside their band and side) until no pair overlaps beyond BAND_RULES.pairOverlapMax in ANY checked state (LAYOUT_STATES: rest, drift at half, the focus
// push of each project, the ambient drift at its end; the loop seam included). Then the dark flags: undark only (clusters over maxDarkPerCluster, the light-share
// floor). Everything is re-checked with the REAL focus push (work/focus.js, nudge pass included) before a layout is accepted. Output: src/data/layouts.json.
// Incremental: a project whose inputs hash is unchanged keeps its stored cards (locked); a changed project keeps the stored positions of the cards it already had
// and places only the new ones. Same inputs = same file, byte for byte.
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const C = await import('../src/work/cards.js'); const ST = await import('../src/work/states.js'); const T = await import('../src/timeline.js'); const O = await import('../src/data/overlap.js');
const LS = await import('../src/work/layout-store.js'); const { solveMode } = await import('./lib/solve-core.mjs');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const relayout = arg('--relayout', null), quick = argv.includes('--quick');
const iters = Number(arg('--iters', quick ? 30000 : 150000));
const sizeList = (arg('--sizes', null) || Object.values(LS.SIZES).flat().map(([w, h]) => `${w}x${h}`).join(',')).split(',').map((s) => s.split('x').map(Number));
const OUT = arg('--out', 'src/data/layouts.json'), POOLFILE = arg('--pool', 'src/data/work-pool.json'), STOREDFILE = arg('--stored', OUT);
const pool = JSON.parse(fs.readFileSync(POOLFILE, 'utf8')); const data = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8'));
const slugs = data.projects.map((p) => p.slug);
const stored = fs.existsSync(STOREDFILE) ? JSON.parse(fs.readFileSync(STOREDFILE, 'utf8')) : null;
const modes = ['side', 'vertical'];
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const sig = LS.ruleSignature();
const fresh = () => C.buildProjectCards(pool, slugs);
const BR = T.BAND_RULES;
const t0 = Date.now();
const log = (...a) => console.log(...a);

// ---- 1. the cards (the same for every size and mode) and their dark flags -------------------------------------------------------------------------------------
const pcAll = fresh();
const keep = (stored && stored.signature === sig && !relayout) ? stored : (stored && stored.signature === sig ? stored : null); // a changed rule signature re-solves everything
const sizes = sizeList.map(([W, H]) => ({ W, H, key: LS.sizeKey(W, H), Ms: C.workMetrics(W, H, Math.min(W, 1920) / 1920) }));

const result = { v: 1, signature: sig, rules: { pairOverlapMax: BR.pairOverlapMax, clusterLink: BR.clusterLink, maxDarkPerCluster: BR.maxDarkPerCluster, minLightShare: BR.minLightShare, states: T.LAYOUT_STATES }, dark: {}, work: {} };
// sizes not asked for are kept as stored
if (keep) for (const [k, v] of Object.entries(keep.work || {})) if (!sizes.some((s) => s.key === k)) result.work[k] = v;
const keptHome = {}; if (keep) for (const [k, v] of Object.entries(keep.home || {})) if (!sizes.some((s) => s.key === k)) keptHome[k] = v;

const placedAll = []; // for the dark-run balance
const solved = {}; // key -> mode -> { placed (per project arrays), S }
let anyViolation = 0;
for (const sz of sizes) {
  result.work[sz.key] = {}; solved[sz.key] = {};
  for (const mode of modes) {
    const M = sz.Ms[mode];
    const base = C.placeCards(pcAll, M);
    const S = ST.stateData(pcAll, M, base);
    const n = S.n, locked = new Uint8Array(n), aLo = new Float64Array(n), aHi = new Float64Array(n), cLo = new Float64Array(n), cHi = new Float64Array(n), side = new Int8Array(n), twin = new Int32Array(n).fill(-1);
    const pitchVh = (M.alongF + M.gap) / M.scale / 10.8, b = M.alongF / 2 + M.gap / 2 + Math.max(T.CARD_SIZE.bandSlack, T.WORK.slack * pitchVh) * 10.8 * M.scale;
    S.flat.forEach((f, i) => {
      const cs = S.Wv[i], xLo = M.crossF / 2 - T.WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6);
      aLo[i] = -b; aHi[i] = b; cLo[i] = xLo; cHi[i] = xHi; side[i] = S.X0[i] >= 0 ? 1 : -1;
      if (f.c.dup) twin[i] = S.flat.findIndex((g) => g.c === f.c.twin); else if (f.c.hasDup) twin[i] = S.flat.findIndex((g) => g.c.dup && g.c.twin === f.c);
    });
    // the generated start may sit a pixel outside the band (rounding in the generator): bring it inside before anything moves
    S.flat.forEach((f, i) => { S.X0[i] = side[i] * Math.max(cLo[i], Math.min(cHi[i], Math.abs(S.X0[i]))); const bs = f.pi * S.pitch; S.Y0[i] = bs + Math.max(aLo[i], Math.min(aHi[i], S.Y0[i] - bs)); });
    // locking: an unchanged project keeps its stored cards; a changed one keeps the positions of the cards it had
    const projHash = pcAll.map((l) => LS.projectHash(l, M));
    S.flat.forEach((f, i) => {
      const st = keep?.work?.[sz.key]?.[mode]?.[f.c.slug];
      if (!st || relayout === f.c.slug) return;
      const p = st.cards[LS.cardId(f.c)];
      if (!p) return;
      S.X0[i] = p[1]; S.Y0[i] = f.pi * S.pitch + p[0]; // start from the stored position
      if (st.hash === projHash[f.pi]) locked[i] = 1; else if (st.cards[LS.cardId(f.c)]) locked[i] = 1; // cards already stored stay where they are
    });
    // a duplicate pair is locked or free together
    for (let i = 0; i < n; i++) if (twin[i] >= 0 && (locked[i] || locked[twin[i]])) { locked[i] = locked[twin[i]] = 1; }
    const res = solveMode(S, { wrapP: ST.wrapP, focusPos: ST.focusPos }, { seed: hashOf(`${sz.key}|${mode}|${iters}`), iters, pairMax: BR.pairOverlapMax * 0.97, drift: T.LAYOUT_STATES.drift, ambient: T.LAYOUT_STATES.ambientEnd && T.WORK.ambFrame > 0, focus: T.LAYOUT_STATES.focus, locked, aLo, aHi, cLo, cHi, side, twin });
    // polish with the REAL focus push (applyFocus including its nudge pass): the annealing used the separable form, the nudge can still push two cards together
    {
      const S2 = { ...S, X0: Float64Array.from(res.X), Y0: Float64Array.from(res.Y) };
      const evalReal = () => { const scen = ST.workScenarios(S2, mode, true); const ctx = { n, scenarios: () => scen, dark: () => [], rank: () => 0, isDup: () => false }; const v = O.allViolations(ctx, BR); return { e: v.reduce((a2, q) => a2 + 1 + q.excess, 0), v }; };
      let cur = evalReal(), tries = 0;
      let a0 = hashOf(`${sz.key}|${mode}|polish`) >>> 0; const rnd = () => { a0 = (a0 + 0x6d2b79f5) >>> 0; let t = a0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      while (cur.e > 0 && tries < 6000) {
        tries++;
        const pair = cur.v[Math.floor(rnd() * cur.v.length)].cards, i = pair[rnd() < 0.5 ? 0 : 1];
        if (locked[i]) continue;
        const g = twin[i] >= 0 && !locked[twin[i]] ? [i, twin[i]] : [i], oX = g.map((q) => S2.X0[q]), oY = g.map((q) => S2.Y0[q]);
        const sig = 6 + 40 * rnd();
        if (rnd() < 0.7) { const d = (rnd() - 0.5) * 2 * sig; for (const q of g) { const bs = S.flat[q].pi * S.pitch; S2.Y0[q] = bs + Math.max(aLo[q], Math.min(aHi[q], S2.Y0[q] - bs + d)); } }
        else { const d = (rnd() - 0.5) * 2 * sig; const q = i; S2.X0[q] = side[q] * Math.max(cLo[q], Math.min(cHi[q], Math.abs(S2.X0[q]) + d * side[q])); }
        const nx = evalReal();
        if (nx.e <= cur.e) cur = nx; else g.forEach((q, k) => { S2.X0[q] = oX[k]; S2.Y0[q] = oY[k]; });
      }
      res.X = S2.X0; res.Y = S2.Y0; res.polish = `${tries} polish tries, ${cur.v.length} left`;
    }
    // write back
    const placed = pcAll.map((list) => new Array(list.length));
    S.flat.forEach((f, i) => { placed[f.pi][f.k] = { along: res.Y[i] - f.pi * S.pitch, cross: res.X[i], w: S.Wv[i], h: S.Hv[i], alongSize: S.Hv[i], crossSize: S.Wv[i] }; });
    solved[sz.key][mode] = { placed, M, projHash };
    placedAll.push(placed);
    log(`${sz.key} ${mode.padEnd(8)} annealed: ${res.free} free cards, remaining overlap energy ${res.energy.toExponential(2)}, ${res.polish}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}

// ---- 2. dark flags: the seeded draw, the run rule along the strip, then undark for the cluster rule and the light-share floor --------------------------------
const pcDark = fresh();
const storedDark = keep?.dark || {};
if (!relayout) pcDark.forEach((l) => l.forEach((c) => { const d = storedDark[c.slug]; if (d && LS.cardId(c) in d && Object.keys(d).length === l.length) c.dark = !!d[LS.cardId(c)]; }));
// the placed arrays hold positions only (no card objects): balanceDark wants card lists + placements aligned with them
const anyStoredProject = (slug) => !relayout || relayout !== slug;
C.balanceDark(pcDark, placedAll.map((pl) => pl.map((row) => row)));

// the contexts for the dark rules: one per size and mode, the dark flags shared
const darkFlags = new Map(); pcDark.forEach((l) => l.forEach((c) => darkFlags.set(c, !!c.dark)));
const flatCards = pcDark.flat();
let undarkedTotal = 0; const stuck = [];
for (const sz of sizes) for (const mode of modes) {
  const { placed, M } = solved[sz.key][mode];
  const S = ST.stateData(pcDark, M, placed);
  const scen = ST.workScenarios(S, mode, true);
  const dark = flatCards.map((c) => !!c.dark);
  const ctx = { n: flatCards.length, scenarios: () => scen, dark: () => dark, setDark: (i, v) => { flatCards[i].dark = v; dark[i] = v; }, rank: (i) => C.__rank ? C.__rank(flatCards[i]) : hashOf(LS.cardId(flatCards[i]) + 'r'), isDup: (i) => !!flatCards[i].dup, groups: () => pcDark.map((l, pi) => flatCards.map((c, i) => (c.slug === l[0].slug ? i : -1)).filter((i) => i >= 0)) };
  const d = O.enforceDark(ctx, BR);
  undarkedTotal += d.undarked; if (d.clusters.length || d.floor.length) stuck.push({ size: sz.key, mode, clusters: d.clusters.length, floor: d.floor.map((f) => `${f.group.length} cards, ${f.light} light < ${f.need}`) });
}
log(`dark flags: ${undarkedTotal} undark steps (clusters over ${BR.maxDarkPerCluster} dark, light share under ${BR.minLightShare}); stuck: ${stuck.length ? JSON.stringify(stuck) : 'none'}`);

// ---- 2b. the homepage Selected Work (28 cards in 5 bands): per window size, rest + the drift at half + the aura at half; the dark flags shared by all sizes ---------------------
const G = await import('../src/data/cards-gen.js'); const GL = await import('../src/data/layout.js'); const { solveOffsets } = await import('./lib/solve-core.mjs');
const rows = data.projects.filter((p) => p.index).map((p) => p.slug);
const VH = 10.8, wDen = 20 + 80 * T.CARDS.depthRange;
const homeOut = {}; let homeDarkIds = null; const homeReport = [];
const homeStates = (cards, X, Y) => { // state offsets for the cards at positions X, Y (px)
  const n = cards.length, z = () => new Float64Array(n), dd = Float64Array.from(cards, (c) => (20 + (c.mouse - 20) * T.CARDS.depthRange) * T.CARDS.mouseStrength);
  const au = Float64Array.from(cards, (c, i) => (Math.abs(X[i]) < 900 ? Math.sign(X[i] || 1) * T.CARDS.auraStrength * ((20 + (c.mouse - 20) * T.CARDS.depthRange) / wDen) : 0));
  const offs = []; const fd = T.LAYOUT_STATES.drift;
  if (T.LAYOUT_STATES.rest) offs.push({ dx: z(), dy: z() });
  if (fd > 0) for (const [mx, my] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) offs.push({ dx: Float64Array.from(dd, (d) => -mx * d * fd), dy: Float64Array.from(dd, (d) => -my * d * fd) });
  if (T.LAYOUT_STATES.aura > 0) offs.push({ dx: Float64Array.from(au, (v) => v * T.LAYOUT_STATES.aura), dy: z() });
  return offs;
};
const homeScen = (cards, X, Y) => homeStates(cards, X, Y).map((o) => ({ x: Float64Array.from(X, (v, i) => v + o.dx[i]), y: Float64Array.from(Y, (v, i) => v + o.dy[i]), w: Float64Array.from(cards, (c) => c.w), h: Float64Array.from(cards, (c) => c.h), mode: 'home' }));
for (const sz of sizes) {
  globalThis.innerWidth = sz.W; globalThis.innerHeight = sz.H;
  const cards = G.generateCards(pool, rows, undefined, undefined, { fix: false });
  const pos = GL.generateLayout(cards, { ...T.LAYOUT, seed: T.LAYOUT.seed + T.POOL.seed });
  const n = cards.length, X0 = Float64Array.from(pos, (q) => q.x), Y0 = Float64Array.from(pos, (q) => q.y * VH);
  const locked = new Uint8Array(n), twin = new Int32Array(n).fill(-1), side = new Int8Array(n), yLo = new Float64Array(n), yHi = new Float64Array(n), xLo = new Float64Array(n), xHi = new Float64Array(n);
  cards.forEach((c, i) => { side[i] = X0[i] >= 0 ? 1 : -1; xLo[i] = 330; xHi[i] = 1000; yLo[i] = c.yMin * VH; yHi[i] = c.yMax * VH; if (c.dup) twin[i] = cards.indexOf(c.twin); else if (c.hasDup) twin[i] = cards.findIndex((o) => o.dup && o.twin === c); X0[i] = side[i] * Math.max(330, Math.min(1000, Math.abs(X0[i]))); Y0[i] = Math.max(yLo[i], Math.min(yHi[i], Y0[i])); });
  let X = X0, Y = Y0, res = null;
  for (let round = 0; round < 6; round++) {
    const offs = homeStates(cards, X, Y);
    res = solveOffsets({ seed: hashOf(`home|${sz.key}|${round}|${iters}`), iters, pairMax: BR.pairOverlapMax * 0.97, X0: Float64Array.from(X), Y0: Float64Array.from(Y), W: Float64Array.from(cards, (c) => c.w), H: Float64Array.from(cards, (c) => c.h), offs, yLo, yHi, xLo, xHi, side, twin, locked, scale: 1, dup: Uint8Array.from(cards, (c) => (c.dup ? 1 : 0)), link: BR.clusterLink, dupLinkW: 0.6 * (1 + round * 2) });
    X = res.X; Y = res.Y;
    const ctxV = { n, scenarios: () => homeScen(cards, X, Y), dark: () => [], rank: () => 0, isDup: () => false };
    const v = O.allViolations(ctxV, BR); // with the offsets recomputed at the new positions (the aura depends on x)
    const onlyDups = cards.map((c) => !!c.dup), stuckNow = O.enforceDark({ n, scenarios: () => homeScen(cards, X, Y), dark: () => onlyDups, setDark: (i, val) => { onlyDups[i] = val; }, rank: () => 0, isDup: () => true, groups: () => [] }, BR).clusters.length; // clusters of duplicates alone over the limit
    if (!v.length && !stuckNow) break;
  }
  // start positions: the nudges from the generated layout (what the runtime applies on top of generateLayout)
  const ids = cards.map((c) => G.homeCardId(c));
  homeOut[sz.key] = { cards: Object.fromEntries(ids.map((id, i) => [id, [Math.round((X[i] - pos[i].x) * 100) / 100, Math.round(((Y[i] - pos[i].y * VH) / VH) * 1000) / 1000]])) };
  if (!homeDarkIds) homeDarkIds = ids.map((id, i) => [id, !!cards[i].dark]);
  else if (JSON.stringify(ids) !== JSON.stringify(homeDarkIds.map((q) => q[0]))) log(`WARNING: the homepage card set differs at ${sz.key}`);
  const dark = ids.map((id, i) => !!cards[i].dark);
  const ctxD = { n, scenarios: () => homeScen(cards, X, Y), dark: () => dark, setDark: (i, v) => { dark[i] = v; cards[i].dark = v; const q = homeDarkIds.find((r2) => r2[0] === ids[i]); if (q) q[1] = v; }, rank: (i) => hashOf(ids[i] + 'r'), isDup: (i) => !!cards[i].dup, groups: () => [cards.map((c, i) => i)] };
  // the shared flags: start from the stored ones of earlier sizes
  ids.forEach((id, i) => { const q = homeDarkIds.find((r2) => r2[0] === id); if (q) { dark[i] = q[1]; cards[i].dark = q[1]; } });
  const d = O.enforceDark(ctxD, BR);
  const viol = O.allViolations({ n, scenarios: () => homeScen(cards, X, Y), dark: () => dark, rank: () => 0, isDup: () => false }, BR);
  anyViolation += viol.length;
  homeReport.push({ size: sz.key, cards: n, violations: viol.length, dups: cards.filter((c) => c.dup).length, undarked: d.undarked, stuckClusters: d.clusters.length, floorStuck: d.floor.length });
  log(`home ${sz.key}: ${n} cards, ${viol.length} pair violations, undarked ${d.undarked}, all-duplicate clusters over the limit ${d.clusters.length}, floor ${d.floor.length ? JSON.stringify(d.floor.map((f) => `${f.light}<${f.need}`)) : 'ok'}`);
  if (d.clusters.length) anyViolation += d.clusters.length;
}
result.home = { ...keptHome, ...homeOut }; result.homeDark = Object.fromEntries(homeDarkIds || []);
const lightHome = homeDarkIds ? homeDarkIds.filter((q) => !q[1]).length : 0;
log(`home dark flags: ${homeDarkIds ? homeDarkIds.length - lightHome : 0} dark, ${lightHome} light of ${homeDarkIds ? homeDarkIds.length : 0}`);

// ---- 3. the REAL check of every layout (applyFocus with its nudge pass), the output, the density report -----------------------------------------------------
const report = [];
for (const sz of sizes) for (const mode of modes) {
  const { placed, M, projHash } = solved[sz.key][mode];
  const S = ST.stateData(pcDark, M, placed);
  const scen = ST.workScenarios(S, mode, true);
  const ctx = { n: flatCards.length, scenarios: () => scen, dark: () => flatCards.map((c) => !!c.dark), rank: () => 0, isDup: (i) => !!flatCards[i].dup, groups: () => [] };
  const viol = O.allViolations(ctx, BR);
  anyViolation += viol.length;
  // the largest checked overlap and the visible share of the card area (rest, view 0) and the smallest gap
  let maxOv = 0; const rest = scen.filter((s) => s.state === 'rest')[0];
  for (const s of scen) for (let i = 0; i < S.n; i++) for (let j = i + 1; j < S.n; j++) { const ox = (S.Wv[i] + S.Wv[j]) / 2 - Math.abs(s.x[i] - s.x[j]), oy = (S.Hv[i] + S.Hv[j]) / 2 - Math.abs(s.y[i] - s.y[j]); if (ox > 0 && oy > 0) maxOv = Math.max(maxOv, (ox * oy) / Math.min(S.Wv[i] * S.Hv[i], S.Wv[j] * S.Hv[j])); }
  let minGap = 1e9; for (let i = 0; i < S.n; i++) for (let j = i + 1; j < S.n; j++) { const gx = Math.abs(rest.x[i] - rest.x[j]) - (S.Wv[i] + S.Wv[j]) / 2, gy = Math.abs(S.Y0[i] - S.Y0[j]) - (S.Hv[i] + S.Hv[j]) / 2; if (gx > 0 || gy > 0) minGap = Math.min(minGap, Math.max(gx, gy)); }
  let vis = 0, tot = 0; // area of light cards not covered by any other card / all card area (the rest state, in project order)
  for (let i = 0; i < S.n; i++) { tot += S.Wv[i] * S.Hv[i]; if (flatCards[i].dark) continue; let cov = 0; for (let j = 0; j < S.n; j++) { if (j === i) continue; const ox = (S.Wv[i] + S.Wv[j]) / 2 - Math.abs(rest.x[i] - rest.x[j]), oy = (S.Hv[i] + S.Hv[j]) / 2 - Math.abs(S.Y0[i] - S.Y0[j]); if (ox > 0 && oy > 0) cov += Math.min(ox, S.Wv[i]) * Math.min(oy, S.Hv[i]); } vis += Math.max(0, S.Wv[i] * S.Hv[i] - cov); }
  const entry = {}; const rep = [];
  pcDark.forEach((list, pi) => {
    const cards = {}; list.forEach((c, k) => { cards[LS.cardId(c)] = [Math.round(placed[pi][k].along * 100) / 100, Math.round(placed[pi][k].cross * 100) / 100]; });
    entry[list[0].slug] = { hash: LS.projectHash(list, M), cards };
    const light = list.filter((c) => !c.dark).length;
    rep.push(`${list[0].slug}: ${list.length} cards (band ${T.WORK_LIMITS.minN}-${T.WORK_LIMITS.maxN}), light ${light} (${(light / list.length).toFixed(2)})`);
  });
  result.work[sz.key][mode] = entry;
  report.push({ size: sz.key, mode, violations: viol.length, maxCheckedOverlap: +maxOv.toFixed(3), minRestGapPx: Math.round(minGap), visibleLightShareOfArea: +(vis / tot).toFixed(3), projects: rep });
  log(`${sz.key} ${mode.padEnd(8)} REAL check: ${viol.length} pair violations, largest checked overlap ${maxOv.toFixed(3)} (limit ${BR.pairOverlapMax}), smallest rest gap ${Math.round(minGap)} px, visible light area ${(vis / tot * 100).toFixed(0)} %`);
}
pcDark.forEach((l) => { const d = {}; l.forEach((c) => { d[LS.cardId(c)] = !!c.dark; }); result.dark[l[0].slug] = d; });
// stable key order for a byte-identical file
const sortKeys = (o) => (Array.isArray(o) || o === null || typeof o !== 'object' ? o : Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])));
if (anyViolation === 0) {
  fs.writeFileSync(OUT, JSON.stringify(sortKeys(result)) + '\n');
  log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} kB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} else log(`NOT written: ${anyViolation} violations left`);
fs.writeFileSync('tools/scratch/layout-report.json', JSON.stringify({ work: report, home: homeReport }, null, 1));
console.log(pcDark.map((l) => `${l[0].slug}: ${l.length} cards, dark ${l.filter((c) => c.dark).length}, light ${l.filter((c) => !c.dark).length}`).join(' | '));
process.exit(anyViolation === 0 ? 0 : 1);
