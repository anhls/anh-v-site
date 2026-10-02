import './styles/base.css';
import './styles/work.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import data from './data/data.json';
import pool from './data/work-pool.json';
import { WORK } from './timeline.js';
import { capW } from './scale.js';
import { initNav } from './effects/nav.js';
import { imgAttrs } from './util/media.js';
import { layoutGaps } from './work/gaps.js';
import { waveAt } from './work/wave.js';
import { createStripGL } from './work/strip-gl.js';

// Work page (R23). A strip of the projects' main images, endless, driven by Lenis (infinite mode: the page itself never moves, its scroll
// value is only read). Between two images a gap holds cards from the two neighbouring projects. One wave (src/work/wave.js) lifts the
// images (bent in the vertex shader) and the cards; a crest also pushes the cards on its side away from the strip edge.
// Two modes: side (strip horizontal, cards above and below) and vertical (a column, cards left and right: the same rules turned 90 degrees).
// Everything per frame is transform writes on cached numbers (no layout reads). Fallbacks (?gl=0, reduced motion, no WebGL2): no wave,
// no push, flat DOM images.
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const noWave = reduced || params.get('gl') === '0';
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
    <canvas class="work__gl"></canvas>
    <div class="work__stage"></div>
    <div class="work__count" aria-live="polite">01 / 0${N}</div>
    <div class="work__toggle" role="group" aria-label="Scroll direction">
      <button type="button" data-mode="side">Side</button><button type="button" data-mode="vertical">Vertical</button>
    </div>
  </div>`;
const root = app.querySelector('.work');
const stage = root.querySelector('.work__stage');
const canvas = root.querySelector('.work__gl');
const countEl = root.querySelector('.work__count');
const frameEls = projects.map((p, i) => {
  const a = document.createElement('a');
  a.className = 'work__frame';
  a.href = `/work/${p.slug}.html`;
  a.setAttribute('aria-label', p.title);
  a.innerHTML = `<img ${imgAttrs(heroRef(p), `${WORK.frameW}vw`)} alt="" draggable="false" decoding="async">`;
  stage.append(a);
  return a;
});

// ---- WebGL (main images)
let gl = null;
if (!noWave) gl = createStripGL(canvas, { onLost: () => { gl = null; frameEls.forEach((a) => a.classList.remove('is-gl')); root.classList.remove('work--gl'); } });
if (gl) {
  root.classList.add('work--gl');
  frameEls.forEach((a, i) => {
    const img = a.querySelector('img');
    const up = () => { gl?.setImage(i, img); if (gl?.has(i)) a.classList.add('is-gl'); };
    if (img.complete && img.naturalWidth) up(); else img.addEventListener('load', up, { once: true });
  });
}

// ---- layout (cached numbers; re-run on resize and on a mode switch)
let W = innerWidth, H = innerHeight, scale = 1, M, G, cardEls = [], cardState = [];
const layout = () => {
  W = innerWidth; H = innerHeight; scale = capW() / 1920;
  const fw = (WORK.frameW * W) / 100, fh = (WORK.frameH * H) / 100;
  M = { vertical, alongF: vertical ? fh : fw, crossF: vertical ? fw : fh, gap: vertical ? (WORK.gapVert * H) / 100 : (WORK.gapSide * W) / 100, fw, fh, viewAlong: vertical ? H : W, viewCross: vertical ? W : H, scale };
  G = layoutGaps(pool, slugs, M);
  frameEls.forEach((a) => { a.style.width = `${fw}px`; a.style.height = `${fh}px`; });
  cardEls.forEach((c) => c.remove());
  cardEls = G.cards.map((c) => {
    const a = document.createElement('a');
    a.className = 'work__card';
    a.href = `/work/${c.slug}.html`;
    a.style.width = `${c.w}px`;
    a.style.height = `${c.h}px`;
    a.innerHTML = `<img ${imgAttrs(c.src, `${Math.round(c.w)}px`)} alt="" loading="lazy" decoding="async" draggable="false">`;
    stage.append(a);
    return a;
  });
  cardState = G.cards.map(() => ({ push: 0, shown: true }));
  if (gl) gl.resize(W, H, Math.min(devicePixelRatio || 1, 2));
  root.dataset.mode = vertical ? 'vertical' : 'side';
  root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.mode === 'vertical') === vertical)));
};
layout();

// ---- loop
let off = 0; // strip position = Lenis value * wheel + off (changes on a mode switch / resize so the same project stays centred)
let S = 0;
const wrap = (v, P) => ((((v + P / 2) % P) + P) % P) - P / 2;
const t0 = performance.now();
let waveNow = { amp: 0, len: 1, phase: 0 };
let lastIdx = -1;
const tick = (_time, deltaMs) => {
  const dt = Math.min(deltaMs, 50) / 1000;
  S = lenis.animatedScroll * WORK.wheel + off;
  const { period, pitch } = G;
  const cA = M.viewAlong / 2, cC = M.viewCross / 2;
  waveNow = noWave ? waveNow : { amp: (WORK.amplitude * H) / 100, len: WORK.wavelength * M.viewAlong, phase: Math.PI * 2 * WORK.drift * ((performance.now() - t0) / 1000) };
  const margin = 40;

  if (gl) gl.begin(W, H, waveNow, vertical, Math.round(WORK.bendSegments));
  for (let i = 0; i < N; i++) {
    const a = cA + wrap(i * pitch - S, period);
    const on = Math.abs(a - cA) < M.viewAlong / 2 + M.alongF / 2 + margin;
    const el = frameEls[i];
    if (!on) { if (el.dataset.on !== '0') { el.style.visibility = 'hidden'; el.dataset.on = '0'; } continue; }
    if (el.dataset.on !== '1') { el.style.visibility = ''; el.dataset.on = '1'; }
    const w = waveAt(a, waveNow);
    const x = vertical ? cC - M.crossF / 2 + w : a - M.alongF / 2;
    const y = vertical ? a - M.alongF / 2 : cC - M.crossF / 2 + w;
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (gl && gl.has(i)) gl.draw(i, vertical ? cC - M.crossF / 2 : a - M.alongF / 2, vertical ? a - M.alongF / 2 : cC - M.crossF / 2, vertical ? M.crossF : M.alongF, vertical ? M.alongF : M.crossF);
  }

  const pushMax = noWave ? 0 : WORK.push * scale;
  const k = 1 - Math.exp(-dt / Math.max(WORK.pushSmooth, 0.001));
  for (let j = 0; j < G.cards.length; j++) {
    const c = G.cards[j];
    const st = cardState[j];
    const a = cA + wrap(c.along - S, period);
    const el = cardEls[j];
    const on = Math.abs(a - cA) < M.viewAlong / 2 + c.alongSize / 2 + margin;
    if (!on) { if (st.shown) { el.style.visibility = 'hidden'; st.shown = false; } continue; }
    if (!st.shown) { el.style.visibility = ''; st.shown = true; st.push = 0; }
    const w = waveAt(a, waveNow);
    // a crest that moves the strip edge towards this card's band pushes the card on, away from the edge, then it eases back
    const crest = waveNow.amp ? Math.max(0, (c.band * w) / waveNow.amp) : 0;
    st.push += (c.band * pushMax * crest - st.push) * k; // away from the centre line = the sign of the band
    const cross = cC + c.cross + w + st.push;
    const x = vertical ? cross - c.w / 2 : a - c.w / 2;
    const y = vertical ? a - c.h / 2 : cross - c.h / 2;
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
  }
  const idx = ((Math.round(S / pitch) % N) + N) % N;
  if (idx !== lastIdx) { lastIdx = idx; countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`; }
};
gsap.ticker.add(tick);

