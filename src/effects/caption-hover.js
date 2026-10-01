import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CAPTION_HOVER as C } from '../timeline.js';
import { registerPointer, pointerEnabled } from './pointer.js';
import { springLayer } from './springs.js';
import { imgAttrs } from '../util/media.js';
import { capW } from '../scale.js';

// Hero caption hover image (R15, matched to live): while the pointer is over a caption, that project's image (427x249 at
// 1920) sits right of the cursor (+50 px) with its bottom edge at the cursor, chasing it on a 500/60/1 spring. Caption
// boxes are measured once per load/refresh (page coordinates), never per frame. Registered with the shared pointer only
// while the captions can be on screen. Off on touch and reduced motion.
export function buildCaptionHover(root, captions) {
  const list = root.querySelector('.hero__captions');
  if (!pointerEnabled || !list || !captions?.some((c) => c.image)) return;

  const box = document.createElement('div');
  box.className = 'caption-hover';
  box.innerHTML = captions.map((c) => `<img ${imgAttrs(c.image, `${C.w / 19.2}vw`)} alt="" draggable="false">`).join('');
  root.appendChild(box);
  const imgs = [...box.children];

  const items = [...list.children];
  let rects = [];
  const measure = () => {
    const sy = window.scrollY;
    rects = items.map((li) => { const r = li.getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top + sy, y1: r.bottom + sy }; });
  };

  const goal = { x: 0, y: 0 };
  const layer = springLayer({
    target: goal,
    springs: { x: C.spring, y: C.spring },
    apply: (v) => { box.style.transform = `translate3d(${v.x}px, ${v.y}px, 0)`; },
    snap: true,
  });
  let shown = -1;
  let hiddenAt = -1e9; // when the last image started to fade out (the box only snaps to the cursor once everything has faded)
  const show = (i) => {
    if (i === shown) return;
    // durations and colours come from CAPTION_HOVER every time, so the ?tune sliders apply at once
    box.style.setProperty('--cap-in', `${C.revealSec}s`);
    box.style.setProperty('--cap-out', `${C.hideSec}s`);
    box.style.setProperty('--cap-from', C.fromScale);
    list.style.setProperty('--cap-text-out', `${C.textOutSec}s`);
    list.style.setProperty('--cap-hot', C.textColor);
    list.style.setProperty('--cap-line-in', `${C.lineInSec}s`);
    list.style.setProperty('--cap-line-out', `${C.lineOutSec}s`);
    if (shown >= 0) { imgs[shown].classList.remove('is-on'); items[shown].classList.remove('is-hot'); hiddenAt = performance.now(); }
    if (i >= 0) { imgs[i].classList.add('is-on'); items[i].classList.add('is-hot'); }
    shown = i;
  };

  const effect = {
    move(x, y) {
      const k = capW() / 1920;
      const py = y + window.scrollY;
      let hit = -1;
      for (let i = 0; i < rects.length; i++) { const r = rects[i]; if (x >= r.x0 && x <= r.x1 && py >= r.y0 && py <= r.y1) { hit = i; break; } }
      if (hit < 0) { show(-1); return; }
      goal.x = x + C.offsetX * k;
      goal.y = y - C.h * k;
      if (shown < 0 && performance.now() - hiddenAt > C.hideSec * 1000) layer.snap(); // appears at the cursor, no flight in from the old spot (unless the last image is still fading out)
      show(hit);
    },
  };

  // Active while the captions can be on screen (page scroll below the captions' bottom edge + one screen).
  let off = null;
  let limit = 0;
  const update = (y) => {
    const on = y < limit;
    if (on && !off) { measure(); off = registerPointer(effect); }
    else if (!on && off) { off(); off = null; show(-1); }
  };
  const remeasure = () => { limit = list.offsetTop + list.offsetHeight + window.innerHeight; measure(); };
  remeasure();
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => update(self.scroll()),
    onRefresh: (self) => { remeasure(); update(self.scroll()); },
  });
  update(window.scrollY);
}
