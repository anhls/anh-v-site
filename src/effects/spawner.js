import { gsap } from 'gsap';
import { SPAWNER } from '../timeline.js';
import { pointerEnabled } from './pointer.js';
import { imgInfo, imgSet } from '../util/media.js';
import { bezier } from '../util/bezier.js';

// Click spawner (R15, matched to the live Clickable_Frame): a click in the top 100vh of the page spawns an image at the
// click (+- positionOffset), it pops in (opacity/scale), then floats up and settles its rotation until its life is over.
// A fixed pool of SPAWNER.maxImages elements is reused (the oldest is recycled when all are busy); only transforms and
// opacity are animated. One gsap ticker callback runs only while something is alive. Off on touch and reduced motion.
const easeOut = bezier(0, 0, 0.58, 1); // Framer's "easeOut"
const rnd = (m) => (Math.random() * 2 - 1) * m;

// R24a: `touch` (tall mode): the tap spawner: pointerdown instead of click, runs on touch (not under reduced motion), `sizeScale` shrinks the images for a phone
export function buildSpawner(root, urls, { touch = false, sizeScale = 1 } = {}) {
  if (!(pointerEnabled || (touch && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)) || !urls?.length) return;
  const S = SPAWNER;
  const frame = document.createElement('div');
  frame.className = 'spawner';
  frame.style.perspective = `${S.perspective}px`;
  (root.querySelector('.hero') || root.querySelector('.thero'))?.after(frame); // right after the hero layer: same z-index, later in the page, so it sits on top

  const pool = Array.from({ length: S.maxImages }, () => {
    const box = document.createElement('div');
    box.className = 'spawner__item';
    const img = document.createElement('img');
    img.alt = ''; img.draggable = false; img.decoding = 'async';
    box.appendChild(img);
    frame.appendChild(box);
    return { box, img, tl: null, birth: 0, alive: false, fading: false, h: 0, topPx: 0 };
  });

  // Shuffled order with no immediate repeat (also across reshuffles), like live.
  let order = [], at = 0, last = null;
  const nextUrl = () => {
    if (at >= order.length) {
      order = [...urls].sort(() => Math.random() - 0.5);
      if (last && order[0] === last && order.length > 1) { const j = 1 + Math.floor(Math.random() * (order.length - 1)); [order[0], order[j]] = [order[j], order[0]]; }
      at = 0;
    }
    last = order[at++];
    return last;
  };

  let active = 0;
  const onTick = () => {
    for (const it of pool) {
      if (!it.alive || it.fading) continue;
      // the centre is above the top edge of the page: fade out (live checks the same thing every frame)
      if (it.topPx + gsap.getProperty(it.box, 'y') + it.h / 2 <= 0) { it.fading = true; gsap.to(it.box, { opacity: 0, duration: S.fadeOut, ease: 'none', overwrite: 'auto' }); }
    }
  };

  const spawn = (x, y) => {
    const vh = window.innerHeight / 100;
    const ref = nextUrl();
    const info = imgInfo(ref);
    const aspect = info ? info.source.width / info.source.height : 1.5;
    const h = (Math.random() * (S.sizeVh - S.minVh) + S.minVh) * vh * sizeScale;
    const w = h * aspect;
    // recycle: a free element, else the oldest
    const it = pool.find((p) => !p.alive) || pool.reduce((a, b) => (b.birth < a.birth ? b : a));
    it.tl?.kill();
    gsap.killTweensOf(it.box);
    if (!it.alive) { active += 1; if (active === 1) gsap.ticker.add(onTick); }
    const topPx = y - h * S.origin;
    Object.assign(it, { alive: true, fading: false, birth: performance.now(), h, topPx });
    const set = imgSet(ref);
    it.img.sizes = `${Math.ceil(w)}px`;
    it.img.srcset = set.srcset;
    it.img.src = set.src;
    gsap.set(it.box, {
      left: x - w / 2, top: topPx, width: w, height: h, y: 0, opacity: S.fromOpacity, scale: S.fromScale,
      rotationX: rnd(S.rotFrom[0]), rotationY: rnd(S.rotFrom[1]), rotation: rnd(S.rotFrom[2]), transformOrigin: '50% 100%', display: 'block',
    });
    const delay = S.spawnSec * (1 - S.overlapPct / 100);
    const rest = S.lifetime - delay;
    const tl = gsap.timeline({ onComplete: () => { it.alive = false; it.box.style.display = 'none'; active -= 1; if (active === 0) gsap.ticker.remove(onTick); } });
    tl.to(it.box, { opacity: 1, scale: 1, duration: S.spawnSec, ease: easeOut }, 0);
    tl.to(it.box, { y: -Math.min(S.floatVh, 300) * vh, rotationX: rnd(S.rot[0]), rotationY: rnd(S.rot[1]), rotation: rnd(S.rot[2]), duration: rest, ease: easeOut }, delay);
    it.tl = tl;
  };

  document.addEventListener(touch ? 'pointerdown' : 'click', (e) => {
    if (e.target.closest('a, button')) return;
    if (e.pageY > window.innerHeight) return; // the top 100vh of the page only
    const dx = rnd(window.innerWidth * (S.offsetVw / 100));
    const dy = rnd(window.innerHeight * (S.offsetVw / 100));
    spawn(e.pageX + dx, e.pageY + dy);
  });
}
