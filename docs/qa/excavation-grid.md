# Outdoor excavation refinement QA — 2026-10-05

## Delivered scope

The museum portal now leads to an outdoor clearing containing the first playable site and two future locked plots. The first pit has 36 individually diggable blocks (6 × 6, one level), a lowered floor, exposed soil bands, and a ladder. Cleared cells become walkable. Discovering the existing bone study opens cleaning automatically; its spatial mask, forgiving threshold, resume behavior, and exactly-once collection remain intact.

After the find is uncovered, remaining blocks clear in stable order, one visibly shrinking block at a time. Dialogs, leaving the site, and hidden/unfocused play pause the sequence. Completion requires both collection and the entire cleared pit. Site 2 then displays future-purchase eligibility; site 3 remains locked. There is no wallet, payment, second playable site, additional fossil, or later-phase feature. See [the scope and schema-2 save contract](../excavation-refinement.md), including compatibility with existing V2 schema-1 saves and the provisional later-depth cadence.

Reference adaptation used the five images in `docs/references/dig-sites/`: surveyed outdoor plots, striped shelter, square soil blocks and ladder, broad speckled cleaning tray, brush cursor, progress, and continue-later action. Museum references were used only for consistency. No V1 prices or rewards were copied.

## Validation

All final checks passed:

| Check | Result |
| --- | --- |
| `npm test` | 23 tests passed: navigation, excavation/cleaning rules, persistence, grid dimensions, prerequisite ordering, sequential clear-out, partial clear save round-trip, and valid/invalid schema-1 conversion. |
| `npm run build` | TypeScript and Vite production build passed. Existing warning remains for chunks exceeding 500 kB; the main entry is approximately 1,068.92 kB minified / 263.52 kB gzip. |
| `node scripts/check-browser.mjs` | Passed keyboard travel through the outdoor clearing, locked-site behavior, first-site entry, grid collision/cleared-floor access, safe returns, unchanged camera, and responsive labels. |
| `node scripts/check-journey.mjs` | Passed real-input discovery/automatic cleaning, leave/reload/resume, spatial brushing, activity isolation, exactly-once collection, save failure/retry, bag, travel, reset/cancel, corrupt/newer-save protection, failed-reset preservation, and denied-storage recovery. Per-render tile counts confirm no more than one tile disappears between consecutive frames; completion and future-site status were checked. No browser console/page errors. |

Browser checks used Microsoft Edge **154.0.4258.53**, a disposable QA profile, and the local Vite development server. Captures/checks covered **1440 × 1000**, **1280 × 720**, **768 × 1024**, and **390 × 844** viewports. Screenshots were visually inspected; these scripted browser checks and image reviews are not a hands-on play session with Luka. The production bundle was built, not separately browser-playtested.

Museum camera, layout, geometry, collision footprints, walking speed, and portal position remain unchanged. SHA-256 of both `phase2-museum.png` and `grid-museum.png` is `4963394ED47744039B0BB6F1833D5F8446CEC47E382B78352AA42EBE53F6476F`: the baseline and new museum captures are identical.

## Screenshots

| View | Before | Current |
| --- | --- | --- |
| Museum, same framing | [Phase 2 museum](phase2-museum.png) | [Unchanged museum](grid-museum.png) |
| Excavation, same fixed camera | [Single-pocket site](phase2-excavation.png) | [6 × 6 grid](grid-navigation-excavation.png) |
| Cleaning | [Original panel](phase2-cleaning.png) | [Reference-adapted tray/sidebar](grid-cleaning.png) |

Additional evidence: [outdoor sites](grid-outdoors.png), [automatic cleaning](grid-auto-cleaning.png), [sequential clearing in progress](grid-clearing.png), [completed pit](grid-cleared.png), [future-site status after completion](grid-outdoors-complete.png), [portrait cleaning](grid-cleaning-390x844.png), [portrait landscape](grid-navigation-outdoors-390x844.png), [save failure](grid-save-failure.png), and [recovery](grid-recovery.png).

## Changed files

- `src/content/journey.ts`, `src/game/journey.ts`, `src/game/navigation.ts`: grid/site definitions, ordered eligibility, nearest-cell digging, dynamic pit collision, sequential clearing, and outdoor travel.
- `src/persistence/save.ts`: explicit schema 2 validation and preservation of valid existing V2 progress through schema-1 conversion; existing retry/reset safeguards retained.
- `src/presentation/outdoors.ts`, `excavation.ts`, `discovery.ts`, `world.ts`: outdoor clearing, surveyed plots, block pit and soil layers, saved tile rendering, lower pit-floor player height, and site-label projection.
- `src/app/prototype.ts`: transitions, safe restoration, automatic cleaning, and paused/checkpointed clear-out.
- `src/content/prototype.ts`, `src/ui/hud.ts`, `src/ui/journey.ts`, `src/style.css`, `src/assets/brush.svg`: Cyrillic site feedback and responsive reference-adapted cleaning presentation.
- `tests/grid.test.ts`, `journey.test.ts`, `save.test.ts`, `navigation.test.ts`, and both browser-check scripts: focused regression and end-to-end coverage.
- `docs/roadmap.md`, `docs/decisions.md`, `docs/phase2-save-contract.md`, `docs/excavation-refinement.md`, this record, and `grid-*.png` QA captures: implemented scope, compatibility, and evidence. Original Phase 2 deliverables/acceptance text remains unchanged.

## Remaining manual QA and decisions

- On Luka's intended machine, check that he recognizes the first entrance, approaching a tile to dig, and the ladder/cleared route. Assess the existing eight-second per-tile digging pace and the new nominal 0.32-second sequential clear speed.
- Check brush clarity, continue-later/resume, and returning through the outdoor clearing with the intended mouse/keyboard and window size. Portrait screenshots demonstrate layout only; touch controls are not implemented.
- During hands-on play, interrupt and reload midway through digging, cleaning, and clear-out, and inspect frame pacing on the target hardware. Automated persistence coverage passed, but does not establish play comfort or device performance.
- Future purchase prices/funding, authored later sites, and later depth tuning require a subsequent scope decision. Only the first site is playable in this delivery.
