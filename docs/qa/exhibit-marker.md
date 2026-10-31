# Exhibit floor circles — 2026-10-18

Removed the floating exhibit card in all three states. A floor ring uses the exit marker's diameter and thickness, in the clear walkway in front of the stand. Blue means no placed bones (even if bones are in the bag), yellow means partial assembly, and green means complete.

Walking onto the circle opens assembly or the completed story. Closing it does not reopen it until the player leaves and returns. Clicking the circle and keyboard activation are also supported through a transparent, Serbian-labelled button aligned with the floor ring. Assembly, stories, inventory and the save format are preserved.

## Files

- `src/presentation/world.ts`: floor ring, state colors, projected interaction bounds.
- `src/game/navigation.ts`: marker location and radius.
- `src/app/prototype.ts`: walk-on interaction and re-entry guard.
- `src/ui/hud.ts`, `src/ui/journey.ts`, `src/style.css`, `src/content/exhibit.ts`: remove floating card, retain accessible activation and add a short approach instruction.
- `scripts/check-exhibit-marker.mjs`: color, reload, interaction, placement, reset and responsive browser checks.
- `scripts/check-browser.mjs`, `scripts/check-journey.mjs`: replace obsolete floating-card assertions.
- `docs/decisions.md`: record the requested color rules and presentation change.

## Validation and screenshots

- `npm test`: 42/42 passed.
- `npm run build`: passed; existing large-bundle advisory remains.
- `node scripts/check-exhibit-marker.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5176/`: passed. Checks rendered material colors, reload in each state, click/keyboard activation, walking on/off, no automatic reopening on close, all six live placements, completed-story entry, reset and responsive marker bounds.
- `node scripts/check-browser.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5176/ docs/qa/exhibit-navigation`: passed. Existing movement, blur, collisions, pit traversal, room round trip, safe arrivals and responsive checks at 1280 × 720, 768 × 1024 and 390 × 844; no browser errors.
- Browser: Microsoft Edge 154.0.4258.53, isolated temporary profiles. Visually inspected the captured game at 1280 × 720 (all three states) and 390 × 844. This was browser-driven interaction and screenshot review, not a Luka playtest.

Before: [existing completed museum screenshot, 1440 × 1000](assembly-v1-museum-complete.png).

After at 1280 × 720: [empty / blue](exhibit-marker-after-empty.png), [partial / yellow](exhibit-marker-after-partial.png), [complete / green](exhibit-marker-after-complete.png). [Narrow viewport, 390 × 844](exhibit-marker-after-empty-390.png).

No changes to Luka's browser profile or save. The museum remains small at phone width under the existing camera framing; walking onto the ring avoids relying on a small click target. No balance, reward, content or save-schema changes.
