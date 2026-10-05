// R33c / R27 Part C (only what the Work v2 title needs): the `smear` label reveal. The text is rendered once into an offscreen canvas texture (from its computed style, at the device
// pixel ratio) and drawn as a quad in ONE small shared overlay canvas (pointer-events none, aria-hidden, created on first use, hidden when idle). The shader grows it from a thin
// streak anchored at the LEFT BASELINE (scaleX0 / scaleY0 -> 1, ease out), slants it (skew), cuts it into horizontal slices that are shifted sideways with noise, and fades it in.
// The DOM text stays in the page (selectable, read by screen readers) and is hidden with `visibility` while the overlay plays. Fallbacks: the CSS path (transform scale / skew from
// the same anchor + opacity, no slices) for ?gl=0 / weak devices / a lost context; reduced motion = a plain 0.2 s opacity fade (decided by the caller). ?fx=0 = plain fade.
// Idle cost: no rAF, no GL call. Not applied to anything but the Work v2 title; the rest of R27 (the `lines` tier, the demo page, the registry) is NOT built here.
import { weakDevice } from '../../util/device.js';

const VS = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a * 2.0 - 1.0, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;        // overlay size in css px
uniform float uDpr;
uniform vec2 uAnchor;     // left baseline of the text on screen (css px)
uniform vec2 uTexSize;    // texture size (device px)
uniform vec2 uTexAnchor;  // the left baseline inside the texture (device px)
uniform vec2 uScale;      // current scaleX, scaleY
uniform float uK;         // tan(skew) now
uniform float uSliceAmp;  // slice offset in text-height units (already faded)
uniform float uSliceBand; // slice height as a share of the texture height
uniform float uStep;      // noise step (changes the slice offsets)
uniform float uSeed;
uniform float uAlpha;
uniform float uSmooth;    // 0 = hard stepped slices, 1 = a smooth wave between the slice offsets
out vec4 o;
float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;      // css px, y down
  vec2 d = p - uAnchor;
  float dy = d.y / uScale.y;
  float dx = d.x / uScale.x + uK * dy;
  vec2 t = (vec2(dx, dy) * uDpr + uTexAnchor) / uTexSize;
  float bandF = t.y / uSliceBand, band = floor(bandF), fb = fract(bandF);
  float n0 = h(vec2(band, uStep + uSeed)), n1 = h(vec2(band + 1.0, uStep + uSeed));
  float nz = mix(n0, mix(n0, n1, fb * fb * (3.0 - 2.0 * fb)), uSmooth);
  float off = (nz * 2.0 - 1.0) * uSliceAmp;
  t.x += off;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) discard;
  vec4 c = texture(uTex, t);
  o = c * uAlpha;
}`;

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export function createSmear({ host, cfg, reduced }) {
  const params = new URLSearchParams(location.search);
  const fxOff = params.get('fx') === '0';
  const useGl = !reduced && !fxOff && params.get('gl') !== '0' && !weakDevice();
  let canvas = null, gl = null, prog = null, loc = null, vao = null, tex = null, lost = false;
  let run = null; // { t0, el, tx, ... } the play in flight
  let raf = 0;

  const ensure = () => {
    if (gl || lost || !useGl) return !!gl;
    canvas = document.createElement('canvas');
    canvas.className = 'w2__smear';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;visibility:hidden';
    try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false }); } catch { gl = null; }
    if (!gl) { canvas = null; lost = true; return false; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(prog, 0, 'a'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; canvas = null; lost = true; return false; }
    loc = Object.fromEntries(['uTex', 'uRes', 'uDpr', 'uAnchor', 'uTexSize', 'uTexAnchor', 'uScale', 'uK', 'uSliceAmp', 'uSliceBand', 'uStep', 'uSeed', 'uAlpha', 'uSmooth'].map((k) => [k, gl.getUniformLocation(prog, k)]));
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; finish(true); });
    host.append(canvas);
    return true;
  };
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const sizeCanvas = () => {
    const w = innerWidth, h = innerHeight, d = dpr();
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) { canvas.width = Math.round(w * d); canvas.height = Math.round(h * d); }
  };

  // text -> texture. The texture is the text's advance box padded by `padX` (the slices move sideways) and a little in y; the anchor is the left baseline.
  const makeTexture = (o) => {
    const d = dpr(), c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = `${o.weight} ${o.size * d}px ${o.family}`;
    const adv = x.measureText(o.text), asc = adv.fontBoundingBoxAscent ?? o.size * 0.9, desc = adv.fontBoundingBoxDescent ?? o.size * 0.25;
    const padX = Math.ceil(o.padX * d), padY = Math.ceil(o.size * 0.08 * d);
    const w = Math.ceil(adv.width + 2 * padX), h = Math.ceil(asc + desc + 2 * padY);
    c.width = w; c.height = h;
    x.font = `${o.weight} ${o.size * d}px ${o.family}`; x.fillStyle = o.color; x.textBaseline = 'alphabetic'; x.fontKerning = 'normal';
    x.fillText(o.text, padX + o.fracX, padY + asc); // (the text starts at the browser's fractional device pixel, so the overlay is a 1:1 copy: no resampling blur)
    if (tex) gl.deleteTexture(tex);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    return { w, h, ax: padX, ay: padY + asc, advCss: adv.width / d, hCss: (asc + desc) / d };
  };

  // the anchor is snapped to a whole device pixel (as the browser does for the baseline); the fraction of x goes into the texture
  const snapAnchor = (o) => { const d = dpr(), xd = o.x * d; o.fracX = xd - Math.floor(xd); o.x = Math.floor(xd) / d; o.baseline = Math.floor(o.baseline * d + 1e-6) / d; return o; };
  // the state of the effect at time t (s since the start), fitted to docs/reference/text-fx-label.mov (60 fps; the effect begins 0.23 s into the clip): the ink coverage reads 35 % at
  // +0.12 s, 63 % at +0.22 s, 85 % at +0.32 s, 97 % at +0.37 s (an ease out of power growPow over growSec); the slant and the slices hold their full size for a moment and are gone at
  // about +0.85 s (the label height is back to its final value at +0.87 s).
  const state = (t) => {
    const x = Math.min(1, Math.max(0, t / Math.max(cfg.growSec, 0.01))), e = 1 - Math.pow(1 - x, cfg.growPow);
    const sx = cfg.startScaleX + (1 - cfg.startScaleX) * e, sy = cfg.startScaleY + (1 - cfg.startScaleY) * e;
    const skewF = 1 - smooth((t - cfg.skewHold) / Math.max(cfg.skewSec, 0.01)), sliceF = 1 - smooth((t - cfg.sliceHold) / Math.max(cfg.sliceSec, 0.01));
    return { sx, sy, k: Math.tan((cfg.skewDeg * Math.PI) / 180) * skewF, slice: sliceF, alpha: cfg.startOpacity + (1 - cfg.startOpacity) * e, done: t >= cfg.smearSec };
  };

  const drawGl = (st, t) => {
    const r = run, d = dpr();
    sizeCanvas();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc.uTex, 0); gl.uniform2f(loc.uRes, innerWidth, innerHeight); gl.uniform1f(loc.uDpr, d);
    gl.uniform2f(loc.uAnchor, r.x, r.baseline); gl.uniform2f(loc.uTexSize, r.tx.w, r.tx.h); gl.uniform2f(loc.uTexAnchor, r.tx.ax, r.tx.ay);
    gl.uniform2f(loc.uScale, st.sx, st.sy); gl.uniform1f(loc.uK, st.k);
    gl.uniform1f(loc.uSliceAmp, (r.sliceAmpPx * st.slice * d) / r.tx.w); gl.uniform1f(loc.uSliceBand, Math.max(cfg.sliceBand, 0.005));
    gl.uniform1f(loc.uStep, Math.floor(t * 24 * cfg.sliceNoise)); gl.uniform1f(loc.uSeed, r.seed); gl.uniform1f(loc.uAlpha, st.alpha * r.alpha); gl.uniform1f(loc.uSmooth, cfg.sliceSmooth);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const drawCss = (st) => { // the fallback: transform from the left baseline + opacity (no slices)
    const el = run.el;
    el.style.transformOrigin = `${run.x - run.boxLeft}px ${run.baseline - run.boxTop}px`;
    el.style.transform = `skewX(${(-Math.atan(st.k) * 180) / Math.PI}deg) scale(${st.sx}, ${st.sy})`;
    el.style.opacity = String(st.alpha * run.alpha);
  };

  const finish = (instant, hidden) => {
    cancelAnimationFrame(raf); raf = 0;
    const r = run; run = null;
    if (canvas) { canvas.style.visibility = 'hidden'; if (gl && !lost) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } }
    if (r) { r.el.style.visibility = ''; r.el.style.transform = ''; r.el.style.transformOrigin = ''; r.el.style.opacity = hidden ? '0' : '1'; (hidden ? r.aborted : r.done)?.(); }
  };

  const frame = (now) => {
    if (!run) return;
    let t = (now - run.t0) / 1000, fade = 1;
    if (run.abort) { // aborted (new input): the effect is frozen where it was and fades out
      t = run.abort.at; const q = (now - run.abort.t) / 1000 / Math.max(run.abort.sec, 0.01);
      if (q >= 1) { finish(true, true); return; }
      fade = 1 - q;
    }
    const st = state(t); st.alpha *= fade;
    if (run.gl) drawGl(st, t); else drawCss(st);
    if (st.done && !run.abort) { finish(); return; }
    raf = requestAnimationFrame(frame);
  };

  return {
    get playing() { return !!run; },
    get gl() { return !!gl && !lost; },
    get lost() { return lost; },
    // o = { el (the DOM title), text, size, weight, family, color, x (text left, css px), baseline (css px), boxLeft, boxTop, padX, maxSlicePx, alpha, done }
    play(o) {
      if (run) finish();
      const glOk = ensure();
      run = { ...(glOk ? snapAnchor({ ...o }) : o), gl: glOk, t0: performance.now(), seed: Math.random() * 100, alpha: o.alpha ?? 1 };
      if (glOk) {
        run.tx = makeTexture(run);
        run.sliceAmpPx = Math.min(cfg.sliceAmp * o.size, o.maxSlicePx ?? 1e9);
        canvas.style.visibility = 'visible';
        o.el.style.visibility = 'hidden';
      } else {
        o.el.style.visibility = '';
        run.el = o.el;
      }
      raf = requestAnimationFrame(frame);
    },
    // dev / tests: draw the effect frozen at time t (s), nothing animates
    scrub(o, t) {
      if (run) finish();
      const glOk = ensure();
      run = { ...(glOk ? snapAnchor({ ...o }) : o), gl: glOk, t0: 0, seed: 7, alpha: o.alpha ?? 1 };
      cancelAnimationFrame(raf); raf = 0;
      const st = state(t);
      if (glOk) { run.tx = makeTexture(run); run.sliceAmpPx = Math.min(cfg.sliceAmp * o.size, o.maxSlicePx ?? 1e9); canvas.style.visibility = 'visible'; o.el.style.visibility = 'hidden'; drawGl(st, t); } else drawCss(st);
    },
    abort(sec) { if (!run || run.abort) return !!run; const now = performance.now(); run.abort = { t: now, sec, at: (now - run.t0) / 1000 }; return true; }, // new input: freeze and fade out over sec (no stacking)
    release() { finish(); },
    cancel() { finish(true); },
    destroy() { finish(true); canvas?.remove(); },
  };
}
