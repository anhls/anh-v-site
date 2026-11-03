import { cardRef as cardRefOf } from '../util/card-media.js';
import { gsap } from 'gsap';
import data from '../data/data.json';
import { HOME_FLIGHT as F, LITE_TITLE, WORK_TITLE, TITLE_SHORT } from '../timeline.js';
import { TALL } from '../settings/tall.js';
import { createHomeFlight, playFlight, flightState, workStartLayout, cardImage, homeFlightOK, isPixel } from './home-flight.js';
import { writeHandoff, readHandoff, clearHandoff, saveHeroFrame, dbg } from './home-handoff.js';
import { pm } from '../util/perf-mark.js';

// R45 (desktop, hero-only homepage): "Works" is ONE move from the hero to the first Work card (the picture shrinks with the R42 inward bow and a smear along the move, the video frame
// cross-fades into the card image, the big wordmark goes small), then the Work page loads and paints the card where the flight left it (src/work/core.js removes that overlay).
// Everything heavy (WebGL context, shader compile, the card's texture, the Work page's files) is prepared on idle after the hero has settled; a click before that is a plain navigation.
// This is the cross-document hand-off (R25 style): the Work page is not built inside the homepage document (see docs/codex/R45-notes.md).
// R45b: the phone / tablet home (src/tall-home.js) uses the same flight: opts.link = the menu's Work link, opts.video = the hero video, opts.wrapper = the full-screen hero element, opts.lift = the
// layers above the flight that fade out (the tap spawner, the AV wordmark, the burger), opts.beforeFlight = closes the menu at once (no close animation: the flight IS the transition).
export function initHomeToWork({ hero, nav, link: linkOpt, video: videoOpt, wrapper: wrapperOpt, lift: liftSel, beforeFlight }) {
  const link = linkOpt || document.querySelector('.nav a[data-link="Works"]');
  if (!link) return null;
  const video = videoOpt || hero.frame.video, wrapper = wrapperOpt || hero.frame.pin.querySelector('.hero__wrapper');
  const project = data.projects[0];
  const cardRef = cardRefOf(project);
  const posterRef = '/media/hero/poster.webp';
  let root = null, fl = null, cardIm = null, posterIm = null, warmed = false, busy = false, hidden = [], nbIms = [];
  const heroRef = (p) => cardRefOf(p); // R47: the card's own picture (the loop's poster for Techcombank)
  const N = data.projects.length;

  // R45b round 2: Safari cannot prerender, so the Work page itself must already be in the cache when the flight ends: its HTML, its scripts AND the modules those import (the module graph is walked two
  // levels deep from the built files, so dynamic chunks such as the layouts and the lite mode load now too), its styles, and the preloaded font / wordmark.
  let preloaded = false;
  const preloadWork = () => {
    if (preloaded) return; preloaded = true;
    const added = new Set();
    const mp = (href) => { if (added.has(href)) return false; added.add(href); const l = document.createElement('link'); l.rel = 'modulepreload'; l.href = href; document.head.append(l); return true; };
    const walk = (href, depth) => { if (depth < 0) return; fetch(href).then((r) => (r.ok ? r.text() : '')).then((t) => { for (const m of t.matchAll(/(?:from|import\()\s*["'](\.\/[^"']+\.js)["']/g)) { const u = new URL(m[1], new URL(href, location.href)).pathname; if (mp(u)) walk(u, depth - 1); } }).catch(() => {}); };
    fetch('/work/').then((r) => (r.ok ? r.text() : '')).then((t) => {
      const doc = new DOMParser().parseFromString(t, 'text/html');
      doc.querySelectorAll('script[type="module"][src], link[rel="modulepreload"]').forEach((s) => { const u = s.getAttribute('src') || s.getAttribute('href'); if (mp(u)) walk(u, 2); });
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((s) => { const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'style'; l.href = s.getAttribute('href'); document.head.append(l); });
      doc.querySelectorAll('link[rel="preload"]').forEach((s) => { if (document.querySelector(`link[rel="preload"][href="${s.getAttribute('href')}"]`)) return; const l = document.createElement('link'); l.rel = 'preload'; for (const n of ['href', 'as', 'type', 'crossorigin']) if (s.hasAttribute(n)) l.setAttribute(n, s.getAttribute(n)); document.head.append(l); });
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
  // phone: no extra wait (Safari has no prerender, every second counts); the Work page's files are fetched at once, then the renderer / pictures are warmed
  const arm = () => { if (liftSel) { (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(preloadWork, { timeout: 800 }); (window.requestIdleCallback || ((f) => setTimeout(f, 400)))(warm, { timeout: 1500 }); return; } (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(() => setTimeout(warm, 800), { timeout: 3000 }); };

  const restore = () => { // the page came back from the cache (Back from the Work page): the hero as it was, no overlay
    root?.remove(); root = null; fl?.dispose(); fl = null; warmed = false; busy = false;
    hidden.forEach((n) => { n.el.style.zIndex = n.z; n.el.style.opacity = ''; n.el.style.visibility = ''; });
    hidden = [];
    document.querySelectorAll('.nav a').forEach((a) => { a.style.opacity = ''; });
    nav?.drive(0);
    // bfcache restore after the Work page's Back: the return mark was written before Work left. Mark -> hero frame layer + landing (no reload, no loader); no mark -> the hero as it was.
    window.__pxgSrc = 'pageshow persisted'; window.__paintPxg?.(); if (document.getElementById('pxg-card')) { const w = document.querySelector('a.twm'); if (w) w.style.visibility = 'hidden'; } // (the card-first layer carries the small wordmark until the grow starts)
   
    const back = !!document.getElementById('pxg');
    dbg('bfcache restore: return mark', back ? 'found, playing the landing' : 'none, hero as it was');
    if (back) arriveFromWork(hero, null); else { clearHandoff('pxh'); returnLine('pageshow persisted', null, false); }
    arm();
  };
  addEventListener('pageshow', (e) => { dbg('pageshow persisted:', e.persisted); if (e.persisted) restore(); });

  link.addEventListener('click', async (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented || busy) return;
    if (!homeFlightOK() || !fl || fl.dead || !root) return; // not ready: the plain link
    e.preventDefault(); busy = true;
    beforeFlight?.();
    pm('home:click');
    const r = wrapper.getBoundingClientRect(), heroBox = { x: r.left, y: r.top, w: r.width, h: r.height }, card = workStartLayout().first;
    const frameOK = video.readyState >= 2 && fl.setPicture(0, video);
    if (!frameOK && !fl.setPicture(0, posterIm, 'poster')) { busy = false; location.href = '/work/'; return; }
    root.style.visibility = '';
    // the covered hero layers above the flight fade out in fadeSec; the ticker band is cloned (it lives inside the hero's own layer)
    const ticker = hero?.frame?.pin?.querySelector('.ticker'); let clone = null;
    if (ticker) { clone = ticker.cloneNode(true); const tr = ticker.getBoundingClientRect(); clone.style.cssText += `;position:fixed;left:${tr.left}px;top:${tr.top}px;width:${tr.width}px;height:${tr.height}px;transform:none;opacity:${getComputedStyle(ticker).opacity};z-index:7;pointer-events:none`; document.body.append(clone); }
    const lift = [...document.querySelectorAll(liftSel || '.spawner, .trail, .hero__captions, .caption-hover')];
    lift.forEach((el) => { hidden.push({ el, z: el.style.zIndex }); el.style.zIndex = '7'; });
    const fade = [...lift, ...(clone ? [clone] : []), ...document.querySelectorAll('.nav a')];
    gsap.to(fade, { opacity: 0, duration: F.fadeSec, ease: 'none' });
    try { sessionStorage.removeItem('work-lite-place'); } catch { /* */ } // the phone Work page opens on the first card, not on the place it was left at
    saveHeroFrame(video); // the grow flight on the way back starts from this frame (async, off the main thread)
    let lost = false; fl.onLost = () => { lost = true; playFlight.cancel?.(); };
    const lay = workStartLayout(), nbs = nbIms.filter((x) => fl.has(x.slot)).map((x) => ({ slot: x.slot, rect: x.n.rect, start: x.n.start }));
    await playFlight(fl, { hero: heroBox, card, dir: 'in', neighbours: nbs, vertical: lay.vertical, onFrame: (st) => nav?.drive(1 - st.size) });
    const wm = liftSel ? null : document.querySelector('a.wordmark'); // (the phone Work page's own small wordmark appears with the strip)
    writeHandoff('pxh', { W: innerWidth, H: innerHeight, rect: [card.x, card.y, card.w, card.h], slug: project.slug, src: cardIm.currentSrc || cardIm.src, cards: nbIms.filter((x) => fl && fl.has(x.slot)).map((x) => ({ rect: [x.n.rect.x, x.n.rect.y, x.n.rect.w, x.n.rect.h], slug: x.slug, src: x.im.currentSrc || x.im.src })), wm: wm ? { src: wm.querySelector('img')?.getAttribute('src'), style: wm.style.cssText + `;position:fixed;left:0;top:0;width:${wm.offsetWidth}px;height:${wm.offsetHeight}px;z-index:9` } : liftSel ? { src: data.hero.wordmark, auto: 1, style: `position:fixed;left:${TALL.wmSmall.x}vw;top:${TALL.wmSmall.y}vh;width:${TALL.wmSmall.width}vw;z-index:9` } /* live fix 03.11: the landing layer's wordmark at the phone's CURRENT small spot (top-centre, R48), not the old top-left one: it showed as a 2nd wordmark */ : null, title: liftSel ? liteTitle(project, card) : null });
    pm('home:land');
    if (lost) { /* the overlay holds the last drawn frame; the Work page paints its own */ }
    location.href = '/work/';
  });
  arm();
  return { warm, restore, readHandoff };
}

// R45b round 2: the phone Work page's title as it will stand at rest (the formula of src/work/tall-title.js layout(): size from the frame width, the short title when the full one does not fit), so the landing layer reads as the
// Work page while it loads. Centred with CSS (no dependence on the font being measured here).
function liteTitle(project, card) {
  try {
    const family = '"Clash Display", system-ui, sans-serif', c = document.createElement('canvas').getContext('2d'), fw = card.w;
    // live fix 03.11: the SAME rule as the live phone title (tall-title.js, R48 r3): full title when it fits at >= minFullScale of the base size, else the short one, scaled to fit inside the
    // card with sidePad; before, the landing layer used the old rule and showed the short title, then the live strip swapped it to the full one
    const baseSize = Math.max(LITE_TITLE.minSize, Math.min(LITE_TITLE.maxSize, fw * LITE_TITLE.frameShare));
    const wAt = (t, sz) => { c.font = `${WORK_TITLE.weight} ${sz}px ${family}`; return c.measureText(t).width + (WORK_TITLE.tracking || 0) * sz * t.length; };
    const avail = fw * (1 - 2 * (LITE_TITLE.sidePad || 0)), full = project.title, short = project.titleShort || TITLE_SHORT[project.slug] || full;
    const fitSize = (t) => Math.min(baseSize, baseSize * avail / Math.max(wAt(t, baseSize), 1));
    const fullSize = fitSize(full), useFull = fullSize >= baseSize * (LITE_TITLE.minFullScale ?? 0.6) || short === full;
    const text = useFull ? full : short, size = useFull ? fullSize : fitSize(short);
    return { text, size, weight: WORK_TITLE.weight, tracking: WORK_TITLE.tracking, top: innerHeight / 2 - size / 2 };
  } catch { return null; }
}

// R45: the homepage after the Work page's grow flight: the hero frame it ended on is painted (index.html); the video takes over and the layer fades. Resolves when the layer is gone.
export function arriveFromWork(hero, loadDeferred) {
  clearHandoff('pxg');
  loadDeferred?.();
  const layer = document.getElementById('pxg'), video = hero.frame.video;
  const grown = layer?.dataset.card ? growFromCard(layer) : (returnLine(window.__pxgSrc || 'reload', window.__pxgAge, false, 'work flew itself'), Promise.resolve());
  return grown.then(() => new Promise((resolve) => {
    const done = () => {
      try { window.__r45vt?.skipTransition(); } catch { /* */ } // R45b: release the held Work frame; the layer (same picture) is still up under it
      gsap.to(layer, { opacity: 0, duration: F.landFadeSec, ease: 'sine.inOut', onComplete: () => { layer.remove(); document.documentElement.classList.remove('pxg-on'); resolve(); } });
    };
    let fired = false; const go = () => { if (fired) return; fired = true; requestAnimationFrame(() => requestAnimationFrame(done)); };
    if (video.readyState >= 3 && !video.paused && video.currentTime > 0) go();
    else { video.addEventListener('playing', go, { once: true }); video.addEventListener('timeupdate', go, { once: true }); setTimeout(go, 1500); }
  }));
}

// R48 r7-8 part 4.5: ?debug=handoff (sticky: localStorage dbg-handoff) shows one line on screen
function returnLine(source, age, played, note) {
  try {
    if (localStorage.getItem('dbg-handoff') !== '1') return;
    let el = document.getElementById('dbg-return');
    if (!el) { el = document.createElement('div'); el.id = 'dbg-return'; el.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:200;font:10px/1.3 monospace;color:#0f0;background:rgba(0,0,0,.75);padding:3px 5px;pointer-events:none;max-width:96vw'; document.body.append(el); }
    el.textContent = 'return: source=' + source + ', record age ' + (age == null ? 'none' : Math.round(age) + ' ms') + ', played ' + (played ? 'yes' : 'no') + (note ? ' (' + note + ')' : '');
  } catch { /* */ }
}

// R48 r7-8 part 4: Work was left by Safari (edge swipe, toolbar Back): the first frame painted by index.html is the flight's first frame (the centred card where it stood, the small wordmark). The card -> hero
// grow (the same flight Work plays when it flies itself, + the wordmark small -> big) is played HERE; afterwards #pxg holds the hero frame and arriveFromWork lets the video take over as always.
async function growFromCard(layer) {
  const rec = window.__pxgRec, frame = window.__pxgFrame || '/media/hero/poster.webp', age = window.__pxgAge, src = window.__pxgSrc || 'reload';
  const twm = document.querySelector('a.twm'), wmIn = document.getElementById('pxg-wm');
  let played = false, fl = null, host = null;
  const finish = () => {
    layer.dataset.card = ''; layer.innerHTML = '<img alt="" decoding="sync" src="' + frame + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">';
    host?.remove(); fl?.dispose?.(); wmIn?.remove();
    if (twm) { twm.style.transform = ''; twm.style.visibility = ''; }
    returnLine(src, age, played);
  };
  try {
    if (!rec || !homeFlightOK()) { finish(); return; }
    const cardIm = cardImage(rec.src), heroIm = new Image(); heroIm.src = frame;
    await Promise.all([cardIm.decode().catch(() => {}), heroIm.decode().catch(() => {})]);
    host = document.createElement('div'); host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:fixed;inset:0;z-index:8;pointer-events:none;background:var(--bg)';
    document.body.append(host);
    fl = createHomeFlight(host);
    if (!fl) { finish(); return; }
    let lost = false; fl.onLost = () => { lost = true; playFlight.cancel?.(); };
    fl.setPicture(0, cardIm, 'card'); fl.setPicture(1, heroIm, 'hero');
    const hero = { x: 0, y: 0, w: innerWidth, h: innerHeight }, card = { x: rec.rect[0], y: rec.rect[1], w: rec.rect[2], h: rec.rect[3] };
    fl.draw({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }, flightState(0, 'out'), flightState(0, 'out')); // (replaced by the real first frame in playFlight, same task)
    // the wordmark: Home's big one starts at the small spot Work had (translate + scale from the top-left), grows to rest with the flight
    let setWm = null;
    if (twm && rec.wm) {
      twm.style.transform = ''; twm.style.visibility = ''; const rb = twm.getBoundingClientRect(); twm.style.transformOrigin = '0 0';
      const k = rec.wm[2] / rb.width, dx = rec.wm[0] - rb.x, dy = rec.wm[1] - rb.y;
      setWm = (t) => { twm.style.transform = 'translate(' + dx * (1 - t) + 'px,' + dy * (1 - t) + 'px) scale(' + (k + (1 - k) * t) + ')'; };
      setWm(0); wmIn?.remove();
    } else if (twm) { twm.style.visibility = ''; wmIn?.remove(); }
    played = true;
    await playFlight(fl, { hero, card, dir: 'out', vertical: workStartLayout().vertical, onFrame: (st) => setWm?.(st.size) });
    if (lost) played = false;
  } catch { played = false; }
  finish();
}
