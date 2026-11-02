import './util/modal.js'; // R46c: must stay the first import (its input blocker has to be registered before any page listener)
import './styles/base.css';
import './styles/tall.css';
import data from './data/data.json';
import { runLoader } from './effects/loader.js';
import { buildSpawner } from './effects/spawner.js';
import { mountTallMenu } from './effects/tall-menu.js';
import './effects/contact-trigger.js';
import { TALL } from './timeline.js';

// R24a: the hero-only home of the TALL mode (phones, tablet portrait): the loader, the full-screen hero video (poster first), the tap spawner, the AV
// wordmark at the bottom, the burger menu. Nothing else is built: no About / index / cards / footer sections, no frame-gl, no cards-gl canvas, no
// ScrollTrigger, no Lenis (the page does not scroll). The desktop homepage is src/main.js (not loaded here).
document.documentElement.classList.add('tall-home');
const hero = data.hero;
const lite = !!navigator.connection?.saveData; // Save-Data: the poster only, the video is not fetched (as R22j)
const app = document.getElementById('app');
app.innerHTML = `
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
buildSpawner(app, data.spawnerImages, { touch: true, sizeScale: TALL.spawnScale });
document.title = 'Anh V';
// R45b: Home <-> Work on the phone = the desktop flight (src/effects/home-leave.js): the menu's Work link starts it (the menu closes at once); coming back from Work (#pxg painted by index.html)
// there is NO loader: the hero frame the flight ended on is up, the video takes over and the layer fades.
const video = app.querySelector('.thero__video');
const flight = () => import('./effects/home-leave.js').then((m) => { m.initHomeToWork({ hero: { frame: { video } }, link: menu.link, video, wrapper: document.getElementById('hero'), lift: '.spawner, .twm, .tmenu__btn', beforeFlight: () => menu.closeNow() }); return m; });
window.__paintPxg?.();
const arrival = !!document.getElementById('pxg');
if (arrival) flight().then((m) => m.arriveFromWork({ frame: { video } }, null)).then(() => { window.__siteReady = true; });
else runLoader(data.loader.text, [hero.wordmark], () => {}).then(() => { window.__siteReady = true; flight(); }); // (the flight code loads after the loader: the first load stays light)
