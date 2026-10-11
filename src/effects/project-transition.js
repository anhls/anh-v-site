import { createBulge, pillowBump } from './bulge-gl.js';
import { withOvershoot } from '../util/overshoot.js';
import { gsap } from 'gsap';
import { TRANSITION as T } from '../timeline.js';
import { EASES, heldCubic } from '../util/ease.js';
import { imgSet } from '../util/media.js';
import { pm } from '../util/perf-mark.js';
import { isTall } from '../util/layout-mode.js';
import { TALL } from '../timeline.js';

// R25: open a project from a main image (Work page) or from the homepage frame without a visible page change.
// A fixed overlay takes the picture's place (same crop), grows to the full screen = the project page's header at scroll 0 (a 100vw x 100vh cover
// image, parallax at its start pose), the rest goes dark; then the page loads and paints the same overlay from its first paint (the inline script in
// work/<slug>.html reads the hand-off from sessionStorage), and project.js removes it once the header's own image is decoded (same file, no swap).
// Not used (plain page load): reduced motion, ?gl=0, direct links, anything that is not a plain left click.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const transitionOK = () => !reduced && new URLSearchParams(location.search).get('gl') !== '0' && (!isTall() || TALL.transition); // R24a: off in tall mode (a plain page load)

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
// (homepage frame); onPush(p) = the push-away progress 0..1 (Work page: work.js moves the cards); fromWork = { mode, projectIndex } for the way back; imgRect = where the start picture's own box is (the homepage still is a little larger than the frame it is clipped by); fade = elements that fade out with the rest (Work counter / toggle); onStart / onEnd for the caller (Lenis stop etc.).
export function runProjectTransition({ slug, ref, rect, imgRect = rect, startSrc, startImage, crossfade = false, fade = [], onStart, onPush, fromWork }) {
  if (running) return;
  running = true;
  onStart?.();
  const W = innerWidth, H = innerHeight;
  const hdr = preloadHeader(slug, ref);
  const sec = fromWork ? T.workSec : T.sec, pushSec = fromWork ? T.workPushSec : T.pushSec;
  const rel = { x: imgRect.x - rect.x, y: imgRect.y - rect.y, w: imgRect.w, h: imgRect.h }; // the start picture's box in the clip box's coordinates
  const root = document.createElement('div');
  root.className = 'px';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:fixed;inset:0;z-index:8;pointer-events:auto;overflow:hidden';
  root.innerHTML = `<div class="px__bg" style="position:absolute;inset:0;background:var(--bg);opacity:0"></div>
    <div class="px__box" style="position:absolute;overflow:hidden;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px">
      <img class="px__a" alt="" draggable="false" src="${startSrc}" style="position:absolute;left:${rel.x}px;top:${rel.y}px;width:${rel.w}px;height:${rel.h}px;object-fit:cover;display:block">
      <img class="px__b" alt="" draggable="false" style="position:absolute;left:${rel.x}px;top:${rel.y}px;width:${rel.w}px;height:${rel.h}px;object-fit:cover;display:block;opacity:0">
    </div>`;
  document.body.append(root);
  const bg = root.querySelector('.px__bg'), box = root.querySelector('.px__box'), a = root.querySelector('.px__a'), b = root.querySelector('.px__b');
  let bulge = fromWork && !isTall() ? createBulge(root, box, startImage) : null;
  bulge?.draw(rect);
  const headerFile = () => hdr.currentSrc || hdr.src;
  const swapToFull = () => { // the header's own file: the sharpening swap (Work: same picture) or the crossfade target (homepage frame)
    if (!(hdr.complete && hdr.naturalWidth)) return false;
    (crossfade ? b : a).src = headerFile();
    bulge?.setTexture(hdr);
    return true;
  };
  let swapped = swapToFull();
  const headerReady = () => { swapped = swapToFull(); };
  if (!swapped) hdr.addEventListener('load', headerReady, { once: true });
  const prog = { p: 0 };
  const ease = fromWork ? EASES.cubic : EASES.circ;
  const moveEase = fromWork ? withOvershoot(heldCubic(T.workLandAt), T.bulgeOvershoot, T.bulgeWindow) : ease;
  const tl = gsap.timeline({ onComplete: () => finish() });
  tl.to(prog, {
    p: 1, duration: sec, ease: 'none',
    onUpdate: () => {
      const e = moveEase(prog.p);
      box.style.left = `${rect.x * (1 - e)}px`; box.style.top = `${rect.y * (1 - e)}px`;
      box.style.width = `${rect.w + (W - rect.w) * e}px`; box.style.height = `${rect.h + (H - rect.h) * e}px`;
      const L = `${rel.x * (1 - e)}px`, Tp = `${rel.y * (1 - e)}px`, Wd = `${rel.w + (W - rel.w) * e}px`, Ht = `${rel.h + (H - rel.h) * e}px`;
      for (const im of [a, b]) { im.style.left = L; im.style.top = Tp; im.style.width = Wd; im.style.height = Ht; }
      bulge?.draw({ x: rect.x * (1 - e), y: rect.y * (1 - e), w: rect.w + (W - rect.w) * e, h: rect.h + (H - rect.h) * e }, undefined, pillowBump(prog.p), (prog.p - (1 - T.bulgeHandoff)) / T.bulgeHandoff);
      if (onPush) { const u = Math.min(1, (prog.p * sec) / Math.max(pushSec, 0.01)); onPush(ease(u), u); }
      if (crossfade) { const q = Math.min(1, Math.max(0, (prog.p - T.crossFrom) / Math.max(T.crossTo - T.crossFrom, 0.01))); const s = q * q * (3 - 2 * q); b.style.opacity = s; a.style.opacity = 1 - s * (b.complete ? 1 : 0); }
    },
  }, 0);
  const bgMax = fromWork ? T.blackMax : 1; // R30: on the Work page path the clearing push does the job, the black layer only goes as far as blackMax
  if (bgMax > 0) tl.to(bg, { opacity: bgMax, duration: T.fadeSec, ease: 'sine.inOut' }, 0);
  if (fade.length) tl.to(fade, { opacity: 0, duration: Math.min(T.fadeSec, 0.3), ease: 'none' }, 0);
  if (import.meta.env.DEV) { window.__pxTl = tl; if (window.__pxFreeze) tl.pause(); } // dev checks: freeze at the first frame
  const finish = () => {
    hdr.removeEventListener('load', headerReady);
    bulge?.dispose(); bulge = null;
    pm('fwd:end');
    try { sessionStorage.setItem('pxt', JSON.stringify({ slug, src: headerFile(), t: Date.now(), wm: document.querySelector('a.wordmark')?.classList.contains('is-link') ? 1 : 0 })); } catch { /* private window: the page just loads */ }
    if (fromWork) { try { sessionStorage.setItem('pxb', JSON.stringify({ slug, src: headerFile(), origin: 'work', blackMax: T.blackMax, mode: fromWork.mode, projectIndex: fromWork.projectIndex, t: Date.now() })); } catch { /* plain load on the way back */ } } else { try { sessionStorage.removeItem('pxb'); } catch { /* */ } }
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

// ---- R28: the way back (project page -> Work page) -----------------------------------------------------------------------------------------
// The project page stores where its header was when it was left (project.js, pagehide); the Work page's inline script paints the overlay from that
// record in its first frame (#pxb: black layer + the header file in its box at that scroll) and work.js plays the enlarge IN REVERSE on arrival:
// the box shrinks to the centred image's exact box, the pushed cards ease back, the black layer fades out, the counter / toggle / name fade in.
// A time reversal of the forward timeline (same TRANSITION numbers): the push is back at 0 over the last pushSec, the black goes in the last fadeSec.
export function readBack() {
  try {
    const r = JSON.parse(sessionStorage.getItem('pxb') || 'null');
    if (!r || r.origin !== 'work' || !r.leave || Date.now() - r.t > 60000) return null;
    return r;
  } catch { return null; }
}
export function clearBack() { try { sessionStorage.removeItem('pxb'); } catch { /* */ } }

// rec = the record; target = the centred image's box { x, y, w, h }; onPush(p) per frame; fade = elements that fade in; done() when finished
export function playBack({ rec, target, onPush, fade = [], done }) {
  const root = document.getElementById('pxb');
  const L = rec.leave, W = innerWidth, H = innerHeight;
  let bulge = null, cleanup = () => {};
  const finish = () => { cleanup(); bulge?.dispose(); root?.remove(); clearBack(); pm('back:swap'); done?.(); };
  if (!root) { finish(); return null; }
  if (!root.querySelector('.px__box')) { // the header had scrolled out: nothing to match, the black fades out over 0.4 s
    const bgOnly = root.querySelector('.px__bg') || root;
    if (fade.length) gsap.set(fade, { opacity: 1 });
    return gsap.to(bgOnly, { opacity: 0, duration: 0.4, ease: 'sine.inOut', onComplete: finish });
  }
  const box = root.querySelector('.px__box'), im = root.querySelector('img'), bg = root.querySelector('.px__bg');
  const B = { x: L.sec[0], y: L.sec[1], w: L.sec[2], h: L.sec[3] }, BI = { x: L.img[0], y: L.img[1], w: L.img[2], h: L.img[3] };
  const A = target, ease = EASES.cubic, bgMax = rec.blackMax ?? 1;
  const moveEase = withOvershoot(heldCubic(T.workLandAt), T.bulgeOvershoot, T.bulgeWindow);
  if (!isTall()) bulge = createBulge(root, box, im);
  const ready = () => { if (!isTall() && prog.t < 1 && !bulge) bulge = createBulge(root, box, im); };
  im.addEventListener("load", ready, { once: true });
  const lerp = (a, b, e) => a + (b - a) * e;
  const prog = { t: 0 };
  const place = (e) => {
    const bx = lerp(A.x, B.x, e), by = lerp(A.y, B.y, e);
    box.style.left = `${bx}px`; box.style.top = `${by}px`; box.style.width = `${lerp(A.w, B.w, e)}px`; box.style.height = `${lerp(A.h, B.h, e)}px`;
    const ix = lerp(A.x - A.x, BI.x - B.x, e), iy = lerp(0, BI.y - B.y, e);
    im.style.left = `${ix}px`; im.style.top = `${iy}px`; im.style.width = `${lerp(A.w, BI.w, e)}px`; im.style.height = `${lerp(A.h, BI.h, e)}px`;
    bulge?.draw({ x: bx, y: by, w: lerp(A.w, B.w, e), h: lerp(A.h, B.h, e) }, { x: bx + ix, y: by + iy, w: lerp(A.w, BI.w, e), h: lerp(A.h, BI.h, e) }, pillowBump(1 - prog.t), (prog.t - (1 - T.bulgeHandoff)) / T.bulgeHandoff, true);
  };
  let flyMarked = false;
  const tl = gsap.timeline({ onComplete: () => { onPush?.(0, 0); pm('back:shrink-end'); tailEnd(); } });
  tl.to(prog, {
    t: 1, duration: T.workSec, ease: 'none',
    onUpdate: () => {
      const u = 1 - prog.t; // forward progress
      place(moveEase(u));
      { const up = Math.min(1, (u * T.workSec) / Math.max(T.workPushSec, 0.01)); if (up < 1 && !flyMarked) { flyMarked = true; pm('back:fly-start'); } onPush?.(ease(up), up); }
      bg.style.opacity = bgMax * sineIO(Math.min(1, (u * T.workSec) / Math.max(T.fadeSec, 0.01))); // the forward black layer, time-reversed
    },
  }, 0);
  if (fade.length) { gsap.set(fade, { opacity: 0 }); tl.to(fade, { opacity: 1, duration: Math.min(T.fadeSec, 0.3), ease: 'none' }, T.workSec - Math.min(T.fadeSec, 0.3)); }
  // the overlay goes only once the canvas has drawn the image in that box: two frames after the last step
  const tailEnd = () => requestAnimationFrame(() => requestAnimationFrame(() => { if (import.meta.env.DEV && window.__pxBackHold) { window.__pxBackGo = finish; return; } finish(); }));
  const stop = () => { if (tl.progress() < 1) tl.progress(1); };
  cleanup = () => { im.removeEventListener('load', ready); for (const ev of ['wheel', 'keydown', 'pointerdown', 'touchstart']) removeEventListener(ev, stop, true); };
  for (const ev of ['wheel', 'keydown', 'pointerdown', 'touchstart']) addEventListener(ev, stop, { capture: true, once: true, passive: true });
  if (import.meta.env.DEV) { window.__pxBackTl = tl; if (window.__pxBackFreeze) tl.pause(); }
  return tl;
}
const sineIO = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
