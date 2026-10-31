# Remove excavation progress card

2026-10-22. Removed the excavation percentage, progress bar and instruction card. The outdoor site-information card remains. A standalone cleaning button appears only when a revealed fossil can be cleaned, so closing the cleaning dialog does not lose access to it.

Changed `src/ui/journey.ts`, `src/style.css` and `docs/decisions.md`; added `scripts/check-excavation-hud.mjs` and these screenshots. Gameplay and save format are unchanged.

- `npm test`: 78/78 passed.
- `npm run build`: passed with the existing bundle-size warning.
- `scripts/check-excavation-hud.mjs`: before/after checks passed in disposable Edge 155.0.4283.62 at 1280 x 800 and 390 x 844. Verified no excavation card, cleaning opens and reopens on both viewport sizes, and outdoor information remains. No browser errors. Luka's save was untouched.
- Visually inspected desktop removal and mobile cleaning-button placement.

[Before](excavation-hud-before.png) · [After](excavation-hud-after.png) · [Cleaning button on mobile](excavation-hud-after-clean.png)
