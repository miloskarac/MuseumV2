# Phase 6.1 — Economy foundation

Implemented 2026-10-23 after Miloš approved the bounded [6.1 plan](../phase6-plan.md). Phase 5 remains open. This increment adds saved coins without charging for existing stands or site progression. Visitors, purchases, the world map and helpers are later increments.

## Player behavior

- Fresh games start with **20 coins**. A cleared soil cell-layer has a **12.5% chance of one coin**. The first shovel hit does not pay; the hit that finishes the layer can pay once.
- Automatic cleanup also pays for eligible layers it removes, including multiple layers in one column. It cannot pay for a layer already cleared by the player or before migration.
- A small Cyrillic `Новчићи` count stays in the header. A successful earning briefly shows `+1` (or the combined amount for a cleanup column).
- Soil progress, the claim and the balance are written together before the clear/reward is published. If writing fails, the game pauses mutations and keeps the exact candidate for the existing retry control. Repeated retry cannot repeat the award. Reload before retry restores the previous successful snapshot.
- Cleaning retains its short autosave checkpoint. Collection, placement, room transitions and cleanup now also publish their accepted changes after a successful write. Forgiving cleaning/assembly, explicit bag collection, shovel timing and free site progression remain intact.

## Save contract and session ownership

The existing localStorage key contains **schema 13**: the discovery fields plus `economy: { version, seed, coins, sites }`. `JourneyState` and the historical parser retain their frozen schema-12 discovery contract; `GameSave` and `parseGameSave` own the current full snapshot. This avoids changing historical migration types to include fields that did not exist when those saves were created.

Each initialized site stores its layout/depth, all coin outcomes, migration exclusions and claimed reward IDs. IDs include site, layout revision, cell and layer. The first site's manifest is persisted at startup; a newly entered site gets its manifest in the saved entry transition. Previously progressed sites are initialized during migration. Rendering and reload never roll rewards.

Supported V2 schemas 1–12 first pass their existing migration/validation, then receive 20 coins once. All legitimate digging, cleaning masks, collected/placed parts, closure and location survive. Already cleared layers are excluded, including old cleanup. Current saves load their existing balance and manifests without another grant. Unsupported or inconsistent saves remain untouched behind recovery UI. There is no V1 import.

Schema 13 currently enforces `coins = 20 + claimed income`, because 6.1 has no spending or other income. Outcome generation and validation use the version-1 policy. Future balance changes must preserve that policy for existing manifests and version the contract; changing constants alone would invalidate old saves.

A Web Lock allows one writer per origin/browser profile. Another tab waits without loading or overwriting the save. Page suspension flushes, cancels pending timers and releases ownership; resumption reacquires and reloads storage. An unexpected external storage change pauses the active session. Unavailable locking fails closed. Confirmed reset invalidates old pending work and immediately persists a fresh seed, manifest and 20-coin balance.

These safeguards cover cooperative tabs in this local application. Browser storage is not a server authority, backup, protection from deliberate local editing, or a guarantee against profile deletion/disk failure. Separate origins and profiles have separate saves. Run on localhost or another secure context with Web Locks support.

## Verification

All browser checks use disposable headless **Microsoft Edge 155.0.4283.62** profiles and the existing external Playwright installation. Luka's profile/save was not opened. Screenshots were visually inspected; no fresh human or child playtest is claimed.

