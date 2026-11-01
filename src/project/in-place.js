// R42: a project page built INSIDE the Work page's document (same-document navigation, see src/effects/page-swap.js).
// Same builders and styles as the static work/<slug>.html pages (src/project.js): buildProjectPage / buildProjectPageTall, the footer, the nav + wordmark.
// Differences from project.js: the page is built hidden (fixed, clipped, visibility:hidden) while the transition flight plays, then made the document's
// flow (show()), and everything it added is removed again by destroy() (listeners, observers, Lenis, tickers, ScrollTriggers, springs, videos, DOM).
// This module is a lazy chunk: the Work page loads it on idle, so the Work page's first load is not slower; its CSS comes with it.
import '../styles/project.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { pm } from '../util/perf-mark.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from '../data/data.json';
import { SCROLL } from '../timeline.js';
import { installScrollGain } from '../util/scroll-gain.js';
import { initNav } from '../effects/nav.js';
import { buildFooter } from '../sections/footer.js';
import { createDesktopNav, buildDesktopProject } from './desktop.js';
import { buildProjectPageTall, buildProjectPageTallSteps } from '../sections/project-page-tall.js';

gsap.registerPlugin(ScrollTrigger);
if (document.documentElement.dataset.layout === 'tall') import('../styles/tall-project.css');

const META = ['meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]', 'meta[property="og:image"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]', 'meta[name="twitter:image"]'];
const metaCache = new Map(); // slug -> Promise<{ selector: value } | null>: the static page's head tags (description / canonical / og live there, not in data.json); values only, no Document is kept
const staticHead = (slug) => {
  if (!metaCache.has(slug)) {
    metaCache.set(slug, fetch(`/work/${slug}.html`).then((r) => (r.ok ? r.text() : '')).then((t) => {
      if (!t) return null;
      const doc = new DOMParser().parseFromString(t, 'text/html'), out = {};
      for (const sel of META) { const el = doc.head.querySelector(sel); if (el) out[sel] = el.getAttribute(el.tagName === 'LINK' ? 'href' : 'content'); }
      return out;
    }).catch(() => null));
  }
  return metaCache.get(slug);
};
export const warmHead = staticHead;

