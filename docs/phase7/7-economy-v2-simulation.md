# Permian Museum Economy v2 — simulation and balancing research

**Research only; no production changes or approved balance decisions.** Executed 82 deterministic progression scenarios plus 12 fixed-price earning windows and exhaustive early-purchase searches. All numbers below are outputs of the stated model, not measured child gameplay. Eight model tests and the full **469-test suite passed**.

The proposed +4/+2 admission rule is workable for a finite museum, but the economy is highly sensitive to cashier habits. The middle pricing configuration produces six minutes of additional funding time for the typical schedule, versus 18.1 for the distracted schedule. Frequent attendance leaves 476 coins after all purchases. Unrestricted early offers/contributions cannot guarantee a path to the first paying display.

## 1. Actual implemented baseline

Source is authoritative; older Phase 6/7 reports describe their historical schemas. The current save is schema 24, with inactive west-wing expansion credit. This research neither uses that credit nor changes persistence.

| Mechanic | Actual implementation | Source |
| --- | --- | --- |
| Starting cash | 20 coins | [economy content](../../src/content/economy.ts) |
| Soil rewards | Seeded 12.5% chance of one coin per cleared cell-layer; persistent manifest, claim once; no guaranteed minimum | [economy rules](../../src/game/economy.ts) |
| Admission | Zero without a valid display; otherwise `1 + completedDisplayCount`, currently 2/3/4 for the three playable displays. Size has no effect today. | [ledger](../../src/game/ticket-ledger.ts), [display checks](../../src/game/purchases.ts) |
| Payment and collection | One attended service second per ready visitor, first unpaid visitor only; income becomes pending, then a manual click/tap transfers it to coins. Collection need not occur at the desk. | [visitors](../../src/game/visitors.ts), [cash](../../src/game/cash.ts), [application](../../src/app/prototype.ts) |
| Arrivals | Every 12/10/8 seconds at 1/2/3+ displays; no paying visitors at zero displays | [visitor content](../../src/content/visitors.ts) |
| Caps | Six total visitors, at most three unpaid; a blocked arrival resets its timer | [visitor simulation](../../src/game/visitor-simulation.ts) |
| Tour | At most two displays; 3.5–6.5 seconds viewing each, plus actual path travel at 2.4 units/second | [visitor simulation](../../src/game/visitor-simulation.ts) |
| Absence/pause | No visitor progression while away excavating, in assembly/purchase dialogs, hidden, unfocused or blocked by saving. Travel/reload retain unpaid visitors and retire paid tours without repayment. No offline income. | [application](../../src/app/prototype.ts), [visitors](../../src/game/visitors.ts) |
| Stands | Dimetrodon 12, trilobite 8, Eryops 12. No site prerequisites for stands; Eryops still requires the west wing. | [purchases](../../src/content/purchases.ts), [purchase rules](../../src/game/purchases.ts) |
| Contributions | One coin every 0.25 seconds while attending the purchase marker; each coin is a critical saved transaction. Full payment by button also exists. Deposits persist. | [contributions](../../src/game/purchase-payments.ts) |
| Sites | First free; second 24, requiring first-site completion and a completed display | [map definitions](../../src/content/world-map.ts), [map rules](../../src/game/world-map.ts) |
| Expansion | Existing west wing 18, requiring a completed display. Planned Room 2/3 prices and purchases do not exist. | [purchases](../../src/game/purchases.ts) |
| Optional equipment | Boots 16 (+20% walking), shovel 24 (0.8-second swing), helper 60, helper tools 30 (4.8 rather than 6 seconds per untouched layer). Helper works only with player at the site; no automatic cashier. | [upgrades](../../src/content/upgrades.ts), [helpers](../../src/content/helpers.ts) |

