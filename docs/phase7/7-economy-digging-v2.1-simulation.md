# Phase 7 — Economy & Digging Simulation v2.1

**Research only, 11 November 2026. No production gameplay, prices, purchases, room geometry, save schema or player save was changed. All work remains uncommitted.**

## SIMULATION RESULTS

The model completes all **103 full-museum scenarios**, plus **28 excavation productivity probes** and **12 visitor windows**, without negative balances or missing/duplicated required parts. This verifies the synthetic routes and accounting, **not complete excavation-site reachability in the actual game**. Fourteen exhibits still lack implemented acquisition content. All 17 exhibits use explicitly synthetic excavation placement and activity timing here, including the three implemented species.

The proposed rules are financially viable under eventual cashier attendance and collection, but **no tested package satisfies every balance aspiration**. Moderate depth needs 4975 base-power swings and 165.4 typical active-play minutes with no equipment. Three unupgraded helpers reduce this to 93.48 minutes, but five fully upgraded helpers finish a five-layer benchmark in 4.03 minutes without the player. Their purchase/upgrade costs can cancel much of the whole-museum time benefit. Room-based queues leave substantial finishing cash and often remove extra saving for Room 3. Deeper sites do not necessarily take longer once the crew grows.

These are accumulated active-play minutes across sessions, not suggested continuous sessions for Luka. Precision supports repeatability; it does not imply measured human accuracy.

## Existing production baseline — verified source behavior

The source, rather than old historical prices, establishes the baseline:

| System | Current production behavior | Source |
| --- | --- | --- |
| Economy | 20 starting coins; seeded 12.5% chance of one coin per cleared cell-layer, claimed once | [content](../../src/content/economy.ts), [rules](../../src/game/economy.ts) |
| Tickets | 0 before a valid display; otherwise 1 + unique completed display count (currently 2/3/4). Payment becomes pending; explicit collection makes it spendable | [ledger](../../src/game/ticket-ledger.ts), [cash](../../src/game/cash.ts) |
| Visitors | 12/10/8-second arrivals at 1/2/3+ displays; one second of attended service; six total visitors and three unpaid | [content](../../src/content/visitors.ts), [rules](../../src/game/visitors.ts) |
| Visitor time | Museum only; dialogs/hidden/unfocused/save-blocked frames do not advance visitors. Tours use up to two displays, 3.5–6.5s viewing each plus navigation at 2.4 units/s. Travel/reload retire paid visits without repayment and retain unpaid visitors | [simulation](../../src/game/visitor-simulation.ts), [application](../../src/app/prototype.ts), [travel](../../src/game/world-map.ts) |
| Digging | 8 × 8 cells, configurable layers, whole upper layer cleared before lower work; two hits/layer, nominal 1s player swing. Later depth grows per sequential site | [definitions](../../src/content/journey.ts), [rules](../../src/game/journey.ts) |
| Helper | One offered at 60; needs two displays and second-site ownership; effective two-hit cell time 6s plus walking; works only with player in the same pit | [definitions](../../src/content/helpers.ts), [rules](../../src/game/helpers.ts), [simulation](../../src/game/helper-simulation.ts) |
| Storage | Original-site custody and manual cleaning/collection; one slot per finite authored find, rather than a small purchasable capacity | [storage](../../src/game/storage.ts), [decision](../decisions.md) |
| Equipment | Boots 16 (+20% walking), shovel 24 (0.8s swing, same two hits), helper tools 30 (+25% work rate) | [definitions](../../src/content/upgrades.ts) |
| Purchases | Dimetrodon/trilobite/Eryops stands 12/8/12; west wing 18; second site 24. Current stands have no site prerequisite. Partial contributions exist | [stands](../../src/content/purchases.ts), [sites](../../src/content/world-map.ts) |
| Persistence | Schema 24; historical west-wing credit is reserved for future expansion. The research starts fresh with zero credit | [save](../../src/persistence/save.ts), [credit](../../src/game/expansion-credit.ts) |

This extends the [previous economy study](7-economy-v2-simulation.md), reusing its exact stand-price arrays, cashier/exploration schedules and the production deterministic soil-reward function. The previous fixed per-fossil acquisition duration is replaced by cell work, workers, custody and travel. Its visitor class is not reused because the requested queue/occupancy distinction is different. Old reported completion times are therefore not directly comparable.

## Proposed parameters and reproducible assumptions

Tickets count each valid completed display once: +4 large, +2 small, no base fee; room-end fares are 12, 30 and 50. Global large prices are **12, 16, 20, 26, 34, 45, 58, 75**; global small prices **8, 10, 14, 18, 23, 30, 39, 50, 65**. They do not restart by room. Mandatory baseline spending is **543 stands + 365 sites + 330 rooms = 1,238 coins**.

Room 1 is owned initially. Room 2 requires all four Room 1 displays and payment; Room 3 requires all six Room 2 displays and payment. Eligibility alone never grants ownership. The opening offer is only Dimetrodon's 12-coin stand, leaving eight coins and free access to its complete synthetic recipe. No paying visitors before that first display; no recurring costs, completion rewards, salaries, maintenance or credit.

The eight sites below are **fixtures, not an approved content graph**. Access to any site in an owned room is assumed purchasable without predecessor-site closure or successor-room ownership. This deliberately avoids inventing unknown dependencies. The default display order follows each row left to right, with rooms completed in order.

| Site | Room | Synthetic fossils | Layers: standard / deeper | Access cost |
| --- | --- | --- | --- | --- |
| 1 | 1 | Dimetrodon, trilobite | 1 / 1 | 0 |
| 2 | 1 | Eryops, Walchia | 2 / 2 | 20 |
| 3 | 2 | Moschops, Arthropleura | 3 / 3 | 30 |
| 4 | 2 | Estemmenosuchus, Glossopteris | 3 / 4 | 40 |
| 5 | 2 | Edaphosaurus, Captorhinus | 4 / 5 | 50 |
| 6 | 3 | Gorgonops, Helicoprion | 4 / 5 | 60 |
| 7 | 3 | Scutosaurus, Gorgonops tooth, Inostrancevia | 5 / 6 | 75 |
| 8 | 3 | Dicynodon, Permian ammonoid | 5 / 7 | 90 |