// ---- mode switch (the nearest project stays centred)
let switching = false;
const setMode = (mode) => {
  const v = mode === 'vertical';
  if (v === vertical || switching) return;
  switching = true;
  stage.classList.add('is-switching');
  setTimeout(() => {
    const kProj = Math.round(S / G.pitch);
    vertical = v;
    store.set(mode);
    layout();
    off += kProj * G.pitch - S;
    stage.classList.remove('is-switching');
    switching = false;
  }, 200);
};
root.querySelector('.work__toggle').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });

let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { const f = S / G.pitch; layout(); off += f * G.pitch - S; }, 120);
});

initNav(data.hero.wordmark, lenis, { gateFrame: false, position: () => Math.abs(lenis.animatedScroll) });
document.title = 'Work | Anh V';
if (import.meta.env.DEV) {
  window.__work = { setOff: (v) => { off = v; }, get off() { return off; }, get S() { return S; }, get mode() { return vertical ? 'vertical' : 'side'; }, lenis, setMode, relayout: () => { const f = S / G.pitch; layout(); off += f * G.pitch - S; }, get G() { return G; }, get M() { return M; }, get gl() { return gl; } };
  if (params.has('tune')) import('./work/tune.js').then((m) => m.mountWorkTune({ relayout: window.__work.relayout }));
}
