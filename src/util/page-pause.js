// R48 r10: the page's own render loop (Work cards GL, title, details) pauses under the opaque menu sweep: the smear takes ONE snapshot of the page at the tap (a texture upload per picture, once), the page does no
// per-frame work until the menu is closed again (tall-menu.js sets it).
let paused = false;
export const setPagePaused = (v) => { paused = !!v; };
export const isPagePaused = () => paused;
