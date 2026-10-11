import { BEND, TRANSITION as T } from '../timeline.js';

export const pillowBump = (t) => {
  const end = Math.max(0.02, Math.min(1, T.bulgeEndAt));
  if (t <= 0 || t >= end) return 0;
  const peak = Math.max(0.01, Math.min(end - 0.01, T.bulgePeakAt));
  return Math.sin(Math.PI / 2 * (t < peak ? t / peak : (end - t) / (end - peak))) ** 2;
};

// One flight clock. At full-screen crossing, uniform texture scale inherits the box's speed.
export function workFlight(start, end, back = false) {
  const noRebound = back && !T.backRebound;
  const total = T.workSec + (noRebound ? 0 : Math.max(0, T.reboundSec));
  const land = Math.min(total, Math.max(0.01, T.workSec * T.workLandAt));
  const tail = Math.max(0.01, total - land), carry = Math.max(0.01, Math.min(2, T.workCarry));
  const scaleSpeed = carry / land * Math.max(0, Math.min(1 - start.w / end.w, 1 - start.h / end.h));
  return { total, land, sample(p) {
    p = Math.max(0, Math.min(1, p));
    if (noRebound) return { size: p * p * (3 - 2 * p), bump: pillowBump(p), content: null };
    const time = p * total;
    if (time < land) {
      const u = time / land;
      return { size: (3 - carry) * u * u + (carry - 2) * u * u * u,
        bump: pillowBump(time / T.workSec), content: null };
    }
    const u = Math.min(1, (time - land) / tail);
    const pulse = Math.sin(Math.PI * u) ** 2;
    const content = { lens: -T.bulgeAmp * T.reboundAmp * pulse,
      zoom: T.reboundZoom * pulse + scaleSpeed * tail / (2 * Math.PI) * Math.sin(2 * Math.PI * u) * (1 - u) ** 2 };
    if (u >= 1) { content.lens = 0; content.zoom = 0; }
    return { size: 1, bump: 0, content };
  } };
}

// A printed sheet: UVs stay attached to the grid while its four edges bow outward.
export function createBulge(parent, box, image, deferTexture = false) {
  if (!image?.complete || !image.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'px__bulge';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  let gl;
  try { gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false }); } catch { return null; }
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
      in vec2 uv; uniform vec4 box; uniform vec4 imageBox; uniform vec2 viewport; uniform vec2 natural; uniform float bulge; out vec2 tex; out vec2 local;
      void main() {
        local = uv;
        vec2 q = uv * 2. - 1.;
        vec2 p = box.xy + uv * box.zw;
        p += q * (1. - q.yx * q.yx) * bulge * min(box.z, box.w);
        gl_Position = vec4(p.x / viewport.x * 2. - 1., 1. - p.y / viewport.y * 2., 0., 1.);
        vec2 at = (box.xy + uv * box.zw - imageBox.xy) / imageBox.zw;
        float cover = max(imageBox.z / natural.x, imageBox.w / natural.y);
        tex = (at - .5) * imageBox.zw / (natural * cover) + .5;
      }`);
    fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec2 tex; in vec2 local; uniform sampler2D picture;
      uniform vec4 box; uniform float radius; uniform float zoom; uniform float pixel; uniform float lens; uniform bool fullScreen;
      out vec4 color;
      void main() {
        vec2 qLens = local * 2. - 1.;
        vec2 warped = .5 + (tex - .5) * (1. + lens * dot(qLens, qLens));
        vec4 sampleColor = texture(picture, clamp((warped - .5) / (1. + zoom) + .5, 0., 1.));
        vec2 q = abs((local - .5) * box.zw) - box.zw * .5 + radius;
        float distance = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
        float aa = max(fwidth(distance), pixel);
        // Fade inside the mesh: straight-alpha canvas MSAA otherwise darkens its outer edge.
        float alpha = fullScreen ? 1. : 1. - smoothstep(-aa, 0., distance);
        color = vec4(sampleColor.rgb, sampleColor.a * alpha);
      }`);
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
    const uniforms = Object.fromEntries(['box', 'imageBox', 'viewport', 'natural', 'bulge', 'radius', 'zoom', 'pixel', 'lens', 'fullScreen'].map(k => [k, gl.getUniformLocation(program, k)]));
    let natural, textureKey;
    const setTexture = (im, decoded = null) => {
      if (dead || !im.complete || !im.naturalWidth) return;
      const key = im.currentSrc || im.src;
      if (key === textureKey) return;
      textureKey = key;
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, decoded || im); gl.generateMipmap(gl.TEXTURE_2D);
      natural = [im.naturalWidth, im.naturalHeight];
    };
    if (!deferTexture) setTexture(image); parent.append(canvas);
    return { canvas, dispose, setTexture, async prepareTexture(im) {
      if (dead || !im.complete || !im.naturalWidth) return false;
      natural = [im.naturalWidth, im.naturalHeight];
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, natural[0], natural[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (let y = 0; y < natural[1]; y += T.hoverUploadRows) {
        await new Promise(requestAnimationFrame);
        if (dead) return false;
        const strip = await createImageBitmap(im, 0, y, natural[0], Math.min(T.hoverUploadRows, natural[1] - y));
        if (dead) { strip.close(); return false; }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, gl.RGBA, gl.UNSIGNED_BYTE, strip); strip.close();
      }
      if (dead) return false;
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      textureKey = im.currentSrc || im.src;
      return true;
    }, get dead() { return dead; }, adopt(parent, nextBox) {
      box.style.visibility = ''; box = nextBox; parent.append(canvas); canvas.style.visibility = '';
    }, draw(b, ib = b, bump = 0, handoff = 0, pageHandoff = false, content = null) {
      if (dead) return;
      const dpr = Math.min(devicePixelRatio || 1, innerWidth > 2560 ? BEND.dprCapLarge : BEND.dprCap);
      const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(uniforms.box, b.x, b.y, b.w, b.h); gl.uniform4f(uniforms.imageBox, ib.x, ib.y, ib.w, ib.h);
      gl.uniform2f(uniforms.viewport, innerWidth, innerHeight); gl.uniform2fv(uniforms.natural, natural); gl.uniform1f(uniforms.bulge, T.bulgeAmp * bump);
      gl.uniform1f(uniforms.radius, T.cornerAmp * Math.min(b.w, b.h) * bump);
      gl.uniform1f(uniforms.zoom, T.zoomAmp * bump + (content?.zoom || 0));
      gl.uniform1f(uniforms.lens, content?.lens || 0);
      gl.uniform1i(uniforms.fullScreen, content ? 1 : 0);
      gl.uniform1f(uniforms.pixel, 1 / dpr);
      gl.drawElements(gl.TRIANGLES, ids.length, gl.UNSIGNED_SHORT, 0);
      // Brief overlap hides the browser / GPU resampling difference before the exact DOM hand-off.
      const mix = Math.max(0, Math.min(1, handoff));
      canvas.style.opacity = 1 - mix; box.style.visibility = mix > 0 && !pageHandoff ? '' : 'hidden';
    } };
  } catch { dispose(); return null; }
}
