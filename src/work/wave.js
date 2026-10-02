// R23: the ONE wave function of the Work page. A sine along the strip; the main images (vertex shader) and the cards (JS) both use it,
// so a crest lifts a frame and its neighbouring cards by the same amount. a = position along the strip on the screen (px), result =
// offset across the strip (px; positive = down in the side scroll, right in the vertical mode).
// params = { amp (px), len (px), phase (radians) }; `flat` params (amp 0) = no wave.
export const waveAt = (a, p) => p.amp * Math.sin((a / p.len) * Math.PI * 2 + p.phase);

// the same formula for the vertex shader (uniforms uWAmp, uWLen, uWPhase)
export const WAVE_GLSL = `
uniform float uWAmp; uniform float uWLen; uniform float uWPhase;
float waveAt(float a) { return uWAmp * sin(a / uWLen * 6.28318530718 + uWPhase); }
`;
