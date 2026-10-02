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
import { buildSelectedWork } from './sections/selected-work.js';
import { generateCards } from './data/cards-gen.js';
import workPool from './data/work-pool.json';
import { buildMoreProjects } from './sections/more-projects.js';
import { buildFooter } from './sections/footer.js';
import { initNav } from './effects/nav.js';
import { initClickSound } from './effects/clicksound.js';
import { buildSpawner } from './effects/spawner.js';
import { buildCaptionHover } from './effects/caption-hover.js';
import { buildTrail } from './effects/trail.js';
import { createFrameGL } from './effects/frame-gl.js';
import { SCROLL, CARDS, FRAME_WARP } from './timeline.js';
import { installScrollGain } from './util/scroll-gain.js';

gsap.registerPlugin(ScrollTrigger);

// Lenis drives the scroll; GSAP's ticker feeds it so pinned sections stay in sync.
const lenis = new Lenis({ duration: SCROLL.duration, easing: SCROLL.easing }); // Framer "Intensity 30"; tune in timeline.js
lenis.on('scroll', ScrollTrigger.update);
const scrollGain = installScrollGain(lenis);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Sections are added here one by one.
const app = document.getElementById('app');
const hero = buildHero(app, data.hero);
const frameGL = createFrameGL(hero.frame); // R16c: the centre frame's own canvas (null = DOM frame only)
buildAbout(app, data.about);
buildPlaceholders(app);
buildIndex(app, data.projects);
const cardsApi = buildSelectedWork(app, generateCards(workPool, data.projects.filter((p) => p.index).map((p) => p.slug)));
buildMoreProjects(app, data.moreProjects);
buildFooter(app, data.footer, lenis);
initNav(data.hero.wordmark, lenis);
buildSpawner(app, data.spawnerImages);
buildCaptionHover(app, data.hero.captions);
const trail = buildTrail(app, data.trailImages);
if (import.meta.env.DEV) { window.__frame = frameGL; window.__FW = FRAME_WARP; window.__heroState = hero.frame; window.__trail = trail; window.__cards = cardsApi; window.__CARDS = CARDS; } // dev only: the tuning panel and tools/scratch checks
initClickSound(data.hero.clickSound);

// Loader first: hold scrolling until what is visible on the first screen is ready.
window.scrollTo(0, 0);
lenis.stop();
// The loader only waits for the wordmark, ticker, font and the hero video's first frame (the <video> is on the page already).
// Images #2/#3 start loading once the loader is ready (hero.loadDeferred).
const firstScreen = [data.hero.wordmark, data.hero.ticker];
runLoader(data.loader.text, firstScreen, hero.loadDeferred).then(() => {
  lenis.start();
  frameGL?.preload();
  ScrollTrigger.refresh();
  window.__siteReady = true; // tools/compare.mjs waits for this instead of a fixed delay
});

// Dev only: ?tune opens the Selected Work tuning panel. The condition is a build-time constant, so none of this ships.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('tune')) import('./effects/tune-panel.js').then((m) => m.mountTunePanel({ trail, cards: cardsApi }));
