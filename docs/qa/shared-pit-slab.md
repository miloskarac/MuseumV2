# Shared pit and explicit slab placement

2026-10-18 follow-up to [the first trilobite increment](phase4-whole-fossil.md), implementing Miloš's two corrections.

Historical checkpoint: [the Eryops increment](eryops.md) subsequently adds a playable second site and advances the save to schema 10. The shared first pit and explicit slab placement described here remain intact.

Miloš reviewed this increment and said “this looks ok.” Its current appearance is accepted; this does not record a Luka playtest or scientific review.

## Current behavior

The first 8 × 8 pit contains six Dimetrodon parts and one whole trilobite slab. All existing bone tiles remain fixed. The slab is at `courtyard-r0-c3`, the next tile along the same column after the tail. Finds can be recovered in any order. Cleanup and closure require all seven to be cleaned and explicitly collected; museum placement is independent. The second and third outdoor plots remain unavailable.

The small stand uses the shared assembly UI and placement rule. Its circle opens a pale slab guide, target **1**, and the recovered slab picture under **Твоји налази**. Luka selects the picture and then the target, or drags it onto the target with the same forgiving snap area as the skeleton. The whole fossil stays one piece. A missed drop is harmless; opening or closing the panel cannot place it. Completion removes it from the bag, displays the slab/name/green circle, and opens the existing story. Dimetrodon's tray remains limited to its own six parts.

## Schema 9 migration

The save fields and localStorage key remain unchanged; schema version advances to 9 because the discovery layout changed. Historical first/second-site definitions are retained only to validate earlier saves before conversion. Current gameplay has one site.

- Keep all six bone tile IDs, dig values, collected parts, placed parts and cleaning masks.
- Move the old slab discovery's tile progress to the new tile, taking the greater of its progress and earth already dug there. Keep slab cleaning, collection and placement exactly. Discard retired second-pit soil IDs, which no longer correspond to playable terrain.
- Restore the active site to the shared first pit. A saved player in the removed pit arrives safely at the first pit's ladder.
- If the slab is still missing, remove the old first-site closure so it can be recovered. Previously dug earth remains dug, and recovered bones never need repeating. No slab is granted automatically.
- If the slab was collected and the old first pit was closed, keep the shared pit closed. Preserve all completed museum displays.
- Validate schema 8 against its original prerequisites and IDs, then convert. Schemas 1–7 still use their prior validation/conversion before this step. Repeated schema-9 loads leave state unchanged. Invalid and unsupported saves remain protected.

## Checks and visual evidence

`npm test`: **49/49 passed**. Tests cover both exhibits sharing one pit, stable bone positions, seven-find closure, slab-first recovery/placement, partial cleaning, old closed-pit reopening, former second-pit migration, invalid saves, and duplicate/wrong placement. `npm run build`: passed with the existing large-chunk warning.

Browser checks use disposable Edge contexts, never Luka's real save. `scripts/check-journey.mjs` exercises a fresh seven-find journey, cleanup/reload/closure, both exhibits and existing recovery/reset behavior. `scripts/check-phase4.mjs` exercises empty and owned slab panels, walking onto the circle without placement, click and drag placement, harmless misses, close/reload, failed write/retry, old partial-cleaning migration and reset. Results and screenshots are checked at 1440 × 1000, 1280 × 720 and 390 × 844; the full journey also checks 768 × 1024.

Both browser scripts **passed**, with no console/page errors, in **Microsoft Edge 154.0.4258.53**. Inspected screenshots confirm the slab tray/target and close button fit the checked windows, and the bag contains both kinds of find.

| Before / after | Screenshot |
| --- | --- |
| Before: circle immediately opened the completed card | [Previous interaction result](phase4-slab-story.png) |
| After: explicit slab placement | [Desktop placement](shared-pit-slab-placement.png) |
| Empty bag at the small stand | [Missing slab](shared-pit-empty-slab-placement.png) |
| Smaller desktop | [1280 × 720](shared-pit-slab-placement-1280.png) |
| Narrow window | [390 × 844](shared-pit-slab-placement-390.png) |
| Seventh find in the shared pit | [Trilobite cleaning](dimetrodon-shared-pit-slab-cleaned.png) |
| Recovered bones and slab together | [Shared bag](dimetrodon-bag.png) |

Changed application files: `src/content/journey.ts`, `src/game/journey.ts`, `src/persistence/save.ts`, `src/presentation/discovery.ts`, `src/app/prototype.ts`, `src/ui/assembly.ts`, `src/ui/journey.ts`, `src/style.css`. Also updated the affected unit tests, both browser scripts, decisions and roadmap. Fossil geometry, educational facts, movement and shovel/brush timing were not redesigned. Scientific review and Luka's comprehension/play-feel check remain open; automated checks and screenshot inspection do not replace them.
