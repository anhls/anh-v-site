// R46b: dev-only (?tune) panel for the contact card's CONTACT group. Never in the production build (imported behind import.meta.env.DEV).
import { CONTACT_CARD as K } from '../settings/shared.js';
const DEFS = [
  ['omega', 'Spring speed', 3, 20, 0.5], ['zeta', 'Overshoot damping', 0.3, 1.2, 0.01], ['rotZeta', 'Spin damping', 0.3, 1.5, 0.01], ['spin', 'Spin (deg)', 0, 720, 10],
  ['throwDist', 'Throw distance', 0.5, 2.5, 0.05], ['rotMax', 'Main tilt max (deg)', 0, 15, 0.5], ['backRotMax', 'Back tilt max (deg)', 0, 20, 0.5], ['backOffset', 'Back offset (x width)', 0, 0.08, 0.005],
  ['backLead', 'Back lands earlier (s)', 0, 0.3, 0.01], ['outSec', 'Slide-out (s)', 0.15, 1.2, 0.05], ['outLag', 'Back leaves later (s)', 0, 0.3, 0.01], ['flingSpeed', 'Fling speed (px/s)', 500, 5000, 50],
  ['dragTilt', 'Drag tilt (deg per 1000 px/s)', 0, 15, 0.5], ['tiltMax', 'Drag tilt cap (deg)', 0, 30, 1], ['friction', 'Inertia friction', 1, 15, 0.5],
];
let el = null;
export function mountContactTune() {
  if (el) return;
  el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:200;background:#000c;color:#eee;font:11px system-ui;padding:8px;max-height:96vh;overflow:auto;width:230px;pointer-events:auto';
  el.innerHTML = '<b>CONTACT</b>' + DEFS.map(([k, l, a, b, s]) => `<label style="display:block;margin-top:4px">${l}: <span data-v="${k}">${K[k]}</span><input data-k="${k}" type="range" min="${a}" max="${b}" step="${s}" value="${K[k]}" style="width:100%"></label>`).join('');
  el.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; K[k] = +e.target.value; el.querySelector(`[data-v="${k}"]`).textContent = K[k]; });
  ['pointerdown', 'click', 'wheel', 'touchmove'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
  document.body.append(el);
}