Relevant historical context: [Phase 6 batch 1](../qa/phase6-batch1.md), [ticket ledger](7.2-extensible-ticket-ledger.md), [pure room progression](7.4b-room-progression-rules.md), [credit contract](7.5b-west-wing-credit-migration.md). The current two initially available stand prices total exactly the starting 20; the proposed four-exhibit Room 1 needs a fresh safety assessment.

## 2. Proposed parameters and price curves

Only fully completed/restored, actually displayed exhibits on valid owned stands in owned rooms count. The simulation rejects incomplete/unowned/undisplayed inputs and deduplicates IDs. Decorations contribute zero.

`ticket = 4 × displayedLarge + 2 × displayedSmall`, with no visitors at zero displays. Room-end prices are **12, 30, 50** for cumulative counts **2L+2S, 5L+5S, 8L+9S**. A tested +1 base variant preserves the zero-display exception and ends at 51.

| Curve | Global large sequence | Global small sequence | Total stands |
| --- | --- | --- | ---: |
| 25% | 12, 15, 19, 23, 29, 37, 46, 57 | 8, 10, 13, 16, 20, 24, 31, 38, 48 | 446 |
| Supplied ~30% | 12, 16, 20, 26, 34, 45, 58, 75 | 8, 10, 14, 18, 23, 30, 39, 50, 65 | 543 |
| 35% | 12, 16, 22, 30, 40, 54, 73, 98 | 8, 11, 15, 20, 27, 36, 48, 65, 88 | 663 |

The 25/35% prices are `round(start × factor^index)`, calculated from the unrounded base, not recursively from rounded prices. The supplied 30% lists are used verbatim. Neither sequence restarts by room. At 30%, room-specific stand expenditure is **46 / 135 / 362**.

The progression order is an explicit modeling choice, interleaving sizes:

- Room 1: Dimetrodon, trilobite, Eryops, Walchia.
- Room 2: Moschops, Arthropleura, Estemmenosuchus, Glossopteris, Edaphosaurus, Captorhinus.
- Room 3: Gorgonops, Helicoprion, Scutosaurus, Gorgonops tooth, Inostrancevia, Dicynodon, Permian ammonoid.

All fossils require a modeled excavation/cleaning phase followed by restoration/assembly and stand purchase. Room 2 is bought only after all four Room 1 displays; Room 3 only after all six Room 2 displays. The future Eryops display is assumed supportable in Room 1 without a successor room. The old 18-coin west-wing purchase is **not** added to the proposed three-room model.

## 3. Methodology and unmeasured assumptions

The isolated [simulation](../../scripts/simulate-economy-v2.mjs) uses 0.05-second steps for visitor-enabled time. It preserves baseline arrival intervals, total/unpaid caps, one-second attended service, pending collection, arrival-clock reset when blocked and no income during away/paused activities. A service/exit step does not also advance arrivals, matching the live update priority.

This is an aggregate visitor model, **not a replay of Babylon navigation**. Door-to-queue travel is assumed to take two seconds; the next visitor advances 0.9/2.4 seconds after a sale. Paid occupancy lasts an assumed 28 seconds, with 14/56-second sensitivity runs. Actual future room distances and congestion remain unknown. Existing tours visit at most two displays; the model does not multiply tour time by all 17 exhibits.

All following times are design assumptions in seconds, not experimental measurements:

| Activity | Active | Typical child | Distracted |
| --- | ---: | ---: | ---: |
| Acquire/clean a large fossil | 180 | 300 | 480 |
| Acquire/clean a small fossil | 90 | 150 | 240 |
| Round-trip travel per fossil, visitor-disabled | 30 | 45 | 60 |
| Assembly/restoration dialog, visitor-paused | 30 | 60 | 120 |
| Museum exploration after each display, arrivals enabled | 12 | 25 | 60 |
| Routine cashier bout | 20 | 12 | 6 |
| Routine bout after every N displays | 1 | 2 | 3 |
| Collect pending money every N cashier bouts | 1 | 1 | 2 |
| Museum exploration between extra funding bouts | 15 | 45 | 120 |

