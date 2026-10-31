# Excavation visual match — 2026-10-05

## Screenshot comparison

- [Excavation before](excavation-before-excavation.png)
- [Excavation after](excavation-match-excavation.png)
- [Museum, freshly captured](excavation-match-after.png)
- [Museum baseline](excavation-before-after.png)

All four use Microsoft Edge 154.0.4258.53, 1440 × 1000, DPR 1, the unchanged orthographic camera at `(12, 16, -16)` targeting `(0, 0, 0)`. Museum captures use the initial player position; excavation captures use the stationary arrival position. Before and after were captured from the development server in isolated temporary QA browser profiles. The two museum PNGs have identical SHA-256 hashes.

## Changes

- `src/presentation/world.ts`: excavation now shares the museum's background, daylight, shadow filtering, and cream/teal/brass/oak materials. Museum output is unchanged.
- `src/presentation/excavation.ts`: separate presentation builder with cream limestone flags, matching low perimeter banks, segmented stone pit coping, a floor opening, six uneven earth bands, cut-back shelves, recessed faceted soil, embedded gravel, loose clods, and scrape marks. A work plank, bucket, brush, survey pins/cord, and boundary-mounted digging tools identify the space as a dig site.
- `scripts/check-browser.mjs`: added pit-depth/floor-opening checks, equal-camera check, real-keyboard pit circuit and collision check, and excavation captures/label checks at three additional viewport sizes.
- This note and `excavation-before-*.png` / `excavation-match-*.png` record the comparison and browser evidence.

Raised excavation details fit inside the existing pit collider or beyond the existing walking boundary. Room dimensions, pit footprint, portal, camera, controls, movement speed, collision rules, UI, and gameplay are unchanged. No dependencies or online assets were added. This prototype still supports exploration and room travel only; the visual pass adds no digging or collection interaction.

## Verification

- `npm test`: all 7 tests passed.
- `npm run build`: passed after the final geometry changes. Existing large-bundle warning remains (main entry approximately 1.051 MB minified / 257 KB gzip).
- Expanded browser helper: passed movement, blur clearing, pit circuit, collision, depth/open floor, matching cameras, round trip, safe arrivals, label bounds, horizontal overflow, and no console/page errors.
- Both rooms checked at 1440 × 1000, 1280 × 720, 768 × 1024, and 390 × 844. Final desktop and narrow excavation screenshots were visually inspected. Clear paths, earth depth, and travel marker remain visible. Narrow portrait makes small tools difficult to distinguish under the existing room framing.

Browser QA used scripted real keyboard input and manual screenshot inspection, not a hands-on play session. Remaining human QA: brightness, frame rate, and child readability on Luka's actual monitor.

Reproduce with the existing read-only Playwright installation from V1:

```powershell
node scripts/check-browser.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5183/ docs/qa/excavation-match
```
