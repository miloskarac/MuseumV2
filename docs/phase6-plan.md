# Phase 6 Architecture, Gameplay and Implementation Plan

Prepared 2026-10-23 from the current repository and Miloš's supplied Phase 6 specification.

**Status: Increment 6.1 approved and implemented, 2026-10-23.** Miloš approved 20 starting coins, a 12.5% chance of one coin per cell-layer, rewards during automatic cleanup, and one-time old-save migration without retroactive soil income. The implementation uses schema 13 and save-before-success commits; see [economy implementation and QA](qa/economy.md). Phase 5 remains open.

**6.2 update — 2026-10-23:** Miloš subsequently approved the proposed stand prices (12/8/12), 18-coin wing, fixed slots, assembly at owned stands, preservation of all existing stands/space, and separate QA delivery until ticket income is ready. These are implemented in the development-only purchase preview; see [6.2 implementation and QA](qa/purchases.md).

**6.3 update — 2026-10-24:** The map, separate green/ochre camps, saved travel and 24-coin site-two purchase are implemented in the same isolated preview, now schema 15. First-site closure and one completed display are required for a new purchase. Miloš chose to preserve already-earned site-two access for existing saves; early saves adopt the new purchase rule. Reversible map names/themes are recorded in the decision log. See [6.3 implementation and QA](qa/world-map.md). Normal play remains on 6.1. Phase 6.4 recurring ticket income is next and retains its own scope/product decisions.

**6.4 update — 2026-10-26:** Miloš selected the proposed attended cashier, direct coin credit, 2/3/4 ticket prices, 12/10/8-second arrivals, 6/3 total/unpaid caps and unpaid-queue/paid-retirement restart policy on October 24. Visitors, safe payment records and simple tours are implemented. The combined paid progression is now enabled in normal play, schema 16, after zero-soil-income and browser verification. The independent development QA slot remains available. See [6.4 QA](qa/visitors.md). The subsequent 6.5 update below records the approved helper preview.

**6.5 update — 2026-10-26:** Miloš approved the 60-coin first helper, two-display/site-two/unfinished-work prerequisites, one available helper (global maximum two), six seconds per untouched layer and separate QA release. The `?helpers=1` preview uses schema 17 and its own save/lock. Helpers walk through the ladder opening, share reach/layer checks, retain unfinished work across travel/reload, and cancel private work on reassignment or player target changes. They stop before fossil exposure until 6.6 implements custody/storage. See [helper QA](qa/helpers.md). Normal play remains schema 16.

**6.6 update — 2026-10-26:** Miloš approved dirty helper finds going to their original site's finite storage box, retaining manual brushing and explicit bag collection. Schema 18 adds canonical delivery/storage custody and normalization of interrupted deliveries. Helpers visibly carry finds through the ladder route. Camp and rim boxes expose the same site inventory. The combined helper/storage flow is enabled in normal play; both QA slots remain separate. See [storage implementation and QA](qa/storage.md). Prices and site-completion rules are unchanged. Upgrades remain a separate 6.7 proposal.

**6.7 update — 2026-10-26:** Miloš approved the [bounded upgrade package](phase6-7-upgrades.md): boots 16 coins (+20% walking), shovel 24 coins (0.8-second cycle) and helper tools 30 coins (4.8-second untouched layer), one level each. These are implemented in normal play under schema 19 with no migration grants and retained helper task percentages. See [upgrade QA](qa/upgrades.md). Visitor improvements remain deferred; Phase 5 acceptance stays open.

The assessment and recommendations below preserve the original planning baseline. Statements about missing functionality and the 78-test baseline describe the repository before 6.1–6.7. The updates above and decision log supersede the original approval questions. Future visitor improvements and additional content still require their own scope decisions.

## 1. Scope and existing architecture

Confirmed direction: digging and completed displays feed an economy of stands, museum space and excavation unlocks; visitors buy tickets; helpers later assist only at the active site and deliver finds to persistent site storage. All player text stays Serbian Cyrillic. Keep Babylon.js, TypeScript, Vite, local saves, forgiving cleaning/assembly, retained progress and the approved visual style. No backend, accounts, multiplayer, cloud saves, V1 import or new dependencies are proposed.

The current playable collection is **13 discoveries, three exhibits and two pits**: six Dimetrodon parts plus one trilobite slab in the first pit, six Eryops parts in the second. Both pits are 8 × 8; depths are one and two layers. A third outdoor marker exists without playable content. These are the assessment's bounds, not an approved final collection size.

| Existing files | Actual responsibility and reuse | Phase 6 change needed |
| --- | --- | --- |
| `src/app/prototype.ts` | Owns state, exclusive panels, movement, digging, completion, room transitions and saving. Clears keyboard/swing on interruption. | Add a small commit coordinator and shared simulation eligibility checks; keep economy rules out of this coordinator. |
| `src/game/journey.ts` | `JourneyState` schema 12, two-hit digging, whole-layer order, cleaning masks, explicit collection, site availability. | Add economic clear events and ownership prerequisites through shared rules. Existing availability is free sequential access, not purchased ownership. |
| `src/game/burial.ts` | Shared exposure rules for footprints and fossils crossing vertical soil layers. | Reuse for all player/helper discovery claims; never derive ownership from a visible mesh. |
| `src/game/assembly.ts` | Bag = collected discoveries minus placed parts; click and drag share `placeGroup`; completion is derived from required parts. | Require an owned stand/available area for new placement. Derive ticket eligibility from completed, displayed exhibits. |
| `src/game/site-completion.ts` | After every find is cleaned and collected, pops remaining columns, walks to the outdoor entrance, then records closure. | Route automatic soil removal through coin settlement too. Storage must not trigger closure before manual cleaning/collection. |
| `src/content/journey.ts`, `exhibit.ts` | Stable IDs, current/historical layouts, burial, prerequisites, shared part definitions, Cyrillic text. | Add central V2 balance, offers and site descriptors. Keep historical layout data frozen. |
| `src/game/navigation.ts` | Room IDs, safe arrival points, fixed stand spots, hall bounds, collision and pit geometry. | Derive owned-area bounds and obstacles from the same layout as rendering. Add location-aware spawns and site travel rules. |
| `src/presentation/world.ts` and room/exhibit builders | One active Babylon scene, disposed/rebuilt on room change; shared procedural fossil/display recipes. | Build owned stands/areas, themed sites, bounded visitor/helper actors and storage boxes from state. |
| `src/ui/hud.ts`, `journey.ts`, `assembly.ts` | HUD, bag, cleaning, assembly, stories, reset/recovery and save status. | Coin balance, explicit purchase buttons, map, cashier feedback and later helper/storage interactions. |
| `src/persistence/save.ts` | One `museum-for-luka-v2` localStorage snapshot, schema-1–12 validation/migration, 1-second checkpoints, immediate flushes, failure/retry/reset protection. | Extend the snapshot incrementally; stage economic commits; selective recovery of invalid locations/tasks; coordinate one writer. |
| `src/game/simulation-speed.ts` | Development ×1/×2/×5/×10; bounded steps, no large elapsed-time catch-up. | Apply the same simulation clock to visitors/helpers; production stays ×1. Never use wall-clock catch-up. |

