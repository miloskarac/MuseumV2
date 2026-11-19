# Economy

Verified implementation, 2026-11-08. Historical V1 figures and superseded Phase 6 plans are excluded from the current values below.

## Currency and income

The only spendable currency is integer `economy.coins`. `pendingTicketRevenue` is a separate integer cashier balance and cannot fund purchases until collected. Fossil parts and helper-held/stored finds are progression inventory, not additional currencies. No maintenance, consumables, wages, donations, shop purchases by visitors or offline earnings are implemented.

### Soil

`src/game/economy.ts:createGameSave`, `coinOutcome`, `advanceEconomy` and `soilKey` implement finite deterministic soil rewards. A saved unsigned 32-bit seed and stable site/layout/cell/layer identity generate a manifest of outcomes. The first site's manifest exists at game creation; another site's manifest is created on the first accepted transition into it.

A newly cleared cell-layer pays its frozen outcome, including layers removed by helper work or automatic cleanup. The first of two normal hits does not pay. `claimed` prevents replay; `excluded` records already-cleared soil when older saves gain the economy. Manifest identity, outcomes and claims are validated on load. A fossil collection/placement does not separately award a fixed coin bonus.

### Tickets and manual collection

`src/game/purchases.ts:displayedExhibits()` counts unique exhibits with all required part IDs in `placed` and an available owned stand. Partial skeletons, inventory, storage, purchased empty stands and decoration contribute zero.

`src/game/visitors.ts:ticketPrice()` returns zero with no complete display; otherwise `1 + completedDisplayCount`. Current content therefore supports prices **2, 3 and 4**. `arrivalSeconds()` returns **12, 10 and 8 seconds**, capped at the third tier. Expansion alone does not increase price, frequency or capacity.

`payVisitor()` charges the oldest unpaid visitor once the simulation reports arrival at the desk and Luka stands in the cashier station. Service takes one second. Price is locked when payment occurs, not at arrival. Schema 21 adds the payment to pending cash, records `Visit.paid` and increments the appropriate lifetime sales counter. Older schema branches credited coins immediately; normal play uses schema 21.

`collectTicketRevenue()` transfers the entire pending amount into coins and zeros pending cash. `src/app/prototype.ts:collectCash` commits this atomically. Both a Babylon banknote tap and the DOM collection button call it. Collection requires museum location and an active, focused, unblocked game with no open activity; **there is no player-distance requirement**. Banknotes are a capped visual representation, not individually valued collectible notes. `src/presentation/visitors.ts:buildCashier` caps the pool at 20; `src/ui/visitors.ts` shows the exact pending amount.

The simulation runs only in the museum while gameplay is active, visible and focused. Paid tours retire when leaving or loading; the unpaid queue remains. No retirement or reload grants ticket money again.

## Configured values

| Item/rule | Current value | Source |
| --- | --- | --- |
| Starting coins | 20 | `src/content/economy.ts:ECONOMY` |
| Soil reward | 12.5% threshold, 1 coin per successful cell-layer | Same; deterministic `coinOutcome()` |
| Dimetrodon stand | 12 | `src/content/purchases.ts:PURCHASES` |
| Trilobite stand | 8 | Same |
| West-wing expansion | 18 | Same |
| Eryops stand | 12 | Same |
| Green Meadow / `courtyard-dig` | Free starter access | `src/content/world-map.ts:MAP_SITES` |
| Ochre Hill / `eryops-dig` | 24, paid once | Same |
| Future site | Placeholder cost 0, **not purchasable/playable** | Same |
| Stand/wing standing contribution | 1 coin every 0.25 s in radius 0.72 | `PURCHASE_PAYMENT` |
| Ticket | 0 without displays; otherwise 1 + 1 per complete display | `src/content/visitors.ts:VISITORS` |
| Arrival interval | 12 / 10 / 8 s at 1 / 2 / at least 3 displays | Same |
| Visitors | At most 6 total, at most 3 unpaid | Same |
| Cashier service | 1 s per visitor while attended | Same |
| Helper | 60; only one currently purchasable | `src/content/helpers.ts:HELPERS` |
| Helper cap configuration | `maximumOwned: 2`, `available: 1`; second helper not implemented | Same |
| Boots | 16, permanent +20% player walk speed | `src/content/upgrades.ts` |
| Shovel | 24, permanent 1.25× rate (1 s becomes 0.8 s); two hits remain | Same |
| Helper tools | 30, permanent 1.25× work rate (6 s becomes 4.8 s per untouched layer, excluding movement) | Same and `src/game/helpers.ts:helperLayer` |
| Travel, brushing, assembly, placement | No charge | Transition functions in `game/` |

Expected full-site soil income is 64 × 0.125 = 8 coins for the first pit and 128 × 0.125 = 16 for the second. These are expectations, not guaranteed rewards. Starting coins exactly cover the first two stands. Renewable admission becomes available after either first exhibit is completed, protecting progression even with zero soil income under the current content/prices.

## Spending and duplicate protection

`buyPurchase`, `buySite`, `buyHelper` and `buyUpgrade` check eligibility, ownership and funds before subtracting money and adding a receipt in the same candidate. Stands/wing also support `contributePurchase`: each coin is immediately committed to `payments.partial`; interrupted contributions survive reload. The dialog can pay the remaining cost at once. On completion the partial entry is removed and the ownership receipt records the full price. Pending ticket cash is ignored by affordability checks.

Unique collected/placed IDs, purchase ownership, visitor IDs/payment flags, fixed reward claims and immutable failed-write retries prevent duplicate progression and income. `createSaveSession` prevents concurrent normal writers; external storage edits stop mutations. Safe-integer checks reject invalid/overflowing money.

## Persistence and expansion constraints

The current schema 21 save stores spendable coins, pending ticket revenue, lifetime price-tier sales, visit receipts, soil manifests, ownership receipts and partial deposits. The layered parsers enforce the equivalent of:

`coins + pendingTicketRevenue + completed purchase/site/helper/upgrade spending + partial deposits = 20 + claimed soil rewards + lifetime ticket income`.

Older credited ticket income migrates with **zero pending cash**, avoiding a second grant. See [save/load](08-save-load.md).

**Verified hard limit:** `TicketSave.visitors.sales` is a three-entry tuple. `payVisitor()` increments `sales[price - 2]`; `parseTicketSave()` requires three counters and only paid amounts 0/2/3/4. Simply adding a fourth complete exhibit produces an unsupported price-5 sale: incrementing the absent counter gives `NaN`, so the command fails its income validation. The ledger and migration must be updated before enabling more than three displays.

Recommendations: preserve existing admission semantics unless explicitly rebalanced; implement a versioned extensible price ledger, freeze historic receipt prices, and test pending cash plus partial deposits across all migrations. Larger-room pacing, prices and sustainable cash flow are unapproved design choices; do not extrapolate 17-exhibit balance as already implemented.
