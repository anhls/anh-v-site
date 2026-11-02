// R48 r7: the ONE wordmark of a phone / tablet page (nav.js on Work / projects) tells the menu how to move it: the menu grows the same element small -> big on open, big -> small on close.
let api = null;
export const setWm = (a) => { api = a; };
export const getWm = () => api;
