import { CARDS } from '../timeline.js';

// Dev-only tuning panel for the Selected Work cards. Opens with ?tune in the URL; main.js imports this file only when
// import.meta.env.DEV is true, so it is never part of the production build. Sliders write straight into the CARDS object
// from timeline.js (the cards read it every frame), so changes show immediately. "Copy values" puts the current numbers on
// the clipboard as JSON so they can be sent back and pasted into timeline.js.
const DEFAULTS = { ...CARDS };

const SLIDERS = [
  ['lagStrength', 'Lag strength', 0, 4, 0.05, 'New. 0 = off. Multiplies the delay of every card.'],
  ['lagFrontSec', 'Lag, front cards (s)', 0, 0.5, 0.01, 'Delay of the front-most layer at lag strength 1.'],
  ['lagBackSec', 'Lag, deepest cards (s)', 0, 1.5, 0.01, 'Delay of the back layer at lag strength 1.'],
  ['depthRange', 'Depth range', 0, 3, 0.05, '1 = live. 0 = all layers move like the back layer. Also scales how much deeper cards lag.'],
  ['partingStrength', 'Parting strength', 0, 3, 0.05, '1 = live. How far cards push away from the centre line while they cross the screen.'],
  ['partingSoftness', 'Parting softness (s)', 0.1, 1.5, 0.01, 'New. Spring duration of the parting: higher = slower, floatier. (Live eases at about 0.08 s.)'],
  ['partingBounce', 'Parting bounce', 0, 0.7, 0.01, 'New. 0 = no overshoot; 0.3 = cards drift a little past and settle back.'],
  ['mouseStrength', 'Mouse strength', 0, 4, 0.05, '1 = live (20 px back layer up to 100 px). Live has no radius: every card follows the mouse over the whole screen.'],
  ['mouseStiffness', 'Mouse smoothing (spring)', 100, 2000, 25, 'Spring stiffness. Lower = slower, floatier. Live is about 650.'],
];

export function mountTunePanel() {
  const box = document.createElement('div');
  box.setAttribute('data-tune-panel', '');
  box.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:99999;width:300px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;' +
    'background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.4);';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Selected Work tuning</strong><button data-act="hide" style="all:unset;cursor:pointer;opacity:.7">hide</button></div>
    <div data-body></div>
    <div style="display:flex;gap:8px;margin-top:10px"><button data-act="copy" style="flex:1;padding:6px;cursor:pointer">Copy values</button><button data-act="reset" style="padding:6px;cursor:pointer">Reset</button></div>
    <div data-msg style="margin-top:6px;opacity:.7;min-height:1.2em"></div>`;
  const body = box.querySelector('[data-body]');
  const msg = box.querySelector('[data-msg]');
  const readouts = {};

  SLIDERS.forEach(([key, label, min, max, step, hint]) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin-bottom:9px';
    row.title = hint;
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v></span></span><input type="range" min="${min}" max="${max}" step="${step}" style="width:100%">`;
    const input = row.querySelector('input');
    const v = row.querySelector('[data-v]');
    input.value = CARDS[key];
    v.textContent = CARDS[key];
    input.addEventListener('input', () => {
      CARDS[key] = parseFloat(input.value);
      v.textContent = CARDS[key];
    });
    readouts[key] = { input, v };
    body.appendChild(row);
  });

  box.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'hide') {
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? '' : 'none';
      e.target.textContent = hidden ? 'hide' : 'show';
    } else if (act === 'reset') {
      Object.assign(CARDS, DEFAULTS);
      for (const [k, r] of Object.entries(readouts)) { r.input.value = CARDS[k]; r.v.textContent = CARDS[k]; }
      msg.textContent = 'Reset to the defaults in timeline.js';
    } else if (act === 'copy') {
      const text = JSON.stringify(CARDS, null, 2);
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied. Paste it in a message to send it.'; }
      catch { msg.textContent = 'Could not copy; values are in the console.'; }
      console.log('CARDS', text);
    }
  });
  document.body.appendChild(box);
}
