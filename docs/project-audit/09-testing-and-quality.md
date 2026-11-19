# Testing and quality assurance

Audit execution date: 2026-11-08. This separates freshly executed checks from historical QA reports. No browser save, application source, test logic or dependencies were changed by the audit.

## Checks actually executed

| Check | Result |
| --- | --- |
| `npm test` | Could not run its isolated test processes in the sandbox: `spawn EPERM`. This was an execution-environment failure, not a failing gameplay assertion. |
| `npm test -- --test-isolation=none` | Also hit `spawn EPERM`; the appended option did not resolve this invocation. |
| `node --test --test-isolation=none tests/*.test.ts` | **176 passed, 0 failed, 0 skipped**; same existing test files, executed without child-process isolation. |
| `.\node_modules\.bin\tsc.cmd --noEmit` | Passed, exit 0. |
| `npm run build` | Passed (`tsc && vite build`), exit 0; 635 modules transformed. |
| Browser/E2E, native manual play, child playtest | **Not run in this audit.** Historical evidence is summarized below, not claimed as fresh verification. |

Environment used Node **24.11.0**, npm **11.6.1**, installed TypeScript **6.0.3**, Vite **8.3.2** and Babylon core/loaders **9.29.0**. The build regenerated normal `dist/` output. No dependencies were installed/updated. No Git commit, push, merge, rebase or discard operation was performed.

Production output reports main JavaScript `index-CCvgxvvU.js` **1,208.06 kB minified / 310.63 kB gzip**, CSS **18.12 kB / 4.80 kB gzip**, plus engine/shader chunks and three illustration JPGs. Vite warns that some chunks exceed **500 kB**. This is a bundle-size warning, not evidence of a runtime failure. Runtime frame time, memory and low-end-device behavior were not measured.

## Test architecture and coverage

`package.json` defines `test: node --test tests/*.test.ts`. Tests use Node's built-in runner/assertions, direct imports of TypeScript rules/content and in-memory storage/scheduler/lock fakes. They include unit and multi-system transition/simulation tests; they do not require a running game server or real localStorage.

| Area | Representative files and verified intent |
| --- | --- |
| Excavation/cleaning/closure | `journey`, `grid`, `burial`, `depth-progression`, `site-completion` tests: hits, layers, footprint exposure, interruption, collection and closure |
| Content/assembly/art definitions | `assembly`, `dimetrodon`, `eryops`, `whole-fossil`, `find-footprints`, `fossil-art`: IDs, required groups, placement, geometry/profile structure and migration |
| Input/navigation/time | `keyboard`, `navigation`, `simulation-speed`: direction mapping, reachability/collisions, bounded updates and pause-related behavior |
| Economy/transactions | `economy`, `purchases`, `purchase-payments`, `phase6-batch1`: manifests, exactly-once rewards, prices, ownership, retained deposits, pending cash, retry/reset |
| Travel/visitors | `world-map`, `visitors`, `phase6-batch1`: site ownership, locations, queue/payment limits, price locking, tour paths/durations and display gating |
| Helpers/storage/upgrades | `helpers`, `storage`, `upgrades`: assignment/work, original-site custody, interruption/reload, manual collection, permanent effects |
| Persistence/concurrency | `save`, `session`, plus system-specific parser tests: invalid states, migrations, failed writes, exclusive writers, stale callbacks |

Filenames above have the form `tests/<name>.test.ts`. Passing pure tests does not establish rendering, touch ergonomics, scientific correctness, child comprehension or acceptable performance.

## Browser scripts and historical evidence

`scripts/check-*.mjs` are standalone Playwright checks, not a package-installed Playwright test suite. Typical invocation:

```text
node scripts/check-visitors.mjs <existing-playwright-index.mjs> <Vite-URL> [screenshot-prefix]
node scripts/check-phase6-batch1.mjs <existing-playwright-index.mjs> <Vite-URL>
node scripts/check-purchases-release.mjs <existing-playwright-index.mjs> <preview-URL>
```

Scripts dynamically import the supplied Playwright installation and generally launch headless Edge (`channel: 'msedge'`). They create isolated browser contexts, inject selected save fixtures, interact with DOM/keyboard/pointer inputs and sometimes inspect Babylon through development module URLs. Several capture screenshots into `docs/qa/`. Use disposable profiles; never run fixture injection against Luka's playthrough. Read each script's argument header before use: old journey/scene scripts may encode historical selectors and routes.

`docs/qa/phase6-batch1.md`, dated November 7, records successful visitor, early-stand, storage, helper, upgrade, world-map and production-purchase scripts in Edge 157.0.4341.42 at 1440×1000, 1280×720 and 390×844 as applicable. It reports direct banknote clicking/touch, failure/retry, save isolation and early stand purchases. These claims were inspected as **historical records**, not rerun or independently visually confirmed here. That report explicitly says native manual-control approval timed out, no child playtest occurred, and the full historical journey browser script was not run in that batch.

## Recent regression fixes visible in current code

- Tickets create saved pending revenue; collection is a separate atomic transfer. Old already-credited sales migrate with pending zero.
- Banknotes have explicit ray-picking registration and a large DOM collection fallback; the visual mesh pool is bounded independently of currency.
- Visitor targets vary by perimeter side/position with occupancy preference and randomized observation duration.
- Stand purchase and validation no longer require excavation-site progression; the Eryops wing placement restriction remains.
- Tests cover mixed ticket prices, repeat collection/payment, failed writes/retry, reset, malformed balances, early stand deposits/reload and seeded tours.

## Gaps and recommended regression work

1. Before adding exhibits, test fourth-through-seventeenth display admission and migration of mixed historic price receipts; the current ledger supports only three prices.
2. Add room eligibility/ownership/deposit tests with every required previous-room exhibit, duplicate events and legacy west-wing saves.
3. Exercise all new content paths, stable ID references, anatomy anchors, whole-fossil preview identity, site closure and stored-find custody.
4. Test adding content to already-closed sites and preserving deterministic soil outcomes without rerolls or retroactive grants.
5. Test real room doorways, blocked future rooms, viewing targets, dynamic construction under actors, and queue congestion in a disposable browser.
6. Profile three-room world build/rebuild, frame time, path-search cost, localStorage snapshot size/write time and the additional assembly engine on target hardware.
7. Recheck responsive controls and pending-versus-spendable comprehension with Luka. Touch Pointer Events are not a substitute for missing touch movement controls.

No new current-content high-severity gameplay failure was demonstrated by the checks executed here. Known expansion blockers and source-level limitations are recorded in [technical debt](11-current-state-and-technical-debt.md), and should not be mistaken for tested failures in today's three-exhibit game.
