# Museum v2 — post-Phase-6 project audit

Audit date: **2026-11-08**. Source of truth: the current working tree at `F:\Milos\Repos\Museum v2`, including existing uncommitted Phase 6 fixes. This audits V2; the separate V1 repository was not inspected. The planned “Museum 1” is the first themed museum, not a claim that historical V1 behavior is current.

## Executive summary

The game implements a local-browser excavation-to-display loop with **three exhibits, thirteen discoveries, two playable excavation sites and one purchasable west-wing extension**. It uses Babylon.js/TypeScript/Vite, procedural 3D presentation and native DOM/Canvas UI in Serbian Cyrillic. Economy, map progression, one helper, original-site storage, permanent upgrades, partial purchases and pending cashier cash are present in normal play under **save schema 21**.

Completed exhibits on owned available stands determine admission (currently 2/3/4 coins) and arrival intervals (12/10/8 seconds). Partial skeleton parts do not count. Ticket sales accumulate pending cash; explicit banknote/button collection makes it spendable. Stands no longer require excavation-site progression; Eryops still requires the west wing for its physical slot.

The planned 17-exhibit, three-room Permian museum is **not implemented**. Fourteen exhibits are missing. Existing discovery/cleaning/placement and transaction machinery are reusable, but adding content alone is unsafe: ticket sales support only three prices, paid-site validation accepts only Eryops, legacy museum validation depends on the live offer list, and museum geometry is one expanding rectangle.

## Documents

1. [Project overview](01-project-overview.md) — concept, stack, commands and structure.
2. [Architecture](02-architecture.md) — startup, state flow, transactions and rendering ownership.
3. [Gameplay systems](03-gameplay-systems.md) — interactions, visitors, helper/storage, UI and feedback.
4. [Economy](04-economy.md) — actual values, income, spending, pending cash and safeguards.
5. [Fossils and excavation](05-fossils-and-excavation.md) — every exhibit/discovery, site association and lifecycle.
6. [Progression](06-progression.md) — purchase/site gates, recent stand change, tutorial and ending.
7. [Museum world and navigation](07-museum-world-and-navigation.md) — coordinates, camera, collision, paths and rendering.
8. [Save/load](08-save-load.md) — schema, migrations, validation and compatibility hazards.
9. [Testing and quality](09-testing-and-quality.md) — fresh results, historical evidence and coverage gaps.
10. [Phase history](10-phase-history.md) — documented phases and superseded requirements.
11. [Current state and technical debt](11-current-state-and-technical-debt.md) — reuse, limitations and prioritized risks.
12. [Permian museum gap analysis](12-permian-museum-gap-analysis.md) — all 17 exhibits, every planned requirement and bounded next tasks.

## Status at a glance

| Status | Features |
| --- | --- |
| Implemented and source-verified | Three exhibit lifecycles, two pits, fixed stands/one wing, soil coins, map/site payment, attended visitors/tickets, pending cash collection, deposits, helper/storage, permanent upgrades, local save/locks/retry/reset |
| Partial | Data-driven content with hard-coded presentation/layout/validation cases; responsive pointer UI without touch movement; configured two-helper ceiling with only one available helper |
| Missing | Three interconnected purchasable rooms, all-previous-room gate, locked-room dim previews, fourteen new exhibits, generalized whole-fossil presentation and price ledger, featured/room-completion presentation |
| Unverified | Current browser/manual/child acceptance, target-device performance, complete scientific review and period suitability of all proposed content/art |

“Verified” here means checked in source and, where stated, tested. It does not mean every system was manually played. Recommendations are explicitly labeled in the individual documents. Player-save completion was not inspected.

## Architectural findings and top risks

- Rules, content, presentation, UI and persistence are separated into useful modules; `startPrototype` remains the central coordinator. Critical outcomes publish after durable writes, with immutable retry and exclusive writer protection.
- `displayedExhibits()` is a reusable source of economic completion, but `visitors.sales` and its validator are fixed to three prices. A fourth completed exhibit needs a ledger change before tickets work.
- Historical save parsers depend on current content/offer definitions. Adding rooms/sites/finds can reject legitimate old saves, invalidate closed pits or grant unintended legacy ownership unless migrations freeze the old contract.
- Eryops currently belongs to the west-wing condition but is planned for Room 1. Mapping this old extension directly to a new room could create a completion/unlock cycle.
- Visitor paths use fixed Z sampling and static slot centers; a three-room layout requires real doorway/barrier reachability work. Whole-fossil presentation still assumes trilobite.
- Historical phase documents contain schema-19/immediate-credit/site-gated-stand claims that are superseded. Phase 5 human/science/performance acceptance remains open in the inspected record.

## Main recommendations

Preserve the existing commands, forgiving activities and commit/session system. First freeze compatibility fixtures, extend ticket accounting and define room/slot membership with explicit purchase gates. Migrate ownership and closed-site content deliberately. Then implement room geometry and generalized small-fossil presentation, complete Room 1, and add Rooms 2–3 in independently testable content batches. Keep decorations outside economy and required-exhibit lists. Approve new prices/site allocation and legacy-wing treatment before dependent implementation.

## Validation and audit changes

- **176 tests passed**, none failed/skipped, using `node --test --test-isolation=none tests/*.test.ts`. Normal `npm test` was blocked by sandbox `spawn EPERM`; see the QA document for the distinction.
- TypeScript no-emit validation and `npm run build` passed. The build reports the existing >500 kB warning; the main JS chunk is 1,208.06 kB minified / 310.63 kB gzip.
- Browser scripts and historical QA reports were inspected but not rerun. No performance benchmark or scientific fact review was performed.
- This audit added only the requested Markdown documentation as authored project changes. The authorized build regenerated `dist/`; no application source, gameplay data, assets or test logic were edited, and no dependencies were installed.
- Existing unrelated working-tree changes were preserved. No Git commits or history-changing operations were performed; documentation remains uncommitted.
