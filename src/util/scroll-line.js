// R48 r10: the Work scroll line's motion, the desktop's (work/v2-ui.js R33d) as one function: target = (pos / N) x size x (1 + scrollLineGap), eased after the strip (WORK_LINE.scrollLineFollowSec, 95 % of the way
// in that time), two instances one period apart so the line leaves one edge, travels outside and re-enters from the other. The phone uses it on the vertical axis (size = the screen height).
import { WORK_LINE } from '../settings/desktop.js';
export function createScrollLine() {
  let x = NaN;
  return {
    // returns [offset0, offset1] in px along the axis (offset1 = offset0 - span)
    step(dt, pos, N, size, reduced) {
      const span = size * (1 + WORK_LINE.scrollLineGap), target = (pos / Math.max(N, 1)) * span;
      if (Number.isNaN(x) || reduced) x = target; else x += (target - x) * (1 - Math.exp((-dt * 3) / Math.max(WORK_LINE.scrollLineFollowSec, 0.05)));
      if (Math.abs(target - x) < 0.25) x = target;
      const xm = ((x % span) + span) % span;
      return [xm, xm - span];
    },
  };
}
