import { WORK } from '../timeline.js';

// Dev-only sliders for the Work page (?tune). Values write straight into WORK; "Copy values" puts them on the clipboard as JSON.
const SLIDERS = [
  ['amplitude', 'Wave amplitude (vh)', 0, 12, 0.1], ['wavelength', 'Wavelength (share of the window)', 0.15, 2, 0.01], ['drift', 'Wave drift (cycles / s)', 0, 0.5, 0.005],
  ['push', 'Push (px at 1920)', 0, 250, 1], ['pushSmooth', 'Push ease (s)', 0.02, 1, 0.01], ['wheel', 'Wheel speed', 0.2, 4, 0.05],
  ['frameW', 'Frame width (vw)', 15, 60, 0.5], ['frameH', 'Frame height (vh)', 20, 80, 0.5], ['gapSide', 'Gap, side scroll (vw)', 8, 50, 0.5], ['gapVert', 'Gap, vertical (vh)', 12, 70, 0.5],
  ['cardsMin', 'Cards per gap, min', 1, 10, 1], ['cardsMax', 'Cards per gap, max', 1, 12, 1], ['overlapMin', 'Edge overlap, min', 0, 0.5, 0.01], ['overlapMax', 'Edge overlap, max', 0, 0.5, 0.01],
  ['seed', 'Gap seed', 1, 999, 1], ['bendSegments', 'Bend segments', 8, 128, 1],
];
export function mountWorkTune({ relayout }) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:280px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px';
  box.innerHTML = '<strong>Work page tuning</strong>';
  for (const [key, label, min, max, step] of SLIDERS) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v>${WORK[key]}</span></span><input type="range" min="${min}" max="${max}" step="${step}" value="${WORK[key]}" style="width:100%">`;
    row.querySelector('input').addEventListener('input', (e) => { WORK[key] = parseFloat(e.target.value); row.querySelector('[data-v]').textContent = WORK[key]; relayout(); });
    box.append(row);
  }
  const copy = document.createElement('button');
  copy.textContent = 'Copy values';
  copy.style.cssText = 'padding:6px;cursor:pointer;width:100%;margin-top:6px';
  copy.onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(WORK, null, 2)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy values'; }, 1200); };
  box.append(copy);
  document.body.append(box);
}