Each layer has 64 cells. Soft/medium/resistant material has resistance 1/2/3 with nominal shares 55%/30%/15%; a deterministic column/layer/site hash allocates discrete cells (small rounding differences are intentional). Irregular sites use 40% resistant material on alternating layers. Additional 0% and 40% resistant-share experiments isolate material mix. All resistance and power inputs must be finite and positive: every cell is breakable at base power.

Every large recipe has six synthetic parts; every small exhibit one. There are 57 unique fossil parts. Default placement spreads them between 20% depth-through-work and the final cell; deepest-layer and clustered alternatives change where discoveries occur. Whole-layer access remains sequential. No navigation, fossil footprint geometry, pathfinding, animation collision or actual authored site reachability is simulated. There is no forced 90% stop or player-only find. Helpers may fully recover and clear a site.

| Assumed timing, seconds | Active | Typical child | Distracted |
| --- | --- | --- | --- |
| Player swing / move per cell | 1 / 0.25 | 1.2 / 0.4 | 1.5 / 0.65 |
| Clean each part | 10 | 18 | 30 |
| Large assembly / small placement | 30 / 12 | 60 / 25 | 120 / 45 |
| Round-trip museum/site travel | 30 | 45 | 60 |
| Explore museum after display | 12 | 25 | 60 |
| Cashier bout | 20 | 12 | 6 |
| Routine bout every N displays | 1 | 2 | 3 |
| Collect pending every N bouts | 1 | 1 | 2 |
| Explore between funding bouts | 15 | 45 | 120 |

Other timing assumptions: helper power starts at 1, swing 1.5s, movement 0.6s/cell. This is a proposed stronger baseline than the live half-power helper, not a measurement of production productivity. Chest interaction takes 3s; purchase interaction 3s; entrance-to-queue 2s; queue advance 0.9/2.4s; paid occupancy 28s, with 14/56/120s sensitivity. Helpers have no additional per-item delivery walk in this abstract model: cell movement and chest availability stand in for it. That favors their speed; real return-to-chest routing must be measured.

Each helper has its own power, task and assignment. Only a player visit activates a site; new workers are explicitly assigned on a visit. The main policy assigns the entire crew to the currently visited site. Helpers continue there during museum exploration, service, cleaning, assembly, purchase time and travel while simulation is running. Global pause/closure advances nothing and adds no elapsed-time catch-up. Visitors retain their production museum-only/dialog-paused clock. No automatic cashier is introduced.

Player findings enter the carried inventory; helper findings enter the original site's chest. The player polls/collects the local chest while digging, paying the 3s interaction time, and collects again before return. The carried bag is unlimited. All carried parts are deposited at the museum after the modeled return journey; cleaning and reconstruction remain manual modeled activities there. This is the requested proposed transport flow, not a claim that current production cleans stored fossils at the museum. Main chest capacity is 12; capacities 1/4/24 and doubled travel times are alternatives. Independent unattended probes collect every 60/180s without charging travel, isolating chest backpressure from transport.

Only cell tasks advance automatically. Helpers never transport to the museum, clean, assemble, display, purchase, spend or grant rooms. Each item has exactly one custody state: buried, chest, carried or museum. Exclusive cell reservations prevent duplicate work claims. A full chest retains finished work; reveal bursts larger than its capacity deposit incrementally without deleting items. Interrupted player work releases its reservation and retains its work fraction so an absent player cannot block a layer. These are tested simulation rules, not production persistence guarantees.

Normal helper purchase milestones are 2/5/8/11/14 completed displays; early milestones 1/2/4/6/8; late 6/8/10/12/14. Player upgrade milestones are 2/6/11; helper levels 6/11 displays. These are **purchase policies, not proposed mandatory unlock gates**. The selected policy saves until it can buy all requested optional equipment, after buying the next required stand. It is not an optimizer, and a child may simply defer a purchase. Newly hired late workers buy earlier selected upgrade levels at the next opportunity. Quotes never spend pending income.

Main runs use zero soil rewards to prove independence from lucky drops. Three optional reward runs use the real hash over all actually cleared synthetic cell-layers; unlike the previous study's small invented reward sample, deeper pits contain many more reward units. Other recoverable item types use the same tested custody mechanism, but there is no invented loot distribution or sale value in the economic matrix.

## Simulation methodology and limits

Full routes use deterministic **0.05s steps**. Continuous accumulated cell work is normalized to integer required hits: `ceil(materialResistance × siteLayerMultiplier / workerPower)`. Per-cell movement is added. A task retains its original power until completion; future cells use a purchased upgrade. Reassigned work retains its completed fraction. Reported player workload in mixed-crew runs can consequently be a fractional **hit equivalent**. Layer work tables are integer hit requirements at a fixed power. Current digging is automatic proximity shoveling, so swing counts must not be described as literal required mouse clicks.

Independent productivity probes use 0.25s steps and include quantized movement; analytical tables use exact nominal seconds. The coarse-step full-route controls produce 171.18 versus 165.4 minutes for no helpers, and 95.09 versus 93.83 for five. Final balances can shift by a whole ticket batch (184 versus 390), so small surplus differences should not determine balance. Floating-point remainder handling has a focused regression test.

Total completion includes excavation, transport, cleaning, assembly, routine exploration/service and forced funding. **Extra funding** counts additional cashier bouts and the inter-bout exploration required for purchases; it is not all idle time and may overlap useful background excavation. Site recovery duration is elapsed active-game time from activation until all parts are recovered, including intervening museum work; it is not exclusively digging time. JSON records recovery, full clearance, room milestones, activity totals and every transaction separately.

Admission uses the current displayed fare at service time. Occupancy is reserved before payment; a full museum can accumulate waiting visitors but cannot admit or charge them. Blocked arrivals reset the clock. Service/exit ticks do not also spawn arrivals, preserving the production update priority. Paid tours expire explicitly; returning from travel retains unpaid queue entries and retires paid tours. Revenue stays pending until a modeled collection action. No offline time, salaries or losses are hidden in the budget:

`coins + pending + all purchases = 20 + ticket income + claimed soil coins`.

The matrix is a structured sensitivity study, not a statistical sample or exhaustive Cartesian product. Some controls repeat intentionally. The 24-hour simulation limit catches a non-progressing policy; it is not a gameplay limit. No empirical child behavior, real chest delivery paths, browser performance, save failure recovery for these new mechanics, or all possible site/stand graphs has been established.

