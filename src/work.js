import './styles/base.css';
import './styles/work.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import data from './data/data.json';
import pool from './data/work-pool.json';
import { WORK, WORK_V2, WORK_UI, WORK_TEXT, WORK_SMEAR, WORK_LINE, WORK_PTR, WORK_COUNTER, BEND, WARP, CARDS, CARD_HOVER, DEPTH, SCROLL, INDEX, TRANSITION, TALL, TABLET } from './timeline.js';
import { createV2 } from './work/v2-ui.js';
import { createPointerFx } from './work/pointer-fx.js';
import { isTall, isLiteLandscape } from './util/layout-mode.js';
import { frameZ } from './data/depth.js';
import { capW, dist } from './scale.js';
import { initNav } from './effects/nav.js';
import { createCardsGL } from './effects/cards-gl.js';
import { imgAttrs } from './util/media.js';
import { installScrollGain } from './util/scroll-gain.js';
import { watchDpr } from './util/dpr.js';
import { preloadHeader, runProjectTransition, transitionOK, readBack, playBack } from './effects/project-transition.js';
import { perfOn, pm } from './util/perf-mark.js';
import { applyFocus } from './work/focus.js';
import { frameAmount, FRAME_STRENGTH_REF } from './work/speed-curve.js';
import { pushTarget, stepPushSpring } from './effects/card-push.js';
import { withOvershoot, settleBump, settleCurve } from './util/overshoot.js';
import { workEase, blendSoft, moveForce, forceOf, EASES } from './util/ease.js';
import { ambUnits, ambParams, ambDepthW, ambProgress, ambCardOffset, ambImageOffset, leadUnits, leadParams, leadOffset } from './work/ambient.js';
import { buildProjectCards, placeCards, balanceDark, workMetrics, fixWorkLayout, fixWorkLayoutIdle } from './work/cards.js';
import { slugSeed } from './work/states.js';
import { createGuard } from './work/tall-guard.js';
import { weakReason, appleGpu } from './util/device.js';
import layoutsData from './data/layouts.json';
import { pickSize, placeStored, applyStoredDark, ruleSignature, projectHash } from './work/layout-store.js';

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
// R24a / R24d / R24e: the LITE modes: TALL (phones, tablet portrait) and TABLET LANDSCAPE (R24b's test): the project images only (cards are a flag, 0 now), side scroll
// only, no toggle, the image keeps the desktop ratio, the image warp on (frame-time guard), burger menu in tall; everything lite-only is behind `lite` / `tall`.
// R24f: tall = a VERTICAL strip (drag along Y), landscape on a touch device = the horizontal one.
const tall = isTall();
const tabletLand = isLiteLandscape(); // R24f: landscape on a touch device (decided by the screen, layout-mode.js), not by the window ratio
const warpForce = params.get('warp') === '1'; // R24f: ?warp=1 forces the warp on and bypasses the frame-time guard (to tell "too subtle" from "the guard switched it off")
const lite = tall || tabletLand, liteKind = tall ? 'tall' : 'tablet';
// R24g: live tuning on a real phone: URL overrides of the lite numbers (dev always; in production only with ?perf): fg flingGain, fr dragFriction, fm dragMaxCoast, sa snapAfterSpeed,
// wg warpGain, wp warpPow, ws warpStrength, wf warpFall, ln lean (R24i), ls leanSign, lb leanBuf, sr/sp/sk warp speed ref / pow / knee, fk flingKnee, fw TALL.frame, fn flingMin, sd snapDelay, wr warp rise (s). The overlay prints the values in force.
const overrides = {};
if (lite && (import.meta.env.DEV || perfOn)) {
  const map = { fg: ['flingGain'], fr: ['dragFriction'], fm: ['dragMaxCoast'], sa: ['snapAfterSpeed'], wg: ['warpGain'], wp: ['warpPow'], wf: ['warpFall'], fw: ['frame'], fn: ['flingMin'], sd: ['snapDelay'] };
  for (const [k, [name]] of Object.entries(map)) { const v = parseFloat(params.get(k)); if (Number.isFinite(v)) { TALL[name] = v; overrides[k] = v; } }
  const ws = parseFloat(params.get('ws')); if (Number.isFinite(ws)) { TALL.warpStrength = ws; TALL.frameWarp.strength = WORK.frameWarp.strength * ws; overrides.ws = ws; }
  const ln = parseFloat(params.get('ln')); if (Number.isFinite(ln)) { TALL.frameWarp.lean = ln; overrides.ln = ln; } // R24i: the axis lean; ls = leanSign (+1 / -1)
  const ls = parseFloat(params.get('ls')); if (Number.isFinite(ls)) { TALL.frameWarp.leanSign = ls < 0 ? -1 : 1; overrides.ls = ls; }
  const lb = parseFloat(params.get('lb')); if (Number.isFinite(lb)) { TALL.frameWarp.leanBuf = lb; overrides.lb = lb; } // lb = leanBuf (extra warp-buffer overscan for the lean; read when the buffer is built, so reload)
  for (const [k, f] of [['sr', 'speedRef'], ['sp', 'speedPow'], ['sk', 'speedKnee']]) { const v = parseFloat(params.get(k)); if (Number.isFinite(v)) { TALL.frameWarp[f] = v; overrides[k] = v; } } // R24j: warp speed curve (ref L/s, pow, knee)
  const fk = parseFloat(params.get('fk')); if (Number.isFinite(fk)) { TALL.flingKnee = fk; overrides.fk = fk; } // R24j: fling knee
  const wr = parseFloat(params.get('wr')); if (Number.isFinite(wr)) { TALL.frameWarp.riseSec = wr; overrides.wr = wr; }
}
const TLm = lite ? await import('./work/tall.js') : null;
const cardsMaxNow = lite ? TLm.cardsMaxFor(liteKind, innerWidth, innerHeight) : -1; // cards per project in this mode (-1 = the desktop rule)
// R32: the desktop page v2: no cards (WORK.cards false), the new image size, the title / info / ruler / counter / switch layer (work/v2-ui.js); WORK.cards true = the old page
const v2 = !lite && !WORK.cards;
const geo = v2 ? WORK_V2 : WORK; // frameW / frameH / gapSide / gapVert of the desktop strip
const noCards = lite ? cardsMaxNow <= 0 : v2;
// stored layouts of the lite modes: only needed when cards are on (without cards the files are only checked by the build gate)
const liteLayouts = lite && !noCards ? (tall ? (await import('./data/layouts-tall.json')).default : (await import('./data/layouts-tablet.json')).default) : null;
const projects = data.projects;
const slugs = projects.map((p) => p.slug);
const N = projects.length;
const heroRef = (p) => p.page.blocks.find((b) => b.t === 'hero').img;
const store = { get: () => { try { return localStorage.getItem('work-mode'); } catch { return null; } }, set: (v) => { try { localStorage.setItem('work-mode', v); } catch { /* private window */ } } };
// R28: arriving from a project page entered through the R25 transition: the same mode, that project centred, the enlarge played in reverse (below)
const back = !reduced && params.get('gl') !== '0' ? readBack() : null;
const perfP = perfOn ? import('./effects/perf-hud.js').then((m) => { m.mountPerf(); return m; }) : null; // R31: ?perf report (own chunk)
if (back) pm('back:arrive');
let vertical = tall || (!lite && (back ? back.mode === 'vertical' : store.get() === 'vertical'));