Each purchase costs three seconds of paused UI time. Manual collection is modeled as an instantaneous explicit action at the specified bout boundary, permissible anywhere in the museum as in production. If coins are insufficient, the player follows their funding-bout schedule until the purchase is affordable, including their collection habit. This assumes eventual willingness to attend and collect, not an automatic cashier or guaranteed behavior by Luka.

**Additional funding time** includes those extra bouts and intervening exploration. It excludes routine cashier time and normal excavation/assembly. Thus it is neither all idle time nor pure time standing at the desk. Room durations include the room's final exploration/routine bout if due; they are stage durations rather than exact placement timestamps.

Main runs start at 20, use **zero soil rewards**, zero historical credit and no optional equipment. This tests viability without lucky drops. All money obeys:

`coins + pending + stands + sites + expansions + optional spending = 20 + soil + ticket income`.

There are no automatic refunds or completion rewards. Production saves are never read or written. Optional-equipment sensitivity spends 130 after Room 1 but does not assume unmeasured speed benefits; it is a budget test, not a simulation of helper AI.

## 4. Candidate sites and expansion costs

These are **abstract access-fee schedules, not production sites, content assignments or approved unlock rules**. The main eight-site model has one free block and seven paid blocks, beginning after 0, 2, 4, 6, 8, 10, 12 and 15 displays. Blocks contain 2–3 exhibits, with multiple sites within each room. The free block supports Dimetrodon and trilobite. Later required content is assumed obtainable before any successor-room purchase; this is not verified against a real excavation graph.

| Candidate | Seven additional access fees | Site total | Room 2 / Room 3 | Expansion total | All mandatory spending, 30% stands |
| --- | --- | ---: | --- | ---: | ---: |
| Affordable/fast | 12, 18, 24, 30, 36, 42, 48 | 210 | 50 / 120 | 170 | 923 |
| Balanced candidate | 20, 30, 40, 50, 60, 75, 90 | 365 | 90 / 240 | 330 | 1,238 |
| Expensive/slower | 30, 45, 60, 75, 90, 110, 135 | 545 | 160 / 400 | 560 | 1,648 |

The first paid access fee occurs after two free-site displays in these runs. This assumption is essential to the zero-reward bootstrap; it does not authorize a specific site graph.

## 5. Results for every main scenario

Minutes are simulated active play across however many sessions the player takes. These are not recommended session lengths for a six-year-old. All nine deliberate progression routes finish all 17 exhibits without negative balances or credit.

| Prices | Player | Total minutes | Extra funding minutes | Longest extra purchase delay, seconds | Ticket income | Final coins / pending |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Fast | Active | 65.53 | 0.67 | 20 | 1,450 | 547 / 0 |
| Fast | Typical | 104.98 | 2.75 | 69 | 990 | 87 / 0 |
| Fast | Distracted | 179.10 | 9.30 | 132 | 1,164 | 261 / 0 |
| Balanced | Active | 67.12 | 2.25 | 55 | 1,694 | 476 / 0 |
| Balanced | Typical | 108.23 | 6.00 | 69 | 1,356 | 138 / 0 |
| Balanced | Distracted | 187.90 | 18.10 | 132 | 1,464 | 246 / 0 |
| Slow | Active | 69.78 | 4.92 | 55 | 2,042 | 414 / 0 |
| Slow | Typical | 111.68 | 9.45 | 183 | 1,824 | 196 / 0 |
| Slow | Distracted | 204.90 | 35.10 | 384 | 1,714 | 86 / 0 |

Raising prices induces more attended sales in this policy. Consequently income and ending coins need not decrease monotonically with prices. A higher ending balance does not mean the expensive run was easier.

### Admission earnings and attendance

Every paying visitor pays the current valid display price at service time, not arrival time. The mean below averages the changing fares across the full run. The active-minute denominator includes digging, dialogs, travel, exploration and cashier time, excluding time outside the modeled play session.

