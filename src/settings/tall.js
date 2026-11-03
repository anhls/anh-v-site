import { WORK, WORK_TITLE } from './desktop.js';

// R24a: the TALL mode (phones, tablet portrait; src/util/layout-mode.js). Flags and numbers for what tall does differently; desktop never reads them.
// cardsMax: cards per project on the Work page; dprCap: backing-store DPR cap; warp / lead / ambient: the Work strip's warp, speed lead and ambient
// drift (off = lighter, see the status note for their cost); transition: the R25 / R28 / R30 project transitions (false = a plain page load);
// spawnScale: the tap spawner's image size relative to desktop (phone width is small).
export const TALL = {
  cardsMax: 0, cardsMaxTablet: 0, // R24d: cards per project on a phone / on a tablet in portrait (0 = the project images only; Anh may want cards back on tablets later)
  frame: 0.8, // R24e: the project image's WIDTH as a share of the viewport width (phone and tablet portrait, one value); the height follows from the desktop image ratio. The number to try: 0.8-0.9
  dprCap: 2, lead: false, ambient: false, transition: false, spawnScale: 0.5, frameRef: 633,
  // R24d: the image warp (WORK.frameWarp, the R22h main-image warp with its own spring) on the strip, driven by the strip's real speed; flat at rest. Strength x warpStrength for the narrow screen.
  warp: true, warpStrength: 1, // (R24j: strength now scales the SHAPE only, so the phone uses the desktop shape; it was 1.4 to reach the clamp sooner)
  // R24f: the speed that drives the warp is measured against the screen length ALONG the strip (a phone swipe, a tablet swipe and a desktop wheel then give comparable amounts): vn = vel x (warpRefPx / length); out = vRef x (vn x warpGain / vRef) ^ warpPow (a power curve: gentle swipes barely bend, hard flicks clearly do)
  warpRefPx: 1080, warpGain: 0.2, warpPow: 1, warpVRef: 1500,
  warpFall: 1.9, // R24g: the warp's FALL time after the speed drops (s; slower than the rise, so the bend lingers); the rise time is frameWarp.riseSec
  // R24g: real flick inertia on touch (the lite modes; the desktop drag keeps WORK.dragFriction / dragMaxCoast): release speed from the last 100 ms of the finger (no fling if it
  // stopped more than 80 ms before the lift) x flingGain, no coast under flingMin screen lengths / s, friction time dragFriction (s), at most dragMaxCoast pitches; the soft snap
  // takes over when the speed is under snapAfterSpeed screen lengths / s, or snapDelay s after the last movement when there was no coast
  flingGain: 0.9, flingRef: 1.5, flingPow: 1.8, flingMin: 0.3, dragFriction: 0.9, dragMaxCoast: 12, flingKnee: 4, // (R24j: the glide distance follows FLING_PITCHES below, flingKnee = L/s e-fold of the approach to dragMaxCoast past the last knot)
  snapAfterSpeed: 0.06, snapDelay: 0.35, focusDelay: 0.25, // (R24h: Anh's values from a real iPhone; snapAfterSpeed is only the old hand-over, the glide now plans its own landing; focusDelay = s after the glide stopped before the focus builds)
  gapV: WORK.gapVert / WORK.frameH, // R24f: tall = a VERTICAL strip; the gap between images as a share of the image height (the wide vertical gap / frame height)
  // R24d: the frame-time guard: while the strip moves, a median over guardMs or a p95 over guardP95 steps the warp down: (a) the warp buffer x0.75, (b) x0.5, (c) warp off. Never back up in a visit.
  guard: true, guardMs: 20, guardP95: 30, guardFrames: 30,
};
// R41b: project open / close on phones and tablets. The engine reads this policy;
// weak devices, Save-Data and reduced motion keep plain navigation. Phone budget (desktop: grid 32, DPR cap 2):
//   enabled: master switch (false = plain page load). bulge: run the GL bulge pass; false = the DOM flight only (a plain scaling picture).
//   bulgeWeak: bulge on devices util/device.js weakDevice() flags (false: they get the DOM flight). grid: bulge mesh cells per side (desktop 32).
//   maxDpr: backing-store DPR cap for the one prepared renderer (a phone at 3x would be 2.25x the pixels of 2x). uploadRows: texture upload slice height
//   per task (desktop 64; smaller so no slice exceeds ~4 ms on a phone). prepare: 'idle' = the centred image once the strip has rested idleMs, 'tap' =
//   on touchstart as the fallback (never hover). maxPrepared: one renderer at a time, a second is never built. disposeOn: events that free it.
//   lowPower: 'plain' = no transition when the browser reports Save-Data / the reduced-motion setting (and, where known, battery saver: see notes).
//   viewport: 'tap' = size the flight from the layout viewport captured at tap (the address bar may resize mid-motion).
export const TRANSITION_POLICY_LITE = {
  enabled: true,
  bulge: true, bulgeWeak: false, grid: 20, maxDpr: 1.5, uploadRows: 32,
  prepare: 'idle', idleMs: 600, tapFallback: true, maxPrepared: 1,
  disposeOn: ['scroll', 'drag', 'pagehide', 'hidden', 'resize'],
  lowPower: 'plain', reducedMotion: 'plain', viewport: 'tap',
  // tap gate (src/work/mode-lite.js tapGate): a tap opens only when the strip was at rest at touchdown, the finger did not drag (the core's own touch threshold, 10 px, sets dragMoved),
  // the press was shorter than maxPressMs, the image is the centred one (its centre within centreTol of the viewport centre, share of the
  // viewport along the strip) and the last open was more than lockMs ago.
  maxPressMs: 500, centreTol: 0.25, lockMs: 700,
};
// R41b: same title treatment as desktop, sized to the lite picture.
export const LITE_TITLE = { minSize: 28, maxSize: 84, frameShare: 120 / 1055, sidePad: 0.04, minFullScale: 0.6 }; // R48 r3: sidePad = the space left and right of the title inside the card (share of the card width); minFullScale = the smallest share of the base size at which the FULL title is still used (else the short one)
// the tall image warp: the wide image warp with the strength scaled (read live: ?tune)
TALL.frameWarp = { ...WORK.frameWarp, strength: 1.39 * TALL.warpStrength, curl: 0.5, camDown: 1.25, camUp: 1.25, bowDown: 0, bowUp: 0.06, reach: 1, riseSec: 0.5, leanBuf: 0.15, leanSignDown: 1 }; // (R33: the phone / tablet pages keep the lean toward the motion in both directions) // (R24i: leanBuf = extra offscreen overscan along the strip for the axis lean, in screen lengths; the lean is capped by what it holds)
// R24e: tablet LANDSCAPE (R24b's test: layout-store.js isTabletAspect): the wide-style strip, no cards (cards: 0), the image `frameH` of the viewport height (width from the desktop ratio, at most 90 % of the width)
// R48: the phone / tablet-portrait project page's SMALL wordmark: top CENTRE (the burger owns top-left). x / y / width as nav.js small = capped vw / vh / vw; y centres it on the 48 px burger. Easy to move.
// R48 r7 (Anh: option 1): the small wordmark's INK HEIGHT = the big Work title's CAP height at its BASE size (before any fit-to-card shrink: a short title like "Forbes"), measured on screen at the same width; one steady
// size for every project, derived from LITE_TITLE + TALL.frame so the two stay matched at every width. The wordmark image's ink fills its whole box (aspect 1572 : 345), so width = cap x 1572 / 345. Top centre; the vertical
// centre stays where it was (on the 48 px burger's centre, wmCentreY px from the top).
const WM_ASPECT = 1572 / 345, wmCentreY = 28;
TALL.wmCapScale = 1; // 1 = exactly the title's base-size cap; below 1 = smaller (e.g. 0.65 would match the cap of a title that was shrunk to fit the card)
let capMemo = { k: '', v: 0 };
export function titleCapPx(W = innerWidth) { // the cap height (px) of the Work title at its base size, from the real font (re-measured once the font is there)
  const ready = !!(document.fonts && document.fonts.check && document.fonts.check('600 20px "Clash Display"')), k = `${W}:${ready ? 1 : 0}`;
  if (capMemo.k === k) return capMemo.v;
  const base = Math.max(LITE_TITLE.minSize, Math.min(LITE_TITLE.maxSize, TALL.frame * W * LITE_TITLE.frameShare));
  const c = document.createElement('canvas').getContext('2d'); c.font = `${WORK_TITLE.weight} ${base * 10}px "Clash Display", system-ui, sans-serif`;
  capMemo = { k, v: c.measureText('H').actualBoundingBoxAscent / 10 }; return capMemo.v;
}
TALL.wmSmall = {
  get width() { return ((titleCapPx(innerWidth) * TALL.wmCapScale) * WM_ASPECT / innerWidth) * 100; }, // vw
  get x() { return (100 - this.width) / 2; },
  get y() { return ((wmCentreY - (titleCapPx(innerWidth) * TALL.wmCapScale) / 2) / innerHeight) * 100; }, // vh
};
// R48 rounds 3 + 4 (Anh's iPhone mock 03.11 01:21, 430x932 CSS px; every length is vw = px / 4.3 so it scales with the screen). COUNTER above the centred card AND IN FRONT of the cards (they pass under it):
// the big number's ink is numCapVw tall with its ink bottom numGapVw above the card's top edge, its ink left on the card's left edge; the small "/N" follows the CURRENT big number: its ink top is on the big
// number's ink top, totGapVw after the number's right ink edge. ONE text size for "/N", year and tags (smallCapVw, cap height; smallMinPx = the smallest font size). BELOW the card (under the cards): one row whose
// ink top is rowGapVw under the card's bottom edge: the YEAR (left edge on the card's left edge) and the TAGS (the desktop "Role" tags, max 3, one per line every tagPitchVw, tagOpacity, left-aligned, the widest
// line ending on the card's right edge). ENTRANCE when a card settles: title smear -> year (titleToYear s after the title starts) -> tags (yearToTags s after the year); lines inside a column keep `stagger`.
// LEAVE = the reverse (tags -> year), leaveScale x the entrance timing, all time-based.
export const TALL_DETAILS = { numCapVw: 12.26, numGapVw: 3.49, totGapVw: 3.42, rowGapVw: 3.72, smallCapVw: 1.86, tagPitchVw: 4.07, tagOpacity: 0.25, totOpacity: 0.25, smallMinPx: 10.5, stagger: 0.06, tags: 3, titleToYear: 0.12, yearToTags: 0.12, leaveScale: 0.5 };
// R48 r5 phone MENU (Anh's mock 03.11 01:56, 430x932; lengths in vw of the screen = px / 4.3, or px where noted). Placed by INK in tall-menu.js placeMenu().
// flavTopPct = where the ink top of the flavour text (and of the clock beside it) sits (share of the height, 316.7 px at 932); navTopPct = where the top of the "Work" capitals sits (share of the height); navPitchVw = distance between the nav lines; lineLenPx / lineThickPx = the "current page" line (half the burger's 60 px, as thick as the burger lines);
// lineGapVw = gap between that line's end and the word's ink; the clock (two right-aligned lines) stands on the flavour text's rows with its right ink edge on the big wordmark's V.
export const TALL_MENU = { flavTopPct: 33.98, navTopPct: 53.7, navPitchVw: 9.3, lineLenPx: 30, lineThickPx: 1, lineGapVw: 3.163, clockOpacity: 0.25,
  // R48 r7 (sweep + stagger): zoneShare = the smear zone's width ahead of the panel edge (share of the screen width); jagCells = how far (in grid cells) the per-row ragged panel edge may sit behind the mean edge;
  // startShare = the items start once the edge has passed this share of the width; step = seconds between the items; pushSec = the current-page line's push (it draws out from the left and pushes the word)
  zoneShare: 0.5, jagCells: 4, startShare: 0.4, pushSec: 0.45,
  // R48 r10: the entrance is ONE timeline: items start spread over staggerAmount s with staggerEase (gaps open in the middle, tighten at the ends); each item = opacity 0 -> 1, blur blurPx -> 0, y riseY -> 0 over itemSec with itemEase;
  // the line push (pushSec, pushEase) starts pushLag after the last item has started; close = the timeline reversed at closeSpeed x
  staggerAmount: 0.6, staggerEase: 'sine.inOut', itemSec: 0.35, itemEase: 'power3.out', blurPx: 8, riseY: 8, pushEase: 'power3.inOut', pushLag: 0.1, closeSpeed: 2 };
// R48 r5: the wordmark also plays on Home <-> Work (big -> small into Work, small -> big back; Work shows the small wordmark top-centre like the project pages). false = big on Home and Work.
TALL.wmHomeWork = true;
export function wmHomeWork() { return !!TALL.wmHomeWork; }
export const TABLET = { cards: 0, frameH: 0.62 };

export const TRANSITION_POLICY = TRANSITION_POLICY_LITE;
