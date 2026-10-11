import { isLite } from '../util/layout-mode.js';
import { TRANSITION_POLICY as desktop } from '../settings/desktop.js';
import { TRANSITION_POLICY as lite } from '../settings/tall.js';
export const transitionPolicy = () => isLite() ? lite : desktop;
