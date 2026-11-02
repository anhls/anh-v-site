# R37e option B — review WIP, 2026-10-11

Option B is implemented and pushed for review, but **R37e remains WIP**. The motion gate does not pass, so neither R37e nor superseded R37d is marked done. R39 has not started. Stop for Anh's eye review under AGENTS.md's visual gate ("Partly" is never done) and the repeated-fix boundary; no checks were weakened.

## Decisions and questions resolved

1. Wall-clock Date.now survives the document change; a single pure zoom function drives both sides. Never restart the tail on arrival.
2. Anh requested image coverage at every edge. A resting header crop underlies the moving crop, with a feathered inner edge rather than an exposed background rim.
3. Anh confirmed preserving Duhat's shorter video header. Its still-to-video reveal is checked separately, rather than changing that page's resting design.
4. Start numbers were a fit, not targets: the original 3% zoom with a strong lens could still reverse optical motion. Final fit is a 10% zoom and gentler lens.
5. The fair motion test removes duplicate reference frames only. Both raw paint timestamps and uniform60Hz sampling are retained for ours; failed results remain reported. Authenticated Cloudflare testing requires Anh's login.

## What changed

`flight-curve.js` defines the cubic monotonic zoom. Its first-paint copies in all seven HTML heads are checked verbatim after line-ending normalization, and numerically at60/144Hz. Work records t0, land, tail, zStart, responsive-image metadata and a wordmark snapshot in pxt.flight. Navigation starts when the returning lens displaces an edge by less than1 device pixel, while zoom continues drawing until pagehide.

Flight records paint the project overlay before blocking stylesheets. Legacy/home records still paint at their original body-script point and do not start a flight. Paths accept /work/slug, /work/slug.html and trailing slash. work/index.html had no equivalent slug.html comparison to change; other path comparisons were searched.

The project overlay continues the same wall clock. Once the header is decoded and remaining zoom displacement is below1 device pixel, it blends into the actual header during the final settle. This avoids Chrome rasterizing the two layers differently even with matching image and crop. Overlay removal waits for the curve and decoding; late decode holds the end pose and reveals gently. Direct pages never enter this branch.

The reverse samples the trajectory backwards, using a separately tunable0.3s zoom-out before shrink. Existing interruption and cleanup behavior remains. Tune controls expose zoom start, forward tail, reverse tail, lens timing/strength and size carry; obsolete zoom-pulse/rebound-duration controls were removed.

## Values versus starting choices

| Control | Starting | Review fit |
|---|---:|---:|
| Full-screen crossing |0.51s|0.51s|
| Size carry |0.8|0.8|
| Zoom at full-screen crossing |0.97|0.90|
| Forward zoom tail |about0.6s|0.65s|
| Forward total |about1.11s|1.16s|
| Lens multiplier |0.6|0.1|
| Lens duration |0.22s|0.22s|
| Reverse zoom tail |same as forward initially|0.3s|
| Reverse total |1.16s initially|0.81s|
| Outward bow / peak / end |0.13 /0.25 /0.7|unchanged|
| Corners |0.08|unchanged|

## Preparation and measured fixes

Centered image prepares on idle after the strip settles (initial delay1.8s, retry while dragging/snapping/coasting). Hover can replace it. Keep only one prepared renderer; leave expires after2s, wheel/drag/different hover/pagehide dispose it. Touch/tall do not prepare.

Texture upload is capped to viewport/DPR size and sliced into64-row pieces. The initial full resized ImageBitmap copy blocked the main thread for19.5ms. Three preparation changes were measured: wait for strip settle, poll parallel shader compilation instead of blocking, then resize each slice instead of first copying the whole bitmap. Final native real-speed idle14.0ms, hover14.1ms; 4x stress41.8/41.7ms. The stress result is reported, not hidden or treated as the normal-speed target.

Real recording also exposed a separate crop bug: srcset's density-corrected naturalWidth was being used as raw bitmap crop coordinates. Preparation now decodes the selected currentSrc URL as a plain image before slicing, preserving the selected file but using its actual pixel dimensions. The visible page-change jump dropped from roughly12.5 MAD to around0.9–1.3 in the affected captured pair. Earlier captures before this correction are superseded.

Warm native first5 frame intervals: 5.8,6.8,7.1,6.9,6.9ms; handler1.2ms. At4x: 2.1,6.8,13.9,6.9,7.0ms; handler6.2ms. First frame is under20ms in these runs. Cold fallback still constructs synchronously; no claim that an unwarmed click meets that target.

## Motion gate — fails; stop for review

Three continuity changes are saved: the monotonic cross-page curve, stronger forward zoom with gentler lens/shorter return, and correction of the prepared texture's raw pixel crop. The visual jump improved, but the strict gate still fails.

The browser still has a document-commit paint gap: about42.6ms in native timing,48.1ms at simulated60Hz and48.5ms at simulated144Hz. At native144Hz output sampled60Hz, the preceding image repeats at0.750 and0.767s during navigation. Zoom resumes at its current clock pose, but this does not prove no stall. At4x the gap and new-page startup are worse. This is a site result, not marked unverified or excused as a helper failure.

