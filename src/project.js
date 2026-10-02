import './styles/base.css';
import './styles/project.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from './data/data.json';
import { SCROLL } from './timeline.js';
import { installScrollGain } from './util/scroll-gain.js';
import { initNav } from './effects/nav.js';
import { buildFooter } from './sections/footer.js';
import { buildProjectPage } from './sections/project-page.js';

// Project pages: Lenis smooth scroll (same settings as home), the shared nav + wordmark, and the blocks from data.json (projects[].page).
// No scroll-linked GSAP here: the text fade is one CSS variable per block, videos play only while on screen.
gsap.registerPlugin(ScrollTrigger);
const slug = document.body.dataset.project;
const project = data.projects.find((p) => p.slug === slug);

if (project?.page) {
  const lenis = new Lenis({ duration: SCROLL.duration, easing: SCROLL.easing });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  installScrollGain(lenis);

  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
    .map(([n, h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
  document.body.prepend(nav);
  const app = document.getElementById('app');
  buildProjectPage(app, project.page, lenis);
  buildFooter(app, data.footer, lenis); // same footer + back-to-top as home
  initNav(data.hero.wordmark, lenis, { gateFrame: false }); // after the footer exists: the big wordmark returns when it is reached
  ScrollTrigger.refresh();
  document.title = project.page.title;
  // Dev only: ?tune opens the wheel-acceleration panel (a build-time constant, nothing ships).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('tune')) import('./effects/tune-scroll.js').then((m) => m.mountScrollTune());
}
