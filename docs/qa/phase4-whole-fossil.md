# Phase 4: whole trilobite on a slab

**Historical record:** The same-day follow-up replaces the separate pit and automatic placement with a shared pit and explicit click/drag placement. See [current contract and QA](shared-pit-slab.md). Schema 8 below is historical; the current schema is 9.

Implemented 2026-10-18 following Miloš's request to start the proposed whole-fossil increment and his explicit trilobite selection. This is one additional find and stand. Art acceptance, scientific review and Luka's playtest remain open.

## Playable behavior

- Finishing and closing the first site opens the existing second-site marker. Museum assembly is not an unlock requirement.
- Site 2 reuses the one-level 8 × 8 pit and existing shovel timing, with independent tile IDs. One whole fossil is uncovered, brushed clean and explicitly put in the bag. Closing cleaning or reloading retains progress.
- Final collection starts the established sequential cleanup, returns the player to the second site's own entrance and closes that site once. The third marker remains unavailable.
- The bag shows a slab picture. At the small museum stand, clicking or walking onto the blue circle places the owned whole fossil immediately. There is no assembly puzzle. The circle becomes green, the white plate reveals **Трилобит**, and a four-section Serbian Cyrillic card opens. Closing the card on the circle does not reopen it immediately.
- Dimetrodon's six-part assembly, yellow partial circle, educational card and all accepted progress remain intact. The two exhibits can be completed independently after collecting their finds.

The free second-site prerequisite and reused dimensions are the smallest acquisition path for this example; they do not establish future purchase prices, rewards, collection size or later-site balance.

## Save contract: schema 8

The key remains `museum-for-luka-v2`. The saved fields are `version`, `activeSiteId`, `room`, `dig`, `cleaning`, `collected`, `closedSites`, and `placed`. Position, animation clocks, inventory and completion are derived, not persisted.

`activeSiteId` identifies the pit being restored and the correct outdoor exit. Stable existing IDs remain untouched. Site 2 retains its former marker ID `future-site-02`, uses `slab-r{row}-c{column}` tiles, discovery `trilobite-slab`, and part `trilobite-whole`.

Schema 7 is validated with its original content restrictions, then upgraded to schema 8 with the first site active. Earlier V2 migrations continue through that validator. No new find, placement, tile progress or closure is granted by migration. The snapshot is written through the normal checkpoint path. This does not import V1 saves.

Loading rejects unknown IDs, locked-site progress, duplicate finds/placements, placement without ownership, invalid cleaning masks and premature closure. A closed site requires all its assigned finds collected and all its own tiles cleared. Second-site progress requires first-site closure. Invalid saves remain protected by the existing recovery flow.

Immediate placement uses the shared ownership rule and save writer. A failed write keeps accepted live progress available, reports failure and exposes retry. Retrying persists the same placement without a duplicate. Cleanup pauses on a failed save; reset clears both exhibits through the established reset flow.

## Content and art reuse

`EXHIBITS`, `ALL_PARTS`, `ALL_DISCOVERIES` and `SITES` define required parts, display mode, discovery ownership and prerequisites. Digging, brushing, collecting, inventory and closure use these definitions. Presentation supplies separate assembled-skeleton and whole-slab recipes; no new framework or dependency was introduced.

The trilobite is a stylized group example, not an identified species or a precise anatomical reconstruction. Authored convex facets supply the cleaning canvas, bag/card SVG, excavation mesh and shallow relief on the museum slab. Whole-fossil discovery meshes layer the shell above their stone foundation. Assets belong to the room scene and follow its disposal lifecycle. This establishes a reusable procedural path for this example, not a final art pipeline for all future fossils.

