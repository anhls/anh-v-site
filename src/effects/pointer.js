// ONE pointer listener shared by every cursor effect (CLAUDE.md rule 3). An effect registers while its section is on
// screen and unregisters when it leaves. Effects get
// `move(x, y)` and set spring targets; the springs themselves ride on the one shared loop in springs.js (gsap.ticker).
// Nothing is registered on touch devices or when the user prefers reduced motion (`pointerEnabled` is false).
export const pointerEnabled =
  window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const effects = new Set();
const pos = { x: -1, y: -1, known: false };

// The latest position is tracked page-wide from the first move (one passive listener, two assignments per event), so an effect
// that registers later starts from where the pointer really is instead of from "unknown" (R13b: no spring-in on entry).
const onMove = (e) => {
  pos.x = e.clientX;
  pos.y = e.clientY;
  pos.known = true;
  effects.forEach((fx) => fx.move(pos.x, pos.y));
};
if (pointerEnabled) window.addEventListener('pointermove', onMove, { passive: true });
// The pointer left the window: effects that care (card hover) get `leave()`, so nothing stays hovered.
if (pointerEnabled) document.documentElement.addEventListener('pointerleave', () => effects.forEach((fx) => fx.leave?.()));

// effect = { move(x, y) }. Returns the unregister function.
export function registerPointer(effect) {
  if (!pointerEnabled) return () => {};
  effects.add(effect);
  if (pos.known) effect.move(pos.x, pos.y);
  return () => { effects.delete(effect); };
}
