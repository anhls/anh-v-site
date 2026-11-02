import './util/modal.js'; // R46c: must stay the first import (its input blocker has to be registered before any page listener)
import './styles/base.css';
import './styles/desktop.css';
import './styles/work.css';
import './effects/contact-trigger.js';
import { isLite, isTall } from './util/layout-mode.js';
import { startWork } from './work/core.js';

// Choose once, as before; rotate-time mode switching belongs to R24c.
const adapter = isLite() ? await import('./work/mode-lite.js') : await import('./work/mode-desktop.js');
await startWork(await adapter.createMode({ tall: isTall() }));
