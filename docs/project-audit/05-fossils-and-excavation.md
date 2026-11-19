# Fossil content and excavation

Verified implementation, 2026-11-08. “Implemented” means the content has source-defined excavation, cleaning, placement and presentation paths; it does not mean Luka has completed it or that scientific/visual review is finished.

## Current content inventory

| Exhibit ID / name | Mode | Required finds | Site | Implementation status |
| --- | --- | --- | --- | --- |
| `dimetrodon` / Dimetrodon | `assembled` | Six anatomy groups | `courtyard-dig` | Complete gameplay path, procedural skeleton, assembly anchors, story and local illustration |
| `trilobite` / Trilobite | `whole` | One slab | `courtyard-dig` | Complete gameplay path, one-part placement, slab renderer, story and local illustration |
| `eryops` / Eryops | `assembled` | Six anatomy groups | `eryops-dig` | Complete gameplay path, distinct procedural skeleton/anchors, story and local illustration |

Authoritative definitions: `src/content/exhibit.ts:GROUPS`, `SLAB_PART`, `ERYOPS_GROUPS`, `ALL_PARTS`, `EXHIBITS`; discovery/site definitions: `src/content/journey.ts:ALL_DISCOVERIES`, `SITES`.

| Exhibit | Part ID → discovery ID |
| --- | --- |
| Dimetrodon | `skull` → `bone-study-head`; `spine-sail` → `bone-study-01`; `ribs` → `dimetrodon-ribs`; `front-legs` → `dimetrodon-front-legs`; `hind-legs` → `dimetrodon-hind-legs`; `tail` → `dimetrodon-tail` |
| Trilobite | `trilobite-whole` → `trilobite-slab` |
| Eryops | `eryops-skull` → `eryops-skull-find`; `eryops-spine` → `eryops-spine-find`; `eryops-ribs` → `eryops-ribs-find`; `eryops-front-legs` → `eryops-front-legs-find`; `eryops-hind-legs` → `eryops-hind-legs-find`; `eryops-tail` → `eryops-tail-find` |

There are **13 discoveries**, not 17 exhibits and not the historical V1 set of 16 discoveries. Apateon and Paleolimulus occur in V1 documentation, not the current `EXHIBITS`. None of the proposed fourteen additional Permian exhibits is registered in current content. Decorative shell/leaf reliefs are not fossil inventory.

## Sites and association model

| Site | Dimensions | Required content | Access |
| --- | --- | --- | --- |
| `courtyard-dig`, Green Meadow | 8×8 cells, 1 layer, tile size 1.05, floor Y −0.7 | Six Dimetrodon groups + trilobite slab | Free starter |
| `eryops-dig`, Ochre Hill | 8×8, 2 layers, same tile size, floor Y −1.4 | Six Eryops groups | First site closed, at least one complete display, then pay 24 |
| `future-site-03` | Plot preview describes the next 3-layer dimensions | No discovery set or playable `SITES` entry | Disabled placeholder |

`DigSite` contains ID, `specimenId`, `requiredDiscoveryIds`, prerequisite `requires`, grid, interaction point, cells and optional burial metadata. The real association is **required discovery IDs plus cell `discoveryId`**, not `specimenId`: the first site legitimately contains two exhibits. `EXHIBITS.parts` maps discovery groups to their display.

Finds have authored non-overlapping footprints covering multiple tiles. `withFootprints()` assigns one discovery ID to every covered cell. `game/burial.ts:findBurial` / `findIsExposed` determine partial visibility and complete exposure. Eryops spine has explicit sloping burial from layer 0 to layer 1, axis Z. Other current finds use the default floor burial. All playable pits share the same plan geometry; collision constants still derive from the first site.

## Full lifecycle

