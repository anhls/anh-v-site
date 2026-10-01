import { CARDS, TRAIL } from '../timeline.js';

// Dev-only tuning panel for the Selected Work cards. Opens with ?tune in the URL; main.js imports this file only when
// import.meta.env.DEV is true, so it is never part of the production build. Sliders write straight into the CARDS object
// from timeline.js (the cards read it every frame), so changes show immediately. "Copy values" puts the current numbers on
// the clipboard as JSON so they can be sent back and pasted into timeline.js.
const DEFAULTS = { ...CARDS };
const TRAIL_DEFAULTS = { ...TRAIL };

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

// R15 trail: scroll points are recomputed (trail.remeasure) when one of the range sliders moves.
const TRAIL_SLIDERS = [
  ['frequency', 'Trail frequency', 1, 50, 1, 'Live is 25: a new image every 102 px of mouse travel (higher = closer together).'],
  ['visibleFor', 'Trail visible (s)', 0.1, 3, 0.1, 'How long each image stays before it shrinks away (live 0.5).'],
  ['startMaskShare', 'Trail start (mask % done)', 0.05, 1, 0.01, 'The trail starts when the hero mask shrink is this far done (0.6 = 60%).'],
  ['fadeAtScreen', 'Fade starts at (section top, screen %)', 0, 1, 0.01, 'The fade begins when the Selected Work top reaches this share of the screen height (0 = top, 1 = bottom).'],
  ['fadeLenVh', 'Fade length (vh of scroll)', 10, 200, 1, 'Scroll distance over which the trail dies off.'],
  ['fadeCurve', 'Fade curve', 0.3, 3, 0.05, '1 = linear. Above 1 it drops sooner, below 1 it lingers.'],
  ['minScale', 'Min scale at low intensity', 0, 1, 0.05, 'How small images get while the trail fades out.'],
];

export function mountTunePanel(trail) {
  const box = document.createElement('div');
  box.setAttribute('data-tune-panel', '');
  box.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:99999;width:300px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;' +
    'background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.4);';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Tuning (Selected Work cards, hero trail)</strong><button data-act="hide" style="all:unset;cursor:pointer;opacity:.7">hide</button></div>
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

  const trailTitle = document.createElement('div');
  trailTitle.innerHTML = '<strong>Hero image trail</strong><div data-trail-pts style="opacity:.7;margin:2px 0 8px"></div>';
  trailTitle.style.cssText = 'margin-top:12px;border-top:1px solid rgba(255,255,255,.2);padding-top:10px';
  body.appendChild(trailTitle);
  const pts = trailTitle.querySelector('[data-trail-pts]');
  const showPts = () => { if (trail) { const s = trail.state, H = innerHeight; pts.textContent = `start ${Math.round(s.start)} px (${(s.start / H * 100).toFixed(0)} vh), fade ${Math.round(s.fadeStart)} to ${Math.round(s.fadeEnd)} px (${(s.fadeStart / H * 100).toFixed(0)} to ${(s.fadeEnd / H * 100).toFixed(0)} vh)`; } };
  showPts();
  const trailReadouts = {};
  TRAIL_SLIDERS.forEach(([key, label, min, max, step, hint]) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin-bottom:9px';
    row.title = hint;
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v></span></span><input type="range" min="${min}" max="${max}" step="${step}" style="width:100%">`;
    const input = row.querySelector('input');
    const v = row.querySelector('[data-v]');
    input.value = TRAIL[key];
    v.textContent = TRAIL[key];
    input.addEventListener('input', () => { TRAIL[key] = parseFloat(input.value); v.textContent = TRAIL[key]; trail?.remeasure(); showPts(); });
    trailReadouts[key] = { input, v };
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
      Object.assign(TRAIL, TRAIL_DEFAULTS);
      for (const [k, r] of Object.entries(trailReadouts)) { r.input.value = TRAIL[k]; r.v.textContent = TRAIL[k]; }
      trail?.remeasure(); showPts();
      for (const [k, r] of Object.entries(readouts)) { r.input.value = CARDS[k]; r.v.textContent = CARDS[k]; }
      msg.textContent = 'Reset to the defaults in timeline.js';
    } else if (act === 'copy') {
      const text = JSON.stringify({ CARDS, TRAIL: Object.fromEntries(TRAIL_SLIDERS.map(([k]) => [k, TRAIL[k]])) }, null, 2);
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied. Paste it in a message to send it.'; }
      catch { msg.textContent = 'Could not copy; values are in the console.'; }
      console.log('TUNE', text);
    }
  });
  document.body.appendChild(box);
}
