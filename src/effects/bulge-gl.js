import { BEND, TRANSITION as T } from '../timeline.js';

export const pillowBump = (t) => {
  if (t <= 0 || t >= 1) return 0;
  const peak = Math.max(0.01, Math.min(0.99, T.bulgePeakAt));
  return Math.sin(Math.PI / 2 * (t < peak ? t / peak : (1 - t) / (1 - peak))) ** 2;
};

// A printed sheet: UVs stay attached to the grid while its four edges bow outward.
export function createBulge(parent, box, image) {
  if (!image?.complete || !image.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'px__bulge';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  let gl;
  try { gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false }); } catch { return null; }
  if (!gl) return null;
  let dead = false, texture, program, vertex, index, vs, fs;
  const dispose = () => {
    if (dead) return;
    dead = true;
    box.style.visibility = '';
    canvas.remove();
    gl.deleteTexture(texture); gl.deleteBuffer(vertex); gl.deleteBuffer(index);
    gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); });
  try {
    const shader = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('Bulge shader'); }
      return s;
    };
    vs = shader(gl.VERTEX_SHADER, `#version 300 es
      in vec2 uv; uniform vec4 box; uniform vec4 imageBox; uniform vec2 viewport; uniform vec2 natural; uniform float bulge; out vec2 tex;
      void main() {
        vec2 q = uv * 2. - 1.;
        vec2 p = box.xy + uv * box.zw;
        p += q * (1. - q.yx * q.yx) * bulge * min(box.z, box.w) / 2.;
        gl_Position = vec4(p.x / viewport.x * 2. - 1., 1. - p.y / viewport.y * 2., 0., 1.);
        vec2 at = (box.xy + uv * box.zw - imageBox.xy) / imageBox.zw;
        float cover = max(imageBox.z / natural.x, imageBox.w / natural.y);
        tex = (at - .5) * imageBox.zw / (natural * cover) + .5;
      }`);
    fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float; in vec2 tex; uniform sampler2D picture; out vec4 color;
      void main() { color = texture(picture, tex); }`);
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Bulge program');
    gl.useProgram(program);
    const n = T.bulgeGrid, points = [], ids = [];
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) points.push(x / n, y / n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * (n + 1) + x; ids.push(i, i + 1, i + n + 1, i + 1, i + n + 2, i + n + 1); }
    vertex = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vertex); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(program, 'uv'); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    index = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ids), gl.STATIC_DRAW);
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const uniforms = Object.fromEntries(['box', 'imageBox', 'viewport', 'natural', 'bulge'].map(k => [k, gl.getUniformLocation(program, k)]));
    let natural;
    const setTexture = (im) => {
      if (dead || !im.complete || !im.naturalWidth) return;
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); gl.generateMipmap(gl.TEXTURE_2D);
      natural = [im.naturalWidth, im.naturalHeight];
    };
    setTexture(image); parent.append(canvas);
    return { canvas, dispose, setTexture, draw(b, ib = b, bulge = 0, handoff = 0, pageHandoff = false) {
      if (dead) return;
      const dpr = Math.min(devicePixelRatio || 1, innerWidth > 2560 ? BEND.dprCapLarge : BEND.dprCap);
      const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(uniforms.box, b.x, b.y, b.w, b.h); gl.uniform4f(uniforms.imageBox, ib.x, ib.y, ib.w, ib.h);
      gl.uniform2f(uniforms.viewport, innerWidth, innerHeight); gl.uniform2fv(uniforms.natural, natural); gl.uniform1f(uniforms.bulge, bulge);
      gl.drawElements(gl.TRIANGLES, ids.length, gl.UNSIGNED_SHORT, 0);
      // Brief overlap hides the browser / GPU resampling difference before the exact DOM hand-off.
      const mix = Math.max(0, Math.min(1, handoff));
      canvas.style.opacity = 1 - mix; box.style.visibility = mix > 0 && !pageHandoff ? '' : 'hidden';
    } };
  } catch { dispose(); return null; }
}
