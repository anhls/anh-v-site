# Requests (from Cowork / Anh to Claude Code)

Only open and upcoming work lives here. Finished requests move to docs/archive/ (R1-R10: archive/requests-R1-R10.md, R11: archive/requests-R11.md, R11b: archive/requests-R11b.md, R11c: archive/requests-R11c.md, R12: archive/requests-R12.md).

## Later: Selected Work section (was "archive")
Plan agreed with Anh: docs/plans/selected-work-section.md (step 1 DOM motion + tuning panel, step 2 WebGL edge bend). Turn into requests after R12.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Later (not yet): media optimisation (see HANDOFF "Media checklist")
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
