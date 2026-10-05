// R24a: the homepage entry decides the mode once and loads only that mode's code: tall = the hero-only phone home (src/tall-home.js, light first
// load), wide = the desktop homepage exactly as before (src/main.js, untouched).
import { getMode } from './util/layout-mode.js';
if (getMode() === 'tall') import('./tall-home.js'); else import('./main.js');
