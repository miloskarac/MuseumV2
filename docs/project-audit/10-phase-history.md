# Phase history and documentation drift

Audit date: 2026-11-08. This history is based on repository decisions, roadmap and QA documents, checked against current source where possible. Git history was not used. Historical approvals/results are reported as documented, not independently reenacted.

## Phases 1–6

| Phase | Documented introduction | Present source evidence / acceptance limits |
| --- | --- | --- |
| 1 — Walkable visual prototype | Babylon scene, fixed-angle movement, collisions, transitions and Cyrillic HUD. Roadmap records visual approval on October 5. | `presentation/world.ts`, `game/navigation.ts`, `input/keyboard.ts`, `ui/hud.ts`; later art/layout changes supersede the original prototype. |
| 2 — Persistent excavation/cleaning | One discovery, spatial brushing, local save/recovery/reset; subsequent grid, two-hit shoveling, cleanup/exit and explicit bag action. | `game/journey.ts`, `site-completion.ts`, `persistence/save.ts`; current pit is 8×8, not original 6×6, and has 13 discoveries across two sites. |
| 3 — Discovery to display | Inventory and forgiving assembly, visible partial placement, completion/story/tutorial behavior. Initial two-group Eryops prototype was replaced by six-group Dimetrodon on October 8. | `content/exhibit.ts`, `game/assembly.ts`, `ui/assembly.ts`; old two-group species/QA is historical. Roadmap leaves scientific review and child comprehension acceptance open. |
| 4 — Content/display reuse | Trilobite whole slab, explicit one-part placement, first-pit sharing; Eryops as another six-part skeleton/site and larger hall. Later multi-tile/depth/orientation/art/UI polish. | `EXHIBITS`, `SITES`, `SKELETONS`, slab builder, shared profiles; present reuse still contains slab/species-specific branches. |
| 5 — Stabilize agreed museum | Intended end-to-end content, clarity, save reliability, science/art review and target-machine playtesting. | Many supporting fixes/tests exist; `docs/roadmap.md` and `phase6-plan.md` explicitly leave human/scientific/performance acceptance open. No basis to label all Phase 5 exit gates complete. |
| 6 — Economy and management | Seven bounded increments: soil currency, stands/wing, paid sites/map, visitors/tickets, helper, storage/manual cleaning, permanent upgrades. | All present in normal-play schema 21; earlier QA-only gates are superseded. Additional visitor upgrades/new species were not delivered as part of 6.7. |

## Phase 6 increments and later changes

| Increment | Durable change | Current modules |
| --- | --- | --- |
| 6.1 | 20 starting coins, deterministic soil manifests/rewards, save-before-success and exclusive writer; schema 13 | `game/economy.ts`, `app/commit.ts`, `persistence/session.ts`, `ui/economy.ts` |
| 6.2 | Paid stands and west wing, ownership receipts; schema 14, initially isolated QA | `game/purchases.ts`, `museum-layout.ts`, `persistence/museum-save.ts` |
| 6.3 | World map, separate camps, paid second site and saved destination; schema 15 | `game/world-map.ts`, `content/world-map.ts`, `ui/world-map.ts`, `travel-save.ts` |
| 6.4 | Bounded visitors, attended tickets and renewable income; schema 16; enabled paid progression in normal play | `game/visitors.ts`, `visitor-simulation.ts`, visitor presentation/UI |
| 6.5 | One paid helper, assignment and retained slower work; schema 17, initially QA-only without new-find exposure | Helper rules/simulation/persistence |
| 6.6 | Canonical delivery/storage custody and manual cleaning/collection; schema 18; helper/storage flow released together | `game/storage.ts`, storage UI/presentation/parser |
| 6.7 | Paid permanent boots, shovel and helper-tool upgrades; schema 19 | Upgrade definitions/rules/stats/UI/parser |
| Later standing-payment increment | Saved partial contributions for stands/wing; schema 20 | `game/purchase-payments.ts`, `persistence/payment-save.ts`, focused tests. Exact introduction date is not established by a dedicated decision entry inspected here. |
| October 30 | Front visitor entrance, reversed cashier orientation, visual lifetime coin pile; then plaza/street/bus stop/parking scenery | Current entrance/exterior remain; lifetime decorative-money behavior is superseded. |
| November 7 batch 1 | Pending revenue and explicit banknote collection; varied exhibit viewing; removal of stand excavation prerequisites; schema 21 | `cash.ts`, `cash-save.ts`, revised visitor/purchase rules/UI and batch regression tests |

## Obsolete or conflicting documentation

| Historical statement/location | Actual current behavior |
| --- | --- |
| `docs/architecture.md` / `docs/roadmap.md` October 26 “current” schema 19 and 159 tests | Normal source uses schema 21; this audit executed 176 tests successfully without process isolation. |
| `docs/phase6-plan.md` proposed immediate ticket credit and no timed partial-payment system | Tickets are pending until collected; standing contributions persist under schema 20/21. |
| Older Eryops-stand gate requires site-two ownership/first closure | Removed; only museum/wing ownership, price and transaction guards remain. |
| October 30 decorative lifetime coin pile, unaffected by spending/collection | Replaced with pending banknotes that clear on explicit collection. |
| Early Phase 2 6×6 pit / original mask-only brushing / automatic collection | Current 8×8 plan, full-tray brush coverage and explicit bag action. |
| Early Phase 3 two-group Eryops slice | Current Dimetrodon and Eryops each have six groups. |
| Some roadmap language says site exhaustion commits before animation | Current `stepCompletion` commits soil removals, then automatic exit, then `closedSites`; unfinished cleanup/exit is resumed from state. |
| Older architecture proposal says visitor queues should not be saved | Current ordered unpaid visit records and paid receipts are saved; paths/timers/positions are not. |
| `content/economy.ts` comment says sites/stands remain free “in this increment” | Comment describes 6.1; current paid gates wrap it. |
| Journey/save comments describe schema 12 or 13 as the full application format | These are retained sub-contracts; top-level loader is `loadCashSave`, schema 21. |
| `docs/v1-handoff.md`: 200 coins, four exhibits, 16 discoveries, per-bone admission, save version 12 | Historical separate V1 behavior; current V2 has 20 coins, three exhibits, 13 discoveries, completed-display admission and schema 21. |

The new three-room/17-exhibit request is a future design requirement for this audit, not evidence that those features already exist. Earlier open museum-count decisions are superseded for planning by that explicit request, while content authoring, balance and migration details remain to be specified.

## Primary historical references

- [Decision log](../decisions.md): dated product decisions and supersession notes.
- [Roadmap](../roadmap.md): phase scope and open acceptance gates.
- [Architecture proposal](../architecture.md): useful initial boundaries, not a current implementation specification.
- [Phase 6 plan](../phase6-plan.md): planning/approval history with superseded sections.
- [Phase 3 historical slice](../phase3-slice.md), [Dimetrodon collection](../dimetrodon-collection.md), [shared pit/slab QA](../qa/shared-pit-slab.md), [Eryops QA](../qa/eryops.md).
- [November 7 QA](../qa/phase6-batch1.md): latest inspected implementation/regression record.

Recommendation: keep historical documents as history, and use this source-based audit as the current baseline. Do not resolve contradictions by copying old prices, species or save versions into future implementation.
