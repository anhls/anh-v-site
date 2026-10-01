// The full-screen warp pass shared by the Selected Work cards (cards-gl.js) and the hero frame (frame-gl.js, R16c): ONE source for both.
// R16b: one full-screen distortion over every card. The cards are drawn (flat) into an offscreen multisampled buffer, resolved to a
// texture, and that texture goes to the screen through this shader. At rest the pass is skipped altogether (cards go straight to the
// canvas, exactly as before). Source position for each screen pixel (y down, x/y centred, v = -1..1 over the height):
//   w     = ramp over the outer `reach` of the height (0 in the middle, 1 at the screen edge), times sym on the leading side
//   pinch: x' = x / (1 - pinch * a * w)       sides curve inward toward the centre line (hourglass)
//   persp: y' = y * (1 + persp * a * w)        lines crowd toward the edge, like a sheet curling away
//   arc:   y' -= sign * arc * a * w * (1 - (2x)^2)   horizontal lines bow, deepest mid-screen, against the scroll direction
// a = |warp|, sign = scroll direction. Pixels whose source falls outside the screen are transparent. Grain is added here (x alpha).
export const POST_VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
export const POST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;            // canvas size in device px
uniform float uAmt;           // signed warp, -1..1 (x strength)
uniform vec4 uShape;          // pinch, arc, persp, reach
uniform vec2 uMargin;         // overscan of the offscreen buffer, as a share of the screen width / height (each side)
uniform float uSym;           // weight of the leading side (1 = both sides alike)
uniform float uGrain;
uniform float uSeed;
out vec4 o;
float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 s = gl_FragCoord.xy / uRes;
  vec2 p = vec2(s.x - 0.5, 0.5 - s.y);          // centred, y down
  float v = p.y * 2.0;
  float d = abs(v);
  float t = clamp((d - (1.0 - uShape.w)) / max(uShape.w, 0.001), 0.0, 1.0);
  float w = t * t;
  float trailing = (v * uAmt > 0.0) ? 1.0 : uSym;   // the side the content trails toward bows fully, the other by uSym
  w *= trailing;
  float a = abs(uAmt);
  vec2 q = p;
  q.x = p.x / max(1.0 - uShape.x * a * w, 0.25);
  q.y = p.y * (1.0 + uShape.z * a * w);
  // Arc. Scrolling UP (uAmt < 0) keeps the R16b look (the arc term magnifies a little: the "inflate"). Scrolling DOWN (uAmt > 0)
  // bows each edge outward instead, so every term compresses (pinch, perspective and arc all push the source farther from the
  // centre): the content recedes, nothing is magnified (checked on a grid, see docs/status.md R16b-fix).
  float arcK = uShape.y * a * w * (1.0 - 4.0 * p.x * p.x);
  q.y += (uAmt > 0.0) ? (v >= 0.0 ? arcK : -arcK) : arcK;
  vec2 src = vec2(q.x + 0.5, 0.5 + q.y);   // y down, in screen units; the buffer also holds the overscan around the screen
  vec2 uv = vec2((src.x + uMargin.x) / (1.0 + 2.0 * uMargin.x), (src.y + uMargin.y) / (1.0 + 2.0 * uMargin.y));
  vec4 c = vec4(0.0);
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) c = texture(uScene, vec2(uv.x, 1.0 - uv.y));
  float n = h(gl_FragCoord.xy + uSeed) - 0.5;
  c.rgb = clamp(c.rgb + n * uGrain * c.a, 0.0, 1.0);
  o = c;
}`;