| Prices | Player | Tickets sold | Mean coins/paying visitor | Coins/active minute | Cashier bouts |
| --- | --- | ---: | ---: | ---: | ---: |
| Fast | Active | 55 | 26.36 | 22.13 | 19 |
| Fast | Typical | 42 | 23.57 | 9.43 | 18 |
| Fast | Distracted | 48 | 24.25 | 6.50 | 18 |
| Balanced | Active | 68 | 24.91 | 25.24 | 23 |
| Balanced | Typical | 57 | 23.79 | 12.53 | 23 |
| Balanced | Distracted | 61 | 24.00 | 7.79 | 26 |
| Slow | Active | 86 | 23.74 | 29.26 | 28 |
| Slow | Typical | 77 | 23.69 | 16.33 | 29 |
| Slow | Distracted | 77 | 22.26 | 8.37 | 36 |

As a separate rate experiment, hold display count fixed for 120 simulated minutes, repeat each style's activity schedule, and omit forced funding bouts/purchases. This avoids treating the cashier maximum as ordinary play income:

| Fixed museum state | Fare | Active coins/minute | Typical coins/minute | Distracted coins/minute |
| --- | ---: | ---: | ---: | ---: |
| First large display | 4 | 2.07 | 0.90 | 0.30 |
| Completed Room 1 | 12 | 9.30 | 2.70 | 0.90 |
| Completed Room 2 | 30 | 23.25 | 6.75 | 2.25 |
| Completed museum | 50 | 38.75 | 11.25 | 3.75 |

These fixed-tier schedules retain away activities as a duty-cycle probe; they do not claim new fossils exist after completion. At fare 50, even these intermittent schedules earn 4,650 / 1,350 / 450 over 120 minutes with no sinks. A finite museum with indefinitely repeatable sales cannot avoid eventual surplus. The theoretical eight-second arrival ceiling of 375 coins/minute at fare 50 is **not** a normal-play estimate. Short cashier bouts can have high per-desk-minute rates by serving a backlog accumulated during exploration.

### Time and money at room completion

Each cell is **room duration in minutes; spendable coins; pending coins**. Durations are incremental; add them for cumulative completion time.

| Prices / player | Room 1 | Room 2 | Room 3 |
| --- | --- | --- | --- |
| Fast / active | 15.72; 70; 0 | 23.53; 267; 0 | 26.28; 547; 0 |
| Fast / typical | 25.47; 40; 0 | 37.40; 95; 0 | 42.12; 87; 0 |
| Fast / distracted | 42.65; 28; 0 | 65.20; 65; 84 | 71.25; 261; 0 |
| Balanced / active | 16.30; 86; 0 | 23.87; 231; 0 | 26.95; 476; 0 |
| Balanced / typical | 25.67; 38; 0 | 39.30; 107; 0 | 43.27; 138; 0 |
| Balanced / distracted | 42.65; 20; 0 | 71.80; 89; 84 | 73.45; 246; 0 |
| Slow / active | 16.63; 88; 0 | 25.03; 199; 0 | 28.12; 414; 0 |
| Slow / typical | 25.87; 58; 0 | 40.65; 165; 0 | 45.17; 196; 0 |
| Slow / distracted | 44.85; 28; 0 | 78.00; 75; 84 | 82.05; 86; 0 |

Pending cash is not spendable, but it matters: the balanced distracted player has 173 in coins plus pending after Room 2, not merely 89.

### Major purchase waits and remaining balances

Each expansion cell gives **coins before → after; additional delay; new tickets sold during that delay**. The before balance excludes pending cash; after includes collections made while funding.

