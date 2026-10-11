import { WORK, WORK_V2, WORK_TEXT, WORK_SMEAR, WORK_LINE, WORK_PTR, WORK_TITLE, WORK_INFO, WORK_RULER, WORK_COUNTER, WORK_UI, WORK_LIMITS, CARD_HOVER, DEPTH, SCROLL, BAND_RULES, TRANSITION, TALL, TABLET } from '../timeline.js';
import { EASES } from '../util/ease.js';
import { tuneStore, makeCollapse, tuneGroups, legacySwitch } from '../effects/tune-store.js';
import { tuneDoc } from '../effects/tune-docs.js';

// Dev-only sliders for the Work page (?tune). Layout, gap, warp, snap, focus and morph numbers write straight into WORK (relayout() re-places
// everything). Dark share, front share and the per-project card limits change WHICH cards exist: they apply after "Apply (reload)" (written
// into the URL). R23e: the panel collapses to its header (the page stays clickable, values stay live), the slider values are kept in
// localStorage (only while ?tune is in the URL) and re-applied on the next load; "Reset to defaults" clears them.
const SLIDERS = [
  ['wheel', 'Wheel speed', 0.2, 4, 0.05],
  ['snapDelay', 'Snap: wheel quiet for (s)', 0.1, 2, 0.05], ['snapWindow', 'Snap: window (share of the pitch)', 0.05, 0.5, 0.01], ['snapSec', 'Snap: drift time (s)', 0.2, 3, 0.05],
  ['focusScale', 'Focus: image growth (x)', 1, 1.5, 0.01], ['focusPush', 'Focus: cards pushed out (px at 1920)', 0, 400, 5], ['focusNeighbour', 'Focus: neighbours move (share of the pitch)', 0, 0.5, 0.01], ['focusPushRadius', 'Focus: push reaches this far from the image (px at 1920)', 50, 1200, 10], ['focusPushOthers', 'Focus: push on other projects cards (share)', 0, 1.5, 0.05], ['focusRampSec', 'Focus: pop guard (s)', 0.05, 2, 0.01],
  ['frameW', 'Frame width (vw)', 15, 60, 0.5], ['frameH', 'Frame height (vh)', 20, 80, 0.5], ['gapSide', 'Gap, side scroll (vw)', 2, 40, 0.5], ['gapVert', 'Gap, vertical (vh)', 2, 60, 0.5],
  ['overlapMax', 'Most a card may overlap the image (share of its size)', 0, 0.6, 0.01], ['dupGap', 'Duplicate distance (vw / vh)', 10, 60, 1], ['minGap', 'Minimum gap between cards (px at 1920)', 0, 120, 1], ['slack', 'Drift past the project length (x pitch)', 0, 0.8, 0.01],
  ['dragFriction', 'Drag release: friction time (s)', 0.1, 2, 0.05], ['dragMaxCoast', 'Drag release: most coast (pitches)', 0.2, 4, 0.05], ['dragCoastKnee', 'Drag release: extra coast past the most (0 = hard stop at the most)', 0, 2, 0.05], ['dragSnapBlend', 'Drag release: snap starts under (px/s, 0 = off)', 0, 400, 5], ['snapOvershoot', 'Overshoot: soft snap', 0, 0.3, 0.005], ['morphOvershoot', 'Overshoot: toggle morph', 0, 0.3, 0.005],
  ['focusOvershootScale', 'Overshoot: focus image scale', 0, 0.3, 0.005], ['focusOvershootPush', 'Overshoot: focus push', 0, 0.3, 0.005],
  ['overshootSettle', 'Overshoot settle (share of a clocked move)', 0.1, 0.8, 0.01], ['followerSettleSec', 'Focus bump settle (s)', 0.1, 1.5, 0.01],
  ['ambDelay', 'Ambient drift: starts after rest (s)', 0.5, 10, 0.1], ['ambFrame', 'Ambient drift: image travel (px at 1920)', 0, 80, 1], ['ambTau', 'Ambient drift: time constant (s)', 2, 60, 0.5], ['ambReturnSec', 'Ambient drift: return on input (s)', 0.1, 3, 0.05],
  ['ambCardMulMin', 'Ambient drift: card travel, min (x image)', 0, 8, 0.1], ['ambCardMulMax', 'Ambient drift: card travel, max (x image)', 0, 8, 0.1], ['ambTauVar', 'Ambient drift: card speed variation', 0, 0.8, 0.01], ['ambStagger', 'Ambient drift: card start spread (s)', 0, 6, 0.1],
  ['ambCross', 'Ambient drift: card cross lean (share of travel)', 0, 1, 0.01], ['ambSway', 'Ambient drift: card sway (px at 1920)', 0, 20, 0.5],
  ['leadMin', 'Speed lead: card, min (x strip speed over 0.4 s)', 0, 1.5, 0.01], ['leadMax', 'Speed lead: card, max', 0, 1.5, 0.01], ['leadMaxPx', 'Speed lead: furthest ahead (px at 1920)', 0, 500, 5], ['leadCapPerCard', 'Speed lead: own limit per card (1) or one limit (0)', 0, 1, 1],
  ['leadStiffness', 'Speed lead: return spring stiffness', 5, 300, 1], ['leadDamping', 'Speed lead: return spring damping', 1, 60, 0.5], ['leadVar', 'Speed lead: spring variation per card', 0, 0.8, 0.01],
  ['forceFrom', 'Overshoot force: none below (px/s at 1920)', 0, 3000, 25], ['forceTo', 'Overshoot force: full from (px/s at 1920)', 0, 4000, 25],   ['easeSoftness', 'Ease softness (0 = pure curve, 1 = linear)', 0, 1, 0.01], ['morphSec', 'Toggle morph (s)', 0.2, 4, 0.05], ['morphStagger', 'Toggle stagger (s)', 0, 1.5, 0.01], ['morphEase', 'Toggle ease-in power', 1, 6, 0.1], ['morphLanding', 'Toggle soft landing (share of time)', 0.02, 0.4, 0.01], ['seed', 'Layout seed (reload)', 1, 999, 1],
];
// R22h: the two warps (WORK.cardWarp for the cards, WORK.frameWarp for the main images), same sliders for both
const WARP_SLIDERS = [
  ['strength', 'Strength', 0, 3, 0.05], ['riseSec', 'Rise time (s)', 0.05, 4, 0.01], ['settleSec', 'Settle time (s)', 0.1, 4, 0.01], ['curl', 'Curl (rad at full strength)', 0.1, 1.2, 0.01],
  ['camDown', 'Camera distance, + side (screen heights)', 0.5, 4, 0.01], ['camUp', 'Camera distance, - side (screen heights)', 0.5, 4, 0.01], ['bowDown', 'Dome, + side', 0, 0.4, 0.005], ['bowUp', 'Dome, - side', 0, 0.4, 0.005],
  ['reach', 'Reach (share of the length that bends)', 0.2, 1, 0.01], ['sym', 'Leading side weight', 0, 1, 0.05],
];
// R24i: the image warp's axis lean (the main images only)
const LEAN_SLIDERS = [['speedRef', 'Speed curve: speed for full warp (screen lengths / s)', 1, 12, 0.1], ['speedPow', 'Speed curve: power (higher = a softer start)', 0.6, 3, 0.05], ['speedKnee', 'Speed curve: knee', 0.3, 6, 0.1], ['lean', 'Axis lean (screen lengths at full warp)', 0, 1, 0.01], ['leanMax', 'Axis lean: cap (screen lengths)', 0, 0.8, 0.01], ['leanSign', 'Axis lean direction (+1 / -1)', -1, 1, 2], ['leanSignDown', 'Axis lean direction when scrolling DOWN (+1 toward the motion / -1 against)', -1, 1, 2], ['leanSignUp', 'Axis lean direction when scrolling UP (+1 toward the motion / -1 against)', -1, 1, 2], ['leanBuf', 'Axis lean: extra warp-buffer overscan (screen lengths; applies after a resize)', 0, 0.6, 0.01]];
const SCROLLS = [
  ['gainCap', 'Wheel acceleration: cap (1 = off)', 1, 5, 0.05], ['gainFrom', 'Acceleration starts at (px/s of wheel)', 100, 3000, 25], ['gainTo', 'Full acceleration at (px/s of wheel)', 500, 10000, 50], ['gainDecay', 'Speed hold / decay (s)', 0.05, 1.5, 0.01],
];
// R25: opening a project from a main image (src/effects/project-transition.js)
const TRANS = [['reboundAmp', 'Inward rebound (bow multiplier)', 0, 2, 0.01], ['reboundSec', 'Rebound duration (s)', 0, 1.5, 0.01], ['reboundPeakAt', 'Rebound peak (phase share)', 0.05, 0.95, 0.01], ['reboundZoom', 'Rebound zoom pulse (share)', 0, 0.15, 0.005], ['backRebound', 'Rebound on return (1 = on)', 0, 1, 1], ['workSec', 'Work open / back duration (s)', 0.2, 2.5, 0.05], ['workPushSec', 'Work clearing push duration (s)', 0.1, 2.5, 0.05], ['workLandAt', 'Work landing (time share)', 0.1, 1, 0.01], ['bulgeEndAt', 'Pillow ends (time share)', 0.1, 1, 0.01], ['cornerAmp', 'Corner radius (short-side share)', 0, 0.3, 0.005], ['zoomAmp', 'Pillow texture zoom (share)', 0, 0.15, 0.005], ['bulgeAmp', 'Pillow bow (short-side share)', 0, 0.4, 0.005], ['bulgePeakAt', 'Pillow peak (time share)', 0.1, 0.9, 0.01], ['bulgeOvershoot', 'Work box overshoot (share)', 0, 0.15, 0.005], ['sec', 'Open project: the move (s)', 0.2, 2.5, 0.05], ['fadeSec', 'Open project: the rest goes dark in (s)', 0.1, 2, 0.05], ['pushSec', 'Open project: cards move away over (s of the move)', 0.1, 2.5, 0.05], ['pushScale', 'Open project: how far they move (1 = focus push, 0 = off)', 0, 2, 0.05], ['pushFar', 'Open project: far cards share', 0, 1.5, 0.05], ['pushClear', 'Open project: clearing push (1) or short push (0)', 0, 1, 1], ['clearMargin', 'Open project: clearing margin (px at 1920)', 0, 300, 5], ['clearStagger', 'Open project: far items start later (share)', 0, 0.8, 0.01], ['blackMax', 'Open project: black layer, most (0 = none)', 0, 1, 0.05], ['crossFrom', 'Homepage frame: crossfade starts at (share of the move)', 0, 1, 0.01], ['crossTo', 'Homepage frame: crossfade ends at', 0, 1, 0.01]];
// R32 Work page v2 (desktop): image size and gaps, the title, the info blocks, the ruler, the counter, the switch copy. All redraw through relayout().
const V2_SLIDERS = [
  [WORK_V2, 'WORK_V2', [['frameW', 'Image width (vw)', 30, 75, 0.1], ['frameH', 'Image height limit (vh)', 25, 75, 0.1], ['gapSide', 'Gap, side (vw)', 0.5, 12, 0.05], ['gapVert', 'Gap, vertical (vh)', 0.5, 20, 0.05], ['focusScale', 'Centre image growth (x)', 0.9, 1.3, 0.005], ['focusNeighbour', 'Neighbours move away (share of the pitch)', 0, 0.2, 0.005], ['hoverOn', 'Hover enlarge on (1) / off (0)', 0, 1, 1], ['hoverScale', 'Hover enlarge: centre image growth (x)', 1, 1.15, 0.005], ['hoverSec', 'Hover enlarge: ease time (s)', 0.1, 2, 0.05], ['hoverClickSec', 'Hover enlarge: ease back on a click (s)', 0.02, 0.6, 0.01], ['modeRollPx', 'Mode switch: info text roll distance (px)', 0, 60, 1], ['modeRollSec', 'Mode switch: info text roll time (s)', 0.1, 1.2, 0.01], ['modeRollBounce', 'Mode switch: info text roll bounce', 0, 0.6, 0.01], ['modeRollStagger', 'Mode switch: delay between tags, year, description (s)', 0, 0.3, 0.005], ['modeRollInAt', 'Mode switch: new text rolls in at this share of the morph', 0.1, 1, 0.01], ['rollLineStagger', 'Info roll: delay between the lines of a column (s)', 0, 0.3, 0.005], ['rollMinSec', 'Info roll: fastest roll when scrolling hard (s)', 0.1, 0.8, 0.01], ['rollSpeedRef', 'Info roll: strip speed that gives the fastest roll (screen lengths / s)', 0.2, 6, 0.1], ['rollSpeedPow', 'Info roll: how the roll speeds up with the scroll speed (curve)', 0.3, 3, 0.05]]],
  [WORK_TEXT, 'WORK_TEXT', [['textBlurPx', 'Info text: blur while the strip moves (px)', 0, 30, 0.5], ['textBlurInSec', 'Info text: blur-in time (s)', 0.02, 1, 0.01], ['textBlurOutSec', 'Info text: blur-out time after the stop (s)', 0.1, 3, 0.05], ['swapHoldMs', 'Info text: hold at full blur before the swap (ms)', 0, 400, 5], ['scrollStopSec', 'Scroll stop: no input for (s)', 0.02, 1, 0.01], ['scrollStopSpeed', 'Scroll stop: a coast slower than this counts as stopped (screen lengths / s)', 0.005, 0.5, 0.005], ['titleOutSec', 'Title: fade-out time when the strip moves (s)', 0.02, 1, 0.01]]],
  [WORK_LINE, 'WORK_LINE', [['scrollLineOn', 'Scroll line on (1) / off (0)', 0, 1, 1], ['scrollLineOpacity', 'Scroll line: brightness', 0, 0.6, 0.01], ['scrollLineFollowSec', 'Scroll line: how long it takes to catch up with the strip (s)', 0.1, 4, 0.05], ['scrollLineWidth', 'Scroll line: thickness (px at 1920)', 1, 6, 0.5], ['scrollLineOver', 'Scroll line over the pictures (1) / behind them (0)', 0, 1, 1], ['scrollLineGap', 'Scroll line: time spent outside the screen between leaving and coming back (share of the width)', 0, 1, 0.01]]],
  [WORK_SMEAR, 'WORK_SMEAR', [['enterSec', 'Title: enter time (s)', 0.2, 2.5, 0.01], ['enterPow', 'Title: enter curve (higher = forms faster at the start)', 1, 6, 0.05], ['leaveSec', 'Title: leave time when the strip moves (s)', 0.1, 1.5, 0.01], ['enterAlphaPow', 'Title: enter opacity curve (1 = as the distortion, lower = readable earlier)', 0.2, 3, 0.05], ['leaveAlphaPow', 'Title: leave opacity curve (lower = the letters stay readable longer while they streak away)', 0.1, 3, 0.05], ['noiseScale', 'Title: wobble size (noise scale)', 0.5, 20, 0.1], ['noiseAmount', 'Title: wobble amount', 0, 0.8, 0.01], ['pull', 'Title: corner pull strength', 0, 2, 0.05]]],
  [WORK_COUNTER, 'WORK_COUNTER', [['size', 'Counter: numeral size (pt at 1920)', 40, 200, 1], ['counterSettleSec', 'Counter: settle time (s)', 0.1, 1, 0.01], ['counterBlurPx', 'Counter: rolling blur (px)', 0, 20, 0.5], ['counterMaxSteps', 'Counter: fastest roll (numbers / s)', 2, 40, 1], ['counterHysteresis', 'Counter: hysteresis (pitches past half-way)', 0, 0.4, 0.01], ['counterMaxAccel', 'Counter: most acceleration (numbers / s2)', 10, 400, 5], ['counterMaxSpeed', 'Counter: top speed (numbers / s)', 4, 40, 0.5]]],
  [WORK_PTR, 'WORK_PTR', [['on', 'Pixel smear on (1) / off (0)', 0, 1, 1], ['pixelGrid', 'Pixel smear: grid columns (blockiness)', 8, 96, 1], ['pixelBrush', 'Pixel smear: brush radius (share of the image height)', 0.03, 0.6, 0.01], ['pixelStrength', 'Pixel smear: strength', 0, 0.2, 0.002], ['pixelRelax', 'Pixel smear: relax per 1/60 s (higher = longer trail)', 0.5, 0.99, 0.005], ['pixelVelMax', 'Pixel smear: fastest pointer taken in', 0.2, 8, 0.1], ['pixelRgb', 'Pixel smear: colour split', 0, 0.06, 0.001], ['pixelSideMul', 'Pixel smear: share on the side pictures (0 = centre only)', 0, 2, 0.05], ['pixelSpill', 'Pixel smear: spill past the picture edge (px at 1920)', 0, 120, 1], ['clickSec', 'Pixel smear: eases out on a click / drag (s)', 0.02, 0.6, 0.01], ['warpCap', 'Pixel smear: fades with the scroll warp (1 = gone at full warp)', 0, 2, 0.05]]],
  [WORK_TITLE, 'WORK_TITLE', [['size', 'Title: size (pt at 1920)', 60, 260, 1], ['tracking', 'Title: tracking (em)', -0.1, 0.2, 0.005], ['fitFrac', 'Title: widest allowed (share of the image width)', 0.4, 1.1, 0.005], ['baseDy', 'Title: baseline below the image centre (px at 1920)', -100, 200, 1], ['dx', 'Title: shift sideways (px at 1920)', -30, 30, 0.5]]],
  [WORK_UI, 'WORK_UI', [['smallSize', 'Small text size (pt at 1920)', 8, 24, 0.5], ['tracking', 'Small text tracking (em)', -0.05, 0.2, 0.005], ['counterTracking', 'Counter tracking between the two digits (em)', -0.1, 0.1, 0.005], ['dimOpacity', 'Dim text opacity (label, Reach out, /N, switch)', 0, 1, 0.01], ['descOpacity', 'Description opacity', 0, 1, 0.01]]],
  [WORK_INFO, 'WORK_INFO', [['fadeIn', 'Info block: fully visible within (pitches)', 0, 0.5, 0.01], ['fadeOut', 'Info block: gone beyond (pitches)', 0.1, 1, 0.01]]],
  [WORK_INFO.side, 'WORK_INFO.side', [['tagsDx', 'Info, side: tags x from the image edge (px at 1920)', -100, 100, 0.5], ['top', 'Info, side: block top from the page top (px at 1920)', 0, 200, 0.5], ['minGap', 'Info, side: least gap to the image top (px at 1920)', 0, 100, 1], ['logoBottom', 'Info, side: logo bottom edge (px at 1920)', 0, 150, 1], ['yearRight', 'Info, side: year right edge from the image right (px)', -600, 0, 1], ['descLeft', 'Info, side: description left from the image right (px)', -600, 0, 1]]],
  [WORK_INFO.vertical, 'WORK_INFO.vertical', [['tagsRight', 'Info, vertical: tags left from the image left (px)', -500, 0, 1], ['yearLeft', 'Info, vertical: year from the image right (px)', 0, 300, 1], ['descLeft', 'Info, vertical: description from the image right (px)', 0, 400, 1]]],
  [WORK_RULER, 'WORK_RULER', [['pitch', 'Ruler: spacing between dots (px at 1920)', 8, 50, 0.5], ['extra', 'Ruler: extra room around the bar (px)', 0, 20, 0.5], ['dot', 'Ruler: dot size (px)', 1, 8, 0.5], ['bar', 'Ruler: bar length (px)', 10, 80, 1], ['barW', 'Ruler: bar thickness (px)', 1, 6, 0.5], ['rulerDimOpacity', 'Ruler: dot brightness (dim opacity)', 0.1, 1, 0.01], ['rulerShrinkSec', 'Ruler: bar shrinks to a dot in (s)', 0.05, 1.5, 0.01], ['rulerGrowSec', 'Ruler: next dot lights and grows in (s)', 0.05, 2, 0.01], ['rulerCentreMin', 'Ruler: the dot nearest the centre never dims below', 0.3, 1, 0.01]]],
];
const RELOAD = [
  ['minN', 'Cards per project, min', 0, 12, 1], ['maxN', 'Cards per project, max', 1, 16, 1], ['minA', 'Area min (px2 at 1920)', 0, 800000, 10000], ['maxA', 'Area max (px2 at 1920)', 50000, 1200000, 10000],
];
export function mountWorkTune({ relayout }) {
  const store = tuneStore('work', ['WORK_LIMITS', 'DEPTH', 'HOVER', 'WORK.seed', 'BAND_RULES']);
  const defaults = { v2: V2_SLIDERS.map(([o]) => ({ ...o })), copy: { ...WORK_UI.copy }, WORK: { ...WORK }, TRANSITION: { ...TRANSITION }, SCROLL: { ...SCROLL }, cardWarp: { ...WORK.cardWarp }, frameWarp: { ...WORK.frameWarp }, TALL: { ...TALL }, tallWarp: { ...TALL.frameWarp }, TABLET: { ...TABLET } };
  // R33h: every object the panel can change, under the names timeline.js exports them (WORK carries cardWarp / frameWarp, TALL carries frameWarp; WORK_UI carries copy). "Copy values" writes all of
  // them, "Copy changed only" the leaves that differ from this snapshot (taken before the stored slider values are applied = the timeline.js defaults, plus the URL overrides of the card shares).
  const EXPORT = { WORK, WORK_LIMITS, SCROLL, TRANSITION, TALL, TABLET, WORK_V2, WORK_UI, WORK_TITLE, WORK_INFO, WORK_RULER, WORK_TEXT, WORK_COUNTER, WORK_SMEAR, WORK_LINE, WORK_PTR, CARD_HOVER, DEPTH, BAND_RULES };
  const plain = (o) => JSON.parse(JSON.stringify(o)); // (functions such as SCROLL.easing drop out)
  const snapshot = plain(EXPORT);
  const diffOf = (cur, def, out = {}) => { for (const k of Object.keys(cur)) { const a = cur[k], b = def?.[k]; if (a && typeof a === 'object' && !Array.isArray(a)) { const sub = diffOf(a, b || {}); if (Object.keys(sub).length) out[k] = sub; } else if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = a; } return out; };
  const applyDeep = (target, src) => { for (const k of Object.keys(src)) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && target[k] && typeof target[k] === 'object') applyDeep(target[k], src[k]); else if (typeof src[k] !== 'function') target[k] = src[k]; } };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;width:290px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px;background:rgba(20,20,20,.92);color:#fff;font:12px/1.35 system-ui,sans-serif;border-radius:8px';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px';
  head.innerHTML = '<strong>Work page tuning</strong>';
  const collapseBtn = document.createElement('button');
  head.append(collapseBtn);
  const content = document.createElement('div');
  box.append(head, content);
  box.setAttribute('data-tune-box', '');
  const groups = tuneGroups(content, 'work', store, tuneDoc); // R22h: Active / Settled + the descriptions; R33c: + Legacy (hidden)
  legacySwitch(content, 'work', store);
  const readouts = [], copyRows = [];
  const add = (group, obj, [key, label, min, max, step], onInput) => {
    const id = `${group}.${key}`;
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = `<span style="display:flex;justify-content:space-between"><span>${label}</span><span data-v>${obj[key]}</span></span><input type="range" min="${min}" max="${max}" step="${step}" value="${obj[key]}" style="width:100%">`;
    const input = row.querySelector('input'), v = row.querySelector('[data-v]');
    input.addEventListener('input', () => { obj[key] = parseFloat(input.value); v.textContent = obj[key]; store.set(id, obj[key]); onInput?.(); });
    readouts.push({ obj, key, input, v, def: obj[key], label: row.firstElementChild.firstElementChild });
    groups.add(id, row);
    return id;
  };
  const defs = {};
  // R22f: the shared ease curve (snap drift, focus build, toggle morph): a selector here, the softness slider is in the list below
  {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = '<span style="display:block">Ease curve (snap, focus, morph)</span><select style="width:100%"></select>';
    const sel = row.querySelector('select');
    Object.keys(EASES).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = k === 'circ' ? 'circ (the old curve)' : k; sel.append(o); });
    sel.value = WORK.easeType;
    sel.addEventListener('change', () => { WORK.easeType = sel.value; store.set('WORK.easeType', sel.value); });
    readouts.push({ obj: WORK, key: 'easeType', input: sel, v: { textContent: '' }, def: WORK.easeType, label: row.firstElementChild });
    groups.add('WORK.easeType', row);
    defs['WORK.easeType'] = [WORK, 'easeType'];
  }
  // R22i: focus after a toggle: until the next input, or seconds after the morph ends (0 = as before)
  {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:7px 0';
    row.innerHTML = '<span style="display:block">Focus after a toggle</span><select style="width:100%"></select>';
    const sel = row.querySelector('select');
    [['input', 'off until the next input'], [0, 'on at once (as before)'], [1, 'on after 1 s'], [2, 'on after 2 s'], [4, 'on after 4 s']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = String(v); o.textContent = t; sel.append(o); });
    const apply = (v) => { WORK.focusAfterMorph = v === 'input' ? 'input' : Number(v); };
    sel.value = String(WORK.focusAfterMorph);
    sel.addEventListener('change', () => { apply(sel.value); store.set('WORK.focusAfterMorph', WORK.focusAfterMorph); });
    readouts.push({ obj: WORK, key: 'focusAfterMorph', input: sel, v: { textContent: '' }, def: WORK.focusAfterMorph, label: row.firstElementChild });
    groups.add('WORK.focusAfterMorph', row);
    defs['WORK.focusAfterMorph'] = [WORK, 'focusAfterMorph'];
  }
  SLIDERS.forEach((d) => { defs[add('WORK', WORK, d, relayout)] = [WORK, d[0]]; });
  SCROLLS.forEach((d) => { defs[add('SCROLL', SCROLL, d)] = [SCROLL, d[0]]; });
  TRANS.forEach((d) => { defs[add('TRANSITION', TRANSITION, d)] = [TRANSITION, d[0]]; });
  for (const [block, title] of [['frameWarp', 'Image warp (the main images)'], ['cardWarp', 'Card warp (the cards)']]) {
    const hd = document.createElement('div');
    hd.style.cssText = 'margin-top:10px;font-weight:600';
    hd.textContent = title;
    groups.header(hd, { legacy: block === 'cardWarp' });
    WARP_SLIDERS.concat(block === 'frameWarp' ? LEAN_SLIDERS : []).forEach((d) => { defs[add(`WORK.${block}`, WORK[block], d)] = [WORK[block], d[0]]; });
  }
  { // R32
    const h2 = document.createElement('div');
    h2.style.cssText = 'margin-top:10px;font-weight:600';
    h2.textContent = 'Work v2 (desktop page)';
    groups.header(h2);
    V2_SLIDERS.forEach(([obj, name, list]) => list.forEach((d) => { defs[add(name, obj, d, relayout)] = [obj, d[0]]; }));
    for (const [k, label] of [['side', 'Switch copy, side mode'], ['vertical', 'Switch copy, vertical mode']]) {
      const row = document.createElement('label');
      row.style.cssText = 'display:block;margin:7px 0';
      row.innerHTML = `<span style="display:block">${label}</span><input type="text" style="width:100%" value="${WORK_UI.copy[k]}">`;
      const inp = row.querySelector('input');
      inp.addEventListener('input', () => { WORK_UI.copy[k] = inp.value; relayout(); });
      copyRows.push({ k, inp, def: WORK_UI.copy[k], label: row.firstElementChild });
      groups.add(`WORK_UI.copy.${k}`, row);
    }
  }
  // R24d / R24e: the phone, tablet-portrait and tablet-landscape Work page (the lite modes): image size, the image warp, the frame-time guard. Only live in those modes (?mode=tall, a touch screen)
  {
    const hl = document.createElement('div');
    hl.style.cssText = 'margin-top:10px;font-weight:600';
    hl.textContent = 'Phone / tablet Work page';
    groups.header(hl);
    defs[add('TALL', TALL, ['frame', 'Phone + tablet portrait: image width (share of the screen width)', 0.4, 1, 0.01], relayout)] = [TALL, 'frame'];
    defs[add('TABLET', TABLET, ['frameH', 'Tablet landscape: image height (share of the screen height)', 0.3, 0.9, 0.01], relayout)] = [TABLET, 'frameH'];
    defs[add('TALL', TALL, ['gapV', 'Phone + tablet portrait: gap between images (share of the image height)', 0, 1.5, 0.01], relayout)] = [TALL, 'gapV'];
    defs[add('TALL', TALL, ['warpGain', 'Phone / tablet warp: swipe sensitivity (gain)', 0.02, 0.6, 0.005])] = [TALL, 'warpGain'];
    defs[add('TALL', TALL, ['warpPow', 'Phone / tablet warp: curve (1 = linear, higher = gentle swipes bend less)', 1, 3, 0.05])] = [TALL, 'warpPow'];
    for (const d of [['flingGain', 'Phone / tablet flick: release speed gain', 0.3, 3, 0.05], ['flingRef', 'Phone / tablet flick: reference speed (screen lengths / s)', 0.5, 4, 0.05], ['flingPow', 'Phone / tablet flick: curve (1 = linear, higher = light swipes glide less)', 1, 3, 0.05], ['flingMin', 'Phone / tablet flick: no glide under (screen lengths / s)', 0, 1, 0.02], ['dragFriction', 'Phone / tablet flick: friction time (s)', 0.1, 3, 0.05], ['dragMaxCoast', 'Phone / tablet flick: most glide (images)', 0.5, 16, 0.25], ['flingKnee', 'Phone / tablet flick: how fast the glide nears the most past 8 screen lengths / s (screen lengths / s)', 0.5, 12, 0.25], ['snapAfterSpeed', 'Phone / tablet: soft snap starts under (screen lengths / s)', 0.05, 1, 0.01], ['snapDelay', 'Phone / tablet: soft snap waits after the last movement (s)', 0.05, 2, 0.05], ['warpFall', 'Phone / tablet warp: fall time (s)', 0.2, 4, 0.05], ['focusDelay', 'Phone / tablet: the project name / focus waits after the glide stopped (s)', 0, 2, 0.05]]) defs[add('TALL', TALL, d)] = [TALL, d[0]];
    defs[add('TALL', TALL, ['guardMs', 'Frame-time guard: median over (ms)', 8, 60, 1])] = [TALL, 'guardMs'];
    defs[add('TALL', TALL, ['guardP95', 'Frame-time guard: p95 over (ms)', 10, 100, 1])] = [TALL, 'guardP95'];
    WARP_SLIDERS.concat(LEAN_SLIDERS).forEach((d) => { defs[add('TALL.frameWarp', TALL.frameWarp, d)] = [TALL.frameWarp, d[0]]; });
  }
  const h = document.createElement('div');
  h.style.cssText = 'margin-top:10px;font-weight:600';
  h.textContent = 'Which cards (Apply reloads)';
  groups.header(h, { legacy: true });
  add('DEPTH', DEPTH, ['frontShare', 'Cards in front of the image (share)', 0, 1, 0.01]);
  add('HOVER', CARD_HOVER, ['darkShare', 'Dark rest layer: share', 0, 1, 0.01]);
  RELOAD.forEach((d) => add('WORK_LIMITS', WORK_LIMITS, d));
  add('BAND_RULES', BAND_RULES, ['maxDarkPerCluster', 'Dark cards per cluster, most', 1, 6, 1]);
  add('BAND_RULES', BAND_RULES, ['minLightShare', 'Light cards per project, at least (share)', 0, 1, 0.05]);
  add('BAND_RULES', BAND_RULES, ['pairOverlapMax', 'Any pair overlap, most (share of the smaller card)', 0, 1, 0.01]);
  const msg = document.createElement('div');
  msg.style.cssText = 'margin-top:6px;opacity:.7;min-height:1.2em';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
  const btn = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'padding:6px;cursor:pointer;width:100%'; b.onclick = fn; row.append(b); return b; };
  btn('Apply (reload)', () => { const u = new URL(location.href); u.searchParams.set('dark', CARD_HOVER.darkShare); u.searchParams.set('front', DEPTH.frontShare); u.searchParams.set('wlimits', JSON.stringify(WORK_LIMITS)); u.searchParams.set('pairov', BAND_RULES.pairOverlapMax); location.href = u.href; });
  const copyText = (b, label, text) => async () => { await navigator.clipboard.writeText(text()); b.textContent = 'Copied'; setTimeout(() => { b.textContent = label; }, 1200); };
  const fullJson = () => JSON.stringify(plain(EXPORT), null, 2);
  const changedJson = () => JSON.stringify(diffOf(plain(EXPORT), snapshot), null, 2);
  const copy = btn('Copy values', () => copyText(copy, 'Copy values', fullJson)());
  const copyChanged = btn('Copy changed only', () => copyText(copyChanged, 'Copy changed only', changedJson)());
  const resetBtn = btn('Reset to defaults', () => {
    Object.assign(WORK, defaults.WORK); Object.assign(SCROLL, defaults.SCROLL); Object.assign(TRANSITION, defaults.TRANSITION); Object.assign(WORK.cardWarp, defaults.cardWarp); Object.assign(WORK.frameWarp, defaults.frameWarp); Object.assign(TALL, defaults.TALL); Object.assign(TALL.frameWarp, defaults.tallWarp); Object.assign(TABLET, defaults.TABLET); V2_SLIDERS.forEach(([o], i) => Object.assign(o, defaults.v2[i])); Object.assign(WORK_UI.copy, defaults.copy);
    store.clear();
    groups.reset();
    readouts.forEach((r) => { r.input.value = r.obj[r.key]; r.v.textContent = r.obj[r.key]; });
    relayout();
    copyRows.forEach((r) => { r.inp.value = r.def; });
    refreshMarks();
    msg.textContent = 'Reset to the defaults in timeline.js';
  });
  content.append(row, msg);
  // R33h: a control that differs from its default gets a dot before its label, and the header counts them ("N changed") with a reset next to it.
  const changedCount = document.createElement('span'); changedCount.style.cssText = 'opacity:.85;font-size:11px;white-space:nowrap';
  const headReset = document.createElement('button'); headReset.textContent = 'reset'; headReset.style.cssText = 'all:unset;cursor:pointer;text-decoration:underline;font-size:11px;opacity:.85;margin-left:6px';
  const tagMark = (el, on) => { if (!el) return; const t = el.getAttribute('data-orig') ?? el.textContent; if (!el.hasAttribute('data-orig')) el.setAttribute('data-orig', t); el.textContent = on ? `● ${t}` : t; el.style.color = on ? '#ffb347' : ''; };
  const refreshMarks = () => {
    let n = 0;
    readouts.forEach((r) => { const ch = String(r.obj[r.key]) !== String(r.def); if (ch) n++; tagMark(r.label, ch); });
    copyRows.forEach((r) => { const ch = WORK_UI.copy[r.k] !== r.def; if (ch) n++; tagMark(r.label, ch); });
    changedCount.textContent = n ? `${n} changed` : '';
    headReset.style.display = n ? '' : 'none';
    return n;
  };
  const headRight = document.createElement('span'); headRight.style.cssText = 'display:flex;align-items:center;gap:6px';
  headRight.append(changedCount, headReset); head.insertBefore(headRight, collapseBtn);
  headReset.addEventListener('click', () => resetBtn.click());
  box.addEventListener('input', () => setTimeout(refreshMarks, 0)); box.addEventListener('change', () => setTimeout(refreshMarks, 0));
  // dev hook for the round-trip test: window.__tune.apply(json) puts a pasted export back into the live objects
  window.__tune = { full: fullJson, changed: changedJson, count: refreshMarks, apply: (json) => { applyDeep(EXPORT, typeof json === 'string' ? JSON.parse(json) : json); readouts.forEach((r) => { r.input.value = r.obj[r.key]; r.v.textContent = r.obj[r.key]; }); copyRows.forEach((r) => { r.inp.value = WORK_UI.copy[r.k]; }); relayout(); refreshMarks(); } };
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
  refreshMarks();
}
