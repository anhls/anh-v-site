import { HERO } from '../timeline.js';
import { isTall } from './layout-mode.js';

// R49: how much the homepage dims its hero at rest (a brightness factor 0..1). On wide screens the hero video sits at opacity HERO.details.video.from.opacity (0.15) over black until the page is scrolled (the hero timeline in
// src/sections/hero.js reads the same number); the phone / tablet home shows the raw video (1). The Home <-> Work flights and the Work -> Home landing layer use this so their hero picture matches the page it stands in for.
export const heroDim = () => (isTall() ? 1 : HERO.details.video.from.opacity);
