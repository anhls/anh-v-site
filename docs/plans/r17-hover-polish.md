# R17 (draft; into requests.md after R16 is committed; Sonnet 5.5): hover polish — card wobble, card hover (dark layer + enlarge), hero caption hover

From Anh (2026-10-02), testing R13g while R16 runs.

1. Wobble when the cursor sits ON a card. Likely cause (verify): the push is computed from the card's CURRENT (already pushed) position: the card moves away, the pointer is now somewhere else on/near it, the direction (pointer -> card centre) swings and the distance (to the card edge, 0 inside the card) flips, so it oscillates. Fix:
   - compute the push from each card's position WITHOUT its own push (base + aura + drift + lag), so the push cannot feed back into itself;
   - the HOVERED card (pointer inside it) is exempt from the push: its push eases to 0 and it responds with the hover effect (item 2) instead; neighbours are still pushed;
   - inside-card / edge cases must be continuous (no direction flips): e.g. smooth the direction, or fade strength in from the card edge.
   Prove it: pointer parked on a card centre, on its edge and moving slowly across it, at the 6 target screens: card offset must settle (no oscillation; report max swing over 2 s).
2. Card hover like live (measure live first): some cards have a dark layer that fades away on mouseover (cards.json item "ImageGalleryItem2 (dark bg frame)" is the likely set: confirm), and every card scales up slightly on mouseover. Match live's darkness, scale, timing/spring, and which cards have the dark layer. Hit-test from the cached card rects in the existing loop (cards keep pointer-events off; no DOM reads in the loop). Must work in BOTH renderers: the R16 WebGL cards (darkness + scale as shader/plane values) and the DOM fallback. Topmost card under the pointer wins when cards overlap. Off on touch / reduced motion (no dark layer then, or keep it static: follow live).
3. Hero caption hover (measure live first):
   - live animates the caption TEXT on mouseover (not only the image that follows): reproduce that text animation (likely a letter roll / slide like the nav and More Projects names; confirm on live).
   - the caption image currently pops in (0.15 s fade, not measured). Make it appear smoothly: measure live's in/out; then an eased reveal (opacity + slight scale or a clip/mask reveal from the cursor side, ~0.3-0.4 s), a smooth hide, and a crossfade (not a hard swap) when moving from one caption to the next. Values on ?tune (reveal duration, scale, offset spring) and in Copy values.
4. Checks: the 6 target screens; frame time while hovering cards and sweeping captions (also vs 8.3 ms for 120 Hz MacBooks); compare unchanged.