## Depth, resistance and excavation work

The presets are examples; each site's independent `multipliers`, `cellsPerLayer` and per-layer material arrays can override them through `siteDefinitions`. A test changes only Site 2 to four irregular layers/material patterns while Site 1 remains one layer. There is no universal depth array requirement.

| Curve | Layer multiplier examples | All-site base hits | Exact solo digging minutes | Cells requiring ≥6 hits | Worst cell hits | Typical museum minutes: 0 / 3 helpers |
| --- | --- | --- | --- | --- | --- | --- |
| gentle | 1, 1.15, 1.3, 1.5, 1.7 | 4097 | 93.46 | 19 | 6 | 147.84 / 88.96 |
| moderate | 1, 1.35, 1.7, 2.2, 2.8 | 4975 | 111.02 | 154 | 9 | 165.4 / 93.48 |
| steep | 1, 1.6, 2.4, 3.5, 5 | 6408 | 139.68 | 232 | 15 | 194.06 / 101.14 |
| deep | 1, 1.2, 1.4, 1.65, 1.9, 2.2, 2.5 | 5662 | 127.32 | 68 | 8 | 181.7 / 98.86 |
| irregular | 1, 1.7, 1.2, 2.4, 1.8 | 5526 | 122.04 | 296 | 8 | 176.42 / 97.17 |

Moderate five-layer resistant cells need nine swings; steep ones need fifteen. At a typical 1.2s swing, that is 10.8s or 18s at one cell before moving, an obvious repetitive-work risk even with automatic digging. Gentle still increases cumulative work with depth while sharply reducing these long individual waits. Added layers also increase how much ground must be traversed, even if power reduces the hits. Equal-depth sites can differ by material placement and recipe distribution; monotonic duration is not guaranteed for every successive site.

| Moderate site | Integer hits by layer | Weighted material work | Exact solo digging min | Elapsed recovery min: no helper / 3 helpers |
| --- | --- | --- | --- | --- |
| site-1 | 103 | 103 | 2.49 | 6.6 / 6.6 |
| site-2 | 103 / 178 | 243.4 | 6.47 | 10.79 / 4.36 |
| site-3 | 102 / 175 / 202 | 411.4 | 10.86 | 14.98 / 7.25 |
| site-4 | 102 / 176 / 206 | 414.8 | 10.96 | 15.08 / 4.89 |
| site-5 | 102 / 176 / 208 / 270 | 643.1 | 16.83 | 20.94 / 5.54 |
| site-6 | 102 / 176 / 208 / 270 | 643.1 | 16.83 | 21.14 / 5.58 |
| site-7 | 102 / 175 / 208 / 268 / 306 | 926.5 | 23.31 | 29.61 / 8.78 |
| site-8 | 102 / 175 / 206 / 268 / 306 | 924.8 | 23.27 | 25.51 / 7.81 |

See the appendix for per-layer hits for every curve/site, and the JSON for each layer's nominal seconds, maximum hits and repetition count. Fossil placement changes whole-route time independently of difficulty: three helpers take 87.64 minutes with clustered finds, 93.48 with spread finds and 98.91 with deepest-layer finds. Resistant share 0%/15%/40% gives solo museum totals 148.22/165.4/193.26 minutes. Thus both content placement and material proportion need tuning, not just a single depth multiplier.

## Player power and assistant productivity

Additive means `power = 1 + level × increment`; multiplicative means `power = (1 + increment)^level`. Upgrade prices are incremental payments, not cumulative totals. Three player upgrades cost 40/90/180 (310 total).

| Player increment/scaling | Power at level 3 | Museum min | Extra funding min | Actual player hit equivalents | Net min saved vs no upgrades |
| --- | --- | --- | --- | --- | --- |
| 25% additive | 1.75 | 140.11 | 4.65 | 3568 | 25.29 |
| 25% multiplicative | 1.95 | 139.35 | 4.65 | 3530 | 26.05 |
| 50% additive | 2.5 | 126.31 | 4.65 | 2878 | 39.09 |
| 50% multiplicative | 3.38 | 119.13 | 4.65 | 2519 | 46.27 |
| 75% additive | 3.25 | 118.31 | 4.65 | 2478 | 47.09 |
| 75% multiplicative | 5.36 | 112.71 | 4.65 | 2198 | 52.69 |

Every compared level reduces total moderate-fixture work, but rounding creates local plateaus. For example, +25% power does not reduce a resistance-2, multiplier-1 cell's two-hit requirement. +50% additive yields powers 1/1.5/2/2.5, easier to explain and less aggressive than multiplicative 1/1.5/2.25/3.375. Nothing becomes unbreakable without these optional upgrades.

An isolated Site 7 (320 cells, five layers, 13 parts) benchmark starts all requested workers already owned, upgraded, assigned and activated. Unlimited-enough chest storage and zero travel cost isolate work rate. **These times exclude earning the workers and finishing exhibits.**

| Assistants | No upgrades, seconds | +50% level 1, seconds | +50% level 2, seconds |
| --- | --- | --- | --- |
| 1 | 1828.5 | 1351.5 | 1171.5 |
| 2 | 919.25 | 680.75 | 590 |
| 3 | 623 | 459.25 | 397 |
| 4 | 468.5 | 346.25 | 301.25 |
| 5 | 377 | 278.75 | 241.75 |

Five helpers at level 2 take **241.75s** versus one base helper **1,828.5s**, a **7.56×** speedup. The base player alone takes 1,464.5s in this coarse benchmark; joining the five upgraded workers reduces it to 208.25s. For five level-2 workers, +25% additive takes 278.75s, +50% 241.75s and +75% 216.25s. +75% multiplicative reaches 183.25s. Most time is still spent transporting, processing fossils and funding purchases in the full route; a fast pit does not imply a fast museum.

One optional diminishing-return experiment scales helper work by `1 / (1 + 0.15 × (count - 1))`; five level-2 helpers then need 364.75s, and their full museum takes 96.39 instead of 92.86. This is **not an approved mechanic** and should not be used to conceal arbitrary stops. First measure actual worker movement, crowding and delivery overhead; these may supply sufficient natural constraints.

Helper upgrades cost 60 then 140 **per worker**. The next table measures time return after paying those costs; it is not a promise of coin repayment. Helpers do not sell tickets, and the same corpus supplies the same fossil value.

