import { viewW } from '../util/viewport.js';
// Lite title only: the desktop smear renderer and timing, with phone/tablet type.
import '../styles/tall-work.css';
import { createSmear } from '../effects/text-fx/smear.js';
import { TITLE_SHORT, WORK_TITLE, WORK_SMEAR, WORK_TEXT } from '../timeline.js';
import { pm, perfOn } from '../util/perf-mark.js';
import { fitLiteTitle } from '../util/title-fit.js';
import { timed } from './rest.js';

export function createLiteTitle({ app, projects, reduced, rest }) {
  const root = document.createElement('div'); root.className = 'lite-title'; root.setAttribute('aria-hidden', 'true');
  const el = document.createElement('span'); el.className = 'lite-title__text'; root.append(el); app.append(root);
  const smear = createSmear({ host: root, cfg: WORK_SMEAR, reduced });
  const measure = document.createElement('canvas').getContext('2d');
  const family = '"Clash Display", system-ui, sans-serif';
  const plain = reduced || new URLSearchParams(location.search).get('fx') === '0';
  let moveLogged = false, ready = false, warmed = false, shown = -1, opacity = 0, fw = 0, fh = 0, options = [], last = null, warmTimer = 0, warmedFor = -1;

  // R41f: every title start / cancel with its trigger (the ?perf report field titlePlays)
  const plays = []; const logT = (what, why, extra) => { plays.push({ at: Math.round(performance.now()), what, why, idx: shown, restFor: rest.restFor?.() || 0, ...extra }); if (plays.length > 80) plays.shift(); };
  if (perfOn) window.__titlePlays = () => ({ note: 'play = a smear start; a settled project should show ONE play; cancel = why one was dropped', plays: plays.slice(-40) });
  let laidW = 0, laidH = 0;
  function layout(w = fw, h = fh, force = true) {
    if (!force && w === laidW && h === laidH && options.length) return; laidW = w; laidH = h; logT('layout', force ? 'forced' : 'size');
    fw = w; fh = h;
    if (!ready || !fw) return;
    smear.cancel();
    const color = getComputedStyle(root).color;
    options = projects.map(p => {
      // R48 r3: the title must fit INSIDE the card with LITE_TITLE.sidePad on each side. The desktop short-title rule: the full title when it fits at a size not under minFullScale of the base size,
      // else the short one; either way scaled down to fit (the letter-spacing counted).
      const { text, size } = fitLiteTitle(p, fw, measure, family); // (R50: one shared rule, src/util/title-fit.js)
      measure.font = `${WORK_TITLE.weight} ${size}px ${family}`;
      const m = measure.measureText(text), asc = m.fontBoundingBoxAscent ?? size * .9, desc = m.fontBoundingBoxDescent ?? size * .25, tw = m.width + (WORK_TITLE.tracking || 0) * size * text.length;
      const top = innerHeight / 2 - size / 2;
      return { el, text, size, weight: WORK_TITLE.weight, family, color, tracking: WORK_TITLE.tracking,
        x: (viewW() / 2) - tw / 2, /* the card's centre = the strip's centre (the same width) */ baseline: top + (size - asc - desc) / 2 + asc, top };
    });
    if (shown >= 0) setTitle(shown);
    el.style.visibility = ''; el.style.opacity = String(opacity);
    if (!plain && !warmed) {
      warmed = true; ready = false;
      // Fonts can finish before core supplies the picture size. Warm here,
      // once geometry exists, so the first play never compiles on its clock.
      smear.scrub({ ...options[0], alpha: 0 }, .5);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        smear.release(); el.style.opacity = String(opacity); ready = true;
        if (fw !== w || fh !== h) layout();
      }));
    }
  }
  function setTitle(idx) {
    shown = idx; const o = options[idx];
    el.textContent = o.text; el.style.fontSize = `${o.size}px`; el.style.fontWeight = String(o.weight);
    el.style.left = `${o.x}px`; el.style.top = `${o.top}px`;
    el.style.letterSpacing = `${o.tracking}em`;
  }
  // R41c: the leave is a CSS opacity transition (compositor): it finishes on time even if the main thread stalls, and costs nothing per frame. play() sets it back to none.
  // R41c: build the text textures of the settled project and its neighbours at true rest, ONE per task, so the play after a flick builds nothing. Cancelled when the strip moves again.
  const warmNear = (idx) => {
    if (plain || !smear || warmedFor === idx) return; warmedFor = idx; cancelWarm();
    // R41d: each texture is a job on the shared rest queue (>= 250 ms of rest, then 90 ms apart, one per frame); the queue drops them the moment a finger / wheel returns
    const order = [0, 1, -1, 2, -2].map((d) => (idx + d + options.length * 4) % options.length), todo = [...new Set(order)];
    todo.forEach((i, n) => { const key = 'title' + n; warmKeys.push(key); rest.schedule(key, 'titleTexture', () => { if (!smear.playing && last?.stopped) smear.warm({ ...options[i], alpha: 0 }); }, 250 + n * 90); });
  };
  const warmKeys = [];
  const cancelWarm = () => { clearTimeout(warmTimer); warmKeys.splice(0).forEach((k) => rest.cancel(k)); };
  const callbacks = () => ({ done: () => { opacity = 1; }, aborted: () => { opacity = 0; } });
  let startSeq = 0, startAt = 0; // R48 r4: counts every title entrance (a smear play, or the plain fade-in) and when it began: the details row follows it
  function play() {
    startSeq++; startAt = performance.now();
    pm('lite:title-start'); logT('play', 'settle+rest.ok', { stopped: !!last?.stopped });
    smear.play({ ...options[shown], ...callbacks() });
    pm('lite:title-scheduled');
  }
  // R48 r7: the fit / short-title choice and the smear texture are made only once the title font has REALLY loaded for every title's letters (a fallback-font measurement made "Techcomba" clip, then swap to the
  // full title): load the font for all the texts, wait for document.fonts.ready, and re-check with fonts.check (Safari can resolve load() early).
  const texts = projects.flatMap((p) => [p.title, p.titleShort || TITLE_SHORT[p.slug]]).filter(Boolean).join(' ');
  const fontSpec = `${WORK_TITLE.weight} 80px ${family}`;
  const whenFont = async () => { try { await document.fonts?.load(fontSpec, texts); await document.fonts?.ready; for (let i = 0; i < 20 && document.fonts && !document.fonts.check(fontSpec, texts); i++) { await new Promise((r) => setTimeout(r, 50)); await document.fonts.load(fontSpec, texts); } } catch { /* the layout still runs */ } };
  let fontTimer;
  Promise.race([whenFont(), new Promise((r) => { fontTimer = setTimeout(r, 1500); })]).then(() => { clearTimeout(fontTimer); ready = true; layout(); });
  // A stalled font uses fallback metrics; measure again if the web font eventually arrives.
  document.fonts?.addEventListener('loadingdone', () => { if (ready) layout(); });
  document.addEventListener('anhv-theme', () => layout());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { logT('cancel', 'page hidden'); cancelWarm(); warmedFor = -1; smear.cancel(); opacity = 0; el.style.transition = 'none'; el.style.opacity = '0'; }
  });
  return {
    root, smear, layout,
    frame(s) {
      if (!ready || !options.length) return;
      last = s; smear.sweep();
      if (import.meta.env.DEV && window.__titleScrub) return;
      const stopped = s.stopped && !s.transitioning;
      if (stopped) moveLogged = false;
      if (!stopped) {
        cancelWarm(); warmedFor = -1;
        if (smear.playing) { if (!moveLogged) { moveLogged = true; logT('cancel', 'strip moving (abort)'); } smear.abort(); }
        else if (opacity > 0) { if (plain) { opacity = Math.max(0, opacity - s.dt / WORK_TEXT.titleOutSec); el.style.opacity = String(opacity); } else { logT('hide', 'strip moving'); el.style.transition = 'none'; el.style.opacity = '0'; opacity = 0; } }
        return;
      }
      const idx = s.idxHead;
      if (smear.playing && shown !== idx) { smear.cancel(); opacity = 0; el.style.transition = 'none'; el.style.opacity = '0'; }
      if (smear.playing) { if (smear.leaving && shown === idx) smear.resume(); return; }
      if (shown !== idx || opacity < .95) {
        if (!plain && !rest.ok()) return; // R41e: the set / play wait for the shared rest signal (checked again next frame)
        if (plain) {
          if (shown !== idx) { opacity = Math.max(0, opacity - s.dt / .2); if (!opacity) { setTitle(idx); startSeq++; startAt = performance.now(); } }
          else opacity = Math.min(1, opacity + s.dt / .2);
          el.style.opacity = String(opacity);
        } else { timed('titleSet', () => setTitle(idx)); el.style.transition = 'none'; el.style.opacity = '0'; timed('titlePlay', play); }
      } else if (!plain && opacity >= .95) warmNear(idx);
    },
    scrubTitle(idx, seconds) {
      if (!ready) return;
      setTitle(idx);
      const u = .5 * (1 - (1 - Math.min(1, seconds / WORK_SMEAR.enterSec)) ** WORK_SMEAR.enterPow);
      smear.scrub(options[idx], u);
    },
    get seq() { return startSeq; }, get at() { return startAt; },
    get state() { return { shown, opacity, playing: smear.playing, gl: smear.gl, ready, stopped: last?.stopped }; },
  };
}
