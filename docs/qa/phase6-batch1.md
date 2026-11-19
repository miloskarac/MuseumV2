# Phase 6 gameplay fixes — batch 1

Date: 2026-11-07. Changes remain uncommitted. No dependencies added.

## Implementation and root causes

- **Cash:** `payVisitor` previously credited spendable coins and the pile rendered lifetime sales. Schema 21 instead records `pendingTicketRevenue`; collection transfers the entire amount into `economy.coins` and clears it in one critical save. Failed writes freeze the exact candidate; retry publishes once. Previously credited sales migrate with zero pending cash. The parser validates spendable plus pending against the existing receipt ledger, and rejects negative, fractional, missing, excessive and inconsistent amounts. Paid visitor retirement, travel and progression preserve pending cash. A fixed pool of 20 green notes (40 meshes including printed marks) replaces the 80 coin meshes. Direct Babylon picking and the 44px Cyrillic button invoke the same collection command. Babylon's modular ray-picking registration is explicitly imported.
- **Visitors:** The old route used one constant point and five-second wait per exhibit. Tours now sample the real pedestal perimeter, filter walls/furniture/interaction areas, prefer positions clear of other actors' positions and destinations, then confirm a reachable path. Small position variation and 3.5–6.5-second viewing duration are transient. Visitors face the fossil, retain walking animation, tour at most two exhibits and leave normally. Choices occur only when starting a stop or changing layout. Unreachable exhibit stops are skipped rather than repeatedly replanned. Direct clear paths avoid grid allocation.
- **Stands:** Eryops was gated by site ownership/closure in purchase rules and two persistence validators. Those gates and the obsolete purchase hint are removed. The existing west-wing placement requirement remains; the expansion still requires a first completed display. Prices remain 12/8/12 for stands and 18 for expansion. Both direct purchases and saved partial payments use the shared eligibility rule. Site-two prerequisites and its 24-coin price are unchanged.

## Verification

All browser runs use disposable Edge profiles, separate from Luka's saves. Existing Playwright installation: `F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs`.

Final result: all seven browser scripts listed below passed. The final visitor run includes real 3D-note clicking and touch collection; its paused-render harness explicitly waits for viewport resizing before projecting the click target.

- `npm test`: 176 tests passed, zero failures, including eight new batch-1 cases. Coverage includes failed sale/collection, immutable retry, duplicate actions, reset, reload/travel, migration, invalid accounting, early stand deposits/purchases, obstacle-free perimeter paths, eight seeded six-visitor tours, facing, varied waits and separated viewing positions.
- `npm run build`: passes; Vite reports the existing large-chunk warning (main bundle approximately 1.2 MB minified).
- `check-visitors.mjs`: attended payments, unchanged spendable balance, saved banknotes, collection failure/retry, direct 3D click, touch collection, price changes, tours/caps, pause/focus/hidden state, travel/reload/reset, writer exclusion and QA isolation.
- `check-phase6-batch1.mjs`: all stands purchased before first-site closure/site-two ownership, exact prices, duplicate-click protection, reload, site-two UI remains locked.
- `check-storage.mjs`: helper exposure, carrying/deposit, original-site custody, interrupted cleaning, failure/retry, manual collection and save-slot isolation.
- `check-helpers.mjs`: hire/failure/retry, assignment, walking/working, interrupted task progress, travel/reload, clearing, reset and writer exclusion.
- `check-upgrades.mjs`: migration, exact prices, duplicate purchase, movement/shovel/helper effects, interruption, reload/travel/reset.
- `check-world-map.mjs`: camps/pits, paid site unlock, failure/retry, closure, saved travel and isolation. Its old test route crossed the pre-existing cashier tray; the route now goes around the desk.
- `check-purchases-release.mjs`: production schema 21, purchase/travel/upgrade persistence, existing entitlements and independent development QA slots.

Edge 157.0.4341.42: 1440×1000, 1280×720 and 390×844 for the visitor/storage/upgrade/map checks; 1280×720 for early stands. The native manual-control attempt timed out at app approval. Screenshots were visually inspected; automated real mouse/keyboard/touch tests provide interaction evidence, but this is not a completed human play session or Luka acceptance.

