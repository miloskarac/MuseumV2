# Phase 6.2 — Stand purchases and museum expansion

**Current delivery, 2026-10-26:** [6.4](visitors.md) adds recurring ticket income and enables purchases/maps/visitors in normal play, schema 16. The reports below preserve earlier delivery history.

**Follow-up, 2026-10-24:** the same preview now includes Phase 6.3 map/travel and uses schema 15. Its purchase regression was rerun successfully. See [current preview and QA](world-map.md); the report below records the original 6.2 scope and schema-14 contract.

Implemented 2026-10-23 with Miloš's explicit approval of the proposed prices, fixed slots, assembly-at-stand flow, old-save ownership and isolated QA delivery. [Decision record](../decisions.md). This is the bounded 6.2 increment; sites/maps, visitors/tickets and helpers are not added.

## Try the preview

Run `npm run dev` and append **`?purchases=1`** to the local URL Vite prints. The QA server used for this delivery is [purchase preview](http://127.0.0.1:5186/?purchases=1). It shows `Проба куповине · посебна игра` in the header. Click a gold price marker, then `Купи` to confirm. Closing the dialog spends nothing.

The preview uses its own localStorage key, `museum-for-luka-v2:purchases-qa`, and its own Web Lock. It does not read or overwrite Luka's ordinary playthrough. `Нов почетак` resets only the active save slot. Two purchase-preview tabs compete for the QA lock; a normal tab and a preview tab can run independently. Keep using a disposable browser profile for QA.

Normal development play without that parameter and production builds retain the 6.1 game: all current stands/space remain available without purchase, on schema 13. Production ignores the preview parameter. The paid preview uses schema 14. This separation implements the approved release gate; it is not a temporary discount or rescue grant.

The preview has finite digging income and no ticket income yet. Both first-pit stands are affordable from the starting 20 coins even with zero drops. Later purchases can run out of money; do not treat this QA build as Luka's full progression release. The normal game remains playable while 6.3–6.4 are developed separately.

## Approved behavior

| Purchase | Price | Prerequisite |
| --- | ---: | --- |
| Dimetrodon stand | 12 | Museum; not already owned |
| Trilobite stand | 8 | Museum; not already owned |
| West wing | 18 | One complete first-pit exhibit on an owned stand |
| Eryops stand | 12 | Wing, completed first-pit display and access to site two |

Site-two access still means first-site closure in 6.2. Paid site ownership is a 6.3 decision, so no speculative site entitlement is saved now. Partial exhibits remain visible and can be resumed, but do not qualify as completed displays. There is no selling, relocation editor, partial payment, automatic timed spending or new income source.

A fresh preview begins in the original 16 × 12 hall with no stands. Its gold octagonal markers and coin tokens are distinct from the round assembly circles. Buying a stand constructs its existing artwork at its fixed position and enables the existing click/drag assembly. Names and stories still wait for exhibit completion. Buying the wing extends the hall to the existing 25 × 12 layout and reveals Eryops's stand offer.

Floor dimensions, walkable bounds, stand obstacles, interaction spots and camera framing come from one ownership-based layout selector. Entry, first two display positions and furniture stay at their existing coordinates. Unbuilt stands have no invisible collision. If construction would overlap the player, the accepted purchase moves them to the stand's safe interaction marker; otherwise it preserves their position. Expansion removes the previous west boundary.

The UI submits only the offer ID. Rules look up its fixed price, check room, ownership, prerequisites and sufficient integer balance, then create one candidate containing both the deduction and entitlement. The existing commit coordinator saves before publishing the new geometry, balance or success. A failed write keeps the old museum visible and pauses mutations; retry saves that exact candidate once. Reload before retry restores the previous successful state.

## Schema 14 and migration

`MuseumSave` wraps the frozen 6.1 discovery/economy snapshot with `museum: { version: 1, owned: [...] }`. Each ownership entry has a stable offer ID, `source: purchase | legacy`, and the amount paid. Four finite offers are supported; this is not an inventory or general transaction framework.

The reader validates unique known entitlements, exact paid prices, prerequisites, placement ownership and coin arithmetic. It reconstructs lifetime income by adding paid costs to the current balance and checks that against the frozen schema-13 economy validator, including all soil manifests and claims. Future price/income changes require an explicit versioned policy; do not silently change existing receipt interpretation.

Schemas 1–13 migrate through their existing validators, then receive all three stands and the existing wing as zero-cost legacy ownership, even if empty. Existing coins, claims, soil, cleaning, collection, partial assembly, closure and location remain intact. No debit, refund or repeat grant occurs. A malformed, inconsistent or future save stays protected behind recovery. Unit tests exercise all prior V2 versions; browser QA exercises a schema-13 save with partial placement. Migration tests seed only the QA slot; there is no automatic copy of the normal playthrough.

The normal schema-13 parser is unchanged. Old-schema support and preview-schema support are separate modules so unreleased ownership fields cannot leak into ordinary saves. Local saves remain profile/origin-specific and are not a backup or protection against deliberate external editing.

## Verification and screenshots

Browser checks used disposable **Microsoft Edge 155.0.4283.62** profiles. The purchase flow was checked at **1440 × 1000**, **1280 × 720** and **390 × 844**. Screenshots were manually inspected. The existing low-poly fossil art, material style and forgiving interaction rules are retained; no new raster assets or dependencies were added.

| Check | Result |
| --- | --- |
| `npm test` | **107 passed, 0 failed**, about 1.02 seconds of test runtime. Adds purchase/migration/layout coverage plus bounds and isolated-lock regressions. |
| `npm run build` | **Passed**, TypeScript and Vite, about 3.63 seconds total. Main JS 1,134.56 kB minified / 285.85 kB gzip; existing >500 kB warning remains. No runtime performance claim. |
| `scripts/check-purchases.mjs` | **Passed**: fresh compact hall, confirmation/cancel, prerequisite and insufficient-funds messages, failed stand/wing writes, exact-candidate retry, reload before retry, safe construction under player, wing traversal, owned assembly with harmless misses, partial/reload, old-save preservation, reset, separate normal/QA storage and locks. Checks marker/button viewport bounds and no overlap with exit instructions. |
| `scripts/check-purchases-release.mjs` | **Passed** against production preview: purchase parameter ignored, all ordinary stands usable, schema 13 retained, no QA or development controls, QA storage untouched. |
| `scripts/check-economy.mjs` | **Passed** in normal mode: digging rewards, failure/retry, cleanup/closure, migration/reset, responsive HUD and session protection. |
| `scripts/check-journey.mjs` | **Passed** in normal mode: real-input seven-find journey, explicit collection, partial/complete assembly, slab display, failure/retry, corrupt/denied-storage recovery, reset, desktop/portrait activity views; no browser errors. |

Focused rules tests also cover either first-stand order with zero digging income, continued digging after spending, all legacy versions, corrupt ownership/receipt/balance combinations, duplicate commands, stale pending purchase cancellation on reset, and reachability of each purchase/display/exit through every valid stand/wing layout. The browser's fully funded expansion fixture uses actual settled soil outcomes from a deterministic seed; it does not add an income source to gameplay.

| Viewport | Before: 6.1 full hall | After: fresh 6.2 QA hall |
| --- | --- | --- |
| 1440 × 1000 | [Before](purchases-before-1440.png) | [Purchase markers](purchases-fresh-1440.png) |
| 1280 × 720 | [Before](purchases-before-1280.png) | [Purchase markers](purchases-fresh-1280.png) |
| 390 × 844 | [Before](purchases-before-390.png) | [Compact price markers](purchases-fresh-390.png) |

Further evidence: [purchase dialog](purchases-dialog-1440.png), [narrow dialog](purchases-dialog-390.png), [failed purchase](purchases-failed-purchase.png), [built stand](purchases-stand-built.png), [insufficient coins](purchases-insufficient.png), [expanded hall](purchases-expanded.png), [partial Eryops display](purchases-expanded-partial.png), [preserved old museum](purchases-migrated.png).

Small-screen labels use coin/price markers with full accessible names and complete dialog titles; they avoid the exit label. No horizontal page overflow was observed. The world remains small at 390 pixels wide, an existing limitation; this does not establish touch support. Luka has not yet tested purchase comprehension or pacing.

Reproduction with the indicated dev/preview servers running:

```powershell
npm test
npm run build
node scripts/check-purchases.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
node scripts/check-purchases-release.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5187/
node scripts/check-economy.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
node scripts/check-journey.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
```

The Playwright path is existing local QA tooling. `npm run preview -- --host 127.0.0.1 --port 5187` serves the production build for its release-gate check.

## Changed files and remaining gates

- New: `src/content/purchases.ts`, `src/game/purchases.ts`, `src/game/museum-layout.ts`, `src/persistence/museum-save.ts`, `src/ui/purchases.ts`.
- Integration: `src/app/prototype.ts`, `src/game/navigation.ts`, `src/persistence/session.ts`, `src/presentation/world.ts`, `src/ui/hud.ts`, `src/ui/journey.ts`, `src/style.css`.
- Verification: `tests/purchases.test.ts`, additions to navigation/session tests, `scripts/check-purchases.mjs`, `scripts/check-purchases-release.mjs`, new screenshots and refreshed normal regression screenshots.
- Documentation: this record, decisions, roadmap, Phase 6 plan and architecture status note.

Human review should check that gold purchase markers are distinguishable from yellow partial-assembly circles and that the confirmation/price wording is clear for Luka. Phase 5's content/scientific/art acceptance, target-machine performance and child playtest remain open. Recurring income and the combined zero-drop progression test are still required before enabling paid progression in normal play. The next development increment is 6.3, with its own site price, access-migration and travel decisions.
