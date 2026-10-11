// R42: a project page built INSIDE the Work page's document (same-document navigation, see src/effects/page-swap.js).
// Same builders and styles as the static work/<slug>.html pages (src/project.js): buildProjectPage / buildProjectPageTall, the footer, the nav + wordmark.
// Differences from project.js: the page is built hidden (fixed, clipped, visibility:hidden) while the transition flight plays, then made the document's
// flow (show()), and everything it added is removed again by destroy() (listeners, observers, Lenis, tickers, ScrollTriggers, springs, videos, DOM).
// This module is a lazy chunk: the Work page loads it on idle, so the Work page's first load is not slower; its CSS comes with it.
import '../styles/project.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from '../data/data.json';
import { SCROLL } from '../timeline.js';
import { installScrollGain } from '../util/scroll-gain.js';
import { initNav } from '../effects/nav.js';
import { buildFooter } from '../sections/footer.js';
import { createDesktopNav, buildDesktopProject } from './desktop.js';
import { buildProjectPageTall } from '../sections/project-page-tall.js';

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
  let primed = false, disposeBlocks = null, disposeFooter = null, nav = null, navApi = null, realLenis = null, tick = null, gain = null, shown = false, dead = false;

  const api = {
    el, project,
    built: false,
    build() {
      if (api.built) return api;
      api.built = true;
      const prevTitle = document.title;
      document.title = project.page.title; // (the hero's alt text reads it)
      document.body.append(el);
      disposeBlocks = tall ? buildProjectPageTall(el, project.page, lenis) : buildDesktopProject(el, project.page, lenis);
      disposeFooter = buildFooter(el, data.footer, lenis);
      // the header's own picture decoded before the overlay may go (the static page waits for the same)
      api.heroEl = el.querySelector('.pj__hero, .tp-hero');
      api.heroImg = api.heroEl?.querySelector('img') || null;
      document.title = prevTitle; // the tab title changes when the page is shown, not when it is built ahead
      return api;
    },
    // the one-off style + layout pass of the whole page, paid on idle (before any click) instead of in the landing frame
    prime() {
      if (shown || dead || primed) return;
      primed = true;
      el.style.display = 'block'; el.style.visibility = 'hidden';
      void el.offsetHeight;
    },
    headerReady() {
      const hi = api.heroImg;
      if (!hi) return Promise.resolve();
      if (hi.complete && hi.naturalWidth) return hi.decode().catch(() => {});
      return new Promise((r) => { hi.addEventListener('load', () => hi.decode().then(r, r), { once: true }); hi.addEventListener('error', r, { once: true }); });
    },
    // the Work page is paused and detached from the flow by now: this page becomes the document
    show({ wmSmall }) {
      if (shown || dead) return;
      shown = true;
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
      if (!tall) {
        nav = createDesktopNav();
        const works = nav.querySelector('a[data-link="Works"]');
        works?.addEventListener('click', (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onBack?.(); });
      }
      navApi = initNav(data.hero.wordmark, lenis, tall ? { gateFrame: false, startSmall: wmSmall, small: { x: 5, y: 3.4, width: 28 } } : { gateFrame: false, startSmall: wmSmall });
      ScrollTrigger.refresh();
      window.dispatchEvent(new Event('resize')); // the builders' fades / parallax / scrollers re-measure in the live flow
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
    headerSrc: () => api.heroImg?.currentSrc || api.heroImg?.src || '',
    hide() { el.style.visibility = 'hidden'; },
    destroy() {
      if (dead) return;
      dead = true;
      offs.splice(0).forEach((f) => f());
      disposeBlocks?.(); disposeFooter?.();
      navApi?.destroy(); nav?.remove();
      if (tick) gsap.ticker.remove(tick);
      gain?.destroy();
      handlers.splice(0);
      real = null;
      realLenis?.destroy();
      el.remove();
      document.documentElement.classList.remove('pj-open');
      document.title = saved.title;
      saved.meta.forEach(([node, attr, v]) => node.setAttribute(attr, v));
    },
  };
  return api;
}
