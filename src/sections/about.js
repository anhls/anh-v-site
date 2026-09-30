import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ABOUT, SECTIONS } from '../timeline.js';
import { bezier } from '../util/bezier.js';
import { capW, scrollPx } from '../scale.js';

// About: 90vh spacer, then a 100vh sticky block (top 0). Words fade 0.2 -> 1 as the page scrolls
// through ABOUT.reveal (vh of page scroll, from src/timeline.js), moving forward through the text.
// One ScrollTrigger, one update function for the whole block.
const SOFT = 1; // how many words are mid-fade at once (the soft edge of the wave); live is ~1 letter
const MIN_OPACITY = 0.2;

const ease = bezier(0.4, 0, 0.2, 1); // the reveal wave eases each word in

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
  const fade = ABOUT.wordFade;
  section.style.setProperty('--about-word-fade', `${fade.duration}s cubic-bezier(${fade.ease.join(',')})`);
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
    start: () => scrollPx(ABOUT.reveal[0]),
    end: () => scrollPx(ABOUT.reveal[1]),
    invalidateOnRefresh: true,
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });

  // Drift: from ABOUT.drift.from the block moves at `speed` x scroll speed, so it lags the page (translateY grows by
  // (1 - speed) per px of scroll). On top of that, `lift` is the early down-and-back nudge live has (vh keys).
  // One function of the scroll position; the px values are cached on load and on refresh.
  const { from, speed, lift } = ABOUT.drift;
  const block = section.querySelector('.about__block');
  let startPx = 0;
  let keys = [];
  const measure = () => { startPx = scrollPx(from); keys = lift.map(([a, b]) => [scrollPx(a), scrollPx(b)]); };
  const liftAt = (s) => {
    for (let i = 1; i < keys.length; i++) {
      if (s < keys[i][0]) return keys[i - 1][1] + ((keys[i][1] - keys[i - 1][1]) * (s - keys[i - 1][0])) / (keys[i][0] - keys[i - 1][0]);
    }
    return keys.length ? keys[keys.length - 1][1] : 0;
  };
  const drift = (s) => gsap.set(block, { y: liftAt(s) + Math.max(0, s - startPx) * (1 - speed) });
  measure();
  drift(window.scrollY);
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => drift(self.scroll()), onRefresh: (self) => { measure(); drift(self.scroll()); } });

  // The ABOUT arrow nudges right and back, forever (x 0 to 30px, 1s, mirrored, 0.5s pause between legs).
  // Paused while the section is off screen so it costs nothing.
  const { xVw, duration, pause, ease: arrowEase } = ABOUT.arrow;
  const xPx = (xVw / 100) * capW(); // 30px above 1920
  const nudge = gsap.to(section.querySelector('.about__icon'), {
    x: xPx,
    duration,
    ease: bezier(...arrowEase),
    repeat: -1,
    yoyo: true,
    repeatDelay: pause,
    paused: true,
  });
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? nudge.play() : nudge.pause()),
  });
}
