# Phase 6.7 — Permanent upgrades

Implemented 2026-10-26 using Miloš's [approved package](../phase6-7-upgrades.md). Normal development and production play use schema **19**. Both development QA slots remain independent. No existing save receives free upgrades or extra money.

## Player flow

In the museum, open **Побољшања** and buy an available item:

| Item | Price | Effect | Prerequisites |
| --- | ---: | --- | --- |
| Удобне чизме | 16 coins | Walking 3.4 → 4.08 units/second (+20%) | One completed display |
| Боља лопата | 24 coins | Swing 1.0 → 0.8 seconds, still two hits per layer | One completed display and useful unfinished work at an owned site |
| Бољи алат за помоћника | 30 coins | Untouched layer 6.0 → 4.8 seconds; half-finished layer 3.0 → 2.4 seconds | Owned helper and useful unfinished work at an owned site |

Each purchase is permanent and available once. The panel shows large pictures, short Cyrillic benefits, disabled prerequisite states and **Купљено** after saving. It pauses gameplay and exposes failed-save retry. Boots remain purchasable after excavation finishes; digging upgrades cannot be bought when no useful work remains. Purchased equipment stays owned after exhaustion.

Shovel contact and animation use one normalized clock, advancing 25% faster after purchase; soil increments and reward settlement are unchanged. The helper remains slower than Luka, and walking/carrying is unchanged. Helper tasks retain baseline work units: buying at 3.6/6 keeps 60%, with the remaining 2.4 units taking 1.92 eligible seconds. Buying never clears soil or creates a find. Hidden, blocked, inactive and offline time produce no work.

The cashier, visitors, cleaning, manual bag collection, site completion and required purchase prices retain their approved behavior. No new site, species or second available helper was added.

## Save and recovery contract

Schema 19 adds a versioned list of unique paid upgrade receipts. The helper-tool receipt names `helper-1`; one receipt means one level. Effective stats derive from ownership, with no duplicate saved flags or actor transforms.

The reader validates exact receipt shape, identity, prices, duplicate ownership, helper/display prerequisites and balance accounting before reconstructing the current save through frozen schema-18 validation. Validation temporarily accounts for upgrade expenditure; it never refunds the player. Schema 1–18 migration adds empty ownership and retains existing money, task percentages, cleaning masks and custody. Invalid ownership or balance protects the raw save. Delivery normalization continues to deposit finds at their original site.

Purchase cost and ownership commit together before publishing new stats. A failed write leaves the previous stats active and pauses gameplay; retry saves the exact candidate once. Reset cancels pending purchases and restores base stats only in the selected save. Production ignores both QA flags.

## Verification

- `npm test`: **159 passed**, including ten upgrade tests. Coverage includes prerequisites/caps/duplicate purchases, movement collision and long-frame bounds, exact shovel contacts, helper 60% retention and 4.8/2.4-second timing, upgraded custody/partial cleaning/collection, strict malformed-save protection, schemas 1–18 migration, failed-write/retry/reset and pause behavior.
- The zero-soil-income test explores reachable optional-spending orders for both first-stand choices using actual purchase/payment rules. Every reachable intermediate state can continue toward all required stands/site access and all three upgrades; each saved state validates.
- `npm run build`: passed; existing >500 kB chunk warning remains. Main bundle approximately 1,185 kB minified / 303 kB gzip. No dependencies added.
- `scripts/check-upgrades.mjs`: passed real panel purchases, failed-write retry, repeated clicks, schema-18 migration, +20% walking, two faster shovel contacts, retained 60% helper task through purchase/reload, work resumption, modal pause, travel, reset and both QA-slot boundaries.
- `scripts/check-purchases-release.mjs`: passed production purchase/travel/migration, a real upgrade purchase and reload, both ignored QA flags and untouched QA sentinel saves.
- `scripts/check-helpers.mjs`: passed base-rate hiring/work, failed payment/clear retry, assignment, retained progress, hidden/focus pause, reassignment/reset and writer exclusion.
- `scripts/check-storage.mjs`: passed exposure/carry/deposit, interruption, failed delivery/collection retries, partial brushing, travel/reload, camp collection and original-site custody.
- `scripts/check-world-map.mjs`: passed map/sign/menu, camps/pits, paid access, failure/retry, migration, closure, reset and isolation.
- `scripts/check-visitors.mjs`: passed ticket prices/service/payment, arrivals/caps/tours, keyboard cashier access, modal/focus/hidden pauses, failed payment/retry/reload/travel, reset and writer/QA isolation.
- `scripts/check-journey.mjs`: passed the fresh seven-find excavation/cleaning and click/drag assembly journey, explicit slab placement, harmless misses, partial/completed display, tutorial cutoff, failure/retry/reset, corrupt/newer-save protection and denied-storage recovery.

Browser runs use ephemeral profiles in **Microsoft Edge 156.0.4314.42**, with real UI/keyboard interactions and controlled render ticks for timing-sensitive cases. Passing runs reported no page errors. Screenshots inspected at **1440×1000, 1280×720 and 390×844**. Luka's real save was not touched. The standalone `check-purchases.mjs` schema assertions were updated but that separate script was not rerun in this increment.

## Visual evidence

| View | Before purchase | After purchase |
| --- | --- | --- |
| Desktop 1440×1000 | [Available equipment](upgrades-offers-1440.png) | [Owned equipment](upgrades-owned-1440.png) |
| Desktop 1280×720 | [Available equipment](upgrades-offers-1280.png) | [Owned equipment](upgrades-owned-1280.png), [museum header](upgrades-museum-1280.png) |
| Portrait 390×844 | [Available equipment](upgrades-offers-390.png) | [Owned equipment](upgrades-owned-390.png) |
| Feedback | [Prerequisites](upgrades-locked.png) | [Failed purchase with retry](upgrades-purchase-failure.png) |
| In play | [Museum before purchase](upgrades-before.png) | [Shoveling](upgrades-shovel.png), [helper working](upgrades-helper.png) |

Pictures and controls are distinct, prices are visible, and portrait buttons wrap without horizontal overflow. The comparison shows purchase states in the implemented game. The existing scene remains small in portrait; this is not a touch-control acceptance pass.

For human QA in a separate save: buy boots and walk around stands and through the ladder opening; buy the shovel and compare digging; buy helper tools during a paused task and resume it. Check that Luka recognizes owned equipment and understands that upgrades are optional. Record pace/comfort feedback and target-machine performance. Phase 5 scientific/content/art review and Luka's comprehension playtest remain open.

## Changed files

- New: `src/content/upgrades.ts`, `src/game/upgrades.ts`, `src/game/upgrade-stats.ts`, `src/persistence/upgrade-save.ts`, `src/ui/upgrades.ts`.
- Integration: `src/app/prototype.ts`, `src/game/navigation.ts`, `src/game/journey.ts`, `src/game/helpers.ts`, `src/game/helper-simulation.ts`, `src/game/storage.ts`, `src/game/purchases.ts`, `src/ui/journey.ts`, `src/ui/helpers.ts`, `src/ui/storage.ts`, `src/style.css`.
- Verification: `tests/upgrades.test.ts`, `scripts/check-upgrades.mjs`, schema/parser updates in helper/storage/visitor/map/purchase scripts, production upgrade checks and screenshots here.
- Documentation: approved package, decisions, Phase 6 plan, roadmap, architecture, storage follow-up note and this report.

The next step is a combined playtest and remaining Phase 5 acceptance work. Further visitor improvements or additional content require a new bounded scope.