There is **no current currency, purchase ledger, visitor, cashier, helper, storage box or world map**. All three stands and the expanded hall are built unconditionally. The second pit opens for free after the first closes. `future-purchase` is a placeholder label, not an economy implementation.

Important constraints found in code:

- Completion and display are currently the same placement milestone. There is no separate assembly workbench, completed-fossil inventory, relocation or removal system.
- Save validation rejects an unknown room/site outright; `activeSite()` assumes a valid ID. The requested safe fallback needs an explicit load-normalization path.
- Pit bounds currently derive from the first site's geometry; the second works because its horizontal dimensions match. Different footprints later require site-specific bounds, not just new scene artwork.
- The app publishes a new live state before flushing it. Failed writes retain that snapshot for retry, but ordinary digging/placement can continue; only automatic cleanup explicitly pauses for `saveFailed`. This is insufficient for acknowledged monetary transactions.
- Helpers need a new target-by-ID rule. Calling `digAt` with a pretend player position would couple them to proximity and could target the wrong tile.

## 2. Phase 5 readiness and baseline evidence

| Finding | Evidence/status | Effect on Phase 6 |
| --- | --- | --- |
| Existing rule and migration baseline | Fresh `npm test`: **78 passed, 0 failed** on 2026-10-23. | Useful regression baseline; no failing unit-test blocker found. |
| Production compilation | Fresh `npm run build`: **passed**. Main JS chunk approximately 1,123 kB minified / 282 kB gzip; existing >500 kB warning. | Measure load/runtime cost before expanding actor counts. Warning alone is not a demonstrated frame-rate failure. |
| Independent play and art acceptance | Roadmap and `docs/qa/eryops.md` still record Luka's playtest and Eryops art/content acceptance as open. Shared-pit slab appearance was accepted separately. | Keep Phase 5 open; new authorization permits planning but does not close those gates. |
| Scientific review | `educationReview` / `eryopsReview` still explicitly require review; trilobite is a stylized group example. | Review site-period wording before map publication; no new factual claims selected in this plan. |
| Latest browser evidence | October 22 reports cover excavation cutaway, camera, HUD and optional story controls in isolated Edge profiles. | Historical evidence only. No browser or hands-on playtest was rerun for this planning task. |
| Target-machine performance | No measured target-device frame-time/memory budget found. Narrow-screen scene scale remains a recorded limitation. | Establish a measured baseline before visitors/helpers and expansion framing. |
| Documentation drift | Roadmap still described schema 10 and an unintegrated starter; original architecture is an October 4 proposal. Reference images now reside under `docs/references/museum/`, while older guidance names their former root paths. | Roadmap and architecture links corrected alongside this plan; historical contracts remain labeled historical. Use the actual museum reference folder for visual QA. |

Before a Phase 6 playtest, run a fresh full journey on an isolated QA save: both sites, all exhibits, interruption during cleaning/assembly/cleanup, reload, failed save/retry and reset. Miloš/Luka must still assess readability, instructions, repetition and enjoyment. Those are open acceptance gates, not failures inferred from tests.

Engineering dependencies to resolve in their owning increments: save-before-success transactions (6.1), purchase rollout without income deadlocks (6.2–6.4), location fallback and purchased unlock checks (6.3), shared helper targeting and custody (6.5–6.6). None requires a broad rewrite before planning can proceed.

## 3. Gap analysis against the approved mechanics

| Requested area | Present support | Missing work / owning increment |
| --- | --- | --- |
| Money and tile coins | Stable cells, monotonic digging and snapshots | Balance, frozen reward outcomes, unique settlement, visible feedback — 6.1. |
| Completed/displayed ticket price | Derived exhibit completion and unique part placement | Display ownership selector, price and ticket sales — 6.4. |
| Stands and expansion purchases | Stand geometry, fixed footprints, larger hall | Ownership, price/prerequisite validation, purchased geometry/collision — 6.2. |
| Site unlocks | Two independent progress sets, first-site closure prerequisite | Permanent purchased access, central prices, safe migration — 6.3. |
| World map and themed locations | Outdoor plot selection, active site ID, shared excavation renderer | Map/menu, names/period metadata, per-site campsite/theme/spawn, travel command — 6.3. |
| Terrain/difficulty | Layer count, burial depth, soil bands, two-hit rule | Configurable per-site parameters; initially preserve existing hit difficulty and increase depth only. New tuning requires approval. |
| Helper ownership/assignment/work | Bounded simulation and reusable excavation/exposure logic | All helper rules, actors, work progress, limits and targeting — 6.5, completed by 6.6. |
| Storage and delivery | Unique discovery IDs, cleaning and bag selectors | Durable custody independent of bag, site box, delivery interruption and transfer — 6.6. |
| Visitors/cashier | Museum routes can be authored around existing obstacles | Bounded actors, queue, admission transactions, payment state and pause/reload behavior — 6.4. |
| Upgrades | Central movement/shovel constants | Future level definitions and effective-stat selectors only when separately commissioned — 6.7. |
| Persistence/recovery | V2 migration chain, failure status, retry, confirmed reset | New fields, staged commits, writer exclusion, selective location/task normalization and migration fixtures — each increment. |
| Deadlock prevention | Existing free discovery path | Starter affordability invariant, renewable ticket access and progression-state tests — 6.1 model, 6.2–6.4 integration. |

## 4. Proposed economy and provisional V2 values

**All numbers in this section are recommendations, not confirmed balance.** They are calculated for V2's present two pits and three exhibits. Coin rewards are supplemental; recurring, attended ticket sales supply long-term purchasing power.

