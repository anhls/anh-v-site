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
import { buildProjectCards, placeCards, balanceDark } from './work/cards.js';

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
const nearArr = new Uint8Array(n); // item within 0.8 of a view length of the centre along the strip: its picture is requested at once; the rest follow when idle (below)
const activate = (it) => { if (it.active) return; it.active = true; const d = it.img.dataset; if (d.srcset) it.img.srcset = d.srcset; it.img.src = d.src; };
let gl = null; // the card canvas (created below)
let fine = false;
const layouts = () => {
  W = innerWidth; H = innerHeight; scale = capW() / 1920;
  const fw = (WORK.frameW * W) / 100, fh = (WORK.frameH * H) / 100;
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
const bendP = { ...BEND };
const warpP = { ...WARP };
const syncWarp = () => {
  warpP.strengthUp = warpP.strengthDown = WORK.warpStrength;
  bendP.riseSpeed = 7 / Math.max(WORK.warpRiseSec, 0.02);
  bendP.settleSpeed = 7 / Math.max(WORK.warpSettleSec, 0.02);
};
syncWarp();
fine = matchMedia('(pointer: fine)').matches && !reduced;
let glOn = false;
{
  const fallback = () => { glOn = false; root.classList.remove('work--gl'); gl?.destroy?.(); gl = null; };
  gl = createCardsGL({ section: root, els: items.map((it) => it.img), cards: items, bx, by, bw, bh, onLost: fallback, bend: bendP, warp: warpP, near: (i) => items[i].active === true });
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
const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
if (fine) addEventListener('pointermove', (e) => { mouse.tx = (e.clientX - W / 2) / (W / 2); mouse.ty = (e.clientY - H / 2) / (H / 2); }, { passive: true });
let hov = -1;
const hp = new Float64Array(n), hv = new Float64Array(n); // hover progress (critically damped spring, as the homepage cards)
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
const circ = (t) => (t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2);
const relIdx = (d) => { const h = Math.floor(N / 2); return ((((d + h) % N) + N) % N) - h; };
const fP = new Float64Array(N);
let snap = null; // { from, to, t0 }
let lastWheel = performance.now();
const cancelSnap = () => { snap = null; lastWheel = performance.now(); };
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
    t.chars.forEach((c, i) => { const cp = Math.min(1, Math.max(0, f * (1 + stag) - (stag * i) / nC)); const e = cp * cp * (3 - 2 * cp); c.style.transform = `translate3d(0,${((1 - e) * travel).toFixed(2)}px,0)`; });
  });
};