| Check | Result and coverage |
| --- | --- |
| `npm test` | **95 passed, 0 failed**, approximately 0.90 seconds. Includes the existing 78 tests plus 17 economy/commit/session cases. |
| `npm run build` | **Passed**: TypeScript and Vite production build, approximately 4.36 seconds total. Existing >500 kB chunk warning remains; main JS 1,130.37 kB minified / 284.45 kB gzip. This is not a runtime performance benchmark. |
| `scripts/check-economy.mjs` | **Passed**: deterministic final-hit reward, zero interim income, immutable failed candidate/retry, reload before retry, blocked movement, hidden/modal pause, old-save exclusions, cleanup interrupted by reload, finite closure total, reset/cancel, responsive HUD, competing tabs, page restoration, external conflict and unsupported lock. Uses controlled simulation ticks for failure timing; also exercises development ×10 cleanup. |
| `scripts/check-phase4.mjs` | **Passed**: slab walk-on/click/drag placement, harmless misses, partial/reload, write failure/retry, independent exhibit controls, legacy cleaning migration and reset. |
| `scripts/check-depth-progression.mjs … economy` | **Passed**: real keyboard movement, full-layer gate, deeper-pit digging/cleaning, reload, cleanup/closure, matching cameras and five-layer rendering fixture. |
| `scripts/check-eryops.mjs … --visual` | **Passed**: Eryops assembly, wrong targets, partial/reload, independent exhibit controls and responsive story cards. The historical single-column full-dig branch was not used; current depth coverage is above. |
| `scripts/check-journey.mjs` | **Passed**: fresh seven-find discovery-to-display journey through real keyboard/mouse input, click/drag assembly and explicit slab placement, partial/completed reloads, collection/placement failure and retry, reset/cancel/failure, corrupt-save recovery, denied storage recovery and responsive cleaning/assembly/story views. No console/page errors. |

The 17 new unit cases cover both soil outcomes, all legacy schema versions, partial multi-layer cleanup, finite site income across reload, integer/manifest/claim validation, immutable failed commits, stale autosave callbacks, reset failure, canceled lock acquisition and ×1/×10/paused simulation equivalence. The proposed first-stand budget (12 + 8) is checked against 20 with zero drops; those prices are still proposals, and no purchase rules are activated.

The older browser scripts were updated for current footprint/camera navigation, schema 13, save-before-success placement and reset creating a fresh snapshot. The journey's final viewport fixture now uncovers the full current footprint. These changes repair historical test assumptions without changing excavation balance or fossil layouts.

Example reproduction, with Vite already running at the supplied URL:

```powershell
npm test
npm run build
node scripts/check-economy.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
node scripts/check-journey.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
node scripts/check-phase4.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
node scripts/check-depth-progression.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/ economy
node scripts/check-eryops.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/ --visual
```

The Playwright path is local QA tooling, not a new project dependency. Run browser regressions without editing application modules mid-run: Vite reloads would discard the script's scene inspection handle.

## Visual evidence

| Viewport | Before | After |
| --- | --- | --- |
| 1440 × 1000 | [Museum before](economy-before-1440.png) | [Museum with balance](economy-after-1440.png) |
| 1280 × 720 | [Museum before](economy-before-1280.png) | [Museum with balance](economy-after-1280.png) |
| 390 × 844 | [Narrow before](economy-before-390.png) | [Narrow with balance](economy-after-390.png) |

The before view uses a fresh game; the after view uses the completed-pit QA fixture, so the bag count, balance and player arrival differ. The comparison evaluates the header layout. Scene geometry and style were not changed. The count remains legible, the narrow header wraps, and no horizontal overflow was observed. Existing narrow-screen world scale remains small; this is not touch-support acceptance.

Additional inspected evidence: [successful earning](economy-reward.png), [save failure before reward](economy-save-failure.png), [waiting second tab](economy-second-tab.png). The balance and feedback stay outside fossil/interaction areas and preserve the existing bright low-poly presentation.

## Files and remaining review

- New economy configuration/rules: `src/content/economy.ts`, `src/game/economy.ts`.
- Persistence and coordination: new `src/persistence/game-save.ts`, `src/persistence/session.ts`, `src/app/commit.ts`; integration in `src/app/prototype.ts` and generic writer support in `src/persistence/save.ts`. `src/game/journey.ts` documents the frozen discovery contract.
- Interface: new `src/ui/economy.ts` and scoped additions to `src/style.css`.
- Verification: `tests/economy.test.ts`, `tests/session.test.ts`, `scripts/check-economy.mjs`; current-contract corrections in `check-journey.mjs`, `check-phase4.mjs` and `check-eryops.mjs`; new screenshots and refreshed regression screenshots.
- Documentation: this report, the Phase 6 plan, roadmap, decisions and architecture status note.

Before accepting the increment for Luka, check that he notices and understands the count and short gain feedback during normal digging. Existing scientific review, Eryops art/content acceptance, target-machine performance and broader Phase 5 playtest gates remain open. Unit/browser checks do not establish enjoyment or appropriate long-term economy balance. No later Phase 6 increment was implemented.