export function createProjectView({ slug, tall, onBack }) {
  const project = data.projects.find((p) => p.slug === slug);
  if (!project?.page) return null;
  const offs = [];
  const handlers = []; let real = null;
  // Lenis (the page's smooth scroll) cannot exist while the Work page's own Lenis owns the window, so the builders get this proxy now and the real one at show().
  const lenis = {
    on(ev, fn) { const h = { ev, fn, off: null }; handlers.push(h); if (real) h.off = real.on(ev, fn); return () => { h.off?.(); const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); }; },
    scrollTo: (...a) => real?.scrollTo(...a), stop: () => real?.stop(), start: () => real?.start(),
    get targetScroll() { return real ? real.targetScroll : scrollY; }, get animatedScroll() { return real ? real.animatedScroll : scrollY; },
    get virtualScroll() { return real?.virtualScroll; },
  };
  const el = document.createElement('div');
  el.className = 'pj-root';
  el.setAttribute('tabindex', '-1');
  el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;overflow:hidden;display:none;outline:none'; // (display:none: built ahead on idle, nothing plays or measures until show())
  const saved = { title: document.title, meta: [] }; // (the Work page's title, restored by destroy())
  let gen = null, primeKids = null, primed = false, disposeBlocks = null, disposeFooter = null, nav = null, navApi = null, realLenis = null, tick = null, gain = null, shown = false, dead = false;

  const api = {
    el, project,
    built: false,
    // R41d: the build is two stages (the blocks, then the footer + header refs) so the idle build can run them in separate frames; build() runs whatever is left (a click before the idle build finished)
    buildStage: 0,
    buildStep() {
      if (api.built) return true;
      if (api.buildStage === 0) {
        const prevTitle = document.title;
        document.title = project.page.title; // (the hero's alt text reads it)
        document.body.append(el);
        try {
          if (tall) { gen = buildProjectPageTallSteps(el, project.page, lenis); gen.next(); } else disposeBlocks = buildDesktopProject(el, project.page, lenis);
        } finally { document.title = prevTitle; } // the tab title changes when the page is shown, not when it is built ahead
        api.buildStage = gen ? 1 : 2; return false;
      }
      if (api.buildStage === 1) { const r = gen.next(); if (r.done) { disposeBlocks = r.value; gen = null; api.buildStage = 2; } return false; }
      disposeFooter = buildFooter(el, data.footer, lenis);
      // the header's own picture decoded before the overlay may go (the static page waits for the same)
      api.heroEl = el.querySelector('.pj__hero, .tp-hero');
      api.heroImg = api.heroEl?.querySelector('img') || null;
      api.built = true; api.buildStage = 2;
      return true;
    },
    build() {
      while (!api.built) api.buildStep();
      return api;
    },
    // the one-off style + layout pass of the whole page, paid on idle (before any click) instead of in the landing frame.
    // R41d: sliced: every top-level section starts display:none and is switched on one per call, each forcing only its own layout (86 ms in one go at 6x CPU on the phone strip). primeStep() returns true when done.
    primeLeft: () => !primed && !shown && !dead,
    primeStep() {
      if (shown || dead || primed) return true;
      if (!primeKids) {
        const slices = (n, d = 0) => (n.children.length > 1 && d < 5 ? [...n.children].flatMap((c) => slices(c, d + 1)) : [n]); // (R41e: down to five levels, so one image-heavy section is several slices)
        primeKids = [...el.children].flatMap((n) => slices(n)).map((n) => [n, n.style.display]); // (the tall page is one wrapper with ~30 sections: those are the slices)
        primeKids.forEach(([n]) => { n.style.display = 'none'; });
        return false; // (R41e: its own step; the display:block below is the next one, so neither carries a page-wide style pass with real content)
      }
      if (el.style.display !== "block") { el.style.display = "block"; el.style.visibility = "hidden"; return false; }
      const next = primeKids.shift();
      if (next) { next[0].style.display = next[1]; void next[0].offsetHeight; }
      if (!primeKids.length) { primed = true; primeKids = null; void el.offsetHeight; return true; }
      return false;
    },
    prime() { while (!api.primeStep()) { /* all sections */ } },
    headerReady() {
      const hi = api.heroImg;
      if (!hi) return Promise.resolve();
      if (hi.complete && hi.naturalWidth) return hi.decode().catch(() => {});
      return new Promise((r) => { hi.addEventListener('load', () => hi.decode().then(r, r), { once: true }); hi.addEventListener('error', r, { once: true }); });
    },
    // the Work page is paused and detached from the flow by now: this page becomes the document
    // R41f: async: the landing is three frames (page + Lenis, then the re-measure, then the nav) instead of one 90 ms block under the overlay
    async show({ wmSmall }) {
      if (shown || dead) return;
      shown = true;
      if (primeKids) { primeKids.forEach(([n, d]) => { n.style.display = d; }); primeKids = null; } // (shown while the sliced prime was half done: switch the rest on)
      document.title = project.page.title;
      document.documentElement.classList.add('pj-open');
      el.style.cssText = 'outline:none';
      window.scrollTo(0, 0);
      realLenis = new Lenis({ duration: SCROLL.duration, easing: SCROLL.easing });
      tick = (time) => realLenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gain = installScrollGain(realLenis);
      real = realLenis;
      handlers.forEach((h) => { h.off = real.on(h.ev, h.fn); });
      ScrollTrigger.refresh();
      await new Promise(requestAnimationFrame); if (dead) return;
      window.dispatchEvent(new Event('resize')); // the builders' fades / parallax / scrollers re-measure in the live flow (before the nav exists: its resize handler snaps the wordmark)
      await new Promise(requestAnimationFrame); if (dead) return;
      if (!tall) {
        nav = createDesktopNav();
        const works = nav.querySelector('a[data-link="Works"]');
        works?.addEventListener('click', (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onBack?.(); });
      }
      navApi = initNav(data.hero.wordmark, lenis, tall ? { gateFrame: false, startSmall: wmSmall, small: { x: 5, y: 3.4, width: 28 } } : { gateFrame: false, alwaysSmall: true }); // R45
      ScrollTrigger.refresh(); // (the footer trigger the nav just made)
      try { el.focus({ preventScroll: true }); } catch { /* */ }
      staticHead(slug).then((tags) => {
        if (dead || !tags) return;
        for (const sel of META) {
          const cur = document.head.querySelector(sel);
          if (!cur || tags[sel] === undefined) continue;
          const attr = cur.tagName === 'LINK' ? 'href' : 'content';
          saved.meta.push([cur, attr, cur.getAttribute(attr)]);
          cur.setAttribute(attr, tags[sel]);
        }
      });
    },
    // where the header is now (the record playBack reads; same shape as project/desktop.js writes on pagehide)
    backRecord() {
      const sec = api.heroEl, im = api.heroImg;
      if (!sec || !im) return { W: innerWidth, H: innerHeight, scroll: Math.round(scrollY), mode: 'fade', wm: 0 };
      const a = sec.getBoundingClientRect(), b = im.getBoundingClientRect();
      return { W: innerWidth, H: innerHeight, scroll: Math.round(scrollY), mode: a.bottom > 8 && a.top < innerHeight && a.width > 8 ? 'shrink' : 'fade', sec: [a.left, a.top, a.width, a.height], img: [b.left, b.top, b.width, b.height], wm: 0 };
    },
    // R42c Part C: the page glides to the top (time-based, ends at speed so the shrink that follows is one motion), then done()
    glideTop(done, sec) {
      const y = scrollY;
      if (!real || y <= 1) { done(); return; }
      real.scrollTo(0, { duration: sec, easing: (t) => t * t, lock: true, force: true, onComplete: () => done() });
    },
    headerSrc: () => api.heroImg?.currentSrc || api.heroImg?.src || '',
    hide() { el.style.visibility = 'hidden'; },
    // R41i: destroy(true) = the back landing: only what the strip needs gone NOW (hidden, Lenis, nav, classes, title) is done in this frame; the triggers, the block / footer disposers and the
    // removal of the (large) page DOM follow one per frame, so the landing frame does not pay for tearing the project page down.
    destroy(defer = false) {
      if (dead) return;
      dead = true;
      pm('back:destroy-start');
      el.style.display = 'none';
      navApi?.destroy(); nav?.remove();
      if (tick) gsap.ticker.remove(tick);
      gain?.destroy();
      handlers.splice(0);
      real = null;
      realLenis?.destroy();
      pm('back:destroy-lenis');
      document.documentElement.classList.remove('pj-open');
      document.title = saved.title;
      saved.meta.forEach(([node, attr, v]) => node.setAttribute(attr, v));
      const steps = [() => offs.splice(0).forEach((f) => f()), () => disposeBlocks?.(), () => disposeFooter?.(), () => el.remove()];
      if (!defer) { steps.forEach((f) => f()); pm('back:destroy-end'); return; }
      const next = () => { const f = steps.shift(); if (!f) return; try { f(); } catch { /* */ } pm('back:destroy-step'); requestAnimationFrame(next); };
      requestAnimationFrame(() => requestAnimationFrame(next));
    },
  };
  return api;
}
