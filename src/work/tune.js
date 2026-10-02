import { WORK, WORK_LIMITS, CARD_HOVER } from '../timeline.js';

// Dev-only sliders for the Work page (?tune). Layout, gap, warp and morph numbers write straight into WORK (relayout() re-places everything).
// Dark share and the per-project card limits change WHICH cards exist: they apply after "Apply (reload)" (written into the URL).
const SLIDERS = [
  ['warpStrength', 'Warp strength (homepage 1.15)', 0, 3, 0.05], ['warpRiseSec', 'Warp rise time (s)', 0.05, 1.5, 0.01], ['warpSettleSec', 'Warp settle time (s)', 0.1, 2.5, 0.01], ['wheel', 'Wheel speed', 0.2, 4, 0.05],
  ['frameW', 'Frame width (vw)', 15, 60, 0.5], ['frameH', 'Frame height (vh)', 20, 80, 0.5], ['gapSide', 'Gap, side scroll (vw)', 2, 40, 0.5], ['gapVert', 'Gap, vertical (vh)', 2, 60, 0.5],
  ['overlapMax', 'Most a card may overlap the image (share of its size)', 0, 0.6, 0.01], ['dupGap', 'Duplicate distance (vw / vh)', 10, 60, 1], ['minGap', 'Minimum gap between cards (px at 1920)', 0, 120, 1], ['slack', 'Drift past the project length (x pitch)', 0, 0.8, 0.01],
  ['morphSec', 'Toggle morph (s)', 0.2, 2.5, 0.05], ['morphStagger', 'Toggle stagger (s)', 0, 1, 0.01], ['morphEase', 'Toggle ease exponent', 1, 6, 0.1], ['seed', 'Layout seed (reload)', 1, 999, 1],
];
const RELOAD = [
  ['minN', 'Cards per project, min', 0, 12, 1], ['maxN', 'Cards per project, max', 1, 16, 1], ['minA', 'Area min (px2 at 1920)', 0, 800000, 10000], ['maxA', 'Area max (px2 at 1920)', 50000, 1200000, 10000],
];
export function mountWorkTune({ relayout }) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:290px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px';
  box.innerHTML = '<strong>Work page tuning</strong>';
  const add = (obj, [key, label, min, max, step], onInput) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v>${obj[key]}</span></span><input type="range" min="${min}" max="${max}" step="${step}" value="${obj[key]}" style="width:100%">`;
    row.querySelector('input').addEventListener('input', (e) => { obj[key] = parseFloat(e.target.value); row.querySelector('[data-v]').textContent = obj[key]; onInput?.(); });
    box.append(row);
  };
  SLIDERS.forEach((d) => add(WORK, d, relayout));
  const h = document.createElement('div');
  h.style.cssText = 'margin-top:10px;font-weight:600';
  h.textContent = 'Which cards (Apply reloads)';
  box.append(h);
  add(CARD_HOVER, ['darkShare', 'Dark rest layer: share', 0, 1, 0.01]);
  RELOAD.forEach((d) => add(WORK_LIMITS, d));
  const btn = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'padding:6px;cursor:pointer;width:100%;margin-top:6px'; b.onclick = fn; box.append(b); return b; };
  btn('Apply (reload)', () => { const u = new URL(location.href); u.searchParams.set('dark', CARD_HOVER.darkShare); u.searchParams.set('wlimits', JSON.stringify(WORK_LIMITS)); location.href = u.href; });
  const copy = btn('Copy values', async () => { await navigator.clipboard.writeText(JSON.stringify({ WORK, WORK_LIMITS, darkShare: CARD_HOVER.darkShare }, null, 2)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy values'; }, 1200); });
  document.body.append(box);
}
