import { WORK, WORK_LIMITS, CARD_HOVER, DEPTH, SCROLL } from '../timeline.js';
import { tuneStore, makeCollapse } from '../effects/tune-store.js';

// Dev-only sliders for the Work page (?tune). Layout, gap, warp, snap, focus and morph numbers write straight into WORK (relayout() re-places
// everything). Dark share, front share and the per-project card limits change WHICH cards exist: they apply after "Apply (reload)" (written
// into the URL). R23e: the panel collapses to its header (the page stays clickable, values stay live), the slider values are kept in
// localStorage (only while ?tune is in the URL) and re-applied on the next load; "Reset to defaults" clears them.
const SLIDERS = [
  ['warpStrength', 'Warp strength (homepage 1.15)', 0, 3, 0.05], ['warpRiseSec', 'Warp rise time (s)', 0.05, 3, 0.01], ['warpSettleSec', 'Warp settle time (s)', 0.1, 2.5, 0.01], ['wheel', 'Wheel speed', 0.2, 4, 0.05],
  ['snapDelay', 'Snap: wheel quiet for (s)', 0.1, 2, 0.05], ['snapWindow', 'Snap: window (share of the pitch)', 0.05, 0.5, 0.01], ['snapSec', 'Snap: drift time (s)', 0.2, 3, 0.05],
  ['focusScale', 'Focus: image growth (x)', 1, 1.5, 0.01], ['focusPush', 'Focus: cards pushed out (px at 1920)', 0, 400, 5], ['focusNeighbour', 'Focus: neighbours move (share of the pitch)', 0, 0.5, 0.01], ['focusPushRadius', 'Focus: push reaches this far from the image (px at 1920)', 50, 1200, 10], ['focusPushOthers', 'Focus: push on other projects cards (share)', 0, 1.5, 0.05], ['focusRampSec', 'Focus: pop guard (s)', 0.05, 2, 0.01],
  ['frameW', 'Frame width (vw)', 15, 60, 0.5], ['frameH', 'Frame height (vh)', 20, 80, 0.5], ['gapSide', 'Gap, side scroll (vw)', 2, 40, 0.5], ['gapVert', 'Gap, vertical (vh)', 2, 60, 0.5],
  ['overlapMax', 'Most a card may overlap the image (share of its size)', 0, 0.6, 0.01], ['dupGap', 'Duplicate distance (vw / vh)', 10, 60, 1], ['minGap', 'Minimum gap between cards (px at 1920)', 0, 120, 1], ['slack', 'Drift past the project length (x pitch)', 0, 0.8, 0.01],
  ['morphSec', 'Toggle morph (s)', 0.2, 4, 0.05], ['morphStagger', 'Toggle stagger (s)', 0, 1.5, 0.01], ['morphEase', 'Toggle ease-in power', 1, 6, 0.1], ['morphLanding', 'Toggle soft landing (share of time)', 0.02, 0.4, 0.01], ['seed', 'Layout seed (reload)', 1, 999, 1],
];
const SCROLLS = [
  ['gainCap', 'Wheel acceleration: cap (1 = off)', 1, 5, 0.05], ['gainFrom', 'Acceleration starts at (px/s of wheel)', 100, 3000, 25], ['gainTo', 'Full acceleration at (px/s of wheel)', 500, 10000, 50], ['gainDecay', 'Speed hold / decay (s)', 0.05, 1.5, 0.01],
];
const RELOAD = [
  ['minN', 'Cards per project, min', 0, 12, 1], ['maxN', 'Cards per project, max', 1, 16, 1], ['minA', 'Area min (px2 at 1920)', 0, 800000, 10000], ['maxA', 'Area max (px2 at 1920)', 50000, 1200000, 10000],
];
export function mountWorkTune({ relayout }) {
  const store = tuneStore('work', ['WORK_LIMITS', 'DEPTH', 'HOVER', 'WORK.seed']);
  const defaults = { WORK: { ...WORK }, SCROLL: { ...SCROLL } };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:290px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px';
  head.innerHTML = '<strong>Work page tuning</strong>';
  const collapseBtn = document.createElement('button');
  head.append(collapseBtn);
  const content = document.createElement('div');
  box.append(head, content);
  const readouts = [];
  const add = (group, obj, [key, label, min, max, step], onInput) => {
    const id = `${group}.${key}`;
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v>${obj[key]}</span></span><input type="range" min="${min}" max="${max}" step="${step}" value="${obj[key]}" style="width:100%">`;
    const input = row.querySelector('input'), v = row.querySelector('[data-v]');
    input.addEventListener('input', () => { obj[key] = parseFloat(input.value); v.textContent = obj[key]; store.set(id, obj[key]); onInput?.(); });
    readouts.push({ obj, key, input, v });
    content.append(row);
    return id;
  };
  const defs = {};
  SLIDERS.forEach((d) => { defs[add('WORK', WORK, d, relayout)] = [WORK, d[0]]; });
  SCROLLS.forEach((d) => { defs[add('SCROLL', SCROLL, d)] = [SCROLL, d[0]]; });
  const h = document.createElement('div');
  h.style.cssText = 'margin-top:10px;font-weight:600';
  h.textContent = 'Which cards (Apply reloads)';
  content.append(h);
  add('DEPTH', DEPTH, ['frontShare', 'Cards in front of the image (share)', 0, 1, 0.01]);
  add('HOVER', CARD_HOVER, ['darkShare', 'Dark rest layer: share', 0, 1, 0.01]);
  RELOAD.forEach((d) => add('WORK_LIMITS', WORK_LIMITS, d));
  const msg = document.createElement('div');
  msg.style.cssText = 'margin-top:6px;opacity:.7;min-height:1.2em';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
  const btn = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'padding:6px;cursor:pointer;width:100%'; b.onclick = fn; row.append(b); return b; };
  btn('Apply (reload)', () => { const u = new URL(location.href); u.searchParams.set('dark', CARD_HOVER.darkShare); u.searchParams.set('front', DEPTH.frontShare); u.searchParams.set('wlimits', JSON.stringify(WORK_LIMITS)); location.href = u.href; });
  const copy = btn('Copy values', async () => { await navigator.clipboard.writeText(JSON.stringify({ WORK, WORK_LIMITS, SCROLL: { gainCap: SCROLL.gainCap, gainFrom: SCROLL.gainFrom, gainTo: SCROLL.gainTo, gainDecay: SCROLL.gainDecay }, darkShare: CARD_HOVER.darkShare, frontShare: DEPTH.frontShare }, null, 2)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy values'; }, 1200); });
  btn('Reset to defaults', () => {
    Object.assign(WORK, defaults.WORK); Object.assign(SCROLL, defaults.SCROLL);
    store.clear();
    readouts.forEach((r) => { r.input.value = r.obj[r.key]; r.v.textContent = r.obj[r.key]; });
    relayout();
    msg.textContent = 'Reset to the defaults in timeline.js';
  });
  content.append(row, msg);
  document.body.append(box);
  makeCollapse(box, [content], collapseBtn);
  // the values kept from the last visit
  const kept = store.values();
  const ids = Object.keys(kept).filter((id) => defs[id]);
  if (ids.length) {
    ids.forEach((id) => { const [obj, key] = defs[id]; obj[key] = kept[id]; });
    readouts.forEach((r) => { r.input.value = r.obj[r.key]; r.v.textContent = r.obj[r.key]; });
    relayout();
    msg.textContent = `Re-applied ${ids.length} saved values (Reset to defaults clears them)`;
  }
}