The configured test runner and browser launch initially hit sandbox `spawn EPERM`; approved escalated runs executed successfully. Initial regressions exposed stale prerequisite assertions and a fixed-route fixture; these were updated for the requested behavior. The first direct-banknote test exposed missing ray registration, which was corrected. The full historical journey browser script was not run; excavation, cleaning, assembly, progression and persistence remain covered by the unit suite and the focused browser regressions above.

## Visual evidence

- [Historical before: coin pile and immediate balance credit](entrance-after-first-payment.png). This is an earlier recorded reference, before the separate exterior scenery update; it is not a matched fresh capture.
- [After: banknotes, pending amount, unchanged balance](batch1-first-payment.png).
- [After collection](batch1-collected.png).
- [Full capped banknote stack](batch1-full-pile.png).
- [Expanded museum at 390×844](batch1-tour-390.png).
- [Stands bought early](batch1-early-stands.png), [site two still locked](batch1-site-still-locked.png).

Ten representative batch screenshots are retained in `docs/qa`. Additional run screenshots, including diagnostic failures superseded by passing runs, are archived locally under ignored `.qa/batch1-evidence`.

## Independent engineering assessment

**Verified:** The fixes address the underlying economic transaction, destination selection and validation rules, rather than only changing presentation. No parallel economy or purchase path was introduced. Existing service timing, prices, save locking, helper/storage/upgrades and site unlock rules remain covered. Revenue and note-mesh counts are independently bounded; cash collection does not depend on how many notes are visible.

**Critical / High:** No unresolved defect at these severities was identified in the executed checks. This is a bounded assessment, not proof against every possible browser/storage failure.

**Medium — UX review suggestion:** At 390px the whole museum and individual banknotes remain small because of the existing fit-to-hall camera. The large amount button makes collection usable, but Luka should confirm that he understands pending versus spendable money. Collection is permitted from anywhere in the museum by click/tap; proximity was not required by the task. Ticket sales remain attended, matching the existing implementation.

**Medium — architectural concern:** Save parsing and state reconstruction span the historical schema chain. Schema 21 follows that established approach, adding one scalar and compatibility accounting, but future changes need migration tests and careful preservation in `advanceMuseum`. A later consolidation of the current runtime save type could reduce this maintenance burden; a broad refactor was deliberately outside this batch.

**Low — crowd limitation:** Destination preference reduces crowding at exhibits, but visitors remain nonblocking and can briefly overlap while walking on shared routes. This preserves the established movement model. Full crowd collision/steering was not introduced and would need separate congestion testing.

**Low — performance suggestion:** The existing main bundle exceeds Vite's warning threshold. No timing benchmark on low-end hardware was performed. The new work keeps the six-visitor limit, bounded candidate sampling and fixed note pool; profiling should precede any future crowd-size increase or navigation rewrite.

**Limitations:** Native manual UI control was unavailable after approval timeout; no child playtest occurred. Observation positions/timers intentionally are not saved, consistent with retiring paid tours on load. New saves require this schema-21 build; older builds reject them. Historical income is already credited and therefore does not become collectible again.

## Changed files

- Runtime/economy: `src/game/cash.ts` (new), `src/game/visitors.ts`, `src/game/purchases.ts`, `src/game/purchase-payments.ts`, `src/game/storage.ts`, `src/game/upgrades.ts`, `src/app/prototype.ts`.
- Persistence: `src/persistence/cash-save.ts` (new), `src/persistence/museum-save.ts`, `src/persistence/travel-save.ts`.
- Navigation/presentation/UI: `src/game/visitor-simulation.ts`, `src/content/visitors.ts`, `src/content/purchases.ts`, `src/presentation/visitors.ts`, `src/presentation/world.ts`, `src/ui/visitors.ts`, `src/style.css`.
- Tests: `tests/phase6-batch1.test.ts` (new), `tests/visitors.test.ts`, `tests/purchases.test.ts`, `tests/purchase-payments.test.ts`, `tests/world-map.test.ts`.
- Browser checks: `scripts/check-phase6-batch1.mjs` (new), `scripts/check-visitors.mjs`, `scripts/check-storage.mjs`, `scripts/check-helpers.mjs`, `scripts/check-upgrades.mjs`, `scripts/check-world-map.mjs`, `scripts/check-purchases-release.mjs`. Existing checks now recognize current saves; older fixtures remain migration coverage.
- Documentation: `docs/decisions.md`, this report, and `docs/qa/batch1-*.png` browser evidence.
