import { gsap } from 'gsap';
import { NAV } from '../timeline.js';

// Nav + AV wordmark. Measured on the live site at 1920x1080 (see docs/HANDOFF.md).
// Time-based switch (not scrubbed): fires when scrollY >= NAV.thresholdPx, reverses at scrollY 0.
// Transforms only: the wordmark is a fixed base box (CSS: 81.875vw wide, top-left origin) that is
// translated and scaled; the links sit at left 0 and are translated on x. Positions are in vw of the 1920 reference.
const ASPECT = 1572 / 345; // wordmark width / height
const BASE_W = 81.875;     // base box width in vw (the bottom-left start state, 1572px)
const WORDMARK = {
  start: { x: 0 },
  end: { x: 3.125, y: 3.241, width: 8.802 }, // x in vw, y in vh, width in vw (169px wide, x 60, y 35)
};
const LINKS = {
  About: [25.8, 75.2],
  Works: [81.0, 79.3],
  Contact: [92.1, 83.3],
};
const DURATION = 1.1;
const EASE = 'expo.out';

export function initNav(wordmarkSrc) {
  const img = document.createElement('img');
  img.className = 'wordmark';
  img.src = wordmarkSrc;
  img.alt = 'Anh V';
  document.body.append(img);

  const links = [...document.querySelectorAll('.nav a')];
  const vw = (n) => (n / 100) * window.innerWidth;
  const vh = (n) => (n / 100) * window.innerHeight;

  // Transform targets for each state.
  const wordmarkAt = (isScrolled) => isScrolled
    ? { x: vw(WORDMARK.end.x), y: vh(WORDMARK.end.y), scale: WORDMARK.end.width / BASE_W }
    : { x: vw(WORDMARK.start.x), y: window.innerHeight - vw(BASE_W) / ASPECT, scale: 1 }; // flush with the bottom
  const linkX = (a, isScrolled) => vw(LINKS[a.dataset.link][isScrolled ? 1 : 0]);

  let scrolled = window.scrollY >= NAV.thresholdPx;
  const place = (isScrolled) => {
    gsap.set(img, { ...wordmarkAt(isScrolled), transformOrigin: '0 0' });
    links.forEach((a) => gsap.set(a, { x: linkX(a, isScrolled) }));
  };
  place(scrolled);

  const go = (isScrolled) => {
    scrolled = isScrolled;
    gsap.to(img, { ...wordmarkAt(isScrolled), duration: DURATION, ease: EASE, overwrite: true });
    links.forEach((a) => gsap.to(a, { x: linkX(a, isScrolled), duration: DURATION, ease: EASE, overwrite: true }));
  };

  window.addEventListener('scroll', () => {
    const shouldBeScrolled = window.scrollY >= NAV.thresholdPx;
    if (shouldBeScrolled !== scrolled) go(shouldBeScrolled);
  }, { passive: true });
  window.addEventListener('resize', () => place(scrolled));
}
