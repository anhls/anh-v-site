import { SCROLL } from '../timeline.js';
import { tuneStore, makeCollapse } from './tune-store.js';

// Dev-only panel for the project pages (?tune): the wheel acceleration sliders (SCROLL, shared by every page), with the same collapse button,
// saved values and "Reset to defaults" as the homepage and Work panels (R23e). Never imported by the production build.
const SLIDERS = [
  ['gainCap', 'Wheel acceleration: cap (1 = off)', 1, 5, 0.05], ['gainFrom', 'Acceleration starts at (px/s of wheel)', 100, 3000, 25], ['gainTo', 'Full acceleration at (px/s of wheel)', 500, 10000, 50], ['gainDecay', 'Speed hold / decay (s)', 0.05, 1.5, 0.01],
];
export function mountScrollTune() {
  const store = tuneStore('project');
  const defaults = SLIDERS.reduce((o, [k]) => ({ ...o, [k]: SCROLL[k] }), {});
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:290px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px';
  head.innerHTML = '<strong>Project page tuning</strong>';
  const collapseBtn = document.createElement('button');
  head.append(collapseBtn);
  const content = document.createElement('div');
  box.append(head, content);
  const readouts = [];
  for (const [key, label, min, max, step] of SLIDERS) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v>${SCROLL[key]}</span></span><input type="range" min="${min}" max="${max}" step="${step}" value="${SCROLL[key]}" style="width:100%">`;
    const input = row.querySelector('input'), v = row.querySelector('[data-v]');
    input.addEventListener('input', () => { SCROLL[key] = parseFloat(input.value); v.textContent = SCROLL[key]; store.set(`SCROLL.${key}`, SCROLL[key]); });
    readouts.push({ key, input, v });
    content.append(row);
  }
  const msg = document.createElement('div');
  msg.style.cssText = 'margin-top:6px;opacity:.7;min-height:1.2em';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
  const btn = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'padding:6px;cursor:pointer;width:100%'; b.onclick = fn; row.append(b); return b; };
  const copy = btn('Copy values', async () => { await navigator.clipboard.writeText(JSON.stringify({ SCROLL: Object.fromEntries(SLIDERS.map(([k]) => [k, SCROLL[k]])) }, null, 2)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy values'; }, 1200); });
  const sync = () => readouts.forEach((r) => { r.input.value = SCROLL[r.key]; r.v.textContent = SCROLL[r.key]; });
  btn('Reset to defaults', () => { Object.assign(SCROLL, defaults); store.clear(); sync(); msg.textContent = 'Reset to the defaults in timeline.js'; });
  content.append(row, msg);
  document.body.append(box);
  makeCollapse(box, [content], collapseBtn);
  const kept = store.values();
  const ids = Object.keys(kept).filter((id) => id.startsWith('SCROLL.') && id.slice(7) in defaults);
  if (ids.length) { ids.forEach((id) => { SCROLL[id.slice(7)] = kept[id]; }); sync(); msg.textContent = `Re-applied ${ids.length} saved values (Reset to defaults clears them)`; }
}
