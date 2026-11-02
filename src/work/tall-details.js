// R48 Part B (round 3, Anh's iPhone mock 03.11 01:21): the phone / tablet-portrait Work page's details, UNDER the cards layer (core puts it in .work before the canvas stage: the cards scroll over it).
// ABOVE the centred card, left on its left edge: the counter (big current number + small "/NN", NN = the visible projects). BELOW the card: the YEAR (left edge) and the TAGS (the desktop "Role"
// tags, max 3, one per line, the widest line ending on the card's right edge). No description, no line. Every size and gap is in TALL_DETAILS (src/settings/tall.js, vw of a 430 px screen) and
// is placed by INK (the glyph edges, not the text boxes). The counter is the DESKTOP drum (v2-ui.js setCounter, same WORK_COUNTER numbers): it rolls DURING the scroll. Year / tags roll out
// line by line when the strip moves and in at scroll stop (CSS transitions; the desktop rolls them on springs: logged). Reduced motion = a plain swap.
import '../styles/tall-work.css';
import { projectInfo } from './v2-ui.js';
import { TALL_DETAILS as D } from '../settings/tall.js';
import { WORK_COUNTER } from '../timeline.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');

export function createTallDetails({ projects, reduced }) {
  const N = projects.length;
  const infos = projects.map((p) => projectInfo(p));
  const root = document.createElement('div'); root.className = 'td'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="td__row">
      <div class="td__counter"><span class="td__num"><span class="td__slot td__tens"><span class="td__drum"></span><span class="td__drum td__wrapc"></span></span><span class="td__slot td__units"><span class="td__drum"></span><span class="td__drum td__wrapc"></span></span></span><span class="td__total">/${pad(N)}</span></div>
      <div class="td__year td__col"></div>
      <div class="td__tags td__col"></div>
    </div>
    <div class="td__sr" role="status" aria-live="polite"></div>`;
  const row = root.querySelector('.td__row'), numEl = root.querySelector('.td__num'), totalEl = root.querySelector('.td__total'), counterEl = root.querySelector('.td__counter');
  const yearEl = root.querySelector('.td__year'), tagsEl = root.querySelector('.td__tags'), srEl = root.querySelector('.td__sr');
  let shown = -1, state = 'out', fw = 0, fh = 0, token = 0;

  // ---- counter: the desktop drum (v2-ui.js): two slots, each a drum of the digits 0-9 three times + a two-face column for the wrap step
  const slots = [...root.querySelectorAll('.td__slot')].map((slot) => { const [drum, wrapc] = slot.querySelectorAll('.td__drum'); drum.innerHTML = Array.from({ length: 30 }, (_, i) => `<span>${i % 10}</span>`).join(''); wrapc.innerHTML = '<span></span><span></span>'; return { slot, drum, wrapc, last: NaN, wrapKey: '', wrapShown: false }; });
  const labelNum = (n) => (((n - 1) % N) + N) % N + 1;
  const label = (n) => String(labelNum(n)).padStart(2, '0');
  let Dn = 0, DV = 0, Dinit = false;
  const setCounter = (dt, target, stopped) => {
    if (!Dinit) { Dn = target; Dinit = true; }
    const C = WORK_COUNTER;
    if (reduced) { Dn = target; DV = 0; } else {
      const lag = C.counterMaxSteps * 3;
      if (Math.abs(target - Dn) > lag) Dn = target - Math.sign(target - Dn) * lag;
      const cap = Math.min(C.counterMaxSpeed, stopped ? Math.max(C.counterMaxSteps, Math.abs(target - Dn) / 0.5) : C.counterMaxSteps);
      const w = 6 / Math.max(C.counterSettleSec, 0.05), a = Math.max(C.counterMaxAccel, 1), steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
      for (let q = 0; q < steps; q++) {
        const err = target - Dn, vdes = Math.sign(err) * Math.min(cap, w * Math.abs(err), Math.sqrt(2 * a * Math.abs(err)));
        DV += Math.max(-a * h, Math.min(a * h, vdes - DV));
        Dn += DV * h;
      }
      if (Math.abs(target - Dn) < 0.0005 && Math.abs(DV) < 0.01) { Dn = target; DV = 0; }
    }
    const fl = Math.floor(Dn), fr = Dn - fl, a = label(fl), b2 = label(fl + 1), wrap = labelNum(fl + 1) < labelNum(fl);
    for (let j = 0; j < 2; j++) {
      const sl = slots[j], d0 = +a[j], d1 = +b2[j], moves = fr > 0 && d0 !== d1;
      if (moves && wrap) { // the wrap: two faces, one slide, no digit in between
        const key = `${d0}${d1}`;
        if (sl.wrapKey !== key) { sl.wrapKey = key; sl.wrapc.children[0].textContent = d0; sl.wrapc.children[1].textContent = d1; }
        if (!sl.wrapShown) { sl.wrapShown = true; sl.wrapc.style.display = 'block'; sl.drum.style.display = 'none'; sl.last = NaN; }
        sl.wrapc.style.transform = `translate3d(0,${(-fr * 50).toFixed(3)}%,0)`;
      } else {
        if (sl.wrapShown) { sl.wrapShown = false; sl.wrapc.style.display = 'none'; sl.drum.style.display = ''; sl.last = NaN; }
        const v = moves ? d0 + fr : d0;
        if (Math.abs(v - sl.last) > 0.0005 || Number.isNaN(sl.last)) { sl.last = v; sl.drum.style.transform = `translate3d(0,${(-((v + 10) / 30) * 100).toFixed(4)}%,0)`; }
      }
    }
  };

  // ---- year / tags lines (rolled with CSS transitions)
  const lineHtml = (txt) => `<span class="td__ln"><span class="td__rin">${esc(txt)}</span></span>`;
  const colLines = () => [...yearEl.querySelectorAll('.td__rin'), ...tagsEl.querySelectorAll('.td__rin')];
  const fill = (idx) => { yearEl.innerHTML = infos[idx].year ? lineHtml(infos[idx].year) : ''; tagsEl.innerHTML = infos[idx].tags.slice(0, D.tags).map(lineHtml).join(''); };
  const rollOut = () => {
    if (state === 'out') return; state = 'out'; token++;
    colLines().forEach((el, i) => { el.style.transitionDelay = `${i * D.stagger}s`; el.classList.add('is-out'); el.classList.remove('is-in'); });
  };
  const rollIn = (idx) => {
    shown = idx; state = 'in'; const my = ++token;
    fill(idx);
    srEl.textContent = `${pad(idx + 1)} of ${pad(N)}. ${infos[idx].year}`;
    const ls = colLines();
    ls.forEach((el) => { el.style.transitionDelay = '0s'; el.classList.add('is-out'); el.classList.remove('is-in'); });
    void row.offsetWidth;
    requestAnimationFrame(() => { if (my !== token) return; ls.forEach((el, i) => { el.style.transitionDelay = `${i * D.stagger}s`; el.classList.remove('is-out'); el.classList.add('is-in'); }); });
  };

  // ---- layout: every element is placed by its INK (see TALL_DETAILS)
  const ink = (font, text, scale = 10) => {
    const c = document.createElement('canvas').getContext('2d'); c.font = font;
    const m = c.measureText(text), fa = m.fontBoundingBoxAscent ?? 0, fd = m.fontBoundingBoxDescent ?? 0, adv = m.width;
    c.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * scale}px`); // (the glyph edges at 10x, so the sub-pixel part is not rounded away)
    const g = c.measureText(text);
    return { fa, fd, adv, asc: g.actualBoundingBoxAscent / scale, desc: g.actualBoundingBoxDescent / scale, left: g.actualBoundingBoxLeft / scale, right: g.actualBoundingBoxRight / scale };
  };
  const layout = (w, h) => {
    fw = w; fh = h;
    const W = innerWidth, H = innerHeight, L = (W - w) / 2, cardTop = H / 2 - h / 2, cardBottom = H / 2 + h / 2, vw = (n) => (n * W) / 100;
    const csN = getComputedStyle(numEl), fam = csN.fontFamily, wt = csN.fontWeight;
    // the big number: the font size is fitted so that the ink of "0" (top to bottom) is numCapVw tall
    const u = ink(`${wt} 100px ${fam}`, '0'), fsN = vw(D.numCapVw) / ((u.asc + u.desc) / 100);
    numEl.style.fontSize = `${fsN.toFixed(3)}px`;
    const big = ink(`${wt} ${fsN}px ${fam}`, '0');
    const base = cardTop - vw(D.numGapVw) - big.desc; // the baseline: the ink bottom sits numGapVw above the card's top edge
    const T0 = base - ((0.74 * fsN - (big.fa + big.fd)) / 2 + big.fa), inkTop = base - big.asc;
    const inkLeftInSlot = 0.7 * fsN - big.adv - big.left; // the tens slot is right-aligned: the ink's left edge measured from the slot's left edge
    counterEl.style.left = `${(L - inkLeftInSlot).toFixed(2)}px`; counterEl.style.top = `${T0.toFixed(2)}px`;
    // the small "/NN": ink top on the big number's ink top, totGapVw after the widest big numeral's right ink edge
    const csT = getComputedStyle(totalEl), t100 = ink(`${csT.fontWeight} 100px ${csT.fontFamily}`, '05'), fsT = vw(D.totCapVw) / (t100.asc / 100);
    totalEl.style.fontSize = `${fsT.toFixed(3)}px`; totalEl.style.opacity = String(D.totOpacity);
    const tot = ink(`${csT.fontWeight} ${fsT}px ${csT.fontFamily}`, '05'), slash = ink(`${csT.fontWeight} ${fsT}px ${csT.fontFamily}`, '/');
    const relT = (fsT - (tot.fa + tot.fd)) / 2 + tot.fa - tot.asc; // line-height 1: the ink top measured from the top of the box
    const s1 = slots[1].slot.getBoundingClientRect(), cr = counterEl.getBoundingClientRect();
    let wMax = 0; for (let n = 1; n <= N; n++) wMax = Math.max(wMax, ink(`${wt} ${fsN}px ${fam}`, label(n)[1], 1).right); // the widest units digit that can occur (1..N): the "/NN" stays put while the number rolls
    totalEl.style.top = `${(inkTop - T0 - relT).toFixed(2)}px`;
    if (s1.width) totalEl.style.transform = `translate3d(${(s1.left - cr.left + wMax + vw(D.totGapVw) - slash.left).toFixed(2)}px,0,0)`;
    // below the card: year + tags, the ink top of the first line rowGapVw under the card's bottom edge
    const csY = getComputedStyle(yearEl), h100 = ink(`${csY.fontWeight} 100px ${csY.fontFamily}`, 'H'), fsS = Math.max(D.smallMinPx, vw(D.smallCapVw) / (h100.asc / 100)), pitch = vw(D.tagPitchVw);
    const cap = ink(`${csY.fontWeight} ${fsS}px ${csY.fontFamily}`, 'H'), capTop = (pitch - (cap.fa + cap.fd)) / 2 + cap.fa - cap.asc;
    root.style.setProperty('--td-fs', `${fsS.toFixed(3)}px`); root.style.setProperty('--td-pitch', `${pitch.toFixed(2)}px`);
    root.style.setProperty('--td-col-top', `${(cardBottom + vw(D.rowGapVw) - capTop).toFixed(2)}px`);
    root.style.setProperty('--td-left', `${L}px`); root.style.setProperty('--td-tag-op', String(D.tagOpacity));
    if (shown >= 0 && state === 'in') { fill(shown); colLines().forEach((el) => el.classList.add('is-in')); }
  };
  document.fonts?.ready?.then(() => { if (fw) layout(fw, fh); });

  return {
    root,
    layout,
    // s = core's per-frame state (the desktop UI's): stopped, idxHead, kNum (the unwrapped number the counter heads to), dt, transitioning
    frame(s) {
      if (!fw) return;
      if (s.transitioning) return;
      setCounter(s.dt, s.kNum, s.stopped);
      if (!s.stopped) { if (shown >= 0) rollOut(); return; }
      if (shown !== s.idxHead || state === 'out') rollIn(s.idxHead);
    },
    get state() { return { shown, state, D: Dn }; },
  };
}
