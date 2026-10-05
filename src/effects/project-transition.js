import { gsap } from 'gsap';
import { TRANSITION as T } from '../timeline.js';
import { EASES } from '../util/ease.js';
import { imgSet } from '../util/media.js';

// R25: open a project from a main image (Work page) or from the homepage frame without a visible page change.
// A fixed overlay takes the picture's place (same crop), grows to the full screen = the project page's header at scroll 0 (a 100vw x 100vh cover
// image, parallax at its start pose), the rest goes dark; then the page loads and paints the same overlay from its first paint (the inline script in
// work/<slug>.html reads the hand-off from sessionStorage), and project.js removes it once the header's own image is decoded (same file, no swap).
// Not used (plain page load): reduced motion, ?gl=0, direct links, anything that is not a plain left click.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const transitionOK = () => !reduced && new URLSearchParams(location.search).get('gl') !== '0';

const full = new Map(); // slug -> an <img> preloading the header image with the header's own srcset / sizes (so the same file is picked)
export function preloadHeader(slug, ref) {
  if (full.has(slug)) return full.get(slug);
  const { src, srcset } = imgSet(ref);
  const im = new Image();
  im.decoding = 'async';
  if (srcset) { im.sizes = '100vw'; im.srcset = srcset; }
  im.src = src;
  full.set(slug, im);
  return im;
}

// back / forward can restore this page from the cache with the overlay still on it: start clean
addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

let running = false;
// rect = { x, y, w, h } (viewport px) of the picture on screen; startSrc = the file it shows now; crossfade = the start picture is not the header image
// (homepage frame); imgRect = where the start picture's own box is (the homepage still is a little larger than the frame it is clipped by); fade = elements that fade out with the rest (Work counter / toggle); onStart / onEnd for the caller (Lenis stop etc.).
export function runProjectTransition({ slug, ref, rect, imgRect = rect, startSrc, crossfade = false, fade = [], onStart }) {
  if (running) return;
  running = true;
  onStart?.();
  const W = innerWidth, H = innerHeight;
  const hdr = preloadHeader(slug, ref);
  const rel = { x: imgRect.x - rect.x, y: imgRect.y - rect.y, w: imgRect.w, h: imgRect.h }; // the start picture's box in the clip box's coordinates
  const root = document.createElement('div');
  root.className = 'px';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:fixed;inset:0;z-index:8;pointer-events:auto;overflow:hidden';
  root.innerHTML = `<div class="px__bg" style="position:absolute;inset:0;background:#000;opacity:0"></div>
    <div class="px__box" style="position:absolute;overflow:hidden;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px">
      <img class="px__a" alt="" draggable="false" src="${startSrc}" style="position:absolute;left:${rel.x}px;top:${rel.y}px;width:${rel.w}px;height:${rel.h}px;object-fit:cover;display:block">
      <img class="px__b" alt="" draggable="false" style="position:absolute;left:${rel.x}px;top:${rel.y}px;width:${rel.w}px;height:${rel.h}px;object-fit:cover;display:block;opacity:0">
    </div>`;
  document.body.append(root);
  const bg = root.querySelector('.px__bg'), box = root.querySelector('.px__box'), a = root.querySelector('.px__a'), b = root.querySelector('.px__b');
  const headerFile = () => hdr.currentSrc || hdr.src;
  const swapToFull = () => { // the header's own file: the sharpening swap (Work: same picture) or the crossfade target (homepage frame)
    if (!(hdr.complete && hdr.naturalWidth)) return false;
    (crossfade ? b : a).src = headerFile();
    return true;
  };
  let swapped = swapToFull();
  if (!swapped) hdr.addEventListener('load', () => { swapped = swapToFull(); }, { once: true });
  const prog = { p: 0 };
  const ease = EASES.circ;
  const tl = gsap.timeline({ onComplete: () => finish() });
  tl.to(prog, {
    p: 1, duration: T.sec, ease: 'none',
    onUpdate: () => {
      const e = ease(prog.p);
      box.style.left = `${rect.x * (1 - e)}px`; box.style.top = `${rect.y * (1 - e)}px`;
      box.style.width = `${rect.w + (W - rect.w) * e}px`; box.style.height = `${rect.h + (H - rect.h) * e}px`;
      const L = `${rel.x * (1 - e)}px`, Tp = `${rel.y * (1 - e)}px`, Wd = `${rel.w + (W - rel.w) * e}px`, Ht = `${rel.h + (H - rel.h) * e}px`;
      for (const im of [a, b]) { im.style.left = L; im.style.top = Tp; im.style.width = Wd; im.style.height = Ht; }
      if (crossfade) { const q = Math.min(1, Math.max(0, (prog.p - T.crossFrom) / Math.max(T.crossTo - T.crossFrom, 0.01))); const s = q * q * (3 - 2 * q); b.style.opacity = s; a.style.opacity = 1 - s * (b.complete ? 1 : 0); }
    },
  }, 0);
  tl.to(bg, { opacity: 1, duration: T.fadeSec, ease: 'sine.inOut' }, 0);
  if (fade.length) tl.to(fade, { opacity: 0, duration: Math.min(T.fadeSec, 0.3), ease: 'none' }, 0);
  if (import.meta.env.DEV) { window.__pxTl = tl; if (window.__pxFreeze) tl.pause(); } // dev checks: freeze at the first frame
  const finish = () => {
    try { sessionStorage.setItem('pxt', JSON.stringify({ slug, src: headerFile(), t: Date.now(), wm: document.querySelector('a.wordmark')?.classList.contains('is-link') ? 1 : 0 })); } catch { /* private window: the page just loads */ }
    if (import.meta.env.DEV && window.__pxHold) { window.__pxGo = () => { location.href = `/work/${slug}.html`; }; return; } // dev checks: hold the last overlay frame
    location.href = `/work/${slug}.html`;
  };
}

// Homepage: a click on the centre frame while the project index is pinned opens the project the index title shows (the frame has its own still for
// each project, so the still crossfades into the header image while it grows). Read-only on the frame: it only measures its box and its images.
// A click on the active title link inside the frame's box does the same; outside the box (the title text can reach past it) the link is a plain load.
export function initFrameOpen({ hero, projects, lenis }) {
  const wrapper = document.querySelector('.hero__wrapper');
  const headerRef = (slug) => projects.find((p) => p.slug === slug)?.page?.blocks.find((b) => b.t === 'hero')?.img;
  document.addEventListener('click', (e) => {
    if (!transitionOK() || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
    const band = document.querySelector('.index__band.is-active');
    if (!band || (e.target.closest('a, button') && e.target.closest('a') !== band)) return;
    const sticky = band.closest('.index__sticky').getBoundingClientRect();
    if (!(sticky.top <= 1 && sticky.bottom >= innerHeight - 1)) return;
    const r = wrapper.getBoundingClientRect();
    if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) return;
    const slug = (band.getAttribute('href').match(/work\/([^/.]+)\.html/) || [])[1], ref = slug && headerRef(slug);
    const row = [...document.querySelectorAll('.index__band')].indexOf(band), still = hero.frame.gallery[hero.frame.gallery.length - 1 - row];
    if (!ref || !still) return;
    e.preventDefault(); e.stopPropagation();
    const ir = still.getBoundingClientRect(), index = document.querySelector('.index');
    runProjectTransition({
      slug, ref, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, imgRect: { x: ir.left, y: ir.top, w: ir.width, h: ir.height }, startSrc: still.currentSrc || still.src, crossfade: true,
      fade: [index], onStart: () => { lenis.stop(); index.style.zIndex = '9'; }, // the project title stays above the growing picture and fades with the rest
    });
  }, true);
}
