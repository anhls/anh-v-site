import { FLIGHT } from '../settings/shared.js';
import { TRANSITION } from '../timeline.js';

// A reloaded project has lost the Work document and its held renderer. Preserve
// the current header pose so the next Work document can rebuild the same back.
export function saveLiteBack(root) {
  try {
    const place = JSON.parse(sessionStorage.getItem('work-lite-place') || 'null');
    if (!place?.animated || !root || (document.body.dataset.project && document.body.dataset.project !== place.slug)) return;
    const hero = root.querySelector('.tp-hero, .pj__hero'), image = hero?.querySelector('img');
    if (!image?.naturalWidth) return;
    const a = hero.getBoundingClientRect(), b = image.getBoundingClientRect();
    sessionStorage.setItem('pxb', JSON.stringify({ ...place, origin: 'work', src: image.currentSrc || image.src, t: Date.now(),
      zEnd: FLIGHT.zEnd, blackMax: TRANSITION.blackMax,
      leave: { W: innerWidth, H: innerHeight, scroll: scrollY, mode: a.bottom > 8 && a.top < innerHeight ? 'shrink' : 'fade',
        sec: [a.x, a.y, a.width, a.height], img: [b.x, b.y, b.width, b.height], wm: 0 } }));
  } catch { /* navigation and position restoration still work without storage */ }
}
