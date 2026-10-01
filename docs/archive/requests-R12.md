# R12 (archived)

## R12 [done 2026-10-01]: More Projects (was "clients") + footer
Naming (Anh, internal only: code, docs, requests; not shown on the page): the hero + project index (PRJ-01/02/03) = a few recent works; "archive" is now **Selected Work** (most impressive work); "clients" is now **More Projects** (recent, less headline work, ending in a link to the Works page).
1. Rename in code and docs: clients -> `more-projects` (section, classes, data.json key `clients` -> `moreProjects`); archive -> `selected-work` (placeholder section, id/nav target, cards.json references, docs/plans/archive-section.md). Keep the `projects` data key as it is (project pages). Nav "Works" keeps pointing at the Selected Work section until the Works page exists.
2. Layout: match live (590-730vh, sticky 100vh block, over the darkening full-screen image). Left label text reads "More Projects" (live says "Client"); "2025" stays at the right. Follow the scale.js cap rule.
3. Entries: the current names from data.json, each linking to its project page. Add a LAST entry "See more work" linking to /work (placeholder until the Works page exists; a simple placeholder page is fine).
4. Motion: first check on live whether the names roll in one at a time (like the project index: letter roll in, slide up out, scrubbed) or show as a list, and match live. Hover (motion-spec section 8): hovering a name turns the others grey (spring, bounce 0.2 / 0.4s); each name has its own image following the cursor (+200px x, +20px y, right of cursor, centred, spring 500/60/1), on the shared pointer + rAF loop (CLAUDE.md rule 3), off on touch and reduced motion. "See more work" gets the grey-out but no image cursor. Images: use the live URLs as placeholders if the originals are not in ../_site-media.
5. Footer: 110vh, "Go Back To Top" link at the right with its line animation, big wordmark returning (already built). Match live.
6. Checks: add compare probes for the new section (live selectors from the current publish), run the full compare at 1920x1080 and 2560x1440, and use tuning mode while iterating.

