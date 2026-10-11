# File ownership

One owner per source file. Shared components serve both modes; consult the other side before changing their public contract.
The mode adapters own differing policies; the core owns the common strip lifecycle.

## DESKTOP

- `src/effects/caption-hover.js`
- `src/effects/card-push.js`
- `src/effects/cards-gl.js`
- `src/effects/frame-gl.js`
- `src/effects/pointer.js`
- `src/effects/springs.js`
- `src/effects/text-fx/smear.js`
- `src/effects/trail.js`
- `src/effects/tune-panel.js`
- `src/effects/warp-model.js`
- `src/effects/warp-shader.js`
- `src/main.js`
- `src/project/desktop.js`
- `src/sections/about.js`
- `src/sections/hero.js`
- `src/sections/more-projects.js`
- `src/sections/placeholders.js`
- `src/sections/project-index.js`
- `src/sections/project-page.js`
- `src/sections/selected-work.js`
- `src/settings/desktop.js`
- `src/styles/desktop.css`
- `src/styles/project.css`
- `src/styles/work.css`
- `src/work/ambient.js`
- `src/work/focus.js`
- `src/work/frame-warp-shader.js`
- `src/work/mode-desktop.js`
- `src/work/pointer-fx.js`
- `src/work/v2-ui.js`

## LITE

- `src/data/layouts-tablet.json`
- `src/data/layouts-tall.json`
- `src/effects/tall-menu.js`
- `src/sections/project-page-tall.js`
- `src/settings/tall.js`
- `src/styles/tall-project.css`
- `src/styles/tall.css`
- `src/tall-home.js`
- `src/work/mode-lite.js`
- `src/work/tall-guard.js`
- `src/work/tall.js`

## SHARED

Transition engine changes go through one agent at a time (R37f: desktop agent).

- `src/effects/bulge-gl.js`
- `src/effects/flight-curve.js`
- `src/effects/project-transition.js`
- `src/effects/page-swap.js`
- `src/project/in-place.js`
- `src/effects/transition-policy.js`
- `work/index.html`
- `work/bitis09.html`
- `work/tcb-priority.html`
- `work/sulwhasoo.html`
- `work/similac.html`
- `work/forbes.html`
- `work/nam-long.html`
- `work/duhat.html`

- `src/data/cards-gen.js`
- `src/data/data.json`
- `src/data/depth.js`
- `src/data/layout.js`
- `src/data/layouts.json`
- `src/data/media-manifest.json`
- `src/data/overlap.js`
- `src/data/selected.json`
- `src/data/work-pool.json`
- `src/effects/.gitkeep`
- `src/effects/back-to-top.js`
- `src/effects/clicksound.js`
- `src/effects/lean-limit.js`
- `src/effects/loader.js`
- `src/effects/nav.js`
- `src/effects/overlap-debug.js`
- `src/effects/perf-hud.js`
- `src/effects/spawner.js`
- `src/effects/tune-docs.js`
- `src/effects/tune-scroll.js`
- `src/effects/tune-store.js`
- `src/home.js`
- `src/project.js`
- `src/scale.js`
- `src/sections/.gitkeep`
- `src/sections/footer.js`
- `src/settings/shared.js`
- `src/styles/base.css`
- `src/timeline.js`
- `src/util/bezier.js`
- `src/util/device.js`
- `src/util/dpr.js`
- `src/util/ease.js`
- `src/util/layout-mode.js`
- `src/util/media.js`
- `src/util/overshoot.js`
- `src/util/perf-mark.js`
- `src/util/scroll-gain.js`
- `src/work.js`
- `src/work/cards.js`
- `src/work/core.js`
- `src/work/layout-store.js`
- `src/work/speed-curve.js`
- `src/work/states.js`
- `src/work/tune.js`
- `docs/requests.md`
- `AGENTS.md`
- `CLAUDE.md`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `tools/compare.mjs`
- `tools/owners-check.mjs`
- `index.html`
- `public/media/`

