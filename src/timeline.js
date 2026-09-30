// One scroll timeline config. Every scroll-driven range is a page-scroll position in vh
// (1vh = 1% of the viewport height, measured from the top of the page). Tune the site by editing numbers here.
// Measured on anh-v.com at 1920x1080; see docs/HANDOFF.md "Home page structure (CORRECTED)".
//
// LINKED TIMINGS. Ranges that belong together are written as offsets from ONE shared anchor (the constants just
// below), so moving the anchor moves its partners. Everything else is a plain number and moves on its own.
//   MASK_SHRINK  the mask's first shrink starts      -> mask shrink [MASK_SHRINK, +56]
//                                                      About reveal  [MASK_SHRINK + 54, +23 long]
//   PEEL_1       top hero image (gallery2) peels     -> that peel     [PEEL_1, +60]
//                                                      project index swap 1: Techcombank -> Bitis [PEEL_1 + 3.6, +34.7]
//   PEEL_2       2nd hero image (gallery1) peels     -> that peel     [PEEL_2, +55]
//                                                      project index swap 2: Bitis -> Sulwhasoo [PEEL_2 - 1.5, +34.9]
// To retime a pair, change the anchor. To nudge only the index relative to its image, change the offset in INDEX.
const MASK_SHRINK = 0;
const PEEL_1 = 315;
const PEEL_2 = 405;
const span = (start, length) => [+start.toFixed(2), +(start + length).toFixed(2)];

export const TOTAL = 730; // page height in vh

// Where each part lives on the page [start, end] in vh. Layout only; used for section heights and z-order.
export const SECTIONS = {
  captions: [0, 261],
  about: [0, 190],
  index: [190, 590],
  archive: [211, 461],
  clients: [590, 730],
  footer: [620, 730],
};

// Loader. Times in seconds unless marked ms. Arrive/leave/wipe measured on the live intro (1920x1080).
// Words rise 1.1em (70px at 64px) from below their own clipped line, staggered, hold, then rise out;
// the black backdrop then collapses upward (its bottom edge rises while the top lifts 120px).
export const LOADER = {
  minMs: 1000,      // shortest time the loader stays up, so it does not just flash on a cached load
  videoCapMs: 4000, // stop waiting for the hero video's first frame after this (it keeps streaming)
  maxMs: 5000,      // the loader never stays longer than this, whatever is still loading
  // The loader only waits for what is visible on the first screen: font, wordmark, ticker, video first frame.
  // Hero images #2/#3 (not visible before ~40vh of scroll) start loading right after the loader leaves.
  arrive: { rise: 1.1, duration: 0.52, stagger: 0.09, ease: 'power2.inOut' },
  leave: { duration: 0.5, stagger: 0.09, ease: 'power2.inOut' }, // last word leaves first
  wipe: { delay: 0.23, duration: 0.72, ease: 'power2.inOut', liftVh: 11.1 }, // delay counted from the start of leave
};

// "Click Anywhere" ticker. Live: items are 182 x 9 px (9.479vw x 0.469vw at 1920), moving left at 100px/s = 5.21vw/s.
export const TICKER = { speedVwPerSec: 5.21, itemVw: 182 / 19.2, perHalf: 12 };

// Nav + wordmark switch: time-based, fires when scrollY (px) reaches this and reverses at 0.
export const NAV = { thresholdPx: 5 };

// Hero mask + strip. The mask timeline is scrubbed over `range`; overlays have their own range (runs past it).
export const HERO = {
  scrub: 0.25, // decided: the loose scrub (a little lag behind the scroll)
  range: [0, 585],
  overlay: [490, 630],
  // Mask size. `at` is [start, end] in vh of page scroll. Fitted to widths measured on the live site
  // (R7): the live GSAP mask runs earlier than the Framer code numbers (0-70 / 150-185 / 500-585).
  // `easeFrom` starts the ease part-way in, which reproduces the live scrub lag at the start of the first tween.
  mask: [
    { at: span(MASK_SHRINK, 56), from: { width: '100vw', height: '100vh' }, to: { width: '17vw', height: '50vh' }, ease: 'expo.inOut', easeFrom: 0.15 },
    { at: [137, 173], to: { width: '25vw', height: '40vh' }, ease: 'expo.out' },
    { at: [490, 571], to: { width: '100vw', height: '100vh' }, ease: 'expo.inOut' },
  ],
  // Strip inside the mask. `yvh` is translateY in vh; other props go straight to GSAP.
  strip: [
    { el: 's1', at: [40, 140], from: { yvh: 0, scale: 1.3 }, to: { yvh: -185.2, scale: 1 } },
    { el: 's2', at: [0, 90], from: { yvh: 55.6, scale: 2 }, to: { yvh: 0, scale: 1 } },
    { el: 's3', at: [190, 230], from: { yvh: 125, scale: 1.2 }, to: { yvh: 0, scale: 1.1 } },
    { el: 's3', at: [300, 520], to: { scale: 1.2 } },
    { el: 'gallery2', at: span(PEEL_1, 60), from: { yvh: 0 }, to: { yvh: -138.9 } },
    { el: 'gallery1', at: span(PEEL_2, 55), from: { yvh: 0 }, to: { yvh: -138.9 } },
  ],
};

// About. reveal: words light up between these page-scroll positions (fitted to the live letter shares, R7),
// linked to the mask's first shrink. drift: from `from` vh of page scroll the text block moves at `speed` x
// scroll speed (0.7 = slower than the page); that one is a plain number.
export const ABOUT = { reveal: span(MASK_SHRINK + 54, 23), drift: { from: 60, speed: 0.7 } };

// Project index (190-590vh). Three rows in the same place; a swap slides one row up and out and the next up from below,
// linear with scroll. Each swap is linked to a hero image peel (top image = Techcombank, then Bitis, then Sulwhasoo).
export const INDEX = {
  swap: [span(PEEL_1 + 3.6, 34.7), span(PEEL_2 - 1.5, 34.9)], // [row1 -> row2, row2 -> row3]
  travelVh: 18.52,  // how far a row moves (200px at 1080)
  letterStagger: 0, // 0 = the whole row slides as one block (as live). > 0: letters of a title rise one after another
                    // with this delay (seconds of scroll-timeline, 1s = 100vh of scroll); outgoing letters leave the same way.
};
