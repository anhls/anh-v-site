import { gsap } from 'gsap';
import { LOADER as L, HOME_FLIGHT as HF } from '../timeline.js';
import data from '../data/data.json';
import { isTall } from '../util/layout-mode.js';
import { mountClock } from '../util/clock.js';
import { transitionPolicy } from './transition-policy.js';

// R49: the loading screen. Two digit columns at the bottom count 00 -> 27 -> 59 -> 77 -> 99 (structure and motion of savoirfaire.nyc, our font / words / colours); the small text at the top is the phone
// menu's (flavour + the Ho Chi Minh City clock). The counting is REAL progress: a step starts only when the loading progress (fonts, the first screen's images, the hero video buffered) has passed
// it AND the previous step's slide has ended, so a fast load is one continuous chain and a slow one waits on a number (no fake creep). After 99 the loader leaves with the Home <-> Work pixel swipe
// (loader-swipe.js) over the playing hero video; reduced motion / ?gl=0 / Save-Data / weak device = digits fade, the end is a fade. All numbers: LOADER in src/settings/desktop.js.
// `urls` = the images the first screen needs; `onReady(...)` is called as soon as the last step may start (everything needed has loaded) so the caller can start the rest.
// `wordmark` = { el, set(p), release() }: the page's own AV wordmark (p 1 = small top-left, 0 = its big place). It is small while loading and grows to big with the swipe (or the fade).
// Returns a promise that resolves once the loader is gone.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const plainFx = () => reduced || new URLSearchParams(location.search).get('gl') === '0' || !!navigator.connection?.saveData || !transitionPolicy().enabled;
const measure = document.createElement('canvas').getContext('2d');

