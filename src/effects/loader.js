import { gsap } from 'gsap';
import { LOADER } from '../timeline.js';
import { bezier } from '../util/bezier.js';
import { dist } from '../scale.js';

// Full-screen loader. "Loading visual language": each word rises into place from below its own clipped line
// (staggered), holds while the page loads, then rises out, and the black backdrop collapses upward.
// A "Loading — 39%" label follows the cursor. Progress is real: fonts, hero images and the hero <video>
// already on the page (first frame = loadeddata, capped at LOADER.videoCapMs). Nothing is downloaded twice.
// `urls` = only what is visible on the first screen. The loader never stays longer than LOADER.maxMs.
// `onReady` is called as soon as the loader has what it needs (so the caller can start loading the rest).
// Returns a promise that resolves once the loader is gone. Numbers live in src/timeline.js (LOADER).
export function runLoader(text, urls, onReady) {
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `
    <div class="loader__bg"></div>
    <p class="loader__title">${text.split(' ').map((w) => `<span class="loader__line"><span class="loader__word">${w}</span></span>`).join(' ')}</p>
    <p class="loader__label">Loading — <span>0</span>%</p>`;
  document.body.prepend(el);

  const bg = el.querySelector('.loader__bg');
  const words = [...el.querySelectorAll('.loader__word')];
  const label = el.querySelector('.loader__label');
  const num = label.querySelector('span');
  const { arrive, leave, wipe } = LOADER;
  const curve = bezier(...LOADER.ease); // Framer's overshoot curve: words rise slightly past their spot, then settle
  const started = performance.now();

  // Label follows the cursor (eased). Sits top-left until the mouse moves.
  gsap.set(label, { x: 24, y: 24 });
  const moveX = gsap.quickTo(label, 'x', { duration: 0.5, ease: 'power3' });
  const moveY = gsap.quickTo(label, 'y', { duration: 0.5, ease: 'power3' });
  const onMove = (e) => { moveX(e.clientX + 16); moveY(e.clientY + 16); };
  window.addEventListener('mousemove', onMove);

  // Words rise in.
  const arriving = gsap.fromTo(words, { y: `${arrive.rise}em` }, { y: 0, duration: arrive.duration, stagger: arrive.stagger, ease: curve });

  // Progress.
  const video = document.querySelector('.hero__video');
  const total = urls.length + 2; // + fonts + hero video
  let done = 0;
  const shown = { v: 0 };
  const show = () => { num.textContent = Math.round(shown.v); };
  const tick = () => {
    done += 1;
    gsap.to(shown, { v: Math.round((done / total) * 100), duration: 0.5, ease: 'power2.out', onUpdate: show });
  };
  const once = (start) => new Promise((resolve) => {
    let finished = false;
    const end = () => { if (!finished) { finished = true; tick(); resolve(); } };
    start(end);
  });

  const loadImage = (url) => once((end) => { const img = new Image(); img.onload = img.onerror = end; img.src = url; });
  const loadVideo = () => once((end) => {
    if (!video || video.readyState >= 2 || video.preload === 'none') { end(); return; } // (preload none = Save-Data: no frame is coming)
    video.addEventListener('loadeddata', end, { once: true });
    video.addEventListener('error', end, { once: true });
    setTimeout(end, LOADER.videoCapMs); // never block the site on a slow video
  });
  const fonts = once((end) => { document.fonts.ready.then(end); });

  const minTime = new Promise((r) => setTimeout(r, Math.max(0, LOADER.minMs - (performance.now() - started))));
  const arrived = new Promise((r) => arriving.eventCallback('onComplete', r));

  // Ready = everything visible on the first screen has loaded, or LOADER.maxMs has passed, whichever is first.
  const ready = Promise.all([fonts, loadVideo(), ...urls.map(loadImage)]);
  const capped = new Promise((r) => setTimeout(r, Math.max(0, LOADER.maxMs - (performance.now() - started))));

  return Promise.all([Promise.race([ready, capped]), minTime, arrived])
    .then(() => { if (onReady) onReady(); })
    .then(() => new Promise((r) => gsap.to(shown, { v: 100, duration: 0.3, onUpdate: show, onComplete: r })))
    .then(() => new Promise((resolve) => {
      window.removeEventListener('mousemove', onMove);
      const out = gsap.timeline({ onComplete: () => { el.remove(); resolve(); } });
      out.to(label, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0)
        .to([...words].reverse(), { y: `-${arrive.rise}em`, duration: leave.duration, stagger: leave.stagger, ease: curve }, 0)
        // The backdrop uses the same curve but never overshoots: a scaleY below 0 would flip it open again.
        .to(bg, { scaleY: 0, y: () => -dist(wipe.liftVh), duration: wipe.duration, ease: (t) => Math.min(1, curve(t)) }, wipe.delay);
    }));
}