| Setting | Proposed starting value | Reason / approval point |
| --- | --- | --- |
| Starting balance | **20 coins** | Exactly covers both first-pit stands, even with zero coin drops. Decide for 6.1. |
| Base ticket price | **1 coin** | Visitors start only when at least one complete exhibit is displayed. Decide for 6.4. |
| Increase per unique completed/displayed fossil | **+1 coin** | Current collection prices: 2, 3, 4 coins for 1, 2, 3 displays. No increase per bone. |
| Dirt coin probability | **12.5% per soil cell-layer** | Most cleared soil has no reward; depth increases finite opportunities. Decide for 6.1. |
| Successful coin drop | **1 coin** | Small, readable supplemental rewards. Decide for 6.1. |
| Dimetrodon stand / trilobite stand | **12 / 8 coins** | Either can be bought first; combined cost ≤ starting balance. Decide for 6.2. |
| First paid site: Eryops | **24 coins** | First site closure plus one completed display; first site stays free. Decide for 6.3. |
| First museum expansion | **18 coins** | Opens Eryops's existing wing; requires one complete display. Decide for 6.2. |
| Eryops stand | **12 coins** | Requires expansion and Eryops-site ownership. Decide for 6.2/6.3. |
| First helper | **60 coins** | Optional, materially more expensive than a stand/site; do not make it necessary to progress. Decide for 6.5. |
| Helper limits | **2 owned globally; initially 1 purchasable** | First requires two complete displays, second-site ownership and unfinished eligible work. Second remains gated until a later approved productive site exists. No new site is implied. |
| Visitor arrival interval | **12 / 10 / 8 seconds** at 1 / 2 / ≥3 complete displays | Frequency caps at one per 8 seconds. Expansion alone initially does not multiply arrivals. |
| Maximum visitors | **6 total**, including at most **3 unpaid waiting** | Admission stops when capacity is full; no hidden backlog. |
| Cashier service | **1 visitor/second while Luka stands at the desk** | No repeated clicking. Immediate coin credit after a successful save. |
| Visit duration | **About 24 seconds**, visiting at most two complete displays | Initial authored route; tune after a visual/performance check. |
| Helper efficiency | **1.5-second swing, 0.5 player-hit work/swing** | Player remains at one hit per 1-second swing, two hits per layer. Helper needs 6 seconds for untouched layer work versus player's roughly 2 seconds, before travel. |

### Ticket eligibility and completion order

Recommend **currently displayed** unique fossils rather than permanent historical milestones:

`price = base + increment × count(unique completed exhibits on owned stands in available museum areas)`.

Incomplete parts, bagged finds and stored finds contribute zero. Price is derived, never incremented as a reward event. Repeated placement, story opening, rendering and reload cannot raise it again. Lock the charged price at payment time; later changes do not alter an already-paid ticket.

Keep partial bones visible and retain assembly at the stand. Treat “complete fossils” before buying a stand in the specification's loop as “recover the required finds”; do not add a separate workbench simply to enforce that literal order. **This interpretation needs confirmation before 6.2.** A purchased stand can accept partial placement; only the final complete display earns a price increase.

No removal, sale or relocation UI is proposed for these increments. If relocation is later authorized, move the same exhibit ID in one transaction so it never counts twice; reserve/complete the move without losing its paid stand. Removing a display would reduce the current price and eligible visitor targets. That future feature must retain an income path and needs its own approval; it must not undermine the starter deadlock proof below.

### Coin outcomes and clearing semantics

Recommend deciding outcomes **when a site's economy manifest is first initialized**, before excavation can produce an economic result. Initialize the first site with the fresh save, other existing playable sites on first entry; eventually initialize new sites with their purchase. Persist the outcomes in the same save as progression. Use a saved seed and versioned generator, but keep the resulting finite reward manifest so later balance/generator changes do not reroll an existing site.

- Reward identity includes stable site ID, layout revision, column ID and zero-based soil layer. A two-layer column has two distinct opportunities. Do not use screen position or array order.
- A normal final strike clears one layer. In the same transition, resolve its frozen reward, credit any coin and mark its reward claimed. The first of two player hits earns nothing.
- **Recommendation requiring 6.1 approval:** automatic end-of-site cleanup also settles all newly cleared layers, including several layers in one popped column. Helpers later use exactly the same rule. This keeps earnings independent of whether the last fossil was found early and avoids losing all remaining coin opportunities at mandatory closure. Aggregate the pop's feedback rather than spawning one effect per layer.
- Rewards follow committed soil clearing, never animation callbacks. Replayed pops, duplicate hits, player/helper races and reload cannot settle a reward twice.
- Previously cleared layers in migrated saves are excluded without retroactive payment. Partial layers remain eligible when completed. No refill, repeatable excavation, reset bonus carried into another save, or offline coin generator.
- Persist initial seed/manifest before play; a failed write cannot permit reward-bearing digging. Explicit new-game reset creates a new game and discards the old balance too.

### Progression calculations and deadlock analysis

The first pit has 64 soil units and the second 128. At 12.5% × 1 coin, their expected full-clear rewards are **8 and 16 coins**. These are expectations, not minimums. If outcomes are independent, even zero first-site drops are possible (about 0.0194%); progression must work for that case.

| Stage | Calculation under proposed rules | Practical meaning |
| --- | --- | --- |
| Early: first two displays | Start 20 − stands 12 − 8 + expected first-pit coins 8 = **8 remaining**. Zero-drop balance = 0. | Both displays remain reachable with free digging, cleaning and placement. Buying either stand first is safe. |
| Unlock site two | With both displays, ticket = 3; arrivals every 10 seconds. From expected 8 coins, 6 tickets produce 18, then pay 24, leaving 2. | About 1 minute of attended cashier time, plus walking/arrival latency. With zero drops, 8 tickets / about 80 seconds. |
| Mid: full current collection | Site 24 + expansion 18 + Eryops stand 12 = 54 additional spend. Expected dirt coins total 24; **30 ticket coins**, or 10 tickets at 3, cover the difference. | About 100 seconds total cashier time across the route, if both first exhibits are completed before sales and the second pit yields its expected coins. Dirt, cleaning, travel and assembly time are additional. |
| Conservative zero-drop route | 54 / 3 = **18 tickets** after both first displays. | About 3 minutes total cashier time. With only one display, income is 10/min; buying the second stand for 8 is the shortest improvement. Funding the 54 entirely at that lower rate would take 5.4 minutes. |
| Later supported state | Three displays: 4 × 60/8 = **30 coins/minute** of continuously staffed, uncongested sales. | A 60-coin optional purchase corresponds to about 2 minutes. At two displays it is about 3 minutes 20 seconds. There is no approved third playable site or endless content sink. |

Arrival rates are upper steady-state throughput with the cashier continuously staffed, no blocking panel/hidden tab and a clear route. They are not offline earnings or measured child pacing. Helpers can be bought before finishing site two; after all excavation is exhausted, hide/disable a purchase with no useful work until more content is approved. Existing completed saves may have no productive helper opportunity yet.

