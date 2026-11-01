import { HOME_FLIGHT as F, WORK_V2, BEND } from '../timeline.js';
import { transitionPolicy } from './transition-policy.js';
import { glOpen, glClose } from '../util/gl-ledger.js';
import { imgSet } from '../util/media.js';

// R45: the Home <-> Work flight. ONE picture box moves between the hero's rectangle and the Work page's first card (the R42 back family: a fast drop and a slow
// settle, the edges bow inward), drawn by one fullscreen fragment shader that does three things at once:
//   - the bow: each tap inverts the same mesh bow the R42 bulge renderer applies to its vertices (so the edges match that family),
//   - the smear: every pixel averages `smearTaps` copies of the picture placed along the box's own path (the box a moment ago, mixed with the box now): the trail follows the
//     motion exactly, grows with the speed and is EXACTLY zero at rest (box now == box a moment ago), so the landing frame equals the page's own pixels,
//   - the cross-fade: picture A (the start picture) -> picture B (the end picture) over the middle of the flight, both covered into the box like their own end states.
// This module only draws. The pages (src/main.js on the homepage, src/work/core.js on the Work page) own the DOM around it and the hand-off between the two documents.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const homeFlightOK = () => !reduced && new URLSearchParams(location.search).get('gl') !== '0' && !navigator.connection?.saveData && transitionPolicy().enabled;

