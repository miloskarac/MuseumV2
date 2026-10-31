# Phase 6.6 — Fossil storage and manual collection

**6.7 follow-up:** normal play and both independent QA slots now use schema 19 with the approved permanent upgrades. Storage behavior is preserved. This report records the original 6.6 delivery; see [current upgrade QA](upgrades.md).

Delivered 2026-10-26 with the [approved storage flow](../decisions.md). Helpers and storage now run in normal development and production play under schema **18**. The accepted 6.5 release prerequisite is fulfilled. Phase 5 human acceptance remains open; upgrades require separate approval for a future 6.7 increment.

## Playable flow

- The existing permanent helper costs 60 coins and still requires two completed displays, site-two ownership and unfinished eligible work. Work speed, ticket income, soil rewards and purchase prices are unchanged.
- Helpers can now expose fossils. The final soil clear, any soil reward and the find's original-site custody are saved together before showing success. No cleaning popup opens and nothing enters Luka's bag automatically.
- The helper picks up a visible fossil parcel and walks to the site's box beside the pit ladder. A short arrival cue identifies the delivered find. The same inventory is available from the box beside that site's camp tent.
- Approach the box, open it, select a fossil, brush it clean, then press **Стави у торбу**. Closing the activity preserves partial brushing. Collection moves the find into the bag exactly once, with no additional coin reward.
- Boxes have room for every authored find without a capacity purchase. Site completion still requires manual cleaning and collection of all finds; remaining soil cleanup follows the existing pit flow.
- Helpers work only in their assigned active pit. Camps, other sites, blocking activities, hidden tabs and save failures do not advance work. There is no offline work or elapsed-time catch-up.

Normal play: `http://127.0.0.1:5186/`. Development flags `?helpers=1` and `?purchases=1` select independent QA saves; production ignores both flags. No save is copied between slots and no helper or currency is granted by migration.

## Persistence and interruptions

Schema 18 adds a bounded `custody` map keyed by discovery ID. Each entry records the original `siteId` and either storage or delivery with an owned `helperId`. Carrying presentation derives from this record; actor position and animation time are not persisted. A find cannot simultaneously be in custody and in the bag. Existing cleaning masks retain partial brushing for stored finds.

Travel and reassignment settle deliveries into the original site's storage in the same saved transition. Shutdown attempts the same deposit; loading safely settles any persisted delivery before play resumes. A failed delivery or collection write pauses gameplay and retry saves the exact candidate once. If an abrupt interruption prevents a new write, the last successfully saved custody still restores the find. Local browser storage remains the durability boundary.

Schemas 1–17 migrate through the existing frozen readers. Version-17 helper ownership and valid partial task work survive; migration creates no free finds, helpers or refunds. Invalid task targets cancel only unfinished work. Invalid custody, receipts or contradictory collection state remain protected by recovery. Reset and writer exclusion apply only to the selected save slot.

## Verification

- `npm test`: **149 passed**, including nine new storage tests for atomic exposure, original-site recovery, partial cleaning, collection duplication, player priority, physical delivery routes, completion, strict validation, write failure/retry and migration of partial helper work.
- `npm run build`: passed. The existing large-chunk warning remains; no dependencies were added.
- `scripts/check-storage.mjs`: passed normal-play exposure, carrying, delivery, modal/hidden pause, failed deposit and collection retries, partial brushing through travel/reload, camp collection, live travel/reassignment during delivery, reset isolation and responsive screenshots.
- `scripts/check-helpers.mjs`: passed hiring/payment retry, assignment, walking/work, retained 60% progress, hidden/focus pause, failed-clear retry, reassignment, reset, writer exclusion and QA isolation.
- `scripts/check-visitors.mjs`: passed cashier prices/service/payment, arrivals and limits, visitor routes, real keyboard desk approach, pauses, failed-payment retry, reload/travel and reset/isolation.
- `scripts/check-world-map.mjs`: passed normal and purchase-QA map/sign/menu travel, camps and pits, paid access, failed writes, reload, closure, migration and reset/isolation.
- `scripts/check-journey.mjs`: passed the fresh seven-find excavation/cleaning and click/drag assembly journey, harmless misses, partial display, tutorial cutoff, write failure/retry, corrupt/newer-save protection, recovery and reset.
- `scripts/check-purchases-release.mjs`: passed production purchases/travel, migration of existing entitlements and both ignored QA flags with both QA sentinel saves preserved.

Browser checks used ephemeral profiles in headless **Microsoft Edge 156.0.4314.42**, with actual UI/keyboard interactions and controlled render ticks for timing-sensitive scenarios. Passing runs reported no page errors. Luka's real save was not used. `check-purchases.mjs` version assertions were updated but that separate script was not run in this increment.

## Visual evidence and human QA

Inspected at **1440×1000, 1280×720 and 390×844**. The box uses a wood silhouette, pale fossil icon and teal approach marker; the helper's parcel is visibly distinct from digging. The storage list wraps its controls in portrait without horizontal overflow.

| View | Before / overview | After / detail |
| --- | --- | --- |
| Delivery, 1440×1000 | [Before carrying](storage-pit-before-delivery.png) | [Carrying the find](storage-carrying.png), [stored find](storage-box.png) |
| Camp, 1440×1000 | [Box beside tent](storage-camp-1440.png) | [Storage controls](storage-box-1440.png) |
| Camp, 1280×720 | [Camp view](storage-camp-1280.png) | [Storage controls](storage-box-1280.png) |
| Portrait, 390×844 | [Camp view](storage-camp-390.png) | [Wrapped storage controls](storage-box-390.png) |
| Recovery | [Failed delivery](storage-delivery-failure.png) | [Retained partial cleaning](storage-cleaning-partial.png) |

The delivery comparison shows successive gameplay states, not a preserved pre-implementation baseline. The existing wide scene remains small in portrait; these checks do not establish touch-control support or Luka's comprehension/enjoyment.

For human QA in a separate save: hire and assign the helper, watch it expose and carry a fossil, follow it to the box, brush part of the find, close and reload, then finish brushing and collect it. Also leave during a delivery and check the original site's camp box. Confirm that Luka understands the parcel, box marker and explicit collection action. Phase 5's scientific/content/art and comprehension acceptance gates remain open.

## Changed files

- New storage content/rules/save: `src/content/storage.ts`, `src/game/storage.ts`, `src/persistence/storage-save.ts`.
- New presentation and controls: `src/presentation/storage.ts`, `src/ui/storage.ts`.
- Integration: `src/app/prototype.ts`, `src/game/helpers.ts`, `src/game/helper-simulation.ts`, `src/game/journey.ts`, `src/game/purchases.ts`, `src/game/world-map.ts`, `src/game/visitors.ts`.
- Presentation and existing UI: `src/presentation/helper.ts`, `src/presentation/discovery.ts`, `src/presentation/world.ts`, `src/ui/journey.ts`, `src/ui/helpers.ts`, `src/ui/purchases.ts`, `src/ui/world-map.ts`, `src/content/helpers.ts`, `src/style.css`.
- Verification: `tests/storage.test.ts`, `scripts/check-storage.mjs`, schema assertions in the helper, visitor, map and purchase browser scripts, and storage screenshots in this directory.
- Documentation: decisions, Phase 6 plan, architecture, roadmap, helper/visitor follow-up notes and this report.

Next development step: propose the bounded 6.7 upgrade package and obtain decisions on its effects, prices and prerequisites before implementation. No upgrades or additional sites are included in 6.6.
