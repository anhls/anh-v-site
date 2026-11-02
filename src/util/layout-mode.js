// R24a: the ONE place that decides 'tall' (phones, tablet portrait) or 'wide' (everything else). Decided once at load by the aspect (width / height)
// with a dead band: tall below 0.95, wide above 1.05, in between wide (the first load in the band; R24c adds the live switch and "keep the current mode").
// Touch devices read the SCREEN size + orientation (the address bar changes innerHeight, the screen size does not); desktop reads the window.
// ?mode=tall|wide forces it (testing on a desktop). Sets <html data-layout="tall|wide"> so CSS can follow.
export const TALL_BELOW = 0.95, WIDE_ABOVE = 1.05;
const touch = () => matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
export const aspectNow = () => {
  if (touch() && screen.width && screen.height) {
    const portrait = matchMedia('(orientation: portrait)').matches, a = Math.min(screen.width, screen.height) / Math.max(screen.width, screen.height);
    return portrait ? a : 1 / a;
  }
  return innerWidth / Math.max(innerHeight, 1);
};
export const modeFor = (aspect, current = 'wide') => (aspect < TALL_BELOW ? 'tall' : aspect > WIDE_ABOVE ? 'wide' : current);
let mode = null;
export const getMode = () => {
  if (mode) return mode;
  const forced = new URLSearchParams(location.search).get('mode');
  mode = forced === 'tall' || forced === 'wide' ? forced : modeFor(aspectNow(), 'wide');
  document.documentElement.dataset.layout = mode;
  return mode;
};
export const isTall = () => getMode() === 'tall';
export const isTouch = touch;
// R24f: the Work page's LITE mode (project images only, no cards, image warp): tall (phone / tablet portrait) OR landscape on a TOUCH device. Touch devices are decided by the screen
// (screen size + orientation, as aspectNow() does) never by the window: the browser toolbar eats height (an iPad at 1180x820 shows a window of about 1180x700), so a window ratio
// test would send a real tablet or a phone held sideways to the desktop page. Only a mouse device in a wide window gets the desktop page. ?mode=wide forces the desktop page.
export const isLiteLandscape = () => !isTall() && touch() && new URLSearchParams(location.search).get('mode') !== 'wide';
export const isLite = () => isTall() || isLiteLandscape();
