# Digging and cleaning polish — 2026-10-07

The [2026-10-21 shovel pose correction](qa/shovel-pose.md) updates the grip, swing path and terrain reach while preserving this document's timing and gameplay rules.

This supersedes the cleaning auto-collection, result-card timer, tile collision, and schema-4 portions of [site completion](site-completion.md). The museum, 8 × 8 site layout, two hits per layer, depth colors, and site eligibility remain unchanged.

## Behavior and implementation

- One-second shovel cycles now lift, contact at 0.72 seconds, and recover. A small hip lean affects only the torso; feet stay planted. Two arm segments bend at each elbow and hold the shovel. Facing eases along the shortest turn. Contact is the single gameplay hit; recovery cannot repeat it or switch to a different target. Movement intent cancels digging, including when holding a key into a wall.
- Brushing affects all 336 cells of the existing 24 × 14 dirt tray. The fossil is drawn underneath a separate dirt overlay, so cleaning never erases it. Pointer coordinates exclude the canvas border; out-of-bounds strokes are ignored and do not connect across the tray on re-entry.
- The existing forgiving 90% threshold remains: reaching it visibly removes the final specks and stores the full clean mask (100%). The enabled **Стави у торбу** button then collects through the existing `collected` array, removes the cleaning mask, flushes the save, and closes the popup. Repeated activation is a no-op. Cleaning alone never starts cleanup. Leaving and reloading a ready fossil preserves its readiness.
- Cleanup takes 0.32 active seconds per remaining tile (previously 0.45). It still pops only one tile at a time. Normal digging/movement stay suspended; closure still occurs only after reaching the outdoor front position.
- Soil cells support walking at their rendered depth. The body height uses soil under the feet, with a short downward settling motion when support disappears. Pit-edge collision remains, with a forgiving ladder opening. The ladder bridges the floor-to-rim height. Automatic exit first approaches the inside of that opening before walking out, so it cannot cut diagonally through a wall.

## Persistence: schema 5

The key remains `museum-for-luka-v2`. Fields are unchanged: `version`, `room`, `dig`, `cleaning`, `collected`, `closedSites`. No ready flag or duplicate inventory was added.

`cleaning[discoveryId]` now contains unique integer indices from 0 through 335, including background dirt. A full array is a cleaned but uncollected fossil; readiness derives from its coverage. Collected fossils must have no cleaning mask. Existing uncovered and closed-site invariants remain enforced.

Valid V2 schemas 1–4 upgrade explicitly. Schema 4 preserves its closure flags exactly; earlier conversions retain their established completion behavior. Older partial masks retain their exact cleaned cells and gain the surrounding brushable dirt, so the percentage now measures the full tray. Already collected fossils stay collected. Invalid legacy masks are rejected under their original rules before conversion. This is not V1 save import.

The ordinary save checkpoint persists brushing. Bag activation and completion transitions flush immediately. Existing write-failure/retry, reset protection, and invalid-save recovery remain in place. No new rewards or unlocks were added.

## Changed files

- `src/content/journey.ts`: timings, full-tray indices, Serbian instructions and bag text.
- `src/game/journey.ts`: coverage, explicit collection, contact/recovery clock, walkable soil support.
- `src/game/navigation.ts`: pit walls and ladder opening.
- `src/game/site-completion.ts`: ladder approach during automatic exit.
- `src/presentation/dig-animation.ts`: shovel poses, hip lean, elbows, contact particles.
- `src/presentation/world.ts`: independent torso and surface-relative character height.
- `src/persistence/save.ts`: schema 5 validation and earlier V2 conversion.
- `src/app/prototype.ts`: bag action, removed auto-dismiss, movement-intent guard.
- `src/ui/journey.ts`, `src/style.css`: bounded brush, ready state, enabled/disabled bag button.
- `tests/{journey,grid,navigation,save,site-completion}.test.ts`: focused regressions.
- `scripts/check-{journey,digging,browser,completion}.mjs`: real-input and frame-level browser checks.
- Documentation: this contract, `decisions.md`, historical-contract pointers, and the linked QA report/screenshots.

Validation and before/after evidence: [polish QA](qa/digging-polish.md).
