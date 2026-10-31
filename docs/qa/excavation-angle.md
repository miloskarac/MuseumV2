# Slight excavation rotation

2026-10-22. Turned the excavation view 8° horizontally in the marked direction so the front cutaway faces the viewer more directly. Both sites share the new camera. Camera height, horizontal distance, target and orthographic scale are unchanged. The museum and outdoors retain their original views.

The camera offset and keyboard directions use the same content definition. This keeps arrows/WASD aligned with the screen after entering or leaving excavation. Soil, collisions, ladder, progression and save format are unchanged.

## Visual review

Inspected screenshots in Microsoft Edge 155.0.4283.62 using a disposable profile at 1440 x 1000 and 390 x 844; also captured 1280 x 720. The front is less diagonal, the full character stays visible at the front opening, and the site fits the viewport. The mobile scene retains its existing small scale. The three-/five-layer scenes are render fixtures, not additional playable sites. Luka's save was untouched.

| View | Before | After |
| --- | --- | --- |
| Two-layer front opening | [Before](pit-cutaway-rotation-before-2-layers.png) | [After](pit-cutaway-rotation-after-2-layers.png) |
| Empty pit, desktop | [Before](pit-cutaway-rotation-before-floor-1280.png) | [After](pit-cutaway-rotation-after-floor-1280.png) |
| Empty pit, narrow viewport | [Before](pit-cutaway-rotation-before-floor-390.png) | [After](pit-cutaway-rotation-after-floor-390.png) |

## Checks and files

- `npm test`: 78/78 passed, including movement alignment, diagonal speed, room-specific keyboard mapping, and preserved museum/outdoor angles.
- `npm run build`: passed with the existing large-bundle warning.
- `scripts/check-pit-cutaway.mjs ... rotation-after`: passed visibility and geometry checks at 1, 2, 3 and 5 layers, plus desktop/mobile screenshots.
- `scripts/check-depth-progression.mjs ... rotation`: passed matching site cameras, real keyboard screen-right alignment, whole-layer gating, digging, reload, cleaning/collection and automatic cleanup/ladder exit.

Application changes: `src/content/view.ts`, `src/presentation/world.ts`, `src/game/navigation.ts`, `src/input/keyboard.ts`, `src/app/prototype.ts`. Updated `tests/navigation.test.ts`, `tests/keyboard.test.ts`, the two browser scripts above, and `docs/decisions.md`.
