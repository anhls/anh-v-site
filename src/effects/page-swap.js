// R42: the Work page's same-document router. A project opens INSIDE the Work document (no page load): the flight (project-transition.js) plays, the
// project page (src/project/in-place.js, the same builders as work/<slug>.html) is built under it and shown when the flight lands; history.pushState
// gives /work/<slug>.html. The Work strip is PAUSED, not destroyed (core.js pause()/resume()): on back (popstate, the project nav's Works link) the
// reverse flight plays from the header's CURRENT place into the live strip, WITH the bend, and the project page is torn down completely.
// Anything that fails -> today's plain navigation. Modified clicks, reloads, direct visits and the homepage never come here.
import { gsap } from 'gsap';
import { FLIGHT } from '../settings/shared.js';
import { TRANSITION as T } from '../timeline.js';
import { isTall } from '../util/layout-mode.js';
import { timed } from '../work/rest.js';
import { pm } from '../util/perf-mark.js';
import { runProjectTransition, playBack, transitionOK, holdBack, releaseBack, preloadHeader } from './project-transition.js';

const SLUG = /\/work\/([^/]+?)(?:\.html)?\/?$/;
const slugOfPath = (p) => { const m = p.match(SLUG); return m && m[1] !== 'index' ? m[1] : null; };

export function createPageSwap() {
  let ctl = null, mod = null, modP = null;
  let state = 'work'; // work | opening | project | closing
  let view = null, slugNow = null, refNow = null, imageNow = null, wantBack = false;
  const tall = isTall();
  const hard = (slug) => { try { location.replace(`/work/${slug}.html`); } catch { /* */ } };

  const warm = () => {
    if (!modP) modP = import('../project/in-place.js').then((m) => { mod = m; return m; }, () => { modP = null; });
    return modP;
  };

  function open({ slug, ref, flight, begin, image, push = true }) {
    if (!mod || !ctl || state !== 'work') return false;
    let v;
    try { v = pre?.slug === slug ? pre.view : mod.createProjectView({ slug, tall, onBack: () => back(true) }); } catch { return false; }
    if (pre?.slug === slug) pre = null; else dropPre();
    if (!v) return false;
    if (push) { try { history.pushState({ pj: slug }, '', `/work/${slug}.html`); } catch { return false; } } // (forward / back through history: the URL is already there)
    view = v; slugNow = slug; refNow = ref; imageNow = image; state = 'opening'; wantBack = false;
    mod.warmHead(slug);
    // built a few frames into the flight (never in the click's own frame); the DOM build is one task of a few ms
    // normally built ahead on idle (prebuild); a click before that builds it a few frames into the flight (never in the click's own frame)
    // R41f: a tap that comes before the idle build finished builds and primes the page in small steps, ONE per frame, spread over the flight (never one block mid-flight); the landing waits for the last step
    const built = v.built && !v.primeLeft?.() ? Promise.resolve() : !flight ? new Promise((res, rej) => setTimeout(() => { try { v.build(); res(); } catch (e) { rej(e); } }, 0)) : new Promise((res, rej) => {
      const step = () => { try { if (!v.built) v.buildStep(); else if (v.primeStep()) { res(); return; } } catch (e) { rej(e); return; } requestAnimationFrame(step); };
      setTimeout(() => requestAnimationFrame(step), 60);
    });
    const land = async () => {
      await built;
      await v.headerReady();
      const wmSmall = !!document.querySelector('body > a.wordmark.is-link'); // read at the landing (the Work wordmark shrinks after the first input): small -> the project's grows to big, no jump
      ctl.pause();
      await v.show({ wmSmall });
    };
    const fail = (err) => { try { console.error('[page-swap]', err); } catch { /* */ } releaseBack(); try { v.destroy(); } catch { /* */ } view = null; state = 'work'; hard(slug); };
    const done = () => {
      state = 'project';
      holdBack(slug, v.headerSrc()); // R42c: the renderer that draws the way back with the bend stays alive while the page is open (the flight hands its own over)
      if (wantBack) back();
    };
    if (flight) runProjectTransition({ ...flight, inPlace: { show: land, done, fail } });
    else { begin?.(); land().then(done, fail); }
    return true;
  }

  // the way back: the overlay (the header as it is now) goes on top, the strip resumes under it, the project page is hidden and torn down
  function back(viaHistory = false, instant = false) {
    if (state === 'opening') { wantBack = true; return; }
    if (state !== 'project') return;
    if (viaHistory) { try { history.back(); return; } catch { /* fall through */ } }
    state = 'closing'; pm('back:arrive'); // (R41h: the in-place back is a run in the ?perf report too)
    const v = view, slug = slugNow;
    const animate = !instant && transitionOK(); // (R41f: instant = the browser already played its own swipe transition: land straight in the strip) (lite with the effect off, reduced motion, ?gl=0: back is instant, same project, same place)
    // R42c: header scrolled away: the page glides to the top first (time-based; into the shrink without a stop), then the shrink plays from the full-screen pose
    if (animate && scrollY > 1 && v.glideTop) {
      const sec = T.backGlideSec * Math.min(1, Math.max(T.backGlideMin, scrollY / innerHeight));
      v.glideTop(() => finishBack(v, slug), sec);
      return;
    }
    finishBack(v, slug, instant);
  }
  function finishBack(v, slug, instant = false) {
    const leave = v.backRecord();
    const animate = !instant && transitionOK();
    const shrink = leave.mode === 'shrink';
    if (!animate) {
      releaseBack();
      try { v.destroy(); } catch { /* */ }
      ctl.resume({ slug, shrink: false });
      requestAnimationFrame(() => { ctl.finish(); view = null; state = 'work'; });
      return;
    }
    const rec = { slug, zEnd: FLIGHT.zEnd, blackMax: T.blackMax, src: v.headerSrc(), leave };
    const root = document.createElement('div');
    root.id = 'pxb'; root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:8;overflow:hidden;pointer-events:none';
    const s = leave.sec, i = leave.img;
    root.innerHTML = `<div class="px__bg" style="position:absolute;inset:0;background:var(--bg);opacity:${shrink && typeof T.blackMax === 'number' ? T.blackMax : 1}"></div>` +
      (shrink ? `<div class="px__box" style="position:absolute;overflow:hidden;left:${s[0]}px;top:${s[1]}px;width:${s[2]}px;height:${s[3]}px"><img alt="" decoding="sync" src="${rec.src}" style="position:absolute;left:${i[0] - s[0]}px;top:${i[1] - s[1]}px;width:${i[2]}px;height:${i[3]}px;object-fit:cover;display:block"></div>` : '');
    document.body.prepend(root);
    try { v.destroy(); } catch { /* */ } // before resume: the project's Lenis must not move the window under the strip's new Lenis
    ctl.resume({ slug, shrink });
    try {
      playBack({ rec, target: ctl.frameRect(slug), fade: ctl.fadeEls, onPush: ctl.backPush, done: () => { ctl.finish(); view = null; state = 'work'; warmNext(); } });
    } catch (e) { root.remove(); ctl.finish(); view = null; state = 'work'; }
  }
  // the centred project's page, built hidden while the strip rests (one at a time; replaced when another project is centred)
  let pre = null, preTimer = 0;
  const dropPre = () => { clearTimeout(preTimer); if (pre) { try { pre.view.destroy(); } catch { /* */ } pre = null; } };
  // R41d: `calm()` = the strip is at rest (core's rest signal). The build / prime steps wait for it (re-checked every 100 ms) and cancelPrebuild() (a finger / wheel) drops a step that has not started.
  let preIdle = 0;
  const cancelPrebuild = () => { clearTimeout(preTimer); if (preIdle) { (window.cancelIdleCallback || clearTimeout)(preIdle); preIdle = 0; } };
  const prebuild = (slug, calm = () => true) => {
    if (!mod || state !== 'work') return;
    const whenCalm = (fn, tries = 0) => { if (state !== 'work' || tries > 30) return; if (calm()) fn(); else preTimer = setTimeout(() => whenCalm(fn, tries + 1), 100); };
    const idle = (fn, timeout) => { preIdle = (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(() => { preIdle = 0; whenCalm(fn); }, { timeout }); };
    if (pre?.slug === slug) { if (pre.next) idle(pre.next, 1500); return; } // (a touch interrupted the stages: carry on from where they stopped)
    dropPre(); cancelPrebuild();
    preTimer = setTimeout(() => idle(() => {
      if (state !== 'work' || pre) return;
      try {
        const v = mod.createProjectView({ slug, tall, onBack: () => back(true) });
        if (v) {
          pre = { slug, view: v, next: null };
          // R41d: one stage per idle slice (blocks, footer, then the page's sections one at a time), each timed and each waiting for the strip to be calm again
          const next = () => { if (pre?.view !== v || state !== 'work') return; if (!calm()) { idle(next, 1500); return; } const done = timed(v.built ? 'pagePrime' : 'pageBuild', () => (v.built ? v.primeStep() : (v.buildStep(), false))); if (done) pre.next = null; else idle(next, 1500); };
          pre.next = next; next();
        }
      } catch { pre = null; }
    }, 1500), 120);
  };
  const warmNext = () => {};

  // R41g Part B: our own swipe-right back. A horizontal swipe right that starts away from the screen edge (the edge swipe stays Safari's: it plays its own slide) goes back
  // exactly like the Back button (history.back -> popstate -> glide if scrolled + shrink into the strip). Horizontal intent = dx > 2x |dy| within the first 12 px, else the touch is
  // a normal vertical scroll and is left alone. The page follows the finger a little (35 %, at most 36 px); it triggers at 25 % of the width or a quick flick, else it springs back.
  const SW = { edge: 24, lock: 12, ratio: 2, share: 0.25, flickPxMs: 0.5, flickMin: 60, follow: 0.35, followMax: 36 };
  let sw = null;
  const swTarget = () => view?.el;
  const hScrollable = (n) => { for (; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) return true; } return false; };
  const swReset = (animate) => { const el = swTarget(); if (!el) return; if (animate) { el.style.transition = 'transform .18s ease-out'; el.style.transform = ''; setTimeout(() => { if (el.style.transition) el.style.transition = ''; }, 220); } else { el.style.transition = ''; el.style.transform = ''; } };
  addEventListener('touchstart', (e) => {
    sw = null;
    if (state !== 'project' || e.touches.length !== 1 || document.documentElement.classList.contains('tmenu-open')) return;
    const t = e.touches[0];
    if (t.clientX <= SW.edge || hScrollable(e.target)) return;
    sw = { x: t.clientX, y: t.clientY, t0: performance.now(), mode: 0, dx: 0 }; // mode 0 = undecided, 1 = horizontal (ours), -1 = vertical (not ours)
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!sw || sw.mode < 0) return;
    if (state !== 'project') { sw = null; return; }
    const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (sw.mode === 0) {
      if (Math.hypot(dx, dy) < SW.lock) return;
      if (dx > 0 && dx > SW.ratio * Math.abs(dy)) sw.mode = 1; else { sw.mode = -1; return; }
    }
    sw.dx = dx;
    if (e.cancelable) e.preventDefault(); // (ours now: the page does not scroll under the swipe)
    const el = swTarget(); if (el) { el.style.transition = 'none'; el.style.transform = `translate3d(${Math.max(0, Math.min(SW.followMax, dx * SW.follow))}px,0,0)`; }
  }, { passive: false });
  const swEnd = (cancel) => {
    const s = sw; sw = null;
    if (!s || s.mode !== 1) return;
    const ms = Math.max(1, performance.now() - s.t0), go = !cancel && state === 'project' && (s.dx > innerWidth * SW.share || (s.dx > SW.flickMin && s.dx / ms > SW.flickPxMs));
    if (go) { swReset(false); back(true); } else swReset(true);
  };
  addEventListener('touchend', () => swEnd(false), { passive: true });
  addEventListener('touchcancel', () => swEnd(true), { passive: true });

  addEventListener('popstate', (e) => {
    const slug = slugOfPath(location.pathname);
    if (!slug) { if (state === 'project' || state === 'opening') back(false, !!e.hasUAVisualTransition); return; }
    if (state === 'work' && mod && ctl) {
      const ref = ctl.refOf(slug);
      if (!ref || !open({ slug, ref, flight: null, begin: () => ctl.begin(slug), image: ctl.imageOf(slug), push: false })) location.reload();
    } else if (state === 'work') location.reload();
  });

  return {
    attach(c) { ctl = c; },
    warm, prebuild, cancelPrebuild, dropPre,
    ready: () => !!mod && !!ctl && state === 'work' && 'pushState' in history,
    open,
    back,
  };
}
