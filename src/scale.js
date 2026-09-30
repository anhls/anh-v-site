// The one place that decides how the layout scales past the 1920x1080 reference (R11b, decided by Anh):
// proportional up to 1920x1080, capped at the 1920 value above it. Type, UI sizes, motion distances and the
// px-based scroll ranges use the capped units; frames and full-screen media stay on plain vw/vh.
// To make everything fully proportional again, set CAP to false (nothing else needs to change).
export const CAP = true;
export const REF = { w: 1920, h: 1080 };

const capped = (actual, ref) => (CAP ? Math.min(actual, ref) : actual);

// CSS side: --cap-w / --cap-h are the largest 1vw / 1vh can be. base.css builds --ux = min(1vw, --cap-w) and
// --uy = min(1vh, --cap-h) from them. Without the cap they are just 100vw / 100vh, so --ux = 1vw.
const root = document.documentElement.style;
root.setProperty('--cap-w', CAP ? `${REF.w / 100}px` : '100vw');
root.setProperty('--cap-h', CAP ? `${REF.h / 100}px` : '100vh');

// JS side, all read at call time so they follow resizes.
export const capW = () => capped(window.innerWidth, REF.w);
export const capH = () => capped(window.innerHeight, REF.h);

// A distance written in vh at the 1080 reference ("-185.2" = 2000px) as px: proportional up to 1080, then fixed.
export const dist = (vh) => (capH() * vh) / 100;

// A page-scroll position as px. A plain number is uncapped vh (scales with the window height). `{ c, v }` is
// c capped vh (fixed above 1080, like a distance) plus v uncapped vh: live's scroll triggers are a mix of the two.
export const scrollPx = (p) => (typeof p === 'number' ? (window.innerHeight * p) / 100 : dist(p.c) + (window.innerHeight * (p.v ?? 0)) / 100);

// Range builders for timeline.js (values are vh at the 1080 reference).
export const C = (c, v = 0) => ({ c, v });               // capped part + uncapped part
export const plus = (p, v) => (typeof p === 'number' ? p + v : { c: p.c, v: (p.v ?? 0) + v }); // move a position by uncapped vh
