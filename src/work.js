import './styles/base.css';
import './styles/work.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import data from './data/data.json';
import pool from './data/work-pool.json';
import { WORK, BEND, WARP, CARDS, CARD_HOVER } from './timeline.js';
import { capW } from './scale.js';
import { initNav } from './effects/nav.js';
import { createCardsGL } from './effects/cards-gl.js';
import { imgAttrs } from './util/media.js';
import { buildProjectCards, placeCards } from './work/cards.js';

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
    <div class="work__count" aria-live="polite">01 / 0${N}</div>
    <div class="work__toggle" role="group" aria-label="Scroll direction">
      <button type="button" data-mode="side">Side</button><button type="button" data-mode="vertical">Vertical</button>
    </div>
  </div>`;
const root = app.querySelector('.work');
const stage = root.querySelector('.work__stage');
const countEl = root.querySelector('.work__count');

// ---- items: the N frames first, then every project's cards (the same objects in both layouts)
const projCards = buildProjectCards(pool, slugs);
const items = [];
projects.forEach((p, i) => items.push({ kind: 'frame', proj: i, slug: p.slug, z: 0, mouse: 0, dark: false, ref: heroRef(p) }));
projCards.forEach((list, i) => list.forEach((c, j) => items.push({ kind: 'card', proj: i, j, slug: c.slug, z: c.z, mouse: c.mouse, dark: c.dark, src: c.src, card: c })));
const n = items.length;
items.forEach((it, i) => {
  const a = document.createElement('a');
  a.className = `work__item work__${it.kind}`;
  a.href = `/work/${it.slug}.html`;
  a.style.zIndex = String(it.kind === 'frame' ? 1 : 2 + it.z);
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
const layouts = () => {
  W = innerWidth; H = innerHeight; scale = capW() / 1920;
  const fw = (WORK.frameW * W) / 100, fh = (WORK.frameH * H) / 100;
  for (const mode of ['side', 'vertical']) {
    const v = mode === 'vertical';
    const M = { vertical: v, alongF: v ? fh : fw, crossF: v ? fw : fh, scale, gap: v ? (WORK.gapVert * H) / 100 : (WORK.gapSide * W) / 100, gapPx: (WORK.dupGap * (v ? H : W)) / 100, viewAlong: v ? H : W, viewCross: v ? W : H };
    const pitch = M.alongF + M.gap;
    const placed = placeCards(projCards, M);
    const pos = items.map((it) => {
      if (it.kind === 'frame') return { along: it.proj * pitch, cross: 0, alongSize: M.alongF, crossSize: M.crossF };
      const p = placed[it.proj][it.j];
      return { along: it.proj * pitch + p.along, cross: p.cross, alongSize: p.alongSize, crossSize: p.crossSize };
    });
    LAY[mode] = { M, pitch, period: N * pitch, pos };
  }
  items.forEach((it, i) => {
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
const fine = matchMedia('(pointer: fine)').matches && !reduced;
let gl = null;
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
let off = 0; // strip position S = Lenis value * wheel + off (changes on a mode switch / resize so the same project stays centred)
let S = 0, prevS = 0;
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

const ease = (u) => { const q = Math.max(WORK.morphEase, 1); return u < 0.5 ? 0.5 * (2 * u) ** q : 1 - 0.5 * (2 * (1 - u)) ** q; };
let morph = null; // { from, to, SA, SB, t0, delay[] }
const counterRect = { x: 0, y: 0, w: 0, h: 0 };
let counterHidden = false;
let lastIdx = -1;
let lastDirty = 0;

const tick = (_time, deltaMs) => {
  const dt = Math.min(deltaMs, 50) / 1000;
  const now = performance.now();
  S = lenis.animatedScroll * WORK.wheel + off;
  let vel = (S - prevS) / Math.max(dt, 1e-3);
  prevS = S;
  if (Math.abs(vel) > 20000 || morph) vel = 0;
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
    const sc = 1 + (CARD_HOVER.scale - 1) * hp[i];
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

  // the counter must not sit over a card: it fades out while one overlaps it
  let hit = false;
  for (let i = N; i < n && !hit; i++) {
    if (!vis[i]) continue;
    if (Math.abs(bx[i] - counterRect.x) < bw[i] / 2 + counterRect.w / 2 && Math.abs(by[i] - counterRect.y) < bh[i] / 2 + counterRect.h / 2) hit = true;
  }
  if (hit !== counterHidden) { counterHidden = hit; countEl.classList.toggle('is-hidden', hit); }
  const idx = ((Math.round((morph ? sB : S) / (morph ? LB : L).pitch) % N) + N) % N;
  if (idx !== lastIdx) { lastIdx = idx; countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`; }

  if (glOn) {
    if (morph) { const b = gl.bend(); b.x = 0; b.v = 0; } // the warp is held flat while the layouts morph
    const moving = Math.abs(vel) > 0.5 || hoverMoving || !!morph || Math.abs(mouse.tx - mouse.x) > 0.0005 || Math.abs(mouse.ty - mouse.y) > 0.0005;
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
const measureCounter = () => { const r = countEl.getBoundingClientRect(); counterRect.x = r.left + r.width / 2; counterRect.y = r.top + r.height / 2; counterRect.w = r.width + 24; counterRect.h = r.height + 16; };
const commit = (mode) => {
  vertical = mode === 'vertical';
  store.set(mode);
  root.dataset.mode = mode;
  root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (glOn) gl.setAxis(vertical ? 0 : 1);
};
function finishMorph() {
  const m = morph;
  morph = null;
  commit(m.to);
  off = m.SB - lenis.animatedScroll * WORK.wheel;
  lenis.start();
  prevS = m.SB;
  root.classList.remove('is-morphing');
}
let fading = false;
const setMode = (mode) => {
  if (morph || fading || (mode === 'vertical') === vertical) return;
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
      stage.classList.remove('is-switching');
      fading = false;
    }, 200);
  }
};
root.querySelector('.work__toggle').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });

let rt = 0;
const relayout = () => {
  const f = S / cur().pitch;
  layouts();
  off += f * cur().pitch - S;
  if (glOn) gl.resize(W, H);
  measureCounter();
};
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(relayout, 120); });

commit(vertical ? 'vertical' : 'side');
measureCounter();
initNav(data.hero.wordmark, lenis, { gateFrame: false, position: () => Math.abs(lenis.animatedScroll) });
document.title = 'Work | Anh V';
if (import.meta.env.DEV) {
  window.__work = { setOff: (v) => { off = v; }, get off() { return off; }, get S() { return S; }, get mode() { return vertical ? 'vertical' : 'side'; }, lenis, setMode, relayout, items, LAY, projCards, gl: () => gl, get morph() { return morph; }, bx, by, bw, bh, vis, hp };
  if (params.has('tune')) import('./work/tune.js').then((m) => m.mountWorkTune({ relayout }));
}
