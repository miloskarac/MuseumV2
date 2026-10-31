# Phase 2 — persistent excavation and cleaning

2026-10-05. Implements only Phase 2 of [the roadmap](../roadmap.md). Its scope and acceptance criteria are unchanged. The implementation and save settings are documented in [the version 1 contract](../phase2-save-contract.md).

## Delivered journey

Travel to the existing site, stand in the shovel circle to uncover one unnamed fossil-bone find, walk away and resume, open cleaning, brush away dirt, and receive the find once in the bag. Digging and individual cleaned regions persist. Activities pause walking and provide a clear return path. Reload restores the existing safe room arrival with activities closed.

There is no new assembly, museum placement, exhibit progression/card, site-exhaustion transition, reward, economy, visitor system, additional site, or additional find. Existing camera, room dimensions, lighting, palette, scenery, collision footprints, walking speed, and portals are preserved. Phase 2 adds a small dig marker, shrinking soil pocket, revealed bone, Cyrillic progress/activity UI, bag, and save/recovery/reset controls. No dependencies were added.

## Screenshots and visual inspection

Approved before references: [museum](excavation-match-after.png), [excavation](excavation-match-excavation.png).

Fresh Phase 2 captures:

- [Museum](phase2-museum.png)
- [Excavation](phase2-excavation.png)
- [Uncovered find](phase2-uncovered.png)
- [Partially cleaned fossil](phase2-cleaning.png)
- [Collected fossil](phase2-collected.png)
- [Bag](phase2-bag.png)
- [Failed write and retry](phase2-save-failure.png)
- [Recovery](phase2-recovery.png)
- [Narrow site](phase2-site-390x844.png) and [narrow cleaning](phase2-cleaning-390x844.png)

Microsoft Edge 154.0.4258.53, isolated temporary QA profiles, DPR 1. Main captures are 1440 × 1000 with the existing orthographic camera `(12, 16, -16)` targeting `(0, 0, 0)`. Responsive site and cleaning captures also cover 1280 × 720, 768 × 1024, and 390 × 844. The existing navigation helper captured both rooms at those sizes. These are development-server captures.

Screenshots were visually inspected. The pit's soil bands and coping, clear walking routes, teal/brass finishes, and travel circle remain visible. Cleaning and recovery use matching cream/teal panels and large controls. The cleaning view uses a simple faceted bone study and removable soil shapes, not a scientifically identified specimen. Narrow portrait keeps controls usable but retains the existing small world view; the bag button wraps to a second header row.

## Checks run

- `npm test`: **18 passed** (7 existing navigation/keyboard tests, 11 new content/rule/persistence tests).
- `npm run build`: **passed**, including after final UI changes. Existing large-chunk warning remains; main entry approximately 1.065 MB minified / 262 KB gzip.
- `scripts/check-browser.mjs`: **passed** existing real-keyboard movement, blur clearing, pit circuit/collision/depth, floor opening, matching cameras, travel both ways, safe arrivals, label bounds, horizontal overflow, and browser-error checks.
- `scripts/check-journey.mjs`: **passed** the real-input discovery journey, interrupted digging, hidden-page pause/checkpoint, reload/resume at safe anchors, off-fossil and repeated strokes, exact saved cleaning areas, activity movement isolation, collection once, failed write/retry inside cleaning, collection after reload/travel, bag contents, cancelled and confirmed reset, reset after reload, corrupt/newer save protection, failed reset, and a denied `localStorage` getter followed by successful recovery retry.
- Browser checks found **no console or page errors** in the tested journey. A successful production build was verified; the full interactive browser journey ran against Vite's development server.
- Persistence unit tests explicitly execute a stale cancelled save callback after reset and confirm it cannot restore old progress or overwrite a later pending session. Tests also cover duplicate/out-of-range/ineligible saved data, bounded checkpoints, and retaining the latest snapshot after storage failure.

Reproduce using the existing read-only Playwright installation from V1:

```powershell
npm test
npm run build
node scripts/check-browser.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5183/ docs/qa/phase2-navigation
node scripts/check-journey.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5183/
```

## Changed files

- `src/content/journey.ts`: stable site/find/cell IDs, eligible cleaning mask, prototype tuning, Serbian Cyrillic text.
- `src/game/journey.ts`: pure digging, brushing, collection transitions and progress selectors.
- `src/persistence/save.ts`: version 1 validation/loading, checkpoint writer, failed-write retry, reset and stale-callback protection.
- `src/app/prototype.ts`: activity ownership, safe restoration, progress/room checkpoints, and UI/world coordination.
- `src/presentation/discovery.ts`, `src/presentation/world.ts`: state-driven dig pocket, bone, and interaction marker within the existing site.
- `src/ui/journey.ts`, `src/style.css`: cleaning canvas, progress, bag, modal focus/exit behavior, save/recovery/reset UI.
- `tests/journey.test.ts`, `tests/save.test.ts`, `scripts/check-journey.mjs`: focused automated verification.
- `docs/decisions.md`, `docs/phase2-save-contract.md`, this QA record, and `phase2-*.png`: authorization, explicit implementation defaults/save contract, and evidence.

## Remaining manual QA

This evidence is scripted keyboard/mouse interaction plus manual screenshot inspection, not a hands-on session with Luka. On the intended computer, in a separate QA profile:

1. Check that Luka recognizes the shovel circle and understands standing still, leaving, and resuming.
2. Review the 8-second digging time, brush size, 90% threshold, visual feedback, and Serbian prompts for comfort and comprehension.
3. Try leaving/reopening cleaning, closing/reopening the browser, and returning to both rooms. Review frame rate and brightness on the actual monitor.
4. Have Miloš review the adult-assisted reset confirmation and storage-failure/recovery wording. Keep Luka's real profile untouched during destructive QA.

Normal unexpected termination can lose changes since the last successful checkpoint (normally up to one second). Rejected storage writes are not durable until retry succeeds. The local save is tied to browser profile/origin and does not synchronize concurrent tabs.
