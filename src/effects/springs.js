import { gsap } from 'gsap';

// ONE shared spring loop (Architecture rule 3). A "layer" chases a target through a spring:
//   target  a plain object whose numbers are the goal (a scrubbed GSAP timeline writes them, or code sets them)
//   springs { prop: [stiffness, damping, mass] }   (Framer / motion units: a = (-k*(x - target) - c*v) / m)
//   apply   (values) => write the DOM (transform / opacity only)
// Nothing here reads layout: it only does arithmetic on numbers and calls `apply` while something is still moving.
// The loop rides on gsap.ticker (one requestAnimationFrame for the whole site).

const MAX_FRAME = 1 / 30;      // a long frame (tab switch, hiccup) never jumps too far
const layers = [];
let hooked = false;

// Rest thresholds: pixels need a coarser epsilon than unitless values (scale, opacity, progress).
const eps = (prop) => (prop === 'y' || prop === 'x' ? 0.05 : 0.0005);

// Closed-form motion of a damped spring: x'' = (-k x - c x') / m, starting at offset x0 from the target with velocity v0,
// advanced by dt seconds. Returns [offset, velocity]. (Euler integration blows up on springs like 148 / 39 / 0.1.)
function advance(x0, v0, k, c, m, dt) {
  const w0 = Math.sqrt(k / m);          // natural frequency
  const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio
  if (zeta < 1) {                        // underdamped: oscillates, decays
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * dt);
    const cos = Math.cos(wd * dt);
    const sin = Math.sin(wd * dt);
    const b = (v0 + zeta * w0 * x0) / wd;
    return [e * (x0 * cos + b * sin), e * (v0 * cos - (x0 * wd + (zeta * w0 * (v0 + zeta * w0 * x0)) / wd) * sin)];
  }
  if (zeta === 1) {                      // critically damped
    const e = Math.exp(-w0 * dt);
    const b = v0 + w0 * x0;
    return [e * (x0 + b * dt), e * (v0 - b * w0 * dt)];
  }
  const s = w0 * Math.sqrt(zeta * zeta - 1); // overdamped: two decaying exponentials, no overshoot
  const r1 = -zeta * w0 + s;
  const r2 = -zeta * w0 - s;
  const c1 = (v0 - r2 * x0) / (r1 - r2);
  const c2 = x0 - c1;
  const e1 = Math.exp(r1 * dt);
  const e2 = Math.exp(r2 * dt);
  return [c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2];
}

export const springLayers = () => layers; // dev tools (tools/scratch checks read every layer's value / target per frame)

// Jump every layer to its target now (used by back-to-top while the page is covered).
export function snapAllLayers() {
  layers.forEach((L) => { for (const p in L.springs) { L.value[p] = L.target[p]; L.vel[p] = 0; } L.apply(L.value); });
}

function frame(_time, deltaMs) {
  const dt = Math.min(deltaMs / 1000, MAX_FRAME);
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    let moving = false;
    for (const prop in L.springs) {
      const [k, c, m] = L.springs[prop];
      const t = L.target[prop];
      let x = L.value[prop];
      let v = L.vel[prop];
      if (Math.abs(x - t) < eps(prop) && Math.abs(v) < eps(prop)) {
        if (x !== t) { L.value[prop] = t; L.vel[prop] = 0; moving = true; } // snap to rest, write once
        continue;
      }
      moving = true;
      const next = advance(x - t, v, k, c, m, dt); // exact solution, so even very stiff / very damped springs stay stable
      L.value[prop] = t + next[0];
      L.vel[prop] = next[1];
    }
    if (moving) L.apply(L.value);
  }
}

export function springLayer({ target, springs, apply, snap = true }) {
  const value = {};
  const vel = {};
  for (const prop in springs) { value[prop] = snap ? target[prop] : 0; vel[prop] = 0; }
  const layer = { target, springs, apply, value, vel };
  layers.push(layer);
  if (!hooked) { gsap.ticker.add(frame); hooked = true; }
  apply(value);
  return {
    // Jump to the target now (no motion), e.g. after a resize or when the page loads part-way down.
    snap() { for (const p in springs) { value[p] = target[p]; vel[p] = 0; } apply(value); },
    destroy() { const i = layers.indexOf(layer); if (i >= 0) layers.splice(i, 1); },
  };
}

// Framer's "duration + bounce" spring notation -> stiffness / damping / mass (mass 1).
export function springFromBounce(duration, bounce) {
  const w = (2 * Math.PI) / duration;
  return [w * w, 4 * Math.PI * (1 - bounce) / duration, 1];
}
