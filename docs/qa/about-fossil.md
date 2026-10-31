# Optional completed-exhibit stories — 2026-10-22

Stepping onto a completed exhibit's green circle now reveals **О фосилу** near the bottom center of the game view. Walking continues without opening a window. Clicking the button, or focusing it and pressing Enter, opens that exhibit's illustrated story. Leaving the circle hides the button. Closing the story while still on the circle makes the button available again without reopening the story automatically.

This applies to Dimetrodon, Eryops and the trilobite. The button is hidden while another panel is open. Empty/partial exhibits retain automatic assembly on entry and the existing leave/re-enter guard after closing. Placing the final part still reveals the completed story. Explicit clicks on the floor circles remain supported. Saved progress and schema 12 are unchanged.

## Files changed

- `src/app/prototype.ts`: completed circles offer the story instead of opening automatically.
- `src/ui/journey.ts`: contextual button, correct exhibit selection and panel/disposal handling.
- `src/content/exhibit.ts`: Serbian Cyrillic button text.
- `src/style.css`: readable 48px-minimum button, clear of the reset control.
- `scripts/check-about-fossil.mjs`: real-keyboard navigation to all three circles, optional story interactions, responsive screenshots and save invariance.
- `scripts/check-exhibit-marker.mjs`: updated completed-circle expectation and corrected the old closed-site fixture to include the required trilobite recovery.
- `docs/decisions.md`, this report and screenshots.

## Verification

- `npm test`: **76 passed**.
- `npm run build`: **passed**; existing large-chunk warning remains.
- `node scripts/check-about-fossil.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5177/`: **passed**. All three cards match their circles; waiting, closing and re-entering never auto-open a completed story. Mouse/keyboard activation, leaving, bag interruption, reload, final placement, reset and unchanged saves checked.
- `node scripts/check-exhibit-marker.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5177/`: **passed**. Preserves marker colors, explicit click/keyboard access, automatic unfinished assembly, six-part placement, completion and reset behavior.
- Disposable **Edge 155.0.4283.62** profile at **1440 × 1000**, **1280 × 720** and **390 × 844**. Visually inspected desktop/mobile screenshots. The button fits within the game view and does not overlap reset. No browser errors; Luka's save was not accessed.
- The all-exhibit test initially walked diagonally into the bench. Added shorter test-route waypoints; no navigation/gameplay change was needed.

The supplied screenshot shows the original circle whose automatic popup prompted this change. Updated views:

- [Dimetrodon button](about-fossil-dimetrodon.png)
- [Trilobite button](about-fossil-trilobite.png)
- [Eryops button](about-fossil-eryops.png)
- [1280 × 720](about-fossil-1280x720.png)
- [390 × 844](about-fossil-390x844.png)