// the first Work card at rest: the frame size of the Work page (WORK_V2), centred. (mode-desktop.js frame(): the vertical strip centres it the same way)
export function firstCardRect(W = innerWidth, H = innerHeight) {
  let w = (WORK_V2.frameW * W) / 100, h = (WORK_V2.frameH * H) / 100;
  const r = (WORK_V2.frameW * 1920) / (WORK_V2.frameH * 1080);
  w = Math.min(w, h * r); h = w / r;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
// the file the Work card shows (same ref + same `sizes` as the card, so the same cached file is picked)
export function cardImage(ref) {
  const { src, srcset } = imgSet(ref);
  const im = new Image(); im.decoding = 'async';
  if (srcset) { im.sizes = `${Math.round(WORK_V2.frameW)}vw`; im.srcset = srcset; }
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

const VS = `#version 300 es
void main() { vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)); gl_Position = vec4(c * 2. - 1., 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uView;               // css px
uniform vec4 uBox0, uBox1;        // the box now / a moment ago (x, y, w, h css px, y down)
uniform vec2 uBend, uMix;         // now / a moment ago
uniform vec2 uNatA, uNatB;
uniform sampler2D uA, uB;
uniform float uTaps, uRgb, uFlipA, uFlipB, uPx;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 invQ(vec2 pos, vec4 b, float bend) {
  vec2 h = b.zw * .5, c = b.xy + h, q0 = (pos - c) / h, q = q0;
  float m = min(b.z, b.w);
  for (int i = 0; i < 4; i++) q = q0 - q * (1. - q.yx * q.yx) * bend * m / h;
  return q;
}
vec2 cover(vec2 q, vec4 b, vec2 nat, float flip) {
  float k = max(b.z / nat.x, b.w / nat.y);
  vec2 uv = (q * .5) * b.zw / (nat * k) + .5;
  return vec2(uv.x, flip > .5 ? 1. - uv.y : uv.y);
}
// one copy of the picture at fraction f of the way back along the path: rgb premultiplied by its coverage, a = coverage
vec4 tap(float f, vec2 pos) {
  vec4 b = mix(uBox0, uBox1, f);
  float bend = mix(uBend.x, uBend.y, f), mx = mix(uMix.x, uMix.y, f);
  vec2 q = invQ(pos, b, bend), h = b.zw * .5;
  float edge = min((1. - abs(q.x)) * h.x, (1. - abs(q.y)) * h.y);
  float a = clamp(edge * uPx + .5, 0., 1.);
  if (a <= 0.) return vec4(0.);
  vec3 ca = texture(uA, clamp(cover(q, b, uNatA, uFlipA), 0., 1.)).rgb;
  vec3 cb = texture(uB, clamp(cover(q, b, uNatB, uFlipB), 0., 1.)).rgb;
  return vec4(mix(ca, cb, mx) * a, a);
}
void main() {
  vec2 pos = vec2(gl_FragCoord.x, uView.y * uPx - gl_FragCoord.y) / uPx;
  float n = uTaps, jit = hash(gl_FragCoord.xy), sum = 0.;
  vec4 acc = vec4(0.);
  bool still = distance(uBox0, uBox1) < .01 && abs(uBend.x - uBend.y) < 1e-5 && abs(uMix.x - uMix.y) < 1e-5;
  if (still) { acc = tap(0., pos); }
  else {
    for (float j = 0.; j < 64.; j += 1.) {
      if (j >= n) break;
      float f = (j + jit) / n;
      vec4 g = tap(f, pos);
      if (uRgb > 0.) { acc.r += tap(clamp(f - uRgb, 0., 1.), pos).r; acc.b += tap(clamp(f + uRgb, 0., 1.), pos).b; acc.g += g.g; acc.a += g.a; }
      else acc += g;
    }
    acc /= n;
  }
  o = acc;
}`;

// parent: where the canvas goes. Returns null when WebGL2 is unavailable (the caller then navigates plainly).
export function createHomeFlight(parent) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hf__canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const gl = glOpen(canvas, 'homeflight', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
  if (!gl) return null;
  let dead = false, prog, vs, fs, tex = [], nat = [[1, 1], [1, 1]], flip = [0, 0], keys = [null, null], u = {};
  const dispose = () => {
    if (dead) return; dead = true; canvas.remove();
    try { tex.forEach((t) => gl.deleteTexture(t)); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); } catch { /* lost */ }
    glClose(gl, 'homeflight');
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); api.onLost?.(); });
  try {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
    vs = sh(gl.VERTEX_SHADER, VS); fs = sh(gl.FRAGMENT_SHADER, FS);
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    ['uView', 'uBox0', 'uBox1', 'uBend', 'uMix', 'uNatA', 'uNatB', 'uA', 'uB', 'uTaps', 'uRgb', 'uFlipA', 'uFlipB', 'uPx'].forEach((k) => { u[k] = gl.getUniformLocation(prog, k); });
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      tex.push(t);
    }
    gl.uniform1i(u.uA, 0); gl.uniform1i(u.uB, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  } catch (err) { if (import.meta.env.DEV) console.warn('[home-flight]', err); dispose(); return null; }
  parent.append(canvas);

  // slot 0 = picture A (start), 1 = picture B (end). `source` = an <img> (complete) or a <video> with a frame; `key` skips an upload of the same picture twice
  const api = {
    canvas, get dead() { return dead; },
    setPicture(slot, source, key) {
      if (dead) return false;
      const w = source.naturalWidth || source.videoWidth, h = source.naturalHeight || source.videoHeight;
      if (!w || !h) return false;
      if (key && keys[slot] === key) return true;
      gl.activeTexture(gl.TEXTURE0 + slot); gl.bindTexture(gl.TEXTURE_2D, tex[slot]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.generateMipmap(gl.TEXTURE_2D);
      nat[slot] = [w, h]; keys[slot] = key || null;
      return true;
    },
    // box0 = the box now, box1 = a moment ago; state / prev = flightState() of those moments
    draw(box0, box1, state, prev) {
      if (dead) return;
      const V = { w: innerWidth, h: innerHeight };
      const dpr = Math.min(devicePixelRatio || 1, Math.min(transitionPolicy().maxDpr, V.w > 2560 ? BEND.dprCapLarge : BEND.dprCap));
      const w = Math.round(V.w * dpr), h = Math.round(V.h * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      // only the union of the two boxes (+ the bow's margin) needs shading
      const pad = Math.max(box0.w, box0.h, box1.w, box1.h) * 0.06 + 4, x0 = Math.min(box0.x, box1.x) - pad, y0 = Math.min(box0.y, box1.y) - pad, x1 = Math.max(box0.x + box0.w, box1.x + box1.w) + pad, y1 = Math.max(box0.y + box0.h, box1.y + box1.h) + pad;
      gl.enable(gl.SCISSOR_TEST);
      const sx = Math.max(0, Math.floor(x0 * dpr)), sy = Math.max(0, Math.floor((V.h - y1) * dpr));
      gl.scissor(sx, sy, Math.max(0, Math.min(w, Math.ceil(x1 * dpr)) - sx), Math.max(0, Math.min(h, Math.ceil((V.h - y0) * dpr)) - sy));
      gl.uniform2f(u.uView, V.w, V.h); gl.uniform1f(u.uPx, dpr);
      gl.uniform4f(u.uBox0, box0.x, box0.y, box0.w, box0.h); gl.uniform4f(u.uBox1, box1.x, box1.y, box1.w, box1.h);
      gl.uniform2f(u.uBend, state.bend, prev.bend); gl.uniform2f(u.uMix, state.mix, prev.mix);
      gl.uniform2f(u.uNatA, nat[0][0], nat[0][1]); gl.uniform2f(u.uNatB, nat[1][0], nat[1][1]);
      gl.uniform1f(u.uTaps, Math.max(2, Math.min(60, F.smearTaps))); gl.uniform1f(u.uRgb, F.smearStrength > 0 ? F.smearRGB / F.smearStrength : 0);
      gl.uniform1f(u.uFlipA, 0); gl.uniform1f(u.uFlipB, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose,
  };
  return api;
}

// Plays one flight. hero / card = the two rectangles (css px); dir 'in' (hero -> card) or 'out' (card -> hero). Draws every frame from the clock (time-based, any refresh rate).
// onFrame(state) after each draw (the caller drives the wordmark, the Work layers ...); resolves when the last frame (p = 1) has been drawn.
export function playFlight(renderer, { hero, card, dir, onFrame, sec = F.sec }) {
  const at = (st) => lerpBox(card, hero, st.size); // size 1 = the hero's rectangle, 0 = the card's, in both directions
  const peak = Math.max(F.sizePow, 1), dp = F.smearStrength / peak; // the trail = smearStrength of the way travelled at the peak speed
  return new Promise((resolve) => {
    const t0 = performance.now();
    let raf = 0, done = false;
    const frame = (now) => {
      if (done) return;
      let p = Math.min(1, (now - t0) / (sec * 1000));
      if (import.meta.env.DEV && window.__hfAt !== undefined) p = Math.min(0.999, window.__hfAt); // dev checks: freeze the flight at a progress
      const st = flightState(p, dir), pv = flightState(Math.max(0, p - dp), dir);
      renderer.draw(at(st), at(pv), st, pv);
      onFrame?.(st);
      if (p >= 1) { done = true; resolve(); return; }
      raf = requestAnimationFrame(frame);
    };
    frame(performance.now());
    if (!done) raf = requestAnimationFrame(frame);
    playFlight.cancel = () => { if (!done) { done = true; cancelAnimationFrame(raf); resolve(); } };
  });
}
