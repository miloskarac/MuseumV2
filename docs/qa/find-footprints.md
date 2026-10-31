# Finds under multiple dirt tiles

The subsequent [depth update](depth-progression.md) adds vertical layers to later pits. The footprints below remain unchanged; two shovel hits are required per tile **layer**.

2026-10-19. Both pits now give each find a rectangular, non-overlapping footprint. Tails span four tiles in a line; ribs, limbs and the trilobite slab span 2 × 2 tiles. Dimetrodon's skull spans 2 × 1, its sail/spine 2 × 3; Eryops's skull spans 2 × 2 and its spine 3 × 1. Sizes serve readability, not scientific scale.

The shallow fossil silhouette fits the complete footprint without stretching, turning by a quarter turn when that better fits a tall area. Clearing a tile reveals the section below it while opaque neighboring soil hides the remaining sections. The fossil stays in place until collected. Cleaning becomes available and automatically opens on the final covering tile. Two hits per tile, interruption, full-tray brushing, explicit bag action, assembly and end-of-site cleanup remain as before. Finds sit one tile inside the boundary so the pit walls do not hide their edges.

## Save contract

Schema **11** keeps the existing fields and storage key. Cell IDs, pit dimensions, part IDs and discovery IDs remain stable; their assignments to finds change. Schemas 1–10 are validated using their historical layouts before conversion. Every already uncovered find receives cleared tiles across its expanded footprint, even if brushing had not started. Cleaning masks, collected/placed IDs and closure flags are retained. Existing earth progress never decreases; some old partially dug tiles can become fully cleared when they overlap an already uncovered find's new area. Other partial tiles remain exact. No discovery is newly collected by conversion, and reloading schema 11 does not repeat conversion. Reset starts all finds buried.

## Visual evidence and checks

Microsoft Edge 155.0.4283.62, 1440 × 1000, disposable QA context. Luka's browser save was not accessed.

| Pit | Before | After | Partly uncovered |
| --- | --- | --- | --- |
| Dimetrodon and trilobite | [Before](find-footprints-before-courtyard-dig.png) | [After](find-footprints-after-courtyard-dig.png) | [Partial](find-footprints-partial-courtyard-dig.png) |
| Eryops | [Before](find-footprints-before-eryops-dig.png) | [After](find-footprints-after-eryops-dig.png) | [Partial](find-footprints-partial-eryops-dig.png) |

`npm test`: 59 tests pass, including all-footprint final-tile gating, interruption/reload, premature brushing/collection, exactly-once collection, schema-10 conversion for every find and recovery stage, invalid-save rejection, reset and existing completion tests.

`npm run build`: passed with the existing large-chunk warning.

The focused browser helper is `scripts/check-find-footprints.mjs <playwright index.mjs> <Vite URL> after`. It checks mesh bounds, partial exposure, and real keyboard/pointer digging, cleaning, collection and reload for both tails, Dimetrodon's ribs and the slab. Earlier historical journey helpers assumed single-column, single-tile finds; this helper covers the new excavation layout.

Visual inspection should confirm partial bones remain recognizable at gameplay scale. Luka's playtest remains useful for judging whether the extra digging feels right.

## Changed files

- `src/content/journey.ts`: historical layouts and current footprints.
- `src/presentation/discovery.ts`: footprint-sized models and progressive exposure.
- `src/game/journey.ts`, `src/persistence/save.ts`: schema 11 and validated conversion.
- Focused tests, existing fixture updates, the browser helper and screenshots.
- `docs/decisions.md` and this QA record.
