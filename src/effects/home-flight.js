import { HOME_FLIGHT as F, WORK_V2, BEND, TRANSITION, WORK_PTR, WORK, TALL, TABLET } from '../timeline.js';
import { isLite, isTall } from '../util/layout-mode.js';
import { createPointerFx } from '../work/pointer-fx.js';
import { EASES } from '../util/ease.js';
import { transitionPolicy } from './transition-policy.js';
import { glOpen, glClose } from '../util/gl-ledger.js';
import { imgSet } from '../util/media.js';

// R45: the Home <-> Work flight. ONE picture box moves between the hero's rectangle and the Work page's first card (the R42 back family: a fast drop and a slow
// settle, the edges bow inward), drawn by one fullscreen fragment shader that does three things at once:
//   - the bow: each tap inverts the same mesh bow the R42 bulge renderer applies to its vertices (so the edges match that family),
//   - the smear (R45c): every pixel takes `smearTaps` samples of the picture placed along the box's own path (the box a moment ago mixed with the box now). Each BLOCK of
//     `smearCell` px picks its own moments of the trail (the pointer-fx look: blocky streaks, not an even blur), rows tear sideways in proportion to the speed, and the colour
//     channels are split along the trail. Everything is EXACTLY zero at rest (box now == box a moment ago), so the landing frame equals the page's own pixels,
//   - the cross-fade: picture A (the start picture) -> picture B (the end picture) over the middle of the flight, both covered into the box like their own end states.
// R45c: the Work page's neighbour cards are their own plain layers (no swipe, no fade): they ease in from their pushed-away positions with the R42 / R30 clearing push (below), so the last frame IS the Work page at rest.
// This module only draws. The pages (src/main.js on the homepage, src/work/core.js on the Work page) own the DOM around it and the hand-off between the two documents.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isPixel = () => F.look === 'pixel' || F.look === 1;
export const homeFlightOK = () => !reduced && new URLSearchParams(location.search).get('gl') !== '0' && !navigator.connection?.saveData && transitionPolicy().enabled;

