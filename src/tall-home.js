import './util/modal.js'; // R46c: must stay the first import (its input blocker has to be registered before any page listener)
import './styles/base.css';
import './styles/tall.css';
import { gsap } from 'gsap';
import data from './data/data.json';
import { runLoader } from './effects/loader.js';
import { buildSpawner } from './effects/spawner.js';
import { mountTallMenu } from './effects/tall-menu.js';
import './effects/contact-trigger.js';
import { TALL } from './timeline.js';
import { OFF, applyOff } from './util/off.js';

// R24a: the hero-only home of the TALL mode (phones, tablet portrait): the loader, the full-screen hero video (poster first), the tap spawner, the AV
// wordmark at the bottom, the burger menu. Nothing else is built: no About / index / cards / footer sections, no frame-gl, no cards-gl canvas, no
// ScrollTrigger, no Lenis (the page does not scroll). The desktop homepage is src/main.js (not loaded here).
document.documentElement.classList.add('tall-home');
applyOff(); // R52d: ?off=... bisect switches (nothing when absent)
const hero = data.hero;
const lite = !!navigator.connection?.saveData; // Save-Data: the poster only, the video is not fetched (as R22j)
const app = document.getElementById('app');
app.innerHTML = OFF.has('hero') ? '<div class="thero" id="hero"></div>' : `
  <div class="thero" id="hero">
    <img class="thero__poster" src="${hero.poster || '/media/hero/poster.webp'}" alt="" decoding="async" fetchpriority="high">
    <video class="hero__video thero__video" poster="${hero.poster || '/media/hero/poster.webp'}" ${lite ? '' : 'autoplay '}muted loop playsinline preload="${lite ? 'none' : 'auto'}" aria-hidden="true">
      ${hero.videoPortrait ? `<source src="${hero.videoPortrait}" media="(orientation: portrait)">` : ''}<source src="${hero.video}">
    </video>
  </div>`; // (hero.videoPortrait: the hook for a future portrait video; the placeholder is the same file)
const wm = document.createElement('a');
wm.className = 'twm'; wm.href = '/'; wm.setAttribute('aria-label', 'Anh V, home');
wm.innerHTML = `<img src="${hero.wordmark}" alt="" draggable="false">`;
document.body.prepend(wm);
if (document.getElementById('pxg-card')) wm.style.visibility = 'hidden'; // R48 part 4: the card-first return layer carries the small wordmark until the grow flight starts (home-leave.js growFromCard)
const skip = document.querySelector('.skip'); if (skip) document.body.prepend(skip);
document.querySelector('nav.nav')?.remove(); // the desktop nav links are not used in tall mode: the burger replaces them
const menu = mountTallMenu();
if (!OFF.has('spawn')) buildSpawner(app, data.spawnerImages, { touch: true, sizeScale: TALL.spawnScale });
document.title = 'Anh V';
// R45b: Home <-> Work on the phone = the desktop flight (src/effects/home-leave.js): the menu's Work link starts it (the menu closes at once); coming back from Work (#pxg painted by index.html)
// there is NO loader: the hero frame the flight ended on is up, the video takes over and the layer fades.
const video = app.querySelector('.thero__video'); // (null with ?off=hero)
const flight = () => import('./effects/home-leave.js').then((m) => { if (OFF.has('hero')) return m; // (bisect: no hero, no flights)
     m.initHomeToWork({ hero: { frame: { video } }, link: menu.link, video, wrapper: document.getElementById('hero'), lift: '.spawner, .twm, .tmenu__btn', beforeFlight: () => menu.closeNow() }); return m; });
// R49 r2: while loading, the bottom wordmark sits SMALL top-left (the phone's small-wordmark box, as the project pages: x 5 vw, y 3.4 vh, 28 vw wide) and grows to its place with the loader's ending; p 1 = small, 0 = big
const SMALL_WM = { x: 5, y: 3.4, width: 28 };
function twmGrow() {
  const set = (p) => {
    gsap.set(wm, { clearProps: 'transform' }); const r = wm.getBoundingClientRect(); // the big place (CSS)
    const s = (SMALL_WM.width / 100 * innerWidth) / r.width;
    gsap.set(wm, { x: (SMALL_WM.x / 100 * innerWidth - r.left) * p, y: (SMALL_WM.y / 100 * innerHeight - r.top) * p, scale: 1 + (s - 1) * p, transformOrigin: '0 0' });
  };
  return { el: wm, set, release: () => gsap.set(wm, { clearProps: 'transform,transformOrigin' }) };
}
// R52: a prerendered homepage (Chrome) must not decide anything before it is activated: the hand-off records are read at activation (index.html), the loader never runs in the background
if (document.prerendering) await new Promise((r) => document.addEventListener('prerenderingchange', r, { once: true }));
window.__paintPxg?.();
// R52: the big AV in the open menu painted the menu OPEN (#pxg[data-menu]): no loader; the live menu takes the layer over and plays its normal close (also after a bfcache restore: home-leave.js restore())
const menuLayer = () => { const l = document.getElementById('pxg'); return l?.dataset.menu === '1' ? l : null; };
const pxmTake = () => { const layer = menuLayer(); return layer ? menu.takeOver({ rec: window.__pxmRec, layer, video }) : Promise.resolve(); };
window.__pxmTake = pxmTake;
const arrival = !!document.getElementById('pxg') && !menuLayer();
if (menuLayer()) pxmTake().then(() => { window.__siteReady = true; flight(); });
else if (arrival) flight().then((m) => m.arriveFromWork({ frame: { video } }, null)).then(() => { window.__siteReady = true; });
else if (OFF.has('loader')) { window.__siteReady = true; flight(); }
else runLoader({ urls: [hero.wordmark], wordmark: twmGrow() }).then(() => { window.__siteReady = true; flight(); }); // (the flight code loads after the loader: the first load stays light)
