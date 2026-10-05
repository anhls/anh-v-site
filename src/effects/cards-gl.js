import { BEND as BEND_DEF, WARP as WARP_DEF, WARP_DIR, CARD_HOVER } from '../timeline.js';
import { weakDevice } from '../util/device.js';
import { POST_VERT, POST_FRAG } from './warp-shader.js';
import { cylinderMargins } from './warp-model.js';
import { limitLean } from './lean-limit.js';
import { FRAME_POST_FRAG } from '../work/frame-warp-shader.js';

// Selected Work cards on ONE WebGL2 canvas (R16). Plain WebGL, no library (0 KB added): 35 textured planes, one draw call each.
// Positions come from selected-work.js (the same numbers it used to write into style.transform): this module reads no DOM per
// frame. The DOM <img> / <video> cards stay in the page (layout, accessibility, and the source of the textures) but are hidden
// (opacity 0) while this runs.
//   Bend: the top and bottom edges bow into an arc (deepest in the middle, zero at the corners, sides straight) that follows the
//   scroll speed, against the scroll direction, through ONE shared spring with a single gentle overshoot; weighted per card by depth.
//   Grain: film grain on the cards, rising a little with scroll speed.
// Fallback: returns null (the DOM cards stay as they are) when WebGL2 is missing, on prefers-reduced-motion, on a weak device
// (R13g rule), or on ?gl=0; ?gl=1 forces it on. If the context is lost the DOM cards come back (onLost).