| Workers | Increment | Museum min: level 0 / 1 / 2 | Net min saved by level 1 | Additional min saved by level 2 | Level 1 / level 2 incremental spend |
| --- | --- | --- | --- | --- | --- |
| 1 | 25% | 112.83 / 110.74 / 107.98 | 2.09 | 2.76 | 60 / 140 |
| 1 | 50% | 112.83 / 105.9 / 104.14 | 6.93 | 1.76 | 60 / 140 |
| 1 | 75% | 112.83 / 103.17 / 100.88 | 9.66 | 2.29 | 60 / 140 |
| 3 | 25% | 93.48 / 92.95 / 92.36 | 0.53 | 0.59 | 180 / 420 |
| 3 | 50% | 93.48 / 89.33 / 89.96 | 4.15 | -0.63 | 180 / 420 |
| 3 | 75% | 93.48 / 87.79 / 88.46 | 5.69 | -0.67 | 180 / 420 |
| 5 | 25% | 93.83 / 93.06 / 94.99 | 0.77 | -1.93 | 300 / 700 |
| 5 | 50% | 93.83 / 90.56 / 92.86 | 3.27 | -2.3 | 300 / 700 |
| 5 | 75% | 93.83 / 89.18 / 91.94 | 4.65 | -2.76 | 300 / 700 |

A negative marginal saving means the higher level lengthens this policy's complete route despite faster digging. Upgrades should therefore remain optional; the second helper level, especially purchased on a late worker, is a weak-value purchase in a finite museum. The JSON purchase log gives each upgrade's actual fare, coins, pending amount and wait. At fare 18 a 60-coin upgrade needs four tickets from zero; at fare 34 a 140-coin level needs five. These are affordability counts, not automatic upgrade-generated income.

## Whole-museum financial progression

| Style/helpers | Total min | Extra funding min | Longest purchase wait, s | Tickets | Ticket income | End coins / pending |
| --- | --- | --- | --- | --- | --- | --- |
| active-0 | 127.72 | 2.58 | 55 | 68 | 1670 | 452 / 0 |
| active-1 | 90.92 | 5.25 | 160 | 84 | 1766 | 448 / 0 |
| active-2 | 79.3 | 6.75 | 160 | 96 | 1960 | 462 / 0 |
| active-3 | 74.33 | 8.25 | 160 | 108 | 2252 | 454 / 0 |
| active-4 | 73.2 | 9.75 | 160 | 120 | 2662 | 404 / 0 |
| active-5 | 74.58 | 11.83 | 160 | 136 | 3334 | 396 / 0 |
| typical-0 | 165.4 | 1.95 | 69 | 67 | 1658 | 440 / 0 |
| typical-1 | 112.83 | 5 | 183 | 86 | 1768 | 450 / 0 |
| typical-2 | 98.76 | 6.55 | 183 | 97 | 1980 | 482 / 0 |
| typical-3 | 93.48 | 8.45 | 183 | 112 | 2386 | 588 / 0 |
| typical-4 | 92.64 | 9.6 | 183 | 120 | 2650 | 392 / 0 |
| typical-5 | 93.83 | 11.7 | 183 | 136 | 3328 | 390 / 0 |
| distracted-0 | 238.09 | 7.1 | 132 | 65 | 1562 | 344 / 0 |
| distracted-1 | 166.32 | 17.7 | 636 | 86 | 1684 | 366 / 0 |
| distracted-2 | 154.08 | 24 | 636 | 97 | 1762 | 80 / 184 |
| distracted-3 | 148.35 | 26.3 | 636 | 110 | 2162 | 364 / 0 |
| distracted-4 | 152.44 | 32.6 | 636 | 122 | 2522 | 80 / 184 |
| distracted-5 | 157.92 | 39 | 636 | 139 | 3236 | 114 / 184 |

The no-assistant, no-upgrade routes all finish. With typical attendance, three helpers remove 71.92 minutes and 72.89% of player work. Five base helpers do not improve total completion over three enough to justify describing them as a required progression step. The distracted five-helper route spends 39 extra minutes funding purchases; adding all player/helper upgrades raises that to 54.2, with a longest individual delay of 636 seconds. Expensive optional purchases can be a practical waiting problem even when no permanent deadlock exists.

| Typical configuration | Room 1 min (cumulative) | Room 2 min (cumulative) | Room 3 min (cumulative) | Incremental room durations | Ending coins + pending |
| --- | --- | --- | --- | --- | --- |
| typical-0 | 21.91 | 80.86 | 165.4 | 21.91 / 58.95 / 84.55 | 440 |
| typical-1 | 21.73 | 61.03 | 112.83 | 21.73 / 39.29 / 51.8 | 450 |
| typical-3 | 21.73 | 58.09 | 93.48 | 21.73 / 36.35 / 35.39 | 588 |
| typical-5 | 21.73 | 58.09 | 93.83 | 21.73 / 36.35 / 35.74 | 390 |
| helper-3-1-0.5 | 21.73 | 57.94 | 89.33 | 21.73 / 36.21 / 31.38 | 576 |
| combined-3 | 22.36 | 58.19 | 89.23 | 22.36 / 35.83 / 31.03 | 376 |
| candidate-three | 22.23 | 56.83 | 85.26 | 22.23 / 34.61 / 28.42 | 488 |

| Typical baseline/optional | Activity digging min | Travel min | Chest interaction min | Cleaning + assembly min | Museum exploration + desk min |
| --- | --- | --- | --- | --- | --- |
| typical-0 | 111.02 | 12.75 | 0.85 | 28.85 | 10.63 |
| typical-3 | 31.34 | 12.75 | 1.95 | 28.85 | 17.13 |
| helper-5-2-0.5 | 23.77 | 12 | 1.75 | 28.85 | 24.43 |
| candidate-three | 20.32 | 12 | 1.75 | 28.85 | 20.58 |

### Assistant purchase prices, timing and upgrade affordability

Price sequences are cheap **60/100/160/240/360** (920 total), middle **100/180/300/460/680** (1,720), expensive **160/280/460/700/1,000** (2,600). These are one-time purchases, each worker more expensive than the previous.

