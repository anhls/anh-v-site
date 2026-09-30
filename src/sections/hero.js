import { gsap } from 'gsap';
import { HERO, SPRING, TICKER } from '../timeline.js';
import { springLayer } from '../effects/springs.js';

// The hero is a background layer for the whole page: absolute, 730vh tall, with a CSS sticky 100vh block
// holding the mask. No GSAP pin. Two scrubbed timelines run over page scroll; all ranges (in vh) and springs
// come from src/timeline.js.
//   tl   (scrub HERO.scrub)  mask size, the direct layers (#1, #2) and the video/ticker details
//   tlS  (scrub true)        targets for the spring-chased layers: #3, the two peels, the mask float, the overlays.
//                            GSAP writes plain numbers into proxy objects; springs.js chases them and writes the DOM.
export function buildHero(root, hero) {
  const captions = hero.captions
    .map((c) => `<li><span>${c.title}</span><span>${c.client}</span><span>${c.role}</span></li>`)
    .join('');
  // The ticker item is one SVG (dot + "Click Anywhere" baked in), 182px wide at 1920. TICKER.perHalf per half so the loop covers the screen.
  const items = Array.from({ length: TICKER.perHalf }, () => `<img class="ticker__item" src="${hero.ticker}" alt="" />`).join('');

  root.insertAdjacentHTML('afterbegin', `
    <div class="hero" id="hero">
      <div class="hero__pin">
        <div class="hero__float"><div class="hero__float2">
          <div class="hero__wrapper">
            <!-- Strip inside the mask (measured on anh-v.com). Stacking: s1 on top, s3 middle, s2 bottom. Each fills the mask. -->
            <div class="hero__sec hero__s2"><img data-src="${hero.image}" alt="" /></div>
            <div class="hero__sec hero__s3">
              ${hero.gallery.map((src, i) => `<img class="hero__gallery" style="z-index:${i}" data-src="${src}" alt="" />`).join('')}
              <div class="hero__overlay2"></div>
              <div class="hero__overlay"></div>
            </div>
            <div class="hero__sec hero__s1">
              <video class="hero__video" src="${hero.video}" autoplay muted loop playsinline preload="auto"></video>
              <div class="ticker" aria-hidden="true"><div class="ticker__clip"><div class="ticker__track">${items}${items}</div></div></div>
            </div>
          </div>
        </div></div>
      </div>
    </div>
    <ul class="hero__captions">${captions}</ul>`);

  const q = (s) => root.querySelector(s);
  const layer = q('.hero');
  const gallery = root.querySelectorAll('.hero__gallery');
  const el = {
    wrapper: q('.hero__wrapper'),
    s1: q('.hero__s1'),
    s2: q('.hero__s2'),
    s3: q('.hero__s3'),
    gallery1: gallery[1],
    gallery2: gallery[2],
    floatOuter: q('.hero__float'),
    floatInner: q('.hero__float2'),
    video: q('.hero__video'),
    ticker: q('.ticker'),
  };
  const overlays = root.querySelectorAll('.hero__overlay, .hero__overlay2');
  const track = q('.ticker__track');
  const vhPx = (n) => () => (window.innerHeight * n) / 100;
  const vhTop = (n) => () => (window.innerHeight * n) / 100; // page-scroll position in px

  // Ticker loops on its own, leftward, at TICKER.speedVwPerSec (one half = perHalf items).
  gsap.to(track, { xPercent: -50, duration: (TICKER.perHalf * TICKER.itemVw) / TICKER.speedVwPerSec, ease: 'none', repeat: -1 });

  // 1vh of page scroll = 0.01s of timeline, so each scrubbed range maps onto its timeline 1:1.
  const [r0, r1] = HERO.range;
  const scrollTrigger = (scrub) => ({ trigger: layer, start: vhTop(r0), end: vhTop(r1), scrub, invalidateOnRefresh: true });
  const tl = gsap.timeline({ defaults: { overwrite: false }, scrollTrigger: scrollTrigger(HERO.scrub) });
  const tlS = gsap.timeline({ defaults: { overwrite: false }, scrollTrigger: scrollTrigger(true) });

  // Convert a tween's from/to: `yvh` becomes a resize-safe function-based y (px).
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
  const add = (timeline, target, t) => {
    const pos = t.at[0] / 100;
    const vars = { ...conv(t.to), ease: easeOf(t), duration: (t.at[1] - t.at[0]) / 100 };
    if (t.from) timeline.fromTo(target, conv(t.from), vars, pos);
    else timeline.to(target, vars, pos);
  };

  // Direct layers.
  HERO.mask.forEach((t) => add(tl, el.wrapper, t));
  HERO.strip.filter((t) => !t.spring).forEach((t) => add(tl, el[t.el], t));
  const d = HERO.details;
  add(tl, el.video, d.video);
  add(tl, el.ticker, d.ticker);
  tl.set({}, {}, r1 / 100); // make the timeline exactly as long as the scrubbed range

  // Spring-chased layers: each gets a proxy target, filled by tlS, and one springLayer that writes the DOM.
  const proxies = {};
  const springOf = {};
  [...HERO.strip, ...HERO.float].filter((t) => t.spring).forEach((t) => {
    if (!proxies[t.el]) { proxies[t.el] = {}; springOf[t.el] = t.spring; }
    // Declare the animated properties up front (y for `yvh`, plus scale) so the spring layer always knows them.
    [t.from, t.to].forEach((p) => {
      if (!p) return;
      if (p.yvh !== undefined && proxies[t.el].y === undefined) proxies[t.el].y = 0;
      if (p.scale !== undefined && proxies[t.el].scale === undefined) proxies[t.el].scale = 1;
    });
    add(tlS, proxies[t.el], t);
  });
  tlS.invalidate(); // evaluate the function-based values now, so the proxies start at their scroll-0 positions
  tlS.set({}, {}, r1 / 100);

  Object.keys(proxies).forEach((name) => {
    const target = proxies[name];
    const cfg = SPRING[springOf[name]];
    const springs = {};
    Object.keys(target).forEach((prop) => { springs[prop] = cfg; });
    // Write the transform directly: gsap.set(img, { y }) trips over <img>'s own read-only `y`, and this is cheaper anyway.
    const node = el[name];
    springLayer({
      target,
      springs,
      apply: (v) => {
        node.style.transform = `translate3d(0, ${v.y ?? 0}px, 0)${v.scale === undefined ? '' : ` scale(${v.scale})`}`;
      },
    });
  });

  // Overlays darken over their own range, which runs past the mask timeline; chased through a spring.
  const ov = { opacity: 0 };
  gsap.fromTo(ov, { opacity: 0 }, {
    opacity: 1,
    ease: 'none',
    scrollTrigger: { trigger: layer, start: vhTop(HERO.overlay.at[0]), end: vhTop(HERO.overlay.at[1]), scrub: true, invalidateOnRefresh: true },
  });
  springLayer({ target: ov, springs: { opacity: SPRING[HERO.overlay.spring] }, apply: (v) => gsap.set(overlays, { opacity: v.opacity }) });

  // Images #2 and #3 are not visible before ~40vh of scroll, so they start loading only after the loader is ready.
  return {
    loadDeferred() {
      root.querySelectorAll('img[data-src]').forEach((img) => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
    },
  };
}
