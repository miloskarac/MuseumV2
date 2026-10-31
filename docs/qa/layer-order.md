# Whole-layer excavation and shared camera

Update 2026-10-22: the foreground occlusion noted below is addressed by the [front pit cutaway](pit-cutaway.md), retaining this camera angle. The layer-order screenshots have been refreshed by the regression check.

2026-10-19. Every soil tile in the active layer must be removed before any digging can begin in the layer below. One partly cleared upper tile anywhere in the pit keeps lower tiles unavailable. Once its final hit lands, the next layer becomes diggable automatically through the existing proximity controls.

`activeDigLayer` derives the shallowest remaining layer from all saved columns in the active site. `nearestDigCell`, used by both direct digging and the shovel clock, selects only that layer. The current layer is not stored separately. Schema 11 stays unchanged: old uneven pits remain loadable, deeper work is retained, and digging resumes with the remaining upper tiles. Recovered finds, cleaning, site prerequisites and automatic cleanup/exit are preserved.

Both excavation sites now use camera position `(12, 16, -16)`, target `(0, 0, 0)` and the same viewport-dependent orthographic bounds. This restores the first site's original angle, including on deeper sites.

## Verification

- `npm test`: **65/65 passed**. Tests excavate complete layers at depths 2, 3 and 5, check that a distant partly dug upper tile blocks lower tiles and shovel animation, verify the final-hit transition and reload, and preserve old uneven saves and completion.
- `npm run build`: **passed**, with the existing bundle-size warning.
- `scripts/check-depth-progression.mjs`: **passed**. Checks both camera transforms/bounds, waits over a blocked lower tile through multiple shovel durations, walks to clear the final upper tile, then digs the newly available lower layer. It also checks partial-hit reload, fossil cleaning/collection, cleanup/closure and the existing soil-band fixture. Disposable Edge 155.0.4283.62 profile, 1440 × 1000; Luka's save is untouched. Screenshots were visually inspected; the restored angle has the original foreground occlusion of the deeper floor.

| View | Screenshot |
| --- | --- |
| Previous steeper second-site angle | [Before](depth-after-floor.png) |
| Original first-site angle restored | [After](depth-layer-order-floor.png) |
| Lower layer waiting for the last upper tile | [Blocked](depth-layer-order-lower-layer-locked.png) |
| Next layer available | [Digging](depth-layer-order-next-layer-open.png) |

Changed files: `src/game/journey.ts`, `src/presentation/world.ts`, `tests/depth-progression.test.ts`, `tests/grid.test.ts`, `tests/eryops.test.ts`, `tests/find-footprints.test.ts`, `scripts/check-depth-progression.mjs`, decisions and these QA notes/screenshots.