| Price/timing policy, five helpers | Total min | Extra funding min | Longest wait, s | Final coins / pending |
| --- | --- | --- | --- | --- |
| cost-cheap-early | 87.49 | 13.8 | 183 | 590 / 0 |
| cost-cheap-late | 98.74 | 4.85 | 69 | 250 / 0 |
| cost-balanced-early | 96.94 | 23.25 | 297 | 436 / 0 |
| cost-balanced-late | 102.54 | 8.65 | 126 | 448 / 0 |
| cost-expensive-early | 107.99 | 34.3 | 468 | 446 / 0 |
| cost-expensive-late | 105.79 | 11.9 | 183 | 290 / 0 |
| cost-cheap-normal | 89.83 | 7.7 | 126 | 454 / 0 |
| cost-expensive-normal | 99.13 | 17 | 297 | 346 / 0 |

Early saving happens at lower fares; it can be slower overall than waiting for more exhibits. This is not evidence for a mandatory artificial display gate. New workers may also have no assignment until the next visit, explicitly modeled. Compare actual moments for the typical three-helper route:

| Purchase | Cost | At display count | Fare | Purchase minute | Spendable before → after | Pending before | Extra wait s / bouts / tickets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| helper-1 | 100 | 2 | 6 | 12.09 | 0 → 8 | 0 | 183 / 4 / 18 |
| room-2 | 90 | 4 | 12 | 21.93 | 86 → 8 | 0 | 12 / 1 / 1 |
| helper-2 | 180 | 5 | 16 | 33.92 | 64 → 76 | 0 | 69 / 2 / 12 |
| helper-3 | 300 | 8 | 24 | 47.49 | 148 → 40 | 0 | 69 / 2 / 8 |
| room-3 | 240 | 10 | 30 | 58.09 | 257 → 17 | 0 | 0 / 0 / 0 |

Combined three-worker/player-upgrade prices scaled to 60%/100%/160% yield totals 87.33/89.23/93.63 minutes, with funding 11.15/13.05/17.45 minutes. The lower cost does not change excavation power; it changes when cash becomes available. Spending on all upgrades is never required by a site or stand gate.

### Rooms, site fees, income and surplus

| Zero-equipment fee configuration | Site spending | Room spending | Total min | Extra funding min | End coins |
| --- | --- | --- | --- | --- | --- |
| room-50 | 365 | 170 | 164.25 | 0.8 | 488 |
| typical-0 | 365 | 330 | 165.4 | 1.95 | 440 |
| room-160 | 365 | 560 | 167.3 | 3.85 | 530 |
| sites-12 | 210 | 330 | 164.45 | 1 | 515 |
| sites-30 | 545 | 330 | 167.1 | 3.65 | 506 |

The 90/240 expansion prices require eight tickets each from zero at room-end fares 12/30. But queue batches are 6/10/14, and cash accumulated before the gate often pays the bill. Typical baseline Room 2/3 extra waits are 12s / 0s. Therefore the aspiration of occasional multi-batch saving is met mainly by assistants, not reliably by later expansions. Raising every price to absorb high-attendance cash would punish distracted play.

Optional soil rewards produce:

| Seed | Soil coins actually claimed | Extra funding min | Final coins |
| --- | --- | --- | --- |
| 0 | 174 | 7.65 | 680 |
| 1 | 239 | 6.9 | 583 |
| 42 | 197 | 6.9 | 517 |

Deepening sites increases the supply of one-time soil coins. Keeping the production drop probability without reconsidering total excavatable cells increases surplus; a zero-reward proof of solvency is not a recommendation to silently remove the live reward system.

Endgame repeatable income has no finite bound while tickets continue and the finite purchase catalog is exhausted. The proposed absence of recurring costs is preserved. No new sinks, fees, taxes or punishments are invented to conceal this design tradeoff. The numerical target for an acceptable finishing balance remains undecided.

## Room-based visitor capacity and throughput

The proposed limits are queue/paid occupancy **6/6, 10/12, 14/18** by **rooms purchased**, not rooms completed. Maximum possible combined populations are consequently 12/22/32. The queue is not the museum's total capacity. Capacity is checked before charging a ticket; a full museum still accepts arrivals into free queue slots. No further visitor spawns into a full queue.

| Owned rooms | Occupancy s | Cap model | Tickets in 10 continuously attended min | Revenue/min | Peak queue / admitted |
| --- | --- | --- | --- | --- | --- |
| 1 | 28 | proposed room caps | 73 | 87.6 | 1 / 4 |
| 1 | 28 | live 6 total / 3 queue | 73 | 87.6 | 1 / 4 |
| 1 | 120 | proposed room caps | 30 | 36 | 6 / 6 |
| 1 | 120 | live 6 total / 3 queue | 30 | 36 | 1 / 6 |
| 2 | 28 | proposed room caps | 73 | 219 | 1 / 4 |
| 2 | 28 | live 6 total / 3 queue | 73 | 219 | 1 / 4 |
| 2 | 120 | proposed room caps | 60 | 180 | 10 / 12 |
| 2 | 120 | live 6 total / 3 queue | 30 | 90 | 1 / 6 |
| 3 | 28 | proposed room caps | 73 | 365 | 1 / 4 |
| 3 | 28 | live 6 total / 3 queue | 73 | 365 | 1 / 4 |
| 3 | 120 | proposed room caps | 73 | 365 | 1 / 15 |
| 3 | 120 | live 6 total / 3 queue | 30 | 150 | 1 / 6 |

These windows continuously attend the desk, collect no cash and make no purchases; reported revenue remains pending. They are **not typical realized spending rates**. At 28s occupancy, even six admitted slots can absorb the eight-second arrival stream, so larger occupancy alone barely changes continuous throughput. At 120s, the room caps materially change admissions (30/60/73 tickets for Rooms 1/2/3 versus 30 under the live total cap). Queue storage matters when the player attends intermittently.

In the typical three-helper whole route, live 6-total/3-queue caps give 18 funding minutes; fixed proposed 6-queue/6-occupancy gives 9.4; growing room caps give 8.45. Occupancy durations 14/28/56/120s give 8.45/8.45/8.45/11.85 funding minutes. The museum's true navigation and departure timing must be validated before relying on a larger queue's income benefits.

## Chest and transport constraints

