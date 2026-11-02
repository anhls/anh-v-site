// R48 Part B: the phone / tablet-portrait Work page's details row. It sits UNDER the cards layer (core puts it in .work before the canvas stage: the cards scroll over it) at a fixed place
// directly below the centred card's rest position: left = the split counter (big current number + small "/NN", NN = the visible projects), then the year, then the description
// (3 lines, from the desktop projectInfo()). A thin full-width line at the centred card's top edge sits behind the cards, static while the strip scrolls.
// Motion follows the desktop Work UI (v2-ui.js): when the strip heads to another project the three columns roll OUT line by line (up + fade + a little blur); at scroll stop they roll
// IN from below, and the counter's digit rolls like the desktop drum. It is driven by the same per-frame state core.js gives the desktop UI (v2s: stopped / idxHead / dt), so it
// changes exactly when the title changes. Transform / opacity / filter only; nothing is read per frame. Reduced motion = a plain swap.
import '../styles/tall-work.css';
import { projectInfo } from './v2-ui.js';
import { TALL_DETAILS as D } from '../settings/tall.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');

export function createTallDetails({ projects, reduced }) {
  const N = projects.length;
  const infos = projects.map((p) => projectInfo(p, D.descChars));
  const root = document.createElement('div'); root.className = 'td'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <i class="td__line"></i>
    <div class="td__row">
      <div class="td__count"><span class="td__num"><span class="td__digits"></span></span><span class="td__tot">/${pad(N)}</span></div>
      <div class="td__year td__col"></div>
      <div class="td__desc td__col"></div>
    </div>
    <div class="td__sr" role="status" aria-live="polite"></div>`;
  const row = root.querySelector('.td__row'), line = root.querySelector('.td__line'), digitsEl = root.querySelector('.td__digits');
  const yearEl = root.querySelector('.td__year'), descEl = root.querySelector('.td__desc'), srEl = root.querySelector('.td__sr');
  let shown = -1, state = 'out', fw = 0, fh = 0, token = 0, timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const lineHtml = (txt) => `<span class="td__ln"><span class="td__rin">${esc(txt)}</span></span>`;
  // the description in its real rendered lines (words laid out in the column, grouped by their top), at most D.descLines
  const splitDesc = (text) => {
    if (!text) return [];
    descEl.textContent = '';
    const spans = text.split(' ').map((w) => { const sp = document.createElement('span'); sp.textContent = `${w} `; descEl.append(sp); return sp; });
    const out = []; let top = null, cur = '';
    spans.forEach((sp) => { const t = sp.offsetTop; if (top === null || Math.abs(t - top) > 4) { if (cur) out.push(cur.trim()); cur = ''; top = t; } cur += sp.textContent; });
    if (cur) out.push(cur.trim());
    descEl.textContent = '';
    if (out.length > D.descLines) { const keep = out.slice(0, D.descLines); keep[D.descLines - 1] = keep[D.descLines - 1].replace(/[\s,.;:—–-]+$/, '') + '…'; return keep; }
    return out;
  };
  const setCounter = (idx, from) => { // the two digits as masked drums: the old number rolls up, the new one comes from below (same direction as the strip would count)
    const next = pad(idx + 1), prev = from < 0 ? null : pad(from + 1);
    digitsEl.textContent = '';
    [...next].forEach((ch, i) => {
      const slot = document.createElement('span'); slot.className = 'td__slot';
      const col = document.createElement('span'); col.className = 'td__col2';
      const old = prev ? prev[i] : ch;
      col.innerHTML = `<span>${old}</span><span>${ch}</span>`;
      slot.append(col); digitsEl.append(slot);
      if (old !== ch && !reduced) { col.style.transition = 'none'; col.style.transform = 'translateY(0)'; void col.offsetWidth; col.style.transition = ''; requestAnimationFrame(() => { col.style.transform = 'translateY(-50%)'; }); } else col.style.transform = 'translateY(-50%)';
    });
  };
  const lines = () => [...root.querySelectorAll('.td__ln .td__rin')];
  const rollOut = () => {
    if (state === 'out') return; state = 'out'; clearTimers(); token++;
    const ls = [...yearEl.querySelectorAll('.td__rin'), ...descEl.querySelectorAll('.td__rin')];
    ls.forEach((el, i) => { el.style.transitionDelay = `${i * D.stagger}s`; el.classList.add('is-out'); el.classList.remove('is-in'); });
    row.classList.add('is-out');
  };
  const rollIn = (idx) => {
    const from = shown; shown = idx; state = 'in'; clearTimers(); const my = ++token;
    const info = infos[idx];
    yearEl.innerHTML = info.year ? lineHtml(info.year) : '';
    descEl.innerHTML = '';
    descEl.innerHTML = splitDesc(info.desc).map(lineHtml).join('');
    setCounter(idx, from);
    srEl.textContent = `${pad(idx + 1)} of ${pad(N)}. ${info.year}`;
    const ls = [...yearEl.querySelectorAll('.td__rin'), ...descEl.querySelectorAll('.td__rin')];
    ls.forEach((el) => { el.style.transitionDelay = '0s'; el.classList.add('is-out'); el.classList.remove('is-in'); });
    row.classList.remove('is-out');
    void row.offsetWidth;
    requestAnimationFrame(() => { if (my !== token) return; ls.forEach((el, i) => { el.style.transitionDelay = `${i * D.stagger}s`; el.classList.remove('is-out'); el.classList.add('is-in'); }); });
  };

  const layout = (w, h) => {
    fw = w; fh = h;
    const W = innerWidth, H = innerHeight, L = (W - w) / 2, top = H / 2 - h / 2, bottom = H / 2 + h / 2;
    root.style.setProperty('--td-left', `${L}px`); root.style.setProperty('--td-w', `${w}px`);
    root.style.setProperty('--td-line-y', `${top + D.lineInset * h}px`);
    root.style.setProperty('--td-row-y', `${bottom + D.rowGap * h}px`);
    root.style.setProperty('--td-s', String(Math.min(1.25, Math.max(0.9, W / 390))));
    if (shown >= 0 && state === 'in') { const idx = shown, keep = state; shown = idx; yearEl.innerHTML = infos[idx].year ? lineHtml(infos[idx].year) : ''; descEl.innerHTML = splitDesc(infos[idx].desc).map(lineHtml).join(''); lines().forEach((el) => el.classList.add('is-in')); state = keep; }
  };
  document.fonts?.ready?.then(() => { if (shown >= 0 && fw) layout(fw, fh); });

  return {
    root,
    layout,
    // s = core's per-frame state: stopped (the strip rests on / heads to an image), idxHead (the project it heads to), transitioning (a project open flight)
    frame(s) {
      if (!fw) return;
      if (s.transitioning) return;
      if (!s.stopped) { if (shown >= 0) rollOut(); return; }
      if (shown !== s.idxHead || state === 'out') rollIn(s.idxHead);
    },
    get state() { return { shown, state }; },
  };
}