**Starter safety rule:** until the first completed display, the only spending options are the two first-pit stands, whose combined price cannot exceed starting money. Other purchases require at least one complete display. First-site entry, cleaning, assembly, travel to the hub and cashier operation never cost money. Once a display exists, ticket income remains available without consumables, maintenance charges or needing an expansion. Thus exhausting soil and spending the last coin cannot permanently block progress.

An ephemeral analysis script enumerated the abstract zero-drop purchase/recovery/display model: **2,186 reachable states, zero dead ends** with tickets enabled. With purchase gates enabled but tickets absent, **13 states included one dead end**: both first stands bought/displayed, zero balance, second site unaffordable. The model includes all purchase orders, free recovery, stand/expansion prerequisites and ticket income; it excludes movement, saves, helper costs and stochastic pacing. It is evidence for the proposed design, **not a test of implemented economy code**. Recreate it as focused tests against real transition functions when they exist.

**Release implication:** 6.1 is independently playable because it adds earnings without charging for existing progress. Develop 6.2 and 6.3 in bounded QA increments, but do not activate their paid progression in Luka's build until 6.4 supplies the renewable income path. Keep the existing playable release available during that development. Do not temporarily make paid items free, inject rescue money or advance visitor implementation before its approved increment.

## 5. Purchase and transaction architecture

Use ordinary typed functions, not an event bus or a generic transaction framework. Suggested modules are responsibilities to add when their increment needs them, not files to scaffold now:

| Module | Responsibility | First needed |
| --- | --- | --- |
| `src/content/economy.ts` | Approved balance, versioned reward policy and validation | 6.1 |
| `src/game/economy.ts` | Safe integer arithmetic and soil-clear/reward transitions | 6.1 |
| `src/app/commit.ts` | Stage a candidate snapshot, write, publish success or retain for retry | 6.1 |
| `src/persistence/session.ts` | Single active writer and storage-conflict handling | 6.1 |
| `src/content/purchases.ts`, `src/game/purchases.ts` | Finite offers, prerequisites, ownership and purchase transition | 6.2 |
| `src/content/sites.ts`, `src/game/travel.ts`, `src/ui/world-map.ts` | Site metadata, availability, spawn/travel and map | 6.3 |
| `src/game/visitors.ts` and a presentation builder | Queue/payment/visit rules and bounded actors | 6.4 |
| `src/game/helpers.ts`, `src/game/fossil-storage.ts` | Task ownership, work, custody and manual collection | 6.5–6.6 |

Leave current excavation definitions in place unless extracting site metadata removes real duplication. Retain shared anatomy and fossil builders. Add text next to content or in small dedicated text definitions, outside mechanics.

An offer has a stable ID, cost, purchase kind, unique entitlement ID and explicit prerequisite IDs. Support the finite kinds needed: stand, expansion, site; helper later. Clicking a large **Купи · 12** button sends the offer ID, never a trusted price or arbitrary money delta. No timed contribution/partial-payment system is recommended.

One purchase transition checks valid offer, integer nonnegative balance, ownership, prerequisites, affordability, relevant limits and active session state. It subtracts money and adds the entitlement in **one candidate snapshot**. Owned IDs are the completion receipt; do not maintain a second independently mutable boolean ledger. If purchase history becomes useful, its receipt must be written with the same entitlement, not used as a separate authority. Free starter access and migration entitlements have explicit provenance rather than pretending payment occurred.

The app serializes commands; duplicate/reentrant requests see the updated ownership or a pending commit and cannot pay twice. Effects follow accepted persistence, never a button handler or mesh construction. Invalid commands return a reason without scheduling a save. All money arithmetic checks safe-integer bounds, including overflow, before addition/subtraction.

### Commit sequence and write failure

1. Validate the intent against the latest live state and build one immutable candidate, including all related changes (soil + reward, money + ownership, ticket + payment state).
2. Supersede/cancel any older scheduled snapshot using the existing writer generation mechanism. Include latest valid dirty cleaning/task progress in the candidate.
3. Attempt to persist the full candidate under the existing single save key. For economic/ownership milestones, publish the candidate and success feedback only after the write succeeds.
4. On failure, retain that exact candidate in memory, show the existing Serbian save-failure/retry interface, and block further gameplay mutations and travel. A retry writes the retained candidate, not a replay of the reward/purchase command. Do not animate success or show spendable coins first.
5. Retry success publishes once. Confirmed new-game reset can explicitly discard pending state and cancel old callbacks; failed reset cannot do so.

Ordinary brush strokes and unfinished helper work may retain the 1-second checkpoint cadence. A failed checkpoint also pauses mutations until retry. On voluntary travel, flush work before changing location. A forced process termination can lose progress since the last successful checkpoint; do not label that unsaved fraction committed. On blur/hidden/pagehide attempt a flush and stop simulation, without depending on those events always firing.

Extend the writer with an explicit outcome (saved / nothing pending / failed / blocked) so “nothing to flush” cannot be mistaken for a failed transaction. Keep the current reset-generation tests. This is a bounded coordination change, not a new persistence platform.

## 6. Stands, expansion and display ownership

Recommend a fixed authored slot for each current exhibit. Buying a stand constructs it in that slot; no free placement editor, rotation or generic furniture inventory. Locked slots show a readable coin marker and price, distinguishable by icon/shape from the existing yellow partial-assembly circle.

For new economy games, start with the original-size hall holding Dimetrodon and the slab. One paid wing opens the existing Eryops area, reaching the present 25-unit hall. This reuses current artwork; it is a proposal to approve before 6.2. Derive visual floor, walkable bounds, collisions, exhibit spots and camera framing from one owned-layout selector. Do not leave invisible walls or move the player into a stand during purchase. Keep the entry and first two exhibit positions stable.

Purchased stand ownership is independent of completion; partial placements still show immediately and survive reload. An unowned slot cannot accept parts. Story-button behavior, marker colors after purchase and harmless click/drag misses stay as implemented.

Existing saves already had all stands and the enlarged hall. Recommend grandfathering **all currently available stand/wing entitlements** at 6.2 migration, including empty ones, with no charge and no artificial purchase refund. Do not remove or hide placed fossils. This migration policy needs approval before 6.2.

## 7. World map and excavation-site architecture

Add a dedicated **Карта** panel accessible from a hub sign/interaction and the ordinary game menu. It is a blocking activity: pause simulation, clear input and flush pending work. Map cards show site name, period, picture, locked/open/exhausted status, cost and prerequisite; unlocked cards offer **Путуј**, and the hub offers **Музеј**. Purchase and travel are distinct actions; validate both in game rules.

