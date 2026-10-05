// R32 Work page v2 (desktop): the title overlay, the info blocks, the ruler, the counter, the mode switch and the "Reach out" link.
// One DOM layer (.w2, pointer-events none except the switch and the link) above the canvas. work.js calls layout() when the sizes change and frame() once per tick with
// numbers it already has (no layout reads here per frame: every size is cached by layout(), every write is a transform / opacity and only when it changed).
import { WORK_UI, WORK_TITLE, WORK_INFO, WORK_RULER, WORK_COUNTER, WORK_TEXT } from '../timeline.js';
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
  const infos = projects.map((p) => projectInfo(p));
  const root = document.createElement('div');
  root.className = 'w2';
  // R33: ONE title and ONE info block at their fixed place; the content swaps to the project in focus (while hidden)
  root.innerHTML = `
    <div class="w2__titles" aria-hidden="true"><span class="w2__title" data-fx=""></span></div>
    <div class="w2__infos" aria-hidden="true"><div class="w2__info"><div class="w2__tags"></div><div class="w2__year"></div><div class="w2__desc"></div></div></div>
    <div class="w2__ruler" aria-hidden="true">${Array.from({ length: 9 }, () => '<i></i>').join('')}</div>
    <div class="w2__counter" role="status" aria-live="polite"><span class="w2__label">${esc(WORK_UI.label)}</span><span class="w2__num" aria-hidden="true">${[0, 1].map(() => '<span class="w2__slot"><span class="w2__col"></span></span>').join('')}</span><span class="w2__total" aria-hidden="true">/${String(N).padStart(2, '0')}</span><span class="w2__sr"></span></div>
    <svg class="w2__defs" width="0" height="0" aria-hidden="true"><filter id="w2-vblur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
    <button type="button" class="w2__switch w2__hit"><span class="w2__swtext"></span><span class="footer__line"></span></button>
    <div class="w2__reach"><span>${esc(WORK_UI.reachLabel)}</span><a class="w2__hit w2__email" href="mailto:${esc(WORK_UI.reachEmail)}">${esc(WORK_UI.reachEmail)}</a></div>`;
  app.append(root);
  const titleEl = root.querySelector('.w2__title'), infoEl = root.querySelector('.w2__info');
  const tagsEl = root.querySelector('.w2__tags'), yearEl = root.querySelector('.w2__year'), descEl = root.querySelector('.w2__desc');
  const dots = [...root.querySelectorAll('.w2__ruler i')];
  const switchEl = root.querySelector('.w2__switch'), swText = root.querySelector('.w2__swtext');
  const numEl = root.querySelector('.w2__num'), slots = [...root.querySelectorAll('.w2__col')].map((col) => { col.innerHTML = Array.from({ length: 30 }, (_, i) => `<span>${i % 10}</span>`).join(''); return { col, last: NaN }; }); // R33b: a DRUM per digit: 0-9 three times, so it turns either way without a seam
  const srEl = root.querySelector('.w2__sr'), blurNode = root.querySelector('feGaussianBlur');
  const measureSwitch = lineHover(switchEl);
  let mode = 'side';

  // ---- titles: size calibrated so the specimen is specimenFrac of the image width, then shrink / trim to fit
  const cv = document.createElement('canvas').getContext('2d');
  const widthAt100 = (text) => { cv.font = `${WORK_TITLE.weight} 100px "Clash Display"`; const m = cv.measureText(text); return m.actualBoundingBoxRight + m.actualBoundingBoxLeft; }; // the INK width (the reference measures the letters, not the advance)
  const T = { size: new Float64Array(N), text: projects.map((p) => p.titleShort || p.title), shown: projects.map((p) => p.titleShort || p.title), s0: 0, iw: 0, ih: 0, asc: 0.9, W: 0, H: 0 };
  const fitTitles = (iw) => {
    const w100 = widthAt100(WORK_TITLE.specimen);
    const s0 = (WORK_TITLE.specimenFrac * iw * 100) / w100, fit = WORK_TITLE.fitFrac * iw;
    T.s0 = s0;
    cv.font = `${WORK_TITLE.weight} 100px "Clash Display"`;
    const m = cv.measureText('Hx');
    const asc = m.fontBoundingBoxAscent ?? 90, desc = m.fontBoundingBoxDescent ?? 25; // line-height 1: the baseline sits (1 - (asc + desc) / em) / 2 + asc below the top of the line box
    T.asc = ((100 - (asc + desc)) / 2 + asc) / 100;
    projects.forEach((p, i) => {
      let text = T.text[i], size = s0, w = (widthAt100(text) * size) / 100;
      if (w > fit) { size = Math.max(WORK_TITLE.minScale * s0, (s0 * fit) / w); w = (widthAt100(text) * size) / 100; }
      if (w > fit + 0.5) { const words = text.split(' '); while (words.length > 1 && (widthAt100(words.join(' ')) * size) / 100 > fit + 0.5) words.pop(); text = words.join(' '); }
      T.size[i] = size; T.shown[i] = text;
    });
  };
  let lastIw = 0, lastIh = 0;
  const applyVars = () => { // the numbers of WORK_INFO / WORK_RULER as CSS custom properties (re-applied on every layout so ?tune takes effect)
    const set = (n, o) => Object.entries(o).forEach(([k, v]) => root.style.setProperty(`--${n}-${k}`, String(v)));
    set('is', WORK_INFO.side); set('iv', WORK_INFO.vertical);
    root.style.setProperty('--rd-dot', String(WORK_RULER.dot)); root.style.setProperty('--rd-bar', String(WORK_RULER.bar));
  };
  // text state (R33b, blur only): shown = the project whose text is in the DOM; bp = blur progress 0 (sharp) .. 1 (full blur), in 0.2 s once the strip moves, out over ~1.3 s at rest
  let shown = -1, bp = 1, lastBp = -1, outT = 1, outFrom = 1;
  const swap = (idx) => {
    shown = idx;
    const inf = infos[idx];
    titleEl.textContent = T.shown[idx]; titleEl.style.fontSize = `${T.size[idx].toFixed(2)}px`;
    tagsEl.innerHTML = inf.tags.map(esc).join('<br>'); yearEl.textContent = inf.year; descEl.textContent = inf.desc;
    tagsEl.style.display = inf.tags.length ? '' : 'none'; yearEl.style.display = inf.year ? '' : 'none'; descEl.style.display = inf.desc ? '' : 'none';
    placeTitle();
    lastBp = -1;
  };
  // the title sits at the image centre of the resting strip = the window centre (the same place in both modes); it never moves with the strip or the hover
  const placeTitle = () => {
    if (!T.iw) return;
    titleEl.style.width = `${T.iw.toFixed(2)}px`;
    const size = shown >= 0 ? T.size[shown] : T.s0;
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
    fitTitles(iw);
    applyVars();
    if (shown >= 0) swap(shown); else placeTitle();
    setMode(mode); // (the copy may have been edited in ?tune)
  };
  // the sizes depend on the font: load the weights first (document.fonts.ready can resolve before a font that no text has used yet starts loading), then measure again
  Promise.all([600, 400, 200].map((w) => document.fonts?.load(`${w} 100px "Clash Display"`))).then(() => { if (lastIw) layout(lastIw, lastIh); }).catch(() => {});

  // ---- state
  let mv = 1, g = 0, lastIdx = -1;
  let R = 0, V = 0, Rinit = false; // the odometer position (unwrapped project number, float) and its speed (numbers / s)
  const rd = dots.map(() => ({ k: '', a: NaN }));
  const setMode = (m) => {
    mode = m;
    root.dataset.mode = m;
    swText.textContent = WORK_UI.copy[m === 'vertical' ? 'vertical' : 'side'];
    const next = m === 'vertical' ? 'side' : 'vertical';
    switchEl.setAttribute('aria-label', `${swText.textContent} (switch to ${next} scroll)`);
    measureSwitch();
  };
  const ease = (x) => x * x * (3 - 2 * x);
  let lastBlur = -1, D = 0, DV = 0, Dinit = false, lastDigits = '';
  // the drum position D (a float, the project number 1..N, NO wrap shortcut: 05 -> 01 turns back through 04, 03, 02) follows the nearest project's number with a speed cap and an
  // ease-out onto it. A units drum turns on every number; the tens drum only while the tens digit changes.
  const setCounter = (dt, target, rest, hidden) => {
    if (!Dinit) { D = target; Dinit = true; }
    const C = WORK_COUNTER;
    if (reduced) { if (hidden) { D = target; DV = 0; } } else {
      const lag = C.counterMaxSteps * 0.6;
      if (Math.abs(target - D) > lag) D = target - Math.sign(target - D) * lag;
      const cap = rest ? Math.max(C.counterMaxSteps, Math.abs(target - D) / 0.5) : C.counterMaxSteps;
      const w = 6 / Math.max(C.counterSettleSec, 0.05), z = C.counterOvershoot > 0 ? 0.8 : 1, steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
      for (let q = 0; q < steps; q++) {
        DV += (w * w * (target - D) - 2 * z * w * DV) * h;
        DV = Math.max(-cap, Math.min(cap, DV));
        D += DV * h;
        const over = (D - target) * Math.sign(DV);
        if (over > C.counterOvershoot) { D = target + Math.sign(DV) * C.counterOvershoot; DV *= 0.5; }
      }
      if (Math.abs(target - D) < 0.0005 && Math.abs(DV) < 0.01) { D = target; DV = 0; }
    }
    const un = ((D % 10) + 10) % 10, tf = Math.floor(D / 10) + Math.max(0, un - 9); // units drum position; tens drum: moves only during the last digit step of the units
    const pos = [tf, un];
    slots.forEach((sl, j) => {
      const v = j === 0 ? ((pos[0] % 10) + 10) % 10 : pos[1];
      if (Math.abs(v - sl.last) > 0.0005 || Number.isNaN(sl.last)) { sl.last = v; sl.col.style.transform = `translate3d(0,${(-((v + 10) / 30) * 100).toFixed(4)}%,0)`; }
    });
    return Math.abs(DV);
  };
  const applyBlur = (px, rollSpeed) => {
    const C = WORK_COUNTER, b = reduced ? 0 : Math.max(px * (C.counterBlurPx / Math.max(WORK_TEXT.textBlurPx, 0.01)), C.counterBlurPx * Math.min(1, rollSpeed / Math.max(C.counterMaxSteps * 0.5, 1)));
    if (Math.abs(b - lastBlur) > 0.05) { lastBlur = b; blurNode.setAttribute('stdDeviation', `0 ${b.toFixed(2)}`); numEl.style.filter = b > 0.1 ? 'url(#w2-vblur)' : 'none'; }
  };

  // one call per tick. s = { idx (nearest project), kTarget (nearest, unwrapped), pos (strip position in pitches, unwrapped), vertical, morph, focused, dt (s) }
  const frame = (s) => {
    const dt = Math.min(s.dt, 0.1);
    const mt = s.morph ? 0 : 1;
    mv = reduced ? mt : mv + (mt - mv) * Math.min(1, dt / 0.18);
    // ---- text (R33b): blur ONLY (opacity stays 1; reduced motion fades instead). Blur in 0.2 s once the strip moves, held while it moves, eased out over ~1.3 s at rest; the content
    // swaps to the nearest project while fully blurred, so a change is never seen in focus
    const T_ = WORK_TEXT, want = s.focused && !s.morph && shown === s.idx;
    const inSec = reduced ? 0.2 : T_.textBlurInSec, outSec = reduced ? 0.2 : T_.textBlurOutSec;
    if (!want) { if (outT < 1) outT = 1; bp = Math.min(1, bp + dt / Math.max(inSec, 0.01)); outFrom = bp; outT = 0; }
    else { outT = Math.min(1, outT + dt / Math.max(outSec, 0.01)); bp = outFrom * (1 - (reduced ? outT : ease(outT))); }
    if (bp >= 0.999 && shown !== s.idx) swap(s.idx);
    if (bp !== lastBp) {
      lastBp = bp;
      const bl = reduced ? 0 : bp * T_.textBlurPx, filt = bl > 0.1 ? `blur(${bl.toFixed(2)}px)` : 'none', op = reduced ? (1 - bp).toFixed(3) : '1';
      titleEl.style.filter = filt; infoEl.style.filter = filt; titleEl.style.opacity = op; infoEl.style.opacity = op;
    }
    // ---- counter (odometer drum): the project number, no wrap
    if (s.idx !== lastIdx) { lastIdx = s.idx; srEl.textContent = `Project ${String(s.idx + 1).padStart(2, '0')} of ${N}`; }
    const rollSpeed = setCounter(dt, s.idxNum, s.rest, bp >= 0.999);
    applyBlur(bp * T_.textBlurPx, rollSpeed);
    numEl.style.opacity = reduced ? (1 - bp).toFixed(3) : '1';
    // ---- ruler: the dots slide with the fractional position. The bar (the dot at the centre) shrinks to a dot and dims as soon as the text goes, and lights up and grows only
    // when the project is in focus (g: 0 = all dots, 1 = the bar).
    const gt = s.focused && !s.morph ? 1 : 0, R_ = WORK_RULER;
    g = reduced ? gt : gt > g ? Math.min(1, g + dt / Math.max(R_.rulerGrowSec, 0.01)) : Math.max(0, g - dt / Math.max(R_.rulerShrinkSec, 0.01));
    const ge = gt > 0 ? 1 - (1 - g) * (1 - g) : g; // ease out on the way up
    const half = Math.floor(Math.min(N, 7) / 2) + 0.5, v = s.vertical, dim = R_.rulerDimOpacity;
    for (let j = 0; j < dots.length; j++) {
      const d = wrapN(j - s.pos, dots.length), ad = Math.abs(d);
      const a = Math.min(1, Math.max(0, (half - ad) / 0.5)) * mv;
      const grow = (1 - smooth(0.05, 0.6, ad)) * ge;
      const off = Math.sign(d) * (R_.pitch * ad + R_.extra * smooth(0, 1, ad) * (0.5 + 0.5 * ge));
      const sLong = (R_.dot + (R_.bar - R_.dot) * grow) / R_.bar, sShort = (R_.dot + (R_.barW - R_.dot) * grow) / R_.dot;
      const o = a * (dim + (1 - dim) * grow);
      const key = `${off.toFixed(2)}|${sLong.toFixed(3)}`, rj = rd[j];
      if (rj.k !== key) { rj.k = key; dots[j].style.transform = v ? `translate3d(0,${off.toFixed(2)}px,0) scale(${sLong.toFixed(4)},${sShort.toFixed(4)})` : `translate3d(${off.toFixed(2)}px,0,0) scale(${sShort.toFixed(4)},${sLong.toFixed(4)})`; }
      if (Math.abs(o - rj.a) > 0.002 || Number.isNaN(rj.a)) { rj.a = o; dots[j].style.opacity = o.toFixed(3); }
    }
  };
  return { root, switchEl, layout, frame, setMode, el: root, titles: T, infos, get roll() { return { R: D, V: DV }; } };
}
