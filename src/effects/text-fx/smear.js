// R33d / R27: the title reveal = a corner-pull shader (the mechanism of the thomasmonavon.com label recorded in docs/reference/text-fx-label.mov, written here from its description).
// The text is rendered once into an offscreen canvas texture (from its computed style, at the device pixel ratio) and drawn as a quad in ONE small shared overlay canvas (pointer-events
// none, aria-hidden, created on first use, hidden when idle). ONE scrubbed progress value u (0..1) is folded into a triangle p = (0.5 - |u - 0.5|) * 2 (0 at both ends, 1 in the middle):
// the ENTER runs u 0 -> 0.5, the LEAVE 0.5 -> 1. Output alpha = texture alpha x p. The distortion is strongest where p is small: (a) CORNER PULL: the sample UV is pushed away from an
// attraction point (the bottom-left for the enter half, the top-right for the leave half) by normalize(dir) * dist^(-p), mixed in by (1 - p), and clamped to 0..1 so the edge texels
// streak toward the corner; (b) SIMPLEX NOISE of the UV, snoise(vec3(uv * noiseScale, time * 0.3)) * noiseAmount, scaled by (1 - p): the wobbly sheared breakup. At p = 1 the
// picture is the texture 1:1 (no resampling), so the hand-over to the DOM text has no pop. The DOM text stays in the page (selectable, read by screen readers) and is hidden with
// `visibility` while the overlay plays. Fallbacks: the CSS path (opacity = p) for ?gl=0 / weak devices / a lost context; reduced motion = a plain 0.2 s fade (decided by the caller);
// ?fx=0 = plain fade. Idle cost: no rAF, no GL call. Used for the Work v2 title only.
import { weakDevice } from '../../util/device.js';

const VS = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a * 2.0 - 1.0, 0.0, 1.0); }`;
// 3D simplex noise: Ashima Arts / Stefan Gustavson (MIT)
const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;        // overlay size in css px
uniform float uDpr;
uniform vec2 uAnchor;     // the texture's anchor on screen (css px)
uniform vec2 uTexSize;    // texture size (device px)
uniform vec2 uTexAnchor;  // the anchor inside the texture (device px)
uniform float uProgress;  // 0..1: enter 0 -> 0.5, leave 0.5 -> 1
uniform float uTime;
uniform float uNoiseScale;
uniform float uNoiseAmt;
uniform float uPull;
uniform float uAlpha;
uniform vec2 uAlphaPow;   // x enter, y leave: the alpha is pow(p, this), so the distortion can lead and the letters stay readable longer
out vec4 o;
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;      // css px, y down
  vec2 t = ((p - uAnchor) * uDpr + uTexAnchor) / uTexSize;                      // texture coordinates 0..1, y down
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) discard;
  float k = (0.5 - abs(uProgress - 0.5)) * 2.0;                                // 0 at both ends, 1 in the middle
  vec2 uv = vec2(t.x, 1.0 - t.y);                                              // y up, like the reference's uv
  if (k < 0.9999) {
    vec2 target = uProgress < 0.5 ? vec2(0.0) : vec2(1.0);                     // bottom-left on the enter, top-right on the leave
    vec2 dir = uv - target;
    float dist = max(length(dir), 1e-3);
    uv += (dir / dist) * pow(dist, -k) * (1.0 - k) * uPull;                      // pushed away from the point: the content is pulled toward it
    uv += vec2(snoise(vec3(uv * uNoiseScale, uTime * 0.3 + 3.1)), snoise(vec3(uv * uNoiseScale + 17.0, uTime * 0.3))) * uNoiseAmt * (1.0 - k);
    uv = clamp(uv, 0.0, 1.0);                                                  // the edge texels streak toward the corner
  }
  vec4 c = texture(uTex, vec2(uv.x, 1.0 - uv.y));
  o = c * (uAlpha * pow(k, uProgress < 0.5 ? uAlphaPow.x : uAlphaPow.y));
}`;

const ease = (x, pow) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), pow);

