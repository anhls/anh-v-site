// One scroll timeline config. Every scroll-driven range is a page-scroll position in vh
// (1vh = 1% of the viewport height, measured from the top of the page). Tune the site by editing numbers here.
// Measured on anh-v.com at 1920x1080; see docs/HANDOFF.md "Home page structure (CORRECTED)"
// and docs/framer-extract/motion-spec.md (springs, eases and triggers read from the published Framer code).
//
// LINKED TIMINGS. Ranges that belong together are written as offsets from ONE shared anchor (the constants just
// below), so moving the anchor moves its partners. Everything else is a plain number and moves on its own.
//   MASK_SHRINK   the mask's first shrink starts      -> mask shrink [MASK_SHRINK, +56]
//                                                       About reveal [MASK_SHRINK + 54, +23 long]
//   MASK_RESHAPE  the mask reshapes to 25vw x 40vh    -> that reshape [MASK_RESHAPE, +36]
//                                                       mask float, outer wrapper up [MASK_RESHAPE - 8.8, +49.5]
//   S3_RISE       section #3 rises into the mask      -> that rise [S3_RISE, +40]
//                                                       mask float, inner wrapper back down [S3_RISE - 0.7, +23.3]
//   PEEL_1        top hero image (gallery2) peels     -> that peel [PEEL_1, +60]
//                                                       project index swap 1: Techcombank -> Bitis [PEEL_1 + 3.6, +34.7]
//   PEEL_2        2nd hero image (gallery1) peels     -> that peel [PEEL_2, +55]
//                                                       project index swap 2: Bitis -> Sulwhasoo [PEEL_2 - 1.5, +34.9]
// To retime a pair, change the anchor. To nudge only one partner relative to the other, change its offset.
const MASK_SHRINK = 0;
const MASK_RESHAPE = 137;
const S3_RISE = 190;
const PEEL_1 = 315;
const PEEL_2 = 405;
const span = (start, length) => [+start.toFixed(2), +(start + length).toFixed(2)];

export const TOTAL = 730; // page height in vh

// Smooth scroll (Lenis). Framer's "Intensity 30" = duration 3 with Lenis' default easing. Lower duration = snappier
// (try 2.5). `easing` is t (0..1) -> progress (0..1).
export const SCROLL = {
  duration: 3,
  easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
};

// Springs: [stiffness, damping, mass], Framer / motion units. Layers chase their scroll-mapped target through these
// (see src/effects/springs.js). Different springs = different lag = the floaty, weighted feel.
export const SPRING = {
  s3: [891, 90, 0.5],          // section #3 rise and zoom
  peel1: [148, 39, 0.1],       // top hero image peel (a little bounce)
  peel2: [148, 38, 0.1],       // second hero image peel
  overlay: [500, 60, 1],       // black overlay + bottom fade
  floatOuter: [891, 90, 0.5],  // mask float up
  floatInner: [648, 58, 1],    // mask float back down
  indexRow: [500, 60, 1],      // project index row blocks
  nav: [650, 100, 0.7],        // nav + wordmark big/small switch (overdamped, settles in about 1s)
  hoverCursor: [500, 60, 1],   // caption / client hover images that follow the cursor (used by later sections)
  // The nav link hover roll is "duration 0.4s, bounce 0.2"; nav.js converts that with springFromBounce().
  linkRoll: { duration: 0.4, bounce: 0.2 },
};

// Where each part lives on the page [start, end] in vh. Layout only; used for section heights and z-order.
export const SECTIONS = {
  captions: [0, 261],
  about: [0, 190],
  index: [190, 590],
  archive: [211, 461],
  clients: [590, 730],
  footer: [620, 730],
};

// Loader. Seconds unless marked ms. Words start 1.1em (70px at 64px) below their own clipped line and rise, hold, then
// rise out; the black backdrop then collapses upward. Curves are Framer's real ones (overshoot ease), words 0.8s with
// delays 0 / 0.1 / 0.2, backdrop 1s with its leave delayed 0.3s.
export const LOADER = {
  minMs: 1000,      // shortest time the loader stays up, so it does not just flash on a cached load
  videoCapMs: 4000, // stop waiting for the hero video's first frame after this (it keeps streaming)
  maxMs: 5000,      // the loader never stays waiting longer than this, whatever is still loading
  // The loader only waits for what is visible on the first screen: font, wordmark, ticker, video first frame.
  // Hero images #2/#3 (not visible before ~40vh of scroll) start loading right after the loader is ready.
  ease: [0.59, 0.25, 0.12, 1.17],
  arrive: { rise: 1.1, duration: 0.8, stagger: 0.1 },
  leave: { duration: 0.8, stagger: 0.1 }, // last word leaves first
  wipe: { delay: 0.3, duration: 1, liftVh: 11.1 }, // delay counted from the start of leave
};

// "Click Anywhere" ticker. Live: items are 182 x 9 px (9.479vw x 0.469vw at 1920), moving left at 100px/s = 5.21vw/s.
export const TICKER = { speedVwPerSec: 5.21, itemVw: 182 / 19.2, perHalf: 12 };

