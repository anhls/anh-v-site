import { CARDS, TRAIL, LAYOUT } from '../timeline.js';

// Dev-only tuning panel (Selected Work cards, card layout, hero trail). Opens with ?tune in the URL; main.js imports this
// file only when import.meta.env.DEV is true, so it is never part of the production build. Sliders write straight into the
// CARDS / LAYOUT / TRAIL objects from timeline.js (the effects read them every frame), so changes show immediately.
// "Copy values" puts the current numbers on the clipboard as JSON so they can be sent back and pasted into timeline.js.
const DEFAULTS = { CARDS: { ...CARDS }, LAYOUT: { ...LAYOUT }, TRAIL: { ...TRAIL } };

// [key, label, min, max, step, hint]
const CARD_SLIDERS = [
  ['pushRadius', 'Push radius (px)', 50, 900, 5, 'New. How far from the pointer (from a card edge, px at 1920) cards are pushed away.'],
  ['pushStrength', 'Push strength (px)', 0, 400, 5, 'New. Push at the pointer for a front card. 0 = off. Deeper cards are pushed less (depth spread).'],
  ['pushFalloff', 'Push falloff softness', 0.3, 4, 0.05, 'New. 1 = linear fade to the radius edge; higher = softer edge, the push is concentrated near the pointer.'],
  ['pushStiffness', 'Push spring stiffness', 50, 1500, 10, 'New. Higher = snappier.'],
  ['pushDamping', 'Push spring damping', 5, 200, 1, 'New. Lower = more bounce.'],
  ['mouseStrength', 'Background drift amount', 0, 4, 0.05, 'Live\'s mouse drift (every card follows the mouse over the whole screen). 0 = off. 1 = live.'],
  ['mouseStiffness', 'Drift smoothing (spring)', 100, 2000, 25, 'Spring stiffness of the drift. Lower = slower, floatier.'],
  ['depthRange', 'Depth spread', 0, 2, 0.05, 'How much more front cards move than back cards (aura, push, drift, lag). 0 = all equal; 1 = live distances (back = 20% of front).'],
  ['auraWeight', 'Aura weight (floatiness)', 0.3, 3, 0.05, 'Overall heaviness of the aura motion: higher = slower, floatier; lower = snappier. Multiplies the settle softness.'],
  ['auraMargin', 'Aura margin (px)', 0, 800, 5, 'How far from the frame (px at 1920, rect to rect) cards feel it, and how early they start to part.'],
  ['auraStrength', 'Aura strength (px)', 0, 400, 5, 'Sideways push at the frame edge for a front card; eased in toward the frame. Deeper cards are pushed less (depth spread).'],
  ['auraVertical', 'Aura vertical push (px)', 0, 300, 5, 'Gentle up/down push away from the frame.'],
  ['auraFalloff', 'Aura curve', 0.3, 4, 0.05, '1 = smooth ease-in over the margin; higher = concentrated near the frame.'],
  ['auraClearance', 'Aura clearance', 0, 1, 0.05, '1 = once settled, every card keeps the minimum gap; 0 = only the soft push.'],
  ['auraMinGap', 'Aura minimum gap (px)', 0, 200, 1, 'Space kept between a card and the frame at rest (px at 1920).'],
  ['partingSoftness', 'Aura settle softness (s)', 0.1, 1.5, 0.01, 'Base spring duration of the aura offset (x weight): higher = slower, floatier.'],
  ['partingBounce', 'Aura settle bounce', 0, 0.7, 0.01, '0 = no overshoot; 0.3 = cards drift a little past and settle back.'],
  ['lagStrength', 'Lag strength', 0, 4, 0.05, '0 = off. Multiplies the delay of every card.'],
  ['lagFrontSec', 'Lag, front cards (s)', 0, 0.5, 0.01, 'Delay of the front-most layer at lag strength 1.'],
  ['lagBackSec', 'Lag, deepest cards (s)', 0, 1.5, 0.01, 'Delay of the back layer at lag strength 1.'],
];
const LAYOUT_SLIDERS = [
  ['scatter', 'Scatter (px)', 0, 400, 5, 'How far a card may move sideways from its Framer position (px at 1920).'],
  ['centreShare', 'Centre pull (share of cards)', 0, 1, 0.01, 'Share of cards that start near or across the centre line.'],
  ['centreBand', 'Centre band (px)', 0, 700, 10, 'Pulled cards start within this distance of the centre line (a few start just across it).'],
  ['minGap', 'Minimum gap (px)', 0, 120, 1, 'Space kept between cards on neighbouring depths. Different depths may overlap.'],
  ['yJitter', 'Vertical jitter (vh)', 0, 30, 0.5, 'How far a card may move up or down.'],
];
const TRAIL_SLIDERS = [
  ['frequency', 'Trail frequency', 1, 50, 1, 'Live is 25: a new image every 102 px of mouse travel (higher = closer together).'],
  ['visibleFor', 'Trail visible (s)', 0.1, 3, 0.1, 'How long each image stays before it shrinks away (live 0.5).'],
  ['startMaskShare', 'Trail start (mask % done)', 0.05, 1, 0.01, 'The trail starts when the hero mask shrink is this far done (0.6 = 60%).'],
  ['fadeAtScreen', 'Fade starts at (section top, screen %)', 0, 1, 0.01, 'The fade begins when the Selected Work top reaches this share of the screen height (0 = top, 1 = bottom).'],
  ['fadeLenVh', 'Fade length (vh of scroll)', 10, 200, 1, 'Scroll distance over which the trail dies off.'],
  ['fadeCurve', 'Fade curve', 0.3, 3, 0.05, '1 = linear. Above 1 it drops sooner, below 1 it lingers.'],
  ['minScale', 'Min scale at low intensity', 0, 1, 0.05, 'How small images get while the trail fades out.'],
];

