// R23: WebGL2 renderer for the main images of the Work page. One full-window canvas; every frame is a strip of quads (bendSegments
// along the strip, gl_VertexID, no buffers) whose vertices are moved across the strip by the shared wave (wave.js), so the image
// itself bends. Own shader and context: nothing here is shared with the homepage frame (frame-gl.js).
import { WAVE_GLSL } from './wave.js';

const VS = `#version 300 es
precision highp float;
uniform vec4 uRect;   // x, y, w, h of the frame in css px (top-left origin)
uniform vec2 uView;   // window size in css px
uniform float uVert;  // 1 = vertical strip (the wave moves vertices sideways)
uniform int uSeg;
uniform vec4 uCover;  // object-fit: cover as (scaleU, scaleV, offU, offV)
${WAVE_GLSL}
out vec2 vUv;
void main() {
  int q = gl_VertexID / 2;
  float t = float(q) / float(uSeg);
  float s = float(gl_VertexID & 1);
  vec2 uv = uVert > 0.5 ? vec2(s, t) : vec2(t, s);
  vec2 p = uRect.xy + uv * uRect.zw;
  if (uVert > 0.5) p.x += waveAt(p.y); else p.y += waveAt(p.x);
  vUv = uv * uCover.xy + uCover.zw;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 o;
void main() { o = vec4(texture(uTex, vUv).rgb, 1.0); }`;

export function createStripGL(canvas, { onLost } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('work strip shader:', e.message); return null; }
  const U = Object.fromEntries(['uRect', 'uView', 'uVert', 'uSeg', 'uCover', 'uTex', 'uWAmp', 'uWLen', 'uWPhase'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  gl.bindVertexArray(gl.createVertexArray());
  gl.useProgram(prog);
  gl.uniform1i(U.uTex, 0);
  gl.clearColor(0, 0, 0, 0);
  let lost = false;
  let seg = 64;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; onLost?.(); });

  const textures = [];
  const covers = [];
  return {
    resize(w, h, dpr) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height); },
    // upload the picture of frame i from a loaded <img>
    setImage(i, img) {
      if (lost || !img.naturalWidth) return;
      const tex = textures[i] || (textures[i] = gl.createTexture());
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      covers[i] = { iw: img.naturalWidth, ih: img.naturalHeight };
    },
    has: (i) => !!textures[i],
    begin(viewW, viewH, wave, vertical, segments) {
      seg = segments;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uView, viewW, viewH);
      gl.uniform1f(U.uVert, vertical ? 1 : 0);
      gl.uniform1i(U.uSeg, segments);
      gl.uniform1f(U.uWAmp, wave.amp);
      gl.uniform1f(U.uWLen, wave.len);
      gl.uniform1f(U.uWPhase, wave.phase);
    },
    // draw frame i into the css-px rect (x, y, w, h)
    draw(i, x, y, w, h) {
      if (lost || !textures[i]) return;
      const c = covers[i];
      const ra = w / h, ri = c.iw / c.ih;
      const sx = ri > ra ? ra / ri : 1, sy = ri > ra ? 1 : ri / ra;
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.uniform4f(U.uRect, x, y, w, h);
      gl.uniform4f(U.uCover, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (seg + 1) * 2);
    },
    destroy() { textures.forEach((t) => t && gl.deleteTexture(t)); },
  };
}
