# R38 private light preview — complete, 2026-10-11

Branch: `codex/r37-r38`. Undo / stop using all R37/R38 commits: `git switch work-v2`. Task 0 was committed before the branch safeguard and remains on work-v2; no original history was rewritten.

Use `?theme=light` on all ten entries, including 404, or Shift+L. `?theme=dark` stores dark; `?theme=reset` clears the choice. Shift+L ignores inputs, textareas, selects and editable content. There is no visible control and no automatic system-theme selection. Pool and developer panels retain their own styling.

The only light palette values are together in src/styles/base.css: --bg #ece9e2 and --fg #0d0d0d. --ink preserves the old pure-white text in dark mode and derives from --fg in light mode. A plain #fff background is the other obvious option for Anh to compare. Each implemented entry applies its stored theme before a blocking base stylesheet; a short inline sync reads the same background token for theme-color. Charset stays first. No colour copies are needed in the inline scripts.

## Visible limitations / decisions for Anh

- The Work title becomes near-black, including its WebGL smear. Against a dark project image it can be hard to read. A finished light design needs a deliberate image-overlay text colour or contrast treatment rather than globally dark text.
- Small Work labels, mode-switch copy, Reach out and /07 retain their existing dim opacities. They look especially faint on the warm page. No opacity/layout tuning was introduced for this private preview.
- Light/dark card tags and their layout were authored for black. They are untouched; light cards can blend into the warm background. Existing dark card layers remain dark because they belong to the image presentation.
- The wordmark and About arrow use CSS inversion in light mode. A proper light release should use approved dark vector/brand assets and an image-aware treatment when the logo sits over a dark full-screen hero. The phone project screenshot demonstrates that a dark wordmark can disappear into the hero.
- Hero videos, project images, GIFs and media with baked black backgrounds remain unchanged. These need alternate exports or an intentional framed-media treatment if a fully light visual language is chosen.
- The homepage hero trail and image-following cursor previews are image content; they are not recoloured. Their dark assets may read as dark rectangles against light. Native cursors stay native. Orange hover accents remain orange.
- Homepage captions and nav use the existing foreground token. Near-black captions/links can lose contrast over dark hero content; image scrims and gradients stay dark as requested. A final design needs separate over-image text decisions.
- The tall menu uses warm background and dark text; the burger and existing difference-blend controls keep white source ink so they invert against the page. Dark image-player surfaces and white play glyphs remain media controls, not page surfaces.
- Cards/frame/transition canvases clear transparently. Existing black image scrims and the frame shader's dark fade remain image treatments. No shaders, layout data or media were changed.

## Validation

Build passes and the cached dark comparison passes 542/542 at 1920x1080 and 2560x1440. Theme query, persistence across project navigation, reset, Shift+L, focused inputs/editables, denied-storage fallback, live Work text colour and live theme-color checks pass.

Both themes pass actual vertical Work → project → Work flows, with no transition canvas/overlay after return. Tall menus pass. With the restored 404 preview, gl=0 on all ten entries in both themes passed, and no console/page errors were collected. Screenshots and paint records cover all ten entries in both themes at 1920x1080 and 390x844, plus vertical Work, transition midpoints and tall menus under tools/scratch/r38-shots/. The 404 light screenshots represent the restored implementation.

The corrected same-moment CSS capture preserves stylesheet cascade positions and passes strict 0-pixel dark identity on the homepage, Work and all seven project pages at both sizes. The 404 failed: nine h1 edge pixels differed by one colour level at 1920, including a separate original-HTML versus current-HTML capture. No tolerance was relaxed. Three distinct site fixes were tried: (1) restore original font smoothing; (2) restore original overflow and text-size adjustment; (3) extract only the shared palette and disable the otherwise unrelated base stylesheet on the standalone 404. All three retained the nine-pixel difference. Computed layout/font/foreground values matched in diagnostics; the remaining raster difference was not resolved.

Anh accepted the 404 difference on 2026-10-11: exactly nine edge pixels, maximum one colour level. The original shared-theme implementation is restored, including the base stylesheet. This is a documented exception; the strict capture assertion remains unchanged. All other default-dark identity captures remain zero pixels.

R37's strict animated rest/return capture limitations remain recorded in R37-validation.md; this preview does not claim those tests passed.

## Changed files and commits

R38 source: index.html, 404.html, work/index.html, work/bitis09.html, work/duhat.html, work/forbes.html, work/nam-long.html, work/similac.html, work/sulwhasoo.html, work/tcb-priority.html; src/styles/base.css, work.css, project.css, tall.css, tall-project.css; src/effects/project-transition.js, src/project.js, src/work/v2-ui.js (JS-written DOM/canvas text colour only). Documentation: docs/requests.md (heading only), docs/status.md, this note.

R37 source / docs: src/effects/bulge-gl.js, src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/util/ease.js, src/work.js, src/work/tune.js, docs/requests.md, docs/status.md, docs/codex/R37-validation.md. Task 0 also added docs/codex/R37-R38.md and preserved the original user changes to docs/requests.md and src/timeline.js.

Ignored new helper files / output are confined to tools/scratch/: r37-check.mjs, r37-behavior.mjs, r37-actual.mjs, r37-extra.mjs, r37-diagnose.mjs, r37-identity.mjs, r37-rest-control.mjs, r37-perf.mjs, r37-back-handoff.mjs, r37-cycles.mjs, r37-fallbacks.mjs, before-work.js, before-timeline.js, before-effects-project-transition.js, gsap-access.js, r38-baseline.mjs, r38-behavior.mjs, r38-check.mjs, r38-modes.mjs, r38-404-identity.mjs, r38-live-ink.mjs, r38-404-diagnose.mjs; r38-before-* snapshots and r37-shots/ / r38-shots/ generated PNG/JSON output. No packages, original media, layout data, live cache, archives or outside folders were modified.

Commits so far: 94720ec (Task 0, before safeguards); d70a925, 0d22bc3, 064fe32, a393a52 (R37 WIP); ee0e9b6 (R37 final); ca45893 (R38 WIP). Additional checkpoint: c42b62e (R38 validation notes). Stop commit message: `WIP R38: stop after three failed 404 identity fixes; preserve original 404`. Final R38 completion follows this checkpoint. Pushed: eac8ff8 (all prior branch commits).