// the first Work card at rest: the frame size of the Work page (WORK_V2), centred. (mode-desktop.js frame(): the vertical strip centres it the same way)
// R45b: the phone / tablet Work page (src/work/tall.js liteFrame / liteMetrics): tall = a VERTICAL strip (image TALL.frame of the width, the gap TALL.gapV of the image height), tablet landscape = a side strip.
// The same numbers, inlined so the homepage chunk does not pull the Work engine in.
const liteKind = () => (isTall() ? 'tall' : 'tablet');
const liteRatio = () => (WORK.frameW * 1920) / (WORK.frameH * 1080);
function liteGeom(W, H) {
  const r = liteRatio();
  if (liteKind() === 'tablet') { const w = Math.min(r * TABLET.frameH * H, 0.9 * W); return { w, h: w / r, vertical: false, gap: (WORK.gapSide / WORK.frameW) * w }; }
  const w = TALL.frame * W, h = w / r;
  return { w, h, vertical: true, gap: TALL.gapV * h };
}
export const liteImageVw = () => Math.round((liteKind() === 'tall' ? TALL.frame : 0.75) * 100);
// the first Work card at rest: the frame size of the Work page, centred. (mode-desktop.js frame(): the vertical strip centres it the same way)
export function firstCardRect(W = innerWidth, H = innerHeight) {
  if (isLite()) { const g = liteGeom(W, H); return { x: (W - g.w) / 2, y: (H - g.h) / 2, w: g.w, h: g.h }; }
  let w = (WORK_V2.frameW * W) / 100, h = (WORK_V2.frameH * H) / 100;
  const r = (WORK_V2.frameW * 1920) / (WORK_V2.frameH * 1080);
  w = Math.min(w, h * r); h = w / r;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
// the Work page's start layout (strip offset 0): the first card and the neighbours that show, in the mode the Work page opens in.
export function workStartLayout(W = innerWidth, H = innerHeight) {
  let vertical = false, gap;
  if (isLite()) { const g = liteGeom(W, H); vertical = g.vertical; gap = g.gap; }
  else { try { vertical = localStorage.getItem('work-mode') === 'vertical'; } catch { /* */ } gap = vertical ? (WORK_V2.gapVert * H) / 100 : (WORK_V2.gapSide * W) / 100; }
  const c = firstCardRect(W, H);
  const at = (k) => (vertical ? { x: c.x, y: c.y + k * (c.h + gap), w: c.w, h: c.h } : { x: c.x + k * (c.w + gap), y: c.y, w: c.w, h: c.h });
  const out = [];
  for (const k of [-1, 1]) {
    const r = at(k);
    if (r.x >= W || r.y >= H || r.x + r.w <= 0 || r.y + r.h <= 0) continue;
    out.push({ k, rect: r });
  }
  return { vertical, first: c, neighbours: out };
}
// the file the Work card shows (same ref + same `sizes` as the card, so the same cached file is picked)
export function cardImage(ref) {
  const { src, srcset } = imgSet(ref);
  const im = new Image(); im.decoding = 'async';
  if (srcset) { im.sizes = `${isLite() ? liteImageVw() : Math.round(WORK_V2.frameW)}vw`; im.srcset = srcset; }
  im.src = src;
  return im;
}

// dir 'in' = hero -> card (size 1 -> 0), 'out' = card -> hero (size 0 -> 1). p = 0..1 of the flight.
export function flightState(p, dir) {
  p = Math.max(0, Math.min(1, p));
  const size = dir === 'in' ? (1 - p) ** F.sizePow : 1 - (1 - p) ** F.sizePow;
  const u = Math.min(1, p / Math.max(F.bendEndAt, 0.05)), pulse = 6.75 * u * (1 - u) * (1 - u);
  const q = Math.min(1, Math.max(0, (p - F.crossFrom) / Math.max(F.crossTo - F.crossFrom, 0.01)));
  return { p, size, bend: F.bendAmp * pulse, mix: q * q * (3 - 2 * q) };
}
const lerpBox = (a, b, e) => ({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e });
// R45c follow-up: the neighbours move like the R42 project <-> Work push, with its numbers (TRANSITION.workPushSec / clearMargin / clearStagger, cubic ease on the linear push time, the direction away from
// the centred card, far enough to be off screen). up = the linear push time 0..1: 'in' (hero -> Work) = the R42 back: pushed away at the start, back at rest over the LAST workPushSec of the flight;
// 'out' (Work -> hero) = the R42 open: pushed away over the FIRST workPushSec.
export const pushUp = (p, dir, sec) => Math.min(1, Math.max(0, (dir === 'in' ? 1 - p : p) * sec) / Math.max(TRANSITION.workPushSec, 0.01));
export const pushAmount = (up, rank) => { const s = Math.min(0.9, Math.max(0, TRANSITION.clearStagger)); return EASES.cubic(Math.min(1, Math.max(0, (up - s * rank) / (1 - s)))); };
// per neighbour: unit direction away from the centred card and the distance to be fully off screen (the rule of work/core.js prepareClear)
export function pushPlan(rect, centre, W = innerWidth, H = innerHeight) {
  const m = TRANSITION.clearMargin * (W / 1920), hw = rect.w * 0.58, hh = rect.h * 0.58, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const rx = cx - (centre.x + centre.w / 2), ry = cy - (centre.y + centre.h / 2), len = Math.hypot(rx, ry), ux = len > 1 ? rx / len : 0, uy = len > 1 ? ry / len : -1;
  let t = Infinity;
  if (ux > 1e-6) t = Math.min(t, (W + m + hw - cx) / ux); else if (ux < -1e-6) t = Math.min(t, (-m - hw - cx) / ux);
  if (uy > 1e-6) t = Math.min(t, (H + m + hh - cy) / uy); else if (uy < -1e-6) t = Math.min(t, (-m - hh - cy) / uy);
  return { dx: ux, dy: uy, T: Number.isFinite(t) ? Math.max(0, t) + 2 : 0 };
}

const VS = `#version 300 es
void main() { vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)); gl_Position = vec4(c * 2. - 1., 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uView;               // css px
uniform vec4 uBox0, uBox1;        // the box now / a moment ago (x, y, w, h css px, y down)
uniform vec2 uBend, uMix;         // now / a moment ago
uniform vec2 uNatA, uNatB;
uniform sampler2D uA, uB;
uniform float uTaps, uRgb, uPx, uTear, uCell;
uniform float uLook, uFrontPx, uGain; // R45c3 pixel swipe: look 1 = pixel; the brush front along uDir (screen px); gain = the displacement share (0 at rest)
uniform sampler2D uGrid;           // the Work page pointer-fx grid (screen space, NEAREST, one x / y displacement per cell)
uniform vec2 uGridN, uFxP;         // grid columns / rows; strength (picture units per grid unit), rgb split
uniform vec2 uDir;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 invQ(vec2 pos, vec4 b, float bend) {
  vec2 h = b.zw * .5, c = b.xy + h, q0 = (pos - c) / h, q = q0;
  float m = min(b.z, b.w);
  for (int i = 0; i < 4; i++) q = q0 - q * (1. - q.yx * q.yx) * bend * m / h;
  return q;
}
vec2 cover(vec2 q, vec4 b, vec2 nat) {
  float k = max(b.z / nat.x, b.w / nat.y);
  return (q * .5) * b.zw / (nat * k) + .5;
}
// one copy of the picture at fraction f of the way back along the path: rgb premultiplied by its coverage, a = coverage
vec4 tap(float f, vec2 pos) {
  vec4 b = mix(uBox0, uBox1, f);
  float bend = mix(uBend.x, uBend.y, f), mx = mix(uMix.x, uMix.y, f);
  vec2 q = invQ(pos, b, bend), h = b.zw * .5;
  float edge = min((1. - abs(q.x)) * h.x, (1. - abs(q.y)) * h.y);
  float a = clamp(edge * uPx + .5, 0., 1.);
  if (a <= 0.) return vec4(0.);
  vec3 ca = texture(uA, clamp(cover(q, b, uNatA), 0., 1.)).rgb;
  vec3 cb = texture(uB, clamp(cover(q, b, uNatB), 0., 1.)).rgb;
  return vec4(mix(ca, cb, mx) * a, a);
}
void main() {
  vec2 pos = vec2(gl_FragCoord.x, uView.y * uPx - gl_FragCoord.y) / uPx;
  if (uLook > .5) {
    // R45c3: the Work page hover smear (src/work/pointer-fx.js grid + the cards-gl lookup shift + RGB split), driven by a synthetic brush that sweeps along uDir. A screen cell flips
    // video -> card once the brush front has passed its centre, so the flip is hidden behind the displacement. Gain 0 / an all-zero grid = exactly the plain picture.
    vec2 gc = floor(pos / uView * uGridN), centre = (gc + .5) / uGridN * uView;
    float flip = dot(centre, uDir) < uFrontPx ? 1. : 0.;
    vec4 b = uBox0; vec2 qa = invQ(pos, b, uBend.x), h = b.zw * .5;
    float edge = min((1. - abs(qa.x)) * h.x, (1. - abs(qa.y)) * h.y);
    float a = clamp(edge * uPx + .5, 0., 1.);
    if (a <= 0.) { o = vec4(0.); return; }
    vec2 d = texture(uGrid, pos / uView).rg * uGain * uFxP.x * 2., sh = d * uFxP.y;  // picture units -> q units (x2)
    vec2 q = qa - d;
    vec3 c3;
    if (flip > .5) c3 = vec3(texture(uB, clamp(cover(clamp(q + sh, -1., 1.), b, uNatB), 0., 1.)).r, texture(uB, clamp(cover(clamp(q, -1., 1.), b, uNatB), 0., 1.)).g, texture(uB, clamp(cover(clamp(q - sh, -1., 1.), b, uNatB), 0., 1.)).b);
    else c3 = vec3(texture(uA, clamp(cover(clamp(q + sh, -1., 1.), b, uNatA), 0., 1.)).r, texture(uA, clamp(cover(clamp(q, -1., 1.), b, uNatA), 0., 1.)).g, texture(uA, clamp(cover(clamp(q - sh, -1., 1.), b, uNatA), 0., 1.)).b);
    o = vec4(c3 * a, a);
    return;
  }
  float n = uTaps;
  vec4 acc = vec4(0.);
  bool still = distance(uBox0, uBox1) < .01 && abs(uBend.x - uBend.y) < 1e-5 && abs(uMix.x - uMix.y) < 1e-5;
  if (still) { acc = tap(0., pos); }
  else {
    // blocky look: a cell of uCell px shares its random moments of the trail; each row tears sideways by its own amount
    vec2 cell = floor(pos / uCell);
    pos.x += (hash(vec2(floor(pos.y / (uCell * .5)), 1.7)) - .5) * uTear;
    float d = uRgb;
    for (float j = 0.; j < 64.; j += 1.) {
      if (j >= n) break;
      float f = (j + hash(cell + vec2(j, 3.7))) / n;
      vec4 g = tap(f, pos);
      if (d > 0.) { acc.r += tap(clamp(f - d, 0., 1.), pos).r; acc.b += tap(clamp(f + d, 0., 1.), pos).b; acc.g += g.g; acc.a += g.a; }
      else acc += g;
    }
    acc /= n;
  }
  o = acc;
}`;

// parent: where the canvas goes. Returns null when WebGL2 is unavailable (the caller then navigates plainly).
// Picture slots 0..3 (0 = the start picture, 1 = the end picture, 2 / 3 = the Work page's neighbours); a layer draws two of them.
export function createHomeFlight(parent) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hf__canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const gl = glOpen(canvas, 'homeflight', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
  if (!gl) return null;
  const SLOTS = 4;
  let dead = false, prog, vs, fs, gridTex = null, gridW = 1, gridH = 1, gridP = [0, 0], tex = [], nat = Array.from({ length: SLOTS }, () => [1, 1]), keys = Array(SLOTS).fill(null), u = {}, dpr = 1;
  const dispose = () => {
    if (dead) return; dead = true; canvas.remove();
    try { tex.forEach((t) => gl.deleteTexture(t)); gl.deleteTexture(gridTex); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); } catch { /* lost */ }
    glClose(gl, 'homeflight');
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); api.onLost?.(); });
  try {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
    vs = sh(gl.VERTEX_SHADER, VS); fs = sh(gl.FRAGMENT_SHADER, FS);
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    ['uLook', 'uFrontPx', 'uGain', 'uGrid', 'uGridN', 'uFxP', 'uDir', 'uView', 'uBox0', 'uBox1', 'uBend', 'uMix', 'uNatA', 'uNatB', 'uA', 'uB', 'uTaps', 'uRgb', 'uPx', 'uTear', 'uCell'].forEach((k) => { u[k] = gl.getUniformLocation(prog, k); });
    for (let i = 0; i < SLOTS; i++) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      tex.push(t);
    }
    { // the pointer-fx grid (unit 4, RGBA32F, NEAREST: the same texture type cards-gl.js uses)
      gridTex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + SLOTS); gl.bindTexture(gl.TEXTURE_2D, gridTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(4)); gl.uniform1i(u.uGrid, SLOTS);
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  } catch (err) { if (import.meta.env.DEV) console.warn('[home-flight]', err); dispose(); return null; }
  parent.append(canvas);

  const api = {
    canvas, get dead() { return dead; },
    // `source` = an <img> (complete) or a <video> with a frame; `key` skips an upload of the same picture twice
    setPicture(slot, source, key) {
      if (dead) return false;
      const w = source.naturalWidth || source.videoWidth || source.width, h = source.naturalHeight || source.videoHeight || source.height; // (R49: a 2D canvas works too: the loader snapshot)
      if (!w || !h) return false;
      if (key && keys[slot] === key) return true;
      gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, tex[slot]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.generateMipmap(gl.TEXTURE_2D);
      nat[slot] = [w, h]; keys[slot] = key || null;
      return true;
    },
    has(slot) { return !!keys[slot]; },
    // the pointer-fx grid (data = cols x rows x 4 floats)
    setGrid(data, cols, rows, params) {
      if (dead) return;
      gl.activeTexture(gl.TEXTURE0 + SLOTS); gl.bindTexture(gl.TEXTURE_2D, gridTex);
      if (cols !== gridW || rows !== gridH) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cols, rows, 0, gl.RGBA, gl.FLOAT, data); gridW = cols; gridH = rows; }
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.FLOAT, data);
      gridP = params;
    },
    // clears the canvas for one frame
    begin() {
      if (dead) return;
      const V = { w: innerWidth, h: innerHeight };
      dpr = Math.min(devicePixelRatio || 1, Math.min(transitionPolicy().maxDpr, V.w > 2560 ? BEND.dprCapLarge : BEND.dprCap));
      const w = Math.round(V.w * dpr), h = Math.round(V.h * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    },
    // one box: box0 = now, box1 = a moment ago; state / prev = flightState() of those moments; slots = [start picture, end picture]
    layer(box0, box1, state, prev, slots = [0, 1], opts = {}) {
      if (dead) return;
      const pixel = isPixel();
      const V = { w: innerWidth, h: innerHeight }, w = canvas.width, h = canvas.height;
      const pad = Math.max(box0.w, box0.h, box1.w, box1.h) * 0.06 + 4 + F.smearTear * 100, x0 = Math.min(box0.x, box1.x) - pad, y0 = Math.min(box0.y, box1.y) - pad, x1 = Math.max(box0.x + box0.w, box1.x + box1.w) + pad, y1 = Math.max(box0.y + box0.h, box1.y + box1.h) + pad;
      gl.enable(gl.SCISSOR_TEST);
      const sx = Math.max(0, Math.floor(x0 * dpr)), sy = Math.max(0, Math.floor((V.h - y1) * dpr));
      gl.scissor(sx, sy, Math.max(0, Math.min(w, Math.ceil(x1 * dpr)) - sx), Math.max(0, Math.min(h, Math.ceil((V.h - y0) * dpr)) - sy));
      const mv = Math.max(Math.abs(box0.x - box1.x), Math.abs(box0.y - box1.y), Math.abs(box0.w - box1.w) / 2, Math.abs(box0.h - box1.h) / 2);
      gl.uniform1i(u.uA, slots[0]); gl.uniform1i(u.uB, slots[1]);
      gl.uniform2f(u.uView, V.w, V.h); gl.uniform1f(u.uPx, dpr);
      gl.uniform4f(u.uBox0, box0.x, box0.y, box0.w, box0.h); gl.uniform4f(u.uBox1, box1.x, box1.y, box1.w, box1.h);
      gl.uniform2f(u.uBend, state.bend, prev.bend); gl.uniform2f(u.uMix, state.mix, prev.mix);
      gl.uniform2f(u.uNatA, nat[slots[0]][0], nat[slots[0]][1]); gl.uniform2f(u.uNatB, nat[slots[1]][0], nat[slots[1]][1]);
      gl.uniform1f(u.uTaps, Math.max(2, Math.min(60, F.smearTaps))); gl.uniform1f(u.uRgb, F.smearStrength > 0 ? F.smearRGB / F.smearStrength : 0);
      gl.uniform1f(u.uLook, pixel && !opts.plain ? 1 : 0); gl.uniform1f(u.uFrontPx, opts.frontPx ?? 0); gl.uniform1f(u.uGain, opts.gain ?? 0);
      gl.uniform2f(u.uGridN, gridW, gridH); gl.uniform2f(u.uFxP, gridP[0], gridP[1]);
      { const a = ((F.pixelAngle + (opts.vertical ? 90 : 0) + (opts.flip ? 180 : 0)) * Math.PI) / 180; gl.uniform2f(u.uDir, Math.cos(a), Math.sin(a)); }
      gl.uniform1f(u.uTear, F.smearTear * mv); gl.uniform1f(u.uCell, Math.max(2, F.smearCell));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    // the simple case (one box, slots 0 / 1)
    draw(box0, box1, state, prev) { api.begin(); api.layer(box0, box1, state, prev); },
    dispose,
  };
  return api;
}

