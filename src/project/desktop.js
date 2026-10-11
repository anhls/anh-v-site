// Desktop blocks and the existing Work hand-off. The latter is safe on direct/tall
// entries too: without #pxt / a Work record it is inert, preserving the old dispatch.
import { gsap } from 'gsap';
import { buildProjectPage } from '../sections/project-page.js';

export const buildDesktopProject = buildProjectPage;
export function createDesktopNav() {
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
    .map(([n, h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
  document.body.prepend(nav);
  return nav;
}

export function finishProjectHandoff({app, slug, nav}) {
  // R25: the hand-off overlay (inline script in the page) goes once the header's own picture is decoded: same file, same crop, so nothing changes on screen
  const ov = document.getElementById('pxt');
  if (ov) {
    const hi = app.querySelector('.pj__hero img');
    const drop = () => { ov.remove(); };
    const ready = hi && (hi.complete && hi.naturalWidth ? hi.decode().catch(() => {}) : new Promise((r) => { hi.addEventListener('load', () => hi.decode().then(r, r), { once: true }); hi.addEventListener('error', r, { once: true }); }));
    Promise.all([ready || Promise.resolve(), window.__pxtFlightDone || Promise.resolve()])
      .then(() => requestAnimationFrame(() => requestAnimationFrame(drop)));
  }

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
  nav?.querySelector('a[data-link="Works"]')?.addEventListener('click', (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('gl') === '0') return;
    let r = null; try { r = JSON.parse(sessionStorage.getItem('pxb') || 'null'); } catch { /* */ }
    if (!r || r.slug !== slug || r.origin !== 'work') return;
    e.preventDefault();
    location.href = '/work/';
  });
}
