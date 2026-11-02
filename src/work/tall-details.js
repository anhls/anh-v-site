// R48 Part B: the phone / tablet-portrait Work page's details row. It sits UNDER the cards layer (core puts it in .work before the canvas stage: the cards scroll over it) directly below the
// centred card's rest position: left = the split counter (big current number + small "/NN", NN = the visible projects), then the year, then the description (3 lines, desktop projectInfo()).
// R48 round 2: the counter and the scroll line are the DESKTOP logic (src/work/v2-ui.js setCounter / the scroll-line block, copied line for line with the same WORK_COUNTER / WORK_LINE numbers):
// the counter's drum rolls DURING the scroll (a velocity-slew controller on the unwrapped project number s.kNum), and the thin line moves with the strip position (x = frac(pos / N) x the
// span, eased after the strip, two instances for the wrap; on the vertical strip it is a horizontal line travelling down). Year / description roll out line by line when the strip moves and
// roll in at scroll stop (the desktop rolls those lines on springs, CSS transitions here). Ink-aligned: the top of the big digits = the top of the year = the top of the first description
// line = the top of "/NN". Transform / opacity / filter only; nothing is read per frame. Reduced motion = a plain swap.
import '../styles/tall-work.css';
import { projectInfo } from './v2-ui.js';
import { TALL_DETAILS as D } from '../settings/tall.js';
import { WORK_COUNTER, WORK_LINE } from '../timeline.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');

