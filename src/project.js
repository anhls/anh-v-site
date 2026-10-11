import './styles/base.css';
import './styles/desktop.css';
import './styles/project.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import data from './data/data.json';
import { SCROLL } from './timeline.js';
import { installScrollGain } from './util/scroll-gain.js';
import { initNav } from './effects/nav.js';
import { buildFooter } from './sections/footer.js';
import { createDesktopNav, buildDesktopProject, finishProjectHandoff } from './project/desktop.js';
import { isTall } from './util/layout-mode.js';

// Project pages: Lenis smooth scroll (same settings as home), the shared nav + wordmark, and the blocks from data.json (projects[].page).
// No scroll-linked GSAP here: the text fade is one CSS variable per block, videos play only while on screen.
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true }); // R24a: the mobile address bar must not refresh every trigger
const slug = document.body.dataset.project;
const project = data.projects.find((p) => p.slug === slug);
document.documentElement.classList.add('pj-open'); // R42: the project nav rule in project.css is scoped to this class
const tall = isTall(); // R24a: the TALL mode (phones, tablet portrait): one column, a burger menu, no R25 hand-off, no desktop scroll effects

// Keep first-paint flight light: build blocks, observers, videos and footer only after settle.
if (window.__pxtFlightDone) await window.__pxtFlightDone;

if (project?.page) {
  const lenis = new Lenis({ duration: SCROLL.duration, easing: SCROLL.easing });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
  if (import.meta.env.DEV) { window.__lenis = lenis; } // dev only: tools/scratch checks
  installScrollGain(lenis);

  const nav = tall ? null : createDesktopNav();
  if (tall) import('./effects/tall-menu.js').then((m) => m.mountTallMenu());
  const app = document.getElementById('app');
  if (tall) (await import('./sections/project-page-tall.js')).buildProjectPageTall(app, project.page, lenis); else buildDesktopProject(app, project.page, lenis);
  buildFooter(app, data.footer, lenis); // same footer + back-to-top as home
  initNav(data.hero.wordmark, lenis, tall ? { gateFrame: false, small: { x: 5, y: 3.4, width: 28 } } : { gateFrame: false, startSmall: !!window.__pxt?.wm }); // after the footer exists: the big wordmark returns when it is reached
  document.getElementById('pxt-wordmark')?.remove();
  ScrollTrigger.refresh();
  finishProjectHandoff({app, slug, nav});
  document.title = project.page.title;
  // Dev only: ?tune opens the wheel-acceleration panel (a build-time constant, nothing ships).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('tune')) import('./effects/tune-scroll.js').then((m) => m.mountScrollTune());
}
