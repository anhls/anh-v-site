import { gsap } from 'gsap';
import { HOME_FLIGHT as F } from '../timeline.js';
import { writeHandoff, readHeroFrame, clearHandoff } from '../effects/home-handoff.js';
import { pm } from '../util/perf-mark.js';

// R45 (desktop Work page): the way back to the homepage. The CENTRED card smears and grows into the full hero (cross-fading to the hero frame the homepage left), the small wordmark
// grows big with it, then the homepage takes over (same document history when the Work page was entered from the homepage; otherwise a plain navigation with a hand-off record).
// Triggers: the browser Back button after the Home -> Work flight (popstate), the wordmark, and the Work page's own links to the homepage.
// The renderer is built on idle (home-flight.js is its own chunk, loaded then) so the click only draws.
// Also owns the arrival from the homepage flight: the landed card layer (#pxh, painted by work/index.html) fades out once the strip is up.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initHomeReturn({ items, px, py, bw, bh, fadeEls, nav, isBusy, setBusy, isPaused, firstReady }) {
  const params = new URLSearchParams(location.search);
  const off = reduced || params.get('gl') === '0' || navigator.connection?.saveData;
  let arrived = false, depth = 0;
  // R45c: a prerendered Work page is built long before the click; everything that depends on HOW it was entered (the landed-cards layer, the history entries) happens at ACTIVATION
  const arrive = () => {
    window.__paintPxh?.();
    const ov = document.getElementById('pxh');
    arrived = !!ov;
    const st = history.state?.r45;
    // history: [home, work 'first', work 'dup']: Back from 'dup' lands on 'first' (popstate here) = our cue to fly; the second step (history.back) leaves for the homepage
    if (arrived) { try { history.replaceState({ r45: 'first' }, ''); history.pushState({ r45: 'dup' }, ''); } catch { /* */ } }
    else if (st === 'first') { try { history.pushState({ r45: 'dup' }, ''); } catch { /* */ } }
    depth = arrived || st === 'first' ? 1 : 0;
    if (!ov) return;
    try { localStorage.removeItem('pxh'); } catch { /* */ }
    document.getElementById('pxh-wm')?.remove(); // the real small wordmark is up (lateNav ran before this)
    // never a black frame: the layer stays until the LIVE strip has drawn (the first card decoded + a few frames of the strip's own renderer after activation / load)
    (async () => {
      const t0 = performance.now();
      while (!firstReady() && performance.now() - t0 < 3000) await new Promise((r) => requestAnimationFrame(r));
      for (let i = 0; i < 8; i++) await new Promise((r) => requestAnimationFrame(r));
      pm('home:land-strip-ready');
      gsap.to(ov, { opacity: 0, duration: F.landFadeSec, ease: 'sine.inOut', onComplete: () => ov.remove() });
    })();
  };
  if (document.prerendering) document.addEventListener('prerenderingchange', arrive, { once: true }); else arrive();

  // ---- the flight
  let fl = null, mod = null, building = null, busy = false, frameIm = null;
  const build = () => building ||= import('../effects/home-flight.js').then((m) => {
    mod = m;
    if (!m.homeFlightOK()) return null;
    const host = document.createElement('div');
    host.className = 'hf'; host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:fixed;inset:0;z-index:8;pointer-events:none;visibility:hidden';
    document.body.append(host);
    fl = m.createHomeFlight(host);
    if (!fl) { host.remove(); return null; }
    fl.host = host; fl.onLost = () => { fl = null; };
    const src = readHeroFrame() || '/media/hero/poster.webp';
    frameIm = new Image(); frameIm.src = src;
    return frameIm.decode().catch(() => {}).then(() => { if (fl && !fl.dead) { fl.setPicture(1, frameIm, 'hero'); fl.draw({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }, m.flightState(0, 'out'), m.flightState(0, 'out')); } return fl; });
  });
  const prerenderHome = () => { try { if (!HTMLScriptElement.supports?.('speculationrules') || document.querySelector('script[data-r45]')) return; const sr = document.createElement('script'); sr.type = 'speculationrules'; sr.dataset.r45 = '1'; sr.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: ['/'] }] }); document.head.append(sr); } catch { /* */ } };
  if (!off) (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(() => setTimeout(() => { build(); prerenderHome(); }, 1200), { timeout: 4000 });

  const centred = () => { // the project the strip is showing now: the frame nearest the middle of the screen
    let best = null, bd = Infinity;
    for (const it of items) { if (it.kind !== 'frame') continue; const d = Math.hypot(px[it.idx] - innerWidth / 2, py[it.idx] - innerHeight / 2); if (d < bd) { bd = d; best = it; } }
    return best;
  };
  const plain = () => { location.href = '/'; };
  let navigated = false;
  const goHome = (viaHistory) => {
    if (navigated) return; navigated = true;
    writeHandoff('pxg', { W: innerWidth, H: innerHeight }); // the mark goes in BEFORE leaving, whatever the browser does with its cache: the homepage never shows its loader on a return
    if (viaHistory) { try { history.back(); return; } catch { /* */ } }
    plain(); // a normal navigation: Chrome activates the prerendered homepage (below)
  };

  async function leave(viaHistory) {
    if (busy || navigated) return;
    if (isPaused() || off || isBusy()) { if (viaHistory) goHome(true); else plain(); return; }
    busy = true; setBusy(true);
    try { await build(); } catch { /* plain */ }
    const it = centred();
    if (!fl || fl.dead || !it || !it.img?.complete || !it.img.naturalWidth) { goHome(viaHistory); return; }
    pm('home:leave-click');
    const card = { x: px[it.idx] - bw[it.idx] / 2, y: py[it.idx] - bh[it.idx] / 2, w: bw[it.idx], h: bh[it.idx] };
    const hero = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    fl.setPicture(0, it.img);
    fl.host.style.visibility = '';
    gsap.to(fadeEls, { opacity: 0, duration: F.fadeSec, ease: 'none' });
    let lost = false; fl.onLost = () => { lost = true; mod.playFlight.cancel?.(); };
    let vertical = false; try { vertical = localStorage.getItem('work-mode') === 'vertical'; } catch { /* */ }
    await mod.playFlight(fl, { hero, card, dir: 'out', vertical, onFrame: (s) => nav?.drive(1 - s.size) });
    if (lost) { goHome(viaHistory); return; }
    goHome(viaHistory); // the host keeps the last frame (the hero frame, full screen) until the document goes
  }

  addEventListener('popstate', (e) => { if (e.state?.r45 === 'first') leave(true); });
  // restored from the cache with the flight still on screen (the Forward button, or a failed Back): start clean
  addEventListener('pageshow', (e) => { if (!e.persisted) return; navigated = false; busy = false; setBusy(false); fl?.host?.remove(); fl?.dispose(); fl = null; building = null; gsap.set(fadeEls, { clearProps: 'opacity' }); nav?.drive(1); clearHandoff('pxg'); if (!off) (window.requestIdleCallback || ((f) => setTimeout(f, 600)))(() => setTimeout(build, 1200), { timeout: 4000 }); });

  const wm = document.querySelector('a.wordmark');
  wm?.addEventListener('click', (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || off) return; e.preventDefault(); leave(false); });
  return { leave };
}
