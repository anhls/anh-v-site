// R48 Part B (rounds 3 + 4, Anh's iPhone mock 03.11 01:21): the phone / tablet-portrait Work page's details. TWO layers: `front` = the counter, drawn IN FRONT of the cards (they pass under it), and `root` =
// year + tags, UNDER the cards (core puts it in .work before the canvas stage). ABOVE the centred card, left on its left edge: the counter (big current number + small "/NN" that FOLLOWS the current number's
// right ink edge, NN = the visible projects). BELOW the card: the YEAR (left edge) and the TAGS (the desktop "Role" tags, max 3, one per line, the widest line ending on the card's right edge). Every size and gap
// is in TALL_DETAILS (src/settings/tall.js, vw of a 430 px screen) and placed by INK. The counter is the DESKTOP drum (v2-ui.js setCounter, same WORK_COUNTER numbers): it rolls DURING the scroll.
// Entrance when a card settles: the title smear (tall-title.js) starts, then the year (titleToYear s later), then the tags (yearToTags s later); leaving = the reverse, faster (leaveScale). CSS transitions
// (the desktop rolls these lines on springs: logged). Reduced motion = a plain swap.
import '../styles/tall-work.css';
import { projectInfo } from './v2-ui.js';
import { TALL_DETAILS as D } from '../settings/tall.js';
import { WORK_COUNTER, WORK_LINE, TALL } from '../timeline.js';
import { viewW } from '../util/viewport.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');

