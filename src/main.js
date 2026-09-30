import './styles/base.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from './data/data.json';
import { runLoader } from './effects/loader.js';
import { buildHero } from './sections/hero.js';
import { buildAbout } from './sections/about.js';
import { buildPlaceholders } from './sections/placeholders.js';
import { buildIndex } from './sections/project-index.js';
import { initNav } from './effects/nav.js';
import { initClickSound } from './effects/clicksound.js';
import { SCROLL } from './timeline.js';

gsap.registerPlugin(ScrollTrigger);

// Lenis drives the scroll; GSAP's ticker feeds it so pinned sections stay in sync.
const lenis = new Lenis({ duration: SCROLL.duration, easing: SCROLL.easing }); // Framer "Intensity 30"; tune in timeline.js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Sections are added here one by one (archive, clients, footer come next).
const app = document.getElementById('app');
const hero = buildHero(app, data.hero);
buildAbout(app, data.about);
buildPlaceholders(app);
buildIndex(app, data.projects);
initNav(data.hero.wordmark, lenis);
initClickSound(data.hero.clickSound);

// Loader first: hold scrolling until what is visible on the first screen is ready.
window.scrollTo(0, 0);
lenis.stop();
// The loader only waits for the wordmark, ticker, font and the hero video's first frame (the <video> is on the page already).
// Images #2/#3 start loading once the loader is ready (hero.loadDeferred).
const firstScreen = [data.hero.wordmark, data.hero.ticker];
runLoader(data.loader.text, firstScreen, hero.loadDeferred).then(() => {
  lenis.start();
  ScrollTrigger.refresh();
  window.__siteReady = true; // tools/compare.mjs waits for this instead of a fixed delay
});
