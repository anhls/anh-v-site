import './styles/base.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from './data/data.json';
import { runLoader } from './effects/loader.js';
import { buildHero } from './sections/hero.js';

gsap.registerPlugin(ScrollTrigger);

// Lenis drives the scroll; GSAP's ticker feeds it so pinned sections stay in sync.
const lenis = new Lenis();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Sections are added here one by one (about, archive, index, clients, footer come next).
const app = document.getElementById('app');
buildHero(app, data.hero);

// Loader first: hold scrolling until the hero media is ready.
window.scrollTo(0, 0);
lenis.stop();
const heroAssets = [data.hero.video, data.hero.image, ...data.hero.gallery, data.hero.wordmark, data.hero.tickerDot];
runLoader(data.loader.text, heroAssets).then(() => {
  lenis.start();
  ScrollTrigger.refresh();
});
