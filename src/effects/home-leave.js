import { gsap } from 'gsap';
import data from '../data/data.json';
import { HOME_FLIGHT as F } from '../timeline.js';
import { createHomeFlight, playFlight, flightState, workStartLayout, cardImage, homeFlightOK, isPixel } from './home-flight.js';
import { writeHandoff, readHandoff, clearHandoff, saveHeroFrame } from './home-handoff.js';
import { pm } from '../util/perf-mark.js';

// R45 (desktop, hero-only homepage): "Works" is ONE move from the hero to the first Work card (the picture shrinks with the R42 inward bow and a smear along the move, the video frame
// cross-fades into the card image, the big wordmark goes small), then the Work page loads and paints the card where the flight left it (src/work/core.js removes that overlay).
// Everything heavy (WebGL context, shader compile, the card's texture, the Work page's files) is prepared on idle after the hero has settled; a click before that is a plain navigation.
// This is the cross-document hand-off (R25 style): the Work page is not built inside the homepage document (see docs/codex/R45-notes.md).
export function initHomeToWork({ hero, nav }) {
  const link = document.querySelector('.nav a[data-link="Works"]');
  if (!link) return null;
  const video = hero.frame.video, wrapper = hero.frame.pin.querySelector('.hero__wrapper');
  const project = data.projects[0];
  const cardRef = project.page.blocks.find((b) => b.t === 'hero').img;
  const posterRef = '/media/hero/poster.webp';
  let root = null, fl = null, cardIm = null, posterIm = null, warmed = false, busy = false, hidden = [], nbIms = [];
  const heroRef = (p) => p.page.blocks.find((b) => b.t === 'hero').img;
  const N = data.projects.length;

  const preloadWork = () => { // the Work page's own files (HTML -> script + styles), fetched now so the page after the flight boots from the cache
    fetch('/work/').then((r) => (r.ok ? r.text() : '')).then((t) => {
      const doc = new DOMParser().parseFromString(t, 'text/html');
      doc.querySelectorAll('script[type="module"][src], link[rel="modulepreload"]').forEach((s) => { const l = document.createElement('link'); l.rel = 'modulepreload'; l.href = s.getAttribute('src') || s.getAttribute('href'); document.head.append(l); });
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((s) => { const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'style'; l.href = s.getAttribute('href'); document.head.append(l); });
    }).catch(() => {});
  };
  const warm = () => {
    if (warmed || !homeFlightOK()) return;
    warmed = true;
    root = document.createElement('div');
    root.className = 'hf'; root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;visibility:hidden;background:var(--bg)';
    document.body.append(root);
    cardIm = cardImage(cardRef);
    posterIm = new Image(); posterIm.src = posterRef;
    Promise.all([cardIm.decode().catch(() => {}), posterIm.decode().catch(() => {})]).then(() => {
      fl = createHomeFlight(root);
      if (!fl) { root.remove(); root = null; return; }
      fl.onLost = () => { fl = null; };
      fl.setPicture(1, cardIm, 'card'); // the end picture is uploaded now; the video frame is uploaded at the click
      // the neighbours the Work page shows at its start (slots 2 / 3): decoded + uploaded now, with the rest of the warm-up
      const lay = workStartLayout();
      nbIms = lay.neighbours.map((n, i) => { const p = data.projects[(n.k + N) % N], im = cardImage(heroRef(p)); im.decode().then(() => fl && !fl.dead && fl.setPicture(2 + i, im, p.slug)).catch(() => {}); return { n, im, slot: 2 + i, slug: p.slug, src: null }; });
      fl.draw({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }, flightState(0, 'in'), flightState(0, 'in')); // one throw-away draw: the first real frame needs no first-use work
      pm('home:warmed');
    });
    preloadWork();
    prerenderWork();
  };
  // R45c: Chrome prerenders /work/ (Speculation Rules) on idle: the page is built and its strip primed in the background, so the flight's end activates it instead of loading it. Browsers
  // without prerender simply navigate (the first-paint layer then covers the load).
  const prerenderWork = () => {
    try {
      if (!HTMLScriptElement.supports?.('speculationrules') || document.querySelector('script[data-r45]')) return;
      const sr = document.createElement('script'); sr.type = 'speculationrules'; sr.dataset.r45 = '1';
      sr.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: ['/work/'] }] });
      document.head.append(sr);
    } catch { /* */ }
  };
  // after the hero has settled and the browser is idle (never before first paint; Save-Data / reduced motion / ?gl=0: never)
  const arm = () => (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(() => setTimeout(warm, 800), { timeout: 3000 });

  const restore = () => { // the page came back from the cache (Back from the Work page): the hero as it was, no overlay
    root?.remove(); root = null; fl?.dispose(); fl = null; warmed = false; busy = false;
    hidden.forEach((n) => { n.el.style.zIndex = n.z; n.el.style.opacity = ''; n.el.style.visibility = ''; });
    hidden = [];
    document.querySelectorAll('.nav a').forEach((a) => { a.style.opacity = ''; });
    nav?.drive(0);
    clearHandoff();
    arm();
  };
  addEventListener('pageshow', (e) => { if (e.persisted) restore(); });

  link.addEventListener('click', async (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented || busy) return;
    if (!homeFlightOK() || !fl || fl.dead || !root) return; // not ready: the plain link
    e.preventDefault(); busy = true;
    pm('home:click');
    const r = wrapper.getBoundingClientRect(), heroBox = { x: r.left, y: r.top, w: r.width, h: r.height }, card = workStartLayout().first;
    const frameOK = video.readyState >= 2 && fl.setPicture(0, video);
    if (!frameOK && !fl.setPicture(0, posterIm, 'poster')) { busy = false; location.href = '/work/'; return; }
    root.style.visibility = '';
    // the covered hero layers above the flight fade out in fadeSec; the ticker band is cloned (it lives inside the hero's own layer)
    const ticker = hero.frame.pin.querySelector('.ticker'); let clone = null;
    if (ticker) { clone = ticker.cloneNode(true); const tr = ticker.getBoundingClientRect(); clone.style.cssText += `;position:fixed;left:${tr.left}px;top:${tr.top}px;width:${tr.width}px;height:${tr.height}px;transform:none;opacity:${getComputedStyle(ticker).opacity};z-index:7;pointer-events:none`; document.body.append(clone); }
    const lift = [...document.querySelectorAll('.spawner, .trail, .hero__captions, .caption-hover')];
    lift.forEach((el) => { hidden.push({ el, z: el.style.zIndex }); el.style.zIndex = '7'; });
    const fade = [...lift, ...(clone ? [clone] : []), ...document.querySelectorAll('.nav a')];
    gsap.to(fade, { opacity: 0, duration: F.fadeSec, ease: 'none' });
    saveHeroFrame(video); // the grow flight on the way back starts from this frame (async, off the main thread)
    let lost = false; fl.onLost = () => { lost = true; playFlight.cancel?.(); };
    const lay = workStartLayout(), nbs = nbIms.filter((x) => fl.has(x.slot)).map((x) => ({ slot: x.slot, rect: x.n.rect, start: x.n.start }));
    await playFlight(fl, { hero: heroBox, card, dir: 'in', neighbours: nbs, vertical: lay.vertical, onFrame: (st) => nav?.drive(1 - st.size) });
    const wm = document.querySelector('a.wordmark');
    writeHandoff('pxh', { W: innerWidth, H: innerHeight, rect: [card.x, card.y, card.w, card.h], src: cardIm.currentSrc || cardIm.src, cards: nbIms.filter((x) => fl && fl.has(x.slot)).map((x) => ({ rect: [x.n.rect.x, x.n.rect.y, x.n.rect.w, x.n.rect.h], src: x.im.currentSrc || x.im.src })), wm: wm ? { src: wm.querySelector('img')?.getAttribute('src'), style: wm.style.cssText + `;position:fixed;left:0;top:0;width:${wm.offsetWidth}px;height:${wm.offsetHeight}px;z-index:9` } : null });
    pm('home:land');
    if (lost) { /* the overlay holds the last drawn frame; the Work page paints its own */ }
    location.href = '/work/';
  });
  arm();
  return { warm, restore, readHandoff };
}

// R45: the homepage after the Work page's grow flight: the hero frame it ended on is painted (index.html); the video takes over and the layer fades. Resolves when the layer is gone.
export function arriveFromWork(hero, loadDeferred) {
  clearHandoff('pxg');
  loadDeferred?.();
  const layer = document.getElementById('pxg'), video = hero.frame.video;
  return new Promise((resolve) => {
    const done = () => {
      gsap.to(layer, { opacity: 0, duration: F.landFadeSec, ease: 'sine.inOut', onComplete: () => { layer.remove(); document.documentElement.classList.remove('pxg-on'); resolve(); } });
    };
    let fired = false; const go = () => { if (fired) return; fired = true; requestAnimationFrame(() => requestAnimationFrame(done)); };
    if (video.readyState >= 3 && !video.paused && video.currentTime > 0) go();
    else { video.addEventListener('playing', go, { once: true }); video.addEventListener('timeupdate', go, { once: true }); setTimeout(go, 1500); }
  });
}