Reference5.80–6.80s: 61 samples reduce to31 distinct frames (30 duplicates removed), peak MAD22.1282; lowest normalized interior valley0.20129. Frozen open's lowest interior sample ratio0.00117; frozen return0.01392. The strict reference-relative comparison fails, including tiny end/initial-acceleration fluctuations. Raw production and sampled60 curves also fail. No threshold was substituted. `motion-gate.json` preserves failures and identical-frame locations.

Caveat: uniform60 resampling of a separately timer-paced60Hz producer can alias its frame phase and repeat frames away from navigation. Raw paint timestamps are preserved separately; those synthetic repeats are not all asserted to be site stalls. The native and144Hz document-commit gaps remain independently measured.

Simulated60/144Hz both follow the same1.16s wall-clock curve. At arrival, expected/painted scales were0.985434/0.985434 (60) and0.984521/0.984388 (144, less than one frame's delay). First5 intervals:60Hz11.0/16.2/16.8/18.0/17.3ms;144Hz5/8/6/7/7ms. Idle/hover maxima20.5/18.1ms at60,13.5/11.6ms at144. These verify time dependence; they do not override the failed stall test.

## Visual gate — inspected final dark/light sheets, open and return

Open looks like the reference: partly.
Biggest visible difference: our inward bend is gentler, and real navigation still briefly holds the preceding paint before continuing the zoom.
What would close it: remove the document-commit hold and fit the remaining speed dips against the deduplicated reference; do not hide the failed gate.

Return looks like the reference: partly.
Biggest visible difference: our zoom-out and shrink have different speed proportions from the reference, despite the shorter return tail.
What would close it: fit the reverse speed curve after Anh's review, retaining covered edges and the exact card landing.

Sheets align the full-screen and shrink phases to reference times; they do not pretend the reference and site have identical total durations. Frozen sheets establish shape; real production captures cover the document change.

## Passing checks and limits

- Build passes. Cached compare542/542, zero mismatches at1920x1080 and2560x1440.
- Homepage open:3 points at each size, zero changed pixels. No flight for old/home records.
- All7 direct-link resting pages: zero changed pixels against original project.js response. Duhat's video is paused at the same timestamp on both sides; an earlier uncontrolled screenshot differed because its video advanced.
- Six still-header composited endpoints, both sizes/DPR1/2: max0 atDPR1; at most1 colour level, fewer than0.0047% pixels atDPR2 (invisible). This is the composite at final removal after the subpixel blend, not a claim that independently rasterized raw layers are identical.
- gl=0, reduced motion, unavailable GL, prepared context loss, mid-flight loss, double click and wheel interruption pass; zero console/page errors.
-20 open/back cycles and20 hover cycles leave zero transition canvases, contexts and textures; leave expiry checked.
- Fast3G plus a deliberately delayed header decode: overlay remains atscale1 until decode, then removes. Back/forward history: zero stale overlay. Duhat retains its863.3px video header at1920 width and reveals the video.
- Private preview redirects to Cloudflare Access; authenticated hosted check is unverified (login required). Local production server verifies the .html→extensionless redirect. No settings or credentials changed.
- Earlier R37 whole-page Work rest/return identity remains unverified (script issue); cached comparisons and project-page identity do not replace it. Accepted R38 404 difference stays9 edge pixels, max1 level; 404 unchanged here.

## Commits and files

Branch codex/r37-r38. Planning36e1652; WIPa4c412c (shared flight/preparation); WIPfb361c5 (fit, first paint, texture correction). Pushed:fb361c5, including both earlier commits. Final review evidence commit uses message `WIP R37e: record review evidence and remaining motion failures`; pushed immediately after commit.

Every tracked file changed: docs/requests.md, docs/codex/R37e.md (planning); src/effects/flight-curve.js (new), src/effects/bulge-gl.js, src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/work.js, src/work/tune.js, src/project.js; work/bitis09.html, work/similac.html, work/duhat.html, work/nam-long.html, work/forbes.html, work/sulwhasoo.html, work/tcb-priority.html; docs/status.md, docs/codex/R37e-notes.md. Requests remain open because the gate fails.

Own ignored reproducible helpers: tools/scratch/r37e-check.mjs, r37e-before-project.js (baseline fixture), r37e-capture.mjs, r37e-motion.mjs, r37e-runtime.mjs, r37e-endpoint.mjs, r37e-navigation.mjs, r37e-server.mjs. Throwaway baseline/profile/diff/variant helpers removed. Output tools/scratch/r37e-shots/: checks.json, navigation.json, endpoints.json, actual.json, motion.csv, motion.png, motion-summary.json, motion-gate.json; direct-page before/after PNGs; dark/light open/back frames and reference sheets; real/production/production-60/production-144 frame PNGs and runtime JSON. Reused prior homepage/behavior/fallback/cycle/hover-audit helpers; their ignored reports live in r37-shots/, r37b-shots/ and r37d-shots/. Reference extraction reused r37d-ref/, r37c-ref/ and r37b-ref/.

Exact command to stop using everything on this branch: `git switch work-v2`.
