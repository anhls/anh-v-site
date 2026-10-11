import './styles/base.css';
import './styles/project.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from './data/data.json';
import { SCROLL } from './timeline.js';
import { installScrollGain } from './util/scroll-gain.js';
import { initNav } from './effects/nav.js';
import { buildFooter } from './sections/footer.js';
import { buildProjectPage } from './sections/project-page.js';
import { isTall } from './util/layout-mode.js';

// Project pages: Lenis smooth scroll (same settings as home), the shared nav + wordmark, and the blocks from data.json (projects[].page).
// No scroll-linked GSAP here: the text fade is one CSS variable per block, videos play only while on screen.
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true }); // R24a: the mobile address bar must not refresh every trigger
const slug = document.body.dataset.project;
const project = data.projects.find((p) => p.slug === slug);
const tall = isTall(); // R24a: the TALL mode (phones, tablet portrait): one column, a burger menu, no R25 hand-off, no desktop scroll effects

if (project?.page) {
  const lenis = new Lenis({ duration: SCROLL.duration, easing: SCROLL.easing });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  if (import.meta.env.DEV) { window.__lenis = lenis; } // dev only: tools/scratch checks
  installScrollGain(lenis);

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
    .map(([n, h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
  if (!tall) document.body.prepend(nav); else import('./effects/tall-menu.js').then((m) => m.mountTallMenu());
  const app = document.getElementById('app');
  if (tall) (await import('./sections/project-page-tall.js')).buildProjectPageTall(app, project.page, lenis); else buildProjectPage(app, project.page, lenis);
  buildFooter(app, data.footer, lenis); // same footer + back-to-top as home
  initNav(data.hero.wordmark, lenis, tall ? { gateFrame: false, small: { x: 5, y: 3.4, width: 28 } } : { gateFrame: false, startSmall: !!window.__pxt?.wm }); // after the footer exists: the big wordmark returns when it is reached
  document.getElementById('pxt-wordmark')?.remove();
  ScrollTrigger.refresh();
  // R25: the hand-off overlay (inline script in the page) goes once the header's own picture is decoded: same file, same crop, so nothing changes on screen
  const ov = document.getElementById('pxt');
  if (ov) {
    const hi = app.querySelector('.pj__hero img');
    const drop = () => { ov.remove(); };
    const ready = hi && (hi.complete && hi.naturalWidth ? hi.decode().catch(() => {}) : new Promise((r) => { hi.addEventListener('load', () => hi.decode().then(r, r), { once: true }); hi.addEventListener('error', r, { once: true }); }));
    if (window.__pxtFlightDone) {
      Promise.all([ready || Promise.resolve(), window.__pxtFlightDone]).then(() => requestAnimationFrame(() => requestAnimationFrame(drop)));
    } else {
      (ready || Promise.resolve()).then(() => requestAnimationFrame(() => requestAnimationFrame(drop)));
      setTimeout(drop, 6000);
    }
  }
  document.title = project.page.title;
  // R28: leaving: remember where the header was (for the way back to the Work page) ...
  addEventListener('pagehide', () => {
    try {
      const r = JSON.parse(sessionStorage.getItem('pxb') || 'null');
      if (!r || r.slug !== slug || r.origin !== 'work') return;
      const sec = app.querySelector('.pj__hero'), im = sec?.querySelector('img');
      if (!sec || !im) return;
      const a = sec.getBoundingClientRect(), b = im.getBoundingClientRect();
      r.leave = { W: innerWidth, H: innerHeight, scroll: Math.round(scrollY), mode: a.bottom > 8 && a.top < innerHeight ? 'shrink' : 'fade', sec: [a.left, a.top, a.width, a.height], img: [b.left, b.top, b.width, b.height], wm: document.querySelector('a.wordmark')?.classList.contains('is-link') ? 1 : 0 };
      r.t = Date.now();
      sessionStorage.setItem('pxb', JSON.stringify(r));
    } catch { /* the Work page then loads plainly */ }
  });
  // ... and the nav Work link fades to black for 0.25 s first (Back cannot be delayed: the Work page does the whole animation on arrival)
  nav.querySelector('a[data-link="Works"]')?.addEventListener('click', (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('gl') === '0') return;
    let r = null; try { r = JSON.parse(sessionStorage.getItem('pxb') || 'null'); } catch { /* */ }
    if (!r || r.slug !== slug || r.origin !== 'work') return;
    e.preventDefault();
    const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;z-index:8;background:var(--bg);opacity:0;pointer-events:auto'; document.body.append(f);
    gsap.to(f, { opacity: 1, duration: 0.25, ease: 'sine.inOut', onComplete: () => { location.href = '/work/'; } });
  });
  // Dev only: ?tune opens the wheel-acceleration panel (a build-time constant, nothing ships).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('tune')) import('./effects/tune-scroll.js').then((m) => m.mountScrollTune());
}