| Prices / player | Room 2 purchase | Room 3 purchase |
| --- | --- | --- |
| Fast / active | 70 → 20; 0s; 0 | 267 → 147; 0s; 0 |
| Fast / typical | 40 → 14; 12s; 2 | 95 → 35; 12s; 2 |
| Fast / distracted | 28 → 50; 132s; 6 | 65 → 119; 6s; 3 |
| Balanced / active | 86 → 32; 20s; 3 | 231 → 81; 20s; 3 |
| Balanced / typical | 38 → 8; 69s; 5 | 107 → 17; 69s; 5 |
| Balanced / distracted | 20 → 2; 132s; 6 | 89 → 23; 6s; 3 |
| Slow / active | 88 → 12; 55s; 7 | 199 → 9; 55s; 7 |
| Slow / typical | 58 → 30; 183s; 11 | 165 → 5; 126s; 8 |
| Slow / distracted | 28 → 12; 384s; 12 | 75 → 29; 258s; 9 |

The [purchase CSV](7-economy-v2-purchases.csv) records **every next purchase** in all nine main runs: exact cost, fare, coins/pending before and after, time, extra delay, tickets and cashier bouts. For the balanced typical run, the first additional site leaves 4 coins; Eryops leaves 12 after 69 seconds of funding; Room 2 plus its first access fee leave 2; Room 3 plus its access fee leave 17. These clustered expenses are more informative than one global income rate.

## 6. Pedestal growth comparison

Balanced fees/expansions and baseline visitors, with only stand growth changed:

| Growth | Stand total | Active extra minutes / final coins | Typical extra minutes / final coins | Distracted extra minutes / final coins |
| --- | ---: | --- | --- | --- |
| 25% | 446 | 1.92 / 479 | 6.00 / 205 | 17.90 / 259 |
| ~30% | 543 | 2.25 / 476 | 6.00 / 138 | 18.10 / 246 |
| 35% | 663 | 2.25 / 356 | 7.15 / 144 | 22.40 / 0 |

About 30% is a reasonable **playtest starting point**, not a guarantee of strong late purchase pressure. Increasing to 35% removes 120 more coins but raises distracted funding time by 4.3 minutes. Dropping to 25% saves 97 coins without materially shortening typical progression in this schedule.

At the supplied prices, **six of 17 stands cost no more than one visitor's current full payment** at their modeled purchase point:

| Stand | Cost | Fare before purchase |
| --- | ---: | ---: |
| Walchia | 10 | 10 |
| Arthropleura | 14 | 16 |
| Glossopteris | 18 | 22 |
| Captorhinus | 23 | 28 |
| Helicoprion | 30 | 34 |
| Gorgonops tooth | 39 | 40 |

At 25%, eight stands meet that threshold; at 35%, three do. Even the later 75-coin large stand needs only two 42-coin tickets from zero balance; the final 65-coin small stand needs two 48-coin tickets. Several visitor groups are **not** naturally required for late stands. The balanced expansions would each need eight tickets from zero (90/12 and 240/30 rounded up), but accumulated cash reduces actual waits. Visitors arrive singly; “group” here means a conceptual queue batch of up to three, not an implemented arrival group.

## 7. Visitor and site sensitivity

Only the listed visitor parameters change; all prices remain balanced. Values are **additional funding minutes / final coins**.

| Variant: total / unpaid; arrivals for 1/2/3+ displays | Active | Typical | Distracted |
| --- | --- | --- | --- |
| Baseline 6 / 3; 12/10/8s | 2.25 / 476 | 6.00 / 138 | 18.10 / 246 |
| Smaller + slower 4 / 2; 15/12/10s | 4.33 / 300 | 11.00 / 68 | 35.10 / 10 |
| Larger 10 / 5; 12/10/8s | 2.25 / 476 | 3.85 / 228 | 9.30 / 66 |
| Total-cap only 10 / 3; 12/10/8s | 2.25 / 476 | 6.00 / 138 | 18.10 / 246 |
| Unpaid-cap only 6 / 5; 12/10/8s | 2.25 / 476 | 3.65 / 188 | 9.30 / 66 |
| Faster 6 / 3; 8/6/5s | 0.67 / 1,378 | 4.25 / 236 | 15.70 / 258 |
| Slower 6 / 3; 16/14/12s | 5.25 / 186 | 8.85 / 146 | 20.30 / 228 |

