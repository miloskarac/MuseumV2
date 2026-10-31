# Phase 6.5 — Digging helpers (isolated QA)

Delivered 2026-10-26 with Miloš's approved price, effectiveness, prerequisites and QA boundary. See the [decision record](../decisions.md).

**6.6 follow-up (2026-10-26):** the combined helper/storage flow now runs in normal play under schema 18. Both QA flags still select independent slots, now migrated to schema 18. The historical no-exposure restriction below applied only to the 6.5 delivery. See [current storage flow and QA](storage.md); rerun screenshots may show the added boxes.

## Play and scope

Open [the helper preview](http://127.0.0.1:5186/?helpers=1), or append `?helpers=1` to the URL printed by `npm run dev`. This starts an independent playthrough. The normal game and `?purchases=1` keep their existing saves and schema 16. Production ignores both flags.

Complete two displays, unlock the second site and earn 60 coins while eligible soil remains. Open **Помоћник**, hire once, and choose an unlocked site. Enter that site's pit to see the helper walk through the ladder opening to a reachable position beside its target. Its blue shirt and pale hat distinguish it from Luka. The helper never participates in player collision.

One helper is available now; the configured global maximum is two, with the second still gated by future approved content. Each untouched layer takes six seconds of work (a half-strength swing every 1.5 seconds), plus walking. A player half-dug layer takes three seconds. There is no offline work, camp/background excavation, or elapsed-time catch-up. Museum ticket rules and existing purchase prices are unchanged.

The small **Текући посао** progress bar describes private work on one layer. Soil and any frozen coin reward change together only when that task completes and saves. Luka can always dig the same tile; an accepted player change cancels the helper's unfinished task without undoing the player's hit. The helper retargets within the current whole layer, using the same vertical/horizontal reach rules as manual digging.

**6.5 release boundary:** helpers skip clears that would expose a fossil. Luka still reveals, cleans and collects finds through the existing flow. No custody, carrying state, storage box, automatic collection, upgrade or new site is implemented. Normal helper discovery will release with 6.6, after durable original-site custody and manual collection exist. An exhausted/blocked helper waits with a short instruction to reveal fossils.

## Persistence and interruption

- Schema 17 adds a bounded owned-helper record, exact 60-coin payment, assignment, lifecycle and one optional task, plus a monotonic task sequence. A task stores site/cell/layer, expected starting soil, required work and accumulated work. No positions, offline timestamps or speculative upgrades are saved.
- Helper QA uses `museum-for-luka-v2:helpers-qa` and `museum-for-luka-v2-helpers-qa-writer`. No automatic copy from the normal or purchase QA slot occurs.
- Hiring, reassignment, task start/cancellation and final clearing use the existing save-before-publish writer. Private work uses its one-second checkpoint, flushed on modal opening, travel and suspension. A failed write stops work and movement; retry saves the exact candidate once.
- Leaving at 60% preserves that task's exact work. Returning/reloading reconstructs the actor at the safe ladder anchor; it walks back before resuming. Reassignment cancels only private unfinished work. Committed soil, coins and permanent ownership remain.
- Valid tasks load paused. Changed soil, invalid work or retired targets cancel only the task. An unavailable assignment preserves ownership, unassigns the helper and explains this in its panel. Invalid receipts, duplicate helpers and inconsistent balances remain protected by recovery.
- Schemas 1–16 migrate through their frozen readers without granting a helper or refund. Schema-17 validation accounts for the helper payment before validating the old economic contract; historical readers still reject schema 17.
- Reset affects only the selected QA slot. Existing save failure, recovery, session exclusion and no-double-reward guarantees remain in force. Work since the last successful checkpoint is not guaranteed through an abrupt crash.

## Verification

`npm test`: **140 passed** (130 existing plus 10 focused helper tests). `npm run build`: passed; the existing large-chunk warning remains. No dependencies added.

Helper tests cover price/prerequisites/limits, duplicate actions, assignment, exact six/three-second work, 60% interruption, player contention, reach and layer restrictions, fossil-exposure gating, routes and adjacent work positions, historical migration, malformed ownership versus task normalization, failure/retry and reset.

Temporary-profile headless **Edge 155.0.4283.62**, with real button/keyboard input and screenshots at **1440×1000, 1280×720 and 390×844**:

- `scripts/check-helpers.mjs`: passed hiring and failed-payment retry, assignment, ladder travel, working animation, 60% map/travel/reload retention, hidden/focus pause, failed-clear retry and actor freeze, reassignment, reset, writer exclusion and separation from both other save slots. Finite deterministic render ticks exercise the real app loop; fixture seeding only prepares the progressed QA save.
- `scripts/check-visitors.mjs`: passed normal cashier/payment/queue/tour and pause/recovery regressions.
- `scripts/check-world-map.mjs`: passed normal and purchase-QA map/site/camp/pit, ownership, interruption, migration and reset regressions.
- `scripts/check-journey.mjs`: passed the fresh seven-find discovery/cleaning/assembly journey, harmless misses, partial display, tutorial cutoff, write failure/retry, corrupt/newer-save recovery and reset.
- `scripts/check-purchases-release.mjs`: passed schema-16 production purchases/travel/migration and confirmed both QA flags are ignored without altering either QA sentinel save.

Browser checks report no page errors. The helper UI now exposes failed-save retry inside its modal. Walking status stays visible until the actor reaches a work point. Visual review prompted adjacent stopping positions so the shovel aims into the target instead of out through the rim.

## Visual evidence and remaining human QA

| View | Before | After |
| --- | --- | --- |
| Pit, 1440×1000 | [Before hiring](helpers-pit-before.png) | [Helper digging](helpers-working-1440.png) |
| 1280×720 | [Normal baseline](helpers-before-1280.png) | [Helper digging](helpers-working-1280.png) |
| Portrait, 390×844 | [Normal baseline](helpers-before-390.png) | [Helper preview](helpers-working-390.png) |
| Controls | — | [Hire](helpers-hire.png), [assignment](helpers-assignment.png), [portrait controls](helpers-controls-390.png) |
| Failure feedback | — | [Paused after failed clear](helpers-clear-failure.png) |

Screenshots were inspected for readable buttons, unclipped controls, a distinct helper silhouette and unobstructed pit/ladder. Portrait fits without horizontal page overflow, but the existing wide scene is small; this is not a touch-controls or portrait gameplay acceptance pass.

Miloš/Luka should try **Помоћник → Унајми → Окерни брег**, enter the pit, watch one layer clear, open the map partway through another task, return, and try digging near the helper. Confirm that the pace and private-work bar are understandable. Automated checks and screenshot inspection do not establish Luka's comprehension or enjoyment. Phase 5 human acceptance remains open; 6.6 is the next development increment.

## Changed files

- New content/rules/simulation/save: `src/content/helpers.ts`, `src/game/helpers.ts`, `src/game/helper-simulation.ts`, `src/persistence/helper-save.ts`.
- New presentation/controls: `src/presentation/helper.ts`, `src/ui/helpers.ts`.
- Integration: `src/app/prototype.ts`, `src/presentation/world.ts`, `src/ui/journey.ts`, `src/style.css`.
- Shared reach and preservation of newer save fields: `src/game/journey.ts`, `src/game/purchases.ts`, `src/game/world-map.ts`, `src/game/museum-layout.ts`, `src/game/visitors.ts`, `src/game/visitor-simulation.ts`, `src/ui/purchases.ts`, `src/ui/world-map.ts`, `src/ui/visitors.ts`.
- Verification: `tests/helpers.test.ts`, `scripts/check-helpers.mjs`, `scripts/check-purchases-release.mjs`, `.qa/capture-helpers-before.mjs`, screenshots in this directory.
- Decisions/status: `docs/decisions.md`, `docs/phase6-plan.md`, `docs/roadmap.md`, `docs/architecture.md`, this report.
