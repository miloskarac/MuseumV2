# Open front of the excavation pit

Follow-up: the [excavation angle](excavation-angle.md) now turns this view 8° toward the open front, with matching screen-relative controls.

2026-10-22. The camera-facing (-Z) wall, coping and foreground ground apron are removed. The three remaining sides, original camera and ladder stay in place. Thin seams on the exposed soil face distinguish individual layers, including adjacent layers in the same color band. Seams follow their soil tiles during digging and cleanup.

The outside walking boundary now ends at the cutaway, preventing the player from walking over the removed apron. The pit's existing movement barrier remains, so the open view is not another entrance. Both side paths and the rear ladder route remain accessible. Digging rules, soil quantities, progression and saved state are unchanged; player position is not persisted.

## Visual check

Disposable Microsoft Edge 155.0.4283.62 profile. Checked 1440 x 1000, 1280 x 720 and 390 x 844. Screenshots were visually inspected: the front opening exposes the character's full body and remaining soil depth. The narrow viewport retains the existing small overall scene scale. Luka's save was untouched.

| View | Before | After |
| --- | --- | --- |
| Two-layer pit, character at front | [Before](pit-cutaway-before-2-layers.png) | [After](pit-cutaway-after-2-layers.png) |
| Five-layer rendering fixture | [Before](pit-cutaway-before-5-layers.png) | [After](pit-cutaway-after-5-layers.png) |
| Empty pit, 1280 x 720 | [Before](pit-cutaway-before-floor-1280.png) | [After](pit-cutaway-after-floor-1280.png) |
| Empty pit, 390 x 844 | [Before](pit-cutaway-before-floor-390.png) | [After](pit-cutaway-after-floor-390.png) |

The uneven pits and three-/five-layer depths are disposable render fixtures, not new playable sites. They deliberately place the character at the deepest front edge to expose the original occlusion problem.

## Verification

- `npm test`: 77/77 passed, including a new check that both side paths stop at the cutaway while the outdoors room is unaffected. The route test visits both sides and the rear of the pit.
- `npm run build`: passed; existing large-bundle warning remains.
- `scripts/check-pit-cutaway.mjs`: passed before/after fixtures at 1, 2, 3 and 5 layers. Checks unobstructed head/torso/feet, seams, soil count, wall bands and unchanged camera; captures desktop and narrow-viewport screenshots.
- `scripts/check-digging.mjs`: passed shovel contacts, first-hit rendering, tile removal, two-layer rendering and framing.
- `scripts/check-depth-progression.mjs`: passed actual keyboard movement/digging, whole-layer gating, reload, cleaning/collection, automatic cleanup/exit and five-layer wall geometry.

Changed application files: `src/presentation/excavation.ts`, `src/presentation/discovery.ts`, `src/game/navigation.ts`. Updated `tests/navigation.test.ts`, added `scripts/check-pit-cutaway.mjs`, adjusted the wall-count assertion in `scripts/check-depth-progression.mjs`, and recorded the decision and screenshots.