export function createSmear({ host, cfg, reduced }) {
  const params = new URLSearchParams(location.search);
  const fxOff = params.get('fx') === '0';
  const useGl = !reduced && !fxOff && params.get('gl') !== '0' && !weakDevice();
  let canvas = null, gl = null, prog = null, loc = null, vao = null, tex = null, lost = false;
  let run = null; // the play in flight: { mode: 'enter' | 'leave', t0, u0, ... }
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
    loc = Object.fromEntries(['uTex', 'uRes', 'uDpr', 'uAnchor', 'uTexSize', 'uTexAnchor', 'uProgress', 'uTime', 'uNoiseScale', 'uNoiseAmt', 'uPull', 'uAlpha', 'uAlphaPow'].map((k) => [k, gl.getUniformLocation(prog, k)]));
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

  // text -> texture: the advance box plus a small pad; the anchor is the left baseline (snapped to a device pixel by snapAnchor; the fraction of x is drawn into the texture)
  const makeTexture = (o) => {
    const d = dpr(), c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = `${o.weight} ${o.size * d}px ${o.family}`;
    const track = (o.tracking || 0) * o.size * d; if ('letterSpacing' in x) x.letterSpacing = `${track}px`;
    const adv = x.measureText(o.text), asc = adv.fontBoundingBoxAscent ?? o.size * 0.9, desc = adv.fontBoundingBoxDescent ?? o.size * 0.25;
    const padX = Math.ceil(o.size * 0.06 * d), padY = Math.ceil(o.size * 0.08 * d);
    const w = Math.ceil(adv.width + 2 * padX + 1), h = Math.ceil(asc + desc + 2 * padY);
    c.width = w; c.height = h;
    x.font = `${o.weight} ${o.size * d}px ${o.family}`; if ('letterSpacing' in x) x.letterSpacing = `${track}px`; x.fillStyle = o.color; x.textBaseline = 'alphabetic'; x.fontKerning = 'normal';
    x.fillText(o.text, padX + o.fracX, padY + asc); // (the text starts at the browser's fractional device pixel, so the overlay is a 1:1 copy at p = 1: no resampling blur)
    if (tex) gl.deleteTexture(tex);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    return { w, h, ax: padX, ay: padY + asc };
  };
  // the anchor is snapped to a whole device pixel (as the browser does for the baseline); the fraction of x goes into the texture
  const snapAnchor = (o) => { const d = dpr(), xd = o.x * d; o.fracX = xd - Math.floor(xd); o.x = Math.floor(xd) / d; o.baseline = Math.floor(o.baseline * d + 1e-6) / d; return o; };

  // progress u for a time: enter u = ease(t / enterSec) / 2; leave u = u0 + (1 - u0) * (t / leaveSec)^2
  const progress = (r, now) => {
    const t = (now - r.t0) / 1000;
    if (r.mode === 'enter') { const x = t / Math.max(cfg.enterSec, 0.01); return { u: 0.5 * ease(x, cfg.enterPow), done: x >= 1 }; }
    const x = t / Math.max(r.leaveSec, 0.01);
    return { u: r.u0 + (1 - r.u0) * Math.min(1, x * x), done: x >= 1 };
  };
  const fold = (u) => (0.5 - Math.abs(u - 0.5)) * 2;

  const drawGl = (u, time) => {
    const r = run, d = dpr();
    sizeCanvas();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc.uTex, 0); gl.uniform2f(loc.uRes, innerWidth, innerHeight); gl.uniform1f(loc.uDpr, d);
    gl.uniform2f(loc.uAnchor, r.x, r.baseline); gl.uniform2f(loc.uTexSize, r.tx.w, r.tx.h); gl.uniform2f(loc.uTexAnchor, r.tx.ax, r.tx.ay);
    gl.uniform1f(loc.uProgress, u); gl.uniform1f(loc.uTime, time + r.seed);
    gl.uniform1f(loc.uNoiseScale, cfg.noiseScale); gl.uniform1f(loc.uNoiseAmt, cfg.noiseAmount); gl.uniform1f(loc.uPull, cfg.pull); gl.uniform1f(loc.uAlpha, r.alpha); gl.uniform2f(loc.uAlphaPow, cfg.enterAlphaPow, cfg.leaveAlphaPow);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const drawCss = (u) => { run.el.style.opacity = String(Math.pow(fold(u), u < 0.5 ? cfg.enterAlphaPow : cfg.leaveAlphaPow) * run.alpha); };

  const finish = (instant, hidden) => {
    cancelAnimationFrame(raf); raf = 0;
    const r = run; run = null;
    if (canvas) { canvas.style.visibility = 'hidden'; if (gl && !lost) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } }
    if (r) { r.el.style.visibility = ''; r.el.style.transform = ''; r.el.style.opacity = hidden ? '0' : '1'; (hidden ? r.aborted : r.done)?.(); }
  };

  const frame = (now) => {
    if (!run) return;
    const { u, done } = progress(run, now);
    run.u = u;
    if (run.gl) drawGl(u, (now - run.tStart) / 1000); else drawCss(u);
    if (done) { if (run.mode === 'leave') finish(true, true); else finish(); return; }
    raf = requestAnimationFrame(frame);
  };

  return {
    get playing() { return !!run; },
    get leaving() { return !!run && run.mode === 'leave'; },
    get gl() { return !!gl && !lost; },
    get lost() { return lost; },
    // o = { el (the DOM title), text, size, weight, family, color, x (text left, css px), baseline (css px), alpha, done, aborted }
    play(o) {
      if (run) finish();
      const glOk = ensure();
      const now = performance.now();
      run = { ...(glOk ? snapAnchor({ ...o }) : o), gl: glOk, mode: 'enter', t0: now, tStart: now, u: 0, seed: Math.random() * 50, alpha: o.alpha ?? 1 };
      if (glOk) { run.tx = makeTexture(run); canvas.style.visibility = 'visible'; o.el.style.visibility = 'hidden'; }
      else { o.el.style.visibility = ''; run.el = o.el; }
      raf = requestAnimationFrame(frame);
    },
    // R33f: the strip starts to move while the title stands as plain DOM text: the overlay takes over at u = 0.5 (p = 1: pixel-identical to the DOM text, the DOM text is hidden) and the
    // LEAVE plays from there, so the title ALWAYS leaves with the shader, never with a plain fade. o as for play().
    leaveFromRest(o) {
      if (run) finish();
      const glOk = ensure();
      if (!glOk) return false;
      const now = performance.now();
      run = { ...snapAnchor({ ...o }), gl: true, mode: 'leave', t0: now, tStart: now, u: 0.5, u0: 0.5, leaveSec: Math.max(cfg.leaveSec, 0.05), seed: Math.random() * 50, alpha: o.alpha ?? 1 };
      run.tx = makeTexture(run); canvas.style.visibility = 'visible'; o.el.style.visibility = 'hidden';
      const mine = run; setTimeout(() => { if (run === mine && run.mode === 'leave') finish(true, true); }, (run.leaveSec + 0.3) * 1000);
      raf = requestAnimationFrame(frame);
      return true;
    },
    // R33f: the strip stopped before the leave ended: the ENTER continues from where the leave got to (one scrubbed value: the same p, no restart from zero, no flash)
    resume() {
      if (!run || run.mode !== 'leave') return false;
      const p = Math.min(1, Math.max(0, fold(run.u))), x = 1 - Math.pow(1 - p, 1 / Math.max(cfg.enterPow, 0.01));
      run.mode = 'enter'; run.t0 = performance.now() - x * Math.max(cfg.enterSec, 0.01) * 1000; run.u = 0.5 * p;
      return true;
    },
    // new input: the LEAVE plays from the CURRENT folded value (one scrubbed value: a reversal mid-way continues from where it is; no stacking, no flash)
    abort() {
      if (!run) return false;
      if (run.mode === 'leave') return true;
      const now = performance.now(), u = run.u;
      run.mode = 'leave'; run.t0 = now; run.u0 = u < 0.5 ? 1 - u : u; // (the other half of the triangle at the same p)
      run.leaveSec = Math.max(cfg.leaveSec * ((1 - run.u0) / 0.5), 0.05);
      // R33e ghost guard: the leave is advanced by requestAnimationFrame only; if frames stop (a hidden tab, a long stall) the last drawn frame would stay on the canvas. A timer ends it anyway.
      const mine = run; setTimeout(() => { if (run === mine && run.mode === 'leave') finish(true, true); }, (run.leaveSec + 0.3) * 1000);
      return true;
    },
    // dev / tests: draw the effect frozen at progress u (0..1), nothing animates
    scrub(o, u, time = 0.7) {
      if (run) finish();
      const glOk = ensure();
      run = { ...(glOk ? snapAnchor({ ...o }) : o), gl: glOk, mode: 'enter', t0: 0, tStart: 0, u, seed: 7, alpha: o.alpha ?? 1 };
      cancelAnimationFrame(raf); raf = 0;
      if (glOk) { run.tx = makeTexture(run); canvas.style.visibility = 'visible'; o.el.style.visibility = 'hidden'; drawGl(u, time); } else drawCss(u);
    },
    // R33e: called every tick by the page: nothing is playing, so the overlay must be empty and hidden (a frame left behind by any path is removed at once)
    sweep() { if (!run && canvas && canvas.style.visibility === 'visible') { canvas.style.visibility = 'hidden'; if (gl && !lost) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } return true; } return false; },
    release() { finish(); },
    cancel() { finish(true); },
    destroy() { finish(true); canvas?.remove(); },
  };
}
