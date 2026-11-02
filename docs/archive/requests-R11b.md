# R11b (archived)

## R11b [done 2026-10-01]: large screens, scrollbar, float, About offset
Context: Anh's screen is 4K at 150% scaling, so the browser viewport is about 2560x1440. At that size our About text and AV wordmark are about 1.33x bigger than live (About wraps to 5 lines, live 4), the ABOUT arrow overlaps the label, and the mask float sits lower than live at the same scroll. The mask itself matches (vw/vh on both). Cause: our sizes scale with vw past 1920 (e.g. --about-size clamp(2.5rem, 3.333vw, 6rem)) while live appears to stop growing; the label is capped at 1rem but the arrow's position scales with --about-size, so they collide. compare.mjs only tests 1920x1080, so this never showed.
1. Hide the scrollbar like live (live has custom code for this), so vw and layout widths match live.
2. compare.mjs: add --width/--height options (default 1920x1080). Run it at 1920x1080 AND 2560x1440 from now on; report both results.
3. Large-screen sizing: measure live at 2560x1440 (About text, ABOUT label + arrow, index titles/labels, AV wordmark, nav links, captions) and make ours follow the same rule (fixed px, capped, or scaling). Keep 1920 exactly as it is now. Position the label and arrow so they cannot overlap at any width.
4. Float: re-measure start/end and path at 2560x1440 against live and fix the ranges first. Then stiffen the float springs (floatOuter/floatInner in timeline.js) so the frame snaps like live (live reaches 29.4% centre ~93ms after a 125->165vh jump; ours ~520ms). Check at both sizes.
5. About offset: fix the remaining ~4.5vh at 15/30vh (R11 item 6).
6. Hero ending, decided by Anh: keep our fade to black. The live image vanishing at ~585vh is a bug, not a reference. Record this in docs/SESSION-BRIEF.md (Decisions) and motion-spec.md.
Log compare results at both sizes in status.md (8 lines max).

### Corrections after first attempt (Sonnet 4.6 session, stopped by Anh; nothing committed)
Start with `git diff`: the first attempt's changes are still uncommitted. Keep what is right, redo the rest. Don't guess values and revert: measure first, and log every measurement in status.md as you go so it survives context compaction.
- KEEP: hidden scrollbar (item 1), --width/--height in compare.mjs (item 2), font-size caps (about 64px, index 80px, labels 12px: matches live at 2560, where About text is ~64px), ABOUT arrow fix, hero-ending notes (item 6), revert of the 38.94vh about-top guess.
- REDO widths/positions: the comment "live forces viewport width=1920" is wrong. Anh's screenshot of live at 2560 shows the About text box still spanning ~93.75vw (text runs almost edge to edge) while the font stays 64px. So remove the min() caps on --about-w, and don't cap --about-x, --about-indent, --index-x, nav link top, or wordmark width until each is measured on live at 2560x1440. Some may scale, some may be fixed.
- FIX compare.mjs first: the live maskW/maskCtr selector ([data-framer-name=wrapper]...@1) now picks a full-screen element. Anh did NOT republish Framer, so this is not a Framer change: find what changed (e.g. the new viewport option, the hidden scrollbar, or the selector itself) and make it pick the mask again. Until then the float and mask can't be verified.
- FLOAT: revert floatOuter/floatInner to the R11 values (891/90/0.5 and 648/58/1). First measure float start/end and path at 2560x1440 against live and fix the ranges. Then tune the springs against measured live timing (up and back down separately; they should not be identical, the different weight is part of the feel). [10000, 250, 1] was calculated, not matched, and is near-rigid.
- Use your own dev server (check the port); an old one from another session may still be running on 5173.
- If the context compacts more than once, stop after the current item, log and commit it, and say so.

