import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { NAV, SPRING } from '../timeline.js';
import { springLayer, springFromBounce } from './springs.js';
import { capW, capH } from '../scale.js';
import { frameState } from '../sections/hero.js';
import { backToTop } from './back-to-top.js';

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
// `gateFrame` (home): the footer state also needs the hero mask to be full screen again. Project pages have no mask, so they pass false.
// `position` (Work page): a function giving the distance scrolled (the strip is endless, the page itself never moves).
export function initNav(wordmarkSrc, lenis, { gateFrame = true, position: probe, onHome = false } = {}) {
  // R22j: the wordmark is a link to the homepage (the fixed, transformed box is the <a>; the picture fills it). It takes clicks only in the SMALL
  // state: the big one covers 82vw x 32vh of the hero (captions, cards, the spawner's click area), so it stays click-through; the keyboard
  // reaches it in both. Home: click = the back-to-top transition when scrolled, nothing at the top. Other pages: plain navigation to '/'.
  const img = document.createElement('a');
  img.className = 'wordmark';
  img.href = '/';
  img.setAttribute('aria-label', 'Anh V, home');
  img.innerHTML = `<img src="${wordmarkSrc}" alt="" draggable="false">`;
  document.body.prepend(img); // the logo link comes before the nav in the tab order
  const skip = document.querySelector('.skip'); if (skip) document.body.prepend(skip); // and the skip link before everything
  if (onHome) img.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); backToTop(lenis); });
  let clickable = false, ringScale = 1;
  const ring = () => { img.style.setProperty('--wm-ring', `${2 / ringScale}px`); img.style.setProperty('--wm-ring-off', `${4 / ringScale}px`); }; // the focus ring stays 2 px under the scale
  img.addEventListener('focus', ring);

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
    ringScale = 1 + (cw(WORDMARK.small.width) / vw(BASE_W) - 1) * p;
    gsap.set(img, {
      x: vw(WORDMARK.big.x) + (cw(WORDMARK.small.x) - vw(WORDMARK.big.x)) * p,
      y: bigY + (ch(WORDMARK.small.y) - bigY) * p,
      scale: ringScale, // ONE uniform scale: the logo never squashes or stretches
      transformOrigin: '0 0',
    });
    if ((p > 0.5) !== clickable) { clickable = p > 0.5; img.classList.toggle('is-link', clickable); }
    if (document.activeElement === img) ring();
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
  const isFull = () => !gateFrame || (frameState.w >= window.innerWidth - 0.5 && frameState.h >= window.innerHeight - 0.5);
  const position = () => (lenis ? lenis.targetScroll : window.scrollY);
  // R16h: SMALL follows the scroll TARGET (instant when scrolling down), but BIG at the top only follows the ACTUAL position: with the long
  // Lenis glide the target reaches 0 while the page is still far down, and the big wordmark must not appear over half a cover image.
  const target = () => {
    if (probe) return probe() >= NAV.thresholdPx ? 1 : 0;
    if (footerIn && frameFull) return 0;
    if (position() >= NAV.thresholdPx) return 1;
    return window.scrollY < NAV.thresholdPx ? 0 : 1;
  };

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
    a.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) t.y = -ROLL; }); // R22j: a tap is not a hover
    a.addEventListener('mouseleave', () => { t.y = 0; });
  });
}
