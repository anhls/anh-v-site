// ONE pointer listener shared by every cursor effect (CLAUDE.md rule 3). An effect registers while its section is on
// screen and unregisters when it leaves; the listener only exists while at least one effect is registered. Effects get
// `move(x, y)` and set spring targets; the springs themselves ride on the one shared loop in springs.js (gsap.ticker).
// Nothing is registered on touch devices or when the user prefers reduced motion (`pointerEnabled` is false).
export const pointerEnabled =
  window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const effects = new Set();
const pos = { x: -1, y: -1, known: false };

const onMove = (e) => {
  pos.x = e.clientX;
  pos.y = e.clientY;
  pos.known = true;
  effects.forEach((fx) => fx.move(pos.x, pos.y));
};

// effect = { move(x, y) }. Returns the unregister function.
export function registerPointer(effect) {
  if (!pointerEnabled) return () => {};
  if (effects.size === 0) window.addEventListener('pointermove', onMove, { passive: true });
  effects.add(effect);
  if (pos.known) effect.move(pos.x, pos.y);
  return () => {
    effects.delete(effect);
    if (effects.size === 0) window.removeEventListener('pointermove', onMove);
  };
}