The **unpaid backlog** matters much more than total occupancy in these schedules. Increasing only total capacity produces no benefit here. Faster arrivals strongly inflate the active player's surplus. Smaller/slower settings punish intermittent attendance: the distracted player's longest extra wait becomes 384 seconds. Longer assumed tours (56 rather than 28 seconds) change active funding time from 2.25 to 2.83 minutes, leaving typical/distracted totals unchanged; this does not prove all future layouts behave similarly.

Site-count sensitivity for the typical player uses block starts:

- Six sites: 0, 2, 4, 7, 10, 14 displays; blocks contain 2–4 exhibits.
- Eight: 0, 2, 4, 6, 8, 10, 12, 15; blocks contain 2–3.
- Ten: 0, 2, 3, 4, 6, 8, 10, 12, 14, 16; blocks contain 1–2.

| Sites including free first | Fee method | Site spending | Extra funding minutes | Total minutes |
| --- | --- | ---: | ---: | ---: |
| 6 | First five balanced fees | 200 | 5.60 | 107.73 |
| 8 | Seven balanced fees | 365 | 6.00 | 108.23 |
| 10 | Nine fees, extending to 105/120 | 590 | 7.15 | 109.48 |
| 6 | Same total budget, proportionally scaled fees | 365 | 7.70 | 109.83 |
| 8 | Same total budget | 365 | 6.00 | 108.23 |
| 10 | Same total budget, proportionally scaled fees | 365 | 4.65 | 106.98 |

More sites can mean more total expense, but at a fixed budget they can spread costs into smaller installments. Fewer sites with the same total budget front-load larger fees. These timings exclude additional unique-site onboarding/travel beyond the common per-fossil travel assumption; real site count could therefore add more time than this model predicts.

## 8. Early deadlocks and reachability limits

**The proposed unrestricted economy fails the “every valid early order” safety test under the stated assumptions.** This is a risk in the proposed offer policy, not a discovered defect in the current game's two-offer bootstrap.

Assume all four Room 1 stands can be purchased immediately, their separate size sequences advance globally, only Dimetrodon/trilobite can be completed from the free site, and soil rewards can be zero. The search visits **10 distinct owned-set states** (including the starting state and intermediate purchases) and reaches **10 terminal purchase orders**. Two orders strand all cash: **Eryops (12) then Walchia (8), or Walchia (8) then Eryops (12)**. Neither stand has free-site content in that model. No display pays, and neither free-site stand can be bought. Different real content assignments may remove this particular trap; the site graph is not yet defined.

Partial contributions create a stronger risk even if **all four fossils were free-site content**. With prices locked on each type's first contribution (an explicit hypothetical quoting rule), the search visits **23,589 reachable payment/quote states**. Of these, **12,428** cannot finish a free-site Dimetrodon/trilobite stand with remaining cash; **7,676** cannot finish any stand even if all four fossils were accessible for free. These are state counts, not probabilities of child behavior. Examples include distributing all 20 as 6/6/4/4 toward stands quoted at 12/16/8/10: none is complete and no cash remains.

As a contrasting safety experiment, expose only the free-site large and small stands until a paying display exists. Their total cost is 12+8=20. The search covers both terminal whole-purchase orders and **117 contribution states with zero stranded states**. If both are unfinished, their maximum paid amounts are 11+7=18, so some money remains to finish a stand. This proof depends on no other eligible early sinks and genuinely free acquisition/restoration.

**Recommendation for decision:** preserve a provable first-display funding path. Options include restricting initial offers to guaranteed-free-site content, refusing contributions that would eliminate every such path, or approving reversible deposit reallocation. None is implemented here. Global sequence price reservation/reordering also needs a decision before contribution logic can be finalized.

