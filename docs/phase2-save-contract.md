# Phase 2 save contract — version 1

Historical contract for the original Phase 2 build. The current implementation writes schema 5 and explicitly upgrades valid V2 schemas 1–4, preserving finds, partial digging, and cleaned cells. See [the current contract and conversion rules](digging-polish.md). This remains unrelated to V1-game save import.

Implemented 2026-10-05 for the authorized Phase 2 excavation/cleaning journey. Scope and acceptance criteria remain those in `roadmap.md`; this does not introduce Phase 3 display, assembly, or site exhaustion.

## Player flow and prototype settings

- Visit the existing excavation through its existing travel circle. Stand still in the shovel circle at the front of the pit to dig. Walking away pauses progress.
- One stable site (`courtyard-dig`), one cell (`courtyard-pocket`), one unnamed stylized fossil-bone discovery (`bone-study-01`). No species identification or scientific fact is asserted by this study.
- The current cell takes 8 seconds of active digging. No progress while the page is hidden/unfocused or a blocking panel is open; there is no offline progress.
- At full excavation, a button opens cleaning. Drag the left mouse button over the dirt; the brush sweeps between pointer samples so quick strokes count. Clicking also brushes a small area. Leaving the canvas resets the stroke segment.
- Cleaning uses an authored 24 × 14 eligible-area mask, brush radius 1.7 cells, and a forgiving 90% completion threshold. Off-mask strokes do nothing. Repeated strokes never add progress. At the threshold the remaining dirt clears and the find enters the bag once.
- Cleaning, bag, reset, and recovery dialogs suspend movement. Entry/exit clears held inputs. The large return button and Escape exit cleaning; reopening restores its mask.
- Collection does not close the site or modify the existing museum skeleton study. Both room travel directions remain available.

These timings and sizes are implementation defaults, not inherited V1 balance or separately approved final gameplay tuning. Review them with Luka before changing them.

## Durable data

One `localStorage` value under **`museum-for-luka-v2`**, schema version **1**. No V1 import, migrations, backend, backups, or export/import UI.

```json
{
  "version": 1,
  "room": "excavation",
  "dig": { "courtyard-pocket": 1 },
  "cleaning": { "bone-study-01": [51, 52, 53] },
  "collected": []
}
```

`room` is `museum` or `excavation`. Reload places the player at that room's existing safe `ARRIVAL` anchor, outside the travel trigger, with all activities closed. A new/reset session starts at the existing museum `START` anchor.

`dig` is sparse cell-ID → finite progress in `[0, 1]`; missing means untouched. `cleaning` is sparse discovery-ID → unique eligible cell indices, row-major from the top left. Only an uncovered, uncollected discovery can have a mask. `collected` contains unique known discovery IDs, with completed excavation as a prerequisite. Collection and removal of its now-redundant cleaning mask happen in one state transition and one saved snapshot. Inventory is derived from `collected`.

The validator rejects malformed JSON, nonobjects, unknown versions/fields/rooms/content IDs, out-of-range progress, duplicate IDs/indices, ineligible mask cells, masks before uncovering or after collection, and completed masks without collection. Definitions, modal state, transforms, percentages duplicated from masks, rewards, and placement data are not saved.

The shipped IDs and mask-index meanings are part of version 1. Breaking changes require deliberate conversion/versioning when needed; no migration framework is prebuilt.

## Checkpoints and failure behavior

- A pending checkpoint writes within 1 second of the first unsaved change during normal foreground operation; continuous changes update the pending snapshot without postponing its deadline.
- Flush on uncovering, collection, room travel, activity entry/exit, walking away from digging, blur, visibility change, page hide, and disposal when possible.
- Abrupt process termination may lose changes since the last successful write (normally up to one checkpoint interval). The game makes no claim to recover writes that storage rejected.
- Failed writes retain the latest live snapshot, display a short Cyrillic failure message, and expose retry in both exploration and activity panels. Only a successful storage write shows “Напредак је сачуван.”
- Missing storage starts fresh. Unreadable, corrupt, or unsupported storage opens blocking recovery, retains the original slot, and does not schedule writes. Retry rereads it. Recovery can proceed after storage becomes available or through separately confirmed reset.
- “Нови почетак” opens confirmation, with cancel focused first. Cancel leaves progression untouched. Confirm removes only the V2 slot and resets live progression, activities, and location after removal succeeds. Failed removal leaves the current session/save intact and reports failure.
- Pending save callbacks carry a generation token. Flush, reset, and disposal invalidate old callbacks, including a cancelled callback that still runs. A successful reset also discards the pending snapshot.

Saves belong to the browser profile and exact origin. Use a consistent local address for play and an isolated temporary profile for QA. This is a single local play session, not a multi-tab synchronization system.

## Verification

Rule and persistence tests: `tests/journey.test.ts`, `tests/save.test.ts`, using the existing Node test runner (`npm test`). Real-input browser journey and injected storage failures: `scripts/check-journey.mjs`. Visual and browser evidence: [Phase 2 QA](qa/phase2.md).
