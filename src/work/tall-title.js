// Lite title only: the desktop smear renderer and timing, with phone/tablet type.
import '../styles/tall-work.css';
import { createSmear } from '../effects/text-fx/smear.js';
import { LITE_TITLE } from '../settings/tall.js';
import { TITLE_SHORT, WORK_TITLE, WORK_SMEAR, WORK_TEXT } from '../timeline.js';
import { pm } from '../util/perf-mark.js';
import { timed } from './rest.js';

export function createLiteTitle({ app, projects, reduced, rest }) {
  const root = document.createElement('div'); root.className = 'lite-title'; root.setAttribute('aria-hidden', 'true');
  const el = document.createElement('span'); el.className = 'lite-title__text'; root.append(el); app.append(root);
  const smear = createSmear({ host: root, cfg: WORK_SMEAR, reduced });
  const measure = document.createElement('canvas').getContext('2d');
  const family = '"Clash Display", system-ui, sans-serif';
  const plain = reduced || new URLSearchParams(location.search).get('fx') === '0';
  let ready = false, warmed = false, shown = -1, opacity = 0, fw = 0, fh = 0, options = [], last = null, warmTimer = 0, warmedFor = -1;

  function layout(w = fw, h = fh) {
    fw = w; fh = h;
    if (!ready || !fw) return;
    smear.cancel();
    const color = getComputedStyle(root).color;
    const baseSize = Math.max(LITE_TITLE.minSize, Math.min(LITE_TITLE.maxSize, fw * LITE_TITLE.frameShare));
    options = projects.map(p => {
      let size = baseSize;
      measure.font = `${WORK_TITLE.weight} ${size}px ${family}`;
      const full = p.title, short = p.titleShort || TITLE_SHORT[p.slug] || full;
      const text = measure.measureText(full).width <= fw * LITE_TITLE.fitFrac ? full : short;
      const width = measure.measureText(text).width;
      size *= Math.min(1, fw * LITE_TITLE.fitFrac / Math.max(width, 1));
      measure.font = `${WORK_TITLE.weight} ${size}px ${family}`;
      const m = measure.measureText(text), asc = m.fontBoundingBoxAscent ?? size * .9, desc = m.fontBoundingBoxDescent ?? size * .25;
      const top = innerHeight / 2 - size / 2;
      return { el, text, size, weight: WORK_TITLE.weight, family, color, tracking: WORK_TITLE.tracking,
        x: (innerWidth - m.width) / 2, baseline: top + (size - asc - desc) / 2 + asc, top };
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
  const fadeOut = () => { el.style.transition = `opacity ${WORK_TEXT.titleOutSec}s linear`; el.style.opacity = '0'; opacity = 0; };
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
  function play() {
    pm('lite:title-start');
    smear.play({ ...options[shown], ...callbacks() });
    pm('lite:title-scheduled');
  }
  const fonts = document.fonts?.load('600 80px "Clash Display"') || Promise.resolve();
  Promise.resolve(fonts).then(() => {
    ready = true; layout();
  });
  document.addEventListener('anhv-theme', () => layout());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelWarm(); warmedFor = -1; smear.cancel(); opacity = 0; el.style.transition = 'none'; el.style.opacity = '0'; }
  });
  return {
    root, smear, layout,
    frame(s) {
      if (!ready || !options.length) return;
      last = s; smear.sweep();
      if (import.meta.env.DEV && window.__titleScrub) return;
      const stopped = s.stopped && !s.transitioning;
      if (!stopped) {
        cancelWarm(); warmedFor = -1;
        if (smear.playing) smear.abort();
        else if (opacity > 0) { if (plain) { opacity = Math.max(0, opacity - s.dt / WORK_TEXT.titleOutSec); el.style.opacity = String(opacity); } else fadeOut(); }
        return;
      }
      const idx = s.idxHead;
      if (smear.playing && shown !== idx) { smear.cancel(); opacity = 0; el.style.transition = 'none'; el.style.opacity = '0'; }
      if (smear.playing) { if (smear.leaving && shown === idx) smear.resume(); return; }
      if (shown !== idx || opacity < .95) {
        if (plain) {
          if (shown !== idx) { opacity = Math.max(0, opacity - s.dt / .2); if (!opacity) setTitle(idx); }
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
    get state() { return { shown, opacity, playing: smear.playing, gl: smear.gl, ready, stopped: last?.stopped }; },
  };
}