Keep stable `courtyard-dig` / `eryops-dig` progress IDs. A descriptor references the existing dig definition and supplies display text/period, environment recipe, designated camp/pit spawn, cost/prerequisites, difficulty parameters and storage anchor. Independent state already exists through globally unique cell/find IDs; no need to duplicate the whole game state per site.

Recommended location model at 6.3: `hub`, `site-camp(siteId)` or `site-pit(siteId)`, rendered with the existing museum/outdoors/excavation builders. A map overlay is transient, not a saved location. Site camps provide travel, storage and the pit entrance; a closed pit stays closed while its camp and box remain visitable. Render one active site only and dispose the previous scene, as today.

Travel is one command: validate destination ownership and content readiness, settle interrupted delivery to the original site's box, pause helper work, checkpoint state, set the last valid destination, and spawn outside triggers. Museum inventory, money, ownership and all site progress are untouched. Helpers at the destination resume only once gameplay becomes active. During automatic site cleanup/return, keep travel disabled until a safe camp checkpoint; do not let a map action bypass closure.

Normalize a valid save with an invalid/removed location to the hub **without deleting collection, money or ownership**. An exhausted saved pit resolves to its own camp. A known but unowned destination also falls back; invalid unlock/progress claims still fail economic validation. Keep known retired site identities in compatibility data so old progress can survive a content update; do not erase unknown records under the guise of location recovery. Unrecognized save versions remain protected by recovery UI.

The first site is permanently free. Recommend retaining first-site closure as the second site's prerequisite and adding its price plus a completed-display prerequisite for the economy rollout. At migration, grandfather a second site already accessible (first site closed) or legitimately progressed under historical rules. Unreached access can adopt the new rule only when approved; preserving all previously free future access is an alternative decision for 6.3.

All **defined** sites remain visible. The existing third placeholder remains visible but unpurchasable and untravelable, with honest “future location / period not selected” copy until its name, period, content and price are approved. Do not invent prehistoric periods or unbuilt sale items. Both current large specimens use Permian text; the generic trilobite is not a species-level date assignment. Distinct period themes for future locations need content approval. Preserve the shared first pit instead of silently redistributing its fossils to manufacture different eras.

## 8. Helpers: tasks, effectiveness and lifecycle

Helper identity and permanent ownership are independent of assignment and work. A later purchase uses the same atomic money/entitlement path, with both global and progression-based limits checked before charging. Assignment accepts only unlocked, content-ready sites. An exhausted assignment is harmless but idle; guide Luka toward a useful site.

Proposed saved helper data: stable helper ID, assigned site ID (or unassigned), lifecycle phase, optional task, optional delivery reference; permanent upgrade levels only when 6.7 introduces them. A task stores a unique work ID, target site/column/layer, expected starting soil progress, accumulated work and required work. Positions, walking cycles and arm poses are presentation data, reconstructed at safe anchors.

Required states: **idle**, **digging**, **paused**, **carrying fossil**. Paused retains the underlying unfinished task. Activity is constrained by player location, focus/visibility, exclusive panels, cleanup and save status; do not trust a persisted “digging” flag to simulate an inactive site.

### Work contract and shared soil

Recommend a task that completes the **remaining work on one cell-layer**. Private helper work fills a small visible progress indicator but changes shared soil only when that task completes. At proposed settings an untouched layer requires four weak helper swings / six seconds. This permits resetting unfinished work on reassignment without undoing world excavation.

Once complete, atomically validate the expected soil revision, apply the remaining layer clear, settle any coin and claim any newly exposed find. Partially player-dug soil needs proportionally less work. Do not award a second clear if the player got there first. Completed helper layers are permanent world progress and never undone by reassignment.

Use the existing whole-layer and burial rules. A lightweight deterministic reservation table prevents two helpers choosing the same current layer cell. Player digging always remains allowed: if it changes a helper target, invalidate that unfinished task and retarget without erasing the player's accepted hit. All actors submit serialized commands; one final clear can have only one winner. Tie-breaking can give the player's valid intent priority within a simulation step. Ordinary helpers must not reserve the entire pit or force Luka to wait for them.

Author a small walkable work route/adjacent work position around the active layer. Validate reach and ladder routes; never teleport through pit walls or use omnidirectional remote digging as a substitute for navigation. Helpers do not collide with/block Luka, ladder access or interaction circles. This is a main visual risk to prototype with one helper first.

### Exact lifecycle semantics

| Event | Required transition |
| --- | --- |
| Leave at 60% | Stop work, save the same task and **60%** before voluntary travel, set paused. On return resume 60%; no elapsed-time credit. |
| Hide tab / blocking panel / lost focus | Pause work and movement; flush checkpoint on suspension. Resume from retained work with bounded time. |
| Reassign mid-task | Cancel only uncommitted task/work, settle any already-confirmed delivery to original storage, retain ownership/upgrades and all completed soil, save new assignment. Destination task begins at zero when visited. |
| Reload with valid task | Restore work but initially inactive; resume only at assigned active site after safe startup. |
| Invalid target, changed soil, retired layout | Cancel only that task and reset its private progress. Preserve coins, confirmed discoveries, helper and upgrades. Pick a valid replacement. |
| Invalid/removed assignment | Preserve owned helper/upgrades, settle valid confirmed reward to its original site's compatibility storage, unassign and explain. Never move a discovery to the replacement site. |
| No legal work / completed pit | Idle; do not farm rewards or excavate beyond authored content. |

An old save missing only an optional new helper field can migrate explicitly; malformed economic ownership must not be silently repaired into a free purchase. Define task normalization separately from purchase validation.

## 9. Fossil storage and interrupted delivery

Recommend **unlimited capacity relative to the site's finite authored finds**: one slot per unique discovery, no stacks, overflow, weight or paid capacity. Storage remains separate from the player's bag.

Use one canonical custody record for each helper-confirmed find, keyed by discovery ID, with original site and location (`delivery` with helper ID, or `storage`). Do not duplicate it across a helper reward list, box inventory and bag. Existing `collected` remains the terminal clean-bag entitlement, and `placed` continues to derive bag removal.

Normal flow:

