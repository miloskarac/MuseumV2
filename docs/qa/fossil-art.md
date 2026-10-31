# Dimetrodon fossil silhouettes — 2026-10-11

Replaced the generic excavation bars/rounded ends and repeated cleaning dog-bone drawing with six distinct anatomical profiles. Existing six discovery IDs, collection/placement groups, scale, camera, full-tray brushing, dirt masks, controls, UI layout and save version remain intact. No dependency or asset-loader changes.

## References inspected and used

All requested files were found in `docs/references/dig-sites/`:

| Reference | Features translated into low-poly geometry/artwork |
| --- | --- |
| `skull.png` | Long sloping snout, tall rear skull, sockets, separate jaw and tooth gap |
| `Spine.png` | Repeated vertebral bodies and tall sail spines with an arched silhouette |
| `tail.png` | Tapering vertebrae, small processes and a narrow segmented tip |
| `front-legs.png` | Elongated shoulder blades, articulated bends, paired lower bones and spread digits |
| `rere lags.png` | Broad pelvis, heavier upper limbs, different bends and paired lower bones |
| `ribs.png` (additional supplied reference) | Repeated curved, tapering ribs |

Rendering reference: `docs/references/museum/digging-master-reference.png` (the actual repository location). These are stylized interpretations of supplied images, not an expert anatomical reconstruction. No educational claims were added.

## Files

- `src/presentation/fossil-profiles.ts`: shared, authored polygon facets for all six groups, plus the existing canvas renderer's artwork helper.
- `src/presentation/shapes.ts`: solid flat-shaded convex plate primitive using the existing material/shadow pipeline.
- `src/presentation/discovery.ts`: extrudes the shared silhouettes into shallow excavation fossils; longest footprint remains 0.72 world units.
- `src/presentation/fossil.ts`: museum skull/jaw, faceted vertebrae, shoulder/pelvis shapes, paired lower limb bones, digits and segmented tail. Existing group visibility/placement handling remains.
- `src/ui/journey.ts`: draws the appropriate profile beneath the unchanged dirt overlay.
- `tests/fossil-art.test.ts`: guards six-group coverage, tray bounds, finite vertices and convex triangulation.
- `scripts/check-fossil-art.mjs`: disposable-profile fixture captures of all six finds and collection checks.

## Before/after evidence

Edge 154.0.4258.53, 1440 × 1000, unchanged cameras and scale. Screenshots were visually inspected. Cleaning was also captured at 1280 × 720 for every part; all trays fit the viewport.

| View | Before | After |
| --- | --- | --- |
| Skull | [Before](fossil-art-before-clean-skull.png) | [After](fossil-art-after-clean-skull.png) |
| Spine/sail | [Before](fossil-art-before-clean-spine-sail.png) | [After](fossil-art-after-clean-spine-sail.png) |
| Ribs | [Before](fossil-art-before-clean-ribs.png) | [After](fossil-art-after-clean-ribs.png) |
| Front legs | [Before](fossil-art-before-clean-front-legs.png) | [After](fossil-art-after-clean-front-legs.png) |
| Rear legs | [Before](fossil-art-before-clean-hind-legs.png) | [After](fossil-art-after-clean-hind-legs.png) |
| Tail | [Before](fossil-art-before-clean-tail.png) | [After](fossil-art-after-clean-tail.png) |
| Excavation example | [Before](fossil-art-before-pit-spine-sail.png) | [After](fossil-art-after-pit-spine-sail.png) |
| Museum | [Before](fossil-art-before-museum.png) | [After](fossil-art-after-museum.png) |

All six pit views are saved as `fossil-art-after-pit-{group}.png`; laptop cleaning views use `fossil-art-after-clean-{group}-1280.png`.

Visual observations: the skull/jaw and sail are immediately different silhouettes, the tail tapers, and the limbs have different girdles and bends. At the small pit scale, the silhouette carries recognition; individual digits and vertebral details are clearest in cleaning. No Luka play session was performed.

## Checks

- `npm test`: 42/42 passed, including the new geometry contract check and existing six-find/save/assembly rules.
- `npm run build`: passed. Vite still reports the large main bundle warning.
- `node scripts/check-fossil-art.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5174/ after`: passed; all six clean fixtures collect exactly once, completed museum renders, no page errors. Separate temporary browser profile; Luka's save untouched.
- `node scripts/check-journey.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5174/`: passed the fresh six-find digging/cleaning/bagging journey, click/drag assembly, immediate partial museum display, reload persistence, final museum/card, save-failure/retry, reset/cancel and storage-recovery checks. No browser errors. Also checked existing responsive flows at 1280 × 720, 768 × 1024 and 390 × 844.

The initial before-capture script required fixture isolation fixes; all before screenshots were captured before replacing the game artwork. An intermediate journey run was interrupted by Vite's reload while correcting artwork; the final run uses unchanged application files.
