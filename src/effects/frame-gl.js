import { gsap } from 'gsap';
import { BEND, FRAME_WARP as FW, WARP, WARP_DIR } from '../timeline.js';
import { frameCoverZoom } from './warp-model.js';
import { frameState, frameLayers } from '../sections/hero.js';
import { weakDevice } from '../util/device.js';
import { POST_VERT, POST_FRAG } from './warp-shader.js';
import { imgSrc } from '../util/media.js';
import { capW } from '../scale.js';

// R16c: the centre frame (the hero mask) on its OWN canvas, only while the page scrolls. At rest the DOM frame shows (video playing,
// everything exactly as before). When the scroll speed passes FRAME_WARP.threshold the canvas takes over on the very same frame: the
// DOM frame is hidden, the video is paused, and this module redraws the frame from known numbers (frameState + frameLayers from
// hero.js, no DOM reads) through the same warp shader as the cards. When the warp has sprung flat and the page has stopped it fades
// back to the video's own frame, shows the DOM frame again and resumes the video.
// Layers, bottom to top (all inside the mask rectangle, each section is the mask size, scaled / moved about its centre):
//   black mask background, s2 (image), s3 (3 gallery images, the two upper ones peel away by y, then the two overlays),
//   s1 (opaque black, the video at its own opacity, the ticker strip). Fallbacks: no WebGL, reduced motion, weak device, ?gl=0
//   or a lost context -> the DOM frame stays and nothing warps; ?gl=1 forces it on.

