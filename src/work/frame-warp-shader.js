// R22h part 2: the Work page's MAIN IMAGES get their own warp pass (own settings: WORK.frameWarp), separate from the cards' (WORK.cardWarp, the
// shared warp-shader.js). Same idea as the homepage frame / card warp: the layer's picture is drawn flat into an offscreen buffer and this
// shader looks each screen pixel up through a CYLINDER projection (the sheet is flat up to the middle `reach` of the height, then curls around the
// axis of the strip's edges, away from the viewer when the strip moves one way, toward it the other way, seen by a pinhole camera `cam` screen
// heights away). It is its own copy, not an import of the card shader, so the image look can move on its own (the homepage frame's cylinder is
// wider and slower than the cards' bend). Screen space only (no frame rectangle mode), uAxis turns it 90 degrees for the horizontal strip.
// The uniforms are the same as POST_FRAG's, so cards-gl.js drives both with one pass function.
export const FRAME_POST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;            // canvas size in device px
uniform float uAmt;           // signed warp, -1..1 (x strength); + = the 'recede' side
uniform vec4 uShape;          // curl, camera distance (+ side), camera distance (- side), reach
uniform vec2 uMargin;         // overscan of the offscreen buffer, as a share of the screen width / height (each side)
uniform float uSym;           // weight of the leading side (1 = both sides alike)
uniform vec2 uBow;            // dome depth, + side / - side
uniform float uGrain;
uniform float uSeed;
uniform float uAxis;          // 1 = turned 90 degrees (a horizontally scrolling strip)
uniform float uShift;         // R24i: the cylinder axis moves by this (screen lengths along the strip, signed, after the axis turn); 0 = centred = the picture of before
out vec4 o;
float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  float fy = uRes.y - gl_FragCoord.y;
  vec2 p = vec2(gl_FragCoord.x / uRes.x - 0.5, fy / uRes.y - 0.5);
  if (uAxis > 0.5) p = p.yx;
  p.y -= uShift;
  float y0 = (1.0 - uShape.w) * 0.5;
  float side = p.y >= 0.0 ? 1.0 : -1.0;
  float a = abs(uAmt);
  vec2 q = p;
  float aS = a * (side > 0.0 ? (uAmt > 0.0 ? 1.0 : uSym) : (uAmt < 0.0 ? 1.0 : uSym));
  float e = abs(p.y);
  float vis = 1.0;
  if (aS > 0.00001 && e > y0) {
    float away = uAmt > 0.0 ? 1.0 : -1.0;
    float cam = uAmt > 0.0 ? uShape.y : uShape.z;
    float bow = uAmt > 0.0 ? uBow.x : uBow.y;
    float L = uShape.w * 0.5;
    float R = L / (aS * uShape.x);
    float lo = 0.0;
    float hi = min(1.55, 3.0 * L / R);
    if (uAmt < 0.0) hi = min(hi, acos(clamp(1.0 - 0.8 * cam / R, -1.0, 1.0)));
    float sh = R * hi / L;
    float fh = (y0 + R * sin(hi)) * cam / (cam + away * R * (1.0 - cos(hi)) + bow * p.x * p.x * sh * sh);
    if (fh < e) {
      float zt = away * R * (1.0 - cos(hi)) + bow * p.x * p.x * sh * sh;
      q.x = p.x * (cam + min(zt, 0.4 * cam)) / cam;
      q.y = side * (y0 + R * hi);
      // R36: past the curl's silhouette the sheet is gone (the old lookup packed the rest of the strip into ~10x squashed bands): draw nothing,
      // with the edge softened over ~1.5 device px
      vis = 1.0 - smoothstep(0.0, 1.5 / (uAxis > 0.5 ? uRes.x : uRes.y), e - fh);
    } else {
      for (int i = 0; i < 18; i++) {
        float m = 0.5 * (lo + hi);
        float sm = R * m / L;
        float f = (y0 + R * sin(m)) * cam / (cam + away * R * (1.0 - cos(m)) + bow * p.x * p.x * sm * sm);
        if (f < e) lo = m; else hi = m;
      }
      float th = 0.5 * (lo + hi);
      float sT = R * th / L;
      float z = away * R * (1.0 - cos(th)) + bow * p.x * p.x * sT * sT;
      q.x = p.x * (cam + min(z, 0.4 * cam)) / cam;
      q.y = side * (y0 + R * th);
    }
  }
  q.y += uShift;
  if (uAxis > 0.5) q = q.yx;
  vec2 src = vec2(q.x + 0.5, q.y + 0.5);
  vec2 uv = vec2((src.x + uMargin.x) / (1.0 + 2.0 * uMargin.x), (src.y + uMargin.y) / (1.0 + 2.0 * uMargin.y));
  vec4 c = vec4(0.0);
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) c = texture(uScene, vec2(uv.x, 1.0 - uv.y));
  c *= vis;
  float n = h(gl_FragCoord.xy + uSeed) - 0.5;
  c.rgb = clamp(c.rgb + n * uGrain * c.a, 0.0, 1.0);
  o = c;
}`;
