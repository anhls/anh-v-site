import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HERO, TICKER } from '../timeline.js';

// The hero is a background layer for the whole page: absolute, 730vh tall, with a CSS sticky 100vh block
// holding the mask. No GSAP pin: a ScrollTrigger just scrubs the mask/strip timeline over page scroll.
// All ranges (in vh of page scroll) come from src/timeline.js.
export function buildHero(root, hero) {
  const captions = hero.captions
    .map((c) => `<li><span>${c.title}</span><span>${c.client}</span><span>${c.role}</span></li>`)
    .join('');
  // The ticker item is one SVG (dot + "Click Anywhere" baked in), 182px wide at 1920. TICKER.perHalf per half so the loop covers the screen.
  const items = Array.from({ length: TICKER.perHalf }, () => `<img class="ticker__item" src="${hero.ticker}" alt="" />`).join('');

  root.insertAdjacentHTML('afterbegin', `
    <div class="hero" id="hero">
      <div class="hero__pin">
        <div class="hero__wrapper">
          <!-- Strip inside the mask (measured on anh-v.com). Stacking: s1 on top, s3 middle, s2 bottom. Each fills the mask. -->
          <div class="hero__sec hero__s2"><img src="${hero.image}" alt="" /></div>
          <div class="hero__sec hero__s3">
            ${hero.gallery.map((src, i) => `<img class="hero__gallery" style="z-index:${i}" src="${src}" alt="" />`).join('')}
            <div class="hero__overlay2"></div>
            <div class="hero__overlay"></div>
          </div>
          <div class="hero__sec hero__s1">
            <video class="hero__video" src="${hero.video}" autoplay muted loop playsinline preload="auto"></video>
            <div class="ticker" aria-hidden="true"><div class="ticker__track">${items}${items}</div></div>
          </div>
        </div>
      </div>
    </div>
    <ul class="hero__captions">${captions}</ul>`);

  const layer = root.querySelector('.hero');
  const el = {
    wrapper: root.querySelector('.hero__wrapper'),
    s1: root.querySelector('.hero__s1'),
    s2: root.querySelector('.hero__s2'),
    s3: root.querySelector('.hero__s3'),
  };
  const gallery = root.querySelectorAll('.hero__gallery');
  el.gallery1 = gallery[1];
  el.gallery2 = gallery[2];
  const overlays = root.querySelectorAll('.hero__overlay, .hero__overlay2');
  const track = root.querySelector('.ticker__track');
  const vhPx = (n) => () => (window.innerHeight * n) / 100;
  const vhTop = (n) => () => (window.innerHeight * n) / 100; // page-scroll position in px

  // Ticker loops on its own, leftward, at TICKER.speedVwPerSec (one half = perHalf items).
  gsap.to(track, { xPercent: -50, duration: (TICKER.perHalf * TICKER.itemVw) / TICKER.speedVwPerSec, ease: 'none', repeat: -1 });

  // 1vh of page scroll = 0.01s of timeline, so the scrubbed range maps onto the timeline 1:1.
  const [r0, r1] = HERO.range;
  const tl = gsap.timeline({
    defaults: { overwrite: false },
    scrollTrigger: {
      trigger: layer,
      start: vhTop(r0),
      end: vhTop(r1),
      scrub: HERO.scrub,
      invalidateOnRefresh: true,
    },
  });

  // Convert a tween's from/to: `yvh` becomes a resize-safe function-based y.
  const conv = (p) => {
    if (!p) return p;
    const { yvh, ...rest } = p;
    return yvh === undefined ? rest : { ...rest, y: vhPx(yvh) };
  };
  // Ease, optionally starting part-way in (easeFrom 0..1), renormalised so it still runs 0 -> 1.
  const easeOf = (t) => {
    if (!t.ease) return 'none';
    if (!t.easeFrom) return t.ease;
    const base = gsap.parseEase(t.ease);
    const b0 = base(t.easeFrom);
    return (p) => (base(t.easeFrom + p * (1 - t.easeFrom)) - b0) / (1 - b0);
  };
  const add = (target, t) => {
    const pos = t.at[0] / 100;
    const vars = { ...conv(t.to), ease: easeOf(t), duration: (t.at[1] - t.at[0]) / 100 };
    if (t.from) tl.fromTo(target, conv(t.from), vars, pos);
    else tl.to(target, vars, pos);
  };

  HERO.mask.forEach((t) => add(el.wrapper, t));
  HERO.strip.forEach((t) => add(el[t.el], t));
  tl.set({}, {}, r1 / 100); // make the timeline exactly as long as the scrubbed range

  // Overlays darken over their own range, which runs past the mask timeline.
  gsap.fromTo(overlays, { opacity: 0 }, {
    opacity: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: layer,
      start: vhTop(HERO.overlay[0]),
      end: vhTop(HERO.overlay[1]),
      scrub: HERO.scrub,
      invalidateOnRefresh: true,
    },
  });
}
