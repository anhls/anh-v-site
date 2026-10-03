import './styles/base.css';
import './styles/work.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import data from './data/data.json';
import pool from './data/work-pool.json';
import { WORK, BEND, WARP, CARDS, CARD_HOVER, DEPTH, SCROLL, INDEX } from './timeline.js';
import { frameZ } from './data/depth.js';
import { capW, dist } from './scale.js';
import { initNav } from './effects/nav.js';
import { createCardsGL } from './effects/cards-gl.js';
import { imgAttrs } from './util/media.js';
import { installScrollGain } from './util/scroll-gain.js';
import { applyFocus } from './work/focus.js';
import { pushTarget, stepPushSpring } from './effects/card-push.js';
import { withOvershoot, settleBump, settleCurve } from './util/overshoot.js';
import { workEase, blendSoft, moveForce, forceOf } from './util/ease.js';
import { ambUnits, ambParams, ambDepthW, ambProgress, ambCardOffset, ambImageOffset, leadUnits, leadParams, leadOffset } from './work/ambient.js';
import { buildProjectCards, placeCards, balanceDark, workMetrics, fixWorkLayout } from './work/cards.js';

// Work page (R23, R23b). A strip of the projects' main images, endless, driven by Lenis (infinite mode: the page itself never moves, its
// scroll value is only read). Every project's image owns its cards along its two edges (src/work/cards.js). Everything is drawn by the
// homepage card renderer (src/effects/cards-gl.js: one WebGL2 canvas, the cylinder warp that follows the scroll speed and eases back
// flat at rest, grain, the dark rest layer, hover zoom); at rest the strip is flat and normal. The DOM <a><img> items stay in the page
// (click target, hover, accessibility, fallback) and are hidden while the canvas draws. Two modes: side (strip horizontal) and vertical
// (a column, the same rules turned 90 degrees); the toggle morphs every image and card from its place in one layout to its place in the
// other. Per frame: transform writes on cached numbers, no layout reads. Fallbacks (?gl=0, reduced motion, weak device, no WebGL2):
// flat DOM images, no warp, a quick fade for the toggle.
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const projects = data.projects;
const slugs = projects.map((p) => p.slug);
const N = projects.length;
const heroRef = (p) => p.page.blocks.find((b) => b.t === 'hero').img;
const store = { get: () => { try { return localStorage.getItem('work-mode'); } catch { return null; } }, set: (v) => { try { localStorage.setItem('work-mode', v); } catch { /* private window */ } } };
let vertical = store.get() === 'vertical';

const lenis = new Lenis({ infinite: true, gestureOrientation: 'both', lerp: 0.07, wheelMultiplier: 1 });
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
installScrollGain(lenis);

