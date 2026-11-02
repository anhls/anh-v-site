// Public settings entry. Re-exports preserve the same mutable objects used by ?tune.
export * from './settings/shared.js';
export * from './settings/desktop.js';
export * from './settings/tall.js';

// Resolve duplicate mode policies explicitly; callers select the mode in the engine.
export { TRANSITION_POLICY } from './settings/desktop.js';
