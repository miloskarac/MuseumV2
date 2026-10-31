# Outdoor excavation refinement — 2026-10-05

Historical specification. The [October 7 shovel update](digging-shovel.md) supersedes the 6 × 6 grid, continuous digging, remote clearing, dimension progression, and schema-2 sections below. The current pit is 8 × 8 with two animated hits per layer and save schema 3.

## Authorized scope and reference interpretation

The museum exit now leads to an outdoor clearing. Only the first site is playable; two further sites are visible locked plots. The museum's geometry, layout, materials, lighting, camera, walking speed, collision footprints, and portal position are unchanged.

The five images in `docs/references/dig-sites/` were inspected before implementation. Adapted details: outdoor vegetation and open ground, separate surveyed plots, a striped shelter over the first entrance, entrance circles and locked-site feedback; a square grid of soil blocks, a ladder, revealed pit depth, and walking through cleared tiles; a broad speckled soil tray, contrasting fossil background, brush cursor, progress, and a large continue-later control in cleaning. No coin amounts, rewards, species identities, or undisplayed interactions were inferred from screenshots. `docs/references/museum/` was checked for consistency only.

This build retains the single unnamed bone study and established spatial cleaning mask. It does not implement additional fossils, assembly, museum placement, visitor/economy systems, or future playable sites.

## Flow and progression

1. Leave the museum through the existing portal and arrive outside its outdoor counterpart.
2. Stand in the first site's entrance circle to reach its ladder. Future plots do not transition or accept payment.
3. Stand near a soil block to dig it automatically. Digging remains 8 seconds per full tile (the existing per-cell default). Walking away retains that cell's progress. Uncleared blocks stop walking; cleared tiles can be entered at the lower pit floor.
4. Revealing the find opens cleaning automatically once. Closing it early preserves the mask and exposes the manual resume button. Loading a save restores exploration at a safe ladder-side anchor, not a modal.
5. Uncovering the final find enables the remaining-tile sequence. It runs visibly in the pit while exploration is active; cleaning and other dialogs pause it so tiles cannot disappear unnoticed behind a panel. Each current tile shrinks to the floor and disappears before the next starts. Leaving the site or hiding/unfocusing the page pauses the sequence.
6. Site completion requires both the cleaned/collected find and all tiles cleared. Only then is site 2 marked eligible for a future purchase. Site 3 still requires site 2. The completed first pit remains inspectable and its exit remains usable.

Purchase boundary: V2 has no agreed wallet, price, or payment source. The requested first-site-only scope is implemented with a “purchase later” status after the prerequisite, not a working transaction. No coins are granted, charged, or displayed; an unbuilt site cannot be bought or entered. A working purchase and its funding remain a later explicit decision.

Dimension definitions use the number of preceding completed sites: `min(8, 6 + floor(completed / 2))` columns and rows. Thus sites 1–2 are 6 × 6, 3–4 are 7 × 7, and 5 onward are 8 × 8. Depth defaults to `1 + floor(completed / 2)` levels, so it keeps increasing after the horizontal cap. The exact depth cadence and clearing speed are reversible implementation defaults, not inferred V1 values. Only the 6 × 6, one-level geometry is instantiated here.

## Current save contract: schema 2

The same V2-specific localStorage key, `museum-for-luka-v2`, now contains:

```json
{
  "version": 2,
  "room": "excavation",
  "dig": { "courtyard-l0-r5-c2": 1, "courtyard-l0-r4-c2": 0.4 },
  "cleaning": {},
  "collected": []
}
```

- Rooms: `museum`, `outdoors`, `excavation`. Museum/outdoor reload uses the existing safe arrival; excavation reload uses the safe ladder-side anchor.
- Grid: 36 stable IDs, `courtyard-l0-r0-c0` through `courtyard-l0-r5-c5`. Rows run front-to-back in world Z, columns left-to-right in world X. Missing dig values mean zero; finite values are in `[0, 1]`. Digging and automatic clearing use the same per-tile progress.
- The existing `bone-study-01` is uncovered by `courtyard-l0-r4-c2`. Its 24 × 14 cleaning mask, eligible-area indexing, 1.7-cell brush radius, and forgiving 90% threshold are unchanged. Collection still appends once and removes redundant cleaning coverage atomically.
- Clearing is derived from an uncovered find plus remaining tiles. It advances the first remaining tile in stable content order, at most one tile per frame, with a nominal 0.32 seconds for a full tile. A long frame cannot skip through the queue. Each completed tile checkpoints immediately; a partially cleared tile uses the existing bounded checkpoint schedule.
- Site completion and future eligibility are derived, not separately stored. No wallet, purchase flags, additional discoveries, offline progress, or animation timer is serialized.
- Corrupt/unsupported saves remain protected. Existing write failures/retry, one-second bounded checkpoints, activity/visibility flushing, safe reset confirmation, and stale-callback invalidation remain in place.

### Explicit upgrade from the earlier V2 save

Valid schema-1 saves are validated against their original IDs and invariants before conversion. `courtyard-pocket` progress maps unchanged to the new find-bearing tile. Positive partial progress also opens the approach tile so the preserved progress is reachable. Exact cleaning indices and the collected ID are retained. Already collected old finds map to a cleared first pit, preserving their completed state. Uncollected old finds retain the new clearing sequence. The converted state is written on the next normal checkpoint; reading a corrupt save never overwrites its raw value.

This is compatibility for the existing V2 playthrough, not V1-game import. Unknown versions and invalid old/new data still enter the existing recovery flow.

## Verification and human review

See [the refinement QA record](qa/excavation-grid.md) for checks, screenshots, changed modules, and remaining hands-on QA. Future prices/funding, exact later depth tuning, and authored later-site content remain outside this implementation.