1. A helper's final valid clear reveals the entire fossil footprint/depth. In the same durable transition, claim the unique discovery into original-site custody. Exposed partial fragments do not count.
2. After success, animate pickup and carrying to the site's box. No reward is awarded by the animation.
3. Arrival changes custody to storage. Luka sees a box count/picture and opens it manually.
4. **Recommendation to preserve existing cleaning:** selecting a dirty stored fossil opens the current forgiving cleaning activity. Closing it preserves both the stored fossil and mask. The explicit **Стави у торбу** action atomically removes custody/storage and adds the collected entitlement once cleaning is complete. Repeated clicks are harmless.

Step 4 needs approval before helper rollout: the specification does not explicitly choose whether helper-delivered fossils skip cleaning. Do not silently auto-clean them. If the chosen design instead transfers dirty finds into a bag, it needs a new dirty-inventory/cleaning flow; the proposed box-based cleaning is smaller and preserves today's clean-bag contract.

When player clearing reveals a find, retain immediate cleaning behavior. When helper clearing wins the final exposure, route it into custody and show a gentle delivery cue; do not interrupt Luka with an automatic cleaning popup. Existing `pendingDiscovery` must exclude claimed/stored finds. Once player cleaning has begun, the helper cannot take it. One shared claim rule handles same-frame exposure races.

On travel, reassignment or controlled shutdown, deposit any confirmed delivery into **its original site's** storage in the same state transition. On reload, normalize every saved delivery to storage before resuming; do not require a carrying animation to finish. A saved `delivery` record is already a durable entitlement, so even a later failed deposit write does not erase the find. It is normalized again safely on the next load.

Keep the current exhaustion rule: all site finds must be manually cleaned/collected before cleanup and closure. Stored or carried fossils do not satisfy it. An empty pit with fossils in the box stays recoverable, with helpers idle and a clear next action. The box is at the camp/rim, reachable without entering a closed pit. Closure and ticket pricing remain independent of storage and incomplete display.

**Dependency:** 6.5 cannot ship normal helper discovery to Luka before 6.6 supplies custody, delivery recovery and manual collection. Develop 6.5 ownership/task logic with tests and isolated QA, then release the complete 6.5–6.6 flow together. Do not briefly auto-collect helper finds or add storage code prematurely during 6.1.

## 10. Visitors, cashier and payment integrity

Recommend **Luka-operated cashier, automatic service while standing at its marked spot, immediate credited coins**. It keeps the interaction visible, avoids a second uncollected-cash currency and requires no repetitive clicking. If this feels like waiting during Luka's test, automatic staffing is a later product choice; do not change it silently to hit the model's income rate.

Use a clear entrance → short queue → cashier → one/two completed exhibits → exit route. Author a few waypoints for each available wing. Visitors have no collision authority over the player, do not stand on exhibit circles and avoid the ladder/travel trigger. Queue fills only to its configured cap. Stop the spawn timer when at capacity; do not accumulate arrivals for a burst later.

Visitors and cashier advance only while the museum is active, focused and unblocked. Leaving the museum, opening a blocking activity, hidden tab, failed save and session end stop income. No offline sales or unpaid-to-paid conversion during reload. Proposed scaling uses only completed displays, saturates at the table's cap and does not yet add expansion multipliers or upgrades.

Persist only a bounded logical list of visits: next visit sequence, visit ID, unpaid/paid status and paid price where applicable; persist a bounded arrival timer if resumption is desired. Positions and tour animation are transient. A payment command checks a live unpaid visitor at the cashier and eligible completed displays, then atomically writes paid status and money. Duplicate actions on that ID return unchanged. New visit identities come from the monotonically advanced sequence, never the current list length.

On leaving/reloading, treat paid visitors as having finished their tour; no repayment or refund. Keep unpaid visits as the same bounded unpaid queue and restore them to safe queue slots, without charging. Reconstruct the queue/timer without elapsed-time catch-up. Save normalization removes ended paid visits while retaining the visit sequence and balance. Pending write failure must pause service before another ticket can be processed. There is no unbounded receipt history.

Show current price and a short **+1** completion cue when a newly displayed fossil qualifies, with a coin icon and a small number. Explain ticket pricing in the cashier interaction, not with a complex management screen. Confirm its position and route against both museum sizes before rollout.

## 11. Persistence, migration and integrity boundaries

Continue one versioned local snapshot. Do not introduce a database or server merely for transaction vocabulary. Add fields only when their increment ships; do not store unused future upgrade fields or a speculative full management schema in 6.1.

| Increment | Proposed additional durable data |
| --- | --- |
| 6.1 | Next schema (13 if no intervening change), integer coins, economy version/seed, per-site frozen coin manifests and claimed reward IDs. |
| 6.2 | Stand/wing entitlements with provenance; use existing placed parts for completion. |
| 6.3 | Purchased site entitlements and last valid structured location. |
| 6.4 | Bounded unpaid/paid visit records and monotonic visit sequence; no actor transforms. |
| 6.5–6.6 | Owned helpers, assignments, active task/work, lifecycle, original-site discovery custody/storage; no offline timestamps. |
| 6.7 | Only separately approved upgrade levels; effective stats derived from content. |

In 6.1, validate schemas 1–12 with their existing contracts, convert to valid schema 12, then apply the economy migration once. Give the proposed 20 starting coins once, not on every load; exclude all already-cleared layers from payout, including cleanup-cleared ones. Keep all digging, masks, collected/placed IDs, site closures and location. Do not derive retrospective money from completed exhibits. Freeze old schema types instead of defining them as an `Omit` of an ever-growing current type; this small typing adjustment prevents new required fields leaking into historical contracts.

Later migrations grandfather existing stands/space and legitimately earned site access as described above. Keep supported historical content identities; changing depth or layouts must explicitly reconcile reward identity so new layers cannot reopen old claimed rewards. Prefer freezing an opened site's economic layout revision until a justified migration. Rebalance new sites without rerolling old manifests. Corrupt balances, duplicate entitlements, contradictory storage/bag ownership and unknown versions remain blocked for recovery, not silently reset.