// handles = { trail, cards } from buildTrail / buildSelectedWork
export function mountTunePanel({ trail, cards } = {}) {
  const box = document.createElement('div');
  box.setAttribute('data-tune-panel', '');
  box.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:99999;width:300px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;' +
    'background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.4);';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Tuning (cards, layout, hero trail)</strong><button data-act="hide" style="all:unset;cursor:pointer;opacity:.7">hide</button></div>
    <div data-body></div>
    <div style="display:flex;gap:8px;margin-top:10px"><button data-act="copy" style="flex:1;padding:6px;cursor:pointer">Copy values</button><button data-act="reset" style="padding:6px;cursor:pointer">Reset</button></div>
    <div data-msg style="margin-top:6px;opacity:.7;min-height:1.2em"></div>`;
  const body = box.querySelector('[data-body]');
  const msg = box.querySelector('[data-msg]');
  const readouts = [];

  const heading = (text, extra = '') => {
    const d = document.createElement('div');
    d.style.cssText = 'margin-top:12px;border-top:1px solid rgba(255,255,255,.2);padding-top:10px';
    d.innerHTML = `<strong>${text}</strong>${extra}`;
    body.appendChild(d);
    return d;
  };
  const addSliders = (obj, defs, onInput) => defs.forEach(([key, label, min, max, step, hint]) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin-bottom:9px';
    row.title = hint;
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v></span></span><input type="range" min="${min}" max="${max}" step="${step}" style="width:100%">`;
    const input = row.querySelector('input');
    const v = row.querySelector('[data-v]');
    input.value = obj[key];
    v.textContent = obj[key];
    input.addEventListener('input', () => { obj[key] = parseFloat(input.value); v.textContent = obj[key]; onInput?.(); });
    readouts.push({ obj, key, input, v });
    body.appendChild(row);
  });
  const syncReadouts = () => readouts.forEach((r) => { r.input.value = r.obj[r.key]; r.v.textContent = r.obj[r.key]; });

  heading('Cards: aura, push, drift');
  addSliders(CARDS, CARD_SLIDERS);

  // Layout: sliders regenerate the layout; Reshuffle picks a new seed.
  const layoutHead = heading('Card layout', '<div data-seed style="margin:4px 0 8px"></div><button data-act="shuffle" style="padding:5px 10px;cursor:pointer;margin-bottom:8px">Reshuffle (new seed)</button>');
  const seedEl = layoutHead.querySelector('[data-seed]');
  const showSeed = () => { seedEl.textContent = `seed ${LAYOUT.seed}`; };
  showSeed();
  addSliders(LAYOUT, LAYOUT_SLIDERS, () => cards?.relayout());

  const trailHead = heading('Hero image trail', '<div data-trail-pts style="opacity:.7;margin:2px 0 8px"></div>');
  const pts = trailHead.querySelector('[data-trail-pts]');
  const showPts = () => {
    if (!trail) return;
    const s = trail.state, H = innerHeight;
    pts.textContent = `start ${Math.round(s.start)} px (${(s.start / H * 100).toFixed(0)} vh), fade ${Math.round(s.fadeStart)} to ${Math.round(s.fadeEnd)} px (${(s.fadeStart / H * 100).toFixed(0)} to ${(s.fadeEnd / H * 100).toFixed(0)} vh)`;
  };
  showPts();
  addSliders(TRAIL, TRAIL_SLIDERS, () => { trail?.remeasure(); showPts(); });

  box.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'hide') {
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? '' : 'none';
      e.target.textContent = hidden ? 'hide' : 'show';
    } else if (act === 'shuffle') {
      LAYOUT.seed = Math.floor(Math.random() * 100000);
      showSeed();
      cards?.relayout();
    } else if (act === 'reset') {
      Object.assign(CARDS, DEFAULTS.CARDS);
      Object.assign(LAYOUT, DEFAULTS.LAYOUT);
      Object.assign(TRAIL, DEFAULTS.TRAIL);
      syncReadouts(); showSeed(); cards?.relayout(); trail?.remeasure(); showPts();
      msg.textContent = 'Reset to the defaults in timeline.js';
    } else if (act === 'copy') {
      const text = JSON.stringify({ CARDS, LAYOUT, TRAIL: Object.fromEntries(TRAIL_SLIDERS.map(([k]) => [k, TRAIL[k]])) }, null, 2);
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied. Paste it in a message to send it.'; }
      catch { msg.textContent = 'Could not copy; values are in the console.'; }
      console.log('TUNE', text);
    }
  });
  document.body.appendChild(box);
}
