# R44 notes (lite, Claude Code, lite/r44-project-page)
Anh (mid-task): skip Nam Long and Duhat for now -> data.json page.phone.skip = true on both: they keep the earlier layout (16 and 8 swipe rows as before); only the scroll effects below reach them.

## Built
- project-page-tall.js: stack by default; swipe set = 3+ consecutive media within 10 % aspect (count "1 / N" via an IntersectionObserver inside the row); stage -> compositions (overlap groups, lengths in u / v / % / calc parsed, bbox clipped to the stage, text lifted out, >3:1 stacked); small pictures (< 45 % of the desktop width) keep margins; hints block.phone {mode, hide}.
- Effects (CSS transitions, once per block, IntersectionObserver): lead / headings line by line (words tagged with their line on enter), pictures mask-open + scale 1.06 -> 1, Similac grow strip, body text / sets / details a plain fade. Reduced motion: final state.
- Hero: bitis09 phone crop = a generated portrait picture (tools/r44-hero-phone.mjs: the poster at full width on its own blurred, darkened picture), data.json hero.phone.ref + manifest entry (hand-added: tools/media.mjs does not know it; re-running it may drop the entry). core.js: item.hdr / headerRef feeds the open flight, preload and in-place open; the strip frame keeps the landscape picture.
- Not built: hero focal point {x, y} (needs a shader change in the flight; only the ref form exists); splitting a too-wide stage into two compositions (it is stacked); before / after contact sheets (after only: tools/scratch/r44).

## Counts (swipe rows, 390 wide) before -> after
Duhat 16 -> 16 (skipped), Nam Long skipped, Bitis 0 sets, TCB Priority 2, Sulwhasoo 0 (5 compositions), Similac 1, Forbes 0.

## Checks (Chromium)
compare 542/542 x2; R41 restore 12/12 and gesture suites pass; 6x CPU scroll of a project page: no frame over 33 ms from the reveals (max 27.8 ms Sulwhasoo, 34.8 Bitis; body text as per-word reveal cost 14 ms median, so body text only fades); 0 page errors on all 7 pages at 390 and 3 at 768. Not run: R41 clicks / matrix, a hero-landing pixel match for Bitis (open flight onto the portrait crop looked right in the page; the flight itself not frame-compared), Cloudflare preview.