// Nav + wordmark switch: fires when the scroll TARGET (px) reaches this and reverses at 0; the big state also returns
// while the footer is in view (the big "^ V" at the bottom is the nav wordmark coming back).
export const NAV = { thresholdPx: 5 };

// Hero mask + strip. The mask timeline is scrubbed over `range`; overlays have their own range (runs past it).
// Entries with `spring` don't move the element directly: a scroll-scrubbed target is chased through that spring.
export const HERO = {
  scrub: 0.25, // decided: the loose scrub (a little lag behind the scroll)
  range: [0, 585],
  overlay: { at: [490, 630], spring: 'overlay' },
  // Mask size. `at` is [start, end] in vh of page scroll. Fitted to widths measured on the live site
  // (R7): the live GSAP mask runs earlier than the Framer code numbers (0-70 / 150-185 / 500-585).
  // `easeFrom` starts the ease part-way in, which reproduces the live scrub lag at the start of the first tween.
  mask: [
    { at: span(MASK_SHRINK, 56), from: { width: '100vw', height: '100vh' }, to: { width: '17vw', height: '50vh' }, ease: 'expo.inOut', easeFrom: 0.15 },
    { at: span(MASK_RESHAPE, 36), to: { width: '25vw', height: '40vh' }, ease: 'expo.out' },
    { at: [490, 571], to: { width: '100vw', height: '100vh' }, ease: 'expo.inOut' },
  ],
  // The mask floats: two wrappers around it move vertically (centre path 50% -> 22% -> 50% of the screen height).
  float: [
    { el: 'floatOuter', at: span(MASK_RESHAPE - 8.8, 49.5), from: { yvh: 0 }, to: { yvh: -27.78 }, spring: 'floatOuter' },
    { el: 'floatInner', at: span(S3_RISE - 0.7, 23.3), from: { yvh: 0 }, to: { yvh: 27.78 }, spring: 'floatInner' },
  ],
  // Strip inside the mask. `yvh` is translateY in vh; other props go straight to GSAP.
  strip: [
    { el: 's1', at: [40, 140], from: { yvh: 0, scale: 1.3 }, to: { yvh: -185.2, scale: 1 } },
    { el: 's2', at: [0, 90], from: { yvh: 55.6, scale: 2 }, to: { yvh: 0, scale: 1 } },
    { el: 's3', at: span(S3_RISE, 40), from: { yvh: 125, scale: 1.2 }, to: { yvh: 0, scale: 1.1 }, spring: 's3' },
    { el: 's3', at: [300, 520], to: { scale: 1.2 }, spring: 's3' },
    { el: 'gallery2', at: span(PEEL_1, 60), from: { yvh: 0 }, to: { yvh: -138.9 }, spring: 'peel1' },
    { el: 'gallery1', at: span(PEEL_2, 55), from: { yvh: 0 }, to: { yvh: -138.9 }, spring: 'peel2' },
  ],
  // Details that were missing: the video fades up and the ticker fades out while it rises (no springs).
  details: {
    video: { at: [0, 90], from: { opacity: 0.15 }, to: { opacity: 0.8 } },
    ticker: { at: [0, 90], from: { opacity: 1, yvh: 0 }, to: { opacity: 0, yvh: -46.3 } }, // -500px at 1080
  },
};

// About. reveal: words light up between these page-scroll positions (fitted to the live letter shares, R7),
// linked to the mask's first shrink. drift: from `from` vh of page scroll the text block moves at `speed` x
// scroll speed (0.7 = slower than the page; the Framer parallax layers multiply to 0.7125); that one is a plain number.
// wordFade: each word eases its opacity over this long. arrow: the ABOUT arrow nudges right and back, forever.
export const ABOUT = {
  reveal: span(MASK_SHRINK + 54, 23),
  drift: { from: 60, speed: 0.7 },
  wordFade: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  arrow: { xVw: 30 / 19.2, duration: 1, pause: 0.5, ease: [0.44, 0, 0.56, 1] }, // 30px, mirrored, 0.5s pause between legs
};

// Project index (190-590vh). Three rows in the same place; a swap slides one row up and out and the next up from below,
// linear with scroll and chased through a spring. Each swap is linked to a hero image peel
// (top image = Techcombank, then Bitis, then Sulwhasoo).
export const INDEX = {
  swap: [span(PEEL_1 + 3.6, 34.7), span(PEEL_2 - 1.5, 34.9)], // [row1 -> row2, row2 -> row3]
  travelVh: 18.52, // how far a row moves (200px at 1080); characters rise from the same distance
  // Per-character appear effects. They play ONCE per page load, in time (not scrubbed), when a row arrives:
  // row 1 when it is 50% in view, row 2 at the start of swap 1, row 3 at the start of swap 2.
  text: {
    side: { stagger: 0.02, duration: 0.3, ease: [0.44, 0, 0.56, 1] },             // labels and years
    titleFirst: { stagger: 0.05, duration: 1, ease: [0.87, 0.01, 0.13, 1.01] },   // row 1 title
    titleNext: { stagger: 0.05, duration: 0.2, ease: [0.87, 0.01, 0.13, 1.01] },  // row 2 and 3 titles
  },
};
