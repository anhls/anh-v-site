// R48 r7: the ONE wordmark of a phone / tablet page (nav.js on Work / projects) tells the menu how to move it: the menu grows the same element small -> big on open, big -> small on close.
// Live fix (Cowork, 2026-11-03): a STACK, not one slot. A project opened in place on Work registers its own wordmark on top of Work's; when it is destroyed (back to Work) it removes
// only itself, so the menu finds Work's wordmark again (before: destroy() set the handle to null and the menu on Work stopped moving the wordmark after any project visit).
const stack = [];
export const setWm = (a) => { if (a && !stack.includes(a)) stack.push(a); };
export const dropWm = (a) => { const i = stack.lastIndexOf(a); if (i >= 0) stack.splice(i, 1); };
// the newest handle whose wordmark is still in the page (a torn-down page's handle is skipped even if its destroy() never ran)
export const getWm = () => { for (let i = stack.length - 1; i >= 0; i--) { const el = stack[i].el; if (!el || el.isConnected) return stack[i]; stack.splice(i, 1); } return null; };
export const wmState = () => `${stack.length} handle(s), active: ${getWm() ? 'yes' : 'NONE'}`;
