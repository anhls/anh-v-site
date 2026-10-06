// R32 Work page v2 (desktop): the title overlay, the info blocks, the ruler, the counter, the mode switch and the "Reach out" link.
// One DOM layer (.w2, pointer-events none except the switch and the link) above the canvas. work.js calls layout() when the sizes change and frame() once per tick with
// numbers it already has (no layout reads here per frame: every size is cached by layout(), every write is a transform / opacity and only when it changed).
import { springLayer, springFromBounce } from '../effects/springs.js';
import { WORK_V2, WORK_UI, TITLE_SHORT, WORK_TITLE, WORK_INFO, WORK_RULER, WORK_COUNTER, WORK_TEXT, WORK_SMEAR, WORK_PTR, WORK_LINE } from '../timeline.js';
import { createSmear } from '../effects/text-fx/smear.js';

const fxOff = new URLSearchParams(location.search).get('fx') === '0'; // ?fx=0: the title only fades
import { lineHover } from '../sections/footer.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrapN = (v, N) => ((((v + N / 2) % N) + N) % N) - N / 2;

// the real fields of a project (data.json): tags = the "Role" row of its details block (what the project page header shows), year = projects[i].year, description = its first
// text block (the intro), cut at a word boundary
export function projectInfo(p, maxChars = WORK_INFO.descChars) {
  const blocks = p.page?.blocks || [];
  const det = blocks.find((b) => b.t === 'details');
  const role = det?.rows?.find((r) => /^role/i.test(r[0]));
  const tags = (role ? role[1] : []).slice(0, 3);
  const txt = (blocks.find((b) => b.t === 'text')?.text || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  let desc = txt;
  if (desc.length > maxChars) { desc = desc.slice(0, maxChars + 1); desc = desc.slice(0, Math.max(desc.lastIndexOf(' '), 1)).replace(/[\s,.;:—–-]+$/, '') + '…'; }
  return { tags, year: p.year || '', desc };
}

export function createV2({ app, projects, reduced }) {
  const N = projects.length;
  const NC = Number(new URLSearchParams(location.search).get('n')) || N; // the number the counter counts to (dev: ?n=12 tests the two-digit carry with the real five projects)
  const infos = projects.map((p) => projectInfo(p));
  const root = document.createElement('div');
  root.className = 'w2';
  // ONE title and ONE info block at their fixed place; the content swaps to the project the strip is heading to (R33c: at scroll stop)
  root.innerHTML = `
    <div class="w2__titles" aria-hidden="true"><span class="w2__title" data-fx=""></span></div>
    <div class="w2__infos" aria-hidden="true"><div class="w2__info"><div class="w2__tags" data-pos="side"></div><div class="w2__year" data-pos="side"></div><div class="w2__desc" data-pos="side"></div></div></div>
    <div class="w2__ruler" aria-hidden="true">${Array.from({ length: 9 }, () => '<i></i>').join('')}</div>
    <div class="w2__counter" role="status" aria-live="polite"><span class="w2__label">${esc(WORK_UI.label)}</span><span class="w2__num" aria-hidden="true"><span class="w2__slot w2__tens"><span class="w2__col"></span><span class="w2__col w2__wrapcol"></span></span><span class="w2__slot w2__units"><span class="w2__col"></span><span class="w2__col w2__wrapcol"></span></span></span><span class="w2__total" aria-hidden="true">/${String(NC).padStart(2, '0')}</span><span class="w2__sr"></span></div>
    <svg class="w2__defs" width="0" height="0" aria-hidden="true"><filter id="w2-vblur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
    <button type="button" class="w2__switch w2__hit"><span class="w2__swtext"></span><span class="footer__line"></span></button>
    <div class="w2__reach"><span>${esc(WORK_UI.reachLabel)}</span><a class="w2__hit w2__email" href="mailto:${esc(WORK_UI.reachEmail)}">${esc(WORK_UI.reachEmail)}</a></div>`;
  app.append(root);
  const titleEl = root.querySelector('.w2__title'), infoEl = root.querySelector('.w2__info');
  const tagsEl = root.querySelector('.w2__tags'), yearEl = root.querySelector('.w2__year'), descEl = root.querySelector('.w2__desc');
  // R33e: the three info columns (roles, year, description) are made of LINES; every line is its own mask (a clip box) and rolls like the nav link hover: modeRollPx up on a spring
  // (SPRING.linkRoll: modeRollSec / modeRollBounce), fading inside its mask. The roles are one line each; the description is split into its real rendered lines (measured with the words in
  // place, after the font is in; re-split on a re-layout). Rolls go line by line inside a column (rollLineStagger), the three columns run in parallel. Two users: the mode switch
  // (out at the click, in at modeRollInAt of the morph) and the scroll between projects (out when the strip heads to another project, in at scroll stop; the roll duration follows the
  // scroll speed).
  const cols = [tagsEl, yearEl, descEl].map((el) => ({ el, lines: [] }));
  const sched = []; let clock = 0, lineState = 'in', rollOutEnd = 0, modeRoll = null, lastDur = 0;
  const RPX = () => WORK_V2.modeRollPx * (T.W / 1920);
  const at = (delay, fn) => sched.push({ at: clock + delay, fn });
  const makeLine = (col, html, y0) => {
    const ln = document.createElement('span'); ln.className = 'w2__ln';
    const inner = document.createElement('span'); inner.className = 'w2__rin'; inner.innerHTML = html; ln.append(inner); col.el.append(ln);
    const L = { ln, inner, t: { y: y0 }, springs: { y: springFromBounce(WORK_V2.modeRollSec, WORK_V2.modeRollBounce) }, layer: null, dead: false };
    L.layer = springLayer({ target: L.t, springs: L.springs, apply: (v) => { const k = Math.min(1, Math.abs(v.y) / Math.max(RPX(), 1)); inner.style.transform = v.y ? `translate3d(0,${v.y.toFixed(2)}px,0)` : ''; inner.style.opacity = v.y ? String(1 - k) : '1'; } });
    return L;
  };
  const buildCol = (col, htmls) => {
    col.lines.forEach((L) => { L.dead = true; L.layer.destroy(); });
    col.el.textContent = '';
    const y0 = reduced || lineState === 'in' ? 0 : RPX(); // new lines wait below their mask while the old text is out
    col.lines = htmls.map((h) => makeLine(col, h, y0));
  };
  const splitDesc = (text) => { // the description in its real rendered lines (words laid out in the column, grouped by their top)
    if (!text) return [];
    descEl.textContent = '';
    const spans = text.split(' ').map((w) => { const sp = document.createElement('span'); sp.textContent = `${w} `; descEl.append(sp); return sp; });
    const out = []; let top = null, cur = '';
    spans.forEach((sp) => { const t = sp.offsetTop; if (top === null || Math.abs(t - top) > 4) { if (cur) out.push(cur.trim()); cur = ''; top = t; } cur += sp.textContent; });
    if (cur) out.push(cur.trim());
    descEl.textContent = '';
    return out.slice(0, 3);
  };
  // the duration of a roll from the strip speed (screen lengths / s): slow = the full nav roll, fast = rollMinSec; the line stagger shrinks with it
  const rollDur = (speedL) => { const full = WORK_V2.modeRollSec; if (speedL == null) return full; const k = Math.min(1, Math.pow(Math.max(speedL, 0) / Math.max(WORK_V2.rollSpeedRef, 0.01), WORK_V2.rollSpeedPow)); return full + (WORK_V2.rollMinSec - full) * k; };
  const rollLines = (kind, dur, only) => {
    lastDur = dur; lineState = kind;
    if (reduced) return;
    const stag = (WORK_V2.rollLineStagger * dur) / Math.max(WORK_V2.modeRollSec, 0.01); let longest = 0;
    cols.forEach((col, ci) => { if (only && !only.includes(ci)) return; longest = Math.max(longest, col.lines.length); col.lines.forEach((L, j) => at(j * stag, () => {
      if (L.dead) return;
      L.springs.y.splice(0, 3, ...springFromBounce(dur, WORK_V2.modeRollBounce));
      if (kind === 'out') L.t.y = -RPX(); else { L.t.y = RPX(); L.layer.snap(); L.t.y = 0; }
    })); });
    if (kind === 'out') rollOutEnd = clock + Math.max(longest - 1, 0) * stag + dur * 0.7;
  };
  const placeCol = (col, m) => { col.el.dataset.pos = m; };
  const settleRoll = () => { // the mode roll ends where it should: the columns in the new layout, every line in place
    if (!modeRoll) return; const to = modeRoll.to; modeRoll = null;
    cols.forEach((col) => { placeCol(col, to); col.el.style.opacity = ''; col.el.style.transition = ''; col.lines.forEach((L) => { L.t.y = 0; L.layer.snap(); }); });
    lineState = 'in';
  };
  const dots = [...root.querySelectorAll('.w2__ruler i')];
  const switchEl = root.querySelector('.w2__switch'), swText = root.querySelector('.w2__swtext');
  const numEl = root.querySelector('.w2__num'), totalEl = root.querySelector('.w2__total'), counterEl = root.querySelector('.w2__counter');
  // R33d: two independent digits. Each slot (one digit tall, masked) holds a DRUM (the digits 0-9 three times, so it turns either way without a seam) and a two-face column for the wrap step
  // (N -> 1 is ONE direct roll between the two numbers, no digit in between). The tens only moves when the tens digit changes; the units turns on every number.
  const slots = [...root.querySelectorAll('.w2__slot')].map((slot) => { const [drum, wrapc] = slot.querySelectorAll('.w2__col'); drum.innerHTML = Array.from({ length: 30 }, (_, i) => `<span>${i % 10}</span>`).join(''); wrapc.innerHTML = '<span></span><span></span>'; return { slot, drum, wrapc, last: NaN, wrapKey: '', wrapShown: false, filtered: false }; });
  // R33d scroll line: lives in .work (work.js puts it there) below the canvas, so the pictures draw over it; two instances for the wrap
  const lineEl = document.createElement('div');
  lineEl.className = 'w2__line'; lineEl.setAttribute('aria-hidden', 'true');
  lineEl.innerHTML = '<i></i><i></i>';
  const lineI = [...lineEl.children];
  let lineX = NaN, lineVert = false, lineLast = [NaN, NaN], lineOp = NaN, lineW = 1, lineSize = [innerWidth, innerHeight], lineInit = false, lineStep = 0;
  const srEl = root.querySelector('.w2__sr'), blurNode = root.querySelector('feGaussianBlur');
  const measureSwitch = lineHover(switchEl);
  const smear = createSmear({ host: root, cfg: WORK_SMEAR, reduced });
  let mode = 'side';
  // R33c: the units' filter is attached for the whole visit (never toggled while it blurs): no layer is made or dropped while it blurs. The tens has none while it stands still.
  // R33h: with counterBlurPx 0 (the default) or reduced motion NO filter is attached at all (no node, no layer, no stdDeviation writes); the ?tune slider switches it on live.
  const blurOn = () => !reduced && WORK_COUNTER.counterBlurPx > 0;
  let blurWas = false;
  const syncBlur = () => { const on = blurOn(); if (on === blurWas) return; blurWas = on; slots[1].slot.style.filter = on ? 'url(#w2-vblur)' : 'none'; slots[1].slot.style.willChange = on ? 'filter' : ''; slots[0].slot.style.willChange = on ? 'filter' : ''; if (!on) { slots[0].filtered = false; slots[0].slot.style.filter = 'none'; } };

  // ---- titles: ONE size (WORK_TITLE.size x the window scale) for every project; a title that is wider than fitFrac of the image is replaced by its placeholder (TITLE_SHORT in timeline.js)
  const cv = document.createElement('canvas').getContext('2d');
  const inkWidth = (text, size) => { cv.font = `${WORK_TITLE.weight} ${size}px "Clash Display"`; const m = cv.measureText(text); return m.actualBoundingBoxRight + m.actualBoundingBoxLeft + Math.max(0, text.length - 1) * WORK_TITLE.tracking * size; };
  const T = { size: new Float64Array(N), text: projects.map((p) => p.titleShort || TITLE_SHORT[p.slug] || p.title), full: projects.map((p) => p.title), shown: projects.map((p) => p.titleShort || TITLE_SHORT[p.slug] || p.title), fullInk: new Float64Array(N), ink: new Float64Array(N), limit: 0, s0: 0, iw: 0, ih: 0, asc: 0.9, W: 0, H: 0 };
  const fitTitles = (iw) => {
    const sc = innerWidth / 1920, size = WORK_TITLE.size * sc, fit = WORK_TITLE.fitFrac * iw;
    T.s0 = size; T.limit = fit;
    cv.font = `${WORK_TITLE.weight} 100px "Clash Display"`;
    const m = cv.measureText('Hx');
    const asc = m.fontBoundingBoxAscent ?? 90, desc = m.fontBoundingBoxDescent ?? 25; // line-height 1: the baseline sits (1 - (asc + desc) / em) / 2 + asc below the top of the line box
    T.asc = ((100 - (asc + desc)) / 2 + asc) / 100;
    projects.forEach((p, i) => {
      T.fullInk[i] = inkWidth(T.full[i], size);
      const text = T.fullInk[i] <= fit + 0.5 && !p.titleShort ? T.full[i] : T.text[i]; // the full title when it fits at 150, else the placeholder
      T.size[i] = size; T.shown[i] = text; T.ink[i] = inkWidth(text, size);
      if (import.meta.env.DEV && T.ink[i] > fit + 0.5) console.warn(`[work] title placeholder "${text}" is ${T.ink[i].toFixed(0)} px wide at ${size.toFixed(0)} px, the limit is ${fit.toFixed(0)}`);
    });
  };
  let lastIw = 0, lastIh = 0;
  const applyVars = () => { // the numbers of WORK_INFO / WORK_RULER as CSS custom properties (re-applied on every layout so ?tune takes effect)
    root.style.setProperty('--w2-c', WORK_UI.color); root.style.setProperty('--w2-dim', String(WORK_UI.dimOpacity)); root.style.setProperty('--w2-desc', String(WORK_UI.descOpacity));
    root.style.setProperty('--w2-small', String(WORK_UI.smallSize)); root.style.setProperty('--w2-track', `${WORK_UI.tracking}em`); root.style.setProperty('--w2-ttrack', `${WORK_TITLE.tracking}em`); root.style.setProperty('--w2-ctrack', `${WORK_UI.counterTracking}em`); root.style.setProperty('--w2-num', String(WORK_COUNTER.size));
    lineEl.style.setProperty('--w2-c', WORK_UI.color);
    const set = (n, o) => Object.entries(o).forEach(([k, v]) => root.style.setProperty(`--${n}-${k}`, String(v)));
    set('is', WORK_INFO.side); set('iv', WORK_INFO.vertical);
    root.style.setProperty('--rd-dot', String(WORK_RULER.dot)); root.style.setProperty('--rd-bar', String(WORK_RULER.bar));
  };

  // ---- the info block (blur only) and the title (R27 smear) show the project the strip is HEADING to once the scroll has stopped
  //   info: bp = blur progress 0 (sharp) .. 1 (full blur): in over textBlurInSec once the strip moves, held while it moves, out over textBlurOutSec after the stop; the content swaps
  //   only after a short hold at full blur (swapHoldMs). The blur is quantised to 0.5 px and written only when the quantised value changes; the layer is promoted (will-change: filter)
  //   for the whole visit and the filter is never switched to `none` in between (a layer made or dropped at every start / end was a flash).
  let shown = -1, bp = 1, lastQ = -1, outT = 1, outFrom = 1, hold = 0;
  let titleShown = -1, titleOp = 0, titleBusy = false;
  const setInfo = (idx) => {
    shown = idx;
    const inf = infos[idx];
    cols.forEach((col, ci) => { col.el.style.display = [inf.tags.length, inf.year, inf.desc][ci] ? '' : 'none'; });
    buildCol(cols[0], inf.tags.map(esc)); buildCol(cols[1], inf.year ? [esc(inf.year)] : []);
    buildCol(cols[2], splitDesc(inf.desc).map(esc));
  };
  const setTitle = (idx) => {
    titleShown = idx;
    titleEl.textContent = T.shown[idx]; titleEl.style.fontSize = `${T.size[idx].toFixed(2)}px`;
    placeTitle();
  };
  // the title sits at the image centre of the resting strip = the window centre (the same place in both modes); it never moves with the strip or the hover
  const placeTitle = () => {
    if (!T.iw) return;
    titleEl.style.width = `${T.iw.toFixed(2)}px`;
    const size = titleShown >= 0 ? T.size[titleShown] : T.s0;
    titleEl.style.left = `${(T.W / 2 - T.iw / 2 + (WORK_TITLE.dx * T.iw) / 1055).toFixed(2)}px`;
    titleEl.style.top = `${(T.H / 2 + (WORK_TITLE.baseDy * T.ih) / 556 - T.asc * size).toFixed(2)}px`;
  };
  const layout = (iw, ih) => {
    lastIw = iw; lastIh = ih;
    T.iw = iw; T.ih = ih; T.W = innerWidth; T.H = innerHeight;
    root.style.setProperty('--hw', `${(iw / 2).toFixed(2)}px`);
    root.style.setProperty('--hh', `${(ih / 2).toFixed(2)}px`);
    root.style.setProperty('--cx', `${(T.W / 2).toFixed(2)}px`);
    root.style.setProperty('--cy', `${(T.H / 2).toFixed(2)}px`);
    { // R33g: the side info block's top is fixed from the page top (WORK_INFO.side.top), moved up only to keep minGap off the image, never above the logo
      const si = WORK_INFO.side, p = innerWidth / 1920, lh = WORK_UI.smallSize * (25 / 14) * p;
      const rowOff = (25 * p - lh) / 2, imgTop = T.H / 2 - ih / 2;
      let y = si.top * p;
      const bottom = y + rowOff + 3 * lh; // (three lines = the tallest column)
      if (bottom > imgTop - si.minGap * p) y = Math.max((si.logoBottom + si.logoGap) * p, y - (bottom - (imgTop - si.minGap * p)));
      root.style.setProperty('--w2-infoY', `${(y - T.H / 2).toFixed(2)}px`);
    }
    fitTitles(iw);
    applyVars();
    smear.cancel();
    if (titleShown >= 0) { setTitle(titleShown); titleEl.style.opacity = String(titleOp); }
    if (shown >= 0) setInfo(shown);
    placeTitle();
    setMode(mode); // (the copy may have been edited in ?tune)
    measureCounter();
    lineSize = [innerWidth, innerHeight]; lineW = Math.max(1 / (window.devicePixelRatio || 1), (innerWidth / 1920) * WORK_LINE.scrollLineWidth);
    lineLast = [NaN, NaN];
  };
  // the sizes depend on the font: load the weights first (document.fonts.ready can resolve before a font that no text has used yet starts loading), then measure again
  Promise.all([600, 400, 200].map((w) => document.fonts?.load(`${w} 100px "Clash Display"`))).then(() => { if (lastIw) layout(lastIw, lastIh); }).catch(() => {});

  // where the browser really put the title: the left of the text and its baseline (read once per play, with a zero-size marker sitting on the baseline), so the overlay lands on the same pixels
  const domGeometry = () => {
    const mk = document.createElement('span'); mk.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    titleEl.append(mk);
    const baseline = mk.getBoundingClientRect().bottom;
    mk.remove();
    const rg = document.createRange(); rg.selectNodeContents(titleEl.firstChild);
    return { x: rg.getBoundingClientRect().left, baseline };
  };
  let titleFadeFrames = 0, titleLeaveStarts = 0;
  const leaveTitle = () => { // the strip moves and the title is plain DOM text: the shader leave from the formed state
    const size = T.size[titleShown], text = T.shown[titleShown];
    const g = domGeometry();
    titleBusy = true;
    const ok = smear.leaveFromRest({ el: titleEl, text, size, weight: WORK_TITLE.weight, family: '"Clash Display", system-ui, sans-serif', color: WORK_UI.color, tracking: WORK_TITLE.tracking, x: g.x, baseline: g.baseline,
      done: () => { titleOp = 1; titleBusy = false; }, aborted: () => { titleOp = 0; titleBusy = false; } });
    if (!ok) titleBusy = false; else titleLeaveStarts++;
    return ok;
  };
  const playTitle = () => {
    const size = T.size[titleShown], text = T.shown[titleShown];
    cv.font = `${WORK_TITLE.weight} ${size}px "Clash Display"`;
    const g = domGeometry();
    titleBusy = true;
    smear.play({ el: titleEl, text, size, weight: WORK_TITLE.weight, family: '"Clash Display", system-ui, sans-serif', color: WORK_UI.color, tracking: WORK_TITLE.tracking, x: g.x, baseline: g.baseline,
      done: () => { titleOp = 1; titleBusy = false; }, aborted: () => { titleOp = 0; titleBusy = false; } });
  };

  // ---- state
  let mv = 1, g = 0, lastIdx = -1, lineStep0 = undefined;
  const rd = dots.map(() => ({ k: '', a: NaN }));
  const setMode = (m) => {
    mode = m;
    root.dataset.mode = m;
    if (!modeRoll) cols.forEach((col) => placeCol(col, m));
    swText.textContent = WORK_UI.copy[m === 'vertical' ? 'vertical' : 'side'];
    const next = m === 'vertical' ? 'side' : 'vertical';
    switchEl.setAttribute('aria-label', `${swText.textContent} (switch to ${next} scroll)`);
    measureSwitch();
  };
  const ease = (x) => x * x * (3 - 2 * x);
  const labelNum = (n) => (((n - 1) % NC) + NC) % NC + 1; // the project number shown for the unwrapped number n
  const label = (n) => String(labelNum(n)).padStart(2, '0');
  let lastBlur = -1, D = 0, DV = 0, Dinit = false;
  // ink metrics of the numeral digits (read once per layout): where the units digit ends and where the top of the digits is, so "/N" follows the units' right edge and its top meets the numeral top
  const M = { adv: new Float64Array(10), inkR: new Float64Array(10), seam: 0, gap: 17, fs: 105, baseBig: 0, ascBig: 0, tensW: 0 };
  const measureCounter = () => {
    const cs = getComputedStyle(numEl), fs = parseFloat(cs.fontSize) || 105, c2 = document.createElement('canvas').getContext('2d');
    c2.font = `200 ${fs}px "Clash Display"`;
    for (let d = 0; d < 10; d++) { const m = c2.measureText(String(d)); M.adv[d] = m.width; M.inkR[d] = m.actualBoundingBoxRight; }
    const m0 = c2.measureText('0'), fa = m0.fontBoundingBoxAscent ?? fs * 0.89, fd = m0.fontBoundingBoxDescent ?? fs * 0.25;
    c2.font = `200 ${fs * 10}px "Clash Display"`; // (the digit height at 10x, so the sub-pixel part of the top is not rounded away)
    M.fs = fs; M.ascBig = c2.measureText('0').actualBoundingBoxAscent / 10;
    const nr = numEl.getBoundingClientRect(), cr = counterEl.getBoundingClientRect(), tr = slots[0].slot.getBoundingClientRect(), ur = slots[1].slot.getBoundingClientRect();
    M.seam = ur.left - cr.left; M.tensW = tr.width;
    M.baseBig = nr.top - cr.top + ((0.74 * fs - (fa + fd)) / 2 + fa); // the numeral's baseline, from the top of the counter box (line-height 0.74em)
    const cst = getComputedStyle(totalEl), fsS = parseFloat(cst.fontSize) || 14, c3 = document.createElement('canvas').getContext('2d');
    c3.font = `${cst.fontWeight} ${fsS}px "Clash Display"`;
    const ms = c3.measureText('05'), fas = ms.fontBoundingBoxAscent ?? fsS * 0.89, fds = ms.fontBoundingBoxDescent ?? fsS * 0.25;
    c3.font = `${cst.fontWeight} ${fsS * 10}px "Clash Display"`;
    const ascS = c3.measureText('05').actualBoundingBoxAscent / 10;
    const lh = parseFloat(cst.lineHeight) || fsS; // (line box height; the glyph box sits centred in it)
    M.totalTop = M.baseBig - M.ascBig + ascS - ((lh - (fas + fds)) / 2 + fas); // so that the TOP of the "/N" digits meets the top of the numeral digits
    M.gap = 17 * (fs / 100);
    lastTotalX = NaN;
  };
  let lastTotalX = NaN;
  // The counter position D = an unwrapped project number (float). Between two numbers the units drum turns ONE digit; a step over several numbers passes every one of them; the step from
  // the last number to 1 (the wrap) is one direct roll. A spring (counterSettleSec, overshoot counterOvershoot) with a speed cap brings it onto the target.
  let lastTarget = 0;
  const setCounter = (dt, target, stopped) => {
    lastTarget = target;
    if (!Dinit) { D = target; Dinit = true; }
    const C = WORK_COUNTER;
    if (reduced) { if (bp >= 0.999) { D = target; DV = 0; } } else {
      const lag = C.counterMaxSteps * 3; // (never skips a number below this; only a runaway lag of 3 s of rolling is cut)
      if (Math.abs(target - D) > lag) D = target - Math.sign(target - D) * lag;
      // R33i: a velocity-slew controller instead of the old spring + clamp (the clamp snapped D onto the target whenever the target flipped behind a moving drum = the visible jump). The wanted speed
      // is the slowest of: the cap, the settle curve (w x error) and the braking curve (sqrt(2 a error), so it can stop on the target); the real speed follows it by at most counterMaxAccel numbers / s^2,
      // so a reversal slows to zero and rolls back, and D and DV are continuous (no frame moves more than counterMaxSpeed / 60 numbers).
      const cap = Math.min(C.counterMaxSpeed, stopped ? Math.max(C.counterMaxSteps, Math.abs(target - D) / 0.5) : C.counterMaxSteps);
      const w = 6 / Math.max(C.counterSettleSec, 0.05), a = Math.max(C.counterMaxAccel, 1), steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
      for (let q = 0; q < steps; q++) {
        const err = target - D, vdes = Math.sign(err) * Math.min(cap, w * Math.abs(err), Math.sqrt(2 * a * Math.abs(err)));
        DV += Math.max(-a * h, Math.min(a * h, vdes - DV));
        D += DV * h;
      }
      if (Math.abs(target - D) < 0.0005 && Math.abs(DV) < 0.01) { D = target; DV = 0; }
    }
    const fl = Math.floor(D), fr = D - fl, a = label(fl), b2 = label(fl + 1), wrap = labelNum(fl + 1) < labelNum(fl);
    for (let j = 0; j < 2; j++) {
      const sl = slots[j], d0 = +a[j], d1 = +b2[j], moves = fr > 0 && d0 !== d1;
      if (moves && wrap) { // the wrap: two faces, one slide, no digit in between
        const key = `${d0}${d1}`;
        if (sl.wrapKey !== key) { sl.wrapKey = key; sl.wrapc.children[0].textContent = d0; sl.wrapc.children[1].textContent = d1; }
        if (!sl.wrapShown) { sl.wrapShown = true; sl.wrapc.style.display = 'block'; sl.drum.style.display = 'none'; sl.last = NaN; }
        sl.wrapc.style.transform = `translate3d(0,${(-fr * 50).toFixed(3)}%,0)`;
      } else {
        if (sl.wrapShown) { sl.wrapShown = false; sl.wrapc.style.display = 'none'; sl.drum.style.display = ''; sl.last = NaN; }
        const v = moves ? d0 + fr : d0; // the drum position in digits (the middle turn is offset by 10)
        if (Math.abs(v - sl.last) > 0.0005 || Number.isNaN(sl.last)) { sl.last = v; sl.drum.style.transform = `translate3d(0,${(-((v + 10) / 30) * 100).toFixed(4)}%,0)`; }
      }
      if (j === 0) { const mv0 = moves; const f0 = mv0 && blurWas; if (f0 !== slots[0].filtered) { slots[0].filtered = f0; slots[0].slot.style.filter = f0 ? 'url(#w2-vblur)' : 'none'; } } // the tens: blurred only while it turns
    }
    // R33f: the "/N" STAYS where it is (as on huyml.co): a fixed place to the right of the widest possible two-digit numeral, top level with the numeral top; it never moves with the digits
    if (M.seam && Number.isNaN(lastTotalX)) { let w = 0; for (let d = 0; d < 10; d++) w = Math.max(w, M.inkR[d]); lastTotalX = M.seam + w + M.gap; totalEl.style.transform = `translate3d(${lastTotalX.toFixed(2)}px,0,0)`; totalEl.style.top = `${M.totalTop.toFixed(2)}px`; }
  };

  // one call per tick. s = { idx (nearest project), idxHead (the project the strip is heading to), kNum (unwrapped number of the target: nearest while moving, the heading one after the stop),
  //   kHead (unwrapped heading index), pos (strip position in pitches, unwrapped), vertical, morph, stopped (scroll has stopped), dt (s) }
  const frame = (s) => {
    const dt = Math.min(s.dt, 0.1);
    const mt = s.morph ? 0 : 1;
    mv = reduced ? mt : mv + (mt - mv) * Math.min(1, dt / 0.18);
    clock += dt; // the line roll scheduler
    for (let i = sched.length - 1; i >= 0; i--) if (sched[i].at <= clock) { const f = sched.splice(i, 1)[0].fn; f(); }
    const stopped = s.stopped && !s.morph, active = s.idxHead, T_ = WORK_TEXT;
    // ---- info: blur ONLY (opacity stays 1; reduced motion fades instead)
    const inSec = reduced ? 0.2 : T_.textBlurInSec, outSec = reduced ? 0.2 : T_.textBlurOutSec;
    const want = stopped && shown === active;
    // ---- the info lines roll out when the strip heads for ANOTHER project (the blur above keeps running), swap while out, and roll in at the scroll stop (the roll speed follows the scroll speed)
    if (!reduced && !modeRoll && lineState === 'in' && active !== shown) rollLines('out', rollDur(s.speedL));
    if (!reduced && !modeRoll && lineState === 'out' && stopped && shown === active) rollLines('in', rollDur(s.speedL));
    if (!want) { bp = Math.min(1, bp + dt / Math.max(inSec, 0.01)); outFrom = bp; outT = 0; }
    else { outT = Math.min(1, outT + dt / Math.max(outSec, 0.01)); bp = outFrom * (1 - (reduced ? outT : ease(outT))); }
    if (stopped && shown !== active) { hold = bp >= 0.999 && (reduced || (lineState === 'out' && clock >= rollOutEnd)) ? hold + dt : 0; if (hold >= T_.swapHoldMs / 1000) { setInfo(active); hold = 0; if (!reduced) rollLines('in', rollDur(s.speedL)); } } else hold = 0;
    const q = reduced ? Math.round(bp * 20) : Math.round(bp * T_.textBlurPx * 2) / 2; // 0.5 px steps (reduced: 5 % opacity steps)
    if (q !== lastQ) {
      lastQ = q;
      if (reduced) infoEl.style.opacity = String(1 - q / 20); else infoEl.style.filter = `blur(${q.toFixed(1)}px)`;
    }
    // ---- title (R27 smear): fades out while the strip moves, plays the smear at scroll stop
    smear.sweep();
    const smearOn = smear.gl || (!reduced && !smear.lost);
    if (window.__titleScrub) { /* dev: the contact sheet drives the title by hand */ } else if (!stopped) {
      if (smear.playing) smear.abort();
      else if (titleOp > 0.001) {
        if (!reduced && !fxOff && smearOn && leaveTitle()) { /* the shader leave from the formed title */ }
        else { titleOp = Math.max(0, titleOp - dt / Math.max(T_.titleOutSec, 0.01)); titleEl.style.opacity = titleOp.toFixed(3); titleFadeFrames++; } // the plain fade: reduced motion, ?fx=0, ?gl=0, a lost context only
      }
    } else if (smear.playing) {
      if (smear.leaving && titleShown === active) smear.resume(); // stopped before the leave ended: the enter goes on from where it got to
    } else if (!titleBusy) {
      if (titleShown !== active || titleOp < 0.95) {
        if (reduced || !smearOn || fxOff) { // plain fade: out, swap while hidden, in
          if (titleShown !== active) { titleOp = Math.max(0, titleOp - dt / 0.2); if (titleOp <= 0) setTitle(active); } else titleOp = Math.min(1, titleOp + dt / 0.2);
          titleEl.style.opacity = titleOp.toFixed(3);
        } else { if (titleShown !== active) setTitle(active); titleEl.style.opacity = '0'; playTitle(); }
      }
    }
    // ---- counter (odometer): the project number; the filter is stable, only its blur changes (quantised)
    if (s.idxHead !== lastIdx && stopped) { lastIdx = s.idxHead; srEl.textContent = `Project ${String(s.idxHead + 1).padStart(2, '0')} of ${N}`; }
    setCounter(dt, s.kNum, stopped);
    syncBlur();
    if (blurWas) { const cb = Math.round(bp * WORK_COUNTER.counterBlurPx * 4) / 4; if (cb !== lastBlur) { lastBlur = cb; blurNode.setAttribute('stdDeviation', `0 ${cb}`); } }
    numEl.style.opacity = reduced ? String(1 - bp) : '1';
    // ---- scroll line: x = frac(strip position / N) x the page size, eased after the strip; the second instance rolls in from the other edge
    if (lineI.length) {
      const on = WORK_LINE.scrollLineOn, vOri = mv < 0.02 ? s.vertical : lineVert; // (the orientation changes only while the line is faded out during the toggle morph)
      if (vOri !== lineVert) { lineVert = vOri; lineLast = [NaN, NaN]; lineI.forEach((e) => { e.style.width = lineVert ? '100%' : `${lineW}px`; e.style.height = lineVert ? `${lineW}px` : '100%'; }); }
      const size = lineVert ? lineSize[1] : lineSize[0], span = size * (1 + WORK_LINE.scrollLineGap), target = (s.pos / N) * span; // (the period is a little wider than the page: the line really leaves at one edge, travels outside, and enters from the other)
      if (!lineInit) { lineX = target; lineInit = true; lineLast = [NaN, NaN]; }
      if (reduced) lineX = target; else lineX += (target - lineX) * (1 - Math.exp((-dt * 3) / Math.max(WORK_LINE.scrollLineFollowSec, 0.05))); // 95 % of the way in scrollLineFollowSec
      if (Math.abs(target - lineX) < 0.25) lineX = target; // (under a quarter pixel it has arrived: it stands still)
      lineStep = lineX - (lineStep0 ?? lineX); lineStep0 = lineX;
      const xm = ((lineX % span) + span) % span, xs = [xm, xm - span];
      for (let k = 0; k < 2; k++) if (xs[k] !== lineLast[k]) { lineLast[k] = xs[k]; lineI[k].style.transform = lineVert ? `translate3d(0,${xs[k].toFixed(2)}px,0)` : `translate3d(${xs[k].toFixed(2)}px,0,0)`; }
      const op = on ? WORK_LINE.scrollLineOpacity * mv : 0;
      if (Math.abs(op - lineOp) > 0.001 || Number.isNaN(lineOp)) { lineOp = op; lineI.forEach((e) => (e.style.opacity = op.toFixed(3))); }
      lineEl.classList.toggle('is-over', !!WORK_LINE.scrollLineOver);
    }
    // ---- ruler: the dots slide with the fractional position. The dot at the centre is lit while the strip moves (the others dim by their distance); the bar (that dot grown) shows only
    // after the scroll has stopped, on the dot of the project the strip is heading to; it shrinks back to a dot as soon as the strip moves again
    const gt = stopped ? 1 : 0, R_ = WORK_RULER;
    g = reduced ? gt : gt > g ? Math.min(1, g + dt / Math.max(R_.rulerGrowSec, 0.01)) : Math.max(0, g - dt / Math.max(R_.rulerShrinkSec, 0.01));
    const ge = gt > 0 ? 1 - (1 - g) * (1 - g) : g; // ease out on the way up
    const half = Math.floor(Math.min(N, 7) / 2) + 0.5, v = s.vertical, dim = R_.rulerDimOpacity, headDot = ((s.kHead % dots.length) + dots.length) % dots.length;
    for (let j = 0; j < dots.length; j++) {
      const d = wrapN(j - s.pos, dots.length), ad = Math.abs(d);
      const a = Math.min(1, Math.max(0, (half - ad) / 0.5)) * mv;
      const grow = (j === headDot ? 1 : 0) * ge;
      const lit = 1 - smooth(0.5, 1, ad); // 1 for the dot nearest the centre, fading by distance
      const off = Math.sign(d) * (R_.pitch * ad + R_.extra * smooth(0, 1, ad) * (0.5 + 0.5 * ge)) * (T.W / 1920);
      const sLong = (R_.dot + (R_.bar - R_.dot) * grow) / R_.bar, sShort = (R_.dot + (R_.barW - R_.dot) * grow) / R_.dot;
      let o = a * (dim + (1 - dim) * Math.max(lit, grow));
      if (ad < 0.5) o = Math.max(o, a * R_.rulerCentreMin); // the dot nearest the centre never dims while the strip moves
      const key = `${off.toFixed(2)}|${sLong.toFixed(3)}`, rj = rd[j];
      if (rj.k !== key) { rj.k = key; dots[j].style.transform = v ? `translate3d(0,${off.toFixed(2)}px,0) scale(${sLong.toFixed(4)},${sShort.toFixed(4)})` : `translate3d(${off.toFixed(2)}px,0,0) scale(${sShort.toFixed(4)},${sLong.toFixed(4)})`; }
      if (Math.abs(o - rj.a) > 0.002 || Number.isNaN(rj.a)) { rj.a = o; dots[j].style.opacity = o.toFixed(3); }
    }
  };
  const rollMode = (to, morphSec) => { // called when the toggle morph starts: lines roll out at once, the new layout rolls in at modeRollInAt of the morph (the new text is in place when the strip lands)
    settleRoll();
    if (to === cols[0].el.dataset.pos) return;
    const mine = (modeRoll = { to }), fade = reduced || !!window.__w2NoRoll, inAt = fade ? 0.2 : Math.max(0.3, morphSec * WORK_V2.modeRollInAt);
    if (fade) { cols.forEach((col) => { col.el.style.transition = 'opacity 0.2s'; col.el.style.opacity = '0'; }); at(inAt, () => { if (modeRoll !== mine) return; cols.forEach((col) => { placeCol(col, to); col.el.style.opacity = '1'; }); at(0.3, () => { if (modeRoll === mine) settleRoll(); }); }); return; }
    rollLines('out', WORK_V2.modeRollSec);
    at(inAt, () => { if (modeRoll !== mine) return; cols.forEach((col) => placeCol(col, to)); rollLines('in', WORK_V2.modeRollSec); at(WORK_V2.modeRollSec + 0.3, () => { if (modeRoll === mine) { modeRoll = null; lineState = 'in'; } }); });
  };
  return { root, lineEl, get counterState() { return { D, DV, target: lastTarget }; }, get titleStats() { return { fadeFrames: titleFadeFrames, leaveStarts: titleLeaveStarts }; }, get rollInfo() { return { lineState, lastDur, cols: cols.map((c) => c.lines.length), y: cols.map((c) => c.lines.map((L) => +L.t.y.toFixed(1))) }; }, get lineState() { return { x: lineX, vert: lineVert, step: lineStep, last: [...lineLast] }; }, switchEl, layout, frame, setMode, rollMode, settleRoll, el: root, titles: T, infos, smear, scrubTitle(idx, t, leaveT) { setTitle(idx); const size = T.size[idx], text = T.shown[idx]; const g = domGeometry(); const u = leaveT !== undefined ? 0.5 + 0.5 * Math.pow(Math.min(1, leaveT / WORK_SMEAR.leaveSec), 2) : 0.5 * (1 - Math.pow(1 - Math.min(1, t / WORK_SMEAR.enterSec), WORK_SMEAR.enterPow)); smear.scrub({ el: titleEl, text, size, weight: WORK_TITLE.weight, family: '"Clash Display", system-ui, sans-serif', color: WORK_UI.color, tracking: WORK_TITLE.tracking, x: g.x, baseline: g.baseline }, u); }, get roll() { return { R: D, V: DV }; }, get counterMetrics() { return { ...M, adv: [...M.adv], inkR: [...M.inkR] }; }, get state() { return { bp, g, titleOp, titleShown, shown, titleBusy }; } };
}
