import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ABOUT, SECTIONS } from '../timeline.js';

// About: 90vh spacer, then a 100vh sticky block (top 0). Words fade 0.2 -> 1 as the page scrolls
// through ABOUT.reveal (vh of page scroll, from src/timeline.js), moving forward through the text.
// One ScrollTrigger, one update function for the whole block.
const SOFT = 1; // how many words are mid-fade at once (the soft edge of the wave); live is ~1 letter
const MIN_OPACITY = 0.2;

// cubic-bezier(0.4, 0, 0.2, 1) as a function of x -> y (Newton + bisection).
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
const ease = bezier(0.4, 0, 0.2, 1);

export function buildAbout(root, about) {
  const words = about.text.trim().split(/\s+/);
  const html = words.map((w) => `<span class="about__word">${w}</span>`).join(' ');

  root.insertAdjacentHTML('beforeend', `
    <section class="about" id="2section">
      <div class="about__spacer"></div>
      <div class="about__sticky">
        <div class="about__block">
          <!-- Phosphor "arrow-right" (regular), MIT licence --><svg class="about__icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>
          <span class="about__label">${about.label}</span>
          <p class="about__text">${html}</p>
        </div>
      </div>
    </section>`);

  const section = root.querySelector('.about');
  const els = [...section.querySelectorAll('.about__word')];
  const n = els.length;
  const last = new Array(n).fill(-1);

  const update = (p) => {
    const head = Math.min(1, Math.max(0, p)) * (n + SOFT); // word index the wave has reached
    for (let i = 0; i < n; i++) {
      const o = (MIN_OPACITY + (1 - MIN_OPACITY) * ease((head - i) / SOFT)).toFixed(3);
      if (o !== last[i]) { last[i] = o; els[i].style.opacity = o; }
    }
  };
  update(0);

  section.style.height = `${SECTIONS.about[1] - SECTIONS.about[0]}vh`;
  ScrollTrigger.create({
    start: () => (window.innerHeight * ABOUT.reveal[0]) / 100,
    end: () => (window.innerHeight * ABOUT.reveal[1]) / 100,
    invalidateOnRefresh: true,
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });

  // Drift: from ABOUT.drift.from the block moves at `speed` x scroll speed, so it lags the page.
  // Written as a scrubbed translateY that grows by (1 - speed) per px of scroll, until the end of the page.
  const { from, speed } = ABOUT.drift;
  const startPx = () => (window.innerHeight * from) / 100;
  gsap.to(section.querySelector('.about__block'), {
    y: () => (ScrollTrigger.maxScroll(window) - startPx()) * (1 - speed),
    ease: 'none',
    scrollTrigger: { start: startPx, end: 'max', scrub: true, invalidateOnRefresh: true },
  });
}
