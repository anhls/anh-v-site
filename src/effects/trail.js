import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HERO, TRAIL } from '../timeline.js';
import { registerPointer, pointerEnabled } from './pointer.js';
import { springLayer } from './springs.js';
import { imgSet } from '../util/media.js';
import { capW, scrollPx } from '../scale.js';

// Cursor image trail (R15). Behaviour per spawn matches the live CursorImageTrail; the scroll range is Anh's (see TRAIL in
// timeline.js). A fixed pool is built once (copiesPerImage elements per image, each keeps its own image, so nothing is
// re-decoded while moving); a spawn takes the next image in the cycle, a free copy of it (else the oldest), and then only
// opacity and transform change (spring). No blur: live blurs only the exit, by 2 px; not worth the cost (see status.md).
// Intensity I (1 -> 0 as the Selected Work section comes in) lowers the spawn rate (spacing / I) and the opacity and scale.
// trailState holds the scroll points in px (for logs and checks).
export const trailState = { start: 0, fadeStart: 0, fadeEnd: 0, intensity: 0 };

export function buildTrail(root, urls) {
  if (!pointerEnabled || !urls?.length) return null;
  const T = TRAIL;
  const layerEl = document.createElement('div');
  layerEl.className = 'trail';
  root.querySelector('.hero')?.after(layerEl); // z-index 4 and before About in the page: behind the About and index text

  let k = capW() / 1920; // size and spacing scale (capped units)

  // pool: element j holds image j % n
  const n = urls.length;
  const pool = Array.from({ length: n * T.copiesPerImage }, (_, j) => {
    const el = document.createElement('img');
    el.className = 'trail__img';
    el.alt = ''; el.draggable = false; el.decoding = 'async';
    el.sizes = `${T.size}px`;
    el.style.visibility = 'hidden';
    layerEl.appendChild(el);
    const it = { el, image: j % n, busy: false, born: 0, x: 0, y: 0, timer: 0, exiting: false, goal: { o: 0, s: T.from.scale }, layer: null };
    it.layer = springLayer({
      target: it.goal,
      springs: { o: T.spring, s: T.spring },
      apply: (v) => {
        el.style.opacity = v.o;
        el.style.transform = `translate3d(${it.x}px, ${it.y}px, 0) scale(${v.s})`;
        if (it.exiting && v.o < 0.01) { it.busy = false; it.exiting = false; el.style.visibility = 'hidden'; }
      },
    });
    return it;
  });
  // images are set after the first paint so they do not compete with the first screen
  const load = () => urls.forEach((u, i) => {
    const set = imgSet(u);
    pool.filter((p) => p.image === i).forEach((p) => { if (set.srcset) p.el.srcset = set.srcset; p.el.src = set.src; });
  });
  (window.requestIdleCallback || setTimeout)(load);

  let nextImage = 0;
  let lx = 0, ly = 0, have = false; // last spawn position
  const spawn = (x, y, I) => {
    const img = nextImage; nextImage = (nextImage + 1) % n;
    const copies = pool.filter((p) => p.image === img);
    const it = copies.find((p) => !p.busy) || copies.reduce((a, b) => (b.born < a.born ? b : a));
    clearTimeout(it.timer);
    const half = (T.size * k) / 2;
    it.busy = true; it.exiting = false; it.born = performance.now();
    it.x = x - half; it.y = y - half;
    const el = it.el;
    el.style.width = el.style.height = `${T.size * k}px`;
    el.style.visibility = 'visible';
    it.goal.o = 0; it.goal.s = T.from.scale; it.layer.snap();
    it.goal.o = I; it.goal.s = T.minScale + (1 - T.minScale) * I;
    it.timer = setTimeout(() => { it.exiting = true; it.goal.o = T.out.opacity; it.goal.s = T.out.scale; }, T.visibleFor * 1000);
  };

  const effect = {
    move(x, y) {
      const I = trailState.intensity;
      if (I <= 0.02) return;
      const spacing = ((200 - (T.frequency - 1) * 199 / 49) * k) / I; // lower intensity = further apart = fewer images
      if (!have || Math.hypot(x - lx, y - ly) > spacing) { have = true; lx = x; ly = y; spawn(x, y, I); }
    },
  };

  // Scroll points (px), from the layout; recomputed on refresh and when the tuning panel changes the numbers.
  const measure = () => {
    const H = window.innerHeight;
    // 1. start: the mask width is startMaskShare of the way from full screen to its first target. The mask tween is the
    //    first HERO.mask entry (its ease over `at`); invert the ease to find that share's scroll position.
    const m = HERO.mask[0];
    const ease = gsap.parseEase(m.ease);
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (ease(mid) < T.startMaskShare) lo = mid; else hi = mid; }
    const a = scrollPx(m.at[0]), b = scrollPx(m.at[1]);
    trailState.start = a + (b - a) * ((lo + hi) / 2);
    // 2. fade: from the Selected Work top reaching `fadeAtScreen` of the screen, over fadeLenVh of scroll
    const sw = document.getElementById('selected-work');
    const top = sw ? sw.getBoundingClientRect().top + window.scrollY : trailState.start;
    trailState.fadeStart = top - H * T.fadeAtScreen;
    trailState.fadeEnd = trailState.fadeStart + (H * T.fadeLenVh) / 100;
    k = capW() / 1920;
  };
  const intensityAt = (y) => {
    if (y <= trailState.fadeStart) return 1;
    if (y >= trailState.fadeEnd) return 0;
    return (1 - (y - trailState.fadeStart) / (trailState.fadeEnd - trailState.fadeStart)) ** T.fadeCurve;
  };
  let off = null;
  const update = (y) => {
    const on = y >= trailState.start && y < trailState.fadeEnd;
    trailState.intensity = on ? intensityAt(y) : 0;
    if (on && !off) off = registerPointer(effect);
    else if (!on && off) { off(); off = null; }
  };

  measure();
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => update(self.scroll()),
    onRefresh: (self) => { measure(); update(self.scroll()); },
  });
  update(window.scrollY);
  return { remeasure() { measure(); update(window.scrollY); }, state: trailState };
}
