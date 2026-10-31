# Phase 3 QA — 2026-10-08

Scope and changed files: [slice/content/save contract](../phase3-slice.md). Implementation verified; human acceptance gates remain below.

## Results

| Check | Result |
| --- | --- |
| `npm test` | **37/37 pass**. Both finds, unique content links, retained cleaning, wrong/premature/duplicate placement, derived bag and completion, partial/completed reload, permanent tutorial cutoff, schema 1–5 conversions, invalid saves, failed storage/retry/reset, site cleanup/closure independent of placement, movement and input rules. |
| `npm run build` | **Pass**. Existing large-chunk advisory remains. No dependency changes. |
| `scripts/check-journey.mjs` | **Pass**, fresh disposable save using real keyboard/mouse input. Two finds and explicit bag actions; first find cannot finish site; dirty/ready cleaning reload; failed final collection write pauses cleanup; cleanup reload and outdoor closure; harmless wrong click and missed drag; first group by click, second by drag 20px outside the correct target edge; immediate 3D group visibility; activity close/reopen; partial assembly reload; failed placement write and retry; name/card reveal; completed-card reload without duplicate placement; both tutorial arrows stay dismissed; bag becomes empty; reset/cancel and protected invalid/unavailable storage. |
| `scripts/check-completion.mjs` | **Pass**. One visibly paced tile pop/removal at a time, pause/reload, all-cleaning gate in an already empty pit, automatic ladder walk, exit reload, closure only after reaching the outdoor front, idempotent closure. Fixtures now supply both finds. |
| `scripts/check-browser.mjs` | **Pass**. Museum furniture collision, round trip and safe arrivals, blur/held-key behavior, soil walking, pit boundaries, camera framing, responsive labels and unavailable-site copy. |

Browser: **Microsoft Edge 154.0.4258.53**, headless Playwright with disposable profiles. Viewports: **1440×1000, 1280×720, 768×1024, 390×844**. Assembly targets, inventory buttons and close controls fit all checked viewports; no horizontal page overflow or browser errors were reported. Existing adjacent Playwright installation was used read-only. Luka's browser/profile/save was not accessed.

Manual visual inspection used the actual captured browser renders: empty/partial/complete museum, the cleaning result, desktop assembly, 1280×720 and 390×844 assembly, narrow completion card and narrow museum framing. This was screenshot inspection and automated interaction, **not a hands-on Luka playtest**. At desktop scale the low-poly scene retains the approved camera/materials, and group growth is conspicuous. Assembly silhouettes, labels and check marks separate available/missing/placed groups without relying solely on color. The very narrow world view remains small; responsive fit does not establish enjoyable touch play, which is outside this desktop slice.

## Before and after

Same 1440×1000 museum viewport. Previously the fossil was permanently visible; now it grows from earned placements.

| Before Phase 3 | Empty display | Partial display | Complete display |
| --- | --- | --- | --- |
| [Previous museum](polish-museum.png) | [Fresh museum](phase3-museum.png) | [One group](phase3-museum-partial.png) | [Both groups](phase3-museum-complete.png) |

- [Assembly with one accepted group](phase3-assembly-partial.png).
- [Placement write failure and retry](phase3-assembly-save-failure.png).
- [Assembly at 1280×720](phase3-assembly-1280x720.png), [768×1024](phase3-assembly-768x1024.png), [390×844](phase3-assembly-390x844.png).
- [Completed specimen card](phase3-story.png), [card at 390×844](phase3-story-390x844.png).
- [Second cleaned find](phase3-second-find.png), [site cleanup](phase3-cleanup.png), [closed site](phase3-closed.png).

## Reproduction

Start the configured dev server on an available local port. These are the commands used; the Playwright path is existing local tooling, not a new project dependency.

```powershell
npm run dev -- --host 127.0.0.1 --port 5184
npm test
npm run build
node scripts/check-journey.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5184/
node scripts/check-completion.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5184/
node scripts/check-browser.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5184/ docs/qa/phase3-navigation
```

## Observations versus decisions

**Observed engineering/visual issues:** initial navigation assertions still expected the old future-purchase hint; they were updated to test the new bounded-slice wording. Screenshot review caught an inherited bone highlight crossing the new skull drawing; it was removed. No unresolved runtime failures remain in the checks above. At 390px width the world scene is small, so this should not be interpreted as touch-play acceptance.

**Observed child-comprehension issues:** none recorded because Luka did not participate. This is absence of a playtest, not evidence that all wording/interaction is understood. No cutoff change follows from these observations.

**Product decisions:** see [decision log](../decisions.md) and the separate [two-group content choice](../phase3-slice.md). Eryops identity/art and educational copy remain implementation assumptions pending review.

## Remaining human acceptance

1. In a separate QA profile, give Luka only the initial prompt and observe whether he reaches the first site, recovers/cleans/bags both groups, follows the return cue, finds the blue assembly button, matches both silhouettes and understands the final card/completion cue. Record where explanation is needed without changing the tutorial cutoff.
2. Ask him to try one wrong placement, close/reopen assembly after the first correct placement, and revisit the card. Confirm forgiveness and the partial display make sense at his usual desktop viewport.
3. Obtain scientific/content review of the short Serbian draft and stylized model. [Sources and exact review limitations](../phase3-slice.md) are recorded; scientific review has **not** been claimed.

The first-complete-slice implementation is delivered. The roadmap's independent scientific-review and unassisted-child-play exit gates remain open. No Phase 4 content or broader simulation is implied as available.
