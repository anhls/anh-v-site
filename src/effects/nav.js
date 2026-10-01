import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { NAV, SPRING } from '../timeline.js';
import { springLayer, springFromBounce } from './springs.js';
import { capW, capH } from '../scale.js';
import { frameState } from '../sections/hero.js';

// Nav + AV wordmark. Measured on the live site at 1920x1080 (see docs/HANDOFF.md, docs/framer-extract/motion-spec.md).
// Two states: BIG (wordmark bottom-left, links spread out) and SMALL (wordmark top-left, links grouped right).
// A spring (SPRING.nav) chases one number, p = 0 (big) .. 1 (small); every transform is interpolated from p.
// SMALL when the scroll TARGET is at least NAV.thresholdPx down; BIG again at the top, and BIG again whenever the
// footer is in view (the big "^ V" at the bottom is this wordmark coming back).
// Transforms only: the wordmark is a fixed base box (CSS: 81.875vw wide, top-left origin) that is translated and
// scaled; the links sit at left 0 and are translated on x. Positions are in vw of the 1920 reference.
const ASPECT = 1572 / 345; // wordmark width / height
const BASE_W = 81.875;     // base box width in vw (the bottom-left start state, 1572px)
const WORDMARK = {
  big: { x: 0 },
  small: { x: 3.125, y: 3.241, width: 8.802 }, // x in capped vw, y in capped vh, width in capped vw (169px wide, x 60, y 35; above 1920x1080: the whole small logo stays 169 x 37px)
};
const LINKS = {
  About: [25.8, 75.2],
  Works: [81.0, 79.3],
  Contact: [92.1, 83.3],
};
const ROLL = 18; // px; each link label exists twice, stacked 18px apart

// `lenis` is optional: with it, the switch follows Lenis's target position, so the wordmark reacts the moment
// the user scrolls toward/away from the top instead of waiting for the smooth-scroll glide to finish.
export function initNav(wordmarkSrc, lenis) {
  const img = document.createElement('img');
  img.className = 'wordmark';
  img.src = wordmarkSrc;
  img.alt = 'Anh V';
  document.body.append(img);

  const links = [...document.querySelectorAll('.nav a')];

  // Measurements cached once and on resize (nothing is read per frame).
  let W = window.innerWidth;
  let H = window.innerHeight;
  let CW = capW(); // the capped width/height (src/scale.js): small-state x, y and height stop growing past 1920x1080
  let CH = capH();
  const vw = (n) => (n / 100) * W;
  const cw = (n) => (n / 100) * CW;
  const ch = (n) => (n / 100) * CH;

  const state = { p: 0 }; // target: 0 = big, 1 = small
  const apply = (v) => {
    const p = v.p;
    const bigY = H - vw(BASE_W) / ASPECT; // flush with the bottom
    gsap.set(img, {
      x: vw(WORDMARK.big.x) + (cw(WORDMARK.small.x) - vw(WORDMARK.big.x)) * p,
      y: bigY + (ch(WORDMARK.small.y) - bigY) * p,
      scale: 1 + (cw(WORDMARK.small.width) / vw(BASE_W) - 1) * p, // ONE uniform scale: the logo never squashes or stretches
      transformOrigin: '0 0',
    });
    links.forEach((a) => {
      const [big, small] = LINKS[a.dataset.link];
      gsap.set(a, { x: vw(big) + (vw(small) - vw(big)) * p });
    });
  };

  // R16d: the big wordmark comes back only when the footer state is REALLY reached: the footer is in view AND the hero mask has finished
  // growing back to full screen. Before this, the footer trigger (footer top reaching the bottom of the screen, ~520vh) fired while the
  // frame was still small, the cards were still on screen and the More Projects list was still rising through the returning wordmark.
  let footerIn = false;
  let frameFull = false;
  const isFull = () => frameState.w >= window.innerWidth - 0.5 && frameState.h >= window.innerHeight - 0.5;
  const position = () => (lenis ? lenis.targetScroll : window.scrollY);
  const target = () => (!(footerIn && frameFull) && position() >= NAV.thresholdPx ? 1 : 0);

  state.p = target();
  const layer = springLayer({ target: state, springs: { p: SPRING.nav }, apply });

  const check = () => { frameFull = isFull(); state.p = target(); };
  // the mask size is written by the scrubbed hero timeline (a little behind the scroll): watch it on the shared ticker, switch only when it flips
  let lastFull = frameFull;
  gsap.ticker.add(() => { const f = isFull(); if (f !== lastFull) { lastFull = f; check(); } });
  window.addEventListener('scroll', check, { passive: true });
  if (lenis) lenis.on('scroll', check);
  window.addEventListener('resize', () => { W = window.innerWidth; H = window.innerHeight; CW = capW(); CH = capH(); layer.snap(); });

  // Big again while the footer is in view (threshold 0: as soon as any of it shows).
  const footer = document.querySelector('.footer');
  if (footer) {
    ScrollTrigger.create({
      trigger: footer,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { footerIn = self.isActive; check(); },
    });
  }

  // Hover roll: the doubled label slides up 18px on a spring (duration 0.4s, bounce 0.2).
  const rollSpring = springFromBounce(SPRING.linkRoll.duration, SPRING.linkRoll.bounce);
  links.forEach((a) => {
    const roll = a.querySelector('.roll');
    const t = { y: 0 };
    springLayer({ target: t, springs: { y: rollSpring }, apply: (v) => gsap.set(roll, { y: v.y }) });
    a.addEventListener('mouseenter', () => { t.y = -ROLL; });
    a.addEventListener('mouseleave', () => { t.y = 0; });
  });
}
