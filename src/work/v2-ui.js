// R32 Work page v2 (desktop): the title overlay, the info blocks, the ruler, the counter, the mode switch and the "Reach out" link.
// One DOM layer (.w2, pointer-events none except the switch and the link) above the canvas. work.js calls layout() when the sizes change and frame() once per tick with
// numbers it already has (no layout reads here per frame: every size is cached by layout(), every write is a transform / opacity and only when it changed).
import { WORK_UI, WORK_TITLE, WORK_INFO, WORK_RULER, WORK_COUNTER } from '../timeline.js';
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
  root.innerHTML = `
    <div class="w2__titles" aria-hidden="true">${projects.map((p) => `<span class="w2__title" data-fx="">${esc(p.titleShort || p.title)}</span>`).join('')}</div>
    <div class="w2__infos" aria-hidden="true">${infos.map((inf) => `<div class="w2__info">${inf.tags.length ? `<div class="w2__tags">${inf.tags.map(esc).join('<br>')}</div>` : ''}${inf.year ? `<div class="w2__year">${esc(inf.year)}</div>` : ''}${inf.desc ? `<div class="w2__desc">${esc(inf.desc)}</div>` : ''}</div>`).join('')}</div>
    <div class="w2__ruler" aria-hidden="true">${Array.from({ length: 9 }, () => '<i></i>').join('')}</div>
    <div class="w2__counter" role="status" aria-live="polite"><span class="w2__label">${esc(WORK_UI.label)}</span><span class="w2__num" aria-hidden="true"><span></span><span></span></span><span class="w2__total" aria-hidden="true">/${String(N).padStart(2, '0')}</span><span class="w2__sr"></span></div>
    <button type="button" class="w2__switch w2__hit"><span class="w2__swtext"></span><span class="footer__line"></span></button>
    <div class="w2__reach"><span>${esc(WORK_UI.reachLabel)}</span><a class="w2__hit w2__email" href="mailto:${esc(WORK_UI.reachEmail)}">${esc(WORK_UI.reachEmail)}</a></div>`;
  app.append(root);
  const q = (s) => [...root.querySelectorAll(s)];
  const titles = q('.w2__title'), infoEls = q('.w2__info'), dots = q('.w2__ruler i');
  const switchEl = root.querySelector('.w2__switch'), swText = root.querySelector('.w2__swtext');
  const numEls = [...root.querySelectorAll('.w2__num span')], srEl = root.querySelector('.w2__sr');
  const measureSwitch = lineHover(switchEl);
  let mode = 'side';

  // ---- titles: size calibrated so the specimen is specimenFrac of the image width, then shrink / trim to fit
  const cv = document.createElement('canvas').getContext('2d');
  const widthAt100 = (text) => { cv.font = `${WORK_TITLE.weight} 100px "Clash Display"`; const m = cv.measureText(text); return m.actualBoundingBoxRight + m.actualBoundingBoxLeft; }; // the INK width (the reference measures the letters, not the advance)
  const T = { size: new Float64Array(N), base: new Float64Array(N), text: projects.map((p) => p.titleShort || p.title), shown: projects.map((p) => p.titleShort || p.title), s0: 0, iw: 0, ih: 0, asc: 0.9 };
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
      if (titles[i].textContent !== text) titles[i].textContent = text;
      titles[i].style.fontSize = `${size.toFixed(2)}px`;
    });
  };
  const applyVars = () => { // the numbers of WORK_INFO / WORK_RULER / WORK_COUNTER as CSS custom properties (re-applied on every layout so ?tune takes effect)
    const set = (n, o) => Object.entries(o).forEach(([k, v]) => root.style.setProperty(`--${n}-${k}`, String(v)));
    set('is', WORK_INFO.side); set('iv', WORK_INFO.vertical);
    root.style.setProperty('--rd-dot', String(WORK_RULER.dot)); root.style.setProperty('--rd-bar', String(WORK_RULER.bar));
    root.style.setProperty('--cnt-sec', reduced ? '0.01s' : `${WORK_COUNTER.sec}s`);
  };
  let lastIw = 0, lastIh = 0;
  const layout = (iw, ih) => {
    lastIw = iw; lastIh = ih;
    T.iw = iw; T.ih = ih;
    root.style.setProperty('--hw', `${(iw / 2).toFixed(2)}px`);
    root.style.setProperty('--hh', `${(ih / 2).toFixed(2)}px`);
    titles.forEach((t) => { t.style.width = `${iw.toFixed(2)}px`; });
    fitTitles(iw);
    applyVars();
    setMode(mode); // (the copy may have been edited in ?tune)
  };
  // the sizes depend on the font: load the weights first (document.fonts.ready can resolve before a font that no text has used yet starts loading), then measure again
  Promise.all([600, 400, 200].map((w) => document.fonts?.load(`${w} 100px "Clash Display"`))).then(() => { if (lastIw) layout(lastIw, lastIh); }).catch(() => {});
  // ---- state
  let calm = 1, mv = 1, lastIdx = -1;
  const oT = new Float64Array(N).fill(-1), oI = new Float64Array(N).fill(-1);
  const rd = dots.map(() => ({ x: NaN, a: NaN, s: NaN }));
  const setMode = (m) => {
    mode = m;
    root.dataset.mode = m;
    swText.textContent = WORK_UI.copy[m === 'vertical' ? 'vertical' : 'side'];
    const next = m === 'vertical' ? 'side' : 'vertical';
    switchEl.setAttribute('aria-label', `${swText.textContent} (switch to ${next} scroll)`);
    measureSwitch();
  };
  const setIndex = (idx) => {
    const label = String(idx + 1).padStart(2, '0');
    if (lastIdx < 0) { numEls[0].textContent = label; numEls[0].classList.add('is-on'); numEls[1].textContent = ''; srEl.textContent = `Project ${label} of ${N}`; lastIdx = idx; return; }
    const on = numEls.findIndex((e) => e.classList.contains('is-on')), nx = 1 - on;
    numEls[nx].textContent = label; numEls[nx].classList.add('is-on'); numEls[on].classList.remove('is-on');
    srEl.textContent = `Project ${label} of ${N}`;
    lastIdx = idx;
  };

  // one call per tick. s = { pos (strip position in pitches, unwrapped), idx, vertical, morph, speed (screen lengths / s, abs), dt (s), px[], py[] (the N frame centres, px), W, H }
  const frame = (s) => {
    const dt = Math.min(s.dt, 0.1);
    const tgt = 1 - smooth(WORK_TITLE.fastFrom, WORK_TITLE.fastTo, s.speed);
    calm = reduced || tgt < calm ? tgt : calm + (tgt - calm) * Math.min(1, dt / Math.max(WORK_TITLE.fastSec, 0.01));
    const mt = s.morph ? 0 : 1;
    mv = reduced ? mt : mv + (mt - mv) * Math.min(1, dt / 0.18);
    for (let p = 0; p < N; p++) {
      const d = Math.abs(wrapN(p - s.pos, N));
      const ot = smooth(WORK_TITLE.fadeOut, WORK_TITLE.fadeIn, d) * calm;
      const oi = smooth(WORK_INFO.fadeOut, WORK_INFO.fadeIn, d) * calm * mv;
      const cx = s.px[p], cy = s.py[p];
      const t = titles[p];
      if (ot > 0.002) {
        t.style.transform = `translate3d(${(cx - T.iw / 2 + (WORK_TITLE.dx * T.iw) / 1055).toFixed(2)}px,${(cy + (WORK_TITLE.baseDy * T.ih) / 556 - T.asc * T.size[p]).toFixed(2)}px,0)`;
        if (Math.abs(ot - oT[p]) > 0.002) { t.style.opacity = ot.toFixed(3); oT[p] = ot; }
      } else if (oT[p] !== 0) { t.style.opacity = '0'; oT[p] = 0; }
      const e = infoEls[p];
      if (oi > 0.002) {
        e.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
        if (Math.abs(oi - oI[p]) > 0.002) { e.style.opacity = oi.toFixed(3); oI[p] = oi; }
      } else if (oI[p] !== 0) { e.style.opacity = '0'; oI[p] = 0; }
    }
    if (s.idx !== lastIdx) setIndex(s.idx);
    // ruler: the dots slide with the fractional position; the one passing the centre grows into the bar. pos(d) = 21 d + extra x smoothstep(|d|) (the bar takes room)
    const half = Math.floor(Math.min(N, 7) / 2) + 0.5, R = WORK_RULER, v = s.vertical;
    for (let j = 0; j < dots.length; j++) {
      const d = wrapN(j - s.pos, dots.length), ad = Math.abs(d);
      const a = Math.min(1, Math.max(0, (half - ad) / 0.5)) * mv;
      const grow = 1 - smooth(0.05, 0.6, ad);
      const off = Math.sign(d) * (R.pitch * ad + R.extra * smooth(0, 1, ad));
      const sLong = (R.dot + (R.bar - R.dot) * grow) / R.bar, sShort = (R.dot + (R.barW - R.dot) * grow) / R.dot;
      const o = a * (R.dotAlpha + (1 - R.dotAlpha) * grow);
      const key = `${off.toFixed(2)}|${sLong.toFixed(3)}`, rj = rd[j];
      if (rj.k !== key) { rj.k = key; dots[j].style.transform = v ? `translate3d(0,${off.toFixed(2)}px,0) scale(${sLong.toFixed(4)},${sShort.toFixed(4)})` : `translate3d(${off.toFixed(2)}px,0,0) scale(${sShort.toFixed(4)},${sLong.toFixed(4)})`; }
      if (Math.abs(o - rj.a) > 0.002 || Number.isNaN(rj.a)) { rj.a = o; dots[j].style.opacity = o.toFixed(3); }
    }
  };
  return { root, switchEl, layout, frame, setMode, el: root, titles: T, infos };
}