export function runLoader({ urls = [], onReady, wordmark } = {}) {
  const tall = isTall(), root = document.documentElement, flavour = data.menu?.flavour ?? [];
  const slide = !plainFx(), N = L.steps.length, sec = L.stepSec;
  root.classList.add('is-loading', 'loader-wm');
  root.style.setProperty('--l-in-sec', `${L.enter.sec}s`); root.style.setProperty('--l-in-delay', `${L.enter.delaySec}s`); root.style.setProperty('--l-in-blur', `${L.enter.blurPx}px`);

  const el = document.createElement('div');
  el.className = 'loader';
  el.dataset.tall = tall ? '1' : '0';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Loading');
  const colHtml = (k) => `<div class="loader__col">${L.steps.map((s) => `<span class="loader__d">${s[k]}</span>`).join('')}</div>`;
  el.innerHTML = `
    <div class="loader__bg"></div>
    <div class="loader__top">
      <p class="loader__tl">${flavour.map((t) => `<span class="loader__t">${t}</span>`).join('')}</p>
      <address class="loader__tr"><span class="loader__t">HCMC, Vietnam</span><span class="loader__t loader__clock"></span></address>
    </div>
    <div class="loader__veil"></div>
    <div class="loader__counter" aria-hidden="true">${colHtml(0)}${colHtml(1)}</div>`;
  document.body.prepend(el);
  // Keep keyboard and assistive technology on the loading status until the page is visible.
  const focused = document.activeElement;
  const locked = [...document.body.children].filter((n) => n !== el && !['SCRIPT', 'STYLE', 'LINK'].includes(n.tagName) && !n.hasAttribute('inert'));
  locked.forEach((n) => n.setAttribute('inert', ''));
  el.tabIndex = -1; el.focus({ preventScroll: true });
  const loadingKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey) return; e.preventDefault(); e.stopImmediatePropagation(); };
  window.addEventListener('keydown', loadingKey, true);

  const counter = el.querySelector('.loader__counter'), top = el.querySelector('.loader__top');
  const cols = [...el.querySelectorAll('.loader__col')].map((c) => [...c.children]);
  const stopClock = mountClock(el.querySelector('.loader__clock'));
  const video = document.querySelector('.hero__video');

  // ---- layout: sizes come from the font's own ink metrics (cap height of the digits, widest digit), so the numbers in LOADER stay in vw / vh
  const widths = () => { el.style.setProperty('--l-fs-top', `${geo.topPx}px`); return el.querySelector('.loader__tl').offsetWidth + el.querySelector('.loader__tr').offsetWidth + (L.top.groupGapVw / 100) * innerWidth; };
  const geo = { fs: 0, maskW: 0, startX: 0, u: 0, topPx: 0 };
  const layout = () => {
    const W = innerWidth, H = innerHeight, font = `${L.fontWeight} 100px "Clash Display"`;
    measure.font = font;
    const m0 = measure.measureText('0');
    const cap = m0.actualBoundingBoxAscent / 100, fa = m0.fontBoundingBoxAscent / 100, fd = m0.fontBoundingBoxDescent / 100;
    let adv = 0; for (let d = 0; d < 10; d++) adv = Math.max(adv, measure.measureText(String(d)).width / 100);
    const margin = (L.marginVw / 100) * W, gutter = L.tall.gutterPx;
    const fs = tall ? (W - 2 * gutter) / (2 * adv) : Math.min((L.capVw / 100) * W, (L.capMaxVh / 100) * H) / cap;
    const maskW = adv * fs, baseline = ((1 - (fa + fd)) / 2 + fa) * fs; // line-height 1: the baseline's distance from the top of the digit box
    const topPx = Math.min(L.top.maxPx, Math.max(L.top.minPx, (L.top.sizeVw / 100) * W));
    geo.fs = fs; geo.maskW = maskW; geo.topPx = topPx; // (before widths(): it reads topPx)
    geo.startX = tall ? gutter : margin;
    geo.u = tall ? 0 : (W - 2 * margin - 2 * maskW) / (N - 1);
    el.style.setProperty('--l-fs', `${fs}px`);
    el.style.setProperty('--l-w', `${maskW}px`);
    el.style.setProperty('--l-h', `${baseline}px`);
    el.style.setProperty('--l-bottom', `${tall ? L.tall.bottomPx : (L.bottomVw / 100) * W}px`);
    el.style.setProperty('--l-veil', String(L.overlayOpacity));
    el.style.setProperty('--l-weight', String(L.fontWeight));
    // the group: its first-line ink top level with the small wordmark's ink top; wide = centred as one group, tall = stacked with its left edge at the centre
    const wr = wordmark.el.getBoundingClientRect(), inkTop = wr.top + L.top.inkTopOfWmH * wr.height, groupW = tall ? 0 : widths();
    el.style.setProperty('--l-top', `${inkTop - L.top.inkInLine * topPx}px`);
    el.style.setProperty('--l-left', `${tall ? (L.top.tallLeftPct / 100) * W : (W - groupW) / 2}px`);
    el.style.setProperty('--l-fs-top', `${topPx}px`);
    el.style.setProperty('--l-gap', tall ? `${L.top.tallGapEm}em` : `${(L.top.groupGapVw / 100) * W}px`);
    el.style.setProperty('--l-clock-op', String(L.clockOpacity));
  };
  wordmark.set(1);
  layout();
  let step = -1; // the step whose digit is (arriving at) the screen
  const place = () => gsap.set(counter, { x: tall ? geo.startX : geo.startX + geo.u * Math.max(step, 0) });
  place();
  cols.forEach((c) => c.forEach((d) => gsap.set(d, slide ? { xPercent: -100 } : { opacity: 0 })));
  const onResize = () => { layout(); place(); };
  addEventListener('resize', onResize);
  gsap.fromTo(top, { opacity: 0, filter: `blur(${L.top.blurPx}px)` }, { opacity: 1, filter: 'blur(0px)', duration: L.top.inSec, ease: 'power2.out', clearProps: 'filter' });

  // ---- real progress 0..1
  const fontsDone = { v: false };
  const fontsP = Promise.race([document.fonts.load(`${L.fontWeight} 100px "Clash Display"`, '0123456789').catch(() => {}), new Promise((r) => setTimeout(r, 1500))]).then(() => { fontsDone.v = true; layout(); place(); });
  const imgs = { n: 0 };
  urls.forEach((u) => { const i = new Image(); i.onload = i.onerror = () => { imgs.n += 1; }; i.src = u; });
  const videoP = () => {
    if (!video || video.preload === 'none') return 1; // Save-Data: no video is coming
    if (video.readyState < 1) return 0;
    const dur = Number.isFinite(video.duration) ? video.duration : L.videoSecs, need = Math.max(0.1, Math.min(dur, L.videoSecs));
    let end = 0; for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime + 0.1) end = Math.max(end, video.buffered.end(i));
    const frac = Math.min(1, Math.max(0, (end - video.currentTime) / need));
    if (video.readyState < 2) return 0.1;
    return video.readyState >= 3 && frac >= 1 ? 1 : 0.15 + 0.8 * frac;
  };
  const progress = () => {
    const w = L.weights, v = w.fonts * (fontsDone.v ? 1 : 0) + w.images * (urls.length ? imgs.n / urls.length : 1) + w.video * videoP();
    return Math.min(1, v / (w.fonts + w.images + w.video));
  };

  // ---- the step chain
  const t0 = performance.now(), passedAt = Array(N).fill(Infinity);
  let nextAt = Infinity, started = 0, ended = false, swipeP = null;
  fontsP.then(() => { nextAt = performance.now(); });
  const runStep = (i, lag) => {
    const tw = [];
    cols.forEach((c) => {
      if (slide) {
        tw.push(gsap.to(c[i], { xPercent: 0, duration: sec, ease: L.ease }));
        if (i > 0) tw.push(gsap.to(c[i - 1], { xPercent: L.exitX * 100, duration: sec, ease: L.ease }));
      } else {
        tw.push(gsap.to(c[i], { opacity: 1, duration: L.fadeSec, ease: 'power1.inOut' }));
        if (i > 0) tw.push(gsap.to(c[i - 1], { opacity: 0, duration: L.fadeSec, ease: 'power1.inOut' }));
      }
    });
    if (slide && !tall && i > 0) tw.push(gsap.to(counter, { x: geo.startX + geo.u * i, duration: sec, ease: L.ease }));
    tw.forEach((t) => t.time(lag)); // the chain stays on the exact clock: a late frame fast-forwards the new step
    step = i;
  };
  const frame = () => {
    if (ended) return;
    const now = performance.now(), p = progress(), capped = now - t0 >= L.maxMs;
    for (let i = 0; i < N; i++) if (passedAt[i] === Infinity && (capped || (i === N - 1 ? p >= 1 : p >= L.at[i] - 1e-6))) passedAt[i] = now;
    while (started < N) {
      const i = started, startAt = Math.max(nextAt, passedAt[i]);
      if (!(now >= startAt)) break;
      runStep(i, (now - startAt) / 1000);
      nextAt = startAt + sec * 1000;
      started += 1;
      if (i === N - 1) { onReady?.(); if (slide) swipeP?.then((sw) => sw?.prime?.()); } // (phones: the page's pictures for the smear are taken now, ~1 s before the swipe)
    }
    if (started === N && now >= nextAt + L.holdSec * 1000) { ended = true; gsap.ticker.remove(frame); finish(); }
  };
  gsap.ticker.add(frame);
  if (slide) fontsP.then(() => { swipeP = import('./loader-swipe.js').then((m) => m.prepareSwipe()).catch(() => null); }); // WebGL + shader are set up behind the loader, never on the swipe's first frame

  // ---- the ending
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const cleanup = () => { stopClock(); removeEventListener('resize', onResize); window.removeEventListener('keydown', loadingKey, true); locked.forEach((n) => n.removeAttribute('inert')); el.remove(); if (focused?.isConnected) focused.focus({ preventScroll: true }); resolveDone(); };
  // the wordmark is dimmed by the veil while loading; once the veil is gone (the swipe) a mask keeps it dimmed to the right of the swipe front and full to the left of it
  const wmMask = (cut) => {
    const w = wordmark.el, r = w.getBoundingClientRect(), local = cut === null ? null : (cut - r.left) * (w.offsetWidth / r.width);
    const v = local === null ? '' : `linear-gradient(to right, #000 ${local}px, rgba(0,0,0,${1 - L.overlayOpacity}) ${local}px)`;
    w.style.maskImage = v; w.style.webkitMaskImage = v;
  };
  // the swipe is over: the page's entrance (nav / ticker / burger) and, nothing earlier, the wordmark's grow small -> big
  const enterPage = () => {
    wmMask(null);
    root.classList.remove('is-loading', 'loader-wm'); root.classList.add('loader-out');
    setTimeout(() => root.classList.remove('loader-out'), (L.enter.delaySec + L.enter.sec) * 1000 + 200);
    const g = { t: 0 };
    gsap.to(g, { t: 1, duration: L.wmGrowSec, delay: L.wmAfterSwipeDelay, ease: 'none', onUpdate: () => wordmark.set((1 - g.t) ** HF.sizePow), onComplete: () => wordmark.release() }); // the flight's size curve (card -> hero = small -> big)
  };
  const fade = () => {
    gsap.to([...el.children], { opacity: 0, duration: L.endFadeSec, ease: 'power1.out', onComplete: () => { cleanup(); enterPage(); } });
  };
  const finish = async () => {
    const sw = slide && swipeP ? await swipeP : null;
    if (!sw || !video || video.readyState < 2 || !sw.ok()) { sw?.dispose(); fade(); return; }
    if (sw.glide) { // phones / tablets in portrait: the menu's smear (menu-smear.js); the loader's own layers are clipped by its ragged edge
      const W = innerWidth, H = innerHeight, parts = ['.loader__bg', '.loader__top', '.loader__veil', '.loader__counter'].map((q) => { const n = el.querySelector(q), r = n.getBoundingClientRect(); return { n, ox: r.left, oy: r.top }; });
      const ok = await sw.play({ onEdges: (edges, rh) => { // the loader = the part right of the edge; the veil clipped the same way is what lets the wordmark go from dimmed to full
        const side = edges.flatMap((e, r) => [[e, r * rh], [e, (r + 1) * rh]]);
        parts.forEach(({ n, ox, oy }) => { n.style.clipPath = `polygon(${[[W, 0], ...side, [W, H]].map(([x, y]) => `${(x - ox).toFixed(2)}px ${(y - oy).toFixed(2)}px`).join(', ')})`; });
      } });
      if (!ok) { fade(); return; }
      cleanup(); enterPage(); return;
    }
    const snap = snapshot();
    await sw.play({
      snap,
      onFirstFrame: () => { wmMask(0); el.style.visibility = 'hidden'; root.classList.remove('loader-wm'); },
      onProgress: (t, front, cell) => wmMask(Math.min(innerWidth, Math.max(0, Math.ceil(front / cell - 0.5)) * cell)), // the cells whose centre the front has passed have flipped
    });
    cleanup();
    enterPage();
  };

  // the loader's own picture (what is on screen at rest on the last step) drawn into a 2D canvas: the swipe smears it as one layer
  function snapshot() {
    const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2), cs = getComputedStyle(el);
    const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = getComputedStyle(el.querySelector('.loader__bg')).backgroundColor; g.fillRect(0, 0, W, H);
    g.fillStyle = cs.color; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    g.font = `${L.fontWeight} ${geo.fs}px "Clash Display"`;
    el.querySelectorAll('.loader__col').forEach((col, k) => { const r = col.getBoundingClientRect(); g.fillText(String(L.steps[N - 1][k]), r.left + r.width / 2, r.bottom); });
    g.textAlign = 'left';
    g.font = `400 ${geo.topPx}px "Clash Display"`; g.letterSpacing = `${0.02 * geo.topPx}px`;
    const fa = g.measureText('0').fontBoundingBoxAscent;
    el.querySelectorAll('.loader__t').forEach((t) => {
      const rg = document.createRange(); rg.selectNodeContents(t); const r = rg.getBoundingClientRect();
      g.globalAlpha = (t.classList.contains('loader__clock') ? L.clockOpacity : 1) * (1 - L.overlayOpacity); // (the top text sits under the veil)
      g.fillText(t.textContent, r.left, r.top + fa);
    });
    return c;
  }
  return done;
}
