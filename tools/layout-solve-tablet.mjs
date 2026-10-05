// R24b: the offline solver for the LANDSCAPE TABLET Work layouts (aspect classes 3:2 and 4:3, work/layout-store.js TABLET_SIZES): the same method and the same
// rules / states as tools/layout-solve.mjs (R29) for BOTH Work modes, with the dark flags taken FIXED from src/data/layouts.json (they are shared by every size, so
// the wide file stays untouched: this script never writes it). Output: src/data/layouts-tablet.json. `npm run layout:tablet`, `-- --sizes 1024x768`, `--iters N`.
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const C = await import('../src/work/cards.js'); const ST = await import('../src/work/states.js'); const T = await import('../src/timeline.js'); const O = await import('../src/data/overlap.js');
const LS = await import('../src/work/layout-store.js'); const { solveMode } = await import('./lib/solve-core.mjs');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const iters = Number(arg('--iters', 150000));
const sizeList = (arg('--sizes', null) || Object.values(LS.TABLET_SIZES).flat().map(([w, h]) => `${w}x${h}`).join(',')).split(',').map((s) => s.split('x').map(Number));
const OUT = arg('--out', 'src/data/layouts-tablet.json');
const pool = JSON.parse(fs.readFileSync('src/data/work-pool.json', 'utf8')), data = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')), wide = JSON.parse(fs.readFileSync('src/data/layouts.json', 'utf8'));
const slugs = data.projects.map((p) => p.slug);
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const BR = T.BAND_RULES, t0 = Date.now(), log = (...a) => console.log(...a);
const sig = LS.ruleSignature();
if (wide.signature !== sig) { console.error('src/data/layouts.json has another rule signature: run `npm run layout` first'); process.exit(1); }
const pcAll = C.buildProjectCards(pool, slugs);
if (!LS.applyStoredDark(wide, pcAll)) { console.error('the stored dark flags (layouts.json) do not cover every card: run `npm run layout` first'); process.exit(1); }
const flatCards = pcAll.flat();
const result = { v: 1, signature: sig, work: {} };
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (old && old.signature === sig) for (const [k, v] of Object.entries(old.work || {})) if (!sizeList.some(([w, h]) => LS.sizeKey(w, h) === k)) result.work[k] = v;
let viol = 0, undark = 0;
for (const [W, H] of sizeList) {
  const key = LS.sizeKey(W, H), Ms = C.workMetrics(W, H, Math.min(W, 1920) / 1920);
  result.work[key] = {};
  for (const mode of ['side', 'vertical']) {
    const M = Ms[mode], base = C.placeCards(pcAll, M), S = ST.stateData(pcAll, M, base), n = S.n;
    const locked = new Uint8Array(n), aLo = new Float64Array(n), aHi = new Float64Array(n), cLo = new Float64Array(n), cHi = new Float64Array(n), side = new Int8Array(n), twin = new Int32Array(n).fill(-1);
    const pitchVh = (M.alongF + M.gap) / M.scale / 10.8, b = M.alongF / 2 + M.gap / 2 + Math.max(T.CARD_SIZE.bandSlack, T.WORK.slack * pitchVh) * 10.8 * M.scale;
    S.flat.forEach((f, i) => {
      const cs = S.Wv[i], xLo = M.crossF / 2 - T.WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6);
      aLo[i] = -b; aHi[i] = b; cLo[i] = xLo; cHi[i] = xHi; side[i] = S.X0[i] >= 0 ? 1 : -1;
      if (f.c.dup) twin[i] = S.flat.findIndex((g) => g.c === f.c.twin); else if (f.c.hasDup) twin[i] = S.flat.findIndex((g) => g.c.dup && g.c.twin === f.c);
    });
    S.flat.forEach((f, i) => { S.X0[i] = side[i] * Math.max(cLo[i], Math.min(cHi[i], Math.abs(S.X0[i]))); const bs = f.pi * S.pitch; S.Y0[i] = bs + Math.max(aLo[i], Math.min(aHi[i], S.Y0[i] - bs)); });
    const res = solveMode(S, { wrapP: ST.wrapP, focusPos: ST.focusPos }, { seed: hashOf(`tablet|${key}|${mode}|${iters}`), iters, pairMax: BR.pairOverlapMax * 0.97, drift: T.LAYOUT_STATES.drift, ambient: T.LAYOUT_STATES.ambientEnd && T.WORK.ambFrame > 0, focus: T.LAYOUT_STATES.focus, locked, aLo, aHi, cLo, cHi, side, twin });
    const S2 = { ...S, X0: Float64Array.from(res.X), Y0: Float64Array.from(res.Y) };
    const dark = flatCards.map((c) => !!c.dark);
    const mkCtx = (scen, d, set) => ({ n, scenarios: () => scen, dark: () => d, setDark: set, rank: (i) => hashOf(LS.cardId(flatCards[i]) + 'r'), isDup: (i) => !!flatCards[i].dup, groups: () => pcAll.map((l) => flatCards.map((c, i) => (c.slug === l[0].slug ? i : -1)).filter((i) => i >= 0)) });
    // polish with the real focus push, and with the CLUSTER rule too (the dark flags are fixed): pair violations + cards that enforceDark would have to undark
    const evalReal = () => { const scen = ST.workScenarios(S2, mode, true), copy = dark.slice(); const v = O.allViolations(mkCtx(scen, dark, () => {}), BR); const d = O.enforceDark(mkCtx(scen, copy, (i, val) => { copy[i] = val; }), BR); return { e: v.reduce((a2, q) => a2 + 1 + q.excess, 0) + 2 * d.undarked, v, undarked: d.undarked, cards: [...new Set(v.flatMap((q) => q.cards))] }; };
    let cur = evalReal(), tries = 0, a0 = hashOf(`tablet|${key}|${mode}|polish`) >>> 0; const rnd = () => { a0 = (a0 + 0x6d2b79f5) >>> 0; let t = a0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    while (cur.e > 0 && tries < 8000) {
      tries++;
      const pool2 = cur.cards.length ? cur.cards : S.flat.map((_, i) => i), i = pool2[Math.floor(rnd() * pool2.length)];
      if (locked[i]) continue;
      const g = twin[i] >= 0 ? [i, twin[i]] : [i], oX = g.map((q) => S2.X0[q]), oY = g.map((q) => S2.Y0[q]), sg = 6 + 40 * rnd(), d = (rnd() - 0.5) * 2 * sg;
      if (rnd() < 0.7) for (const q of g) { const bs = S.flat[q].pi * S.pitch; S2.Y0[q] = bs + Math.max(aLo[q], Math.min(aHi[q], S2.Y0[q] - bs + d)); }
      else S2.X0[i] = side[i] * Math.max(cLo[i], Math.min(cHi[i], Math.abs(S2.X0[i]) + d * side[i]));
      const nx = evalReal();
      if (nx.e <= cur.e) cur = nx; else g.forEach((q, k) => { S2.X0[q] = oX[k]; S2.Y0[q] = oY[k]; });
    }
    viol += cur.v.length; undark += cur.undarked;
    const entry = {};
    pcAll.forEach((list, pi) => { const cards = {}; list.forEach((c, k) => { const q = S.flat.findIndex((f) => f.pi === pi && f.k === k); cards[LS.cardId(c)] = [Math.round((S2.Y0[q] - pi * S.pitch) * 100) / 100, Math.round(S2.X0[q] * 100) / 100]; }); entry[list[0].slug] = { hash: LS.projectHash(list, M), cards }; });
    result.work[key][mode] = entry;
    log(`${key} ${mode.padEnd(8)}: annealed energy ${res.energy.toExponential(2)}, ${tries} polish tries, ${cur.v.length} pair violations, ${cur.undarked} undark steps needed (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
const sortKeys = (o) => (Array.isArray(o) || o === null || typeof o !== 'object' ? o : Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])));
if (viol === 0 && undark === 0) { fs.writeFileSync(OUT, JSON.stringify(sortKeys(result)) + '\n'); log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} kB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`); } else { log(`NOT written: ${viol} pair violations, ${undark} undark steps`); process.exit(1); }
