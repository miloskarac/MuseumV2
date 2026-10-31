# Bones spanning dirt layers — 2026-10-21

“Vertical” now means depth below the soil surface. The second pit's spine slopes from the first soil layer into the second. Removing the upper layer reveals its shallow section, while the lower section stays hidden by soil. Cleaning requires every covering layer to be removed, including the deepest end. Dirt underneath an already exposed shallow section is not required for recovery.

The first pit remains one layer deep. Existing horizontal footprints, camera, whole-layer digging order, two-layer soil colors, cleaning controls and sequential unlocks are retained.

## Content configuration

`DigSite.burial` optionally maps a discovery ID to zero-based `topLayer`, `bottomLayer` and slope `axis` (`x` or `z`). For a future site at least three layers deep:

```ts
burial: {
  'eryops-spine-find': { topLayer: 0, bottomLayer: 2, axis: 'z' },
}
```

The shared burial helper derives both the model's elevation and each footprint cell's occupied layer range. Models remain connected, sloping through soil rather than being split into separate collectible pieces. Coverage conservatively uses the whole footprint. Omitted entries keep the previous floor placement. A three-layer configuration is covered by unit and browser geometry tests; no third playable site or new specimen was introduced.

## Save compatibility

The save remains schema 12: existing column progress already represents every excavated layer. Burial is content, not additional saved state. All formerly uncovered, cleaning, collected, placed and closed finds remain valid; there is no excavation reset or extra collection grant. Current save validation uses the same exposure rule as cleaning and completion. Older schema migrations still validate their historical floor layouts. Closure still requires all remaining soil to be cleared, including soil beneath recovered finds.

## Files changed

- `src/content/journey.ts`: optional burial data and the two-layer Eryops spine.
- `src/game/burial.ts`: shared elevation, dirt coverage and exposure rules.
- `src/game/journey.ts`: depth-aware recovery and cleaning eligibility.
- `src/persistence/save.ts`: depth-aware current-save validation, preserving old layouts.
- `src/presentation/discovery.ts`, `src/presentation/shapes.ts`: connected sloping facets and staged visibility beneath opaque soil.
- `tests/burial.test.ts`, `tests/find-footprints.test.ts`: occupied-depth, final-hit, partial cleaning, duplicate collection, save and cleanup regressions.
- `scripts/check-find-footprints.mjs`: two-/three-layer mesh bounds, staged screenshots and recovery with soil still beneath the shallow end.
- `docs/decisions.md`, this report, and depth before/after screenshots.

## Verification

- `npm test`: 72 tests passed.
- `npm run build`: passed, with the existing large-chunk warning.
- Disposable Edge 155.0.4283.62 profile, 1440 × 1000. Inspected the screenshots below. The upper section is readable above the second layer while the rest is occluded; the full model has a visibly sloping elevation. The original camera still obscures some foreground limb tips in the deeper pit.
- Browser geometry checks confirm the live spine crosses the first/second layer boundary and a disposable three-layer model crosses both depth boundaries. Real keyboard digging and mouse cleaning verify that recovery can finish while soil remains beneath the shallow end; collection persists once after reload.
- Luka's play feel has not been assessed by these automated checks.

| View | Screenshot |
| --- | --- |
| Previous floor-only spine | [Before](find-footprints-depth-before-eryops-dig.png) |
| Upper layer removed, lower end still buried | [Partial depth reveal](find-footprints-depth-after-upper-layer-eryops-dig.png) |
| Fully exposed sloping spine | [After](find-footprints-depth-after-eryops-dig.png) |
| Unchanged first-site depth | [First pit](find-footprints-depth-after-courtyard-dig.png) |
