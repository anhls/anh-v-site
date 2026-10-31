import { isLite } from '../util/layout-mode.js';
import { TRANSITION_POLICY as desktop } from '../settings/desktop.js';
import { TRANSITION_POLICY_LITE as lite } from '../settings/tall.js';
import { weakDevice } from '../util/device.js';
const plain = { ...lite, enabled: false, bulge: false };
export const transitionPolicy = () => isLite() ? (weakDevice() ? plain : lite) : desktop;