const lenis = new Lenis({ infinite: true, gestureOrientation: 'both', lerp: 0.07, wheelMultiplier: 1 });
// R22j: Lenis runs on a clock that never advances more than 100 ms per frame: after a hidden tab or a long freeze its glide carries on from where
// it was (before, the whole glide finished in one frame: the strip jumped thousands of px when the tab came back)
let lenisClock = 0, lenisLast = null;
gsap.ticker.add((time) => { lenisClock += lenisLast === null ? 0 : Math.min(time - lenisLast, 0.1); lenisLast = time; lenis.raf(lenisClock * 1000); });
gsap.ticker.lagSmoothing(0);
installScrollGain(lenis);
watchDpr();

// ---- DOM
if (!tall && !(v2 && WORK_UI.hideNav)) { // (tablet landscape keeps the nav links; the burger menu is tall only; R32: v2 hides the links for now, the logo stays)
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
    .map(([n, h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
  document.body.prepend(nav);
} else if (tall) import('./effects/tall-menu.js').then((m) => m.mountTallMenu());
const app = document.getElementById('app');
app.innerHTML = `
  <div class="work__spacer"></div>
  <div class="work" id="work">
    <div class="work__stage"></div>
  </div>
  ${v2 ? '' : `<div class="work__name" aria-hidden="true">${projects.map((p) => `<span class="work__title">${[...p.title].map((c) => `<span class="work__char">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`).join('')}</div>
  <div class="work__count" aria-live="polite">01 / 0${N}</div>`}
  ${lite || v2 ? '' : `<button type="button" class="work__toggle" aria-label="Switch to vertical scroll">
    <svg viewBox="0 0 24 24" aria-hidden="true"><g class="work__icon"><rect x="3.5" y="5" width="3" height="14"/><rect x="10.5" y="5" width="3" height="14"/><rect x="17.5" y="5" width="3" height="14"/></g></svg>
  </button>`}`; // (R24e: no toggle on a tablet or a phone: the strip is horizontal, the orientation picks the layout; R32: v2 has its own layer below)
const root = app.querySelector('.work');
const stage = root.querySelector('.work__stage');
// R23e: the counter and the toggle are children of the page, not of .work: their own top layer above the canvas and every click anchor
const ui = v2 ? createV2({ app, projects, reduced }) : null; // R32
if (ui) root.insertBefore(ui.lineEl, stage); // R33d: the scroll line sits in .work, under the canvas
const countEl = app.querySelector('.work__count') || document.createElement('div');
const toggleEl = ui ? ui.switchEl : app.querySelector('.work__toggle') || document.createElement('button'); // (a detached stub in the lite modes: nothing is listening)
const nameEl = app.querySelector('.work__name') || document.createElement('div');
const fadeEls = ui ? [ui.root, ui.lineEl] : [countEl, toggleEl, nameEl]; // what the project transition fades out / back in
const titleEls = [...nameEl.querySelectorAll('.work__title')].map((el) => ({ el, chars: [...el.querySelectorAll('.work__char')], f: -1 }));
const iconEl = toggleEl.querySelector('.work__icon') || document.createElement('span');
// R24h: the tall wordmark (the largest image on that page = the LCP element) is made right here, before the strip / GL / layout setup below, so it paints at the first frame
if (tall) initNav(data.hero.wordmark, lenis, { gateFrame: false, position: () => 1e9, startSmall: true, small: { x: 5, y: 3.4, width: 28 } });
if (tall) await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); // (and one paint before the heavy setup: the wordmark is the LCP element; the strip showed a texture-upload burst first)

// ---- items: the N frames first, then every project's cards (the same objects in both layouts)
const projCards = lite ? TLm.liteCards(buildProjectCards, pool, slugs, WORK.seed, cardsMaxNow) : v2 ? slugs.map(() => []) : buildProjectCards(pool, slugs);
const LD = liteLayouts || layoutsData; // the stored layouts of this mode (the dark flags of the lite modes come from them too)
const metricsNow = () => (lite ? TLm.liteMetrics(liteKind, innerWidth, innerHeight) : workMetrics(innerWidth, innerHeight, capW() / 1920));
const pickNow = () => (lite ? TLm.pickTall(LD, innerWidth, innerHeight) : pickSize(layoutsData, innerWidth, innerHeight));
// R29: the card positions and dark flags come from src/data/layouts.json (tools/layout-solve.mjs, verified by the build gate): no layout work at load. A project
// without a stored layout (or rule numbers changed in ?tune) goes through the old fix pass, with a warning. (No cards: nothing to place or check.)
const storedFlags = noCards || (applyStoredDark(LD, projCards) && LD.signature === (lite ? TLm.tallSignature() : ruleSignature()));
let storedOK = noCards || (storedFlags && !!pickNow());
if (storedOK && !lite && !noCards && import.meta.env.DEV) { // dev: the stored layout must still describe these cards (the gate checks this for every build)
  const pk = pickSize(layoutsData, innerWidth, innerHeight), Mx = workMetrics(innerWidth, innerHeight, capW() / 1920);
  if (pk.exact) for (const mode of ['side', 'vertical']) projCards.forEach((l) => { if (layoutsData.work[pk.key][mode][l[0].slug]?.hash !== projectHash(l, Mx[mode])) storedOK = false; });
}
if (!storedOK) {
  if (import.meta.env.DEV) console.warn('[layouts] no usable stored layout for this window / these cards / these rules: running the load-time fix pass (npm run layout)');
  await fixWorkLayoutIdle(projCards, metricsNow()); // the old time-sliced pass (R22j)
}
const items = [];
projects.forEach((p, i) => items.push({ kind: 'frame', proj: i, slug: p.slug, z: frameZ(), mouse: 20 + 80 * DEPTH.slot, dark: false, ref: heroRef(p) }));
projCards.forEach((list, i) => list.forEach((c, j) => items.push({ kind: 'card', proj: i, j, slug: c.slug, z: c.z, mouse: c.mouse, dark: c.dark, src: c.src, card: c })));
const n = items.length;
items.forEach((it, i) => {
  const a = document.createElement('a');
  a.className = `work__item work__${it.kind}`;
  a.href = `/work/${it.slug}.html`;
  a.style.visibility = 'hidden'; // (shown by the tick once the item is near the screen: an item that was never placed sat invisible at the top-left corner and took clicks there)
  a.style.zIndex = String(it.z); // the same order as the canvas (R23d): the image sits in the middle of the card depths
  if (it.kind === 'frame') a.setAttribute('aria-label', projects[it.proj].title);
  else { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); } // R22j: a card is a decoration with the same target as its project's image: not a tab stop, not announced (34 unnamed links otherwise)
  // the picture is only requested once the item is near the screen (activate()): the canvas then uploads exactly that file
  a.innerHTML = `<img ${imgAttrs(it.kind === 'frame' ? it.ref : it.src, it.kind === 'frame' ? `${lite ? Math.round((tall ? TALL.frame : 0.75) * 100) : Math.round(geo.frameW)}vw` : '300px', true)} alt="" decoding="async" draggable="false">`;
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
let liteMotionAt = 0; // R24h: the last time the strip moved (focus delay, landing measure)
let loadGate = false; // R31: on the way back only the pictures that show at rest are requested until the transition is over (then the tick and idleLoad take over)
const nearArr = new Uint8Array(n); // item within 0.8 of a view length of the centre along the strip: its picture is requested at once; the rest follow when idle (below)
const activate = (it) => { if (it.active) return; it.active = true; const d = it.img.dataset; if (d.srcset) it.img.srcset = d.srcset; it.img.src = d.src; };
let gl = null; // the card canvas (created below)
let fine = false;
let laidOnce = false;
const layouts = () => {
  W = innerWidth; H = innerHeight; scale = lite ? TLm.liteScale(liteKind, W, H) : capW() / 1920;
  const lf = lite ? TLm.liteFrame(liteKind, W, H) : null; // the lite frame keeps the desktop image ratio
  let fw = lite ? lf.w : (geo.frameW * W) / 100, fh = lite ? lf.h : (geo.frameH * H) / 100;
  if (v2) { const r = (geo.frameW * 1920) / (geo.frameH * 1080); fw = Math.min(fw, fh * r); fh = fw / r; } // v2: the width is frameW of the window, the height from the ratio; a window wider than 16:9 shrinks the image instead of running it into the info block
  if (laidOnce && !storedOK) fixWorkLayout(projCards, metricsNow(), { structural: false }); // fallback only, a resize: nudges only (the card set stays)
  laidOnce = true;
  const placedAll = {};
  for (const mode of lite ? [TLm.liteMode(liteKind)] : ['side', 'vertical']) {
    const v = mode === 'vertical';
    const M = lite ? TLm.liteMetrics(liteKind, W, H)[mode] : { vertical: v, alongF: v ? fh : fw, crossF: v ? fw : fh, scale, gap: v ? (geo.gapVert * H) / 100 : (geo.gapSide * W) / 100, gapPx: (WORK.dupGap * (v ? H : W)) / 100, viewAlong: v ? H : W, viewCross: v ? W : H };
    const pitch = M.alongF + M.gap;
    const pk = storedOK ? pickNow() : null;
    let placed = noCards ? projCards.map(() => []) : pk ? placeStored(LD, projCards, M, mode, pk) : null;
    if (!placed) { storedOK = false; placed = placeCards(projCards, M); } // (a size without a stored layout: the card set is the same, the positions come from the generator)
    placedAll[mode] = placed;
    const pos = items.map((it) => {
      if (it.kind === 'frame') return { along: it.proj * pitch, cross: 0, alongSize: M.alongF, crossSize: M.crossF };
      const p = placed[it.proj][it.j];
      return { along: it.proj * pitch + p.along, cross: p.cross, alongSize: p.alongSize, crossSize: p.crossSize };
    });
    LAY[mode] = { M, pitch, period: N * pitch, pos };
  }
  if (lite) { const only = LAY[TLm.liteMode(liteKind)]; LAY.side = only; LAY.vertical = only; }
  if (!storedOK) balanceDark(projCards, [placedAll.side, placedAll.vertical].filter(Boolean)); // dark runs <= 2 along the strip in both modes (the stored flags already hold it)
  items.forEach((it, i) => {
    if (it.kind === 'card') { it.dark = it.card.dark; it.el.dataset.dark = it.dark ? '1' : '0'; if (gl) { gl.darkCard[i] = it.dark; gl.hd[i] = it.dark && fine ? CARD_HOVER.darkRest : 0; } }
    const w = it.kind === 'frame' ? fw : it.card.w * scale;
    const h = it.kind === 'frame' ? fh : it.card.h * scale;
    bw[i] = w; bh[i] = h;
    it.el.style.width = `${w}px`; it.el.style.height = `${h}px`;
  });
  if (ui) ui.layout(fw, fh);
};
layouts();
const cur = () => LAY[vertical ? 'vertical' : 'side'];

// ---- WebGL (the homepage card renderer, with the Work page's own warp numbers)
// R22h: two warps with their own settings: WORK.cardWarp (the cards) and WORK.frameWarp (the main images, own shader). Both are read live.
// R24d: the frame-time guard of the lite modes (work/tall-guard.js): steps the warp pass down when the strip does not hold the frame budget
const guard = createGuard({ setScale: (k) => gl?.setWarpScale?.(k), enabled: lite && TALL.guard && !warpForce });
if (perfOn) window.__tallGuard = guard.state; // read by the ?perf report
const warpSpeed = (v, along) => { const vn = (v * TALL.warpRefPx) / Math.max(along, 1), r = (Math.abs(vn) * TALL.warpGain) / TALL.warpVRef; return Math.sign(vn) * TALL.warpVRef * r ** TALL.warpPow; }; // R24f: the speed the warp sees in the lite modes
const diag = { now: 0, peakAll: 0, peakLast: 0, moving: -1e9 }; // R24f: the warp amount now / the peak of the last movement (the ?perf diagnosis line)
const bendP = { ...BEND };
if (lite) { bendP.dprCap = Math.min(bendP.dprCap, TALL.dprCap); bendP.dprCapLarge = Math.min(bendP.dprCapLarge, TALL.dprCap); } // R24a: a lighter backing store on a phone / tablet
const warpP = { ...WARP };
const bendImg = { riseSpeed: 1, settleSpeed: 1 };
const warpImg = { ...WARP };
const copyWarp = (dst, src) => {
  dst.strengthUp = dst.strengthDown = src.strength;
  dst.curl = src.curl; dst.camDown = src.camDown; dst.camUp = src.camUp; dst.bowDown = src.bowDown; dst.bowUp = src.bowUp; dst.reach = src.reach; dst.sym = src.sym;
  dst.shapeK = src.strength / FRAME_STRENGTH_REF; dst.speedRef = src.speedRef; dst.speedPow = src.speedPow; dst.speedKnee = src.speedKnee; dst.lean = src.lean; dst.leanSign = src.leanSign; dst.leanSignDown = src.leanSignDown; dst.leanSignUp = src.leanSignUp; dst.leanMax = src.leanMax; dst.leanBuf = src.leanBuf; // (R24i: only the image warp has them)
};
const syncWarp = () => {
  copyWarp(warpP, WORK.cardWarp);
  bendP.riseSpeed = 7 / Math.max(WORK.cardWarp.riseSec, 0.02);
  bendP.settleSpeed = 7 / Math.max(WORK.cardWarp.settleSec, 0.02);
  copyWarp(warpImg, WORK.frameWarp);
  bendImg.riseSpeed = 7 / Math.max(WORK.frameWarp.riseSec, 0.02);
  bendImg.settleSpeed = 7 / Math.max(WORK.frameWarp.settleSec, 0.02);
  if (lite) { // R24d: no cards, so no card warp; the image warp uses TALL.frameWarp (read live), off when TALL.warp is false or the frame-time guard has stepped to its last stage
    warpP.strengthUp = warpP.strengthDown = 0;
    const fw = TALL.frameWarp, on = TALL.warp && guard.state.warp;
    copyWarp(warpImg, { ...fw, strength: on ? fw.strength : 0 });
    bendImg.riseSpeed = 7 / Math.max(fw.riseSec, 0.02); bendImg.settleSpeed = 7 / Math.max(TALL.warpFall, 0.02); // R24g: the fall is its own (slower) time
  }
};
syncWarp();
fine = matchMedia('(pointer: fine)').matches && !reduced && !tall; // (tablet landscape keeps its hover rules: touch has no fine pointer anyway)
let glOn = false;
{
  const fallback = () => { glOn = false; root.classList.remove('work--gl'); gl?.destroy?.(); gl = null; };
  gl = createCardsGL({ lite, section: root, els: items.map((it) => it.img), cards: items, bx, by, bw, bh, onLost: fallback, bend: bendP, warp: warpP, near: (i) => items[i].active === true, layers: { isFrame: Uint8Array.from(items, (it) => (it.kind === 'frame' ? 1 : 0)), warp: warpImg, bend: bendImg, target: (v) => frameAmount(v / Math.max(cur().M.viewAlong, 1), warpImg) } });
  if (gl) {
    glOn = true;
    perfP?.then((m) => m.attachGl(gl));
    root.classList.add('work--gl');
    gl.resize(W, H);
    gl.setAxis(vertical ? 0 : 1);
    gl.show(true);
    items.forEach((it, i) => { gl.hd[i] = it.dark && fine ? CARD_HOVER.darkRest : 0; });
  }
}

// R24f: the diagnosis the ?perf overlay shows (live while dragging) and the report holds: is GL on, is the warp pass running, the warp amount now / peak, why GL is off
if (perfOn) window.__tallDiag = () => {
  const d = gl?.diag?.() || {};
  const why = gl ? '' : params.get('gl') === '0' ? '?gl=0' : reduced ? 'reduced motion (the iOS "Reduce Motion" setting): add ?warp=1' : lite ? (navigator.connection?.saveData === true ? 'saveData' : 'noWebGL2') : (weakReason(BEND.weakCores, BEND.weakMemoryGb) || 'noWebGL2'); // (R24g: names the test that fired: saveData / cores / memory / noWebGL2)
  return { lite, kind: lite ? liteKind : 'desktop', strip: vertical ? 'vertical' : 'side', glOn: !!gl, glOffReason: why, warpForced: warpForce, warpOn: TALL.warp && guard.state.warp, warpPassActive: d.lastPass ? performance.now() - d.lastPass < 300 : false, warpPasses: d.passCount ?? 0, warpAmountNow: +diag.now.toFixed(3), warpAmountPeak: +diag.peakAll.toFixed(3), warpAmountPeakLast: +diag.peakLast.toFixed(3), cores: navigator.hardwareConcurrency, appleGpu: appleGpu(), touch: touchLog.slice(), pointerEvents: pEvents.slice(), values: { flingGain: TALL.flingGain, flingMin: TALL.flingMin, dragFriction: TALL.dragFriction, dragMaxCoast: TALL.dragMaxCoast, snapAfterSpeed: TALL.snapAfterSpeed, snapDelay: TALL.snapDelay, focusDelay: TALL.focusDelay, warpGain: TALL.warpGain, warpPow: TALL.warpPow, warpStrength: TALL.warpStrength, warpRise: TALL.frameWarp.riseSec, warpFall: TALL.warpFall, frame: TALL.frame, overrides }, guardStep: guard.state.step, dpr: devicePixelRatio, canvasDpr: gl ? +(gl.canvas.width / innerWidth).toFixed(2) : 0, passScale: d.warpScale ?? 1, bufferPath: d.fbPath ?? 'n/a', warpProgram: d.postOk ?? 'n/a', bufferPx: d.bufferPx ?? 'n/a' };
};
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
const AMB = { on: false, t0: 0, tOff: 0, a0: new Float64Array(n), r0: new Float64Array(n), av: new Float64Array(n), al: new Float64Array(n), cr: new Float64Array(n), units: items.map((it) => (it.kind === 'card' ? ambUnits(it.card, slugSeed(it.card.slug)) : null)), moving: false };
const stepAmb = (now) => {
  let fmax = 0;
  for (let q = 0; q < N; q++) if (fP[q] > fmax) fmax = fP[q];
  const on = !v2 && glOn && !reduced && (!tall || TALL.ambient) && !morph && !snap && !drag && !inertia && !focusOff(now) && now - lastWheel > WORK.ambDelay * 1000 && fmax >= 0.98;
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
const LEAD = { x: new Float64Array(n), v: new Float64Array(n), units: items.map((it) => (it.kind === 'card' ? leadUnits(it.card, slugSeed(it.card.slug)) : null)), moving: false };
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
// R28: the project transition's push (cards and the two neighbours move away from the image), driven by TRANSITION, not by the focus
const TP = { q: -1, p: 0, p0: 0, hold: false };
const pushArr = new Float64Array(N);
const FOC = v2 ? new Proxy(WORK, { get: (t, k) => (k === 'focusScale' ? WORK_V2.focusScale : k === 'focusNeighbour' ? WORK_V2.focusNeighbour : t[k]) }) : WORK; // R32: v2 keeps the centred image at its size and the neighbours at the measured gap
const PT = new Proxy(FOC, { get: (t, k) => (k === 'focusPushOthers' ? TRANSITION.pushFar : t[k]) });
// R30: the clearing push. Per item (all but the clicked image): the direction away from that image's centre and how far to travel to be fully off screen
// (+ clearMargin); the item's own progress is staggered by its distance (near first). TC.u = the linear push time 0..1.
const TC = { on: false, dx: new Float64Array(n), dy: new Float64Array(n), T: new Float64Array(n), rank: new Float64Array(n), u: 0, q: -1 };
const clearMode = () => TRANSITION.pushClear > 0;
const prepareClear = (q) => {
  const fi = items.findIndex((it) => it.kind === 'frame' && it.proj === q), cx = px[fi], cy = py[fi], m = TRANSITION.clearMargin * scale;
  let maxD = 1;
  for (let i = 0; i < n; i++) {
    TC.T[i] = 0; if (i === fi) continue;
    const rx = px[i] - cx, ry = py[i] - cy, len = Math.hypot(rx, ry);
    const ux = len > 1 ? rx / len : 0, uy = len > 1 ? ry / len : -1; // exactly on the centre: straight up
    const hw = bw[i] * 0.58, hh = bh[i] * 0.58; // half size + the growth the focus may have given it
    const out = px[i] + hw < -m || px[i] - hw > W + m || py[i] + hh < -m || py[i] - hh > H + m;
    TC.dx[i] = ux; TC.dy[i] = uy;
    if (out) continue;
    let t = Infinity;
    if (ux > 1e-6) t = Math.min(t, (W + m + hw - px[i]) / ux); else if (ux < -1e-6) t = Math.min(t, (-m - hw - px[i]) / ux);
    if (uy > 1e-6) t = Math.min(t, (H + m + hh - py[i]) / uy); else if (uy < -1e-6) t = Math.min(t, (-m - hh - py[i]) / uy);
    TC.T[i] = Number.isFinite(t) ? Math.max(0, t) + 2 : 0; // +2 px: strictly outside
    TC.rank[i] = len; if (len > maxD) maxD = len;
  }
  for (let i = 0; i < n; i++) TC.rank[i] = Math.min(1, TC.rank[i] / maxD);
  TC.q = q; TC.on = true;
};
const applyClear = () => {
  const s = Math.min(0.9, Math.max(0, TRANSITION.clearStagger)), u = TC.u, e = EASES.cubic; // (cubic, not circ: circ has a vertical tangent at its middle, a 1500 px travel would show a speed spike)
  for (let i = 0; i < n; i++) {
    const T = TC.T[i]; if (T === 0) continue;
    const e1 = e(Math.min(1, Math.max(0, (u - s * TC.rank[i]) / (1 - s))));
    px[i] += TC.dx[i] * T * e1; py[i] += TC.dy[i] * T * e1;
  }
};
let arrivalHold = false; // after arriving from a project: no mouse drift until the first input
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
let preT = 0;
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
const cancelSnap = () => { snap = null; snapForce = 0; lastWheel = performance.now(); inputAt = lastWheel; wmScrolled = true; arrivalHold = false; inputRelease(); };
// ---- R22e: hold and drag (desktop mouse). The strip follows the pointer 1:1 (the scroll gain does not apply) along the mode's axis; on release
// it keeps the pointer's speed and loses it by friction (R22i: speed x exp(-t / WORK.dragFriction), distance = speed x friction time, capped at
// WORK.dragMaxCoast pitches; no overshoot; it ends when the speed is under 5 px/s)
// and then the soft snap takes over as usual. A drag past 6 px swallows the click that would open a project; a plain click still works.
// Everything moves `off` only: Lenis (R23c re-base handling, gain) and the counter are untouched. Wheel / key / touch / a new grab cancel it.
const snapSecNow = () => (lite ? 2 : WORK.snapSec); // (R33c: WORK.snapSec 1 is for the desktop page; the phone / tablet snap keeps its 2 s)
let inputAt = 0; // R33c: the last wheel / key / touch / press / drag movement (the scroll-stop clock)
let drag = null; // { id, last, total, captured, samples: [[t, pos]] }
let inertia = null; // { from, v0, F, t0 }
let dragMoved = false;
let dragAccum = 0; // S change made by the drag / inertia since the last frame (px): the warp follows it like a wheel scroll
const axisOf = (e) => (vertical ? e.clientY : e.clientX);
// R24g: the release of a drag in the lite modes: the speed from the last 100 ms of the finger (displacement / elapsed; none when it stopped more than 80 ms before the lift),
// x TALL.flingGain; under TALL.flingMin screen lengths / s no coast; friction TALL.dragFriction, at most TALL.dragMaxCoast pitches. Every swipe is logged for the ?perf touch block.
const touchLog = []; let curSwipe = null, swipePeak = 0;
const ampHist = []; // R24j: [time, |warp amount|] of the last frames (the touch block's ampAtRelease)
const liteRelease = (d, now, by = 'other') => {
  const len = Math.max(cur().M.viewAlong, 1), pitch = cur().pitch;
  const s = d.samples.filter((q) => now - q[0] <= 100), last = d.samples[d.samples.length - 1];
  const entry = { releaseLenPerS: 0, fling: false, coastPitches: 0, peak: swipePeak, at: Math.round(now), endedBy: by, landedPx: null, snapCorrectionPx: 0, gapFromPrevMs: touchLog.length ? Math.round(now - touchLog[touchLog.length - 1].at) : null };
  entry.durationMs = Math.round(now - d.samples[0][0]);
  { const h = ampHist.filter((q) => now - q[0] >= 100).pop() || ampHist[0]; entry.ampAtRelease = h ? +Math.min(1, h[1]).toFixed(2) : 0; } // R24j: the warp amount 100 ms before the lift
  if (s.length >= 2 && now - last[0] <= 80 && entry.durationMs >= 60) { // (R24h: a touch that lasted under 60 ms is a tap-like stray, never a fling)
    const raw = -((s[s.length - 1][1] - s[0][1]) / Math.max((s[s.length - 1][0] - s[0][0]) / 1000, 0.008)), v0 = raw * TALL.flingGain * Math.pow(Math.max(Math.abs(raw) / len / TALL.flingRef, 0.05), TALL.flingPow - 1); // (the curve: a light swipe glides less than linear, a firm flick more)
    entry.releaseLenPerS = +(raw / len).toFixed(2);
    if (Math.abs(raw) / len >= TALL.flingMin) {
      const pl = TLm.flingPlan({ raw, len, pitch, from: S }); // R24h: the glide is planned to end exactly on an image
      inertia = { from: S, D: pl.D, T: pl.T, p: pl.p, v0: pl.v0, t0: now }; entry.fling = true; entry.coastPitches = +pl.pitches.toFixed(2); entry.landsOn = pl.k;
    }
  }
  touchLog.push(entry); if (touchLog.length > 10) touchLog.shift(); curSwipe = entry;
};
const endDrag = (by = 'other') => {
  if (!drag) return;
  const d = drag;
  drag = null;
  root.classList.remove('is-dragging');
  try { if (d.captured) document.documentElement.releasePointerCapture(d.id); } catch { /* already released */ }
  if (!d.total || d.total <= d.thr) return;
  if (lite) { liteRelease(d, performance.now(), by); return; }
  // the pointer's speed over the last 90 ms, as strip speed (the strip moves against the pointer's coordinate)
  const now = performance.now();
  const s = d.samples.filter((q) => now - q[0] < 90);
  if (s.length >= 2) {
    const v = -((s[s.length - 1][1] - s[0][1]) / Math.max((s[s.length - 1][0] - s[0][0]) / 1000, 0.008));
    if (Math.abs(v) > 30) { const F0 = Math.max(WORK.dragFriction, 0.05), cap = WORK.dragMaxCoast * cur().pitch, nat = Math.abs(v) * F0, F = nat <= cap ? F0 : (cap * (1 + WORK.dragCoastKnee * Math.log(nat / cap))) / Math.abs(v); inertia = { from: S, v0: v, F, t0: now }; } // the release speed is the last drag speed (no step); a hard fling gets a shorter friction time so the distance stays capped
  }
};
addEventListener('pointerdown', (e) => {
  if ((e.pointerType === 'mouse' && e.button !== 0) || morph || fading || (drag && e.pointerType !== 'mouse')) return; // R24b: touch and pen share the drag; a second finger is ignored
  if (e.target.closest?.('.work__toggle, .work__count, .w2__hit, .tmenu__btn, .tmenu, [data-tune-panel]') || e.target.closest?.('div[style*="99999"]')) return;
  dragMoved = false; swipePeak = 0; curSwipe = null;
  drag = { id: e.pointerId, mouse: e.pointerType === 'mouse', thr: e.pointerType === 'mouse' ? 6 : 10, last: axisOf(e), total: 0, captured: false, samples: [[performance.now(), axisOf(e)]] };
  inertia = null; snap = null; snapForce = 0; lastWheel = performance.now(); inputAt = lastWheel; wmScrolled = true; inputRelease();
  e.preventDefault(); // no text selection, no image drag
}, { capture: true });
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.pointerType === 'mouse' && e.buttons === 0) { endDrag('move-buttons-0'); return; } // released outside the window (or the up event was lost): never stuck (R24h: a mouse only: a touch ends with its own up / cancel, some browsers report buttons 0 for a finger)
  const pos = axisOf(e), dpos = pos - drag.last;
  drag.last = pos;
  drag.total += Math.abs(dpos);
  if (drag.total > drag.thr) {
    dragMoved = true;
    root.classList.add('is-dragging');
    if (!drag.captured && drag.mouse) { try { document.documentElement.setPointerCapture(drag.id); drag.captured = true; } catch { /* not capturable */ } } // from here the move / up come even outside the window
  }
  off -= dpos; // 1:1: the content follows the pointer
  dragAccum -= dpos;
  drag.samples.push([performance.now(), pos]);
  if (drag.samples.length > (lite ? 30 : 12)) drag.samples.shift();
}, { capture: true, passive: true });
for (const type of ['pointerup', 'pointercancel']) addEventListener(type, (e) => { if (drag && e.pointerId === drag.id) endDrag(type === 'pointerup' ? 'up' : 'cancel'); }, { capture: true });
// R24h: with ?perf the last pointer events are kept for the report (to find out where a double release comes from)
const pEvents = [];
if (perfOn) for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(type, (e) => { pEvents.push({ t: Math.round(performance.now()), type, id: e.pointerId, kind: e.pointerType, buttons: e.buttons, drag: !!drag }); if (pEvents.length > 24) pEvents.shift(); }, { capture: true });
addEventListener('blur', endDrag);
document.documentElement.addEventListener('lostpointercapture', (e) => { if (drag && drag.mouse && e.pointerId === drag.id) endDrag(); }); // R22h: a drag can never stay 'held' after the browser took the pointer back
document.addEventListener('visibilitychange', () => { if (document.hidden) endDrag(); });
addEventListener('click', (e) => { if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; } }, { capture: true });
// R25: a click on a main image grows that picture into the project page's header (cards keep a plain page load)
items.forEach((it) => { if (it.kind === 'frame') it.el.addEventListener('pointerenter', () => preloadHeader(it.slug, it.ref)); });
stage.addEventListener('click', (e) => {
  const a = e.target.closest('a.work__frame');
  if (!a || !glOn || morph || !transitionOK() || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const it = items.find((q) => q.el === a), i = it.idx, sc = ui ? 1 : gl.hs[i] || 1; // (R33: v2 reads the UNSCALED frame; the hover growth eases back to 1 as the transition starts)
  e.preventDefault();
  const w = bw[i] * sc, h = bh[i] * sc;
  runProjectTransition({ slug: it.slug, ref: it.ref, rect: { x: bx[i] + gl.ox[i] - w / 2, y: by[i] + gl.oy[i] - h / 2, w, h }, startSrc: it.img.currentSrc || it.img.src, fade: fadeEls, fromWork: { mode: vertical ? 'vertical' : 'side', projectIndex: it.proj }, onPush: (p, u) => { if (clearMode()) TC.u = u; else if (TRANSITION.pushScale > 0) TP.p = TP.p0 + (TRANSITION.pushScale - TP.p0) * p; }, onStart: () => { pm('fwd:click'); lenis.stop(); nameEl.style.zIndex = '9'; TP.q = it.proj; TP.p0 = fPu.x[it.proj]; TP.p = TP.p0; TP.hold = TRANSITION.pushScale > 0 || clearMode(); if (clearMode()) { TC.u = 0; prepareClear(it.proj); } } }); // (the project name stays above the growing picture and fades with the rest)
});
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

let ptrFx = null, v2StopAt = 0; const hzA = new Float64Array(N); // R33: the last time the strip moved / the hover growth (0..1)
const v2s = { pos: 0, idx: 0, kHead: 0, idxHead: 0, kNum: 1, vertical: false, morph: false, stopped: false, dt: 0.016 };
const tick = (_time, deltaMs) => {
  if (import.meta.env.DEV && window.__guardBusy) { const t0 = performance.now(); while (performance.now() - t0 < window.__guardBusy); } // dev only: a test hook that makes every frame slow (the frame-time guard test)
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
  const L0 = cur(); // (the strip of this frame)
  if (inertia && !morph && lite) { // R24h: the planned landing: x(t) = from + D x (1 - (1 - u)^p), the speed falls to exactly 0 on the image
    const u = Math.min(1, (now - inertia.t0) / 1000 / inertia.T), target = inertia.from + inertia.D * (1 - Math.pow(1 - u, inertia.p)), before = S;
    off += target - S; S = target; dragAccum += S - before; lastWheel = now; snap = null;
    if (u >= 1) inertia = null;
  } else if (inertia && !morph) {
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
  const snapOk = glOn && !reduced && !morph, sdMs = (lite ? TALL.snapDelay : WORK.snapDelay) * 1000; // R24g: the lite snap waits 0.35 s after the last movement, not 1 s
  if (snapOk) {
    if (snap) {
      const t = Math.min(1, (now - snap.t0) / 1000 / Math.max(snapSecNow(), 0.05));
      const target = snap.from + (snap.to - snap.from) * withOvershoot(workEase(WORK), WORK.snapOvershoot * qForce(snap.force), WORK.overshootSettle)(t);
      const sPrev = S;
      off += target - S; S = target;
      if (lite) { vel += (S - sPrev) / Math.max(dt, 1e-3); if (curSwipe && curSwipe.landedPx === null) curSwipe.snapCorrectionPx = +(curSwipe.snapCorrectionPx + Math.abs(S - sPrev)).toFixed(1); } // R24d: the soft snap drives the warp too (tall / tablet only); R24h: how far it moved after the glide (about 0 now)
      if (t >= 1) snap = null;
    } else if (now - lastWheel > sdMs && (Math.abs(vel) < 250 || now - lastWheel > sdMs + 600)) {
      // R22h: the snap must always take over. A speed above 250 px/s can no longer hold it off for more than 0.6 s after the quiet time, and a stale
      // Lenis glide is not trusted that long either (see `late`)
      // the wheel has been quiet and Lenis' glide is nearly over: where the glide will end (S + what is left of it) picks the project
      const pt = cur().pitch, late = now - lastWheel > sdMs + 600, pred = late ? S : S + (lenis.targetScroll - lenis.animatedScroll) * WORK.wheel, k = Math.round(pred / pt), d = k * pt - pred;
      if (Math.abs(d) <= WORK.snapWindow * pt && Math.abs(k * pt - S) > 0.5) { snapForce = moveForce(k * pt - S, scale, workEase(WORK), snapSecNow(), WORK); snap = { from: S, to: k * pt, t0: now, force: snapForce }; }
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
    // R24h (lite): (also the strip must be centred on an image: a soft snap that has not started yet is not a rest) the focus builds only after the glide AND the landing have fully stopped and TALL.focusDelay s have passed (never during them)
    if (lite && (Math.abs(vel) > 5 || drag || inertia || snap)) liteMotionAt = now;
    const restOk = lite ? (!snap && !inertia && !drag && Math.abs(S - Math.round(S / pt) * pt) < 0.5 && now - liteMotionAt > TALL.focusDelay * 1000) : (!!snap || (now - lastWheel > WORK.snapDelay * 1000 && Math.abs(vel) < 250));
    if (lite && curSwipe && curSwipe.landedPx === null && restOk && now - liteMotionAt > 400) { const pt0 = cur().pitch; curSwipe.landedPx = +(S - Math.round(S / pt0) * pt0).toFixed(2); }
    const hold = focusOff(now);
    const rate = dt / Math.max(hold ? 0.35 : WORK.focusRampSec, 0.02);
    for (let q = 0; q < N; q++) {
      const tgt = TP.hold ? fP[q] : snapOk && restOk && !hold && q === pk ? workEase(WORK)(c) : 0; // (frozen while a project opens)
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
  if (stepLead(dt, vel, glOn && !reduced && (!tall || TALL.lead) && !morph && !snap)) settleMoving = true;
  // R22g: the mouse drift fades out / in over 0.6 s around the toggle morph (it used to switch off at the first frame and on at the last: a card
  // jumped by its whole drift when the pointer was off-centre)
  driftW += Math.max(-dt / 0.6, Math.min(dt / 0.6, (morph || arrivalHold ? 0 : 1) - driftW));
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
    if (nearArr[i] && !it.active && !loadGate) activate(it);
  }
  // R23f: the focus (the centred project grows, every card is pushed away from the focused image, neighbours move off) is applied to the
  // base positions of this frame; fsArr = the image scale per project
  const pushing = TP.q >= 0 && (TP.p > 0 || TP.hold);
  if (!tall && (focusMoving || anyF || NUD.live || pushing)) { FA.vertical = L.M.vertical; FA.pitch = L.pitch; FA.scale = scale; NUD.dt = dt; let pa = fPu.x; if (pushing) { pushArr.set(fPu.x); pushArr[TP.q] = TP.p; pa = pushArr; } applyFocus(FA, fSc.x, pushing ? PT : FOC, CARDS, fsArr, pa, NUD); if (NUD.live) settleMoving = true; } else fsArr.fill(1);
  if (ui && WORK_V2.hoverOn) { // R33 / R33b: hover enlarge of WHICHEVER image is under the pointer; the others are pushed out by exactly the growth (the gaps stay)
    const Lh = cur(), hs = WORK_V2.hoverScale - 1, A = Lh.M.alongF, per = Lh.period;
    const still = !morph && !drag && !inertia && !snap && Math.abs(vel) <= 5 && TP.q < 0 && !TC.on;
    const sec = TP.q >= 0 || TC.on ? WORK_V2.hoverClickSec : WORK_V2.hoverSec, k = 1 - Math.exp((-dt * 4.5) / Math.max(sec, 0.02));
    let any = false;
    for (let q = 0; q < N; q++) { // (the pointer test reads last frame's rect of the image: base position + its offsets + its growth)
      const hsq = glOn ? gl.hs[q] : 1, hw = (bw[q] * hsq) / 2, hh = (bh[q] * hsq) / 2;
      const inside = fine && mouse.known && Math.abs(mouse.px - (bx[q] + (glOn ? gl.ox[q] : 0))) < hw && Math.abs(mouse.py - (by[q] + (glOn ? gl.oy[q] : 0))) < hh;
      hzA[q] = morph ? 0 : hzA[q] + ((inside && still ? 1 : 0) - hzA[q]) * k;
      if (Math.abs(hzA[q] - (inside && still ? 1 : 0)) < 0.0005) hzA[q] = inside && still ? 1 : 0;
      if (hzA[q] > 0) any = true;
    }
    if (any) {
      const rel = new Float64Array(N), c = new Float64Array(N);
      for (let q = 0; q < N; q++) { rel[q] = wrap(q * Lh.pitch - S, per) / Lh.pitch; c[q] = hs * hzA[q]; fsArr[q] *= 1 + c[q]; }
      for (let p = 0; p < N; p++) { let off = 0; for (let q = 0; q < N; q++) if (q !== p && c[q] > 0) off += (rel[q] < rel[p] ? 1 : -1) * c[q] * A * 0.5; if (off) { if (Lh.M.vertical) py[p] += off; else px[p] += off; } }
    }
  }
  if (TC.on) applyClear();
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
  if (morph || Math.abs(pos - kCount) > 0.5 + WORK_COUNTER.counterHysteresis) kCount = Math.round(pos);
  const idx = ((kCount % N) + N) % N;
  if (idx !== lastIdx) { lastIdx = idx; clearTimeout(preT); preT = setTimeout(() => preloadHeader(projects[idx].slug, heroRef(projects[idx])), 700); /* R25: the centred project's header image is fetched once it rests */ if (!ui) countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`; }

  if (ui) { // R32 / R33c: the text field, counter and ruler. SCROLL STOP = no input for scrollStopSec (a coasting drag counts as moving until it is slower than scrollStopSpeed), the strip may still
    // be gliding / snapping to its image: the project it is HEADING to is then the active one.
    const ptn = L.pitch;
    if (drag) inputAt = now;
    const inSpeed = inertia ? Math.abs(inertia.v0) * Math.exp(-((now - inertia.t0) / 1000) / Math.max(inertia.F || 0.6, 0.05)) : 0;
    const stopped = !morph && !drag && TP.q < 0 && !TC.on && now - inputAt > WORK_TEXT.scrollStopSec * 1000 && (!inertia || inSpeed < WORK_TEXT.scrollStopSpeed * L.M.viewAlong);
    let kHead;
    if (snap) kHead = Math.round(snap.to / ptn);
    else if (inertia) kHead = Math.round((inertia.from + (inertia.D !== undefined ? inertia.D : inertia.v0 * inertia.F)) / ptn);
    else kHead = Math.round((S + (lenis.targetScroll - lenis.animatedScroll) * WORK.wheel) / ptn);
    v2s.pos = pos; v2s.idx = idx; v2s.kHead = kHead; v2s.idxHead = ((kHead % N) + N) % N; v2s.kNum = (stopped ? kHead : kCount) + 1;
    v2s.speedL = Math.abs(vel) / Math.max(L.M.viewAlong, 1); v2s.vertical = morph ? morph.to === 'vertical' : vertical; v2s.morph = !!morph; v2s.dt = dt; v2s.stopped = stopped;
    if (!stopped) v2StopAt = 0; else if (!v2StopAt) { v2StopAt = now; if (window.__stopLog) window.__stopLog.push({ at: now, since: now - inputAt }); }
    ui.frame(v2s);
  }
  if (ui && glOn) { // R33b: the pixel smear on every picture (only with a fine pointer; cards-gl is null on reduced motion / weak devices / ?gl=0)
    ptrFx ||= createPointerFx(gl, N);
    const hq = ((kCount % N) + N) % N;
    const calm = !morph && !drag && !inertia && !snap && Math.abs(vel) <= 5 && TP.q < 0 && !TC.on;
    ptrFx.update({ dt, idx: hq, px: fine && mouse.known ? mouse.px : NaN, py: mouse.py, W, H, frameH: bh[hq], allowed: fine && calm && mouse.known, warp: Math.abs(gl.bendImg().amt || 0), scale, gapAlong: L.M.gap, vertical: L.M.vertical });
  }
  if (lite && glOn) guard.frame(deltaMs, Math.abs(vel) > 5 || !!drag || !!inertia || !!snap);
  if (glOn) {
    if (morph) { const b = gl.bend(); b.x = 0; b.v = 0; const c = gl.bendImg(); c.x = 0; c.v = 0; } // both warps are held flat while the layouts morph
    const moving = Math.abs(vel) > 0.5 || hoverMoving || pushMoving || settleMoving || !!morph || focusMoving || !!snap || Math.abs(mouse.tx - mouse.x) > 0.0005 || Math.abs(mouse.ty - mouse.y) > 0.0005;
    if (moving) lastDirty = now;
    if (moving || now - lastDirty < 80) gl.markDirty();
    // R24f: in the lite modes the warp's speed is measured against the screen length along the strip (phone, tablet and a desktop wheel give comparable amounts)
    if (import.meta.env.DEV && lite) { const m = (window.__vl ||= { raw: 0, out: 0 }); m.raw = Math.max(m.raw, Math.abs(vel)); m.out = Math.max(m.out, Math.abs(warpSpeed(vel, L.M.viewAlong))); }
    gl.draw(0, dt, lite ? warpSpeed(vel, L.M.viewAlong) : vel, scale, vel); // (R24j: the images' spring gets the raw strip speed: own curve in speed-curve.js)
    ampHist.push([now, Math.abs(gl.bendImg().amt || 0)]); while (ampHist.length > 40) ampHist.shift();
    if (lite) { // R24g: the warp amount now / the peak of the last movement / the peak since load (the ?perf diagnosis) and of each swipe (the touch block)
      const a = Math.abs(gl.bendImg().amt || 0), mv = Math.abs(vel) > 5 || !!drag;
      diag.now = a; if (a > diag.peakAll) diag.peakAll = a;
      if (mv && now - diag.moving > 1500) diag.peakLast = 0; // a new movement starts
      if (mv) diag.moving = now;
      if (a > diag.peakLast) diag.peakLast = a;
      if (drag || (curSwipe && now - curSwipe.at < 9000)) { if (a > swipePeak) swipePeak = a; if (curSwipe) curSwipe.peak = +swipePeak.toFixed(3); }
    }
  }
  if (morph && now - morph.t0 >= WORK.morphSec * 1000) finishMorph();
};
gsap.ticker.add(tick);
// the pictures that are not near yet are requested a moment after load (one at a time, so a scroll never waits for a first upload)
if (!back) setTimeout(() => items.forEach((it, i) => setTimeout(() => activate(it), i * 15)), 800);
// R31: the way back loads the rest after the transition: one picture per slice while the page is idle, the one nearest to the view centre along the strip first
const idleLoad = () => {
  pm('back:idle-load-start');
  const step = () => {
    const left = items.filter((it) => !it.active);
    if (!left.length) { pm('back:idle-load-end'); return; }
    if (TC.on || TP.q >= 0 || performance.now() - lastWheel < 150) { setTimeout(step, 60); return; }
    const c = vertical ? H / 2 : W / 2, a = vertical ? py : px;
    let best = left[0], bd = Infinity;
    for (const it of left) { const d = Math.abs(a[it.idx] - c); if (d < bd) { bd = d; best = it; } }
    activate(best);
    (window.requestIdleCallback || ((f) => setTimeout(f, 50)))(() => setTimeout(step, 50), { timeout: 250 });
  };
  step();
};

// ---- mode switch
const commit = (mode) => {
  vertical = mode === 'vertical';
  store.set(mode);
  root.dataset.mode = mode;
  if (ui) ui.setMode(mode); else toggleEl.setAttribute('aria-label', vertical ? 'Switch to side scroll' : 'Switch to vertical scroll');
  if (glOn) gl.setAxis(vertical ? 0 : 1);
};
function finishMorph() {
  const m = morph;
  morph = null;
  if (typeof WORK.focusAfterMorph === 'number') focusHoldUntil = performance.now() + WORK.focusAfterMorph * 1000;
  commit(m.to);
  ui?.settleRoll();
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
    ui?.rollMode(mode, WORK.morphSec); // R33d: the info blocks roll out now and in at modeRollInAt of the morph
    lenis.stop(); // wheel and drag are ignored while the move plays
    root.classList.add('is-morphing');
  } else {
    ui?.rollMode(mode, 0.2);
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
if (!tall) initNav(data.hero.wordmark, lenis, { gateFrame: false, position: () => (wmScrolled ? 1e9 : 0), startBig: !!back && !back.leave.wm }); // (the tall wordmark is created early, next to the DOM: R24h)
// R28: the way back. The overlay (#pxb, painted by the inline script in work/index.html) covers the page with the project's header at the scroll it was
// left at; the strip is built in that mode with the project centred and at rest, its cards and neighbours pushed; when the header file is decoded
// and the textures are up, the enlarge plays in reverse (project-transition.js playBack). Input finishes it at once.
if (back) {
  off = back.projectIndex * cur().pitch; // S = off while the wheel has not moved
  wmScrolled = true; holdFocus(); arrivalHold = true;
  const shrink = !!document.querySelector('#pxb .px__box');
  TP.q = back.projectIndex; TP.p = shrink && !clearMode() ? TRANSITION.pushScale : 0;
  gsap.set(fadeEls, { opacity: 0 });
  loadGate = true;
  (async () => {
    const hi = new Image(); hi.src = back.src;
    await new Promise((r) => requestAnimationFrame(r)); // one tick: px / py / bw / bh are laid out
    const m = TRANSITION.clearMargin * scale, show = items.filter((it) => { const i = it.idx, hw = bw[i] * 0.58, hh = bh[i] * 0.58; return !(px[i] + hw < -m || px[i] - hw > W + m || py[i] + hh < -m || py[i] - hh > H + m); }); // R31: the pictures that show at rest (the rule prepareClear uses to pick the cards that move)
    show.forEach(activate);
    const until = (fn, ms) => new Promise((res) => { const t0 = performance.now(); const f = () => (fn() || performance.now() - t0 > ms ? res() : requestAnimationFrame(f)); f(); });
    await Promise.all([Promise.race([hi.decode().catch(() => {}), until(() => false, 1200)]), until(() => !gl || show.every((it) => gl.has(it.idx)), 1200)]);
    pm('back:textures');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const fi = items.findIndex((it) => it.kind === 'frame' && it.proj === back.projectIndex);
    if (shrink && clearMode()) { TC.u = 0; prepareClear(back.projectIndex); TC.u = 1; } // everything starts off screen
    pm('back:shrink-start');
    playBack({ rec: back, target: { x: px[fi] - bw[fi] / 2, y: py[fi] - bh[fi] / 2, w: bw[fi], h: bh[fi] }, fade: fadeEls, onPush: (p, u) => { if (TC.on) TC.u = u; else TP.p = p * TRANSITION.pushScale; }, done: () => { TP.q = -1; TP.p = 0; TC.on = false; TC.u = 0; gsap.set(fadeEls, { clearProps: 'opacity' }); loadGate = false; idleLoad(); } });
  })();
}
document.title = 'Work | Anh V';
if (import.meta.env.DEV) {
  window.__SMEAR = WORK_SMEAR; window.__LINE = WORK_LINE; window.__V2 = WORK_V2; window.__TEXT = WORK_TEXT; window.__PTRCFG = WORK_PTR; window.__SCROLL = SCROLL; window.__WORK = WORK; window.__TRANSITION = TRANSITION; window.__TALL = TALL; window.__guard = guard; window.__bendP = bendP;
  window.__work = { ui, get ptr() { return ptrFx; }, get hz() { return hzA; }, setOff: (v) => { off = v; }, get off() { return off; }, get S() { return S; }, get virt() { return virt; }, get mode() { return vertical ? 'vertical' : 'side'; }, lenis, setMode, relayout, items, LAY, projCards, gl: () => gl, get morph() { return morph; }, q: Q, PS,  get snap() { return snap; }, AMB, LEAD, get drag() { return drag; }, get inertia() { return inertia; }, fP, fSc, fPu, get kCount() { return kCount; }, bx, by, bw, bh, vis, hp };
  if (params.has('tune')) import('./work/tune.js').then((m) => m.mountWorkTune({ relayout }));
  if (params.has('overlap')) import('./effects/overlap-debug.js').then((m) => m.mountOverlapDebug('.work__card', () => `focus ${Math.max(...fSc.x).toFixed(2)}${AMB.on ? ', ambient drift on' : ''}${LEAD.moving ? ', lead moving' : ''}${morph ? ', toggle morph' : ''}${TC.on ? ', transition' : ''}${drag ? ', drag' : ''}`));
}
