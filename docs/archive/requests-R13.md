## R13 (DONE 2026-10-01): More Projects fix + Selected Work step 1 (use Sonnet 5.5)
0. [done] More Projects (Anh, after R12): restore live's list of 5 names (put Bitis Season 09 back as the last name; remove the "See more work" entry). The small text on the RIGHT (now "2025") becomes "See more work", linking to /work/, with the same dot-to-line hover as the footer link. Left label stays "More Projects".
1. Measure live first (1920x1080 and 2560x1440; use the compare live cache / --refresh-live), then match it: card positions and sizes, how each layer moves with scroll and with the mouse, the parting around the frame (amount, scroll range, easing), and which cards ignore the mouse. Before building, propose how cards follow the scale.js rule at 2560 (cards are media: likely sizes/positions scale, motion distances capped; confirm against live).
2. Build per docs/plans/selected-work-section.md step 1: one element per card, one shared loop (reuse effects/pointer.js from R12), all effects summed into ONE transform per card per frame:
   - depth parallax from cards.json: layer parallaxDistance back 20, layer1 25, layer2 50, layer3 75, layer4 100 (card 11 has parallax disabled);
   - parting around the frame, matched to live;
   - mouse push, matched to live; the 8 "BackImageNoReact" cards (ids 2, 3, 4, 15, 19, 23, 24, 32) ignore the mouse;
   - elastic lag (NEW, not on live): each card chases its scroll target with a delay tied to depth (deep = heavier); modest defaults. Built on Lenis, no ScrollSmoother.
   Read positions once (load/resize), write only transforms in the loop (CLAUDE.md rule 4).
3. Card images: map each card id to its live image (cards.json has none). Use the local file in ../_site-media/archive when sources.tsv matches that live URL, else the live URL. Copy used files into the repo without converting; the 3 GIFs stay GIFs until media optimisation. Fill data.json selectedWorkCards.
4. Tuning panel, dev only (opens with ?tune in the URL, never in the production build): sliders for lag strength, depth range, parting strength, mouse radius and mouse strength, live-updating. A "copy values" button copies the current settings as JSON so Anh can send them; defaults live in timeline.js.
5. Fallback: on touch devices and with prefers-reduced-motion, no mouse push and no lag.
6. Checks: add compare probes for a few cards (one per layer) at settled scroll points (mouse parked off-screen), full compare at 1920x1080 and 2560x1440, tuning mode while iterating. Check lag and mouse motion in the browser by script; report what compare can't cover.
