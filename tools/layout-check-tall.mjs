// R24a: the BUILD GATE for the tall Work layouts (src/data/layouts-tall.json, written by tools/layout-solve-tall.mjs). Runs after tools/layout-check.mjs (npm run layout:check,
// npm run build). Fails (exit 1) when a size has no layout, a project's hash is out of date (its cards / metrics / rules changed), a card is outside its band or side, or a
// pair overlaps beyond BAND_RULES.pairOverlapMax in the tall states (rest), or the dark rules need another undark step.
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const C = await import('../src/work/cards.js'); const ST = await import('../src/work/states.js'); const T = await import('../src/timeline.js'); const O = await import('../src/data/overlap.js');
const LS = await import('../src/work/layout-store.js'); const TL = await import('../src/work/tall.js');
const BR = T.BAND_RULES, OUT = 'src/data/layouts-tall.json', fail = [];
if (!fs.existsSync(OUT)) { console.error('layout:check (tall): src/data/layouts-tall.json is missing: run `npm run layout:tall`'); process.exit(1); }
const L = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const pool = JSON.parse(fs.readFileSync('src/data/work-pool.json', 'utf8')), data = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')), slugs = data.projects.map((p) => p.slug);
if (L.signature !== TL.tallSignature()) fail.push(`tall rule signature changed (stored ${L.signature}, now ${TL.tallSignature()}): run npm run layout:tall`);
let checked = 0;
for (const [W, H] of TL.TALL_SIZES) {
  const key = LS.sizeKey(W, H), entry = L.work?.[key]?.vertical;
  if (!entry) { fail.push(`tall: no stored layout for ${key}`); continue; }
  const M = TL.tallMetrics(W, H).side, maxN = TL.cardsMaxFor('tall', W, H), pc = TL.liteCards(C.buildProjectCards, pool, slugs, T.WORK.seed, maxN);
  if (maxN <= 0) { // images only: every project has an entry with the hash of today's metrics and no card; a missing project or a stale hash fails
    for (const slug of slugs) { const e = entry[slug]; if (!e) fail.push(`tall ${key}: project ${slug} has no entry`); else if (e.hash !== LS.projectHash([], M)) fail.push(`tall ${key} ${slug}: out of date (the frame size / the rules changed): run npm run layout:tall`); else if (Object.keys(e.cards).length) fail.push(`tall ${key} ${slug}: stored cards but the card count is 0`); }
    checked++; continue;
  }
  if (!LS.applyStoredDark(L, pc)) { fail.push(`tall ${key}: the dark flags do not cover every card`); continue; }
  const flat = pc.flat(), placed = []; let ok = true;
  for (const list of pc) {
    const e = entry[list[0].slug];
    if (!e) { fail.push(`tall ${key}: project ${list[0].slug} has no stored layout`); ok = false; break; }
    if (e.hash !== LS.projectHash(list, M)) { fail.push(`tall ${key} ${list[0].slug}: out of date (cards / metrics / rules changed)`); ok = false; break; }
    placed.push(list.map((c) => { const p = e.cards[LS.cardId(c)]; if (!p) { fail.push(`tall ${key} ${c.slug}: card ${LS.cardId(c)} has no position`); ok = false; return { along: 0, cross: 0, w: 1, h: 1, alongSize: 1, crossSize: 1 }; } const w = c.w * M.scale, h = c.h * M.scale; return { along: p[0], cross: p[1], w, h, alongSize: w, crossSize: h }; }));
  }
  if (!ok) continue;
  checked++;
  const S = ST.stateData(pc, M, placed);
  const pitchVh = (M.alongF + M.gap) / M.scale / 10.8, b = M.alongF / 2 + M.gap / 2 + Math.max(T.CARD_SIZE.bandSlack, T.WORK.slack * pitchVh) * 10.8 * M.scale;
  S.flat.forEach((f, i) => {
    const along = S.Y0[i] - f.pi * S.pitch, cs = S.Wv[i], xLo = M.crossF / 2 - T.WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6), ax = Math.abs(S.X0[i]);
    if (Math.abs(along) > b + 0.01) fail.push(`tall ${key} ${LS.cardId(f.c)}: outside its project's length`);
    if (ax < xLo - 0.01 || ax > xHi + 0.01) fail.push(`tall ${key} ${LS.cardId(f.c)}: across the strip ${Math.round(ax)} px outside ${Math.round(xLo)}..${Math.round(xHi)}`);
    if (Math.sign(S.X0[i]) !== f.c.edge && f.c.edge) fail.push(`tall ${key} ${LS.cardId(f.c)}: on the wrong side of the strip`);
  });
  const scen = TL.withTallStates(() => ST.workScenarios(S, 'side', true)), dark = flat.map((c) => !!c.dark), copy = dark.slice();
  const ctx = { n: flat.length, scenarios: () => scen, dark: () => copy, setDark: (i, v) => { copy[i] = v; }, rank: () => 0, isDup: (i) => !!flat[i].dup, groups: () => pc.map((l) => flat.map((c, i) => (c.slug === l[0].slug ? i : -1)).filter((i) => i >= 0)) };
  const v = O.allViolations(ctx, BR);
  if (v.length) fail.push(`tall ${key}: ${v.length} pair overlap(s) over ${BR.pairOverlapMax}`);
  const d = O.enforceDark(ctx, BR);
  if (d.undarked) fail.push(`tall ${key}: ${d.undarked} card(s) would still have to be undarked`);
}
if (fail.length) { console.error(`layout:check (tall): FAILED\n  ${fail.join('\n  ')}`); process.exit(1); }
console.log(`layout:check (tall): ${checked} sizes OK (rest state, ${T.TALL.cardsMax} / ${T.TALL.cardsMaxTablet} cards per project on a phone / tablet portrait)`);
