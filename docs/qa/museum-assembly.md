# Museum assembly — 2026-10-11

## Reference and scope

The requested video was found at **`docs/references/museum/fossil assembly.mp4`**, rather than the literal `references/museum fossil assembly.mp4` path. Duration: 23.43 seconds, 1880 × 896. [Extracted reference frames](assembly-reference-frames.png).

Observed sequence: a pale whole-skeleton guide with anatomical targets and a side tray of recovered parts; skull around 3 seconds, spine/sail around 5–6 seconds, ribs around 7–8 seconds, front legs around 9 seconds, rear legs around 11 seconds, tail around 12–13 seconds; then a completed specimen/card and the assembled museum display. The player can see earlier parts while adding later ones.

The anatomy references `skull.png`, `Spine.png`, `tail.png`, `front-legs.png`, and `rere lags.png` are present under `docs/references/dig-sites/`. The recently improved model and cleaning profiles already interpret these references. Assembly now reuses those profiles in the tray and the actual museum model in the main preview.

## Result and assumptions

- Replaced six unrelated target cards with one live Babylon skeleton preview. Unplaced groups form a translucent guide; accepted groups become solid at their actual exhibit positions.
- Kept the existing exhibit-plaque entry point and both click-then-click and drag placement. Matching numbered markers and selection highlighting identify each anatomical destination. A placed marker fades away to reveal the bones.
- A newly placed group settles down 0.28 world units over 0.55 seconds with a brief warm highlight. This is transient visual feedback; placement is accepted and saved immediately by the existing coordinator. Closing/reloading never needs to complete an animation to retain the part.
- The final card keeps the complete 3D skeleton visible. The museum still reveals each accepted group immediately and restores it from `placed` on revisit/reload.
- **Assumption:** the video's demonstrated order is helpful tray ordering, not evidence of a mandatory prerequisite chain. Recovered parts remain placeable in any order; incomplete inventories still work.
- **Assumption:** marker numbering, the short settle animation and a fixed close camera are V2 presentation choices. The video does not specify exact easing, timing or target tolerances. Existing 28 CSS-pixel drop forgiveness remains; overlapping zones prefer the selected part's valid zone on small screens.
- No excavation, cleaning, movement controls, museum layout, recovery requirements, save schema, rewards or content-count changes. No V1 code was copied. No dependencies added.

## Files changed

- `src/presentation/fossil.ts`: exposes the existing six mesh groups and exhibit-local anatomical anchors; tags meshes for geometry/visibility QA. Its museum geometry and group visibility rules remain intact.
- `src/presentation/assembly-preview.ts`: close-view Babylon scene using `buildFossil`, shared anatomical anchors, guide materials, placement feedback, resize and lifecycle handling. Created lazily, paused while closed and disposed with the UI.
- `src/ui/assembly.ts`: shared fossil thumbnails, anatomical marker interaction, recovered-parts tray, progress, and preview coordination.
- `src/ui/journey.ts`: displays the preview during assembly and the completed card.
- `src/content/exhibit.ts`: Serbian Cyrillic labels for the preview/tray/markers.
- `src/style.css`: scoped assembly layout and responsive targets/tray.
- `scripts/capture-assembly-reference.mjs`: extracts local reference-video frames using the already available QA browser.
- `scripts/check-assembly.mjs`: per-part placement/reload/geometry checks and screenshots.

## Validation

- `npm test`: 42/42 passed, including existing ownership, duplicate placement, persistence and six-find progression tests.
- `npm run build`: passed; existing Vite large-bundle advisory remains.
- `node scripts/check-assembly.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5175/`: passed. Checks empty display; each of six placements; wrong and duplicate actions; close/reload after every part; all six visible on completion; partial inventory; closing during placement; actual drag at phone width; and equality of every model mesh's exhibit-relative bounds in the preview and museum (within 0.001 world units). No browser errors.
- `node scripts/check-journey.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5175/`: passed the full fresh digging/cleaning/bagging/assembly journey, partial and completed reloads, placement write failure/retry, reset/cancel, corrupt/newer saves, denied storage recovery, responsive controls and no browser errors. Final lighting-only tuning was subsequently checked with the focused assembly script and production build.

Browser: **Microsoft Edge 154.0.4258.53**, isolated temporary profiles. No access to Luka's save. Visual screenshot inspection at **1440 × 1000**, **1280 × 720**, and **390 × 844**; responsive bounds additionally checked at **768 × 1024**. No hands-on Luka playtest or scientific review is claimed.

## Screenshot evidence

| State | Evidence |
| --- | --- |
| Previous separate-card UI | [Before](assembly-v1-before.png) |
| Empty anatomical guide | [0/6](assembly-v1-empty.png) |
| Skull | [1/6](assembly-v1-1-skull.png) |
| Spine and sail | [2/6](assembly-v1-2-spine-sail.png) |
| Ribs | [3/6](assembly-v1-3-ribs.png) |
| Front legs | [4/6](assembly-v1-4-front-legs.png) |
| Rear legs | [5/6](assembly-v1-5-hind-legs.png) |
| Completed preview and card | [6/6](assembly-v1-6-tail.png) |
| Museum display | [Complete](assembly-v1-museum-complete.png) |
| Laptop | [1280 × 720](assembly-v1-1280x720.png) |
| Portrait | [768 × 1024](assembly-v1-768x1024.png) |
| Narrow screen | [390 × 844](assembly-v1-390x844.png) |
