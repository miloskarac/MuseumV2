# Mixed fossil directions — 2026-10-19

This records the earlier interpretation of “vertical.” Miloš clarified on 2026-10-21 that bones should span soil depth; see [the current depth implementation](burial-depth.md).

The Dimetrodon tail now spans four rows in one column. Eryops's spine spans three rows in one column; its tail remains horizontal. The trilobite slab moves aside to keep every find's footprint separate. These are rotations on the pit floor. The covered area, layer order, camera, depth progression and site prerequisites are unchanged.

## Saved progress

Schema 12 retains tile IDs and normalized dig values. Schemas 1–10 still migrate from their historical layouts; schema 11 validates against the former multi-tile layout before conversion. Previously uncovered finds remain uncovered at their new location, including finds with no cleaning strokes yet. Migration may clear additional dirt to preserve that state. Cleaning masks, collected parts, placement and closed sites are retained without granting collection. Partial earth work stays at its original coordinates. Repeated loading does not repeat migration.

## Changed files

- `src/content/journey.ts`: mixed footprint directions and frozen schema-11 assignments.
- `src/game/journey.ts`: current save version 12.
- `src/persistence/save.ts`: validation and migration for the changed assignments.
- `tests/find-footprints.test.ts`: orientation, unchanged covered area, schema-11 partial/uncovered/cleaning/collected/placed/closed progress and invalid entitlements.
- `tests/depth-progression.test.ts`, `tests/grid.test.ts`, `tests/save.test.ts`, `tests/site-completion.test.ts`, `tests/whole-fossil.test.ts`: current-schema expectations and naming.
- `scripts/check-find-footprints.mjs`: mesh orientation checks, vertical spine digging/cleaning journey and labeled screenshots.
- `docs/decisions.md`, this report and six orientation screenshots.

## Checks

- `npm test`: 68 tests passed.
- `npm run build`: passed; existing large-chunk warning remains.
- Disposable Edge profile, 1440 × 1000. Inspected before/after screenshots for both pits. Rotated pieces are readable and separated from neighboring fossils. The existing deeper-pit foreground wall still obscures some nearby limb tips with the requested fixed camera.
- Browser script checks every mesh's bounds and the long pieces' orientation, partial reveal, and final-tile digging, cleaning, collection and reload for both tails, Eryops's vertical spine, first-pit ribs and the moved slab. No real player save is used.

| Pit | Before | After | Partial reveal |
| --- | --- | --- | --- |
| First | [Before](find-footprints-orientation-before-courtyard-dig.png) | [After](find-footprints-orientation-after-courtyard-dig.png) | [Partial](find-footprints-orientation-after-partial-courtyard-dig.png) |
| Second | [Before](find-footprints-orientation-before-eryops-dig.png) | [After](find-footprints-orientation-after-eryops-dig.png) | [Partial](find-footprints-orientation-after-partial-eryops-dig.png) |
