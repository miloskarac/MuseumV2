# Progressive excavation depth

The later [whole-layer correction](layer-order.md) requires clearing every tile in a layer before digging deeper, and restores the first pit's camera for all sites. It supersedes the camera adjustment and independent descent described in this original QA record.

2026-10-19. `EXCAVATION_DEPTH` and `siteDimensions` in `src/content/journey.ts` define the progression: **1, 2, 3, 4… layers**, adding one per sequential site. Every layer remains 0.7 world units tall and takes two shovel contacts. Horizontal dimensions stay 8 × 8. The first pit keeps its original depth, shovel timing, camera and discovery flow. Eryops's second pit is now two layers deep. The third plot advertises three layers but remains unavailable; no content or unlock prerequisite was added.

## Soil and movement

`soilColorIndex` maps layers 1–2 to the first color, 3–4 to the second, 5–6 to the third and 7–8 to the fourth. Further depths repeat the palette in complete pairs. Odd-depth pits end with a half-band; the tutorial's one layer is the first half of its first band.

Each remaining cube layer has its own mesh and fixed material, so removing a top layer never repaints the soil below it. Pit walls use the same two-layer band mapping and exact vertical boundaries. Shovel clods use the struck layer's color. The darker exposed bed remains a non-diggable backing for ivory fossils, not another soil band. Cleanup animates all remaining cubes in one column together before committing that column's removal.

Fossil footprints stay unchanged and sit at the site's configured floor. Cleaning still waits until all layers of every covering column are removed. Ground support follows remaining soil surfaces; taller ladders span the complete depth. Digging reaches one layer up or down, including its first-hit dent. A substantially deeper hole requires walking to lower footing instead of stretching the character's arms from the rim. Walkable soil retains forgiving movement, with no new controls or penalties.

Deeper pits use a steeper fixed camera angle to keep foreground terrain from hiding bones. The first pit's camera and screen-relative movement axes are unchanged.

## Save compatibility

Schema **11** and the localStorage key are unchanged. `dig[cellId]` already stores a normalized fraction of an entire column, independent of its layer count. Existing percentages remain exact: a half-cleared second-site column restores at 50%, now one of its two layers removed. The next hit advances to 75%. A cleared column stays at 100%, so uncovered, partly cleaned, collected and placed finds are never reburied. Closed sites remain closed. No reset or additional migration is needed. Existing schema-1–10 validation and migration remain intact.

## Verification

- `npm test`: **64/64 passed**. New coverage includes strictly increasing depth, unchanged first-site dimensions and unlock gates, two-layer color mapping and palette rollover, all-layer fossil reveal at depths 2/3/5, surface height, lower footing, ladder traversal, schema-11 partial progress and completed-site compatibility. Existing tests exercise cleanup/reload, duplicate collection, earlier migrations and reset.
- `npm run build`: **passed**, with the existing large-chunk warning.
- `scripts/check-depth-progression.mjs`: **passed** in disposable Microsoft Edge **155.0.4283.62**, **1440 × 1000**. Real keyboard/pointer input descends to the second pit's floor, completes four shovel contacts on each of the tail's four tiles, reloads a first-hit checkpoint, brushes and bags the tail once, reloads cleanup, and returns up the ladder before closure. A five-layer fixture uses the production geometry builders and checks each hit's top surface, visible layer count, material and wall-band height, plus ladder length.
- `scripts/check-digging.mjs`: **passed**. The first pit retains two visible shovel contacts, planted feet, matching blade contact heights and material through both hits. Its updated two-layer fixture uses the same band color. Existing framing checks pass at 1280 × 720, 768 × 1024 and 390 × 844.

All browser checks use disposable contexts. Luka's real browser profile/save was not accessed. Screenshot inspection confirmed readable floor fossils in the deeper second pit after adjusting its camera. The five-layer view is a rendering fixture, not a newly playable site. Luka's playtest remains the check for whether the longer excavation feels enjoyable.

| View | Evidence |
| --- | --- |
| Second-pit depth | [Before](depth-before-floor.png) · [After](depth-after-floor.png) |
| Excavated terraces | [Before](depth-before-terraces.png) · [After](depth-after-terraces.png) |
| Walking on the lower floor | [Player at depth](depth-after-player-on-floor.png) |
| Two-layer bands across five layers | [Rendering fixture](depth-after-five-layer-bands.png) |
| Completed return | [Closed site](depth-after-closed.png) |

## Files changed

- `src/content/journey.ts`: shared progression configuration and color mapping; current-site generation uses each site's sequential index; historical save layouts remain fixed.
- `src/game/journey.ts`: normalized-save contract comment and depth-aware digging reach.
- `src/presentation/discovery.ts`: stacked cube layers and coherent cleanup animation.
- `src/presentation/excavation.ts`: matching wall bands and full-depth ladder rungs.
- `src/presentation/dig-animation.ts`: soil clod color from the struck band.
- `src/presentation/world.ts`: deeper-pit camera framing.
- `tests/depth-progression.test.ts`, `tests/grid.test.ts`, `tests/eryops.test.ts`, `tests/find-footprints.test.ts`: depth and compatibility coverage.
- `scripts/check-depth-progression.mjs`, `scripts/check-digging.mjs`: browser checks and screenshots.
- Decisions, historical-document pointers and this QA record. No dependencies added.
