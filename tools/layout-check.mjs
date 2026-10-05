// R29: the BUILD GATE. `npm run layout:check` (also run first by `npm run build`): re-checks every stored layout in src/data/layouts.json against the CURRENT rules and
// numbers and FAILS (exit 1) on any violation, or when a stored layout is out of date with the project's cards or the rule constants (the hash stored with it).
// Checks per stored window size and Work mode: every project has a stored layout whose hash matches; every card has a position inside its band and side; the pair
// rule in every state of LAYOUT_STATES with the REAL focus push; clusters over maxDarkPerCluster dark cards; the light-share floor (a project whose forced-dark
// duplicates alone break it is reported, not failed); the dark run rule along the strip. The homepage layouts are checked the same way (section "home").
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const C = await import('../src/work/cards.js'); const ST = await import('../src/work/states.js'); const T = await import('../src/timeline.js'); const O = await import('../src/data/overlap.js'); const LS = await import('../src/work/layout-store.js');
const BR = T.BAND_RULES;
const OUT = 'src/data/layouts.json';
const fail = []; const notes = [];
if (!fs.existsSync(OUT)) { console.error('layout:check: src/data/layouts.json is missing: run `npm run layout`'); process.exit(1); }
const L = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const pool = JSON.parse(fs.readFileSync('src/data/work-pool.json', 'utf8')); const data = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')); const slugs = data.projects.map((p) => p.slug);
if (L.signature !== LS.ruleSignature()) fail.push(`rule signature changed (stored ${L.signature}, now ${LS.ruleSignature()}): the rules / states / numbers differ from the ones the layouts were solved with`);
const wanted = Object.values(LS.SIZES).flat().map(([w, h]) => LS.sizeKey(w, h));
for (const k of wanted) if (!L.work?.[k]) fail.push(`no stored layout for ${k}`);
let checked = 0;
for (const key of Object.keys(L.work || {})) {
  const [W, H] = key.split('x').map(Number); const Ms = C.workMetrics(W, H, Math.min(W, 1920) / 1920);
  const pc = C.buildProjectCards(pool, slugs);
  if (!LS.applyStoredDark(L, pc)) { fail.push(`${key}: the dark flags do not cover every card`); continue; }
  const flat = pc.flat();
  for (const mode of ['side', 'vertical']) {
    const M = Ms[mode], entry = L.work[key][mode];
    if (!entry) { fail.push(`${key} ${mode}: missing`); continue; }
    const placed = [];
    let ok = true;
    for (const list of pc) {
      const e = entry[list[0].slug];
      if (!e) { fail.push(`${key} ${mode}: project ${list[0].slug} has no stored layout`); ok = false; break; }
      if (e.hash !== LS.projectHash(list, M)) { fail.push(`${key} ${mode} ${list[0].slug}: out of date (its cards / the rule numbers changed since it was solved)`); ok = false; break; }
      placed.push(list.map((c) => { const p = e.cards[LS.cardId(c)]; if (!p) { fail.push(`${key} ${mode} ${c.slug}: card ${LS.cardId(c)} has no position`); ok = false; return { along: 0, cross: 0, w: 1, h: 1, alongSize: 1, crossSize: 1 }; } const w = c.w * M.scale, h = c.h * M.scale; return { along: p[0], cross: p[1], w, h, alongSize: M.vertical ? h : w, crossSize: M.vertical ? w : h }; }));
    }
    if (!ok) continue;
    checked++;
    const S = ST.stateData(pc, M, placed);
    // band, side and the strip bounds
    const pitchVh = (M.alongF + M.gap) / M.scale / 10.8, b = M.alongF / 2 + M.gap / 2 + Math.max(T.CARD_SIZE.bandSlack, T.WORK.slack * pitchVh) * 10.8 * M.scale;
    S.flat.forEach((f, i) => {
      const along = S.Y0[i] - f.pi * S.pitch, cs = S.Wv[i], xLo = M.crossF / 2 - T.WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6), ax = Math.abs(S.X0[i]);
      if (Math.abs(along) > b + 0.01) fail.push(`${key} ${mode} ${LS.cardId(f.c)}: outside its project's length (${Math.round(along)} px, limit ${Math.round(b)})`);
      if (ax < xLo - 0.01 || ax > xHi + 0.01) fail.push(`${key} ${mode} ${LS.cardId(f.c)}: across the strip ${Math.round(ax)} px outside ${Math.round(xLo)}..${Math.round(xHi)}`);
      if (Math.sign(S.X0[i]) !== f.c.edge && f.c.edge) fail.push(`${key} ${mode} ${LS.cardId(f.c)}: on the wrong side of the strip`);
    });
    const scen = ST.workScenarios(S, mode, true);
    const dark = flat.map((c) => !!c.dark);
    const ctx = { n: flat.length, scenarios: () => scen, dark: () => dark, rank: () => 0, isDup: (i) => !!flat[i].dup, setDark: () => {}, groups: () => pc.map((l, pi) => flat.map((c, i) => (c.slug === l[0].slug ? i : -1)).filter((i) => i >= 0)) };
    const v = O.allViolations(ctx, BR);
    if (v.length) fail.push(`${key} ${mode}: ${v.length} pair overlap(s) over ${BR.pairOverlapMax}: ${v.slice(0, 3).map((q) => `${LS.cardId(flat[q.cards[0]])} / ${LS.cardId(flat[q.cards[1]])} (${q.state ?? ''} +${q.excess.toFixed(3)})`).join('; ')}`);
    // clusters and the floor (a copy of the flags: report only)
    const copy = dark.slice(), d = O.enforceDark({ ...ctx, dark: () => copy, setDark: (i, val) => { copy[i] = val; } }, BR);
    if (d.undarked) fail.push(`${key} ${mode}: ${d.undarked} card(s) would still have to be undarked (a cluster over ${BR.maxDarkPerCluster} dark cards or a light share under ${BR.minLightShare})`);
    if (d.clusters.length) fail.push(`${key} ${mode}: ${d.clusters.length} cluster(s) of forced-dark duplicates over the limit`);
    if (d.floor.length) notes.push(`${key} ${mode}: ${d.floor.length} project(s) whose duplicates alone break the light-share floor (Anh decides)`);
    // dark runs along the strip (duplicates are exempt)
    pc.forEach((list, pi) => { const ord = list.map((c, k) => k).filter((k) => !list[k].dup).sort((p, q) => placed[pi][p].along - placed[pi][q].along); let run = 0; for (const k of ord) { run = list[k].dark ? run + 1 : 0; if (run > BR.maxDarkRun) { fail.push(`${key} ${mode} ${list[0].slug}: more than ${BR.maxDarkRun} dark cards in a row along the strip`); break; } } });
  }
}
// ---- the homepage layouts ----
{
  const G = await import('../src/data/cards-gen.js'); const GL = await import('../src/data/layout.js');
  const rows = data.projects.filter((p) => p.index).map((p) => p.slug), VH = 10.8, wDen = 20 + 80 * T.CARDS.depthRange;
  for (const k of wanted) if (!L.home?.[k]) fail.push(`no stored homepage layout for ${k}`);
  if (!L.homeDark) fail.push('no stored homepage dark flags');
  for (const key of Object.keys(L.home || {})) {
    const [W, H] = key.split('x').map(Number); globalThis.innerWidth = W; globalThis.innerHeight = H;
    let cards;
    try { cards = G.generateCards(pool, rows, undefined, undefined, { stored: { cards: L.home[key].cards, dark: L.homeDark } }); } catch (e) { fail.push(`home ${key}: ${e.message}`); continue; }
    const ids = cards.map((c) => G.homeCardId(c)).sort(), have = Object.keys(L.home[key].cards).sort();
    if (JSON.stringify(ids) !== JSON.stringify(have)) { fail.push(`home ${key}: the stored cards are not the cards generated now (the image pool / the limits changed)`); continue; }
    checked++;
    const pos = GL.generateLayout(cards, { ...T.LAYOUT, seed: T.LAYOUT.seed + T.POOL.seed }), n = cards.length;
    const X = Float64Array.from(pos, (q) => q.x), Y = Float64Array.from(pos, (q) => q.y * VH);
    const z = () => new Float64Array(n), dd = Float64Array.from(cards, (c) => (20 + (c.mouse - 20) * T.CARDS.depthRange) * T.CARDS.mouseStrength);
    const au = Float64Array.from(cards, (c, i) => (Math.abs(X[i]) < 900 ? Math.sign(X[i] || 1) * T.CARDS.auraStrength * ((20 + (c.mouse - 20) * T.CARDS.depthRange) / wDen) : 0));
    const offs = []; const fd = T.LAYOUT_STATES.drift;
    if (T.LAYOUT_STATES.rest) offs.push({ dx: z(), dy: z() });
    if (fd > 0) for (const [mx, my] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) offs.push({ dx: Float64Array.from(dd, (d) => -mx * d * fd), dy: Float64Array.from(dd, (d) => -my * d * fd) });
    if (T.LAYOUT_STATES.aura > 0) offs.push({ dx: Float64Array.from(au, (v) => v * T.LAYOUT_STATES.aura), dy: z() });
    const scen = offs.map((o) => ({ x: Float64Array.from(X, (v, i) => v + o.dx[i]), y: Float64Array.from(Y, (v, i) => v + o.dy[i]), w: Float64Array.from(cards, (c) => c.w), h: Float64Array.from(cards, (c) => c.h), mode: 'home' }));
    const dark = cards.map((c) => !!c.dark), copy = dark.slice();
    const ctx = { n, scenarios: () => scen, dark: () => copy, setDark: (i, v) => { copy[i] = v; }, rank: () => 0, isDup: (i) => !!cards[i].dup, groups: () => [cards.map((c, i) => i)] };
    const v = O.allViolations(ctx, BR);
    if (v.length) fail.push(`home ${key}: ${v.length} pair overlap(s) over ${BR.pairOverlapMax}`);
    const d = O.enforceDark(ctx, BR);
    if (d.undarked) fail.push(`home ${key}: ${d.undarked} card(s) would still have to be undarked`);
    if (d.clusters.length) fail.push(`home ${key}: ${d.clusters.length} cluster(s) of forced-dark duplicates over the limit`);
    if (d.floor.length) notes.push(`home ${key}: the duplicates alone break the light-share floor (Anh decides)`);
    cards.forEach((c, i) => { if (c.yMin !== undefined) { const yv = Y[i] / VH; if (yv < c.yMin - 0.01 || yv > c.yMax + 0.01) fail.push(`home ${key} ${G.homeCardId(c)}: outside its band`); } });
  }
}
if (fail.length) { console.error(`layout:check FAILED (${fail.length}):\n  ` + fail.slice(0, 25).join('\n  ') + (fail.length > 25 ? `\n  ... and ${fail.length - 25} more` : '') + '\nRun `npm run layout` to solve the layouts again.'); process.exit(1); }
console.log(`layout:check OK: ${checked} stored layouts (size x mode) re-checked against the current rules; ${notes.length ? notes.join('; ') : 'no reported cases'}`);