With five level-2 helpers, the full museum's baseline 12-slot chest incurs 0 blocked worker-seconds. Reducing it to one slot produces 1224.5 blocked worker-seconds and 93.93 total minutes. Four slots give 324.6 worker-seconds and 92.86 minutes. A worker-second sums time across workers and can exceed wall time; it must not be mistaken for extra completion time.

| Unattended five upgraded helpers | Collection interval s | Complete 320-cell site s | Blocked worker-seconds |
| --- | --- | --- | --- |
| 1 chest slots | 60 | 720.25 | 996.75 |
| 1 chest slots | 180 | 2160.25 | 3976.75 |
| 4 chest slots | 60 | 241.75 | 0 |
| 4 chest slots | 180 | 540.25 | 399.75 |
| 12 chest slots | 60 | 241.75 | 0 |
| 12 chest slots | 180 | 241.75 | 0 |

A one-slot chest with visits every three minutes stretches a 241.75s job to 2,160.25s. This is a transport-frequency bottleneck, not lost progress. The main policy frequently collects while physically at the site, so it is more optimistic than that unattended probe. With the 12-slot chest, doubling typical round-trip travel from 45s to 90s changes the full five-upgraded-helper route from 92.86 to 104.92 minutes using the equivalent nonbinding 24-slot chest (the 12/24-slot standard runs match). Manual travel remains substantial even when digging is highly automated.

Prefer retaining production's **one slot per finite site find** (plus every configured recoverable item), avoiding forced capacity shopping. A 12-slot test is not approval to reduce storage: synthetic Site 7 already contains 13 parts. For the eight fixtures, capacity 13 or more accommodates every fossil; real sites must size from their actual item manifest. A finite carried bag, separate helper delivery paths, multiple simultaneous assignments, item stacking and transport upgrades are not modeled or approved. They must not be silently inferred from these results.

## Progressive pedestal validation and deadlocks

The candidate rule derives unique valid displays from restored and assembled part IDs, correct owned stand, actual placement and owned room. It does not trust a completion counter. It permits a stand only when `ownedStands < uniqueValidDisplays + 1`, with an additional initial Dimetrodon-only condition and room/reachable-content filter. Buying the stand consumes that opportunity; repeated/invalid display records never mint another. All actual scenarios recheck the offer before spending and require complete predecessor displays before room purchase.

The opening partial-payment path is safe for every paid amount 0–12: starting cash minus paid always covers the remaining first-stand price, and its site/content is free in the fixture. No optional purchase is attempted before income exists. After the first valid display, finite costs are eventually affordable if the player returns, attends the cashier and collects; no tax or salary can drain the balance. A never-attended desk or never-collected pile is still a practical stall. The scripted recovery policy assumes the player understands both actions.

| Valid room-constrained stand order, 3 helpers | Total min | Extra funding min | Site round trips | Final coins | Player hit equivalents |
| --- | --- | --- | --- | --- | --- |
| typical-3 | 93.48 | 8.45 | 17 | 588 | 1348.88 |
| order-small | 96.59 | 8.65 | 11 | 412 | 1675.13 |
| order-large | 97.53 | 8.05 | 16 | 476 | 1568.88 |
| order-reverse | 102.44 | 9.95 | 9 | 586 | 1921.21 |

Dimetrodon remains first in all orders. Small-first, large-first and reversed orders are each restricted to the owned room. The synthetic site mapping remains fixed when changing order, so batching and acquisition timing genuinely change; the simulator does not quietly relocate fossils to make an order work. All four routes complete. This is not an exhaustive graph proof.

**Recommend room-specific ordered offer lists with one global outstanding opportunity**, preserving global size price counters. A single global 17-entry sequence is slightly simpler to index but tightly couples all content/site changes to one chain. Room lists match the existing metadata and isolate later revisions. For the child-facing first implementation, show one next reachable offer in the current room, after the prior one is displayed; do not expose a confusing shopping grid. At a room boundary, retain the opportunity but offer the required room purchase before a successor-room stand. Author-time validation must reject an ordered required exhibit whose acquisition/assembly/display needs a successor room. If no configured next exhibit is reachable, fail content validation; do not silently skip an impossible requirement or unlock a room for free.

Future partial payments must reserve one concrete offer and its category quote. The model performs whole purchases and proves the opening contribution budget only; it does not implement or certify new production receipt/migration/contribution rules. Removing a displayed exhibit after purchasing its successor, selling/refunding stands and changing order mid-deposit are outside the model and need explicit rules if introduced.

## RECOMMENDED BALANCE

Use the following as a **bounded playtest starting point**, not an approved production configuration or claim that all targets are met:

| Parameter | Candidate and rationale |
| --- | --- |
| Material resistance | Soft 1, medium 2, resistant 3; nominal 55/30/15% mix. Test irregular pockets separately; avoid blanket steep soil. |
| Site 1 | [1.00], 64 cells; retain a gentle opening. |
| Site 2 | [1.00, 1.15]. |
| Sites 3–4 | Independent [1.00, 1.15, 1.30] definitions. |
| Sites 5–6 | Independent [1.00, 1.15, 1.30, 1.50] definitions. |
| Sites 7–8 | Independent [1.00, 1.15, 1.30, 1.50, 1.70] definitions. Deeper 6–7-layer experiments remain stress tests. |
| Player upgrades | +50% of base per level, additive: 1 → 1.5 → 2 → 2.5; incremental costs 40, 90, 180. |
| Assistant baseline and power | Power 1, 1.5s swing, assumed 0.6s movement; +50% of base per upgrade. Measure delivery/path overhead before accepting this rate. |
| Assistant prices | 100, 180, 300, 460, 680. Let five be optional; three is a useful comparison target, not a forced cap. |
| Assistant upgrades | 60 then 140 per worker; prototype level 1 first. Level 2 has weak marginal whole-route value and should remain experimental until usefulness is measured. |
| Site costs | 0, 20, 30, 40, 50, 60, 75, 90, conditional on an approved eight-site mapping. |
| Room costs | 90 / 240 initially; these do not reliably force multiple saving batches. Do not raise solely to absorb high-attendance surplus. |
| Visitor limits | Queue 6/10/14, admitted occupancy 6/12/18 after room purchases. Keep 12/10/8s arrival and attended payment; test 28s occupancy against real routes. |
| Stands and tickets | Exact supplied global size sequences; +4/+2 completed-display fare; Dimetrodon-only opening and room-aware single next offer. |
| Chest and transport | Keep one slot per finite site item; unlimited carried bag and explicit collection/return. No capacity fee. 45s typical round trip is only a measurement placeholder. |