1. **Travel/entry.** `game/world-map.ts` enforces owned playable sites. The map travels to camp; pit entry is only from that site's camp and is blocked after closure.
2. **Dig.** `game/journey.ts:stepDigging` starts while the player is stationary without directional input and near reachable soil. A 1-second swing strikes at normalized elapsed 0.72; two hits clear a layer. Digging works across the shallowest remaining layer of the whole pit before the next layer. Movement/panels interrupt the transient swing; committed hits remain in `dig` as normalized column progress.
3. **Expose.** A find is available for cleaning once all required coverage is exposed. `pendingDiscovery` chooses an uncollected find assigned to the active site, excluding helper custody. `prototype.ts` opens cleaning on newly exposed manual finds; interrupted cleaning can be resumed.
4. **Clean.** `brush()` updates a 24×14 full-canvas grid (336 cells), radius 1.7 in grid units, using normalized pointer coordinates and swept strokes. At 90% it fills the remaining mask. Repeated clean strokes add no progress; there is no damage or penalty.
5. **Collect.** `collectFossil()` requires clean/exposed/uncollected status and the correct site. The explicit bag action appends the discovery ID and deletes its mask. `inventory()` derives collected parts not yet placed; no bag capacity is enforced.
6. **Finish the site.** `allSiteRecovered()` requires every assigned discovery collected and exposed. `stepCompletion()` pops remaining columns one at a time (0.32 seconds each), automatically walks out and only then appends the site to `closedSites`. Cleanup also settles remaining soil rewards. Assembly is not required to close a site. Stored but uncleaned helper finds prevent completion.
7. **Place.** `placeOwnedGroup()` checks owned/available stand and exhibit membership; `placeGroup()` requires museum location, matching part/target and inventory membership. Each placement is saved immediately. Wrong or repeated placement is harmless.
8. **Complete.** `exhibitComplete()` derives completion from all required `placed` IDs. The final placement opens the story; subsequent nearby interaction can reopen it. Completion is not a separate mutable flag or reward counter.

## Large and whole fossils

Large skeletons use `presentation/skeletons.ts:SKELETONS` with Dimetrodon and Eryops recipes, per-group meshes and anchor positions. `buildAssembledExhibit` reveals placed anatomy incrementally; `createAssemblyPreview` renders the actual recipe with unplaced ghost groups. Clicking a part then its target and dragging with a 28-pixel forgiving edge margin share the same rule command.

Whole-fossil mode uses one discovered part and one placement target. It still requires digging, brushing, explicit collection and stand purchase. It has no separate multi-piece restoration minigame. `presentation/slab-exhibit.ts` and `ui/assembly.ts` currently hard-code the trilobite slab preview/renderer; new whole specimens need this generalized.

Shared `FOSSIL_PROFILES` define visual facets for excavation, cleaning and thumbnails. New parts require profiles, while assembled exhibits also require skeleton recipes and matching anchors; adding an `EXHIBITS` row alone is insufficient.

## Helpers and storage

`game/helpers.ts` and `helper-simulation.ts` implement one helper assigned to an owned site. It works only while Luka is in that same active pit. Newly helper-exposed finds move into `custody` as delivery, then into that site's storage. The player opens the box, uses the same cleaning activity and explicitly collects. `game/storage.ts:settleDeliveries` deposits interrupted deliveries at their original site on travel/reload/reassignment. Helper work does not auto-assemble, auto-clean or bypass closure requirements.

## Content review limits

`educationReview` and `eryopsReview` explicitly retain scientific-review status; the trilobite is marked a stylized group example. `animal-illustrations.ts` labels its current trilobite illustration as **Isotelus**. Its suitability for the proposed strictly Permian collection is not established by this audit; validate the chosen taxon and replace text/art where necessary before claiming period-specific accuracy. No external paleontological fact review was performed here.

Persisted discovery/part/cell IDs, burial exposure, site prerequisites and already-closed sites all constrain migration. Adding a find to an exhausted site can invalidate its existing closure unless an explicit migration handles it. See [save/load](08-save-load.md) and [gap analysis](12-permian-museum-gap-analysis.md).
