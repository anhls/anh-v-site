// The full-screen warp pass shared by the Selected Work cards (cards-gl.js) and the hero frame (frame-gl.js, R16c): ONE source for both.
// R16b: one full-screen distortion over every card. The cards are drawn (flat) into an offscreen multisampled buffer, resolved to a
// texture, and that texture goes to the screen through this shader. At rest the pass is skipped altogether (cards go straight to the
// canvas, exactly as before). Source position for each screen pixel (y down, x/y centred, v = -1..1 over the height):
//   w     = ramp over the outer `reach` of the height (0 in the middle, 1 at the screen edge), times sym on the leading side
//   pinch: x' = x / (1 - pinch * a * w)       sides curve inward toward the centre line (hourglass)
//   persp: y' = y * (1 + persp * a * w)        lines crowd toward the edge, like a sheet curling away
//   arc:   y' -= sign * arc * a * w * (1 - (2x)^2)   horizontal lines bow, deepest mid-screen, against the scroll direction
// a = |warp|, sign = scroll direction. Pixels whose source falls outside the screen are transparent. Grain is added here (x alpha).
// R16d: scrolling DOWN is now a surface CURLING AWAY (the reference): near the trailing (bottom) edge the horizontal lines bow
// DOWN in the middle (middle lower than the corners), the vertical lines converge toward the edge (narrower) and everything is
// smaller; one band parameter t = 0 at the start of the band .. 1 at the edge, w = t^2:
//     x' = x / (1 - pinchDown a w)                            (sides converge toward the edge)
//     y' = y + side a w (persp/2 - arc (1 - 4x^2))            (content crowds toward the edge; the arc term is limited to persp/2
//                                                              so d y'/d y >= 1 everywhere: the picture never magnifies)
// Scrolling UP keeps the look Anh accepted (the older model, below).
// R16e: that three-term model is now used ONLY for the frame canvas (FRAME mode). The screen-wide card pass uses the real CYLINDER
// projection described in warp-model.js (its JS twin): the card field is a sheet that bends around a horizontal axis near the top /
// bottom edge, away from the viewer when scrolling down and toward it when scrolling up, seen through a pinhole camera. In FRAME mode (uFrame.z > 0) the same maths runs in the frame
// rectangle's own space (x, y = offset from its centre / its width, height): the warp follows the frame wherever it is on screen.
export const POST_VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
export const POST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uRes;            // canvas size in device px
uniform float uAmt;           // signed warp, -1..1 (x strength); + = scrolling down
uniform vec4 uShape;          // frame mode: pinch, arc, persp, reach   |   cylinder mode: curl, camera distance (down), camera distance (up), reach
uniform vec2 uMargin;         // overscan of the offscreen buffer, as a share of the screen width / height (each side)
uniform float uSym;           // weight of the leading side (1 = both sides alike)
uniform float uPinchDown;     // frame mode: pinch while scrolling down; uShape.x is the pinch for scrolling up
uniform vec2 uBow;            // cylinder mode: dome depth while scrolling down / up (rows bow, sides pinch)
uniform vec4 uFrame;          // frame space: centre x, centre y, width, height in device px (width <= 0 = screen space, cylinder)
uniform float uGrain;
uniform float uSeed;
out vec4 o;
float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  bool fr = uFrame.z > 0.0;
  float fy = uRes.y - gl_FragCoord.y;                       // y down, device px
  vec2 p = fr ? vec2((gl_FragCoord.x - uFrame.x) / uFrame.z, (fy - uFrame.y) / uFrame.w)
              : vec2(gl_FragCoord.x / uRes.x - 0.5, fy / uRes.y - 0.5);   // centred, y down
  float y0 = (1.0 - uShape.w) * 0.5;
  float side = p.y >= 0.0 ? 1.0 : -1.0;
  float a = abs(uAmt);
  vec2 q = p;
  bool ok = true;
  if (fr) {
    float B = max(uShape.w * 0.5, 0.0005);
    float t = clamp((abs(p.y) - y0) / B, 0.0, 1.0);
    float w = t * t;
    if (uAmt > 0.0) {
      w *= (side > 0.0) ? 1.0 : uSym;
      float arc = min(uShape.y, uShape.z * 0.5);
      q.x = p.x / max(1.0 - uPinchDown * a * w, 0.25);
      q.y = p.y + side * a * w * (uShape.z * 0.5 - arc * (1.0 - 4.0 * p.x * p.x));
    } else {
      w *= (side < 0.0) ? 1.0 : uSym;
      q.x = p.x / max(1.0 - uShape.x * a * w, 0.25);
      q.y = p.y * (1.0 + uShape.z * a * w);
      q.y += uShape.y * a * w * (1.0 - 4.0 * p.x * p.x);
    }
  } else {
    // cylinder: the sheet is flat up to y0 from the centre, then follows an arc of radius R (angle th), away (+) or toward (-) the viewer
    float aS = a * (side > 0.0 ? (uAmt > 0.0 ? 1.0 : uSym) : (uAmt < 0.0 ? 1.0 : uSym));
    float e = abs(p.y);
    if (aS > 0.00001 && e > y0) {
      float away = uAmt > 0.0 ? 1.0 : -1.0;
      float cam = uAmt > 0.0 ? uShape.y : uShape.z;
      float bow = uAmt > 0.0 ? uBow.x : uBow.y;
      float L = uShape.w * 0.5;
      float R = L / (aS * uShape.x);
      float lo = 0.0;
      float hi = 1.55;
      hi = min(hi, 3.0 * L / R); // never look farther along the sheet than 3 band lengths (keeps f monotonic for weak warps)
      if (uAmt < 0.0) hi = min(hi, acos(clamp(1.0 - 0.8 * cam / R, -1.0, 1.0))); // toward the viewer: stop before the sheet reaches the camera plane
      float sh = R * hi / L;
      float fh = (y0 + R * sin(hi)) * cam / (cam + away * R * (1.0 - cos(hi)) + bow * p.x * p.x * sh * sh);
      if (fh < e) {
        // beyond the silhouette (the sheet cannot reach the screen edge): crush the rest into the last row instead of cutting the picture off
        float zt = away * R * (1.0 - cos(hi)) + bow * p.x * p.x * sh * sh;
        q.x = p.x * (cam + min(zt, 0.4 * cam)) / cam;
        q.y = side * min(y0 + R * hi + (e - fh) * 10.0, 1.1);
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
        q.x = p.x * (cam + min(z, 0.4 * cam)) / cam; // the sideways stretch is capped (the overscan buffer is finite)
        q.y = side * (y0 + R * th);
      }
    }
  }
  vec2 src = fr ? vec2((uFrame.x + q.x * uFrame.z) / uRes.x, (uFrame.y + q.y * uFrame.w) / uRes.y) : vec2(q.x + 0.5, q.y + 0.5); // y down, screen units
  vec2 uv = vec2((src.x + uMargin.x) / (1.0 + 2.0 * uMargin.x), (src.y + uMargin.y) / (1.0 + 2.0 * uMargin.y));
  vec4 c = vec4(0.0);
  if (ok && uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) c = texture(uScene, vec2(uv.x, 1.0 - uv.y));
  float n = h(gl_FragCoord.xy + uSeed) - 0.5;
  c.rgb = clamp(c.rgb + n * uGrain * c.a, 0.0, 1.0);
  o = c;
}`;