export function createTallDetails({ projects, reduced, title }) {
  const N = projects.length;
  const infos = projects.map((p) => projectInfo(p));
  const root = document.createElement('div'); root.className = 'td'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="td__line"><div class="td__lines"></div></div>
    <div class="td__row">
      <div class="td__year td__col"></div>
      <div class="td__tags td__col"></div>
    </div>
    <div class="td__sr" role="status" aria-live="polite"></div>`;
  const front = document.createElement('div'); front.className = 'td td--front'; front.setAttribute('aria-hidden', 'true');
  front.innerHTML = `<div class="td__counter"><span class="td__num"><span class="td__slot td__tens"><span class="td__drum"></span><span class="td__drum td__wrapc"></span></span><span class="td__slot td__units"><span class="td__drum"></span><span class="td__drum td__wrapc"></span></span></span><span class="td__total">/${pad(N)}</span></div>`;
  const row = root.querySelector('.td__row'), numEl = front.querySelector('.td__num'), totalEl = front.querySelector('.td__total'), counterEl = front.querySelector('.td__counter');
  const yearEl = root.querySelector('.td__year'), tagsEl = root.querySelector('.td__tags'), srEl = root.querySelector('.td__sr');
  let shown = -1, state = 'out', fw = 0, fh = 0;
  // ---- R48 r7: the thin line (the desktop scroll line / ruler): full width, behind the cards, one line per card at its top edge + lineInset, travelling with the strip (eased after it like the desktop, WORK_LINE).
  const linesEl = root.querySelector('.td__lines');
  let lineP = NaN, linePitch = 0, lineBase = 0, lineLastY = NaN, lineOp = NaN;
  const setLine = (dt, pos) => {
    if (!linePitch) return;
    if (Number.isNaN(lineP)) lineP = pos; else if (reduced) lineP = pos; else lineP += (pos - lineP) * (1 - Math.exp((-dt * 3) / Math.max(WORK_LINE.scrollLineFollowSec, 0.05)));
    if (Math.abs(pos - lineP) < 0.0005) lineP = pos;
    // R48 r9: ONE line only: just inside the top edge of the card nearest the centre, travelling with the strip; at the half-way point (where the nearest card changes) it fades out and back in at the next card
    const fr = lineP - Math.round(lineP), y = lineBase - fr * linePitch, k = Math.min(1, Math.max(0, (0.5 - Math.abs(fr)) / 0.14)), fade = k * k * (3 - 2 * k);
    if (Math.abs(y - lineLastY) > 0.05 || Number.isNaN(lineLastY)) { lineLastY = y; linesEl.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`; }
    const op = WORK_LINE.scrollLineOn ? WORK_LINE.scrollLineOpacity * fade : 0;
    if (Math.abs(op - lineOp) > 0.002 || Number.isNaN(lineOp)) { lineOp = op; linesEl.style.opacity = String(op); }
  };

  // ---- counter: the desktop drum (v2-ui.js): two slots, each a drum of the digits 0-9 three times + a two-face column for the wrap step
  const slots = [...front.querySelectorAll('.td__slot')].map((slot) => { const [drum, wrapc] = slot.querySelectorAll('.td__drum'); drum.innerHTML = Array.from({ length: 30 }, (_, i) => `<span>${i % 10}</span>`).join(''); wrapc.innerHTML = '<span></span><span></span>'; return { slot, drum, wrapc, last: NaN, wrapKey: '', wrapShown: false }; });
  const labelNum = (n) => (((n - 1) % N) + N) % N + 1;
  const label = (n) => String(labelNum(n)).padStart(2, '0');
  let Dn = 0, DV = 0, Dinit = false;
  let unitsR = null, totBase = 0, totX = NaN; // "/NN" follows the number: the ink right edge of each units digit (px from the units slot's left) and the x where "/NN" stands for ink edge 0
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
    if (unitsR) { // "/NN" moves with the number's right ink edge (the units digit, interpolated while the drum turns); transform only
      const u0 = +a[1], u1 = +b2[1], r = fr > 0 && u0 !== u1 ? unitsR[u0] + (unitsR[u1] - unitsR[u0]) * fr : unitsR[u0], x = totBase + r;
      if (Math.abs(x - totX) > 0.01 || Number.isNaN(totX)) { totX = x; totalEl.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; }
    }
  };

  // ---- year / tags lines (CSS transitions): entrance = title -> year -> tags, leave = tags -> year, faster
  const lineHtml = (txt) => `<span class="td__ln"><span class="td__rin is-out">${esc(txt)}</span></span>`;
  const yearLines = () => [...yearEl.querySelectorAll('.td__rin')], tagLines = () => [...tagsEl.querySelectorAll('.td__rin')];
  // R48 r6: the TAGS column per project: the LONGEST tag's right INK edge on the card's right edge, every other tag left-aligned (by ink) to that tag's left edge. Measured with the real web font (layout() re-runs
  // when the fonts have loaded and on resize); the column's position is set BEFORE the lines roll in, so a new project's tags arrive already aligned.
  let tagFont = '', cardR = 0, tagLs = 0;
  const placeTags = (idx) => {
    const t = infos[idx].tags.slice(0, D.tags), lns = [...tagsEl.querySelectorAll('.td__ln')];
    if (!t.length || !tagFont) return;
    const m = t.map((x) => ink(tagFont, x)), w = m.map((g, i) => g.right + g.left + tagLs * (t[i].length - 1)); let k = 0; w.forEach((v, i) => { if (v > w[k]) k = i; });
    tagsEl.style.right = 'auto'; tagsEl.style.left = `${(cardR - (m[k].right + tagLs * (t[k].length - 1))).toFixed(2)}px`;
    lns.forEach((el, i) => { el.style.marginLeft = `${(m[i].left - m[k].left).toFixed(2)}px`; });
  };
  const fill = (idx) => { yearEl.innerHTML = infos[idx].year ? lineHtml(infos[idx].year) : ''; tagsEl.innerHTML = infos[idx].tags.slice(0, D.tags).map(lineHtml).join(''); placeTags(idx); };
  const roll = (els, kind, t0 = 0, dur = '') => els.forEach((el, i) => { el.style.transitionDuration = dur; el.style.transitionDelay = `${(t0 + i * D.stagger * (kind === 'out' ? D.leaveScale : 1)).toFixed(3)}s`; el.classList.toggle('is-out', kind === 'out'); el.classList.toggle('is-in', kind === 'in'); });
  let seenSeq = 0, pendSeq = 0, waitSince = 0, yearAt = 0, tagsAt = 0, yearShown = false, tagsShown = false;
  const leave = () => {
    if (state === 'out') return; state = 'out';
    const dur = `${(0.5 * D.leaveScale).toFixed(3)}s`;
    roll(tagLines(), 'out', 0, dur); roll(yearLines(), 'out', D.yearToTags * D.leaveScale, dur); // the reverse of the entrance: tags first, then the year (the title leaves with the strip move)
  };
  const begin = (idx) => {
    shown = idx; state = 'wait'; fill(idx); // the new lines wait hidden
    srEl.textContent = `${pad(idx + 1)} of ${pad(N)}. ${infos[idx].year}`;
    pendSeq = seenSeq; waitSince = performance.now(); yearAt = tagsAt = 0; yearShown = tagsShown = false;
  };
  const step = (now) => { // state 'wait' -> 'in': follow the title's start
    if (!yearAt) {
      if (!title) yearAt = now; else if (title.seq !== pendSeq) yearAt = title.at + D.titleToYear * 1000; else if (now - waitSince > 2500) yearAt = now; // (the title never started: do not hold the row back for good)
      if (reduced && yearAt) yearAt = now;
      if (yearAt) tagsAt = yearAt + (reduced ? 0 : D.yearToTags * 1000);
    }
    if (yearAt && !yearShown && now >= yearAt) { yearShown = true; roll(yearLines(), 'in', 0, ''); }
    if (yearAt && !tagsShown && now >= tagsAt) { tagsShown = true; roll(tagLines(), 'in', 0, ''); }
    if (yearShown && tagsShown) state = 'in';
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
    const W = viewW(), H = innerHeight, L = (W - w) / 2, cardTop = H / 2 - h / 2, cardBottom = H / 2 + h / 2, vw = (n) => (n * W) / 100;
    { const gap = TALL.gapV * h; linePitch = h + gap; lineBase = cardTop + vw(D.lineInsetVw); if (linesEl.children.length !== 1) linesEl.innerHTML = '<i></i>'; lineLastY = NaN; lineOp = NaN; }
    const csN = getComputedStyle(numEl), fam = csN.fontFamily, wt = csN.fontWeight;
    if (document.fonts?.load && !layout.asked) { layout.asked = true; const csT0 = getComputedStyle(totalEl), csY0 = getComputedStyle(yearEl); Promise.all([`${wt} 100px ${fam}`, `${csT0.fontWeight} 12px ${csT0.fontFamily}`, `${csY0.fontWeight} 12px ${csY0.fontFamily}`].map((ff) => document.fonts.load(ff, '0123456789/H').catch(() => {}))).then(again); }
    // the big number: the font size is fitted so that the ink of "0" (top to bottom) is numCapVw tall
    const u = ink(`${wt} 100px ${fam}`, '0'), fsN = vw(D.numCapVw) / ((u.asc + u.desc) / 100);
    numEl.style.fontSize = `${fsN.toFixed(3)}px`;
    const big = ink(`${wt} ${fsN}px ${fam}`, '0');
    const base = cardTop - vw(D.numGapVw) - big.desc; // the baseline: the ink bottom sits numGapVw above the card's top edge
    const T0 = base - ((0.74 * fsN - (big.fa + big.fd)) / 2 + big.fa), inkTop = base - big.asc;
    const inkLeftInSlot = 0.7 * fsN - big.adv - big.left; // the tens slot is right-aligned: the ink's left edge measured from the slot's left edge
    counterEl.style.left = `${(L - inkLeftInSlot).toFixed(2)}px`; counterEl.style.top = `${T0.toFixed(2)}px`;
    // ONE small text size for "/NN", the year and the tags: the cap height smallCapVw (never under smallMinPx)
    const csY = getComputedStyle(yearEl), h100 = ink(`${csY.fontWeight} 100px ${csY.fontFamily}`, 'H'), fsS = Math.max(D.smallMinPx, vw(D.smallCapVw) / (h100.asc / 100)), pitch = vw(D.tagPitchVw);
    const csT = getComputedStyle(totalEl);
    totalEl.style.fontSize = `${fsS.toFixed(3)}px`; totalEl.style.opacity = String(D.totOpacity);
    const tot = ink(`${csT.fontWeight} ${fsS}px ${csT.fontFamily}`, '05'), slash = ink(`${csT.fontWeight} ${fsS}px ${csT.fontFamily}`, '/');
    const relT = (fsS - (tot.fa + tot.fd)) / 2 + tot.fa - tot.asc; // line-height 1: the ink top measured from the top of the box
    totalEl.style.top = `${(inkTop - T0 - relT).toFixed(2)}px`;
    // the ink right edge of every units digit (measured once per resize), "/NN" starts totGapVw after the CURRENT number's edge
    const s1 = slots[1].slot.getBoundingClientRect(), cr = counterEl.getBoundingClientRect();
    unitsR = Array.from({ length: 10 }, (_, d) => ink(`${wt} ${fsN}px ${fam}`, String(d), 1).right);
    totBase = s1.left - cr.left + vw(D.totGapVw) - slash.left; totX = NaN;
    // below the card: year + tags, the ink top of the first line rowGapVw under the card's bottom edge
    const cap = ink(`${csY.fontWeight} ${fsS}px ${csY.fontFamily}`, 'H'), capTop = (pitch - (cap.fa + cap.fd)) / 2 + cap.fa - cap.asc;
    root.style.setProperty('--td-fs', `${fsS.toFixed(3)}px`); root.style.setProperty('--td-pitch', `${pitch.toFixed(2)}px`);
    root.style.setProperty('--td-col-top', `${(cardBottom + vw(D.rowGapVw) - capTop).toFixed(2)}px`);
    root.style.setProperty('--td-left', `${L}px`); root.style.setProperty('--td-tag-op', String(D.tagOpacity));
    tagFont = `${csY.fontWeight} ${fsS}px ${csY.fontFamily}`; tagLs = 0.02 * fsS; cardR = L + w;
    if (shown >= 0 && state === 'out') placeTags(shown);
    if (shown >= 0 && state !== 'out') { const keep = state; fill(shown); if (keep === 'in') [...yearLines(), ...tagLines()].forEach((el) => { el.classList.remove('is-out'); el.classList.add('is-in'); }); }
  };
  // (R48 r5: fonts.ready can resolve BEFORE a lazily-loaded weight is requested (iOS), so measuring then would use a fallback font and "/NN" would sit at a wrong, fixed spot:
  // ask for the exact fonts, and measure again when they have really loaded)
  const again = () => { if (fw) layout(fw, fh); };
  document.fonts?.addEventListener?.('loadingdone', again);
  document.fonts?.ready?.then(again);

  return {
    root, front,
    layout,
    // s = core's per-frame state (the desktop UI's): stopped, idxHead, kNum (the unwrapped number the counter heads to), dt, transitioning
    frame(s) {
      if (!fw) return;
      if (s.transitioning) return;
      setCounter(s.dt, s.kNum, s.stopped); setLine(s.dt, s.pos);
      const now = performance.now();
      if (!s.stopped) leave();
      else {
        if (state === 'out' || shown !== s.idxHead) begin(s.idxHead);
        if (state === 'wait') step(now);
      }
      if (title) seenSeq = title.seq;
    },
    get state() { return { shown, state, D: Dn }; },
  };
}
