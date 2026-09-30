import { gsap } from 'gsap';
import { NAV } from '../timeline.js';

// Nav + AV wordmark. Measured on the live site at 1920x1080 (see docs/HANDOFF.md).
// Time-based switch (not scrubbed): fires when scrollY >= 5, reverses at scrollY 0.
// x positions are in vw of the 1920 reference; the wordmark's vertical start is bottom-flush.
const ASPECT = 1572 / 345; // wordmark width / height
const WORDMARK = {
  start: { left: 0, width: 81.875 },                // 1572px wide, x 0
  end: { left: 3.125, top: 3.241, width: 8.802 },   // 169px wide, x 60, y 35 (top in vh)
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
  const startTop = () => window.innerHeight - (WORDMARK.start.width / 100 * window.innerWidth) / ASPECT; // px, flush with the bottom

  let scrolled = window.scrollY >= NAV.thresholdPx;
  const place = (isScrolled) => {
    gsap.set(img, isScrolled
      ? { left: WORDMARK.end.left + 'vw', top: WORDMARK.end.top + 'vh', width: WORDMARK.end.width + 'vw' }
      : { left: WORDMARK.start.left + 'vw', top: startTop(), width: WORDMARK.start.width + 'vw' });
    links.forEach((a) => gsap.set(a, { left: LINKS[a.dataset.link][isScrolled ? 1 : 0] + 'vw' }));
  };
  place(scrolled);

  const go = (isScrolled) => {
    scrolled = isScrolled;
    gsap.to(img, {
      left: (isScrolled ? WORDMARK.end.left : WORDMARK.start.left) + 'vw',
      top: isScrolled ? WORDMARK.end.top + 'vh' : startTop(),
      width: (isScrolled ? WORDMARK.end.width : WORDMARK.start.width) + 'vw',
      duration: DURATION,
      ease: EASE,
      overwrite: true,
    });
    links.forEach((a) => gsap.to(a, { left: LINKS[a.dataset.link][isScrolled ? 1 : 0] + 'vw', duration: DURATION, ease: EASE, overwrite: true }));
  };

  window.addEventListener('scroll', () => {
    const shouldBeScrolled = window.scrollY >= NAV.thresholdPx;
    if (shouldBeScrolled !== scrolled) go(shouldBeScrolled);
  }, { passive: true });
  window.addEventListener('resize', () => place(scrolled));
}