The recommended gentle-curve comparison with three helpers, one helper upgrade each and all three player levels produces **85.26 total minutes, 11.9 funding minutes, 809.25 player hit equivalents and 488 coins remaining**. Five helpers with the same equipment produce 88.03 minutes and 282 coins. These figures show both the reduced manual workload and unresolved surplus/automation. They do not justify mandatory equipment purchases. Gentle solo play still takes 147.84 minutes, so the baseline workload itself needs a child playtest.

If strictly increasing later-site duration is a firm requirement even with five upgraded workers, this recommendation is insufficient. Increasing resistance to counter the entire crew would worsen the no-upgrade path. Decide the desired late-site work/transport rhythm before adding optional operating constraints; do not make paid aid mandatory through steep soil.

## INDEPENDENT CODEX REVIEW — FOR CHATGPT ANALYSIS

This is a critical assessment of the proposed design and model, not a claim of a separate reviewing agent or production implementation certification.

1. **High — depth flexibility and real reachability.** Verified in the simulation: each site can independently define layer count, multiplier and materials, including nonmonotone layers. Unverified: the physical path and full acquisition graph for the planned content. No synthetic passing run proves all future exhibits are reachable.
2. **High — repetitive work.** Synthetic: 4975 moderate base hits, up to nine per cell; steep reaches fifteen and 6408 total. Gentle reduces this to 4097. These are automatic shovel actions, not required clicks. Unverified: how many repetitions Luka tolerates and whether the discovery spacing is rewarding.
3. **Medium — +50% assistant upgrades.** Synthetic: additive 1.5/2 power meaningfully improves isolated excavation without assuming doubling. Whole-route return weakens at the second level because purchases require museum revenue and little content may remain. Test one level before promoting both.
4. **High — five-assistant automation.** Synthetic: five level-2 helpers finish the late benchmark in 241.75s, versus a base player's 1,464.5s; they can recover every part unattended after activation. This is allowed behavior, but expensive prices alone do not preserve a substantial late digging phase once bought. Optional diminishing returns lengthen this to 364.75s; they remain unapproved.
5. **Critical implementation gate — background work integrity.** Simulation tests verify activation, assignment, pause, lossless reassign, unique item custody and in-memory checkpoint/resume. Current production explicitly disables helpers away from the pit and during activities. A durable, scene-independent worker clock plus atomic progress/custody/reward commits is required before background work can ship. Do not extrapolate an in-memory test to browser crash safety. This is a future integration risk, not a newly found live defect.
6. **High — chest and transport.** Synthetic: one-slot storage and three-minute visits stretch a 4.03-minute job to 36 minutes. Preserve manifest-sized storage; test multi-item reveal bursts, original-site ownership and interruption during collection/delivery. Unverified: actual routes, delivery time and child understanding of where fossils wait. The model has unlimited carried storage and no spatial delivery cost beyond its movement assumption.
7. **Critical content gate / Medium financial behavior — deadlocks.** Verified only for fixtures: 103 routes finish, first stand is always fundable, unique display credit cannot be duplicated, and predecessor completion never grants ownership. No full production site graph is available. Even a mathematically solvent museum stalls if a child does not attend/collect; the maximum funded delay in the all-upgrades distracted route is 636s.
8. **High — currency surplus.** Synthetic: typical no-equipment finish 440 coins, typical three-helper finish 588; deeper soil rewards add further income. Verified mathematical limitation: indefinite repeatable ticket sales with a finite catalog and no recurring costs create unbounded eventual cash. Define an acceptable finishing reserve rather than promising zero surplus.
9. **Medium — progressive stand purchasing.** Viable under the tested owned-room/reachable-content filter and one-opportunity invariant. Prefer room sequences plus global price counters. Whole-purchase testing does not settle partial-payment quoting, refunds or exhibit removal. Integration must preserve receipt accounting and historical saves.
10. **High — numbers requiring real play.** All swing/movement/delivery, cleaning, assembly, travel, attendance, collection, occupancy, material distribution, fossil placement, acceptable wait and acceptable surplus thresholds are unmeasured assumptions. The model's fixed schedules and ticket-batch boundaries cannot establish confidence intervals or enjoyment. No browser or Luka session was conducted for this research-only change.
11. **Medium — implementation order.** First define/validate the free bootstrap and real site/exhibit dependencies. Then implement a small optional per-site resistance/power experiment while preserving base-power diggability. Next establish exactly-once background task/custody transactions for one helper, including pause/reload/failure tests and clear local-chest feedback. Add multiple workers only after that integrity slice. Integrate room purchases/capacity and offer sequences under their separately approved versioned contracts; use measured play timings to retune before expanding content.

**Low — numerical presentation.** Decimal results and fixed-schedule threshold effects are useful for reproducing the experiment, not ranking close configurations reliably. Compare workload, long delays and transport behavior before optimizing small differences in finishing coins. The 0.25s controls are deliberately retained to expose this sensitivity.

## Remaining design questions

- Actual site count, fossil footprints and access prerequisites; whether all full layers must be cleared before reaching deeper finds in future sites.
- Desired per-site duration and player participation after five workers; whether background collection rather than digging is an acceptable late-game emphasis.
- What constitutes an excessive wait, ending balance or compulsory-feeling upgrade for Luka. Current scenarios cannot choose those product thresholds.
- Assistant delivery routing and concurrent-site assignments; how the player sees activation, pause and stored finds while elsewhere.
- Whether the existing per-cell soil reward should retain its probability as the number of layers expands.
- Exact offer ordering, contribution quote reservation and room-purchase save/credit contracts. Fresh-game viability must remain independent of old west-wing credit.
- Museum tour routes, actual occupancy duration and pending-money cues. Growing queues can hide funding pressure even if the occupancy cap looks small.

## Reproduction, changed files and validation

Only these six new research artifacts were added: [simulation](../../scripts/simulate-economy-digging-v2.1.mjs), [tests](../../tests/economy-digging-v2.1-simulation.test.ts), [report generator](../../scripts/report-economy-digging-v2.1.mjs), this report, [complete results JSON](7-economy-digging-v2.1-results.json), and [all purchase records CSV](7-economy-digging-v2.1-purchases.csv). Existing uncommitted work was left intact. No dependencies or package scripts changed.

