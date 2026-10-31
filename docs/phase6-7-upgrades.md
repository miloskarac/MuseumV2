# Phase 6.7 — Upgrade proposal

Prepared 2026-10-26 following Miloš's request to continue with 6.7. **Approved and implemented:** Miloš selected this package after reviewing the proposal. Schema 19 now supplies all three upgrades in normal play. See [upgrade implementation and QA](qa/upgrades.md), the [Phase 6 plan](phase6-plan.md) and [decisions](decisions.md). The design below records the selected package; the assessment record at the end describes the earlier planning-only pass.

## Recommended package

Three optional, permanent purchases, each with exactly one upgrade level. A small **Побољшања** panel in the museum shows a picture, short benefit, price, prerequisite or owned state, and an explicit purchase button. Opening it pauses gameplay like existing panels. All player-facing text stays Serbian Cyrillic.

| Upgrade | Price | Effect | Prerequisites |
| --- | ---: | --- | --- |
| **Удобне чизме** | 16 coins | Player walking speed +20%: 3.4 → 4.08 world units/second | One completed display |
| **Боља лопата** | 24 coins | Player swing duration 1.0 → 0.8 seconds; contact stays at 72% of the swing (0.72 → 0.576 seconds) | One completed display and useful unfinished digging at an owned site |
| **Бољи алат за помоћника** | 30 coins | Helper digging rate +25%: 6.0 → 4.8 seconds per untouched layer; half-finished layer 3.0 → 2.4 seconds, plus walking | Own the helper and have useful unfinished digging at an owned site |

Maximum spend is **70 coins**. The helper upgrade belongs to `helper-1` and survives reassignment. It does not unlock another helper. Walking remains useful after excavation finishes; digging upgrades cannot be purchased when no useful digging remains. Already purchased upgrades remain owned. No progression requirement depends on buying an upgrade.

Two player hits still clear a layer. From a fresh swing the contact moments become roughly 0.576 and 1.376 seconds, versus 0.72 and 1.72 seconds today; frame quantization adds a small delay. The improved helper remains substantially slower than Luka's unupgraded shovel. Helper walking/carrying stays at 1.6 units/second along the existing ladder route. Its half-player-hit work contribution stays unchanged; the equivalent swing interval becomes 1.2 seconds.

Suggested short benefits: **Ходаш мало брже.**, **Копаш мало брже.**, **Помоћник копа мало брже.** Show **Купљено** only after a successful save. One level avoids a long purchase ladder for the current small collection.

## Progression and release

Requiring a completed display protects the initial 20 coins until recurring ticket income exists. Later optional spending can delay required purchases but cannot remove that income source. The helper's existing two-display/site-two prerequisites still apply.

From zero balance with zero soil rewards, boots require eight 2-coin tickets and the shovel twelve; helper tools require ten 3-coin tickets once two displays exist. These are ticket counts, not measured waiting times. Prices are proposed V2 tuning, not playtested balance. Verify all permitted spending orders through the actual economy rules before release.

Defer visitor upgrades: service is already one visitor per second against arrivals every 12/10/8 seconds. Faster service offers little sustained benefit. More visitors, higher prices or automatic staffing need a separately demonstrated purpose and balance decision.

This package includes no new sites/species, second purchasable helper, storage fee, faster cleaning or extra income. Brushing, explicit bag collection, existing rewards and site completion stay intact. Hidden/modal/inactive time and offline time never produce work.

Recommend normal release after focused tests and browser checks pass, using the existing independent QA slots for verification. No additional QA mode is necessary. Existing saves receive no free upgrades or currency. Phase 5's human/readiness gates remain open.

## Implementation grounded in current code

