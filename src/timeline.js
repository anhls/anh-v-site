// One scroll timeline config. Every scroll-driven range is a page-scroll position in vh
// (1vh = 1% of the viewport height, measured from the top of the page). Tune the site by editing numbers here.
// Measured on anh-v.com at 1920x1080; see docs/HANDOFF.md "Home page structure (CORRECTED)".

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
  // Temporary comparison switch: open the site with ?scrub=tight to scrub the hero with no smoothing (scrub: true).
  // Lenis already smooths the scroll, so this shows whether 0.25 is double smoothing. Anh picks one, then remove this.
  scrub: new URLSearchParams(window.location.search).get('scrub') === 'tight' ? true : 0.25,
  range: [0, 585],
  overlay: [490, 630],
  // Mask size. `at` is [start, end] in vh of page scroll. Fitted to widths measured on the live site
  // (R7): the live GSAP mask runs earlier than the Framer code numbers (0-70 / 150-185 / 500-585).
  // `easeFrom` starts the ease part-way in, which reproduces the live scrub lag at the start of the first tween.
  mask: [
    { at: [0, 56], from: { width: '100vw', height: '100vh' }, to: { width: '17vw', height: '50vh' }, ease: 'expo.inOut', easeFrom: 0.15 },
    { at: [137, 173], to: { width: '25vw', height: '40vh' }, ease: 'expo.out' },
    { at: [490, 571], to: { width: '100vw', height: '100vh' }, ease: 'expo.inOut' },
  ],
  // Strip inside the mask. `yvh` is translateY in vh; other props go straight to GSAP.
  strip: [
    { el: 's1', at: [40, 140], from: { yvh: 0, scale: 1.3 }, to: { yvh: -185.2, scale: 1 } },
    { el: 's2', at: [0, 90], from: { yvh: 55.6, scale: 2 }, to: { yvh: 0, scale: 1 } },
    { el: 's3', at: [190, 230], from: { yvh: 125, scale: 1.2 }, to: { yvh: 0, scale: 1.1 } },
    { el: 's3', at: [300, 520], to: { scale: 1.2 } },
    { el: 'gallery2', at: [315, 375], from: { yvh: 0 }, to: { yvh: -138.9 } },
    { el: 'gallery1', at: [405, 460], from: { yvh: 0 }, to: { yvh: -138.9 } },
  ],
};

// About. reveal: words light up between these page-scroll positions (fitted to the live letter shares, R7).
// drift: from `from` vh of page scroll the text block moves at `speed` x scroll speed (0.7 = slower than the page).
export const ABOUT = { reveal: [54, 77], drift: { from: 60, speed: 0.7 } };
