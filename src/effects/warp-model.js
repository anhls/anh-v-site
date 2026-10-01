// R16e: the screen-wide card warp as a real CYLINDER projection. This file is the JS twin of the cylinder branch in warp-shader.js
// (same maths, same names); it is used to size the overscan buffer and by tools/scratch/r16e-grid.mjs to check the shape on a grid.
//
// The whole card field is ONE sheet, flat while it is inside the screen. Near the top / bottom edge it bends around a horizontal
// cylinder axis: starting at height y0 = (1 - reach) / 2 (screen-height units, centre = 0) the sheet follows an arc of radius R,
// away from the viewer (scrolling down: the sheet recedes) or toward the viewer (scrolling up). A pinhole camera at distance D
// (in screen heights) looks straight at the screen centre, so a sheet point (X, Y, Z) lands on the screen at (X, Y) * D / (D + Z):
//     arc length s = Y - y0 along the sheet, angle th = s / R
//     point on the sheet:   Y_c = y0 + R sin th,   Z = +/- R (1 - cos th)       (+ = away)
//     screen position:      y_s = Y_c * D / (D + Z),   x_s = X * D / (D + Z)
// The render pass needs the inverse: for a screen pixel (x_s, y_s) find th with y_s = f(th) (monotonic on 0..~89 degrees: bisection),
// then the sheet coordinates are X = x_s (D + Z) / D, Y = y0 + R th, and that is where the flat card picture is sampled.
// A horizontal-axis cylinder alone keeps every row straight (all of a row is at the same depth), so the reference's arcing edge needs
// one more term: a shallow DOME across the sheet, Zb = bow * x_s^2 * (s / L)^2 (always away from the viewer, growing into the band): the
// side parts of a row are farther than its middle, so they shrink toward the centre line and the row bows with its middle farthest out.
// Away (+): D / (D + Z) <= 1, so content gets smaller toward the edge, rows compress, the sides pinch in (X >= x_s): never magnified.
// Toward (-): D / (D - |Z|) >= 1, content grows and spreads out. R = L / (|amt| * curl) with L = reach / 2: `curl` is the angle
// (radians) the sheet has turned after the band length at amt = 1; amt = 0 gives R = infinity (flat), so the sign flip is continuous.

export const CYL_STEPS = 18;
const TH_MAX = 1.55; // ~89 degrees

// Sheet coordinates seen through the screen position (xs, ys) (both centred, y down, in screen-height units for y and width units
// for x), (beyond the silhouette the rest of the sheet is crushed into the last row). amt = signed warp (+ = scrolling down).
export function cylinderSource(xs, ys, amt, curl, cam, reach, sym, bow = 0) {
  const side = ys >= 0 ? 1 : -1;
  const trailing = side * amt > 0 || amt === 0;
  const a = Math.abs(amt) * (side > 0 ? (amt > 0 ? 1 : sym) : (amt < 0 ? 1 : sym)); // down bends the bottom, up the top; the other edge by sym
  const e = Math.abs(ys);
  const y0 = (1 - reach) / 2;
  if (a < 1e-5 || e <= y0) return { x: xs, y: ys };
  const away = amt > 0 ? 1 : -1;
  const R = (reach / 2) / (a * curl);
  const L = reach / 2;
  const zOf = (th) => away * R * (1 - Math.cos(th)) + bow * xs * xs * (R * th / L) ** 2;
  const f = (th) => (y0 + R * Math.sin(th)) * cam / (cam + zOf(th));
  let hiTh = Math.min(TH_MAX, 3 * L / R); // never look farther along the sheet than 3 band lengths (keeps f monotonic for weak warps)
  if (away < 0) hiTh = Math.min(hiTh, Math.acos(Math.min(Math.max(1 - 0.8 * cam / R, -1), 1))); // toward: stop before the camera plane
  if (f(hiTh) < e) { // beyond the silhouette: crushed into the last row (same as the shader), never cut off
    return { x: xs * (cam + Math.min(zOf(hiTh), 0.4 * cam)) / cam, y: side * Math.min(y0 + R * hiTh + (e - f(hiTh)) * 10, 1.1), z: zOf(hiTh), th: hiTh, crushed: true };
  }
  let lo = 0;
  let hi = hiTh;
  for (let i = 0; i < CYL_STEPS; i++) { const mid = (lo + hi) / 2; if (f(mid) < e) lo = mid; else hi = mid; }
  const th = (lo + hi) / 2;
  const Z = zOf(th);
  return { x: xs * (cam + Math.min(Z, 0.4 * cam)) / cam, y: side * (y0 + R * th), z: Z, th, trailing };
}

// How far outside the screen the sheet is sampled at the screen edge for warp amounts up to `amtMax` (in widths / heights), for the buffer margin.
export function cylinderMargins(amtMax, curl, cam, reach, sym, bow = 0) {
  let mx = 0;
  let my = 0;
  for (const amt of [amtMax, -amtMax]) {
    for (const ys of [0.5, -0.5]) {
      for (const xs of [0, 0.5, -0.5]) {
        const r = cylinderSource(xs, ys, amt, curl, cam, reach, sym, bow);
        if (!r) continue;
        mx = Math.max(mx, Math.abs(r.x) - 0.5);
        my = Math.max(my, Math.abs(r.y) - 0.5);
      }
    }
  }
  return [Math.max(mx, 0), Math.max(my, 0)];
}