The short factual text was checked against [Oxford University Museum of Natural History: What were trilobites?](https://oumnh.ox.ac.uk/learn-what-were-trilobites) and [Natural History Museum: How trilobites conquered prehistoric oceans](https://www.nhm.ac.uk/discover/how-trilobites-conquered-prehistoric-oceans.html). It describes marine life, existence before dinosaurs, an extinct group with a segmented shell, and three **longitudinal** lobes. This is source checking, not expert scientific review.

## Verification

- `npm test`: **48/48 passed**. Six new tests cover content references/prerequisites, schema-7 migration, independent whole-fossil progress and direct placement, second-site cleanup/reload/closure, invalid saves, and museum route accessibility.
- `npm run build`: **passed**. The existing large JavaScript chunk warning remains.
- `scripts/check-journey.mjs`: **passed** the fresh six-find Dimetrodon journey, cleaning interruption, collection, cleanup, click/drag placement, partial/completed reloads, failed writes/retry, recovery, reset/cancel and responsive panels.
- `scripts/check-phase4.mjs`: **passed** a schema-7 completed-Dimetrodon fixture through real keyboard/pointer input: second-site entry, interrupted digging and cleaning, collection, reload during cleanup, correct site closure, bag picture, walk-on direct placement, failed placement write/retry, both educational cards, reload and reset. No browser console/page errors.

Browser: **Microsoft Edge 154.0.4258.53**, isolated disposable Playwright contexts. Luka's real browser profile/save was not used. Main journey viewport: **1440 × 1000**; additional card/museum checks at **1280 × 720** and **390 × 844**. The Dimetrodon regression also checks **768 × 1024**. Narrow cards scroll vertically; their close button remains reachable and there is no horizontal dialog overflow. These are browser input checks plus screenshot inspection, not a Luka playtest or touch-control acceptance.

Visual inspection found and corrected a profile fallthrough that overlaid leg artwork on the trilobite. The final screenshots show the segmented shell and both eyes; shared mesh layering was also corrected so the stone does not cover the shell in the pit. The small stand sits along the back of the hall, preserving the existing walking routes. Its circle is beside the stand, where it remains reachable and visible.

## Screenshots

| View | Evidence |
| --- | --- |
| Prior museum before this increment | [Previous museum](exhibit-story-after-museum.png) |
| New empty stand / blue circle | [Before discovery](phase4-museum-before-find.png) |
| Completed stand / green circle / named plate | [After placement](phase4-museum-complete.png) |
| Second site unlocked | [Outdoor entry](phase4-second-site-open.png) |
| Slab uncovered in the pit | [Excavation](phase4-uncovered-slab.png) |
| Cleaned slab | [Cleaning view](phase4-cleaning-complete.png) |
| Bag picture | [Bag](phase4-slab-in-bag.png) |
| Educational card | [Desktop](phase4-slab-story.png), [1280 × 720](phase4-slab-story-1280.png), [390 × 844](phase4-slab-story-390.png) |

## Files changed for this increment

- Content: `src/content/exhibit.ts`, `src/content/journey.ts`.
- Rules/save: `src/game/assembly.ts`, `src/game/journey.ts`, `src/game/navigation.ts`, `src/game/site-completion.ts`, `src/persistence/save.ts`.
- App/UI: `src/app/prototype.ts`, `src/ui/hud.ts`, `src/ui/journey.ts`, `src/ui/assembly.ts`, `src/style.css`.
- Presentation: new `src/presentation/slab-exhibit.ts`; `fossil-profiles.ts`, `fossil.ts`, `discovery.ts`, `excavation.ts`, `dig-animation.ts`, `outdoors.ts`, `world.ts`.
- QA: new `tests/whole-fossil.test.ts`, updated existing schema/content expectations, new `scripts/check-phase4.mjs`, updated `scripts/check-journey.mjs`, and linked screenshots.
- Decisions/roadmap: `docs/decisions.md`, `docs/roadmap.md`, this record.

Next human check: let Luka find the second site, recognize the slab in his bag and place it using the circle; confirm the small exhibit and its name are readable at his usual window size. Adjust only demonstrated clarity problems before choosing another content batch.