// Plays one flight. hero / card = the two rectangles (css px); dir 'in' (hero -> card) or 'out' (card -> hero). Draws every frame from the clock (time-based, any refresh rate).
// neighbours (dir 'in' only) = [{ slot, rect }]: the Work page's neighbour cards, pushed back to their rest rectangles over the last workPushSec of the flight (plain layers: no swipe, no fade).
// onFrame(state, up) after each draw (up = the push time 0..1, see pushUp; the Work page drives its live strip with it on the way out) (the caller drives the wordmark, the Work layers ...); resolves when the last frame (p = 1) has been drawn.
export function playFlight(renderer, { hero, card, dir, onFrame, neighbours = [], vertical = false, sec = F.sec }) {
  const at = (st) => lerpBox(card, hero, st.size); // size 1 = the hero's rectangle, 0 = the card's, in both directions
  const peak = Math.max(F.sizePow, 1), dp = F.smearStrength / peak; // the trail = smearStrength of the way travelled at the peak speed
  const px = isPixel();
  // R45c3: the swipe is the Work page hover smear (src/work/pointer-fx.js, its screen grid + WORK_PTR numbers) driven by a SYNTHETIC BRUSH: it sweeps along the strip axis across the travelling
  // picture inside crossFrom..crossTo (the front moves monotonically over the larger of the two boxes the swipe can see), stepped at a fixed 1/60 s so 60 and 144 Hz give the same grid.
  const W = innerWidth, H = innerHeight, dirAng = ((F.pixelAngle + (vertical ? 90 : 0) + (dir === 'out' ? 180 : 0)) * Math.PI) / 180, ux = Math.cos(dirAng), uy = Math.sin(dirAng);
  let grid = null, simT = 0, zero = null;
  const fx = px ? createPointerFx({ setPixelFx: (amt, params, data, cols, rows) => { grid = amt ? { data, cols, rows, params } : null; } }, 1) : null;
  const cross = (p) => { const q = Math.min(1, Math.max(0, (p - F.crossFrom) / Math.max(F.crossTo - F.crossFrom, 0.01))); return q * q * (3 - 2 * q); };
  const big = at(flightState(dir === 'in' ? F.crossFrom : F.crossTo, dir));
  const corners = [[big.x, big.y], [big.x + big.w, big.y], [big.x, big.y + big.h], [big.x + big.w, big.y + big.h]].map((c) => c[0] * ux + c[1] * uy);
  const cellPx = W / Math.max(8, Math.round(WORK_PTR.pixelGrid)), lo = Math.min(...corners) - cellPx, hi = Math.max(...corners) + cellPx;
  const frontAt = (p) => lo + (hi - lo) * cross(p);
  const stepBrush = (p, dtStep) => {
    const b = at(flightState(p, dir)), f = cross(p), front = frontAt(p), cx = b.x + b.w / 2, cy = b.y + b.h / 2, perp = -uy * cx + ux * cy;
    const bx = ux * front - uy * perp, by = uy * front + ux * perp, live = f > 0 && f < 1; // the brush: on the front line, centred across the picture
    fx.update({ dt: dtStep, idx: 0, px: live ? bx : NaN, py: live ? by : NaN, W, H, frameH: firstCardRect(W, H).h, allowed: true, warp: 0, scale: W / 1920, gapAlong: 1e9, vertical });
  };
  const plans = neighbours.map((n) => pushPlan(n.rect, card));
  const nbAt = (n, i, up) => { const o = plans[i].T * pushAmount(up, F.nbRank); return { x: n.rect.x + plans[i].dx * o, y: n.rect.y + plans[i].dy * o, w: n.rect.w, h: n.rect.h }; };
  return new Promise((resolve) => {
    const t0 = performance.now();
    let raf = 0, done = false;
    const frame = (now) => {
      if (done) return;
      let p = Math.min(1, (now - t0) / (sec * 1000));
      if (import.meta.env.DEV && window.__hfAt !== undefined) p = Math.min(0.999, window.__hfAt); // dev checks: freeze the flight at a progress
      const pp = Math.max(0, p - dp), st = flightState(p, dir), pv = flightState(pp, dir);
      renderer.begin();
      // the swipe is the travelling picture's alone; the neighbours are plain layers on the push
      let gain = 0;
      if (px) { // fixed-step brush simulation up to the clock (time-based); the displacement fades out over the last stretch so the landing frame is the plain picture
        const target = p * sec, SD = 1 / 60; while (simT + SD <= target + 1e-6) { simT += SD; stepBrush(Math.min(1, simT / sec), SD); }
        gain = 1 - Math.min(1, Math.max(0, (p - F.crossTo) / Math.max(1 - F.crossTo, 0.01)));
        const cols = Math.max(8, Math.round(WORK_PTR.pixelGrid)), rows = Math.max(4, Math.round((cols * H) / W));
        if (!zero || zero.length !== cols * rows * 4) zero = new Float32Array(cols * rows * 4); // an all-zero grid keeps the screen cells (the flip) when the brush is idle
        renderer.setGrid(grid ? grid.data : zero, cols, rows, grid ? grid.params : [WORK_PTR.pixelStrength, WORK_PTR.pixelRgb]);
      }
      const fo = { frontPx: frontAt(p), gain, vertical, flip: dir === 'out' }, up = pushUp(p, dir, sec);
      neighbours.forEach((n, i) => { const r = nbAt(n, i, up); renderer.layer(r, r, { bend: 0, mix: 1 }, { bend: 0, mix: 1 }, [n.slot, n.slot], { plain: true }); });
      renderer.layer(at(st), at(pv), st, pv, [0, 1], fo);
      onFrame?.(st, up);
      if (p >= 1) { done = true; resolve(); return; }
      raf = requestAnimationFrame(frame);
    };
    frame(performance.now());
    if (!done) raf = requestAnimationFrame(frame);
    playFlight.cancel = () => { if (!done) { done = true; cancelAnimationFrame(raf); resolve(); } };
  });
}
