import { FLIGHT } from '../settings/shared.js';

// This pure function is copied verbatim into the seven first-paint hand-off scripts.
// tools/scratch/r37e-check.mjs verifies those copies, including intermediate samples.
export function flightZoom(flight, now) {
  var u = Math.max(0, Math.min(1, (now - flight.t0 - flight.land * 1000) / (flight.tail * 1000)));
  return 1 + (flight.zEnd - 1) * (1 - Math.pow(1 - u, 3));
}

export function flightRecord(t0, settings) {
  return { t0, land: settings.workSec * settings.workLandAt, tail: settings.zoomTailSec, zEnd: FLIGHT.zEnd };
}

export const flightEnd = (f) => f.t0 + (f.land + f.tail) * 1000;
