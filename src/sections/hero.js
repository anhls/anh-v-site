import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HERO, SPRING, TICKER } from '../timeline.js';
import { springLayer } from '../effects/springs.js';
import { dist, scrollPx } from '../scale.js';
import { imgAttrs } from '../util/media.js';

// The hero is a background layer for the whole page: absolute, 730vh tall, with a CSS sticky 100vh block
// holding the mask. No GSAP pin. All ranges and springs come from src/timeline.js.
//   tl        (scrub HERO.scrub)  mask size, the direct layers (#1, #2) and the video/ticker details (vh ranges)
//   driven    spring-chased layers (#3, the two peels, the mask float): their targets are computed straight from the
//             scroll position over px ranges (capped units, see src/scale.js); springs.js chases them and writes the DOM.
//   overlays  their own scrubbed tween, chased through a spring.
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
            <div class="hero__sec hero__s2"><img ${imgAttrs(hero.image, '100vw', true)} alt="" /></div>
            <div class="hero__sec hero__s3">
              ${hero.gallery.map((src, i) => `<img class="hero__gallery" style="z-index:${i}" ${imgAttrs(src, '100vw', true)} alt="" />`).join('')}
              <div class="hero__overlay2"></div>
              <div class="hero__overlay"></div>
            </div>
            <div class="hero__sec hero__s1">
              <video class="hero__video" src="${hero.video}" poster="/media/hero/poster.webp" autoplay muted loop playsinline preload="auto"></video>
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
  const vhTop = (n) => () => (window.innerHeight * n) / 100; // page-scroll position in px

  // Ticker loops on its own, leftward, at TICKER.speedVwPerSec (one half = perHalf items).
  gsap.to(track, { xPercent: -50, duration: (TICKER.perHalf * TICKER.itemVw) / TICKER.speedVwPerSec, ease: 'none', repeat: -1 });

  // 1vh of page scroll = 0.01s of timeline, so each scrubbed range maps onto its timeline 1:1.
  const [r0, r1] = HERO.range;
  const scrollTrigger = (scrub) => ({ trigger: layer, start: vhTop(r0), end: vhTop(r1), scrub, invalidateOnRefresh: true });
  const tl = gsap.timeline({ defaults: { overwrite: false }, scrollTrigger: scrollTrigger(HERO.scrub) });

  // Convert a tween's from/to: `yvh` (a distance, vh at the 1080 reference) becomes a resize-safe function-based y (px).
  const conv = (p) => {
    if (!p) return p;
    const { yvh, ...rest } = p;
    return yvh === undefined ? rest : { ...rest, y: () => dist(yvh) };
  };
  const easeOf = (t) => t.ease || 'none';
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

  // Spring-chased layers. Per layer: its tweens (strip entries plus the float), a target object the springs chase, and
  // px ranges resolved on load and on every refresh. Each property is evaluated from the scroll position: before a
  // tween it holds the start value, inside it moves linearly, after it holds the end value (later tweens start from
  // wherever the earlier ones left off). `yvh` is a capped distance (px = dist(vh)); `scale` goes straight through.
  const driven = {};
  [...HERO.strip.filter((t) => t.spring), ...HERO.float].forEach((t) => {
    const layer = (driven[t.el] ||= { spring: t.spring, tweens: [], props: {}, target: {} });
    layer.tweens.push(t);
    [t.from, t.to].forEach((p) => Object.keys(p || {}).forEach((k) => { layer.props[k === 'yvh' ? 'y' : k] = true; }));
  });
  const valueOf = (layer, prop, scroll) => {
    const key = prop === 'y' ? 'yvh' : prop;
    const segs = layer.tweens.filter((t) => t.to[key] !== undefined);
    let v = segs[0].from?.[key] ?? (prop === 'scale' ? 1 : 0);
    for (const t of segs) {
      const [a, b] = t.px;
      const from = t.from?.[key] ?? v;
      if (scroll >= b) v = t.to[key];
      else { if (scroll > a) v = from + (t.to[key] - from) * ((scroll - a) / (b - a)); break; }
    }
    return prop === 'y' ? dist(v) : v;
  };
  const resolve = () => Object.values(driven).forEach((l) => l.tweens.forEach((t) => { t.px = [scrollPx(t.at[0]), scrollPx(t.at[1])]; }));
  const setTargets = (scroll) => Object.values(driven).forEach((l) => Object.keys(l.props).forEach((k) => { l.target[k] = valueOf(l, k, scroll); }));
  resolve();
  setTargets(window.scrollY);

  Object.keys(driven).forEach((name) => {
    const layer = driven[name];
    const cfg = SPRING[layer.spring];
    const springs = {};
    Object.keys(layer.target).forEach((prop) => { springs[prop] = cfg; });
    // Write the transform directly: gsap.set(img, { y }) trips over <img>'s own read-only `y`, and this is cheaper anyway.
    const node = el[name];
    springLayer({
      target: layer.target,
      springs,
      apply: (v) => {
        node.style.transform = `translate3d(0, ${v.y ?? 0}px, 0)${v.scale === undefined ? '' : ` scale(${v.scale})`}`;
      },
    });
  });
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => setTargets(self.scroll()),
    onRefresh: (self) => { resolve(); setTargets(self.scroll()); },
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
      root.querySelectorAll('img[data-src]').forEach((img) => {
        if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); }
        img.src = img.dataset.src; img.removeAttribute('data-src');
      });
    },
  };
}