export function createTallDetails({ projects, reduced }) {
  const N = projects.length;
  const infos = projects.map((p) => projectInfo(p, D.descChars));
  const root = document.createElement('div'); root.className = 'td'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="td__line"><i></i><i></i></div>
    <div class="td__row">
      <div class="td__counter"><span class="td__num"><span class="td__slot td__tens"><span class="td__drum"></span><span class="td__drum td__wrapc"></span></span><span class="td__slot td__units"><span class="td__drum"></span><span class="td__drum td__wrapc"></span></span></span><span class="td__total">/${pad(N)}</span></div>
      <div class="td__year td__col"></div>
      <div class="td__desc td__col"></div>
    </div>
    <div class="td__sr" role="status" aria-live="polite"></div>`;
  const row = root.querySelector('.td__row'), numEl = root.querySelector('.td__num'), totalEl = root.querySelector('.td__total'), counterEl = root.querySelector('.td__counter');
  const yearEl = root.querySelector('.td__year'), descEl = root.querySelector('.td__desc'), srEl = root.querySelector('.td__sr');
  const lineEl = root.querySelector('.td__line'), lineI = [...lineEl.children];
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

  // ---- scroll line (v2-ui.js): x = frac(strip position / N) x span, eased after the strip; two instances for the wrap. The tall strip is vertical: a horizontal line travelling along y.
  let lineX = NaN, lineInit = false, lineLast = [NaN, NaN], lineOp = NaN, lineSize = innerHeight;
  const setLine = (dt, pos) => {
    const span = lineSize * (1 + WORK_LINE.scrollLineGap), target = (pos / N) * span;
    if (!lineInit) { lineX = target; lineInit = true; lineLast = [NaN, NaN]; }
    if (reduced) lineX = target; else lineX += (target - lineX) * (1 - Math.exp((-dt * 3) / Math.max(WORK_LINE.scrollLineFollowSec, 0.05)));
    if (Math.abs(target - lineX) < 0.25) lineX = target;
    const xm = ((lineX % span) + span) % span, xs = [xm, xm - span];
    for (let k = 0; k < 2; k++) if (xs[k] !== lineLast[k]) { lineLast[k] = xs[k]; lineI[k].style.transform = `translate3d(0,${xs[k].toFixed(2)}px,0)`; }
    const op = WORK_LINE.scrollLineOn ? WORK_LINE.scrollLineOpacity : 0;
    if (Math.abs(op - lineOp) > 0.001 || Number.isNaN(lineOp)) { lineOp = op; lineI.forEach((e) => (e.style.opacity = op.toFixed(3))); }
  };

  // ---- year / description lines (rolled with CSS transitions)
  const lineHtml = (txt) => `<span class="td__ln"><span class="td__rin">${esc(txt)}</span></span>`;
  const splitDesc = (text) => { // the description in its real rendered lines (words laid out in the column, grouped by their top), at most D.descLines
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
  const colLines = () => [...yearEl.querySelectorAll('.td__rin'), ...descEl.querySelectorAll('.td__rin')];
  const rollOut = () => {
    if (state === 'out') return; state = 'out'; token++;
    colLines().forEach((el, i) => { el.style.transitionDelay = `${i * D.stagger}s`; el.classList.add('is-out'); el.classList.remove('is-in'); });
  };
  const fill = (idx) => { yearEl.innerHTML = infos[idx].year ? lineHtml(infos[idx].year) : ''; descEl.innerHTML = splitDesc(infos[idx].desc).map(lineHtml).join(''); };
  const rollIn = (idx) => {
    shown = idx; state = 'in'; const my = ++token;
    fill(idx);
    srEl.textContent = `${pad(idx + 1)} of ${pad(N)}. ${infos[idx].year}`;
    const ls = colLines();
    ls.forEach((el) => { el.style.transitionDelay = '0s'; el.classList.add('is-out'); el.classList.remove('is-in'); });
    void row.offsetWidth;
    requestAnimationFrame(() => { if (my !== token) return; ls.forEach((el, i) => { el.style.transitionDelay = `${i * D.stagger}s`; el.classList.remove('is-out'); el.classList.add('is-in'); }); });
  };

  // ---- layout: the row sits under the centred card; every small text is aligned by its INK (cap) top to the ink top of the big digits
  const ink = (font, text, scale = 10) => { const c = document.createElement('canvas').getContext('2d'); c.font = font; const m = c.measureText(text); const fa = m.fontBoundingBoxAscent ?? 0, fd = m.fontBoundingBoxDescent ?? 0; c.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * scale}px`); const big = c.measureText(text); return { fa, fd, asc: big.actualBoundingBoxAscent / scale, right: big.actualBoundingBoxRight / scale }; };
  const layout = (w, h) => {
    fw = w; fh = h; lineSize = innerHeight;
    const W = innerWidth, H = innerHeight, L = (W - w) / 2, bottom = H / 2 + h / 2;
    root.style.setProperty('--td-left', `${L}px`); root.style.setProperty('--td-w', `${w}px`);
    root.style.setProperty('--td-s', String(Math.min(1.25, Math.max(0.9, W / 390))));
    const csN = getComputedStyle(numEl), fs = parseFloat(csN.fontSize) || 42, fam = csN.fontFamily;
    const big = ink(`${csN.fontWeight} ${fs}px ${fam}`, '0');
    const bigInkTop = (0.74 * fs - (big.fa + big.fd)) / 2 + big.fa - big.asc; // from the top of the numeral box
    const csT = getComputedStyle(totalEl), fsT = parseFloat(csT.fontSize) || 11, lhT = parseFloat(csT.lineHeight) || fsT;
    const tot = ink(`${csT.fontWeight} ${fsT}px ${csT.fontFamily}`, '05');
    const totInkTop = (lhT - (tot.fa + tot.fd)) / 2 + tot.fa - tot.asc;
    const csC = getComputedStyle(yearEl), fsC = parseFloat(csC.fontSize) || 11, lhC = fsC * 1.55;
    const cap = ink(`${csC.fontWeight} ${fsC}px ${csC.fontFamily}`, 'H');
    const capInkTop = (lhC - (cap.fa + cap.fd)) / 2 + cap.fa - cap.asc;
    // the gap between the card's bottom edge and the top of the details (the big digits' ink) = half the height of the small "/NN"
    root.style.setProperty('--td-row-y', `${bottom + 0.5 * tot.asc - bigInkTop}px`);
    root.style.setProperty('--td-col-top', `${(bigInkTop - capInkTop).toFixed(2)}px`);
    root.style.setProperty('--td-tot-top', `${(bigInkTop - totInkTop).toFixed(2)}px`);
    // "/NN": right of the widest possible two-digit numeral (as the desktop counter)
    const s1 = slots[1].slot.getBoundingClientRect(), cr = counterEl.getBoundingClientRect();
    let wMax = 0; for (let d = 0; d < 10; d++) wMax = Math.max(wMax, ink(`${csN.fontWeight} ${fs}px ${fam}`, String(d), 1).right);
    if (s1.width) totalEl.style.transform = `translate3d(${(s1.left - cr.left + wMax + 0.08 * fs).toFixed(2)}px,0,0)`;
    if (shown >= 0 && state === 'in') { fill(shown); colLines().forEach((el) => el.classList.add('is-in')); }
  };
  document.fonts?.ready?.then(() => { if (fw) layout(fw, fh); });

  return {
    root,
    layout,
    // s = core's per-frame state (the desktop UI's): stopped, idxHead, kNum (the unwrapped number the counter heads to), pos (the strip position in projects), dt, transitioning
    frame(s) {
      if (!fw) return;
      if (s.transitioning) return;
      setCounter(s.dt, s.kNum, s.stopped);
      setLine(s.dt, s.pos);
      if (!s.stopped) { if (shown >= 0) rollOut(); return; }
      if (shown !== s.idxHead || state === 'out') rollIn(s.idxHead);
    },
    get state() { return { shown, state, D: Dn }; },
  };
}
