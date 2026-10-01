import { CARDS, TRAIL, LAYOUT, BEND, WARP, FRAME_WARP, CARD_HOVER, CAPTION_HOVER } from '../timeline.js';

// Dev-only tuning panel (Selected Work cards, card layout, hero trail). Opens with ?tune in the URL; main.js imports this
// file only when import.meta.env.DEV is true, so it is never part of the production build. Sliders write straight into the
// CARDS / LAYOUT / TRAIL objects from timeline.js (the effects read them every frame), so changes show immediately.
// "Copy values" puts the current numbers on the clipboard as JSON so they can be sent back and pasted into timeline.js.
const DEFAULTS = { CARDS: { ...CARDS }, LAYOUT: { ...LAYOUT }, TRAIL: { ...TRAIL }, BEND: { ...BEND }, WARP: { ...WARP }, FRAME_WARP: { ...FRAME_WARP }, CARD_HOVER: { ...CARD_HOVER }, CAPTION_HOVER: { ...CAPTION_HOVER } };

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
  ['sepMaxCover', 'Max cover (share of smaller card)', 0, 1, 0.01, 'R13g. Two cards may overlap until this share of the smaller one is hidden; beyond it they are pushed apart (front card a bit more). 1 = off.'],
  ['sepStrength', 'Separation strength', 0, 1.5, 0.05, 'R13g. How fully the overlap is resolved (0 = off).'],
  ['sepPasses', 'Separation passes', 1, 6, 1, 'R13g. Relaxation passes per frame.'],
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
const HOVER_SLIDERS = [
  ['scale', 'Hover scale', 1, 1.6, 0.01, 'R17. How much the hovered card grows (live: 1.2).'],
  ['stiffness', 'Hover spring stiffness', 40, 800, 5, 'R17. Speed of the hover in / out (live fits to about 250, critically damped). Higher = faster.'],
  ['damping', 'Hover spring damping', 5, 80, 0.5, 'R17. Live fits to about 31.6 (no overshoot). Lower = a little bounce.'],
  ['darkRest', 'Dark layer at rest (1 = live)', 0, 1, 0.01, 'R17. The near-black layer that covers 19 of the cards until hovered (live: fully). 0 = no dark layers.'],
  ['darkScale', 'Dark layer scale on hover', 1, 1.6, 0.01, 'R17. Live: 1.15 (the layer grows a little less than the card while it fades).'],
  ['drift', 'Hovered card drift amount', 0, 1, 0.01, 'R17. Share of the background drift a hovered card keeps (0 = it freezes).'],
  ['pushStrength', 'Hover push strength (px)', 0, 400, 5, 'R17. How hard a hovered card pushes its neighbours away (px at 1920, front card).'],
  ['pushRadius', 'Hover push radius (px)', 0, 600, 5, 'R17. How far from the hovered card (rect to rect) neighbours are pushed.'],
];
const CAPTION_SLIDERS = [
  ['revealSec', 'Caption image: reveal (s)', 0.05, 1.2, 0.01, 'R17. How long the image takes to fade and grow in (live: about 0.2 s fade, no scale).'],
  ['hideSec', 'Caption image: hide / crossfade (s)', 0.05, 1, 0.01, 'R17. How long the old image takes to fade out (also the crossfade to the next caption). Live: instant.'],
  ['fromScale', 'Caption image: start scale', 0.6, 1, 0.01, 'R17. Size it grows from, anchored at the cursor-side (bottom left) corner. 1 = no scale.'],
  ['lineInSec', 'Caption strike-through: draw in (s)', 0.05, 1.2, 0.01, 'R17b. How long the orange line takes to draw across the title (live: about 0.42 s).'],
  ['lineOutSec', 'Caption strike-through: retract (s)', 0, 1, 0.01, 'R17b. Live: 0 (it vanishes at once). The nav links retract in about 0.2 s.'],
  ['textOutSec', 'Caption title: colour fade back (s)', 0.05, 1.2, 0.01, 'R17. How long the orange takes to fade back (live: about 0.35 s; it turns orange at once).'],
];
const WARP_SLIDERS = [
  ['strengthUp', 'Strength, scrolling up', 0, 2, 0.01, 'R16b-fix. One distortion over ALL the cards, driven by scroll speed. Scrolling UP the content near the edge bulges toward it. 0 = off.'],
  ['strengthDown', 'Strength, scrolling down', 0, 2, 0.01, 'R16b-fix. Scrolling DOWN the content near the edge recedes (smaller, narrower, a sheet curling away; never magnified). 0 = off.'],
  ['reach', 'Warp reach (share of screen)', 0.1, 1, 0.01, 'How far in from the top / bottom edge the warp fades in (1 = from the middle).'],
  ['pinch', 'Pinch, scrolling up', 0, 0.7, 0.01, 'How much narrower the content gets at the screen edge at full speed while scrolling up.'],
  ['pinchDown', 'Pinch, scrolling down', 0, 0.7, 0.01, 'R16d. The sides of the curl converge toward the trailing edge while scrolling down (0.2 = 20% narrower at the edge).'],
  ['arc', 'Arc (lines bow)', 0, 0.4, 0.005, 'How far horizontal lines bow, as a share of the screen height, against the scroll direction.'],
  ['persp', 'Perspective (curl away)', 0, 1, 0.01, 'How much the content crowds toward the edge, like a sheet curling away.'],
  ['sym', 'Top / bottom symmetry', 0, 1, 0.01, '1 = both edges warp alike; 0 = only the trailing edge (bottom when scrolling down).'],
];
const FRAME_SLIDERS = [
  ['on', 'Frame warp on (1) / off (0)', 0, 1, 1, 'R16c. Off = the frame never leaves the DOM (no warp).'],
  ['strengthUp', 'Strength, scrolling up', 0, 2, 0.01, 'The centre frame bulges toward the edge while scrolling up.'],
  ['strengthDown', 'Strength, scrolling down', 0, 2, 0.01, 'The centre frame recedes while scrolling down.'],
  ['reach', 'Reach (share of screen)', 0.1, 1, 0.01, 'How far in from the top / bottom edge the warp fades in.'],
  ['pinch', 'Pinch, scrolling up', 0, 0.7, 0.01, 'Narrowing toward the frame edge while scrolling up.'],
  ['pinchDown', 'Pinch, scrolling down', 0, 0.7, 0.01, 'The sides converge toward the trailing edge of the frame while scrolling down.'],
  ['arc', 'Arc (lines bow)', 0, 0.4, 0.005, 'Bow of the horizontal lines, as a share of the screen height.'],
  ['persp', 'Perspective (curl away)', 0, 1, 0.01, 'How much the content crowds toward the edge.'],
  ['sym', 'Top / bottom symmetry', 0, 1, 0.01, '0 = only the trailing edge warps; 1 = both.'],
  ['threshold', 'Hand-over speed (px/s)', 50, 2000, 10, 'The canvas takes the frame over once the scroll is faster than this, and hands it back when the page is still and the warp is flat.'],
  ['videoMode', 'Video while warping: poster (0) / frozen frame (1)', 0, 1, 1, '0 = crossfade to the video poster; 1 = keep the current video frame, frozen.'],
  ['fadeSec', 'Poster crossfade (s)', 0.02, 0.6, 0.01, 'Video frame to poster (and back).'],
];
const BEND_SLIDERS = [
  ['cardBend', 'Per-card bend (share kept)', 0, 1, 0.01, 'R16b. 0 = cards stay flat (default); 1 = the R16 per-card arcs on top of the screen warp.'],
  ['arcShape', 'Arc shape', 0.6, 3, 0.05, 'R17. 1 = round arc like the Codrops reference (the edge keeps curving into the corners); higher = flatter near the corners (bell).'],
  ['maxArc', 'Max arc depth (px at 1920)', 0, 200, 1, 'R16. Deepest bow of the top and bottom edges at full scroll speed (also capped at 30% of the card height). 0 = no bend.'],
  ['sensitivity', 'Speed sensitivity', 0.2, 4, 0.05, 'How fast the bend builds with scroll speed. Higher = a gentle scroll already bends the cards.'],
  ['speedRef', 'Full-speed reference (px/s)', 500, 8000, 50, 'Scroll speed that counts as full speed at sensitivity 1.'],
  ['returnSpeed', 'Return speed (rad/s)', 3, 30, 0.5, 'How quickly the edges go back to flat (higher = snappier).'],
  ['overshoot', 'Overshoot (share of the arc)', 0, 0.4, 0.01, 'How far the edges pass beyond flat on the way back, once (0.12 = 12%). 0 = no overshoot.'],
  ['depthExtreme', 'Depth bell: front/back strength', 0, 1, 0.01, 'Bend of the front-most and back-most cards as a share of the middle-depth cards.'],
  ['depthBand', 'Depth bell: width of strong band', 0.05, 1, 0.01, 'How much of the depth range bends strongly around the middle (higher = wider).'],
  ['grain', 'Grain intensity', 0, 0.15, 0.001, 'Film grain on the cards (0 = off).'],
  ['grainSpeed', 'Grain rise with scroll speed', 0, 4, 0.05, 'Extra grain at full scroll speed, as a multiple of the base grain.'],
  ['grainRate', 'Grain frames per second', 1, 60, 1, 'How often the grain pattern changes.'],
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
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Tuning (cards, layout, captions, trail)</strong><button data-act="hide" style="all:unset;cursor:pointer;opacity:.7">hide</button></div>
    <div data-body></div>
    <div style="display:flex;gap:8px;margin-top:10px"><button data-act="copy" style="flex:1;padding:6px;cursor:pointer">Copy values</button><button data-act="reset" style="padding:6px;cursor:pointer">Reset to defaults</button></div>
    <div data-msg style="margin-top:6px;opacity:.7;min-height:1.2em"></div>`;
  const body = box.querySelector('[data-body]');
  const msg = box.querySelector('[data-msg]');
  const readouts = [];

  // Sections are collapsible (<details>). ADVANCED, not shown but still in the arrays above and in Copy values: cardBend, arcShape, maxArc,
  // depthExtreme, depthBand (per-card bend), sepPasses, speedRef, grainRate, auraClearance, mouseStiffness, hover stiffness / damping,
  // darkScale, lineOutSec. To bring one back, add its id ('GROUP.key') to a section list below.
  const DEFS = {};
  const reg = (group, obj, defs) => defs.forEach((d) => { DEFS[`${group}.${d[0]}`] = [obj, d]; });
  reg('WARP', WARP, WARP_SLIDERS); reg('FRAME', FRAME_WARP, FRAME_SLIDERS); reg('BEND', BEND, BEND_SLIDERS); reg('CARDS', CARDS, CARD_SLIDERS); reg('HOVER', CARD_HOVER, HOVER_SLIDERS);
  reg('CAPTION', CAPTION_HOVER, CAPTION_SLIDERS); reg('LAYOUT', LAYOUT, LAYOUT_SLIDERS); reg('TRAIL', TRAIL, TRAIL_SLIDERS);

  const section = (title, ids, { open = false, note = '', onInput, extra } = {}) => {
    const d = document.createElement('details');
    d.open = open;
    d.style.cssText = 'margin-top:8px;border-top:1px solid rgba(255,255,255,.2);padding-top:8px';
    d.innerHTML = `<summary style="cursor:pointer;font-weight:600">${title}</summary>${note ? `<div style="opacity:.7;margin:4px 0 8px">${note}</div>` : ''}`;
    if (extra) d.insertAdjacentHTML('beforeend', extra);
    ids.forEach((id) => {
      const [obj, [key, label, min, max, step, hint]] = DEFS[id];
      const row = document.createElement('label');
      row.style.cssText = 'display:block;margin:6px 0 9px';
      row.title = hint;
      row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v></span></span><input type="range" min="${min}" max="${max}" step="${step}" style="width:100%">`;
      const input = row.querySelector('input');
      const v = row.querySelector('[data-v]');
      input.value = obj[key];
      v.textContent = obj[key];
      input.addEventListener('input', () => { obj[key] = parseFloat(input.value); v.textContent = obj[key]; onInput?.(key); });
      readouts.push({ obj, key, input, v });
      d.appendChild(row);
    });
    body.appendChild(d);
    return d;
  };
  const syncReadouts = () => readouts.forEach((r) => { r.input.value = r.obj[r.key]; r.v.textContent = r.obj[r.key]; });

  section('Warp (scroll)', ['WARP.strengthUp', 'WARP.strengthDown', 'WARP.reach', 'WARP.pinch', 'WARP.pinchDown', 'WARP.arc', 'WARP.persp', 'WARP.sym', 'BEND.sensitivity', 'BEND.returnSpeed', 'BEND.overshoot'], { open: true, note: 'One distortion over all the cards. The last three (speed sensitivity, return speed, overshoot) are shared by both directions.' });
  section('Frame warp (centre image, R16c)', ['FRAME.on', 'FRAME.strengthUp', 'FRAME.strengthDown', 'FRAME.reach', 'FRAME.pinch', 'FRAME.pinchDown', 'FRAME.arc', 'FRAME.persp', 'FRAME.sym', 'FRAME.threshold', 'FRAME.videoMode', 'FRAME.fadeSec'], { note: 'Own settings; the speed spring (sensitivity, return, overshoot) is shared with the cards.' });
  section('Grain', ['BEND.grain', 'BEND.grainSpeed']);
  section('Aura (around the frame)', ['CARDS.auraWeight', 'CARDS.auraMargin', 'CARDS.auraStrength', 'CARDS.auraVertical', 'CARDS.auraFalloff', 'CARDS.auraMinGap', 'CARDS.partingSoftness', 'CARDS.partingBounce']);
  section('Mouse (push + drift)', ['CARDS.pushRadius', 'CARDS.pushStrength', 'CARDS.pushFalloff', 'CARDS.pushStiffness', 'CARDS.pushDamping', 'CARDS.mouseStrength']);
  section('Hover (card under the pointer)', ['HOVER.scale', 'HOVER.darkRest', 'HOVER.drift', 'HOVER.pushStrength', 'HOVER.pushRadius']);
  section('Cards', ['CARDS.depthRange', 'CARDS.sepMaxCover', 'CARDS.sepStrength', 'CARDS.lagStrength', 'CARDS.lagFrontSec', 'CARDS.lagBackSec']);
  const layout = section('Layout', ['LAYOUT.scatter', 'LAYOUT.centreShare', 'LAYOUT.centreBand', 'LAYOUT.minGap', 'LAYOUT.yJitter'], { onInput: () => cards?.relayout(), extra: '<div data-seed style="margin:4px 0 8px"></div><button data-act="shuffle" style="padding:5px 10px;cursor:pointer;margin-bottom:8px">Reshuffle (new seed)</button>' });
  const seedEl = layout.querySelector('[data-seed]');
  const showSeed = () => { seedEl.textContent = `seed ${LAYOUT.seed}`; };
  showSeed();
  section('Captions (hero)', ['CAPTION.revealSec', 'CAPTION.hideSec', 'CAPTION.fromScale', 'CAPTION.lineInSec', 'CAPTION.textOutSec'], { note: 'Scroll to the top of the page and hover a caption.' });
  const trailSec = section('Hero image trail', ['TRAIL.frequency', 'TRAIL.visibleFor', 'TRAIL.startMaskShare', 'TRAIL.fadeAtScreen', 'TRAIL.fadeLenVh', 'TRAIL.fadeCurve', 'TRAIL.minScale'], { onInput: () => { trail?.remeasure(); showPts(); }, extra: '<div data-trail-pts style="opacity:.7;margin:2px 0 8px"></div>' });
  const pts = trailSec.querySelector('[data-trail-pts]');
  const showPts = () => {
    if (!trail) return;
    const st = trail.state, H = innerHeight;
    pts.textContent = `start ${Math.round(st.start)} px (${(st.start / H * 100).toFixed(0)} vh), fade ${Math.round(st.fadeStart)} to ${Math.round(st.fadeEnd)} px (${(st.fadeStart / H * 100).toFixed(0)} to ${(st.fadeEnd / H * 100).toFixed(0)} vh)`;
  };
  showPts();

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
      Object.assign(BEND, DEFAULTS.BEND);
      Object.assign(WARP, DEFAULTS.WARP);
      Object.assign(FRAME_WARP, DEFAULTS.FRAME_WARP);
      Object.assign(CARD_HOVER, DEFAULTS.CARD_HOVER);
      Object.assign(CAPTION_HOVER, DEFAULTS.CAPTION_HOVER);
      syncReadouts(); showSeed(); cards?.relayout(); cards?.gl()?.reweigh(); trail?.remeasure(); showPts();
      msg.textContent = 'Reset to the defaults in timeline.js';
    } else if (act === 'copy') {
      const text = JSON.stringify({ CARDS, LAYOUT, CARD_HOVER, CAPTION_HOVER, BEND, WARP, FRAME_WARP, TRAIL }, null, 2); // every value, including the ones without a slider
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied. Paste it in a message to send it.'; }
      catch { msg.textContent = 'Could not copy; values are in the console.'; }
      console.log('TUNE', text);
    }
  });
  document.body.appendChild(box);
}