const COLS = 32;
const VERT = `#version 300 es
in vec2 a;                       // a.x across the card (0..1), a.y down the card (0..1)
uniform vec2 uView;              // viewport in css px
uniform vec2 uCenter;            // card centre in css px
uniform vec2 uSize;              // card size in css px
uniform float uBend;             // signed px; + = the middle sags downward
uniform float uShape;            // arc shape: 1 = round arc (sin, keeps curving into the corners), higher = flatter corners
uniform vec4 uCover;             // object-fit: cover as (scaleU, scaleV, offU, offV)
out vec2 vUv;
out vec2 vA;                      // R33: the position on the card itself (0..1), for the pointer field
void main() {
  float arc = pow(sin(3.14159265 * a.x), uShape);
  vec2 p = uCenter + (a - 0.5) * uSize + vec2(0.0, uBend * arc);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vUv = a * uCover.xy + uCover.zw;
  vA = a;
}`;
const FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec2 vA;
uniform sampler2D uTex;
uniform sampler2D uField;        // R33: the pointer field of the centre image (RG = a vector, 0.5 = none), only read when uFx > 0
uniform float uFx;
uniform vec4 uFxP;               // x displacement, y smear length, z rgb shift (all in picture units), w unused
uniform vec2 uFxS;               // the picture's cover scale (so the effect is in the image's own space)
uniform float uGrain;
uniform float uSeed;
uniform float uFlat;             // >= 0: draw the flat dark layer at this opacity instead of the texture
out vec4 o;
float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  if (uFlat >= 0.0) { o = vec4(vec3(10.0 / 255.0) * uFlat, uFlat); return; }
  vec4 c;
  if (uFx > 0.0) { // R33: the pointer smear + distortion trail (one vector field in the image's own space; the lookup is displaced, smeared along the vector, and split by colour)
    vec2 v = (texture(uField, vA).rg - 0.5) * 2.0 * uFx;
    vec2 uv = vUv - v * uFxP.x * uFxS, sm = v * uFxP.y * uFxS, sh = v * uFxP.z * uFxS;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 6; i++) { vec2 o = sm * (float(i) / 5.0 - 0.5); acc += vec3(texture(uTex, uv + o + sh).r, texture(uTex, uv + o).g, texture(uTex, uv + o - sh).b); }
    c = vec4(acc / 6.0, texture(uTex, uv).a);
  } else c = texture(uTex, vUv);
  float n = h(gl_FragCoord.xy + uSeed) - 0.5;
  c.rgb = clamp(c.rgb + n * uGrain * c.a, 0.0, 1.0);
  o = c;
}`;

// R16b: one full-screen distortion over every card (shader in warp-shader.js, shared with the frame canvas).
// The cards are drawn (flat) into an offscreen multisampled buffer with an overscan margin, resolved to a texture, and that texture
// goes to the screen through the warp shader. At rest the pass is skipped altogether (cards go straight to the canvas).
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const param = new URLSearchParams(location.search).get('gl');
const warpForced = new URLSearchParams(location.search).get('warp') === '1'; // R24f: ?warp=1 forces the GL path on even under reduced motion / on a 'weak' device (and the Work page bypasses the guard)

// els: the card elements (img / video); cards: data (z, w, h, mouse); arrays (shared with selected-work.js, filled by it): bx, by
// (centre x / page y), bw, bh (px); the loop calls setOffset(i, x, y) for every card and then draw(...).
// R23b: `bend` / `warp` (optional) replace the homepage BEND / WARP objects, so the Work page runs its own strength and timing through the
// same renderer (read live: edit the objects and the next frame follows). BEND.riseSpeed / settleSpeed (optional) split the spring's natural
// frequency: used while the warp is growing / while it eases back (default: returnSpeed for both). setAxis(1) turns the warp 90 degrees
// (a horizontally scrolling strip: the cylinder bends around a vertical axis near the left / right edges). `near(i)` (optional) says
// whether a card is close enough to be worth a texture (default: within 1.5 screen heights vertically, which suits the page scroll).
// R22h: `layers` (optional, the Work page): { isFrame: Uint8Array (1 = a main image), warp, bend } gives the main images their OWN warp pass (the shader in
// work/frame-warp-shader.js, the `warp` settings and `bend` speeds given here) while the cards keep the card pass. The scene is then drawn in three
// layers in paint order: the cards behind the images, the images, the cards in front; each warped layer is composited over the one before it
// (exact depth order because every image sits at the same depth; a card is behind or in front of ALL images). Without `layers` (the homepage)
// everything is one pass, exactly as before.
export function createCardsGL({ section, els, cards, bx, by, bw, bh, onLost, bend: bendOpt, warp: warpOpt, near: nearFn, layers, lite = false }) {
  const BEND = bendOpt || BEND_DEF;
  const WARP = warpOpt || WARP_DEF;
  let axis = 0;
  const liteBuf = lite && !(import.meta.env.DEV && new URLSearchParams(location.search).has('oldbuf')); // (dev: ?oldbuf = the R24g buffer, for the A / B pixel test)
  let holdAmt = null; // dev only (api.holdWarp)
  let warpScale = 1; // R24d: the warp pass's offscreen buffer resolution (the frame-time guard steps it down while the warp is on; the flat draw is never affected)
  if (param === '0' || (param !== '1' && !warpForced && (reduced || (lite ? navigator.connection?.saveData === true : weakDevice(BEND.weakCores, BEND.weakMemoryGb))))) return null; // R24g: the lite Work page does not use the core / memory test (the frame-time guard decides)
  const canvas = document.createElement('canvas');
  canvas.className = 'sw__gl';
  canvas.setAttribute('aria-hidden', 'true');
  let gl = null;
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) return null;

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const U = Object.fromEntries(['uView', 'uCenter', 'uSize', 'uBend', 'uShape', 'uCover', 'uTex', 'uGrain', 'uSeed', 'uFlat', 'uField', 'uFx', 'uFxP', 'uFxS'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uField, 1);
  gl.uniform1f(U.uFx, 0);
  // R33: the pointer field texture (unit 1), made on first use (setField)
  let fieldTex = null, fieldW = 0, fieldH = 0, fxIdx = -1, fxAmt = 0, fxP = [0, 0, 0, 0];
  const post = gl.createProgram();
  gl.attachShader(post, compile(gl.VERTEX_SHADER, POST_VERT));
  gl.attachShader(post, compile(gl.FRAGMENT_SHADER, POST_FRAG));
  gl.linkProgram(post);
  const postOk = gl.getProgramParameter(post, gl.LINK_STATUS);
  const P = Object.fromEntries(['uScene', 'uRes', 'uAmt', 'uShape', 'uMargin', 'uSym', 'uPinchDown', 'uBow', 'uFrame', 'uGrain', 'uSeed', 'uAxis'].map((k) => [k, gl.getUniformLocation(post, k)]));
  let postF = null, PF = null; // the main images' warp program (Work page)
  if (layers) {
    postF = gl.createProgram();
    gl.attachShader(postF, compile(gl.VERTEX_SHADER, POST_VERT));
    gl.attachShader(postF, compile(gl.FRAGMENT_SHADER, FRAME_POST_FRAG));
    gl.linkProgram(postF);
    if (!gl.getProgramParameter(postF, gl.LINK_STATUS)) return null;
    PF = Object.fromEntries(['uScene', 'uRes', 'uAmt', 'uShape', 'uMargin', 'uSym', 'uBow', 'uGrain', 'uSeed', 'uAxis', 'uShift'].map((k) => [k, gl.getUniformLocation(postF, k)]));
  }
  const emptyVao = gl.createVertexArray();
  // Offscreen buffers (made on first use, rebuilt on resize): a multisampled renderbuffer the cards are drawn into (same edge
  // quality as the canvas), resolved into a texture that the post shader samples.
  let fb = null;
  let fbInfo = { fbPath: 'not built yet', samples: 0, bufferPx: '' };
  let passCount = 0, lastPass = 0;
  // The warp samples the picture beyond the screen edge (content that is just off screen is pulled in), so the offscreen buffer
  // holds the screen plus an overscan margin on every side, sized from the warp settings (px, rounded up to 8).
  const margins = () => {
    // the cylinder model says how far outside the screen the sheet is seen at the screen edge (computed for the largest warp the spring can reach)
    // R24h (lite): the shader clamps the amount at +-1, so the buffer only needs the overscan of an amount of 1 (the strength x 1.2 head-room of the desktop warp made it 3x taller than the canvas)
    const capS = liteBuf ? 1 : Infinity;
    const sMax = Math.min(Math.max(WARP.strengthUp, WARP.strengthDown) * 1.2, capS);
    let [fx, fy] = cylinderMargins(sMax, WARP.curl, WARP.camDown, WARP.reach, WARP.sym, WARP.bowDown);
    let [ux, uy] = cylinderMargins(sMax, WARP.curl, WARP.camUp, WARP.reach, WARP.sym, WARP.bowUp);
    if (layers) { // the images' warp may reach farther: the buffer is sized for the larger of the two
      const IW = layers.warp, sI = 1, cI = IW.curl * (IW.shapeK ?? 1); // R24j: the image amount is 0..1 (own speed curve); the strength scales the curl (shapeK)
      const [a, b] = cylinderMargins(sI, cI, IW.camDown, IW.reach, IW.sym, IW.bowDown), [c, d] = cylinderMargins(sI, cI, IW.camUp, IW.reach, IW.sym, IW.bowUp);
      fx = Math.max(fx, a, c); fy = Math.max(fy, b, d); ux = Math.max(ux, a, c); uy = Math.max(uy, b, d);
      // R24i: the axis may lean along the strip: the sheet is seen farther out on that axis (and a little wider across). The buffer grows by leanBuf (0.3 desktop, 0.15 phone / tablet: a lighter buffer) screen lengths along / 0.05 across; the lean itself is
      // capped each frame by what that buffer holds (lean-limit.js), so a bigger lean setting never shows a blank edge or a fold.
      const lm = IW.lean > 0 ? Math.min(Math.max(0, IW.leanMax ?? 0), IW.leanBuf ?? 0.3) : 0;
      fy += lm; uy += lm; // (fy / uy are the margins ALONG the strip for both axes: the cross margin of the vertical strip uses fx / ux)
      if (lm > 0) { fx += 0.05; ux += 0.05; }
    }
    const my = axis ? Math.min(Math.ceil((Math.max(fx, ux) * H + 4) / 8) * 8, Math.round(H * 0.5)) : Math.min(Math.ceil((Math.max(fy, uy) * H + 4) / 8) * 8, Math.round(H * 0.7));
    const mx = axis ? Math.min(Math.ceil((Math.max(fy, uy) * W + 4) / 8) * 8, Math.round(W * 0.7)) : Math.min(Math.ceil((Math.max(fx, ux) * W + 4) / 8) * 8, Math.round(W * 0.5));
    return [mx, my];
  };
  const makeFb = () => {
    const [mx, my] = margins();
    if (fb) { gl.deleteFramebuffer(fb.ms); gl.deleteFramebuffer(fb.res); gl.deleteRenderbuffer(fb.rb); gl.deleteTexture(fb.tex); }
    const dprNow = (canvas.width / W) * warpScale;
    const w = Math.round((W + 2 * mx) * dprNow);
    const h = Math.round((H + 2 * my) * dprNow);
    // multisampling costs memory (samples x 4 bytes per pixel): 4 samples up to ~6 M pixels, 2 up to ~14 M, none beyond
    const px = w * h;
    let samples = Math.min(px > 14e6 ? 0 : liteBuf || px > 6e6 ? 2 : 4, gl.getParameter(gl.MAX_SAMPLES)); // (R24h: 2 samples on the lite pages)
    // R24f: the buffer is plain RGBA8 (no float / half-float target, which iOS lacks without an extension). If the multisampled renderbuffer cannot be made or the framebuffer is not
    // complete, fall back to fewer samples, then to none (the warp keeps running, a little less smooth at the edges); the path that ran is in api.diag() and the console (dev / ?perf)
    let rb = null, ms = null;
    for (;;) {
      if (rb) gl.deleteRenderbuffer(rb);
      if (ms) gl.deleteFramebuffer(ms);
      rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.getError();
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
      ms = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      if (gl.getError() === gl.NO_ERROR && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) break;
      if (samples === 0) break; // nothing left to try: the draw below reports the error
      samples = samples > 2 ? 2 : 0;
    }
    fbInfo = { fbPath: `RGBA8, ${samples} samples`, samples, bufferPx: `${w}x${h}` };
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('perf')) console.info(`[cards-gl] warp buffer ${fbInfo.bufferPx}: ${fbInfo.fbPath}`);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const res = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, res);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    fb = { ms, res, rb, tex, w, h, mx, my, key: `${canvas.width}x${canvas.height}:${mx}:${my}:${warpScale}` };
  };

  // One strip mesh shared by every card: COLS + 1 columns x 2 rows (the bend only depends on x, so two rows are enough).
  const verts = new Float32Array((COLS + 1) * 4);
  for (let c = 0; c <= COLS; c++) verts.set([c / COLS, 0, c / COLS, 1], c * 4);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
  gl.clearColor(0, 0, 0, 0);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  const n = els.length;
  const ox = new Float64Array(n); // offsets from the base position (px), written by the loop
  const oy = new Float64Array(n);
  const hs = new Float32Array(n).fill(1); // hover scale per card (R17)
  const hd = new Float32Array(n); // dark layer opacity per card (0 = none)
  const hp = new Float32Array(n); // hover progress 0..1 (drives the dark layer's own scale)
  const darkCard = cards.map((c) => !!c.dark);
  const isVideo = els.map((el) => el.tagName === 'VIDEO');
  const tex = new Array(n).fill(null); // image (or poster) texture
  const vtex = new Array(n).fill(null); // video texture (alpha WebM / MP4), once the video has a frame
  const texBytes = new Float64Array(n);
  const aspect = new Float64Array(n); // source aspect (w / h), 0 until known
  const loading = new Uint8Array(n);
  const vFrame = new Uint8Array(n); // a new video frame is waiting for upload
  const cover = new Float32Array(n * 4);
  const bendW = new Float64Array(n);
  let order = []; // paint order: z, then DOM order (as the CSS did)
  const posterImgs = new Array(n).fill(null);
  let used = 0;
  let dirty = true;
  let W = 1;
  let H = 1;
  let lost = false;

  order = cards.map((c, i) => i).sort((a, b) => cards[a].z - cards[b].z || a - b);
  // Depth weight of the bend: smooth bell over the card's depth (0 back .. 1 front), strongest in the middle.
  const computeWeights = () => cards.forEach((c, i) => {
    const d = Math.min(Math.max(((c.mouse ?? 100) - 20) / 80, 0), 1);
    const band = Math.max(BEND.depthBand, 0.02);
    bendW[i] = BEND.depthExtreme + (1 - BEND.depthExtreme) * Math.exp(-(((d - 0.5) / band) ** 2));
  });
  computeWeights();
  // R22h: the three layers in paint order (ids), only with `layers`: cards behind the images, the images, cards in front (a card is in front when
  // its z is not below the images' z, as the sort above does: the images come first in the item list)
  let layerIds = null;
  if (layers) {
    const fz = Math.min(...cards.map((c, i) => (layers.isFrame[i] ? c.z : 1e9)));
    layerIds = [order.filter((i) => !layers.isFrame[i] && cards[i].z < fz), order.filter((i) => layers.isFrame[i]), order.filter((i) => !layers.isFrame[i] && cards[i].z >= fz)];
  }

  const makeTexture = (mips) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (mips && aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  };
  const setCover = (i, iw, ih) => {
    aspect[i] = iw / ih;
    const ca = bw[i] / bh[i];
    const ia = iw / ih;
    const sx = ia > ca ? ca / ia : 1;
    const sy = ia > ca ? 1 : ia / ca;
    cover.set([sx, sy, (1 - sx) / 2, (1 - sy) / 2], i * 4);
  };
  // Uploads: at most one per frame; the image goes through an ImageBitmap (decoded off the main thread), premultiplied.
  const pending = [];
  let inflight = 0; // ImageBitmaps being decoded: at most 2 at a time, so a burst of near cards does not stall one frame
  // Dev only (?warptest): every card shows a plain grid with a border instead of its image, so the shape of the warp can be judged
  // from real scrolling. Not in the production build (import.meta.env.DEV is a build-time constant).
  const warpTest = import.meta.env.DEV && new URLSearchParams(location.search).has('warptest');
  const warpCover = warpTest && new URLSearchParams(location.search).get('warptest') === 'cover'; // ?warptest=cover: the grid goes through the real object-fit: cover (cells stay square)
  let testCanvas = null;
  const wantTexture = (i) => {
    if (warpTest) {
      if (tex[i]) return;
      if (!testCanvas) {
        testCanvas = document.createElement('canvas'); testCanvas.width = testCanvas.height = 256;
        const x = testCanvas.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 256, 256);
        x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 253); x.lineWidth = 1;
        for (let k = 64; k < 256; k += 64) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); }
      }
      tex[i] = makeTexture(true); gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, testCanvas); gl.generateMipmap(gl.TEXTURE_2D);
      if (warpCover) setCover(i, 256, 256); else { cover.set([1, 1, 0, 0], i * 4); aspect[i] = 1; }
      dirty = true;
      return;
    }
    if (tex[i] || loading[i] || inflight + pending.length >= 2) return;
    const el = els[i];
    let src = el;
    if (isVideo[i]) {
      if (!posterImgs[i]) { posterImgs[i] = new Image(); posterImgs[i].decoding = 'async'; posterImgs[i].src = el.poster; }
      src = posterImgs[i];
    }
    if (!src.complete || !src.naturalWidth) return;
    loading[i] = 1;
    inflight++;
    const make = window.createImageBitmap ? createImageBitmap(src, { premultiplyAlpha: 'premultiply', imageOrientation: 'from-image' }) : Promise.resolve(src);
    make.then((bmp) => { inflight--; pending.push([i, bmp]); }).catch(() => { inflight--; loading[i] = 0; });
  };
  const flushOne = () => {
    if (!pending.length) return;
    const [i, bmp] = pending.shift();
    loading[i] = 0;
    if (lost) return;
    // an ImageBitmap is already premultiplied, so tell GL not to premultiply again
    gl.bindTexture(gl.TEXTURE_2D, tex[i] || (tex[i] = makeTexture(true)));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const w = bmp.width;
    const h = bmp.height;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
    gl.generateMipmap(gl.TEXTURE_2D);
    used += w * h * 4 * 1.34 - texBytes[i];
    texBytes[i] = w * h * 4 * 1.34;
    setCover(i, w, h);
    api.onUpload?.(w * h * 4 * 1.34);
    bmp.close?.();
    dirty = true;
  };
  const release = (i) => {
    if (tex[i]) { gl.deleteTexture(tex[i]); tex[i] = null; used -= texBytes[i]; texBytes[i] = 0; }
    if (vtex[i]) { gl.deleteTexture(vtex[i]); vtex[i] = null; }
  };
  // Video textures: the element's current frame, uploaded only when the browser says a new one is ready (and the card is visible).
  els.forEach((el, i) => {
    if (!isVideo[i]) return;
    if (el.requestVideoFrameCallback) {
      const cb = () => { vFrame[i] = 1; el.requestVideoFrameCallback(cb); };
      el.requestVideoFrameCallback(cb);
    }
  });
  const uploadVideo = (i) => {
    const el = els[i];
    if (el.paused || el.readyState < 2 || !el.videoWidth) return false;
    if (el.requestVideoFrameCallback ? !vFrame[i] : false) return false;
    vFrame[i] = 0;
    if (!vtex[i]) { vtex[i] = makeTexture(false); setCover(i, el.videoWidth, el.videoHeight); }
    gl.bindTexture(gl.TEXTURE_2D, vtex[i]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
    return true;
  };

  // --- bend state: ONE spring for every card (x = signed 0..1 strength), per-card depth weight applied when drawing ---------
  const bend = { x: 0, v: 0, speed: 0 };
  const bendI = { x: 0, v: 0, amt: 0 }; // the main images' own spring (Work page)
  let lastT = 0;
  let shift = 0; // R24i: the image pass's axis shift now (screen lengths; read by diag / the checks)
  let grainStep = -1;
  let grainSpeed = 0;

  const resize = (w, h) => {
    W = w;
    H = h;
    const cap = w > 2560 ? BEND.dprCapLarge : BEND.dprCap;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    // R24i: on phones / tablets 100vh (the CSS height) is the LARGEST viewport while innerHeight is the visible one (browser bars showing), so a bitmap of innerHeight stretched to 100vh
    // squashed / stretched every picture. The lite canvas is sized in CSS px to exactly the bitmap's units (the wide pages keep the 100vw x 100vh of base.css).
    if (lite) { canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    cards.forEach((_, i) => { if (aspect[i]) setCover(i, aspect[i] * 1000, 1000); }); // card sizes may have changed
    computeWeights();
    dirty = true;
    // build the offscreen buffers and compile the warp shader a moment after load / resize, not on the first fast scroll
    if (postOk) setTimeout(() => { if (lost) return; ensureFb(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb.ms); gl.clear(gl.COLOR_BUFFER_BIT); postPass(0.01, 0, 0); if (layers) postPass(0.01, 0, 0, true, true); gl.clear(gl.COLOR_BUFFER_BIT); dirty = true; }, 400);
  };

  // Warm-up: one tiny draw now (during the loader), so the driver compiles the shaders before the first card is needed.
  {
    const t = makeTexture(false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    canvas.width = canvas.height = 2;
    gl.viewport(0, 0, 2, 2);
    gl.uniform2f(U.uView, 2, 2); gl.uniform2f(U.uCenter, 1, 1); gl.uniform2f(U.uSize, 1, 1); gl.uniform1f(U.uBend, 0);
    gl.uniform4f(U.uCover, 1, 1, 0, 0); gl.uniform1f(U.uGrain, 0.01); gl.uniform1f(U.uSeed, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, (COLS + 1) * 2);
    gl.finish();
    gl.deleteTexture(t);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; api.active = false; onLost?.(); });
  section.prepend(canvas);

  const ensureFb = () => {
    const [mx, my] = margins();
    if (!fb || fb.key !== `${canvas.width}x${canvas.height}:${mx}:${my}:${warpScale}`) makeFb();
  };

  // Resolves the multisampled buffer into the texture and draws it to the screen through the warp shader.
  // img = the main images' program and settings (layers); over = composite over what the canvas already holds (a later layer)
  const postPass = (amt, grainAmt, seed, img = false, over = false) => {
    passCount++; lastPass = performance.now();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb.ms);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb.res);
    gl.blitFramebuffer(0, 0, fb.w, fb.h, 0, 0, fb.w, fb.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (!over) gl.disable(gl.BLEND);
    const WP = img ? layers.warp : WARP, Pu = img ? PF : P;
    gl.useProgram(img ? postF : post);
    gl.bindVertexArray(emptyVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fb.tex);
    gl.uniform1i(Pu.uScene, 0);
    gl.uniform2f(Pu.uRes, canvas.width, canvas.height);
    gl.uniform1f(Pu.uAmt, Math.max(-1, Math.min(1, amt)));
    gl.uniform4f(Pu.uShape, img ? WP.curl * (WP.shapeK ?? 1) : WP.curl, ...(WARP_DIR > 0 ? [WP.camDown, WP.camUp] : [WP.camUp, WP.camDown]), WP.reach); // the shader's first camera / bow slot belongs to its positive (recede) side // R16e: cylinder parameters
    gl.uniform2f(Pu.uBow, ...(WARP_DIR > 0 ? [WP.bowDown, WP.bowUp] : [WP.bowUp, WP.bowDown]));
    gl.uniform2f(Pu.uMargin, fb.mx / W, fb.my / H);
    gl.uniform1f(Pu.uSym, WP.sym);
    if (!img) {
      gl.uniform1f(P.uPinchDown, WARP_DIR > 0 ? WARP.pinchDown : WARP.pinch);
      gl.uniform4f(P.uFrame, 0, 0, 0, 0);
    }
    gl.uniform1f(Pu.uGrain, grainAmt);
    gl.uniform1f(Pu.uSeed, seed);
    gl.uniform1f(Pu.uAxis, axis);
    if (img) { // R24i: the cylinder axis leans toward where the images travel on screen: forward scroll = items move toward the negative screen side; amt = WARP_DIR x (signed spring) x strength, so the shift follows the same spring (0 at rest, no pop)
      const dirSign = (bendI.amt || 0) * WARP_DIR > 0 ? (WP.leanSignDown ?? WP.leanSign ?? 1) : (WP.leanSignUp ?? WP.leanSign ?? 1), sh = (WP.lean || 0) * (dirSign || 1) * -WARP_DIR * // R33: the lean's sign per direction (down = the wheel-down direction = amount * WARP_DIR > 0)
         Math.max(-1, Math.min(1, bendI.amt || 0)), lm = WP.leanMax ?? 0.45;
      const am = Math.max(-1, Math.min(1, bendI.amt || 0)), mAl = axis ? fb.mx / W : fb.my / H, mCr = axis ? fb.my / H : fb.mx / W;
      shift = limitLean(am, Math.max(-lm, Math.min(lm, sh)), { curl: WP.curl * (WP.shapeK ?? 1), camA: WARP_DIR > 0 ? WP.camDown : WP.camUp, camB: WARP_DIR > 0 ? WP.camUp : WP.camDown, reach: WP.reach, bowA: WARP_DIR > 0 ? WP.bowDown : WP.bowUp, bowB: WARP_DIR > 0 ? WP.bowUp : WP.bowDown, sym: WP.sym }, mAl, mCr); // never past what the buffer holds (no blank edge, no fold)
      gl.uniform1f(Pu.uShift, shift);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
  };

  // Draws every card (flat geometry, plus the optional per-card bend) into the bound framebuffer.
  const paintCards = (grainAmt, seed, scale, sy, mx, my, ids = order, clear = true) => {
    if (clear) gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uView, W + 2 * mx, H + 2 * my);
    gl.uniform1f(U.uShape, BEND.arcShape);
    gl.uniform1f(U.uGrain, grainAmt);
    gl.uniform1f(U.uSeed, seed);
    const arcMax = BEND.maxArc * BEND.cardBend * scale;
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k];
      const t = isVideo[i] && vtex[i] ? vtex[i] : tex[i];
      const cx = bx[i] + ox[i];
      const cy = by[i] - sy + oy[i];
      if (cy + bh[i] / 2 + arcMax < -my || cy - bh[i] / 2 - arcMax > H + my || cx + bw[i] / 2 < -mx || cx - bw[i] / 2 > W + mx) continue;
      const bendPx = Math.max(-bh[i] * 0.3, Math.min(bh[i] * 0.3, bend.x * arcMax * bendW[i]));
      gl.uniform2f(U.uCenter, cx + mx, cy + my);
      gl.uniform1f(U.uBend, bendPx);
      // the card itself (skipped while its dark layer fully covers it)
      if (t && !(darkCard[i] && hd[i] >= 0.999)) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.uniform1f(U.uFlat, -1);
        if (fxIdx >= 0) { const on = i === fxIdx && fxAmt > 0; gl.uniform1f(U.uFx, on ? fxAmt : 0); if (on) { gl.uniform4f(U.uFxP, fxP[0], fxP[1], fxP[2], 0); gl.uniform2f(U.uFxS, cover[i * 4], cover[i * 4 + 1]); } }
        gl.uniform2f(U.uSize, bw[i] * hs[i], bh[i] * hs[i]);
        gl.uniform4fv(U.uCover, cover.subarray(i * 4, i * 4 + 4));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (COLS + 1) * 2);
      }
      // R17: the opaque dark layer (4 px bigger on every side, scales 1 -> 1.15 on the hover progress) fading out on hover
      if (darkCard[i] && hd[i] > 0.002) {
        const k = 1 + (CARD_HOVER.darkScale - 1) * hp[i];
        const pad = CARD_HOVER.darkPad * scale * 2;
        gl.uniform1f(U.uFlat, hd[i]);
        gl.uniform2f(U.uSize, (bw[i] + pad) * k, (bh[i] + pad) * k);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (COLS + 1) * 2);
      }
    }
  };

  // Called once per frame by the loop, after setOffset for every card. sy = scroll position, dt in s, vel = signed scroll speed (px/s),
  // scale = layout scale (capW / 1920), near(i) is true when a card is close enough to be worth uploading.
  const draw = (sy, dt, vel, scale, velImg = vel) => {
    if (lost) return false;
    // Bend spring. target = tanh(speed / ref) signed; overshoot -> damping ratio (the usual 2nd-order step response).
    const os = Math.min(Math.max(BEND.overshoot, 0.001), 0.95);
    const zeta = -Math.log(os) / Math.sqrt(Math.PI * Math.PI + Math.log(os) ** 2);
    const targetCards = Math.tanh((vel * BEND.sensitivity) / BEND.speedRef);
    const steps = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / steps;
    const spring = (st, B, target = targetCards) => {
      const wn = (Math.abs(target) > Math.abs(st.x) ? B.riseSpeed : B.settleSpeed) ?? B.returnSpeed;
      for (let s = 0; s < steps; s++) {
        st.v += (wn * wn * (target - st.x) - 2 * zeta * wn * st.v) * h;
        st.x += st.v * h;
      }
      if (Math.abs(st.x) < 0.0005 && Math.abs(st.v) < 0.002 && target === 0) { st.x = 0; st.v = 0; }
    };
    spring(bend, BEND);
    if (layers) spring(bendI, layers.bend, layers.target ? layers.target(velImg) : targetCards); // R24j: the Work images have their own speed curve (work/speed-curve.js)
    grainSpeed += (Math.min(Math.abs(vel) / BEND.speedRef, 1) - grainSpeed) * (1 - Math.exp(-dt / 0.15));
    const bendNow = bend.x !== 0 || bendI.x !== 0;

    // textures: ask for the ones near the screen (1.5 screens), upload one per frame, release the far ones when over budget
    const reach = H * 1.5;
    for (let i = 0; i < n; i++) {
      const cy = by[i] - sy + oy[i];
      const near = nearFn ? nearFn(i) : cy + bh[i] / 2 > -reach && cy - bh[i] / 2 < H + reach;
      if (near) wantTexture(i);
      else if (used > BEND.textureBudgetMb * 1048576 && (nearFn || cy + bh[i] / 2 < -reach * 2 || cy - bh[i] / 2 > H + reach * 2)) release(i);
    }
    flushOne();

    const step = Math.floor(performance.now() / 1000 * BEND.grainRate);
    const grainOn = BEND.grain > 0;
    if (grainOn && step !== grainStep) { grainStep = step; dirty = true; }
    if (bendNow) dirty = true;
    for (let i = 0; i < n; i++) if (isVideo[i]) {
      const cy = by[i] - sy + oy[i];
      if (cy + bh[i] / 2 > -H * 0.25 && cy - bh[i] / 2 < H * 1.25 && uploadVideo(i)) dirty = true;
    }
    if (!dirty) return bendNow;
    dirty = false;

    const grainAmt = BEND.grain * (1 + BEND.grainSpeed * grainSpeed);
    const seed = (grainStep % 997) * 17.31;
    const amt = WARP_DIR * bend.x * (bend.x > 0 ? WARP.strengthDown : WARP.strengthUp); // shader sign: + = recede look, - = toward the viewer; WARP_DIR maps scroll direction onto it
    bend.amt = amt; // the signed value handed to the warp shader (+ = scrolling down); read by tools/scratch checks
    if (layers) {
      const amtI = import.meta.env.DEV && holdAmt !== null ? holdAmt : WARP_DIR * bendI.x * (Math.max(layers.warp.strengthUp, layers.warp.strengthDown) > 0 ? 1 : 0); // (dev: api.holdWarp pins the image warp amount for the pixel comparison tests)
      bendI.amt = amtI;
      if (Math.abs(amtI) <= 0.0015) shift = 0; // (no image pass this frame: the axis is centred)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (let L = 0; L < 3; L++) {
        const ids = layerIds[L];
        if (!ids.length) continue;
        const a = L === 1 ? amtI : amt;
        if (postOk && Math.abs(a) > 0.0015) {
          ensureFb();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb.ms);
          gl.viewport(0, 0, fb.w, fb.h);
          paintCards(0, seed, scale, sy, fb.mx, fb.my, ids, true);
          postPass(a, grainAmt, seed, L === 1, true);
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, canvas.width, canvas.height);
          paintCards(grainAmt, seed, scale, sy, 0, 0, ids, false);
        }
      }
      return bendNow;
    }
    const usePost = postOk && Math.abs(amt) > 0.0015;
    if (usePost) {
      ensureFb();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb.ms);
      gl.viewport(0, 0, fb.w, fb.h);
    }
    paintCards(usePost ? 0 : grainAmt, seed, scale, sy, usePost ? fb.mx : 0, usePost ? fb.my : 0);
    if (usePost) {
      postPass(amt, grainAmt, seed);
    }
    return bendNow;
  };

  const api = {
    canvas,
    active: true,
    ox, oy, hs, hd, hp, darkCard,
    resize,
    draw,
    show: (on) => { canvas.style.visibility = on ? 'visible' : 'hidden'; if (on) dirty = true; },
    markDirty: () => { dirty = true; },
    holdWarp: (a) => { holdAmt = a; dirty = true; }, // dev only
    diag: () => ({ postOk, shift, ...fbInfo, warpScale, passCount, lastPass }), // R24f: what the ?perf diagnosis line shows
    setWarpScale: (k) => { warpScale = Math.max(0.25, Math.min(1, k)); dirty = true; },
    // R33: the pointer field (RGBA8 bytes, w x h) of picture `idx`; amount 0 = off (the shader branch is not taken: the picture is exactly as before)
    setField: (idx, amount, params, bytes, w, h) => {
      fxIdx = amount > 0 || bytes ? idx : -1; fxAmt = amount; fxP = params || fxP;
      if (bytes) {
        gl.useProgram(prog);
        gl.activeTexture(gl.TEXTURE1);
        if (!fieldTex || w !== fieldW || h !== fieldH) {
          if (fieldTex) gl.deleteTexture(fieldTex);
          fieldTex = gl.createTexture(); fieldW = w; fieldH = h;
          gl.bindTexture(gl.TEXTURE_2D, fieldTex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        } else { gl.bindTexture(gl.TEXTURE_2D, fieldTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes); }
        gl.activeTexture(gl.TEXTURE0);
      }
      dirty = true;
    },
    setAxis: (a) => { axis = a ? 1 : 0; dirty = true; },
    reweigh: () => { computeWeights(); dirty = true; }, // after a depth-bell change in the tuning panel
    bend: () => bend,
    bendImg: () => bendI,
    has: (i) => !!tex[i],
    coverRatio: (i) => (aspect[i] ? (bw[i] / bh[i]) * (cover[i * 4 + 1] / cover[i * 4]) / aspect[i] : 0), // R24i check: drawn picture's x scale / y scale (1 = no stretch)
    stats: () => ({ textureMb: used / 1048576, loaded: tex.filter(Boolean).length, bend: bend.x, bendRaw: bend.x }),
    destroy: () => { canvas.remove(); api.active = false; },
  };
  return api;
}
