// R23d: scroll acceleration for every page. Lenis' scroll distance is the sum of the wheel deltas (wheelMultiplier 1), so a hard flick
// moved no further per tick than a gentle roll. This thin layer (one capture-phase wheel listener, ahead of Lenis' own) estimates how fast
// the wheel is being turned and sets Lenis' wheelMultiplier for that event: about 1 for slow notches, rising smoothly to SCROLL.gainCap as
// the ticks come faster (and bigger), falling back when the user slows down (SCROLL.gainDecay: how long the speed estimate is held).
//   speed = |delta| / time since the previous event (px/s, the time clamped to 16..250 ms), smoothed; held with an exponential decay.
//   gain  = 1 + (gainCap - 1) * smoothstep((speed - gainFrom) / (gainTo - gainFrom))
// gainCap 1 = off (today's behaviour). Touch drag, keyboard and anchor scrolling are not wheel events: untouched. Reduced motion: off.
import { SCROLL } from '../timeline.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function installScrollGain(lenis) {
  const vs = lenis.virtualScroll?.options;
  if (!vs || reduced) return { gain: () => 1 };
  let last = 0;
  let speed = 0;
  let gain = 1;
  window.addEventListener('wheel', (e) => {
    const now = performance.now();
    const dtRaw = last ? (now - last) / 1000 : 1;
    last = now;
    // delta in px (a "line" wheel reports 3 lines; Lenis scales those too, so keep the estimate in the same unit as Lenis' multiplier input)
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const d = Math.max(Math.abs(e.deltaY), Math.abs(e.deltaX)) * unit;
    speed *= Math.exp(-Math.max(0, dtRaw - 0.05) / Math.max(SCROLL.gainDecay, 0.01)); // the held speed decays while the wheel is quiet
    const inst = d / Math.min(Math.max(dtRaw, 0.016), 0.25);
    speed += (inst - speed) * (inst > speed ? 0.5 : 0.25); // rises fast, falls slower
    const t = Math.min(1, Math.max(0, (speed - SCROLL.gainFrom) / Math.max(SCROLL.gainTo - SCROLL.gainFrom, 1)));
    gain = 1 + (Math.max(SCROLL.gainCap, 1) - 1) * t * t * (3 - 2 * t);
    vs.wheelMultiplier = gain;
  }, { capture: true, passive: true });
  return { gain: () => gain, speed: () => speed };
}