const tick = (_time, deltaMs) => {
  const dt = Math.min(deltaMs, 50) / 1000;
  const now = performance.now();
  advance();
  S = virt * WORK.wheel + off;
  // the warp follows the wheel / Lenis motion only (not the snap drift, not offsets from a toggle or a resize)
  let vel = ((virt - prevVirt) * WORK.wheel) / Math.max(dt, 1e-3);
  prevVirt = virt;
  if (Math.abs(vel) > 20000 || morph) vel = 0;
  const snapOk = glOn && !reduced && !morph;
  if (snapOk) {
    if (snap) {
      const t = Math.min(1, (now - snap.t0) / 1000 / Math.max(WORK.snapSec, 0.05));
      const target = snap.from + (snap.to - snap.from) * circ(t);
      off += target - S; S = target;
      if (t >= 1) snap = null;
    } else if (now - lastWheel > WORK.snapDelay * 1000 && Math.abs(vel) < 250) {
      // the wheel has been quiet and Lenis' glide is nearly over: where the glide will end (S + what is left of it) picks the project
      const pt = cur().pitch, pred = S + (lenis.targetScroll - lenis.animatedScroll) * WORK.wheel, k = Math.round(pred / pt), d = k * pt - pred;
      if (Math.abs(d) <= WORK.snapWindow * pt && Math.abs(k * pt - S) > 0.5) snap = { from: S, to: k * pt, t0: now };
    }
  } else snap = null;
  prevS = S;
  // focus progress per project
  let focusMoving = false;
  {
    const pt = cur().pitch, k = Math.round(S / pt), win = Math.max(WORK.snapWindow, 0.05);
    const c = Math.max(0, 1 - Math.abs(S - k * pt) / (win * pt)), pk = ((k % N) + N) % N;
    const rate = dt / Math.max(WORK.focusRampSec, 0.02);
    for (let q = 0; q < N; q++) {
      const tgt = snapOk && q === pk ? circ(c) : 0;
      const nv = fP[q] + Math.max(-rate, Math.min(rate, tgt - fP[q]));
      if (nv !== fP[q]) { fP[q] = nv; focusMoving = true; }
    }
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

  // positions
  const L = cur();
  const LA = morph ? LAY[morph.from] : L;
  const LB = morph ? LAY[morph.to] : L;
  const sA = morph ? morph.SA : S;
  const sB = morph ? morph.SB : S;
  const dur = Math.max(WORK.morphSec - WORK.morphStagger, 0.05);
  let anyF = false;
  for (let q = 0; q < N; q++) if (fP[q] > 0) anyF = true;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    let x, y, shown;
    if (morph) {
      const u = Math.min(1, Math.max(0, ((now - morph.t0) / 1000 - morph.delay[i]) / dur));
      const e = ease(u);
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
    // mouse drift (cards only; the homepage "away from the pointer" drift, scaled by depth); none while the layouts morph
    let dx = 0, dy = 0;
    if (it.kind === 'card' && fine && !morph) {
      const d = (20 + (it.mouse - 20) * CARDS.depthRange) * CARDS.mouseStrength * scale;
      dx = -mouse.x * d; dy = -mouse.y * d;
    }
    if (nearArr[i] && !it.active) activate(it);
    // focus: the centred project's image grows and its cards move out with it (plus the push); its neighbours move away along the strip
    let fs = 1;
    if (focusMoving || anyF) {
      const pj = it.proj;
      let da = 0, dc = 0;
      const fo = fP[pj];
      if (fo > 0) {
        if (it.kind === 'frame') fs = 1 + (WORK.focusScale - 1) * fo;
        else {
          const ra = L.pos[i].along - pj * L.pitch, rc = L.pos[i].cross, r = Math.hypot(ra, rc) || 1, g = (WORK.focusScale - 1) * fo, ps = WORK.focusPush * scale * fo;
          da += ra * g + (ps * ra) / r; dc += rc * g + (ps * rc) / r;
        }
      }
      for (let q = 0; q < N; q++) if (fP[q] > 0) { const rr = relIdx(pj - q); if (rr === 1 || rr === -1) da += rr * WORK.focusNeighbour * L.pitch * fP[q]; }
      if (da || dc) { if (L.M.vertical) { x += dc; y += da; } else { x += da; y += dc; } }
    }
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
  if (morph) { const e0 = ease(Math.min(1, Math.max(0, (now - morph.t0) / 1000 / Math.max(WORK.morphSec - WORK.morphStagger, 0.05)))); const a0 = morph.from === 'vertical' ? 90 : 0, a1 = morph.to === 'vertical' ? 90 : 0; setAngle(a0 + (a1 - a0) * e0); } else setAngle(vertical ? 90 : 0);
  // the counter: the unwrapped nearest project, with hysteresis (another project must be clearly nearer before it changes)
  const pitchNow = (morph ? LB : L).pitch;
  const pos = (morph ? sB : S) / pitchNow;
  if (morph || Math.abs(pos - kCount) > 0.58) kCount = Math.round(pos);
  const idx = ((kCount % N) + N) % N;
  if (idx !== lastIdx) { lastIdx = idx; countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`; }

  if (glOn) {
    if (morph) { const b = gl.bend(); b.x = 0; b.v = 0; } // the warp is held flat while the layouts morph
    const moving = Math.abs(vel) > 0.5 || hoverMoving || !!morph || focusMoving || !!snap || Math.abs(mouse.tx - mouse.x) > 0.0005 || Math.abs(mouse.ty - mouse.y) > 0.0005;
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
  snap = null;
  const L0 = cur();
  const kProj = Math.round(S / L0.pitch);
  if (glOn) {
    morph = { from: vertical ? 'vertical' : 'side', to: mode, SA: S, SB: kProj * LAY[mode].pitch, t0: performance.now(), delay: items.map((it, i) => (it.kind === 'frame' ? 0 : WORK.morphStagger * (0.35 + 0.65 * (((i * 2654435761) >>> 0) / 4294967296)))) };
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
initNav(data.hero.wordmark, lenis, { gateFrame: false, position: () => Math.abs(virt) });
document.title = 'Work | Anh V';
if (import.meta.env.DEV) {
  window.__SCROLL = SCROLL; window.__WORK = WORK;
  window.__work = { setOff: (v) => { off = v; }, get off() { return off; }, get S() { return S; }, get virt() { return virt; }, get mode() { return vertical ? 'vertical' : 'side'; }, lenis, setMode, relayout, items, LAY, projCards, gl: () => gl, get morph() { return morph; }, get snap() { return snap; }, fP, get kCount() { return kCount; }, bx, by, bw, bh, vis, hp };
  if (params.has('tune')) import('./work/tune.js').then((m) => m.mountWorkTune({ relayout }));
}