- `src/game/navigation.ts` defines walking speed 3.4 and short collision substeps. Pass effective speed explicitly while preserving default behavior and collision steps.
- `src/content/journey.ts` defines the one-second swing, 0.72 contact and two hits. `src/game/journey.ts` resolves the contact once. Pass effective timing, keeping hit rules and rendered animation synchronized. Clamp real frame time before applying a rate; scaling input before an existing 50-ms clamp would erase the benefit at that step size.
- `src/game/helpers.ts` stores `work` and `required`; `src/game/helper-simulation.ts` drives work and presentation. Retain baseline work units: `required = 6` still represents an untouched layer; upgraded tools advance `work` at 1.25 units per eligible second. A task at 3.6/6 stays exactly 60% after purchase, leaving 2.4/1.25 = 1.92 seconds of work. Purchasing never clears soil or grants a find. This avoids cancelling or rescaling saved tasks; animation follows the same work cycle.
- Add definitions/copy in `src/content/upgrades.ts`, purchase rules and derived-stat selectors in `src/game/upgrades.ts`, and controls in `src/ui/upgrades.ts`. Integrate with `src/app/prototype.ts` and shared save types. Reuse save-before-success commits. No dependencies or general upgrade framework.
- Scale only the selected mechanic, never the overall simulation clock, visitor income, cleaning or cleanup animation.

## Save contract and interruptions

Propose schema **19** if no intervening save change ships. Keep schema 18's reader frozen. Add `upgrades` with version 1 and a bounded list of unique receipts: stable upgrade ID and exact paid amount; only helper tools include target `helper-1`. A receipt implies level one, absence level zero. Do not duplicate ownership as level flags or persist effective stats.

Validate exact shapes, known IDs, unique purchases, approved prices, safe integer totals and prerequisite ownership. Unfinished-soil eligibility applies when buying; exhaustion must not invalidate an existing receipt. Account for upgrade spend before delegating to schema 18's economic validation, then reconstruct schema 19 with the actual saved balance. This is validation accounting, never a gameplay refund. Invalid receipts/balances protect the original save instead of silently granting or removing upgrades.

Schemas 1–18 migrate through their existing readers and add empty upgrade ownership once, preserving helper tasks, custody, cleaning and entitlements. No grant, refund or retroactive benefit. A purchase subtracts coins and records ownership in one candidate. Duplicate actions, insufficient funds and unmet prerequisites change nothing. Failed writes pause gameplay; retry publishes the same candidate once. Travel/reassignment/reload retain upgrades and the existing original-site delivery recovery. Reset affects only the selected save and restores baseline stats; production continues to ignore QA flags.

## Acceptance checks for implementation

1. Prices, prerequisites, exact/insufficient balance, single-level caps, invalid IDs/helper targets, duplicate actions and exhausted digging offers.
2. Faster movement without tunneling, shovel contact once per cycle with unchanged soil/reward/exposure rules, helper 4.8/2.4-second work and continued inferiority to Luka.
3. Upgrade at 60% helper progress, travel/reload retention, reassignment's existing cancellation semantics, and preservation of carried/stored finds. No completion merely from buying or loading.
4. Historical migration and schema-19 round trips; invalid/newer-save protection; failed purchase/retry/reset; receipt/balance contradictions; independent writer/QA slots.
5. Zero-soil-income progression with all permitted upgrade orders, retaining reachable cashier income and all required stand/site purchases.
6. `npm test`, `npm run build`, a focused upgrade browser journey and affected movement/purchase/helper/storage/visitor regressions, including production migration/isolation.
7. Ephemeral Edge profile, recorded browser/version, before/after screenshots at 1440×1000, 1280×720 and 390×844. Check icons, prerequisite/owned feedback, controls and movement/animation feel. Luka's comprehension and target-machine performance remain human checks.

## Decision received

Miloš approved these three prices/effects and prerequisites, no free upgrades for old saves, and normal release after verification. Visitor improvements remain deferred. The decision is recorded in `decisions.md`; implementation evidence is in [upgrade QA](qa/upgrades.md).

## Assessment record

Inspected the vision, decisions, V1 handoff, Phase 6 plan, movement/digging, purchases/economy, helpers/simulation, schema-17/18 readers and existing logic/persistence tests. This assessment changes documentation only: this proposal and its links in the Phase 6 plan and roadmap. No upgrade UI or rules have been implemented.

Fresh baseline checks on October 26: `npm test` **149 passed**, `npm run build` **passed** with the existing large-chunk warning. Local proposal links resolve. No fresh browser run is needed for this documentation-only assessment; upgrade behavior, timing, visuals and revised progression remain to be implemented and verified after the product decision.
