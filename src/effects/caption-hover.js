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
  const show = (i) => {
    if (i === shown) return;
    if (shown >= 0) imgs[shown].style.opacity = 0;
    if (i >= 0) imgs[i].style.opacity = 1;
    box.style.opacity = i >= 0 ? 1 : 0;
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
      if (shown < 0) layer.snap(); // appears at the cursor, no flight in from the old spot
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
