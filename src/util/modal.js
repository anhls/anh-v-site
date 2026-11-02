// R46c: the ONE switch for "a modal (the contact card) is open: nothing behind it reacts".
//  - `modal.open` + `modal.on(fn)` (fn(open) is called on every change): effects that run their own loops (Lenis, the Work strip, the pointer effects) pause / relax on change.
//  - While it is open, ONE capture listener on window (registered first: this file is the first import of every page entry) swallows every input event before any page listener sees it
//    (wheel, pointer / mouse / touch moves and presses, keys, clicks). The modal's own handlers are registered with `modal.trap(type, fn)` and are called by that listener instead.
//    enter / leave events are NOT swallowed, so a hovered element un-hovers by itself when the dim covers it.
//  - Scroll keys (space, arrows, page, home, end) never reach the page's native scroll.
//  - The page content is `inert` while it is open (modal.lock / unlock): no focus, no clicks, hidden from screen readers.
const subs = new Set();
const traps = {};
export const modal = {
  open: false,
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
  set(v) { if (v === this.open) return; this.open = v; if (v) { document.documentElement.dispatchEvent(new Event('pointerleave')); document.dispatchEvent(new Event('pointerleave')); } /* cursor effects relax as if the pointer left the window */ subs.forEach((f) => { try { f(v); } catch { /* */ } }); },
  trap(type, fn) { (traps[type] ||= new Set()).add(fn); return () => traps[type].delete(fn); },
};

const TYPES = ['wheel', 'pointermove', 'pointerdown', 'pointerup', 'pointercancel', 'mousemove', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'dblclick', 'auxclick', 'contextmenu', 'keydown', 'keyup', 'keypress', 'dragstart'];
const SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
const block = (e) => {
  if (!modal.open) return;
  traps[e.type]?.forEach((fn) => fn(e));
  if (e.type === 'keydown' && SCROLL_KEYS.has(e.key) && !(e.key === ' ' && e.target?.closest?.('button')) && !e.target?.closest?.('input, textarea, select')) e.preventDefault();
  if (e.type === 'touchmove' || e.type === 'wheel') e.preventDefault();
  e.stopImmediatePropagation();
  if (e.type === 'dragstart') e.preventDefault();
};
TYPES.forEach((t) => window.addEventListener(t, block, { capture: true, passive: false }));

let locked = [];
export function lockPage(except) {
  unlockPage();
  locked = [...document.body.children].filter((el) => el !== except && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName) && !el.hasAttribute('inert'));
  locked.forEach((el) => el.setAttribute('inert', ''));
}
export function unlockPage() { locked.forEach((el) => el.removeAttribute('inert')); locked = []; }