Run from the repository root with the existing Node 24.11 runtime:

```powershell
node scripts/simulate-economy-digging-v2.1.mjs
node scripts/report-economy-digging-v2.1.mjs
node --test --test-isolation=none tests/economy-digging-v2.1-simulation.test.ts
npm test
npm run build
```

`--out <directory>` changes the simulator's output folder; `--config <file.json>` runs a single scenario (use a separate output folder to avoid replacing the matrix). The report generator optionally takes the matrix folder as its positional argument. For example:

```json
{"style":"typical","curve":"gentle","assistants":3,"playerLevels":3,"helperLevels":1,"chestCapacity":13,"roomCosts":[90,240],"siteDefinitions":{"1":{"multipliers":[1,1.25],"cellsPerLayer":64,"materials":[[1,1,2],[1,2,3]]}}}
```

Validation: **19/19 focused simulation tests; 488/488 repository tests; TypeScript and production build passed.** No failed/skipped tests in the successful final runs. The initial sandboxed isolated-worker test launch failed with Windows `spawn EPERM`; focused tests ran with `--test-isolation=none`, and the configured full suite/build ran with authorized process permissions. Vite emitted its large-chunk warning. Production TypeScript checks cover `src`; research JavaScript is exercised directly by the model tests rather than claimed as part of `tsc` coverage.

Two full output runs produced identical SHA-256 hashes for determinism. The suite also compares repeated complete scenarios, verifies accounting for every matrix entry and tests no-income bootstrap, invalid/duplicate displays, room gates, independent visitor caps, item bursts exceeding chest capacity, five-worker contention, pause, reassignment and in-memory checkpoint/reset behavior. This is not a test of future production persistence. Browser/manual visual QA was not run because no controls, UI or scene code changed; no real player save was accessed. Human playtesting remains required before approval of balance or new gameplay.

| Artifact | SHA-256 |
| --- | --- |
| 7-economy-digging-v2.1-results.json | bb4eefe173902b644a79b22fa895f8d141f343a347cf062620f74fceddc87695 |
| 7-economy-digging-v2.1-purchases.csv | 44f589d1cbc034543ce372698f68dfaa3042978e270f10c191feba2cc2e2546d |

## Appendix — required hits by layer for every depth configuration

Each entry lists shallow-to-deep integer hits at base power. Exact layer seconds, weighted resistance work, maximum cell hits, repetitions and every power-level variant are also in the results JSON. Nominal seconds = hits × 1.2 + cells × 0.4; these analytical values exclude travel, processing and funding.

| Curve | Site | Hits by layer | Total hits | Nominal dig min |
| --- | --- | --- | --- | --- |
| gentle | site-1 | 103 | 103 | 2.49 |
| gentle | site-2 | 103 / 168 | 271 | 6.27 |
| gentle | site-3 | 102 / 166 / 165 | 433 | 9.94 |
| gentle | site-4 | 102 / 166 / 167 | 435 | 9.98 |
| gentle | site-5 | 102 / 166 / 168 / 177 | 613 | 13.97 |
| gentle | site-6 | 102 / 166 / 168 / 177 | 613 | 13.97 |
| gentle | site-7 | 102 / 166 / 168 / 175 / 204 | 815 | 18.43 |
| gentle | site-8 | 102 / 166 / 167 / 175 / 204 | 814 | 18.41 |
| moderate | site-1 | 103 | 103 | 2.49 |
| moderate | site-2 | 103 / 178 | 281 | 6.47 |
| moderate | site-3 | 102 / 175 / 202 | 479 | 10.86 |
| moderate | site-4 | 102 / 176 / 206 | 484 | 10.96 |
| moderate | site-5 | 102 / 176 / 208 / 270 | 756 | 16.83 |
| moderate | site-6 | 102 / 176 / 208 / 270 | 756 | 16.83 |
| moderate | site-7 | 102 / 175 / 208 / 268 / 306 | 1059 | 23.31 |
| moderate | site-8 | 102 / 175 / 206 / 268 / 306 | 1057 | 23.27 |
| steep | site-1 | 103 | 103 | 2.49 |
| steep | site-2 | 103 / 198 | 301 | 6.87 |
| steep | site-3 | 102 / 195 / 275 | 572 | 12.72 |
| steep | site-4 | 102 / 194 / 280 | 576 | 12.8 |
| steep | site-5 | 102 / 194 / 282 / 383 | 961 | 20.93 |
| steep | site-6 | 102 / 194 / 282 / 383 | 961 | 20.93 |
| steep | site-7 | 102 / 195 / 282 / 379 / 510 | 1468 | 31.49 |
| steep | site-8 | 102 / 195 / 280 / 379 / 510 | 1466 | 31.45 |
| deep | site-1 | 103 | 103 | 2.49 |
| deep | site-2 | 103 / 168 | 271 | 6.27 |
| deep | site-3 | 102 / 166 / 174 | 442 | 10.12 |
| deep | site-4 | 102 / 166 / 177 / 196 | 641 | 14.53 |
| deep | site-5 | 102 / 166 / 178 / 196 / 208 | 850 | 19.13 |
| deep | site-6 | 102 / 166 / 178 / 196 / 208 | 850 | 19.13 |
| deep | site-7 | 102 / 166 / 178 / 195 / 204 / 266 | 1111 | 24.78 |
| deep | site-8 | 102 / 166 / 177 / 195 / 204 / 270 / 280 | 1394 | 30.87 |
| irregular | site-1 | 103 | 103 | 2.49 |
| irregular | site-2 | 103 / 272 | 375 | 8.35 |
| irregular | site-3 | 102 / 266 / 165 | 533 | 11.94 |
| irregular | site-4 | 102 / 266 / 167 | 535 | 11.98 |
| irregular | site-5 | 102 / 266 / 168 / 358 | 894 | 19.59 |
| irregular | site-6 | 102 / 266 / 168 / 357 | 893 | 19.57 |
| irregular | site-7 | 102 / 266 / 168 / 357 / 204 | 1097 | 24.07 |
| irregular | site-8 | 102 / 266 / 167 / 357 / 204 | 1096 | 24.05 |