After a paying display, every finite cost is eventually affordable in this model if the player returns, serves and collects. A player who never attends or never collects can still experience a practical stall. Safe modeled site blocks do not establish real acquisition/reconstruction/display reachability or absence of successor-room cycles. Those require the future content graph and dependency validation.

## 9. Other sensitivities and provisional recommendation

- **+1 base admission:** balanced extra funding changes from 2.25/6.00/18.10 to **1.67/4.85/15.70 minutes** for active/typical/distracted. Maximum fare becomes 51; initial large/small fares become 5/3. It does not solve early stranded deposits because zero displays still pay nothing. Prefer base **0** for clarity and less surplus.
- **First small rather than first large:** balanced extra funding is **2.33/6.00/18.10 minutes**. Both deliberately safe routes are viable; that does not rescue unsafe offer orders.
- **Soil sensitivity:** assuming 16 potential rewarded layers per large fossil and eight per small (200 invented modeling units, not authored site content), the production reward hash with seeds 0/1/42 yields **24/22/27 coins**. Typical funding drops only from 6.00 to 5.80 minutes. Distracted outcomes range 17.90–20.10 because extra cash changes bout/collection timing. These policy effects are not evidence that rewards intrinsically harm affordability. Do not rely on random soil to repair a bootstrap failure.
- **Optional 130-coin equipment budget after Room 1:** extra funding becomes **3.83/8.50/24.30 minutes**. Ending coins are 490/140/266 because required additional bouts earn extra revenue. No helper or speed benefit is claimed in this budget-only experiment.
- **Distracted player collecting every bout:** extra funding falls from **18.10 to 15.70 minutes**, with final coins falling from 246 to zero because fewer forced sales occur. A clear pending-cash prompt deserves playtesting before increasing prices or crowds.
- **Room 3 at 300 instead of 240, other balanced prices unchanged:** extra funding becomes **2.58/6.75/22.30 minutes**. Typical Room 3 funding grows from 69 to 126 seconds; distracted funding from 6 to 258 seconds, including collection timing. Active and typical final balances remain 476/138 after extra sales. A higher expansion price is not a reliable cure for habitual over-earning.

**Recommended first human-playtest configuration, not approval to implement:**

| Parameter | Candidate |
| --- | --- |
| Tickets | Base 0; +4 large/+2 small; valid completed displays only; manual collection |
| Stands | Supplied global ~30% sequences, total 543 |
| Site fees | Eight abstract blocks as a test fixture; 0, 20, 30, 40, 50, 60, 75, 90; actual count/content still undecided |
| Expansions | Room 2: 90; Room 3: 240 |
| Visitors | Retain 6 total/3 unpaid and 12/10/8-second baseline for the first test; separately compare 6 total/5 unpaid for intermittent attendance |
| Starting safety | Guarantee at least one complete, free-site paying display remains affordable after every allowed early purchase/contribution |
| Optional aid to test | Clear distinction between coins and pending cash; a collection reminder before an otherwise affordable purchase |

The balanced candidate avoids the slow configuration's 6.4-minute single-purchase delay, but its active-player surplus is substantial: **231 after Room 2 and 476 at completion**. Room 3's 240 price makes that active player only nine coins short; the typical player needs five new tickets and two extra bouts. If the design requires several batches for *every* later purchase, this candidate does not meet that goal. That requirement would also conflict with keeping every small stand meaningful at a 30–50-coin ticket price unless later costs rise sharply or attendance changes.

Prefer testing attendance, collection comprehension and appropriately paced site fees before raising all prices. No finite mandatory catalog can consume unlimited repeatable ticket revenue after completion; decide whether a comfortable finishing surplus is acceptable. New optional sinks would be a separate product decision, not an excuse to add decoration or mechanics in this task.

## 10. Decisions and validation before implementation