const QV = `#version 300 es
uniform vec2 uView;     // css px
uniform vec4 uRect;     // x, y, w, h in css px (y down)
out vec2 vP;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vP = c;
  vec2 p = uRect.xy + c * uRect.zw;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;
const QF = `#version 300 es
precision highp float;
in vec2 vP;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec4 uUvA;      // cover transform: scale.xy, offset.xy
uniform vec4 uUvB;
uniform float uMix;     // 0 = texture A, 1 = texture B
uniform vec4 uColor;
uniform float uMode;    // 0 texture, 1 flat colour, 2 black vertical gradient (alpha 0 at the top -> 1 at the bottom)
uniform float uAlpha;
uniform float uBias;    // mip level bias (negative = sharper)
out vec4 o;
void main() {
  if (uMode > 1.5) { o = vec4(0.0, 0.0, 0.0, vP.y * uAlpha); return; }
  if (uMode > 0.5) { o = vec4(uColor.rgb * uColor.a, uColor.a) * uAlpha; return; }
  vec4 a = texture(uA, vP * uUvA.xy + uUvA.zw, uBias);
  vec4 c = a;
  if (uMix > 0.0) c = mix(a, texture(uB, vP * uUvB.xy + uUvB.zw, uBias), uMix);
  o = c * uAlpha;
}`;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const param = new URLSearchParams(location.search).get('gl');

export function createFrameGL(handles) {
  if (param === '0' || (param !== '1' && (reduced || weakDevice(BEND.weakCores, BEND.weakMemoryGb)))) return null;
  const { pin, float: floatEl, video, track } = handles;
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__gl';
  canvas.setAttribute('aria-hidden', 'true');
  let gl = null;
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) return null;

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const link = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };
  const quad = link(QV, QF);
  const post = link(POST_VERT, POST_FRAG);
  if (!quad || !post) return null;
  const uniforms = (p, names) => Object.fromEntries(names.map((k) => [k, gl.getUniformLocation(p, k)]));
  const Q = uniforms(quad, ['uView', 'uRect', 'uA', 'uB', 'uUvA', 'uUvB', 'uMix', 'uColor', 'uMode', 'uAlpha', 'uBias']);
  const P = uniforms(post, ['uScene', 'uRes', 'uAmt', 'uShape', 'uMargin', 'uSym', 'uPinchDown', 'uZoom', 'uBow', 'uFrame', 'uGrain', 'uSeed']);
  const emptyVao = gl.createVertexArray();
  gl.bindVertexArray(emptyVao);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let W = 1;
  let H = 1;
  let dpr = 1;
  let lost = false;
  let active = false; // the canvas is showing the frame
  let ready = false; // every texture is loaded

  // ---- textures --------------------------------------------------------------------------------------------------------------
  const tex = {}; // key -> { t, w, h }
  const makeTex = (mips) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (mips && an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  };
  const queue = []; // [key, url, cors]
  let decoding = false;
  const pump = () => {
    if (decoding || !queue.length) return;
    const [key, url, cors] = queue.shift();
    if (typeof url === 'function' && !handles.gallery.every((g) => g.complete && g.currentSrc)) { queue.push([key, url, cors]); return; } // the DOM images are still loading
    decoding = true;
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      const make = createImageBitmap ? createImageBitmap(img, { premultiplyAlpha: 'premultiply', imageOrientation: 'none' }) : Promise.resolve(img);
      make.then((bmp) => {
        if (!lost) {
          const t = makeTex(true);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
          gl.generateMipmap(gl.TEXTURE_2D);
          tex[key] = { t, w: bmp.width, h: bmp.height };
        }
        bmp.close?.();
        decoding = false;
        if (!queue.length) ready = Object.keys(need).every((k) => tex[k]);
      }).catch(() => { decoding = false; failed = true; });
    };
    img.onerror = () => { decoding = false; failed = true; };
    img.src = typeof url === 'function' ? url() : url;
  };
  let failed = false; // a texture could not be loaded (e.g. CORS): the DOM frame stays
  const need = {
    s2: [handles.image, true],
    // the gallery stills: the very file the DOM <img> picked (srcset), so both draw the same pixels; set once the DOM image has loaded
    g0: [() => handles.gallery[0].currentSrc || imgSrc(handles.galleryRefs[0]), false],
    g1: [() => handles.gallery[1].currentSrc || imgSrc(handles.galleryRefs[1]), false],
    g2: [() => handles.gallery[2].currentSrc || imgSrc(handles.galleryRefs[2]), false],
    poster: [handles.posterRef, false],
  };
  const preload = () => { Object.entries(need).forEach(([k, [u, c]]) => queue.push([k, u, c])); };
  // The ticker: the SVG strip rasterised once per size into a canvas texture (one item = the dot + "Click Anywhere").
  const tickImg = new Image();
  tickImg.src = handles.ticker;
  let tickTex = null;
  let tickKey = '';
  const buildTicker = () => {
    if (!tickImg.complete || !tickImg.naturalWidth) return;
    const iw = (9.479 * W) / 100;
    const ih = (0.469 * W) / 100;
    const key = `${Math.round(iw * dpr)}x${Math.round(ih * dpr)}`;
    if (key === tickKey) return;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(iw * dpr));
    c.height = Math.max(1, Math.round(ih * dpr));
    c.getContext('2d').drawImage(tickImg, 0, 0, c.width, c.height);
    if (!tickTex) tickTex = makeTex(false);
    gl.bindTexture(gl.TEXTURE_2D, tickTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    tickKey = key;
  };
  const vtex = makeTex(false); // the video's current frame (frozen at the hand-over)
  let vtexOk = false;

  // ---- drawing helpers ---------------------------------------------------------------------------------------------------------
  const cover = (boxW, boxH, tw, th) => { // object-fit: cover as a uv scale / offset
    const ba = boxW / boxH;
    const ta = tw / th;
    const sx = ta > ba ? ba / ta : 1;
    const sy = ta > ba ? 1 : ta / ba;
    return [sx, sy, (1 - sx) / 2, (1 - sy) / 2];
  };
  const scissor = (x0, y0, x1, y1) => { // css px rect (y down) -> device px, edges rounded like the browser snaps a clip
    const l = Math.round(Math.max(x0, 0) * dpr);
    const r = Math.round(Math.min(x1, W) * dpr);
    const t = Math.round(Math.max(y0, 0) * dpr);
    const b = Math.round(Math.min(y1, H) * dpr);
    gl.scissor(l, canvas.height - b, Math.max(r - l, 0), Math.max(b - t, 0));
  };
  const sb = (s) => (s > 1 ? Math.log2(s) * FW.softScaled : 0); // see FRAME_WARP.softScaled
  const drawQuad = (x, y, w, h, o) => {
    gl.uniform4f(Q.uRect, x, y, w, h);
    gl.uniform1f(Q.uMode, o.mode ?? 0);
    gl.uniform1f(Q.uAlpha, o.alpha ?? 1);
    gl.uniform1f(Q.uBias, FW.lodBias + (o.bias ?? 0));
    if (o.color) gl.uniform4f(Q.uColor, ...o.color);
    if (o.a) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.a.t); gl.uniform4fv(Q.uUvA, cover(o.cw ?? w, o.ch ?? h, o.a.w, o.a.h)); }
    gl.uniform1f(Q.uMix, o.b ? o.mix : 0);
    if (o.b) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, o.b.t); gl.uniform4fv(Q.uUvB, cover(o.cw ?? w, o.ch ?? h, o.b.w, o.b.h)); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // Redraws the whole frame from the numbers in frameState / frameLayers.
  let videoMix = 0; // 0 = the video's own frame, 1 = the poster
  const paintFrame = () => {
    gl.useProgram(quad);
    gl.uniform2f(Q.uView, W, H);
    gl.uniform1i(Q.uA, 0);
    gl.uniform1i(Q.uB, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    const mw = frameState.w;
    const mh = frameState.h;
    const mcx = W / 2;
    const mcy = H / 2 + frameState.fo + frameState.fi;
    const mx0 = mcx - mw / 2;
    const my0 = mcy - mh / 2;
    const L = frameLayers;
    // a section: the mask-size box about the mask centre, moved by y and scaled by s (transform-origin 50% 50%), clipped to the mask
    const box = (y, s) => { const w = mw * s; const h = mh * s; return [mcx - w / 2, mcy + y - h / 2, w, h]; };
    const clipTo = (b) => scissor(Math.max(b[0], mx0), Math.max(b[1], my0), Math.min(b[0] + b[2], mx0 + mw), Math.min(b[1] + b[3], my0 + mh));

    scissor(mx0, my0, mx0 + mw, my0 + mh);
    drawQuad(mx0, my0, mw, mh, { mode: 1, color: [0, 0, 0, 1] }); // the wrapper's black background

    // s2
    if (tex.s2) { const b = box(L.s2.y, L.s2.scale); clipTo(b); drawQuad(b[0], b[1], b[2], b[3], { a: tex.s2, bias: sb(L.s2.scale) }); }

    // s3: gallery 0 (static), 1 and 2 (peeling by y), then the two overlays
    { const s3 = L.s3; const b = box(s3.y, s3.scale); clipTo(b);
      if (tex.g0) drawQuad(b[0], b[1], b[2], b[3], { a: tex.g0, bias: sb(s3.scale) });
      if (tex.g1) drawQuad(b[0], b[1] + L.g1y * s3.scale, b[2], b[3], { a: tex.g1, bias: sb(s3.scale) });
      if (tex.g2) drawQuad(b[0], b[1] + L.g2y * s3.scale, b[2], b[3], { a: tex.g2, bias: sb(s3.scale) });
      if (L.ov > 0.0005) {
        drawQuad(b[0], b[1] + b[3] / 2, b[2], b[3] / 2, { mode: 2, alpha: L.ov }); // overlay2: bottom half, transparent -> black
        drawQuad(b[0], b[1], b[2], b[3], { mode: 1, color: [0, 0, 0, 0.9], alpha: L.ov }); // overlay: 90% black
      }
    }

    // s1: opaque black, the video (opacity), the ticker strip
    { const s1 = L.s1; const b = box(s1.y, s1.scale);
      if (b[1] < my0 + mh && b[1] + b[3] > my0) {
        clipTo(b);
        drawQuad(b[0], b[1], b[2], b[3], { mode: 1, color: [0, 0, 0, 1] });
        if (vtexOk || tex.poster) {
          const A = vtexOk ? { t: vtex, w: video.videoWidth, h: video.videoHeight } : tex.poster;
          drawQuad(b[0], b[1], b[2], b[3], { a: A, b: vtexOk && tex.poster ? tex.poster : null, mix: videoMix, alpha: L.video, bias: sb(s1.scale) });
        }
        if (L.ticker.opacity > 0.001 && tickTex) {
          const iw = (9.479 * W) / 100;
          const ih = (0.469 * W) / 100;
          const ty = mh / 2 - (0.2345 * W) / 100 + L.ticker.y; // inside the section's own (unscaled) coordinates
          const k = s1.scale;
          const ry = b[1] + ty * k;
          const rh = ih * k;
          scissor(Math.max(b[0], mx0), Math.max(ry, my0), Math.min(b[0] + b[2], mx0 + mw), Math.min(ry + rh, my0 + mh));
          const trackW = iw * 24; // 2 x TICKER.perHalf items
          const x0 = (L.trackPct / 100) * trackW;
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tickTex);
          gl.uniform1f(Q.uMix, 0);
          gl.uniform1f(Q.uMode, 0);
          gl.uniform1f(Q.uAlpha, L.ticker.opacity * 0.5);
          gl.uniform4f(Q.uUvA, 1, 1, 0, 0);
          for (let i = 0; i < 24; i++) {
            const lx = x0 + i * iw;
            const px = b[0] + lx * k;
            if (px + iw * k < b[0] || px > b[0] + b[2]) continue;
            gl.uniform4f(Q.uRect, px, ry, iw * k, rh);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        }
      }
    }
    gl.disable(gl.SCISSOR_TEST);
  };

  // ---- warp state + post pass --------------------------------------------------------------------------------------------------
  const bend = { x: 0, v: 0, amt: 0 };
  let fb = null;
  const makeFb = () => {
    if (fb) { gl.deleteFramebuffer(fb.ms); gl.deleteFramebuffer(fb.res); gl.deleteRenderbuffer(fb.rb); gl.deleteTexture(fb.tex); }
    const w = canvas.width;
    const h = canvas.height;
    const px = w * h;
    const samples = Math.min(px > 14e6 ? 0 : px > 6e6 ? 2 : 4, gl.getParameter(gl.MAX_SAMPLES));
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    const ms = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const res = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, res);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    fb = { ms, res, rb, tex: t, w, h };
  };
  const camPair = WARP_DIR > 0 ? [WARP.camDown, WARP.camUp] : [WARP.camUp, WARP.camDown];
  const bowPair = WARP_DIR > 0 ? [WARP.bowDown, WARP.bowUp] : [WARP.bowUp, WARP.bowDown];
  const postPass = (amt, rect) => {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb.ms);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb.res);
    gl.blitFramebuffer(0, 0, fb.w, fb.h, 0, 0, fb.w, fb.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.useProgram(post);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fb.tex);
    gl.uniform1i(P.uScene, 0);
    gl.uniform2f(P.uRes, canvas.width, canvas.height);
    gl.uniform1f(P.uAmt, Math.max(-1, Math.min(1, amt)));
    // R16h: the same cylinder and direction mapping as the cards (cards-gl.js), in the frame's own space. The shader's first camera / bow slot
    // belongs to its positive (recede) side, which WARP_DIR = -1 turns into scrolling UP.
    gl.uniform4f(P.uShape, WARP.curl, ...camPair, FW.reach);
    gl.uniform2f(P.uBow, ...bowPair);
    gl.uniform2f(P.uMargin, 0, 0);
    gl.uniform4f(P.uFrame, rect[0] * dpr, rect[1] * dpr, rect[2] * dpr, rect[3] * dpr); // the warp runs in the frame's own space (R16d)
    gl.uniform1f(P.uSym, FW.sym);
    // R16g: cover zoom. Only when the frame fills the screen (share of the screen, smoothstep over the last 15%), so small frames keep their look.
    const share = Math.min((rect[2] * rect[3]) / (W * H), 1);
    const k = Math.min(Math.max((share - 0.85) / 0.15, 0), 1);
    const cw = k * k * (3 - 2 * k) * FW.coverZoom;
    let zoom = 1;
    if (cw > 0) {
      zoom = 1 + cw * (frameCoverZoom(Math.max(-1, Math.min(1, amt)), WARP.curl, camPair[0], camPair[1], bowPair[0], bowPair[1], FW.reach, FW.sym, W / rect[2], H / rect[3]) + 0.004 * Math.min(1, Math.abs(amt) / 0.1) - 1); // + 0.4%: keeps the 1 px antialiased picture edge off the screen border
    }
    bend.zoom = zoom; bend.rect = rect;
    gl.uniform1f(P.uZoom, zoom);
    gl.uniform1f(P.uGrain, 0);
    gl.uniform1f(P.uSeed, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  };

  // ---- hand-over ---------------------------------------------------------------------------------------------------------------
  let wasPlaying = false;
  let calmSince = 0;
  let fading = 0; // 1 while fading back to the video's own frame before the DOM takes over again
  const show = (on) => {
    canvas.style.visibility = on ? 'visible' : 'hidden';
    floatEl.style.visibility = on ? 'hidden' : '';
  };
  const takeOver = () => {
    handles.readLayers();
    if (video.readyState >= 2 && video.videoWidth) {
      gl.bindTexture(gl.TEXTURE_2D, vtex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); vtexOk = true; } catch { vtexOk = false; }
    } else vtexOk = false;
    wasPlaying = !video.paused;
    video.pause();
    videoMix = 0;
    fading = 0;
    active = true;
    calmSince = 0;
    paint(0);
    show(true);
  };
  const handBack = () => {
    active = false;
    show(false);
    if (wasPlaying) video.play().catch(() => {});
  };

  const paint = (amt0) => {
    // R16d: the warp is relative to the FRAME rectangle (its own edges), not the screen, so it follows the frame while it moves and
    // resizes; its strength scales with the frame's size (subtle when small, full when it fills the screen).
    const fw = frameState.w;
    const fh = frameState.h;
    const rect = [W / 2, H / 2 + frameState.fo + frameState.fi, fw, fh];
    const amt = amt0 * (0.3 + 0.7 * Math.sqrt(Math.min((fw * fh) / (W * H), 1)));
    const usePost = Math.abs(amt) > 0.0015;
    bend.amt = amt;
    if (usePost) {
      if (!fb || fb.w !== canvas.width || fb.h !== canvas.height) makeFb();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb.ms);
      gl.viewport(0, 0, fb.w, fb.h);
    } else gl.viewport(0, 0, canvas.width, canvas.height);
    paintFrame();
    if (usePost) { gl.viewport(0, 0, canvas.width, canvas.height); postPass(amt, rect); gl.useProgram(quad); gl.bindVertexArray(emptyVao); }
  };

  // ---- the loop ----------------------------------------------------------------------------------------------------------------
  let dbgSpeed = 0;
  let forced = false; // dev checks (tools/scratch): keep the canvas showing the frame, no warp
  let prevSy = window.scrollY;
  let started = false;
  const tick = (_t, deltaMs) => {
    if (lost) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const sy = window.scrollY;
    let vel = (sy - prevSy) / Math.max(dt, 1e-3);
    if (Math.abs(vel) > 20000) vel = 0; // a jump (back to top), not a scroll
    prevSy = sy;
    if (!FW.on || failed || !ready) { if (active) { handBack(); } return; }
    const speed = Math.abs(vel); dbgSpeed = speed;
    if (!active) {
      if (forced || speed > FW.threshold) { buildTicker(); takeOver(); started = true; } else return;
    }
    // warp spring (the shared motion settings come from BEND)
    const os = Math.min(Math.max(BEND.overshoot, 0.001), 0.95);
    const zeta = -Math.log(os) / Math.sqrt(Math.PI * Math.PI + Math.log(os) ** 2);
    const wn = BEND.returnSpeed;
    const target = Math.tanh((Math.sign(vel) * Math.max(0, speed - FW.deadzone) * BEND.sensitivity) / BEND.speedRef); // R16f: Lenis' slow glide tail (below deadzone px/s) no longer holds the warp
    const steps = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      bend.v += (wn * wn * (target - bend.x) - 2 * zeta * wn * bend.v) * h;
      bend.x += bend.v * h;
    }
    if (Math.abs(bend.x) < 0.0005 && Math.abs(bend.v) < 0.002 && target === 0) { bend.x = 0; bend.v = 0; }
    handles.readLayers();
    // video: poster crossfade while warping (mode 0), or the frozen frame (mode 1)
    const toPoster = FW.videoMode === 0 && tex.poster && vtexOk ? 1 : 0;
    const goal = fading ? 0 : toPoster;
    videoMix += Math.sign(goal - videoMix) * Math.min(Math.abs(goal - videoMix), dt / Math.max(FW.fadeSec, 0.01));
    const amt = WARP_DIR * bend.x * (bend.x > 0 ? FW.strengthDown : FW.strengthUp);
    paint(amt);
    // hand back: calm = the spring is flat and the page is (nearly) still; then fade to the video's own frame, then the DOM again
    const calm = Math.abs(bend.x) < 0.004 && speed < Math.min(FW.threshold * 0.5, FW.deadzone); // Lenis' last sub-pixel steps count as still
    if (forced) { calmSince = 0; fading = 0; } else if (calm) calmSince += dt; else { calmSince = 0; fading = 0; }
    if (calmSince > 0.12) fading = 1;
    if (fading && videoMix <= 0.001) { bend.x = 0; bend.v = 0; handBack(); }
  };
  gsap.ticker.add(tick);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; if (active) { active = false; show(false); if (wasPlaying) video.play().catch(() => {}); } });
  pin.appendChild(canvas);
  show(false);

  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    const cap = W > 2560 ? BEND.dprCapLarge : BEND.dprCap;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (fb) { fb.w = -1; } // rebuilt on next use
    tickKey = '';
    buildTicker();
  };
  resize();
  window.addEventListener('resize', resize);
  tickImg.addEventListener('load', buildTicker);

  return {
    canvas,
    preload: () => { preload(); const loop = () => { pump(); if (!ready && !failed && !lost) setTimeout(loop, 60); }; loop(); },
    isActive: () => active,
    state: () => ({ active, ready, failed, bend: bend.x, amt: bend.amt, zoom: bend.zoom, rect: bend.rect, mix: videoMix, calmSince, fading, speed: dbgSpeed }),
    handBackNow: () => { if (active) handBack(); },
    force: (on) => { forced = !!on; if (!on && active) { fading = 1; } }, // dev only
  };
}
