# Phase 6.4 — Visitors, cashier and ticket income

Delivered 2026-10-26. Miloš approved the cashier/balance package on October 24; see [decision record](../decisions.md).

**2026-10-30 presentation update:** front visitor entrance, reversed cashier station and a visual pile of already-credited ticket money. See [current entrance/cashier QA](visitor-entrance.md). The older screenshots and “no cash pile” description below document the original delivery.

**6.6 follow-up:** normal play now uses schema 18 with helpers and site storage. Visitor prices, service and reload behavior remain unchanged; see [storage QA](storage.md).

## Play and scope

Open the [normal game](http://127.0.0.1:5186/) or run `npm run dev` and use Vite's printed URL. New games now include paid stands, the museum wing, map/site purchases and recurring ticket income together. Both first stands still fit within the starting 20 coins. Existing V2 saves preserve their stands/space, earned site access, coins and discovery progress.

Complete a fossil on its owned stand. Visitors then arrive and wait at **Каса**. Stand in the blue circle behind the desk to sell tickets automatically, one second per ready visitor. Coins appear in the balance only after payment is saved. There is no cash pile, repeated clicking or automatic staffing while Luka is elsewhere. Visitors tour up to two completed displays and leave; they never block Luka's movement.

| Completed displays | Ticket | Arrival interval |
| --- | ---: | ---: |
| 0 | No admission | No arrivals |
| 1 | 2 coins | 12 seconds |
| 2 | 3 coins | 10 seconds |
| 3 | 4 coins | 8 seconds |

Six visits maximum, including at most three unpaid. Partial assemblies, bagged finds and empty stands add nothing. The price is derived from unique completed displays; it is never accumulated by repeated placement or opening a story. Each payment locks its price. A newly completed display shows a short `Улазница +1` cue.

Movement, service and arrivals pause during activities, map/purchase dialogs, hidden tabs, lost focus, failed saves and inactive writer sessions. Outside the museum there is no visitor simulation or income. There is no elapsed-time catch-up. Arrival/service/tour clocks are transient and restart on reload/travel; a full queue accumulates no backlog.

The optional development URL `?purchases=1` still selects the independent QA save/lock. Production ignores that flag and uses the normal slot, with the same complete economy loop. The QA save is never copied into normal play. Helpers and fossil storage are not part of 6.4.

## Persistence and compatibility

Normal and QA saves now use **schema 16**. `visitors` contains only its version, monotonic `nextId`, a three-element count of sales at prices 2/3/4, and at most six `{ id, paid }` records. `paid: 0` means unpaid; otherwise it is the charged price. No actor transforms, wall-clock timestamps or unlimited receipt history are saved.

Arrival creates and saves a unique ID before presenting the visitor. Service validates the oldest unpaid visitor at the desk, Luka's station, eligibility and safe-integer arithmetic. The paid record, sales count and coin credit form one snapshot. The existing commit coordinator saves it before publishing success. Failed payments retain that exact candidate, pause play and offer retry; retry cannot pay twice. Reset discards pending state.

Leaving the museum and loading a saved game retire paid tours without repayment or refunds. Unpaid visitors retain their IDs and restore to safe queue slots. The sequence and sales totals survive retirement. Validation checks ordered unique visit IDs, bounds, allowed prices, sales totals, display eligibility and `sold + unpaid = nextId - 1`.

Coin validation uses starting coins + claimed soil rewards + ticket income − all recorded purchase costs. Ticket income is derived from the three sales counters. The schema-14/15 validators accept an internal, already-validated ticket-income offset only for schema-16 validation; ordinary historical reads retain their old zero-ticket invariants. The offset is applied after refunding all purchase receipts, so a legitimate player may spend more than their finite soil income without producing an invalid intermediate balance.

Schemas 1–15 migrate through their existing validation and entitlement rules, adding an empty visitor ledger and no retroactive ticket money. Malformed or future saves remain protected behind recovery. A valid but unusable location retains the existing museum fallback. All persistence stays local to the browser profile and origin; these integrity checks do not prevent deliberate coherent editing of local saves.

## Routes and presentation

The small teal desk and station fit both museum sizes and participate in player collision. Visitors have distinct colored clothing, no explorer hat and no collision authority over Luka. A bounded half-unit navigation grid connects authored entrance, queue, viewing and exit points, avoiding stands, furniture, purchase markers, assembly circles and the travel trigger. Paths refresh after construction/expansion; a visitor overlapped by newly built geometry moves to the nearest safe point and continues its tour. Viewing pauses last five seconds per display; actual tour length varies with the route.

Screenshots were inspected in disposable **Edge 155.0.4283.62** profiles at **1440 × 1000**, **1280 × 720** and **390 × 844**. The cashier instructions and label remain visible on narrow windows; the whole expanded museum is necessarily small there. These checks do not establish touch support, target-machine performance or Luka's comprehension.

| View | Before 6.4 | After 6.4 |
| --- | --- | --- |
| Fresh museum, 1440 × 1000 | [Before](visitors-before-1440.png) | [Cashier](visitors-fresh-1440.png) |
| Fresh museum, 1280 × 720 | [Before](visitors-before-1280.png) | [Cashier](visitors-fresh-1280.png) |
| Fresh museum, 390 × 844 | [Before](visitors-before-390.png) | [Cashier](visitors-fresh-390.png) |

Additional evidence: [waiting queue](visitors-queue.png), [failed payment](visitors-payment-failure.png), [first payment](visitors-first-payment.png), [price increase](visitors-price-increase.png), [full museum tour](visitors-tour-1440.png), [1280 tour](visitors-tour-1280.png), [narrow tour](visitors-tour-390.png).

## Verification

| Check | Result |
| --- | --- |
| `npm test` | **130 passed, 0 failed**. Eleven new cases cover ticket pricing, ordered/exactly-once service, migration, paid/unpaid restart, validation, failure/retry/reset, zero-soil-income purchases, routes, caps/timing and construction during tours. |
| `npm run build` | **Passed**. TypeScript and Vite; main JS 1,157.93 kB minified / 293.30 kB gzip. Existing >500 kB chunk warning remains. |
| `scripts/check-visitors.mjs` | **Passed**, including the final label/save-validation changes. Real keyboard desk access plus controlled simulation ticks, arrivals/caps/tours, display pricing, modal/hidden/focus pause, failed payment/retry/reload/travel, reset, writer lock and QA isolation. |
| `scripts/check-purchases.mjs` | **Passed** against schema 16: prices/prerequisites, write failures, safe construction, expansion traversal, owned assembly, migration, reset and normal/QA separation. |
| `scripts/check-world-map.mjs` | **Passed** against schema 16: map/sign/menu, separate camps, pit entry/exit, unlock/travel transactions, cleanup, reload and migrations. |
| `scripts/check-purchases-release.mjs` | **Passed** against the production build: fresh paid progression, map/cashier, purchased/travel reload, schema-13 legacy entitlements, no developer controls, untouched QA slot. |
| `scripts/check-journey.mjs` | **Passed**: fresh game buys both stands, travels through the map, recovers all seven first-site finds through actual input, performs forgiving click/drag/slab assembly, preserves partial/completed progress, and passes write-failure/recovery/reset scenarios. The failure fixture now handles a checkpoint during unfinished brushing by retrying before continuing. |

The zero-soil-income test starts from a validated first-site checkpoint with no earned soil coins. It exercises either first-stand purchase order, completes both displays and buys the wing/site in either valid order, then Eryops's stand. Eighteen 3-coin tickets fund the remaining 54 coins. Every purchase/payment reloads successfully; no grants or temporary discounts are used. With one display, the same renewable source is available at 2 coins per visitor.

Browser commands use the existing external Playwright installation, for example:

```powershell
node scripts/check-visitors.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
node scripts/check-purchases-release.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5187/
```

## Files and next review

New modules: `src/content/visitors.ts`, `src/game/visitors.ts`, `src/game/visitor-simulation.ts`, `src/persistence/ticket-save.ts`, `src/presentation/visitors.ts`, `src/ui/visitors.ts`. Integration updates cover the app, purchase/travel rules and UIs, museum layout/world, historical-validator income composition and CSS. New rule/browser checks are `tests/visitors.test.ts` and `scripts/check-visitors.mjs`; purchase, map, release and full-journey scripts were updated for schema 16. The decision log, roadmap, architecture status and Phase 6 plan record the combined delivery. No dependencies or backend were added.

Human review still needed: play the first-display → cashier → site/wing purchase loop, judge whether the queue and station are obvious to Luka, and check the museum on the intended machine. Phase 5 scientific/art/readiness acceptance remains open. Next development increment is **6.5 basic helpers**, with its cost/limits/work decisions still required; storage and manual delivery collection belong to 6.6.