// ---- DOM
const nav = document.createElement('nav');
nav.className = 'nav';
nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
  .map(([n, h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
document.body.prepend(nav);
const app = document.getElementById('app');
app.innerHTML = `
  <div class="work__spacer"></div>
  <div class="work" id="work">
    <div class="work__stage"></div>
  </div>
  <div class="work__name" aria-hidden="true">${projects.map((p) => `<span class="work__title">${[...p.title].map((c) => `<span class="work__char">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`).join('')}</div>
  <div class="work__count" aria-live="polite">01 / 0${N}</div>
  <button type="button" class="work__toggle" aria-label="Switch to vertical scroll">
    <svg viewBox="0 0 24 24" aria-hidden="true"><g class="work__icon"><rect x="3.5" y="5" width="3" height="14"/><rect x="10.5" y="5" width="3" height="14"/><rect x="17.5" y="5" width="3" height="14"/></g></svg>
  </button>`;
const root = app.querySelector('.work');
const stage = root.querySelector('.work__stage');
// R23e: the counter and the toggle are children of the page, not of .work: their own top layer above the canvas and every click anchor
const countEl = app.querySelector('.work__count');
const toggleEl = app.querySelector('.work__toggle');
const nameEl = app.querySelector('.work__name');
const titleEls = [...nameEl.querySelectorAll('.work__title')].map((el) => ({ el, chars: [...el.querySelectorAll('.work__char')], f: -1 }));
const iconEl = toggleEl.querySelector('.work__icon');

// ---- items: the N frames first, then every project's cards (the same objects in both layouts)
const projCards = buildProjectCards(pool, slugs);
// R22e: the overlap rules (no triple overlap, dark-on-dark and pair caps) are enforced before the items exist: a card may be dropped
fixWorkLayout(projCards, workMetrics(innerWidth, innerHeight, capW() / 1920));
const items = [];
projects.forEach((p, i) => items.push({ kind: 'frame', proj: i, slug: p.slug, z: frameZ(), mouse: 20 + 80 * DEPTH.slot, dark: false, ref: heroRef(p) }));
projCards.forEach((list, i) => list.forEach((c, j) => items.push({ kind: 'card', proj: i, j, slug: c.slug, z: c.z, mouse: c.mouse, dark: c.dark, src: c.src, card: c })));
const n = items.length;
items.forEach((it, i) => {
  const a = document.createElement('a');
  a.className = `work__item work__${it.kind}`;
  a.href = `/work/${it.slug}.html`;
  a.style.zIndex = String(it.z); // the same order as the canvas (R23d): the image sits in the middle of the card depths
  if (it.kind === 'frame') a.setAttribute('aria-label', projects[it.proj].title);
  // the picture is only requested once the item is near the screen (activate()): the canvas then uploads exactly that file
  a.innerHTML = `<img ${imgAttrs(it.kind === 'frame' ? it.ref : it.src, it.kind === 'frame' ? `${WORK.frameW}vw` : '300px', true)} alt="" decoding="async" draggable="false">`;
  stage.append(a);
  it.el = a;
  it.img = a.firstChild;
  it.idx = i;
});

// ---- cached numbers
const bx = new Float64Array(n), by = new Float64Array(n), bw = new Float64Array(n), bh = new Float64Array(n);
let W = innerWidth, H = innerHeight, scale = 1;
const LAY = { side: null, vertical: null }; // { M, pitch, period, pos[] (per item: along (from project 0's frame centre), cross) }
const vis = new Uint8Array(n); // item shown (DOM visibility)
const px = new Float64Array(n), py = new Float64Array(n); // base centres of this frame (before the focus, the drift and the hover)
const shownA = new Uint8Array(n);
const fsArr = new Float64Array(N).fill(1); // the focus' image scale per project
const FA = { n, N, kind: Uint8Array.from(items, (it) => (it.kind === 'frame' ? 0 : 1)), proj: Int8Array.from(items, (it) => it.proj), mouse: Float64Array.from(items, (it) => it.mouse), X: px, Y: py, W: bw, H: bh, vertical: false, pitch: 1, scale: 1 };
const nearArr = new Uint8Array(n); // item within 0.8 of a view length of the centre along the strip: its picture is requested at once; the rest follow when idle (below)
const activate = (it) => { if (it.active) return; it.active = true; const d = it.img.dataset; if (d.srcset) it.img.srcset = d.srcset; it.img.src = d.src; };
let gl = null; // the card canvas (created below)
let fine = false;
let laidOnce = false;
const layouts = () => {
  W = innerWidth; H = innerHeight; scale = capW() / 1920;
  const fw = (WORK.frameW * W) / 100, fh = (WORK.frameH * H) / 100;
  if (laidOnce) fixWorkLayout(projCards, workMetrics(W, H, scale), { structural: false }); // a resize: nudges only (the card set stays)
  laidOnce = true;
  const placedAll = {};
  for (const mode of ['side', 'vertical']) {
    const v = mode === 'vertical';
    const M = { vertical: v, alongF: v ? fh : fw, crossF: v ? fw : fh, scale, gap: v ? (WORK.gapVert * H) / 100 : (WORK.gapSide * W) / 100, gapPx: (WORK.dupGap * (v ? H : W)) / 100, viewAlong: v ? H : W, viewCross: v ? W : H };
    const pitch = M.alongF + M.gap;
    const placed = placeCards(projCards, M);
    placedAll[mode] = placed;
    const pos = items.map((it) => {
      if (it.kind === 'frame') return { along: it.proj * pitch, cross: 0, alongSize: M.alongF, crossSize: M.crossF };
      const p = placed[it.proj][it.j];
      return { along: it.proj * pitch + p.along, cross: p.cross, alongSize: p.alongSize, crossSize: p.crossSize };
    });
    LAY[mode] = { M, pitch, period: N * pitch, pos };
  }
  balanceDark(projCards, [placedAll.side, placedAll.vertical]); // dark runs <= 2 along the strip in both modes
  items.forEach((it, i) => {
    if (it.kind === 'card') { it.dark = it.card.dark; if (gl) { gl.darkCard[i] = it.dark; gl.hd[i] = it.dark && fine ? CARD_HOVER.darkRest : 0; } }
    const w = it.kind === 'frame' ? fw : it.card.w * scale;
    const h = it.kind === 'frame' ? fh : it.card.h * scale;
    bw[i] = w; bh[i] = h;
    it.el.style.width = `${w}px`; it.el.style.height = `${h}px`;
  });
};
layouts();
const cur = () => LAY[vertical ? 'vertical' : 'side'];

// ---- WebGL (the homepage card renderer, with the Work page's own warp numbers)
// R22h: two warps with their own settings: WORK.cardWarp (the cards) and WORK.frameWarp (the main images, own shader). Both are read live.
const bendP = { ...BEND };
const warpP = { ...WARP };
const bendImg = { riseSpeed: 1, settleSpeed: 1 };
const warpImg = { ...WARP };
const copyWarp = (dst, src) => {
  dst.strengthUp = dst.strengthDown = src.strength;
  dst.curl = src.curl; dst.camDown = src.camDown; dst.camUp = src.camUp; dst.bowDown = src.bowDown; dst.bowUp = src.bowUp; dst.reach = src.reach; dst.sym = src.sym;
};
const syncWarp = () => {
  copyWarp(warpP, WORK.cardWarp);
  bendP.riseSpeed = 7 / Math.max(WORK.cardWarp.riseSec, 0.02);
  bendP.settleSpeed = 7 / Math.max(WORK.cardWarp.settleSec, 0.02);
  copyWarp(warpImg, WORK.frameWarp);
  bendImg.riseSpeed = 7 / Math.max(WORK.frameWarp.riseSec, 0.02);
  bendImg.settleSpeed = 7 / Math.max(WORK.frameWarp.settleSec, 0.02);
};
syncWarp();
fine = matchMedia('(pointer: fine)').matches && !reduced;
let glOn = false;
{
  const fallback = () => { glOn = false; root.classList.remove('work--gl'); gl?.destroy?.(); gl = null; };
  gl = createCardsGL({ section: root, els: items.map((it) => it.img), cards: items, bx, by, bw, bh, onLost: fallback, bend: bendP, warp: warpP, near: (i) => items[i].active === true, layers: { isFrame: Uint8Array.from(items, (it) => (it.kind === 'frame' ? 1 : 0)), warp: warpImg, bend: bendImg } });
  if (gl) {
    glOn = true;
    root.classList.add('work--gl');
    gl.resize(W, H);
    gl.setAxis(vertical ? 0 : 1);
    gl.show(true);
    items.forEach((it, i) => { gl.hd[i] = it.dark && fine ? CARD_HOVER.darkRest : 0; });
  }
}

// ---- pointer: parallax (the homepage mouse drift), hover (zoom, the dark layer fades), click opens the project page (the anchors)
const mouse = { tx: 0, ty: 0, x: 0, y: 0, px: -1e5, py: -1e5, known: false }; // px, py: the raw pointer (the push), tx, ty: normalised (the drift)
if (fine) {
  addEventListener('pointermove', (e) => { mouse.tx = (e.clientX - W / 2) / (W / 2); mouse.ty = (e.clientY - H / 2) / (H / 2); mouse.px = e.clientX; mouse.py = e.clientY; mouse.known = true; }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.px = -1e5; mouse.py = -1e5; }); // the pointer left the window: nothing is pushed
}
// R22e: the homepage pointer push + hover push (card-push.js, shared with sections/selected-work.js), with the same CARDS / CARD_HOVER values
const qx = new Float64Array(n), qy = new Float64Array(n), vqx = new Float64Array(n), vqy = new Float64Array(n);
const Q = { x: qx, y: qy }, V = { x: vqx, y: vqy };
const pOut = { x: 0, y: 0 };
const psrcs = new Int32Array(n);
const PS = { pointerOn: false, px: 0, py: 0, pw: 1, R: 0, pushMax: 0, falloff: 1, hsPush: 0, hRad: 0, hoverScale: 1, nSrc: 0, srcs: psrcs, srcX: new Float64Array(n), srcY: new Float64Array(n), bw, bh, hp: null };
let hov = -1;
// ---- R22h: ambient drift (work/ambient.js). av[i] = progress 0..1 of item i's offset; al / cr = its offset along / across the strip (px)
const AMB = { on: false, t0: 0, tOff: 0, a0: new Float64Array(n), r0: new Float64Array(n), av: new Float64Array(n), al: new Float64Array(n), cr: new Float64Array(n), units: items.map((it) => (it.kind === 'card' ? ambUnits(it.card, it.proj) : null)), moving: false };
const stepAmb = (now) => {
  let fmax = 0;
  for (let q = 0; q < N; q++) if (fP[q] > fmax) fmax = fP[q];
  const on = glOn && !reduced && !morph && !snap && !drag && !inertia && !focusOff(now) && now - lastWheel > WORK.ambDelay * 1000 && fmax >= 0.98;
  if (on && !AMB.on) { AMB.on = true; AMB.t0 = now; AMB.a0.set(AMB.av); } // start (or resume from the current offsets: no pop)
  else if (!on && AMB.on) { AMB.on = false; AMB.tOff = now; AMB.r0.set(AMB.av); }
  let moving = false, any = false;
  const ret = Math.max(WORK.ambReturnSec, 0.05), ease = workEase(WORK), tSec = now / 1000;
  const sc = scale;
  for (let i = 0; i < n; i++) {
    const u = AMB.units[i];
    const prm = u ? ambParams(u) : null;
    let av = AMB.av[i];
    if (AMB.on) {
      const a0 = AMB.a0[i], tau = prm ? prm.tau : WORK.ambTau, del = prm ? prm.delay * (1 - a0) : 0;
      av = a0 + (1 - a0) * ambProgress((now - AMB.t0) / 1000, tau, del);
      if (av > 0.999) av = 1; else moving = true;
    } else if (av > 0) {
      const t = (now - AMB.tOff) / 1000 / ret;
      av = t >= 1 ? 0 : AMB.r0[i] * (1 - ease(t));
      if (av > 0) moving = true;
    }
    AMB.av[i] = av;
    if (av > 0) {
      any = true;
      if (u) { ambCardOffset(ambOut, prm, ambDepthW(items[i].mouse), av, tSec, sc); AMB.al[i] = ambOut.along; AMB.cr[i] = ambOut.cross; if (WORK.ambSway > 0 && AMB.on) moving = true; }
      else { AMB.al[i] = ambImageOffset(av, sc); AMB.cr[i] = 0; }
    } else { AMB.al[i] = 0; AMB.cr[i] = 0; }
  }
  AMB.moving = moving;
  return moving;
};
const ambOut = { along: 0, cross: 0 };
// ---- R22i: the speed lead: per card an offset along the strip (px) on its own spring; target = leadOffset(strip speed), 0 while the snap / morph run
const LEAD = { x: new Float64Array(n), v: new Float64Array(n), units: items.map((it) => (it.kind === 'card' ? leadUnits(it.card, it.proj) : null)), moving: false };
const stepLead = (dt, vel, active) => {
  let moving = false;
  const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
  for (let i = 0; i < n; i++) {
    const u = LEAD.units[i];
    if (!u) continue;
    const prm = leadParams(u, ambDepthW(items[i].mouse));
    const tgt = active ? leadOffset(prm.lead, vel, scale) : 0;
    const k = prm.stiff, c = WORK.leadDamping * Math.sqrt(k / WORK.leadStiffness);
    let x = LEAD.x[i], v = LEAD.v[i];
    if (x === 0 && v === 0 && tgt === 0) continue;
    for (let q = 0; q < steps; q++) { v += (k * (tgt - x) - c * v) * h; x += v * h; }
    if (tgt === 0 && Math.abs(x) < 0.02 && Math.abs(v) < 0.1) { x = 0; v = 0; } else moving = true;
    LEAD.x[i] = x; LEAD.v[i] = v;
  }
  LEAD.moving = moving;
  return moving;
};
const NUD = { x: new Float64Array(n), y: new Float64Array(n), dt: 0, tau: 0.09, live: false }; // R22g: the focus nudge, smoothed in time (work/focus.js)
let driftW = 1; // weight of the mouse drift (1 at rest, 0 during the toggle morph)
const hp = new Float64Array(n), hv = new Float64Array(n); // hover progress (critically damped spring, as the homepage cards)
PS.hp = hp;
if (fine) items.forEach((it, i) => { if (it.kind !== 'card') return; it.el.addEventListener('pointerenter', () => { hov = i; }); it.el.addEventListener('pointerleave', () => { if (hov === i) hov = -1; }); });

// ---- strip maths
// R23c: Lenis' infinite mode re-bases its scroll value by its `limit` now and then (after a pause in the wheel, when the real page
// scroll position wraps), which made S, and with it the counter and the whole strip, jump back. So the strip never reads the raw value: it
// accumulates the CHANGE of it (a change of about a whole `limit` is the re-base, not movement) into `virt`, which only ever follows the wheel.
let virt = 0, rawPrev = lenis.animatedScroll;
const advance = () => {
  const raw = lenis.animatedScroll;
  let d = raw - rawPrev;
  rawPrev = raw;
  const lim = lenis.limit;
  if (lim > 0 && Math.abs(d) > lim / 2) d -= Math.round(d / lim) * lim;
  virt += d;
};
let off = 0; // strip position S = virt * wheel + off (changes on a mode switch / resize so the same project stays centred)
let S = 0, prevS = 0, prevVirt = 0;
const wrap = (v, P) => ((((v + P / 2) % P) + P) % P) - P / 2;
const out = { x: 0, y: 0, d: 0 };
// centre of item i (screen px) in layout L with the strip at s (into `out`); returns false when it is far off screen
const place = (i, L, s) => {
  const p = L.pos[i];
  const M = L.M;
  const a = M.viewAlong / 2 + wrap(p.along - s, L.period);
  const c = M.viewCross / 2 + p.cross;
  out.x = M.vertical ? c : a;
  out.y = M.vertical ? a : c;
  out.d = Math.abs(a - M.viewAlong / 2) - p.alongSize / 2; // distance of the item's nearest edge from the view centre
  return out.d < M.viewAlong / 2 + 40;
};

// R23d: the morph starts slow and speeds up (ease-in, power WORK.morphEase), then a short soft landing (WORK.morphLanding of the time, constant
// deceleration) so it settles instead of stopping dead. The landing continues the ease-in's speed, so the curve has no kink.
const ease = (u) => {
  const p = Math.max(WORK.morphEase, 1), L = Math.min(Math.max(WORK.morphLanding, 0.01), 0.5), T = 1 - L;
  const C = 1 / (1 + (p * L) / (2 * T));
  if (u <= T) return C * (u / T) ** p;
  const v = (C * p) / T, s = u - T;
  return C + v * s - (v * s * s) / (2 * L);
};
// R22f: the morph's base curve: the chosen easeType (+ softness) for sine / quad / cubic; 'circ' keeps the power curve above (morphEase). Stable
// function per setting (the overshoot helper caches by identity).
let morphBase = null, morphBaseKey = '';
const morphCurve = () => {
  const key = `${WORK.easeType}|${WORK.easeSoftness}|${WORK.morphEase}|${WORK.morphLanding}`;
  if (key !== morphBaseKey) { morphBaseKey = key; morphBase = WORK.easeType === 'circ' ? blendSoft(ease, WORK.easeSoftness) : workEase(WORK); }
  return morphBase;
};
// R22e: + the overshoot over the landing window (morphLanding is now the settle time): passes 1 by morphOvershoot once, ends exactly on 1
// R22g: the overshoot amount = morphOvershoot x the item's own force (its travel distance and the morph time); forces are rounded to 1/16 so the
// curves are shared. Images AND cards use it (R22h: settleCurve, the overshoot comes from the speed the item still has, no second push).
const qForce = (f) => Math.round(f * 16) / 16;
const morphFn = (force) => settleCurve(morphCurve(), WORK.morphOvershoot * qForce(force));
const easeO = (u) => morphFn(1)(u); // the toggle icon
let morph = null; // { from, to, SA, SB, t0, delay[] }
let iconAngle = NaN;
const setAngle = (a) => { if (a !== iconAngle) { iconAngle = a; iconEl.style.setProperty('--a', `${a.toFixed(2)}deg`); } };
let lastIdx = -1;
let kCount = 0; // the counter's project index (unwrapped)
let lastDirty = 0;

// ---- R23e: soft snap to the centre + the focus effect of the centred project
// Snap: once the wheel has been quiet for WORK.snapDelay and Lenis has finished gliding, the nearest project, if it lies within
// WORK.snapWindow of a pitch from the centre, is drifted to the centre over WORK.snapSec along easeInOutCirc. It moves `off` only (Lenis is
// never touched): any new wheel / key / touch input cancels it at once and the strip carries on from where it is (0 px jump).
// Focus: ONE progress value per project (fP[p], 0..1) = easeInOutCirc of how far that project is centred (1 - distance / window); it
// scales the image (focusScale), pushes the project's cards outward (focusPush, plus the same growth as the image), moves the two
// neighbouring projects away along the strip (focusNeighbour of a pitch) and rises the project's name (the homepage index title style).
// It follows the position, so it builds while the drift centres the project and unwinds the same way when the user scrolls on; a rate
// limit (WORK.focusRampSec for the whole range) only guards against pops (toggle, resize). Held off during the toggle morph. WebGL path
// and no reduced motion only (the DOM fallback has neither the snap nor the focus).
const relIdx = (d) => { const h = Math.floor(N / 2); return ((((d + h) % N) + N) % N) - h; };
const fP = new Float64Array(N);
const fSc = settleBump(N), fPu = settleBump(N); // what is DRAWN: fP, plus each animation's own overshoot when a build completes (the name has none)
let snap = null; // { from, to, t0 }
let lastWheel = performance.now();
let wmScrolled = reduced; // R23f: the wordmark plays big -> small once; true from the first real scroll for the rest of the visit (reduced motion: from the start)
let snapForce = 0; // force of the last soft snap (the focus bump that follows it uses it); 0 once any input cancels it
// R22i: after a toggle the focus (and the ambient drift) stay off: WORK.focusAfterMorph 'input' = until the next input once the morph is over, a number =
// that many seconds after the morph (and its settle) ends, 0 = as before. While held the focus unwinds over 0.35 s (a pop guard) and does not rebuild.
let focusHeld = false, focusHoldUntil = 0;
const holdFocus = () => { focusHeld = WORK.focusAfterMorph !== 0; focusHoldUntil = 0; };
const focusOff = (now) => focusHeld && (!!morph || (typeof WORK.focusAfterMorph === 'number' ? now < focusHoldUntil : true));
const inputRelease = () => { if (focusHeld && !morph && WORK.focusAfterMorph === 'input') focusHeld = false; };
const cancelSnap = () => { snap = null; snapForce = 0; lastWheel = performance.now(); wmScrolled = true; inputRelease(); };
// ---- R22e: hold and drag (desktop mouse). The strip follows the pointer 1:1 (the scroll gain does not apply) along the mode's axis; on release
// it keeps the pointer's speed and loses it by friction (R22i: speed x exp(-t / WORK.dragFriction), distance = speed x friction time, capped at
// WORK.dragMaxCoast pitches; no overshoot; it ends when the speed is under 5 px/s)
// and then the soft snap takes over as usual. A drag past 6 px swallows the click that would open a project; a plain click still works.
// Everything moves `off` only: Lenis (R23c re-base handling, gain) and the counter are untouched. Wheel / key / touch / a new grab cancel it.
let drag = null; // { id, last, total, captured, samples: [[t, pos]] }
let inertia = null; // { from, v0, F, t0 }
let dragMoved = false;
let dragAccum = 0; // S change made by the drag / inertia since the last frame (px): the warp follows it like a wheel scroll
const axisOf = (e) => (vertical ? e.clientY : e.clientX);
const endDrag = () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  root.classList.remove('is-dragging');
  try { if (d.captured) document.documentElement.releasePointerCapture(d.id); } catch { /* already released */ }
  if (!d.total || d.total <= 6) return;
  // the pointer's speed over the last 90 ms, as strip speed (the strip moves against the pointer's coordinate)
  const now = performance.now();
  const s = d.samples.filter((q) => now - q[0] < 90);
  if (s.length >= 2) {
    const v = -((s[s.length - 1][1] - s[0][1]) / Math.max((s[s.length - 1][0] - s[0][0]) / 1000, 0.008));
    if (Math.abs(v) > 30) { const F = Math.min(Math.max(WORK.dragFriction, 0.05), (WORK.dragMaxCoast * cur().pitch) / Math.abs(v)); inertia = { from: S, v0: v, F, t0: now }; } // the release speed is the last drag speed (no step); a hard fling gets a shorter friction time so the distance stays capped
  }
};
addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || morph || fading) return;
  if (e.target.closest?.('.work__toggle, .work__count, [data-tune-panel]') || e.target.closest?.('div[style*="99999"]')) return;
  dragMoved = false;
  drag = { id: e.pointerId, last: axisOf(e), total: 0, captured: false, samples: [[performance.now(), axisOf(e)]] };
  inertia = null; snap = null; snapForce = 0; lastWheel = performance.now(); wmScrolled = true; inputRelease();
  e.preventDefault(); // no text selection, no image drag
}, { capture: true });
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.buttons === 0) { endDrag(); return; } // released outside the window (or the up event was lost): never stuck
  const pos = axisOf(e), dpos = pos - drag.last;
  drag.last = pos;
  drag.total += Math.abs(dpos);
  if (drag.total > 6) {
    dragMoved = true;
    root.classList.add('is-dragging');
    if (!drag.captured) { try { document.documentElement.setPointerCapture(drag.id); drag.captured = true; } catch { /* not capturable */ } } // from here the move / up come even outside the window
  }
  off -= dpos; // 1:1: the content follows the pointer
  dragAccum -= dpos;
  drag.samples.push([performance.now(), pos]);
  if (drag.samples.length > 12) drag.samples.shift();
}, { capture: true, passive: true });
for (const type of ['pointerup', 'pointercancel']) addEventListener(type, (e) => { if (drag && e.pointerId === drag.id) endDrag(); }, { capture: true });
addEventListener('blur', endDrag);
document.documentElement.addEventListener('lostpointercapture', (e) => { if (drag && e.pointerId === drag.id) endDrag(); }); // R22h: a drag can never stay 'held' after the browser took the pointer back
document.addEventListener('visibilitychange', () => { if (document.hidden) endDrag(); });
addEventListener('click', (e) => { if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; } }, { capture: true });
addEventListener('wheel', () => { inertia = null; }, { capture: true, passive: true });
addEventListener('wheel', cancelSnap, { capture: true, passive: true });
addEventListener('touchstart', cancelSnap, { capture: true, passive: true });
addEventListener('keydown', cancelSnap, { capture: true });
const navTravel = () => dist(INDEX.travelVh); // how far a title rises (px), like the homepage index rows (a capped distance)
const updateNames = () => {
  const travel = navTravel();
  const stag = 0.7;
  titleEls.forEach((t, p) => {
    const f = fP[p];
    if (Math.abs(f - t.f) < 0.0004) return;
    t.f = f;
    t.el.style.visibility = f > 0.001 ? 'visible' : 'hidden';
    const nC = Math.max(t.chars.length - 1, 1);
    t.chars.forEach((c, i) => { const cp = Math.max(0, f * (1 + stag) - (stag * i) / nC); const e = cp >= 1 ? 1 : cp * cp * (3 - 2 * cp); c.style.transform = `translate3d(0,${((1 - e) * travel).toFixed(2)}px,0)`; });
  });
};

const tick = (_time, deltaMs) => {
  const dt = Math.min(deltaMs, 50) / 1000;
  const now = performance.now();
  advance();
  if (!wmScrolled && Math.abs(virt) > 5) wmScrolled = true;
  S = virt * WORK.wheel + off;
  // the warp follows the wheel / Lenis motion only (not the snap drift, not offsets from a toggle or a resize)
  let vel = ((virt - prevVirt) * WORK.wheel) / Math.max(dt, 1e-3);
  prevVirt = virt;
  if (Math.abs(vel) > 20000 || morph) vel = 0;
  // drag / inertia: the soft snap and the focus stay out of the way while the strip is held or coasting
  if (drag) { lastWheel = now; snap = null; }
  if (inertia && !morph) {
    const t = (now - inertia.t0) / 1000, e = Math.exp(-t / inertia.F), spd = inertia.v0 * e;
    const target = inertia.from + inertia.v0 * inertia.F * (1 - e);
    const before = S;
    off += target - S; S = target;
    dragAccum += S - before;
    lastWheel = now; snap = null;
    if (Math.abs(spd) < 5) inertia = null;
    else if (WORK.dragSnapBlend > 0 && Math.abs(spd) < WORK.dragSnapBlend && glOn && !reduced) {
      // R22i option: the snap takes over while the coast is still slowing (magnetised to the project the coast is heading for)
      const pt = cur().pitch, k = Math.round((S + spd * inertia.F) / pt);
      if (Math.abs(k * pt - S) > 0.5) { snapForce = 0; snap = { from: S, to: k * pt, t0: now, force: 0 }; }
      inertia = null;
    }
  } else if (inertia) inertia = null;
  if (dragAccum) { vel += dragAccum / Math.max(dt, 1e-3); dragAccum = 0; }
  const snapOk = glOn && !reduced && !morph;
  if (snapOk) {
    if (snap) {
      const t = Math.min(1, (now - snap.t0) / 1000 / Math.max(WORK.snapSec, 0.05));
      const target = snap.from + (snap.to - snap.from) * withOvershoot(workEase(WORK), WORK.snapOvershoot * qForce(snap.force), WORK.overshootSettle)(t);
      off += target - S; S = target;
      if (t >= 1) snap = null;
    } else if (now - lastWheel > WORK.snapDelay * 1000 && (Math.abs(vel) < 250 || now - lastWheel > WORK.snapDelay * 1000 + 600)) {
      // R22h: the snap must always take over. A speed above 250 px/s can no longer hold it off for more than 0.6 s after the quiet time, and a stale
      // Lenis glide is not trusted that long either (see `late`)
      // the wheel has been quiet and Lenis' glide is nearly over: where the glide will end (S + what is left of it) picks the project
      const pt = cur().pitch, late = now - lastWheel > WORK.snapDelay * 1000 + 600, pred = late ? S : S + (lenis.targetScroll - lenis.animatedScroll) * WORK.wheel, k = Math.round(pred / pt), d = k * pt - pred;
      if (Math.abs(d) <= WORK.snapWindow * pt && Math.abs(k * pt - S) > 0.5) { snapForce = moveForce(k * pt - S, scale, workEase(WORK), WORK.snapSec, WORK); snap = { from: S, to: k * pt, t0: now, force: snapForce }; }
    }
  } else snap = null;
  prevS = S;
  // focus progress per project
  let focusMoving = false;
  {
    const pt = cur().pitch, k = Math.round(S / pt), win = Math.max(WORK.snapWindow, 0.05);
    const c = Math.max(0, 1 - Math.abs(S - k * pt) / (win * pt)), pk = ((k % N) + N) % N;
    // R23f: the focus builds only at rest: while the soft snap drifts the project in, or once the wheel has been quiet for snapDelay and the
    // glide is over. Any wheel / key / touch input (cancelSnap) closes the gate at once and the focus unwinds over the ramp.
    const restOk = !!snap || (now - lastWheel > WORK.snapDelay * 1000 && Math.abs(vel) < 250);
    const hold = focusOff(now);
    const rate = dt / Math.max(hold ? 0.35 : WORK.focusRampSec, 0.02);
    for (let q = 0; q < N; q++) {
      const tgt = snapOk && restOk && !hold && q === pk ? workEase(WORK)(c) : 0;
      const nv = fP[q] + Math.max(-rate, Math.min(rate, tgt - fP[q]));
      if (nv !== fP[q]) { fP[q] = nv; focusMoving = true; }
    }
    // R22e: the drawn values follow fP with their own overshoot (0 = identical to fP)
    if (fSc.step(fP, now, WORK.focusOvershootScale, WORK.followerSettleSec, qForce(snapForce))) focusMoving = true;
    if (fPu.step(fP, now, WORK.focusOvershootPush, WORK.followerSettleSec, qForce(snapForce))) focusMoving = true;
    updateNames();
  }
  syncWarp();

  // mouse spring + hover springs
  const km = 1 - Math.exp(-dt * 9);
  mouse.x += (mouse.tx - mouse.x) * km;
  mouse.y += (mouse.ty - mouse.y) * km;
  let hoverMoving = false;
  if (fine) {
    const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
    for (let i = 0; i < n; i++) {
      const goal = i === hov ? 1 : 0;
      if (hp[i] === goal && hv[i] === 0) continue;
      for (let q = 0; q < steps; q++) { hv[i] += (CARD_HOVER.stiffness * (goal - hp[i]) - CARD_HOVER.damping * hv[i]) * h; hp[i] += hv[i] * h; }
      if (hp[i] < 0) { hp[i] = 0; hv[i] = 0; } else if (hp[i] > 1) { hp[i] = 1; hv[i] = 0; }
      if (Math.abs(goal - hp[i]) < 0.0005 && Math.abs(hv[i]) < 0.002) { hp[i] = goal; hv[i] = 0; } else hoverMoving = true;
    }
  }

  // the hovered cards are push sources (their hover progress), the pointer a source too (it gives way to a hovered card)
  let nSrc = 0, maxP = 0;
  for (let i = N; i < n; i++) if (hp[i] > 0.002) { psrcs[nSrc++] = i; if (hp[i] > maxP) maxP = hp[i]; }
  const pSteps = Math.max(1, Math.ceil(dt / 0.004)), ph = dt / pSteps;
  PS.pointerOn = fine && mouse.known && CARDS.pushStrength > 0 && !morph;
  PS.px = mouse.px; PS.py = mouse.py; PS.pw = 1 - maxP; PS.R = CARDS.pushRadius * scale; PS.pushMax = CARDS.pushStrength * scale; PS.falloff = CARDS.pushFalloff;
  PS.hsPush = morph ? 0 : CARD_HOVER.pushStrength * scale; PS.hRad = CARD_HOVER.pushRadius * scale; PS.hoverScale = CARD_HOVER.scale; PS.nSrc = nSrc;
  const wDen = 20 + 80 * CARDS.depthRange;
  let pushMoving = false;

  // positions
  const L = cur();
  const LA = morph ? LAY[morph.from] : L;
  const LB = morph ? LAY[morph.to] : L;
  const sA = morph ? morph.SA : S;
  const sB = morph ? morph.SB : S;
  const dur = Math.max(WORK.morphSec - WORK.morphStagger, 0.05);
  let settleMoving = false;
  if (stepAmb(now)) settleMoving = true;
  if (stepLead(dt, vel, glOn && !reduced && !morph && !snap)) settleMoving = true;
  // R22g: the mouse drift fades out / in over 0.6 s around the toggle morph (it used to switch off at the first frame and on at the last: a card
  // jumped by its whole drift when the pointer was off-centre)
  driftW += Math.max(-dt / 0.6, Math.min(dt / 0.6, (morph ? 0 : 1) - driftW));
  if (driftW > 0 && driftW < 1) settleMoving = true;
  let anyF = false;
  for (let q = 0; q < N; q++) if (fSc.x[q] > 0 || fPu.x[q] > 0) anyF = true;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    let x, y, shown;
    if (morph) {
      const u = Math.min(1, Math.max(0, ((now - morph.t0) / 1000 - morph.delay[i]) / dur));
      const e = morph.fn[i](u);
      const a = place(i, LA, sA);
      const ax = out.x, ay = out.y, ad = out.d;
      const b = place(i, LB, sB);
      nearArr[i] = Math.min(ad, out.d) < Math.min(LA.M.viewAlong, LB.M.viewAlong) * 0.8 ? 1 : 0;
      x = ax + (out.x - ax) * e; y = ay + (out.y - ay) * e;
      shown = a || b;
    } else {
      shown = place(i, L, S);
      x = out.x; y = out.y;
      nearArr[i] = out.d < L.M.viewAlong * 0.8 ? 1 : 0;
    }
    px[i] = x; py[i] = y; shownA[i] = shown ? 1 : 0;
    if (nearArr[i] && !it.active) activate(it);
  }
  // R23f: the focus (the centred project grows, every card is pushed away from the focused image, neighbours move off) is applied to the
  // base positions of this frame; fsArr = the image scale per project
  if (focusMoving || anyF || NUD.live) { FA.vertical = L.M.vertical; FA.pitch = L.pitch; FA.scale = scale; NUD.dt = dt; applyFocus(FA, fSc.x, WORK, CARDS, fsArr, fPu.x, NUD); if (NUD.live) settleMoving = true; } else fsArr.fill(1);
  for (let k = 0; k < nSrc; k++) { const sI = psrcs[k]; PS.srcX[sI] = px[sI]; PS.srcY[sI] = py[sI]; }
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const x = px[i], y = py[i], shown = shownA[i] === 1;
    // mouse drift (cards only; the homepage "away from the pointer" drift, scaled by depth); none while the layouts morph
    let dx = 0, dy = 0;
    if (it.kind === 'card' && fine && driftW > 0) {
      const d = (20 + (it.mouse - 20) * CARDS.depthRange) * CARDS.mouseStrength * scale * driftW;
      const keep = 1 - hp[i] * (1 - CARD_HOVER.drift); // the hovered card keeps only a little of the drift (as on the homepage)
      dx = -mouse.x * d * keep; dy = -mouse.y * d * keep;
    }
    if (it.kind === 'card' && fine) {
      // the push: from the card's centre WITHOUT its own push (so it cannot feed back), cancelled during the toggle morph like the drift
      const wt = (20 + (it.mouse - 20) * CARDS.depthRange) / wDen;
      if (!morph && mouse.known) pushTarget(pOut, PS, i, x + dx, y + dy, bw[i], bh[i], wt, 1 - hp[i]); else { pOut.x = 0; pOut.y = 0; }
      if (stepPushSpring(Q, V, i, pOut.x, pOut.y, CARDS.pushStiffness, CARDS.pushDamping, ph, pSteps)) pushMoving = true;
      dx += qx[i]; dy += qy[i];
    }
    if (LEAD.x[i] !== 0) { if (L.M.vertical) dy += LEAD.x[i]; else dx += LEAD.x[i]; }
    if (AMB.al[i] !== 0 || AMB.cr[i] !== 0) { if (L.M.vertical) { dx += AMB.cr[i]; dy += AMB.al[i]; } else { dx += AMB.al[i]; dy += AMB.cr[i]; } }
    const fs = it.kind === 'frame' ? fsArr[it.proj] : 1;
    const sc = (1 + (CARD_HOVER.scale - 1) * hp[i]) * fs;
    bx[i] = x; by[i] = y;
    if (glOn) {
      gl.ox[i] = dx; gl.oy[i] = dy; gl.hs[i] = sc; gl.hp[i] = hp[i];
      if (it.dark && fine) gl.hd[i] = (1 - hp[i]) * CARD_HOVER.darkRest;
    }
    if (shown) {
      if (!vis[i]) { it.el.style.visibility = ''; vis[i] = 1; }
      it.el.style.transform = `translate3d(${(x + dx - bw[i] / 2).toFixed(2)}px,${(y + dy - bh[i] / 2).toFixed(2)}px,0)${glOn ? '' : ` scale(${sc.toFixed(4)})`}`;
    } else if (vis[i]) { it.el.style.visibility = 'hidden'; vis[i] = 0; }
  }

  // the toggle icon turns with the morph (same duration and easing as the images); at rest it shows the current mode
  if (morph) { const e0 = easeO(Math.min(1, Math.max(0, (now - morph.t0) / 1000 / Math.max(WORK.morphSec - WORK.morphStagger, 0.05)))); const a0 = morph.from === 'vertical' ? 90 : 0, a1 = morph.to === 'vertical' ? 90 : 0; setAngle(a0 + (a1 - a0) * e0); } else setAngle(vertical ? 90 : 0);
  // the counter: the unwrapped nearest project, with hysteresis (another project must be clearly nearer before it changes)
  const pitchNow = (morph ? LB : L).pitch;
  const pos = (morph ? sB : S) / pitchNow;
  if (morph || Math.abs(pos - kCount) > 0.58) kCount = Math.round(pos);
  const idx = ((kCount % N) + N) % N;
  if (idx !== lastIdx) { lastIdx = idx; countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`; }

  if (glOn) {
    if (morph) { const b = gl.bend(); b.x = 0; b.v = 0; const c = gl.bendImg(); c.x = 0; c.v = 0; } // both warps are held flat while the layouts morph
    const moving = Math.abs(vel) > 0.5 || hoverMoving || pushMoving || settleMoving || !!morph || focusMoving || !!snap || Math.abs(mouse.tx - mouse.x) > 0.0005 || Math.abs(mouse.ty - mouse.y) > 0.0005;
    if (moving) lastDirty = now;
    if (moving || now - lastDirty < 80) gl.markDirty();
    gl.draw(0, dt, vel, scale);
  }
  if (morph && now - morph.t0 >= WORK.morphSec * 1000) finishMorph();
};
gsap.ticker.add(tick);
// the pictures that are not near yet are requested a moment after load (one at a time, so a scroll never waits for a first upload)
setTimeout(() => items.forEach((it, i) => setTimeout(() => activate(it), i * 15)), 800);

// ---- mode switch
const commit = (mode) => {
  vertical = mode === 'vertical';
  store.set(mode);
  root.dataset.mode = mode;
  toggleEl.setAttribute('aria-label', vertical ? 'Switch to side scroll' : 'Switch to vertical scroll');
  if (glOn) gl.setAxis(vertical ? 0 : 1);
};
function finishMorph() {
  const m = morph;
  morph = null;
  if (typeof WORK.focusAfterMorph === 'number') focusHoldUntil = performance.now() + WORK.focusAfterMorph * 1000;
  commit(m.to);
  advance();
  off = m.SB - virt * WORK.wheel;
  lenis.start();
  prevS = m.SB;
  root.classList.remove('is-morphing');
}
let fading = false;
const setMode = (mode) => {
  if (morph || fading || (mode === 'vertical') === vertical) return;
  snap = null; snapForce = 0; inertia = null; if (drag) endDrag();
  holdFocus();
  const L0 = cur();
  const kProj = Math.round(S / L0.pitch);
  if (glOn) {
    morph = { from: vertical ? 'vertical' : 'side', to: mode, SA: S, SB: kProj * LAY[mode].pitch, t0: performance.now(), delay: items.map((it, i) => (it.kind === 'frame' ? 0 : WORK.morphStagger * (0.35 + 0.65 * (((i * 2654435761) >>> 0) / 4294967296))))};
    // R22g: every item's own force from its travel (screen px, from its place in one layout to its place in the other) and the morph time
    const LA0 = LAY[morph.from], LB0 = LAY[mode], dur0 = Math.max(WORK.morphSec - WORK.morphStagger, 0.05), base = morphCurve();
    morph.force = new Float64Array(n); morph.travel = new Float64Array(n); morph.fn = new Array(n);
    for (let i = 0; i < n; i++) {
      place(i, LA0, morph.SA); const ax = out.x, ay = out.y;
      place(i, LB0, morph.SB);
      const tx = out.x - ax, ty = out.y - ay, tr = Math.hypot(tx, ty);
      morph.travel[i] = tr;
      morph.force[i] = moveForce(tr, scale, base, dur0, WORK);
      morph.fn[i] = morphFn(morph.force[i]);
    }
    lenis.stop(); // wheel and drag are ignored while the move plays
    root.classList.add('is-morphing');
  } else {
    fading = true;
    stage.classList.add('is-switching');
    setTimeout(() => {
      commit(mode);
      off += kProj * LAY[mode].pitch - S;
      kCount = kProj;
      stage.classList.remove('is-switching');
      fading = false;
    }, 200);
  }
};
toggleEl.addEventListener('click', () => setMode(vertical ? 'side' : 'vertical'));

let rt = 0;
const relayout = () => {
  snap = null;
  const f = S / cur().pitch;
  layouts();
  off += f * cur().pitch - S;
  if (glOn) gl.resize(W, H);
};
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(relayout, 120); });

commit(vertical ? 'vertical' : 'side');
// the endless strip passes through 0 at every wrap, so the distance must not drive the wordmark: it reports "scrolled" once and never rest again
initNav(data.hero.wordmark, lenis, { gateFrame: false, position: () => (wmScrolled ? 1e9 : 0) });
document.title = 'Work | Anh V';
if (import.meta.env.DEV) {
  window.__SCROLL = SCROLL; window.__WORK = WORK;
  window.__work = { setOff: (v) => { off = v; }, get off() { return off; }, get S() { return S; }, get virt() { return virt; }, get mode() { return vertical ? 'vertical' : 'side'; }, lenis, setMode, relayout, items, LAY, projCards, gl: () => gl, get morph() { return morph; }, q: Q, PS,  get snap() { return snap; }, AMB, LEAD, get drag() { return drag; }, get inertia() { return inertia; }, fP, fSc, fPu, get kCount() { return kCount; }, bx, by, bw, bh, vis, hp };
  if (params.has('tune')) import('./work/tune.js').then((m) => m.mountWorkTune({ relayout }));
}
