# Phase 6.3 — Map, site purchases and saved travel

**Follow-up, 2026-10-26:** Phase 6.4 completes recurring ticket income and enables the combined paid loop in normal play, schema 16. The independent development QA slot remains available. See [current game and verification](visitors.md); the report below records the original isolated 6.3 delivery.

Implemented 2026-10-24 after Miloš requested 6.3 and selected preservation of already-earned site access. [Decision record](../decisions.md).

## Preview and behavior

Run `npm run dev` and append `?purchases=1` to Vite's URL. The delivery preview is [http://127.0.0.1:5186/?purchases=1](http://127.0.0.1:5186/?purchases=1). This uses the existing isolated purchase QA slot and Web Lock, now with schema **15**. Normal play and production remain schema **13**; production ignores the flag. Reset affects only the active slot. Use a disposable browser profile for QA.

Click **Карта** in the header or walk to the world travel sign. The map pauses movement/digging and flushes pending work. It shows the museum, both current sites and the unavailable future site, with pictures, period wording, progress, prerequisites and prices. Buy access with **Отвори налазиште**, then choose **Путуј** separately. **Музеј** returns to the museum. Closing the map spends nothing.

| Site | Access | Camp |
| --- | --- | --- |
| Зелена пољана (`courtyard-dig`) | Permanently free | Green clearing, one-layer existing pit |
| Окерни брег (`eryops-dig`) | 24 coins, first-site closure and one completed display | Ochre clearing and border rocks, two-layer existing pit |
| Ново налазиште (`future-site-03`) | Unavailable; no purchase or travel | No scene/content added; period unselected |

Camp names, palettes and illustrations are reversible presentation choices. The Permian labels reuse existing large-specimen text; the decorative camps do not claim to reconstruct ancient environments or give the generic trilobite a narrower date. Fossil identities, burial positions and soil rewards remain unchanged.

Only the active camp is rendered; the preceding scene is disposed. Its entry circle opens its own pit. The pit exit returns to that camp. A completed pit stays closed while its camp remains visitable. Automatic cleanup and the return walk disable map travel until closure reaches the safe camp checkpoint. Helpers and storage are later increments.

## Save and transaction contract

`TravelSave` wraps the frozen schema-14 museum snapshot with `world: { version: 1, location, owned }`. Location is `hub`, `site-camp(siteId)` or `site-pit(siteId)`. The map itself and exact walking position are transient. Camp/pit/hub reloads use safe authored points outside travel triggers. Root `room`/`activeSiteId` remain compatibility fields for the existing journey rules; structured location determines their restored values.

First-site access is implicit. The single implemented paid-site receipt records ID, `purchase | legacy` provenance and exact paid cost. The reader adds site spending back before using the frozen museum/economy validators, so current balance plus stand/wing/site spending equals starting coins plus claimed soil income. Unknown, duplicate, wrong-price or contradictory entitlements are rejected. Paid Eryops stands require site ownership; existing legacy stands remain preserved.

Schemas 1–14 pass their existing validators first. Migration grants free site-two access only where first-site closure or legitimate historical progress already earned access. Early saves adopt the new purchase requirement. Existing coins, claims, digging, cleaning, collected finds, partial displays and stand/wing ownership remain intact. Old shared-yard saves resume at the museum; an interrupted automatic exit resumes at its own camp. Pit saves keep their site. Migration grants no rewards, refunds or second charges.

Malformed, removed, placeholder or unowned destination metadata falls back to the museum without discarding valid coins/progress/receipts. A saved closed pit becomes its camp. Invalid economic/progress claims and unknown newer save schemas remain protected behind recovery; they are not replaced with a new game.

Both unlock and travel create one immutable candidate and save before publishing success or changing the scene. Failed writes pause mutations and show the existing retry control. Retrying commits the same candidate once; reloading before retry restores the preceding successful save. Reset discards pending candidates. Brush masks, inventory and independent site progress survive switching and reload.

## Verification

Disposable **Microsoft Edge 155.0.4283.62** profiles, **1440 × 1000**, **1280 × 720**, **390 × 844**. Screenshots were inspected for legibility; keyboard-driven checks exercised the actual portals. Narrow map cards stack and scroll vertically without horizontal overflow. This does not establish touch support or Luka's acceptance.

| Check | Result |
| --- | --- |
| `npm test` | **119 passed, 0 failed**. Twelve new map/travel cases cover prerequisites, unique spending, separate travel, invalid destinations, migration, cleaning masks, both return paths, safe spawns, save failure/retry/reset and strict validation. |
| `npm run build` | **Passed**, TypeScript and Vite. Main JS 1,137.17 kB minified / 286.74 kB gzip; existing >500 kB chunk warning remains. No runtime performance claim. |
| `scripts/check-world-map.mjs` | **Passed**. Header and sign, close without loop, all cards, unavailable placeholder, independent camps, physical pit entry/exit, paused map, purchase/travel failures and retries, reload, cleanup/closure, legacy access, location fallback, reset and normal-save isolation. |
| `scripts/check-purchases.mjs` | **Passed** against schema 15. Existing stand/wing behavior, assembly, safe construction, migration, responsive layouts and independent writer locks remain covered. |
| `scripts/check-journey.mjs` | **Passed**. Ordinary seven-find discovery-to-display loop, click/drag/slab assembly, partial/completed saves, tutorial cutoff, failure/retry, recovery/reset and denied storage. No browser errors. |
| `scripts/check-purchases-release.mjs` | **Passed**. Production ignores the QA parameter, shows neither paid-purchase nor map controls, retains schema 13/free progression and leaves QA storage untouched. |

Browser scripts take the existing external Playwright entry point and server URL, for example:

```powershell
node scripts/check-world-map.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5186/
```

| View | Before | After |
| --- | --- | --- |
| Museum, 1440 × 1000 | [6.2](map-before-1440.png) | [6.3 map access](map-after-1440.png) |
| Museum, 1280 × 720 | [6.2](map-before-1280.png) | [6.3](map-after-1280.png) |
| Museum, 390 × 844 | [6.2](map-before-390.png) | [6.3](map-after-390.png) |

Additional evidence: [desktop map](map-cards-1440.png), [1280 map](map-cards-1280.png), [narrow map](map-cards-390.png), [green camp](map-green-camp.png), [ochre camp](map-ochre-camp.png), [first pit](map-first-pit.png), [second pit](map-second-pit.png), [failed unlock](map-failed-unlock.png), [opened site](map-opened-site.png), [completed camp](map-closed-camp.png), [automatic return finished](map-cleanup-finished.png).

## Changed files and remaining review

New content/rules/UI/save modules: `src/content/world-map.ts`, `src/game/world-map.ts`, `src/ui/world-map.ts`, `src/persistence/travel-save.ts`. Integration: `src/app/prototype.ts`, `src/game/purchases.ts`, `src/game/museum-layout.ts`, `src/ui/purchases.ts`, `src/ui/journey.ts`, `src/presentation/world.ts`, `src/presentation/outdoors.ts`, `src/content/purchases.ts`, `src/style.css`. Tests/scripts: `tests/world-map.test.ts`, `scripts/check-world-map.mjs`, updated purchase and release checks. Decision log, plan, roadmap, architecture status and this report document the delivery.

Paid progression still has finite soil income and can run out of money. It remains isolated QA until **6.4 recurring ticket income** is implemented and verified; no rescue coins or temporary free unlocks were introduced. Next human review: try the map, both camps, exhausted-site return and names/period wording. Phase 5's scientific/art review, Luka playtest and target-machine performance/acceptance remain open. No dependency, backend or normal-save migration was added.
