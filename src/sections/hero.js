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
// The frame (the masked image in the middle of the screen), kept up to date from the hero's own animation so other effects
// (the Selected Work aura, R13e) can read it without touching the DOM: w, h = current size in px (from the mask tween's inline
// style), fo, fi = the two float offsets in px (spring values). The frame is centred on the screen horizontally and sits at
// innerHeight / 2 + fo + fi vertically.
export const frameState = { w: 0, h: 0, fo: 0, fi: 0 };
// R16c: everything the frame canvas (effects/frame-gl.js) needs to redraw the frame without reading the DOM: the transforms of the
// strip layers (y px, scale), the two image peels, the overlay opacity, the video / ticker opacity and the ticker track offset.
// Spring-driven values are written by their `apply`; the scrubbed (direct) ones are read from gsap's own cache by readFrameLayers().
export const frameLayers = {
  s1: { y: 0, scale: 1 }, s2: { y: 0, scale: 1 }, s3: { y: 0, scale: 1 },
  g1y: 0, g2y: 0, ov: 0, video: 1, ticker: { opacity: 1, y: 0 }, trackPct: 0,
};
const unitPx = (s, full, vw, vh) => { const v = parseFloat(s); return s.endsWith('vw') ? (v * vw) / 100 : s.endsWith('vh') ? (v * vh) / 100 : s.endsWith('%') ? (v * full) / 100 : v; };

export function buildHero(root, hero) {
  const captions = hero.captions
    .map((c) => `<li><a href="/work/${c.slug}.html"><span>${c.title}</span><span>${c.client}</span><span>${c.role}</span></a></li>`)
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
  // R22j: it only runs while it can be seen (it has faded out by 90 vh of scroll): an invisible track written every frame kept the compositor
  // busy (Layerize + Commit about 60 ms per second on an idle page further down)
  const tickerTween = gsap.to(track, { xPercent: -50, duration: (TICKER.perHalf * TICKER.itemVw) / TICKER.speedVwPerSec, ease: 'none', repeat: -1 });
  let tickerOn = true; // (onUpdate, not onToggle: a trigger that starts at scroll 0 is not 'active' at 0, so a jump straight past its end never toggled)
  ScrollTrigger.create({ start: 0, end: () => window.innerHeight, onUpdate: (self) => { const on = self.progress < 1; if (on !== tickerOn) { tickerOn = on; if (on) tickerTween.resume(); else tickerTween.pause(); } } });

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

  // R16c: copy the scrubbed layers' current values (gsap keeps them in el._gsap; opacity is an inline style string: no layout read).
  const readFrameLayers = () => {
    const g1 = el.s1._gsap; const g2 = el.s2._gsap; const gt = el.ticker._gsap; const gk = track._gsap;
    if (g1) { frameLayers.s1.y = parseFloat(g1.y) || 0; frameLayers.s1.scale = parseFloat(g1.scaleX) || 1; }
    if (g2) { frameLayers.s2.y = parseFloat(g2.y) || 0; frameLayers.s2.scale = parseFloat(g2.scaleX) || 1; }
    frameLayers.video = el.video.style.opacity === '' ? 1 : +el.video.style.opacity;
    frameLayers.ticker.opacity = el.ticker.style.opacity === '' ? 1 : +el.ticker.style.opacity;
    frameLayers.ticker.y = gt ? parseFloat(gt.y) || 0 : 0;
    frameLayers.trackPct = gk ? parseFloat(gk.xPercent) || 0 : 0;
  };

  // Direct layers.
  HERO.mask.forEach((t) => add(tl, el.wrapper, t));
  const readMask = () => { // inline style strings only (no layout read)
    const st = el.wrapper.style;
    if (st.width) frameState.w = unitPx(st.width, innerWidth, innerWidth, innerHeight);
    if (st.height) frameState.h = unitPx(st.height, innerHeight, innerWidth, innerHeight);
  };
  tl.eventCallback('onUpdate', readMask);
  readMask();
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
        if (name === 'floatOuter') frameState.fo = v.y ?? 0;
        else if (name === 'floatInner') frameState.fi = v.y ?? 0;
        else if (name === 's3') { frameLayers.s3.y = v.y ?? 0; frameLayers.s3.scale = v.scale ?? 1; }
        else if (name === 'gallery2') frameLayers.g2y = v.y ?? 0;
        else if (name === 'gallery1') frameLayers.g1y = v.y ?? 0;
      },
    });
  });
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => setTargets(self.scroll()),
    onRefresh: (self) => { resolve(); setTargets(self.scroll()); readMask(); },
  });

  // Overlays darken over their own range, which runs past the mask timeline; chased through a spring.
  const ov = { opacity: 0 };
  gsap.fromTo(ov, { opacity: 0 }, {
    opacity: 1,
    ease: 'none',
    scrollTrigger: { trigger: layer, start: vhTop(HERO.overlay.at[0]), end: vhTop(HERO.overlay.at[1]), scrub: true, invalidateOnRefresh: true },
  });
  springLayer({ target: ov, springs: { opacity: SPRING[HERO.overlay.spring] }, apply: (v) => { frameLayers.ov = v.opacity; gsap.set(overlays, { opacity: v.opacity }); } });

  // Images #2 and #3 are not visible before ~40vh of scroll, so they start loading only after the loader is ready.
  return {
    // R16c: handles for the frame canvas
    frame: { state: { frameState, frameLayers }, pin: q('.hero__pin'), float: el.floatOuter, video: el.video, track, readLayers: readFrameLayers, gallery: [...gallery], s2img: q('.hero__s2 img'), image: hero.image, galleryRefs: hero.gallery, posterRef: '/media/hero/poster.webp', ticker: hero.ticker },
    loadDeferred() {
      root.querySelectorAll('img[data-src]').forEach((img) => {
        if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); }
        img.src = img.dataset.src; img.removeAttribute('data-src');
      });
    },
  };
}
