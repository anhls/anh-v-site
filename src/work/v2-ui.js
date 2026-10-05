// R32 Work page v2 (desktop): the title overlay, the info blocks, the ruler, the counter, the mode switch and the "Reach out" link.
// One DOM layer (.w2, pointer-events none except the switch and the link) above the canvas. work.js calls layout() when the sizes change and frame() once per tick with
// numbers it already has (no layout reads here per frame: every size is cached by layout(), every write is a transform / opacity and only when it changed).
import { WORK_UI, WORK_TITLE, WORK_INFO, WORK_RULER, WORK_COUNTER, WORK_TEXT, WORK_SMEAR, WORK_PTR } from '../timeline.js';
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
  const infos = projects.map((p) => projectInfo(p));
  const root = document.createElement('div');
  root.className = 'w2';
  // ONE title and ONE info block at their fixed place; the content swaps to the project the strip is heading to (R33c: at scroll stop)
  root.innerHTML = `
    <div class="w2__titles" aria-hidden="true"><span class="w2__title" data-fx=""></span></div>
    <div class="w2__infos" aria-hidden="true"><div class="w2__info"><div class="w2__tags"></div><div class="w2__year"></div><div class="w2__desc"></div></div></div>
    <div class="w2__ruler" aria-hidden="true">${Array.from({ length: 9 }, () => '<i></i>').join('')}</div>
    <div class="w2__counter" role="status" aria-live="polite"><span class="w2__label">${esc(WORK_UI.label)}</span><span class="w2__num" aria-hidden="true">${[0, 1].map(() => '<span class="w2__slot"><span class="w2__col"><span></span><span></span></span></span>').join('')}</span><span class="w2__total" aria-hidden="true">/${String(N).padStart(2, '0')}</span><span class="w2__sr"></span></div>
    <svg class="w2__defs" width="0" height="0" aria-hidden="true"><filter id="w2-vblur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="0 0"/></filter></svg>
    <button type="button" class="w2__switch w2__hit"><span class="w2__swtext"></span><span class="footer__line"></span></button>
    <div class="w2__reach"><span>${esc(WORK_UI.reachLabel)}</span><a class="w2__hit w2__email" href="mailto:${esc(WORK_UI.reachEmail)}">${esc(WORK_UI.reachEmail)}</a></div>`;
  app.append(root);
  const titleEl = root.querySelector('.w2__title'), infoEl = root.querySelector('.w2__info');
  const tagsEl = root.querySelector('.w2__tags'), yearEl = root.querySelector('.w2__year'), descEl = root.querySelector('.w2__desc');
  const dots = [...root.querySelectorAll('.w2__ruler i')];
  const switchEl = root.querySelector('.w2__switch'), swText = root.querySelector('.w2__swtext');
  const numEl = root.querySelector('.w2__num'), slots = [...root.querySelectorAll('.w2__col')].map((col) => ({ col, a: col.children[0], b: col.children[1], k: null, fr: NaN }));
  const srEl = root.querySelector('.w2__sr'), blurNode = root.querySelector('feGaussianBlur');
  const measureSwitch = lineHover(switchEl);
  const smear = createSmear({ host: root, cfg: WORK_SMEAR, reduced });
  let mode = 'side';
  numEl.style.filter = 'url(#w2-vblur)'; // R33c: the counter's filter is attached for the whole visit (never toggled): no layer is made or dropped while it blurs

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

  // ---- the info block (blur only) and the title (R27 smear) show the project the strip is HEADING to once the scroll has stopped
  //   info: bp = blur progress 0 (sharp) .. 1 (full blur): in over textBlurInSec once the strip moves, held while it moves, out over textBlurOutSec after the stop; the content swaps
  //   only after a short hold at full blur (swapHoldMs). The blur is quantised to 0.5 px and written only when the quantised value changes; the layer is promoted (will-change: filter)
  //   for the whole visit and the filter is never switched to `none` in between (a layer made or dropped at every start / end was a flash).
  let shown = -1, bp = 1, lastQ = -1, outT = 1, outFrom = 1, hold = 0;
  let titleShown = -1, titleOp = 0, titleBusy = false;
  const setInfo = (idx) => {
    shown = idx;
    const inf = infos[idx];
    tagsEl.innerHTML = inf.tags.map(esc).join('<br>'); yearEl.textContent = inf.year; descEl.textContent = inf.desc;
    tagsEl.style.display = inf.tags.length ? '' : 'none'; yearEl.style.display = inf.year ? '' : 'none'; descEl.style.display = inf.desc ? '' : 'none';
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
    fitTitles(iw);
    applyVars();
    smear.cancel();
    if (titleShown >= 0) { setTitle(titleShown); titleEl.style.opacity = String(titleOp); }
    if (shown >= 0) setInfo(shown);
    placeTitle();
    setMode(mode); // (the copy may have been edited in ?tune)
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
  const playTitle = () => {
    const size = T.size[titleShown], text = T.shown[titleShown];
    cv.font = `${WORK_TITLE.weight} ${size}px "Clash Display"`;
    const adv = cv.measureText(text).width, left = parseFloat(titleEl.style.left), top = parseFloat(titleEl.style.top);
    const slice = Math.max(0, (T.iw - adv) / 2 + WORK_PTR.pixelSpill * Math.min(1, T.W / 1920)); // the slices stay inside the image rectangle + the pixel-smear spill
    const g = domGeometry();
    titleBusy = true;
    smear.play({ el: titleEl, text, size, weight: WORK_TITLE.weight, family: '"Clash Display", system-ui, sans-serif', color: WORK_TITLE.color, x: g.x, baseline: g.baseline, boxLeft: left, boxTop: top, padX: slice, maxSlicePx: slice,
      done: () => { titleOp = 1; titleBusy = false; }, aborted: () => { titleOp = 0; titleBusy = false; } });
  };

  // ---- state
  let mv = 1, g = 0, lastIdx = -1;
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
  const label = (n) => String((((n - 1) % N) + N) % N + 1).padStart(2, '0'); // the project number n (unwrapped) shown on the counter
  let lastBlur = -1, D = 0, DV = 0, Dinit = false;
  // The counter position D = an unwrapped project NUMBER (float); each digit slot shows two faces (the number below and the one above) and slides between them. A step between two
  // neighbouring numbers is one slide (05 -> 01 at the wrap is ONE slide: 05 out, 01 in); a flick over several numbers passes every one of them. A spring (settle counterSettleSec,
  // overshoot counterOvershoot) with a speed cap brings it onto the target.
  const setCounter = (dt, target, stopped) => {
    if (!Dinit) { D = target; Dinit = true; }
    const C = WORK_COUNTER;
    if (reduced) { if (bp >= 0.999) { D = target; DV = 0; } } else {
      const lag = C.counterMaxSteps * 3; // (never skips a number below this; only a runaway lag of 3 s of rolling is cut)
      if (Math.abs(target - D) > lag) D = target - Math.sign(target - D) * lag;
      const cap = stopped ? Math.max(C.counterMaxSteps, Math.abs(target - D) / 0.5) : C.counterMaxSteps;
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
    const fl = Math.floor(D), fr = D - fl, s0 = label(fl), s1 = label(fl + 1);
    slots.forEach((sl, j) => {
      const key = `${s0[j]}${s1[j]}`;
      if (sl.k !== key) { sl.k = key; sl.a.textContent = s0[j]; sl.b.textContent = s1[j]; }
      if (Math.abs(fr - sl.fr) > 0.0005 || Number.isNaN(sl.fr)) { sl.fr = fr; sl.col.style.transform = `translate3d(0,${(-fr * 50).toFixed(3)}%,0)`; }
    });
  };

  // one call per tick. s = { idx (nearest project), idxHead (the project the strip is heading to), kNum (unwrapped number of the target: nearest while moving, the heading one after the stop),
  //   kHead (unwrapped heading index), pos (strip position in pitches, unwrapped), vertical, morph, stopped (scroll has stopped), dt (s) }
  const frame = (s) => {
    const dt = Math.min(s.dt, 0.1);
    const mt = s.morph ? 0 : 1;
    mv = reduced ? mt : mv + (mt - mv) * Math.min(1, dt / 0.18);
    const stopped = s.stopped && !s.morph, active = s.idxHead, T_ = WORK_TEXT;
    // ---- info: blur ONLY (opacity stays 1; reduced motion fades instead)
    const inSec = reduced ? 0.2 : T_.textBlurInSec, outSec = reduced ? 0.2 : T_.textBlurOutSec;
    const want = stopped && shown === active;
    if (!want) { bp = Math.min(1, bp + dt / Math.max(inSec, 0.01)); outFrom = bp; outT = 0; }
    else { outT = Math.min(1, outT + dt / Math.max(outSec, 0.01)); bp = outFrom * (1 - (reduced ? outT : ease(outT))); }
    if (stopped && shown !== active) { hold = bp >= 0.999 ? hold + dt : 0; if (hold >= T_.swapHoldMs / 1000) { setInfo(active); hold = 0; } } else hold = 0;
    const q = reduced ? Math.round(bp * 20) : Math.round(bp * T_.textBlurPx * 2) / 2; // 0.5 px steps (reduced: 5 % opacity steps)
    if (q !== lastQ) {
      lastQ = q;
      if (reduced) infoEl.style.opacity = String(1 - q / 20); else infoEl.style.filter = `blur(${q.toFixed(1)}px)`;
    }
    // ---- title (R27 smear): fades out while the strip moves, plays the smear at scroll stop
    const smearOn = smear.gl || (!reduced && !smear.lost);
    if (window.__titleScrub) { /* dev: the contact sheet drives the title by hand */ } else if (!stopped) {
      if (smear.playing) smear.abort(T_.titleOutSec);
      else if (titleOp > 0) { titleOp = Math.max(0, titleOp - dt / Math.max(T_.titleOutSec, 0.01)); titleEl.style.opacity = titleOp.toFixed(3); }
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
    const cb = reduced ? 0 : Math.round(bp * WORK_COUNTER.counterBlurPx * 4) / 4;
    if (cb !== lastBlur) { lastBlur = cb; blurNode.setAttribute('stdDeviation', `0 ${cb}`); }
    numEl.style.opacity = reduced ? String(1 - bp) : '1';
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
      const off = Math.sign(d) * (R_.pitch * ad + R_.extra * smooth(0, 1, ad) * (0.5 + 0.5 * ge));
      const sLong = (R_.dot + (R_.bar - R_.dot) * grow) / R_.bar, sShort = (R_.dot + (R_.barW - R_.dot) * grow) / R_.dot;
      let o = a * (dim + (1 - dim) * Math.max(lit, grow));
      if (ad < 0.5) o = Math.max(o, a * R_.rulerCentreMin); // the dot nearest the centre never dims while the strip moves
      const key = `${off.toFixed(2)}|${sLong.toFixed(3)}`, rj = rd[j];
      if (rj.k !== key) { rj.k = key; dots[j].style.transform = v ? `translate3d(0,${off.toFixed(2)}px,0) scale(${sLong.toFixed(4)},${sShort.toFixed(4)})` : `translate3d(${off.toFixed(2)}px,0,0) scale(${sShort.toFixed(4)},${sLong.toFixed(4)})`; }
      if (Math.abs(o - rj.a) > 0.002 || Number.isNaN(rj.a)) { rj.a = o; dots[j].style.opacity = o.toFixed(3); }
    }
  };
  return { root, switchEl, layout, frame, setMode, el: root, titles: T, infos, smear, scrubTitle(idx, t) { setTitle(idx); const size = T.size[idx], text = T.shown[idx]; cv.font = `${WORK_TITLE.weight} ${size}px "Clash Display"`; const adv = cv.measureText(text).width, left = parseFloat(titleEl.style.left), top = parseFloat(titleEl.style.top), slice = Math.max(0, (T.iw - adv) / 2 + WORK_PTR.pixelSpill * Math.min(1, T.W / 1920)); const g = domGeometry(); smear.scrub({ el: titleEl, text, size, weight: WORK_TITLE.weight, family: '"Clash Display", system-ui, sans-serif', color: WORK_TITLE.color, x: g.x, baseline: g.baseline, boxLeft: left, boxTop: top, padX: slice, maxSlicePx: slice }, t); }, get roll() { return { R: D, V: DV }; }, get state() { return { bp, g, titleOp, titleShown, shown, titleBusy }; } };
}
