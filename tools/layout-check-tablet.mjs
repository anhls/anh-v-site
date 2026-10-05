// R24b: the BUILD GATE for the landscape tablet Work layouts (src/data/layouts-tablet.json, tools/layout-solve-tablet.mjs); runs after tools/layout-check.mjs. Per stored size and
// Work mode: the project hashes match, every card is inside its band and side, no pair overlaps beyond BAND_RULES.pairOverlapMax in any state of LAYOUT_STATES (real focus
// push), and the shared dark flags (src/data/layouts.json) need no further undark step. Fails (exit 1) otherwise.
import fs from 'node:fs';
import { installShims } from './scratch/r29-shim.mjs';
installShims();
const C = await import('../src/work/cards.js'); const ST = await import('../src/work/states.js'); const T = await import('../src/timeline.js'); const O = await import('../src/data/overlap.js'); const LS = await import('../src/work/layout-store.js');
const BR = T.BAND_RULES, OUT = 'src/data/layouts-tablet.json', fail = [];
if (!fs.existsSync(OUT)) { console.error('layout:check (tablet): src/data/layouts-tablet.json is missing: run `npm run layout:tablet`'); process.exit(1); }
const L = JSON.parse(fs.readFileSync(OUT, 'utf8')), wide = JSON.parse(fs.readFileSync('src/data/layouts.json', 'utf8'));
const pool = JSON.parse(fs.readFileSync('src/data/work-pool.json', 'utf8')), data = JSON.parse(fs.readFileSync('src/data/data.json', 'utf8')), slugs = data.projects.map((p) => p.slug);
if (L.signature !== LS.ruleSignature()) fail.push(`tablet rule signature changed (stored ${L.signature}, now ${LS.ruleSignature()}): run npm run layout:tablet`);
let checked = 0;
for (const [W, H] of Object.values(LS.TABLET_SIZES).flat()) {
  const key = LS.sizeKey(W, H), Ms = C.workMetrics(W, H, Math.min(W, 1920) / 1920);
  if (!L.work?.[key]) { fail.push(`tablet: no stored layout for ${key}`); continue; }
  const pc = C.buildProjectCards(pool, slugs);
  if (!LS.applyStoredDark(wide, pc)) { fail.push(`tablet ${key}: the stored dark flags do not cover every card`); continue; }
  const flat = pc.flat();
  for (const mode of ['side', 'vertical']) {
    const M = Ms[mode], entry = L.work[key][mode]; let ok = true; const placed = [];
    if (!entry) { fail.push(`tablet ${key} ${mode}: missing`); continue; }
    for (const list of pc) {
      const e = entry[list[0].slug];
      if (!e) { fail.push(`tablet ${key} ${mode}: project ${list[0].slug} has no stored layout`); ok = false; break; }
      if (e.hash !== LS.projectHash(list, M)) { fail.push(`tablet ${key} ${mode} ${list[0].slug}: out of date`); ok = false; break; }
      placed.push(list.map((c) => { const p = e.cards[LS.cardId(c)]; if (!p) { fail.push(`tablet ${key} ${mode} ${c.slug}: card ${LS.cardId(c)} has no position`); ok = false; return { along: 0, cross: 0, w: 1, h: 1, alongSize: 1, crossSize: 1 }; } const w = c.w * M.scale, h = c.h * M.scale; return { along: p[0], cross: p[1], w, h, alongSize: M.vertical ? h : w, crossSize: M.vertical ? w : h }; }));
    }
    if (!ok) continue;
    checked++;
    const S = ST.stateData(pc, M, placed);
    const pitchVh = (M.alongF + M.gap) / M.scale / 10.8, b = M.alongF / 2 + M.gap / 2 + Math.max(T.CARD_SIZE.bandSlack, T.WORK.slack * pitchVh) * 10.8 * M.scale;
    S.flat.forEach((f, i) => {
      const along = S.Y0[i] - f.pi * S.pitch, cs = S.Wv[i], xLo = M.crossF / 2 - T.WORK.overlapMax * cs + cs / 2, xHi = Math.max(xLo + 1, M.viewCross / 2 - cs / 2 - 6), ax = Math.abs(S.X0[i]);
      if (Math.abs(along) > b + 0.01) fail.push(`tablet ${key} ${mode} ${LS.cardId(f.c)}: outside its project's length`);
      if (ax < xLo - 0.01 || ax > xHi + 0.01) fail.push(`tablet ${key} ${mode} ${LS.cardId(f.c)}: across the strip ${Math.round(ax)} px outside ${Math.round(xLo)}..${Math.round(xHi)}`);
      if (Math.sign(S.X0[i]) !== f.c.edge && f.c.edge) fail.push(`tablet ${key} ${mode} ${LS.cardId(f.c)}: on the wrong side of the strip`);
    });
    const scen = ST.workScenarios(S, mode, true), dark = flat.map((c) => !!c.dark), copy = dark.slice();
    const ctx = { n: flat.length, scenarios: () => scen, dark: () => copy, setDark: (i, v) => { copy[i] = v; }, rank: () => 0, isDup: (i) => !!flat[i].dup, groups: () => pc.map((l) => flat.map((c, i) => (c.slug === l[0].slug ? i : -1)).filter((i) => i >= 0)) };
    const v = O.allViolations(ctx, BR);
    if (v.length) fail.push(`tablet ${key} ${mode}: ${v.length} pair overlap(s) over ${BR.pairOverlapMax}`);
    const d = O.enforceDark(ctx, BR);
    if (d.undarked) fail.push(`tablet ${key} ${mode}: ${d.undarked} card(s) would still have to be undarked`);
  }
}
if (fail.length) { console.error(`layout:check (tablet): FAILED\n  ${fail.join('\n  ')}`); process.exit(1); }
console.log(`layout:check (tablet): ${checked} layouts (size x mode) OK`);
