// R24a: the offline solver for the TALL Work layouts (phones, tablet portrait): the same method as tools/layout-solve.mjs (seeded annealing on the pair overlaps,
// a polish with the real checks, dark flags: undark only) for ONE mode (side) at the tall sizes (work/tall.js TALL_SIZES), the states a phone user sees (rest
// only, TALL_STATES), TALL.cardsMax cards per project. Output: src/data/layouts-tall.json (the wide src/data/layouts.json is never touched).
// `npm run layout:tall` (all sizes), `-- --sizes 390x844`, `--iters N`. Same inputs = same file.
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const C = await import('../src/work/cards.js'); const ST = await import('../src/work/states.js'); const T = await import('../src/timeline.js'); const O = await import('../src/data/overlap.js');
const LS = await import('../src/work/layout-store.js'); const TL = await import('../src/work/tall.js'); const { solveMode } = await import('./lib/solve-core.mjs');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const iters = Number(arg('--iters', 100000));
const sizeList = (arg('--sizes', null) || TL.TALL_SIZES.map(([w, h]) => `${w}x${h}`).join(',')).split(',').map((s) => s.split('x').map(Number));
const OUT = arg('--out', 'src/data/layouts-tall.json');
const pool = JSON.parse(fs.readFileSync('src/data/work-pool.json', 'utf8')); const data = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')); const slugs = data.projects.map((p) => p.slug);
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const BR = T.BAND_RULES, mode = 'side', t0 = Date.now(), log = (...a) => console.log(...a);
const fresh = () => C.buildProjectCards(pool, slugs, T.WORK.seed, TL.tallLimits());
const sig = TL.tallSignature();
const pcAll = fresh();
const result = { v: 1, signature: sig, rules: { pairOverlapMax: BR.pairOverlapMax, clusterLink: BR.clusterLink, maxDarkPerCluster: BR.maxDarkPerCluster, minLightShare: BR.minLightShare, states: TL.TALL_STATES, cardsMax: T.TALL.cardsMax }, dark: {}, work: {} };
const keepOld = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (keepOld && keepOld.signature === sig) for (const [k, v] of Object.entries(keepOld.work || {})) if (!sizeList.some(([w, h]) => LS.sizeKey(w, h) === k)) result.work[k] = v;
const solved = {}, placedAll = [];
for (const [W, H] of sizeList) {
  const key = LS.sizeKey(W, H), M = TL.tallMetrics(W, H)[mode];
  const base = C.placeCards(pcAll, M);
  const S = ST.stateData(pcAll, M, base);
  const n = S.n, locked = new Uint8Array(n), aLo = new Float64Array(n), aHi = new Float64Array(n), cLo = new Float64Array(n), cHi = new Float64Array(n), side = new Int8Array(n), twin = new Int32Array(n).fill(-1);
  const pitchVh = (M.alongF + M.gap) / M.scale / 10.8, b = M.alongF / 2 + M.gap / 2 + Math.max(T.CARD_SIZE.bandSlack, T.WORK.slack * pitchVh) * 10.8 * M.scale;
  S.flat.forEach((f, i) => {
    const cs = S.Wv[i], xLo = M.crossF / 2 - T.WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6);
    aLo[i] = -b; aHi[i] = b; cLo[i] = xLo; cHi[i] = xHi; side[i] = S.X0[i] >= 0 ? 1 : -1;
    if (f.c.dup) twin[i] = S.flat.findIndex((g) => g.c === f.c.twin); else if (f.c.hasDup) twin[i] = S.flat.findIndex((g) => g.c.dup && g.c.twin === f.c);
  });
  S.flat.forEach((f, i) => { S.X0[i] = side[i] * Math.max(cLo[i], Math.min(cHi[i], Math.abs(S.X0[i]))); const bs = f.pi * S.pitch; S.Y0[i] = bs + Math.max(aLo[i], Math.min(aHi[i], S.Y0[i] - bs)); });
  const res = solveMode(S, { wrapP: ST.wrapP, focusPos: ST.focusPos }, { seed: hashOf(`tall|${key}|${iters}`), iters, pairMax: BR.pairOverlapMax * 0.97, drift: 0, ambient: false, focus: false, locked, aLo, aHi, cLo, cHi, side, twin });
  // polish with the real check (rest only)
  const S2 = { ...S, X0: Float64Array.from(res.X), Y0: Float64Array.from(res.Y) };
  const evalReal = () => TL.withTallStates(() => { const scen = ST.workScenarios(S2, mode, true); const ctx = { n, scenarios: () => scen, dark: () => [], rank: () => 0, isDup: () => false }; const v = O.allViolations(ctx, BR); return { e: v.reduce((a2, q) => a2 + 1 + q.excess, 0), v }; });
  let cur = evalReal(), tries = 0, a0 = hashOf(`tall|${key}|polish`) >>> 0; const rnd = () => { a0 = (a0 + 0x6d2b79f5) >>> 0; let t = a0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  while (cur.e > 0 && tries < 4000) {
    tries++;
    const pair = cur.v[Math.floor(rnd() * cur.v.length)].cards, i = pair[rnd() < 0.5 ? 0 : 1];
    if (locked[i]) continue;
    const g = twin[i] >= 0 && !locked[twin[i]] ? [i, twin[i]] : [i], oX = g.map((q) => S2.X0[q]), oY = g.map((q) => S2.Y0[q]), sg = 6 + 30 * rnd(), d = (rnd() - 0.5) * 2 * sg;
    if (rnd() < 0.7) for (const q of g) { const bs = S.flat[q].pi * S.pitch; S2.Y0[q] = bs + Math.max(aLo[q], Math.min(aHi[q], S2.Y0[q] - bs + d)); }
    else S2.X0[i] = side[i] * Math.max(cLo[i], Math.min(cHi[i], Math.abs(S2.X0[i]) + d * side[i]));
    const nx = evalReal();
    if (nx.e <= cur.e) cur = nx; else g.forEach((q, k) => { S2.X0[q] = oX[k]; S2.Y0[q] = oY[k]; });
  }
  const placed = pcAll.map((list) => new Array(list.length));
  S.flat.forEach((f, i) => { placed[f.pi][f.k] = { along: S2.Y0[i] - f.pi * S.pitch, cross: S2.X0[i], w: S.Wv[i], h: S.Hv[i], alongSize: S.Hv[i], crossSize: S.Wv[i] }; });
  solved[key] = { placed, M, W, H }; placedAll.push(placed);
  log(`${key}: ${n} cards, annealed energy ${res.energy.toExponential(2)}, ${tries} polish tries, ${cur.v.length} violations left (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
// dark flags: seeded draw + run rule, then undark for the cluster rule and the light-share floor, in every size
const pcDark = fresh();
C.balanceDark(pcDark, placedAll);
const flatCards = pcDark.flat();
const mkCtx = (scen, dark, setDark) => ({ n: flatCards.length, scenarios: () => scen, dark: () => dark, setDark, rank: (i) => hashOf(LS.cardId(flatCards[i]) + 'r'), isDup: (i) => !!flatCards[i].dup, groups: () => pcDark.map((l) => flatCards.map((c, i) => (c.slug === l[0].slug ? i : -1)).filter((i) => i >= 0)) });
let undarked = 0;
for (const { placed, M } of Object.values(solved)) {
  const S = ST.stateData(pcDark, M, placed), scen = TL.withTallStates(() => ST.workScenarios(S, mode, true)), dark = flatCards.map((c) => !!c.dark);
  undarked += O.enforceDark(mkCtx(scen, dark, (i, v) => { flatCards[i].dark = v; dark[i] = v; }), BR).undarked;
}
log(`dark flags: ${undarked} undark steps`);
let viol = 0;
for (const [key, { placed, M }] of Object.entries(solved)) {
  const S = ST.stateData(pcDark, M, placed), scen = TL.withTallStates(() => ST.workScenarios(S, mode, true)), dark = flatCards.map((c) => !!c.dark);
  const v = O.allViolations(mkCtx(scen, dark, () => {}), BR);
  viol += v.length;
  const entry = {};
  pcDark.forEach((list, pi) => { const cards = {}; list.forEach((c, k) => { cards[LS.cardId(c)] = [Math.round(placed[pi][k].along * 100) / 100, Math.round(placed[pi][k].cross * 100) / 100]; }); entry[list[0].slug] = { hash: LS.projectHash(list, M), cards }; });
  result.work[key] = { [mode]: entry };
  log(`${key} REAL check: ${v.length} pair violations; cards per project ${pcDark.map((l) => l.length).join('/')}; light share ${pcDark.map((l) => (l.filter((c) => !c.dark).length / l.length).toFixed(2)).join('/')}`);
}
pcDark.forEach((l) => { const d = {}; l.forEach((c) => { d[LS.cardId(c)] = !!c.dark; }); result.dark[l[0].slug] = d; });
const sortKeys = (o) => (Array.isArray(o) || o === null || typeof o !== 'object' ? o : Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])));
if (viol === 0) { fs.writeFileSync(OUT, JSON.stringify(sortKeys(result)) + '\n'); log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} kB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`); } else { log(`NOT written: ${viol} violations`); process.exit(1); }