1. Define actual sites, fossil acquisition/restoration prerequisites and free-site content. Check no required exhibit depends on a successor room.
2. Choose the early-offer safety rule and how global stand prices are quoted, reserved and updated during partial payments.
3. Approve site counts/prices and room expansion prices separately from this simulation.
4. Specify acceptable waiting and surplus targets. “Enjoyable” and “too rich” are not established by a deterministic budget model.
5. Observe Luka's excavation, assembly, exploration, attendance and collection timings across short sessions. Replace these invented schedules with measured distributions; check tired/distracted behavior and misunderstandings.
6. Design visitor caps and future navigation separately. Calibrate the assumed two-second entry and 28-second occupancy against real room layouts, including longer routes and paused dialogs.
7. Before live +4/+2 pricing, add appropriate versioned financial/save validation. Current ledger storage can represent larger prices, but live display pricing and historical validators must retain their historical meaning. This task changes neither.

## Reproduction and artifacts

Run from the repository root:

```powershell
node scripts/simulate-economy-v2.mjs
node --test tests/economy-v2-simulation.test.ts
npm test
```

The script writes [all parameters and results](7-economy-v2-results.json) and [all main-scenario purchase records](7-economy-v2-purchases.csv). `--out <directory>` changes the destination. `--config <JSON file>` runs one configurable scenario; for example:

```json
{"style":"typical","pricing":"balanced","growth":35,"visitors":"queueOnly","siteCount":8,"base":0,"soilSeed":null,"roomCosts":[90,240]}
```

Other supported experiments include `fixedSiteBudget`, `optional`, `tour`, `smallFirst` and `collectEvery`; see the source's exported parameter tables. Results contain no wall-clock timestamp or random runtime input. The CSV carries full purchases for the nine 30% main runs; JSON includes all 82 progression runs and 12 rate windows. Duplicate baseline entries in sensitivity groups are intentional controls, not independent samples.

Validation: **8/8 isolated model tests; 469/469 full unit tests**, no failures/skips. Tests cover valid displays, exact global sequences, attendance/pending/caps, conservation in every scenario, room membership/order, deterministic soil, and exhaustive early-state checks. A second complete simulation run produced byte-identical JSON and CSV files, verified by SHA-256; the CSV contains 234 purchase records. No application build or browser regression was run for this isolated analysis; this task changes no application code. A before/after hash inventory confirmed that production and all prior files are unchanged; only the five new research files were added. All new work remains uncommitted.

## Independent engineering assessment

- **High, verified conditional design risk:** unrestricted early deposits can exhaust all 20 coins without a paying display. The explicit counterexample survives even if all Room 1 fossils are freely obtainable. The approved future offer/quote policy is still missing, so this is not a claim that a currently implemented game path is broken.
- **High, modeling limitation:** assumed site accessibility and timings cannot establish real progression reachability or enjoyment. No full excavation graph exists. Do not approve balance solely from the successful scripted routes.
- **Medium, verified model outcome:** +4/+2 makes six supplied-price stands payable by one visitor; frequent attendance leaves a large surplus. Thirty-percent growth is a reasonable compromise for typical play, not strong late-game scarcity. Faster arrivals amplify the surplus markedly.
- **Medium, recommendation:** retain baseline visitors initially and investigate pending-cash comprehension. Queue capacity affects intermittent players much more than increasing total occupancy alone; test that independently before adding crowds or raising expansion prices.
- **Medium, future integration risk:** room credit, mixed cash/credit spending, live ticket pricing and historical accounting require their own versioned implementation/validation. Fresh-game viability must remain independent of legacy investment.
- **Low, numerical limitation:** deterministic bouts create threshold/parity effects; higher prices or more soil can shift visits and produce non-monotonic cash/wait outcomes. The reported precision aids reproducibility, not confidence intervals. Actual human playtesting is required for every proposed timing, acceptable wait, collection cue and visitor-setting recommendation.