**One writer:** a single localStorage value keeps related fields together, but localStorage does not lock a cross-tab read/modify/write transaction. Recommend holding an exclusive named Web Lock for the loaded game session; a second same-origin tab waits in a clear read-only screen. Acquire before loading, retain through saving, release on teardown; after page restoration/reacquisition reload the durable snapshot before accepting commands. Feature-detect support and fail closed for economy writes if unavailable rather than pretending a storage flag is a lock. Test this on the intended Edge environment before rollout. These recommendations follow the [HTML storage model](https://html.spec.whatwg.org/multipage/webstorage.html) and the cooperative locking mechanism in the [Web Locks specification](https://www.w3.org/TR/web-locks/).

If a storage event indicates a conflicting external reset/change, pause and offer safe reload rather than merge money. No automatic cross-tab money merging or home-grown compare-and-swap lease.

Guarantees are bounded to normal play using a supported single-writer session and successful browser storage operations. Stable IDs and atomic snapshots prevent duplicate accepted rewards within that save history. They cannot prevent devtools editing, restoring an old browser backup, storage deletion/eviction, device failure, or another application ignoring the lock. A successful browser write is not a server receipt or a guarantee against physical disk failure. Different origins, ports, profiles, browsers and devices have independent saves. Failed writes/crashes cannot preserve progress that never successfully reached storage; show that honestly. No backend is authorized or needed for this child-focused local game.

## 12. Implementation dependencies and acceptance gates

Each increment requires its own approved scope and current numerical decisions, focused rule/save tests, `npm run build`, and browser/manual evidence for changed interactions or presentation. Keep the established discovery loop playable and use a separate QA profile throughout.

| Increment | Small deliveries | Acceptance / release gate |
| --- | --- | --- |
| **6.1 Economy foundation** | 6.1a state/config/migration/commit tests; 6.1b frozen soil rewards + small balance/coin UI + browser checks. No spending. | Detailed criteria below. Existing free stands/site progression stays intact until later approved work. |
| **6.2 Stands and expansion** | 6.2a fixed-slot stand purchases; 6.2b one wing with matched floor/collision/camera and migration. | Duplicate/insufficient/prerequisite purchases cannot spend; owned stands accept existing placement; incomplete displays earn no ticket eligibility; old displays/space preserved; all routes/spawns remain usable. QA delivery until 6.4 completes income. |
| **6.3 Map and sites** | 6.3a map/travel and safe-location persistence; 6.3b paid site unlock + two site camps/themes + legacy access policy. | First site free, paid unlock permanent and unique, all defined cards visible, no placeholder sale/travel, progress survives site switches and invalid location falls back safely. Do not publish a deadlocked paid build. |
| **6.4 Visitors and tickets** | 6.4a one visitor route/cashier/payment; 6.4b capped queue/scaling + integrated economy playtest. | One payment per visit, no income from partial/undisplayed fossils, no offline/unfocused income, no obstruction, correct reload semantics. Run zero-drop reachability using real commands. Enables combined paid progression release. |
| **6.5 Helpers** | 6.5a purchase/assignment/task rules in tests; 6.5b one visible slower helper and target contention in QA. | Permanent ownership/limits, only assigned active-site work, no player obstruction, no lower-layer bypass; unfinished work at 60% resumes at 60%. Normal fossil flow cannot release before 6.6. |
| **6.6 Storage and persistence** | 6.6a custody/storage/cleaning-transfer rules; 6.6b delivery animation and interrupted travel/reassignment/reload checks. | Confirmed finds survive every interruption at original site, never auto-enter bag, repeated collection is harmless, stored finds stay reachable, cleanup waits for manual collection. Release helpers with this gate. |
| **6.7 Upgrades** | Separate proposal for level effects/costs/maxima and progression. | Requires separate approval; no upgrade implementation now. Recheck helper-versus-player effectiveness and entire economy after approval. |

For 6.7, integrate effective digging/movement stats through actor profiles at the shared work/movement boundary. Preserve saved partial work if a level changes task duration. Recommend deferring ticket-price upgrades because display completion already supplies that benefit; consider visitor-capacity upgrades only if playtesting shows a useful, readable constraint. Do not prebuild menus, levels or costs.

### Detailed acceptance criteria for 6.1

1. **Fresh and migrated money:** a fresh game has the approved integer starting amount; each supported old V2 fixture migrates once with that same grant and all legitimate progress intact. Repeated load/retry grants nothing more. No V1 import.
2. **Reward stability:** generate and persist outcomes before reward-bearing actions. Reload before a hit, after the first hit, after a clear and after closure never rerolls the manifest. Outcome generator fixtures verify both reward and no-reward cases without probabilistic/flaky assertions.
3. **Layer identity:** first pit has 64 eligible units for a fresh save, second 128; only the final hit of a layer can reward it. Adjacent layers/cells/sites have independent stable keys. A wrong/blocked/out-of-range hit cannot pay.
4. **Cleanup policy:** if the recommended policy is approved, every newly removed layer in a cleanup pop resolves once in the same snapshot. No coin from animation restarts, completed columns, old cleared layers or a closed site's re-entry attempt. Test a partially cleared multi-layer column explicitly.
5. **Atomicity:** money and cleared/claimed state appear together in the stored JSON. Inject a failure immediately before write: old persisted snapshot remains intact, no success effect fires, exact candidate is retained and gameplay pauses. Retry publishes once; reload before retry restores the last successful snapshot without a half-reward.
6. **Input and integer safety:** repeated commands, invalid IDs, negative/fractional/non-finite/unsafe balances, duplicate claim IDs and inconsistent reward/dig pairs are rejected. Zero-reward clears still progress normally.
7. **Checkpoint/reset safety:** an earlier scheduled brush snapshot cannot overwrite a later coin commit. Reset/cancel, reset failure, stale timer callback, disposal and queued retry cannot resurrect money or progress from the previous game.
8. **Session protection:** two same-origin tabs cannot concurrently mutate one save. Test losing/reacquiring session ownership, page restore, external storage change and unavailable lock/storage recovery. No real profile is touched.
9. **No gameplay regression:** current two-hit cadence, whole-layer order, depth/burial reveal, automatic cleaning, explicit bag action, harmless assembly, partial displays, site cleanup/closure, story buttons and free progression continue to work. No new balancing of existing shovel or walking speed.
10. **Small Cyrillic UI:** persistent coin icon/count and short gain feedback; no restored excavation percentage card, obscured fossil or interaction ring. Failure uses existing retry UX with accurate save status. Inspect before/after at 1440 × 1000 and 1280 × 720; check 390 × 844 for overflow without claiming touch support.
11. **Configuration safety:** assert first-site free access and the proposed starter-affordability invariant against planned stand costs in the balance model. Spending is not implemented in 6.1. No unused helper/visitor simulation or speculative purchase framework.
12. **Delivery:** run `npm test`, `npm run build`, and a targeted isolated browser coin/failure/reload journey plus relevant existing journey regressions. Record actual browser/version/viewports, screenshots, timings and remaining manual risks. Do not equate tests with Luka's acceptance.

Likely 6.1 edits: `game/journey.ts`, `game/site-completion.ts`, `persistence/save.ts`, `app/prototype.ts`, small new economy/commit/session modules, HUD/text/CSS and focused tests/browser script. Leave fossil art, navigation, stand geometry and installed packages unchanged unless a concrete integration need is found.

## 13. QA matrix and performance risks

Use the existing script contract: `npm test` is `node --test tests/*.test.ts`; `build` is `tsc && vite build`; `dev` / `preview` run Vite. There is no configured `test:e2e` or lint script. Existing `scripts/check-*.mjs` scripts take an external Playwright module path and URL; a sibling Playwright installation was found, but no dependency was added and no browser scripts were executed for this plan.

| Area | Automated checks to add with the relevant increment |
| --- | --- |
| Purchases | Rapid double-clicks, simultaneous queued intents, exact balance, insufficient funds, unmet prerequisite, already-owned offer, limits and overflow; failure/retry/reset around commit. |
| Sites/travel | Locked/unbuilt destination rejected; purchased access survives reload; hub fallback for invalid location preserves all entitlements; interrupted work retained; closed pit never reopened by travel. |
| Helper work | Leave at exactly 60%, return/reload at 60%; hidden time yields zero work; inactive assignment stays paused; reassignment cancels only unfinished work and preserves ownership/upgrades/finished clears. |
| Invalid tasks | Target removed, layer already cleared, layout changed, task ID wrong: cancel only task, preserve confirmed finds, select legal replacement. |
| Shared excavation | Two helpers and player contest the final layer; exactly one clear/reward/claim; whole-layer order and multi-depth exposure remain true. |
| Fossil custody | Switch site/reload/reassign during carry; original-site storage receives the same unique find; no inventory leak; helper cannot take a player-cleaning find. |
| Box transfer | Rapid repeated collect, dirty fossil, cancelled/partial cleaning, full reload with stored finds, failed transfer save; one terminal collected entitlement and no duplicate storage. |
| Tickets | Repeated payment, rate change mid-visit, all partial/zero displays, paid/unpaid reload, queue saturation, hidden/modal/away pause, failed payment save. |
| Migration | Representative fixtures across V2 schemas 1–12 plus every new shipped schema; old earth/cleaning/assembly/closure retained, no retroactive coins, grandfathered assets/access, invalid/newer saves protected. |
| Deadlocks | Zero coin drops, soil exhausted, both starter purchase orders, all allowed premature spending, no ticket yet, one display, all paid unlock orders, old saves with finished pits, all sites exhausted and unnecessary helper offers. |
| Development speed | ×1 and ×10 produce equivalent valid work/reward counts over simulation time; opening a panel mid-frame stops remaining substeps; no double claims. |

Performance risks are concrete: the current renderer already rebuilds the active room, constructs many separate floor/fossil meshes, uses high-quality shadows and projects exhibit label circles each frame. Helpers introduce target scans and moving shadows; visitors add animated meshes; whole-snapshot cloning and synchronous saves may cause stalls if called for every actor on every frame. Shared-step scheduling must avoid rebuilding previews or DOM lists for task-progress ticks.

Measure before optimizing: at ×1 on the intended machine, record median/p95 frame time, scene mesh/draw-call counts, memory after repeated travel, and serialization/write time. Test zero actors, then a small visitor route, six visitors, one helper, and finally two helpers only when that limit is usable. Museum visitors and site helpers need not render together. Check ×10 separately as a developer stress mode, not a child-facing performance target. Provisional goal is smooth 60 Hz on the agreed desktop with no recurring >50 ms transaction stalls; actual acceptance requires hardware measurement.

Reuse materials and simple actor geometry, avoid frame-by-frame mesh recreation, cache legal helper candidates until layer/soil changes, and serialize bounded task checkpoints together. Keep one active scene and existing dispose behavior. Raise neither crowd nor workforce limits until screenshots and a hands-on session show paths, fossils, the player and interactions remain clear. No crowd physics library, worker system or speculative chunk-splitting refactor is proposed now.

## 14. Decisions needed now versus later

**Needed to approve 6.1 only:**

1. Approve implementation of the bounded economy foundation after reviewing this plan.
2. Approve **20 starting coins, 12.5% chance, 1 coin**, per cell-layer, with outcomes frozen and saved before digging.
3. Approve paying finite coin rewards during automatic cleanup as well as ordinary final shovel hits.
4. Approve old-save treatment: one starting grant, no retroactive cleared-soil rewards, existing gameplay progress retained; save-before-success with retry/pause on failed writes.

The combined release gates for 6.2–6.4 and 6.5–6.6 are recommendations to accept when scheduling those increments, not permission to implement them together now.

**Can wait for the owning increment:**

- **6.2:** stand/expansion prices, first-hall/wing presentation, assembly-at-stand interpretation, fixed slots and grandfathering existing space/stands.
- **6.3:** current site names, period wording/themes, first paid site cost/prerequisites, map/camp presentation and legacy second-site access policy. Future site content/periods remain unselected.
- **6.4:** cashier staffing, immediate credit versus a cash pile, current-display pricing/removal policy, visitor rate/caps/routes and paid/unpaid restart behavior.
- **6.5–6.6:** helper cost/limits/efficiency, work-unit semantics, cleaning at the storage box, actor routes and storage presentation. Ownership/work/upgrades persist as specified; no offline work is already a confirmed requirement.
- **6.7:** upgrade levels, costs/caps, effective-stat changes and whether visitor/ticket improvements have a distinct benefit.
- **Phase 5 / release:** Luka's playtest, scientific/art acceptance, intended hardware and final first-museum completion experience. These remain open while bounded engineering proceeds only as approved.

## Delivery record

Changed documentation: this plan, `docs/roadmap.md`, `docs/decisions.md`, and a current-status note on the historical `docs/architecture.md` proposal. Gameplay source, tests, scripts and dependencies were not modified. The production build regenerated ignored `dist` output.

Performed: repository/source/test inspection, **78 passing unit tests**, **passing production build with existing bundle warning**, the explicitly limited abstract economy calculation/state enumeration above, and local-link checks on the four changed documents. Reference-link checks found moved images; links in the touched roadmap/architecture documents now use their actual `references/museum/` paths. Not performed: fresh browser QA, target-machine profiling, scientific review, Luka playtest or any Phase 6 implementation. No claim is made that proposed mechanics already pass implementation tests.

**Delivery update (2026-10-26):** 6.1–6.4 are implemented in normal play, with an independent development QA slot. Review [6.1 QA](qa/economy.md), [6.2 QA](qa/purchases.md), [6.3 QA](qa/world-map.md) and [6.4 QA](qa/visitors.md). Next is bounded 6.5, with helper decisions still required. Phase 5 acceptance stays open.
