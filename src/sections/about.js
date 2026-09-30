import { ScrollTrigger } from 'gsap/ScrollTrigger';

// About: 90vh spacer, then a 100vh sticky block (top 0). Words fade 0.2 -> 1 as the section scrolls.
// Reveal runs from START to END of the section's scroll progress, moving forward through the text.
// One ScrollTrigger, one update function for the whole block.
const START = 0.1;
const END = 0.6;
const SOFT = 4; // how many words are mid-fade at once (the soft edge of the wave)
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
          <svg class="about__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
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
    const q = Math.min(1, Math.max(0, (p - START) / (END - START)));
    const head = q * (n + SOFT); // word index the wave has reached
    for (let i = 0; i < n; i++) {
      const o = (MIN_OPACITY + (1 - MIN_OPACITY) * ease((head - i) / SOFT)).toFixed(3);
      if (o !== last[i]) { last[i] = o; els[i].style.opacity = o; }
    }
  };
  update(0);

  // Progress 0 when the section's top reaches the top of the screen (hero pin done),
  // 1 when its bottom reaches the bottom of the screen.
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });
}
