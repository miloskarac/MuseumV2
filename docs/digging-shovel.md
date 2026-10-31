# Shovel digging — 2026-10-07

The [2026-10-19 depth update](qa/depth-progression.md) now defines one additional layer per site and two layers per soil-color band, superseding this document's older depth cadence and per-layer colors.

The later [site-completion update](site-completion.md) supersedes this document's post-collection manual digging and enterable completed pits. [Digging polish](digging-polish.md) now defines the animation, walkable soil, explicit bag action, and schema-5 contract. The 8 × 8 geometry and two hits per layer remain in force.

## Scope and references

The V1 recording establishes the movement/proximity-digging → discovery → spatial cleaning → continued excavation loop. Its six finds, rewards, art, and automatic exit are not added to V2. The V2 recording shows the existing field palette, tool rack, ladder, exit, and small pit; these remain the scene's visual basis. Both recordings were examined as timestamped frames.

The first V2 pit is now 8 × 8. Tile spacing increases from 0.85 to 1.05 world units (about 24%), making the pit 8.4 × 8.4 units. The surrounding ground, existing camera, and travel portal have enough clearance; no museum layout, lighting, movement speed, or cleaning design changed. The safe ladder arrival and fossil-bearing tile follow the new grid dimensions.

## Interaction and depth

- Entering the first site places the player within digging range. Standing near remaining soil starts the shovel automatically. Walking away, leaving the site, opening a panel, or losing page focus cancels the unfinished swing. No tile clicks or additional controls.
- Each layer requires two completed shovel swings. A single transient clock drives the two-handed shovel pose and commits a hit at contact. One-second swings are prototype tuning, replacing eight-second continuous shrinking. A long frame advances at most 0.05 seconds; there is no catch-up or offline digging.
- The first hit lowers the surface by one tenth of that layer's thickness; shovel/clod movement supplies additional feedback. The same material remains. The second hit removes the current layer. A deeper layer uses the next earth material; palette entries cycle only after four depths, so successive depths remain distinct.
- `SITE.grid.levels` configures depth, with site 1 exactly one layer. Cells represent horizontal columns; normalized progress covers `levels × 2` hits. Later plot definitions retain the existing increasing-depth cadence (`1 + floor(completedBefore / 2)`), with 8 × 8 horizontal dimensions. Later sites remain unbuilt purchase placeholders.
- Cleared columns become walkable at the pit floor. Raised columns retain collision after the first hit. The character faces the nearby target and uses the same procedural body and palette with animated arms and a field shovel.
- Uncovering the authored bone opens the existing cleaning panel automatically. All digging stops while any panel is open. Closing cleaning, either early or after collection, resumes proximity digging; an unfinished find retains its manual resume control and exact cleaning mask.
- There is no remote clearing sequence. All remaining tiles require the same two shovel contacts. Completion still requires both the collected find and all soil cleared. Site 2 then shows its existing future-purchase eligibility; site 3 stays locked. The completed pit remains inspectable and its exit remains usable.

## Save schema 3

The localStorage key remains `museum-for-luka-v2`.

```json
{
  "version": 3,
  "room": "excavation",
  "dig": { "courtyard-r7-c3": 0.5 },
  "cleaning": {},
  "collected": []
}
```

The 64 column IDs range from `courtyard-r0-c0` to `courtyard-r7-c7`. Missing progress means zero. At the one-layer first site, new actions save 0.5 after the first hit and 1 after the second. Completed hits checkpoint immediately. An unfinished swing is presentation-only and restarts on resume; completed hits never reset. Legacy fractional work is retained exactly and the next full swing advances to the next hit boundary.

The find is at `courtyard-r6-c3`, immediately beyond the ladder entry column `courtyard-r7-c3`. Cleaning indices, threshold, collection identity, write failure/retry, confirmed reset, protected corrupt saves, and stale-write protection are unchanged.

Old saves are validated against their original IDs and discovery invariants before conversion:

- Schema 1 maps `courtyard-pocket` to the new find tile and opens the approach when work already exists. An already collected schema-1 find retains completed-site status.
- Schema 2 maps its old 6 × 6 grid into rows 2–7 and columns 1–6 of the new grid, preserving each fractional value and anchoring the ladder/find relationship. Exact cleaning masks and collected IDs survive. Previously completed sites remain complete across all 64 columns; partially worked sites gain the surrounding untouched tiles.
- Unknown IDs, versions, invalid coverage, and inconsistent collection remain rejected without overwriting the source. Converted state is written on a normal checkpoint. No V1-game save import is added.

## Changed files

- Content/rules/controller: `src/content/journey.ts`, `src/game/journey.ts`, `src/app/prototype.ts`.
- Presentation: `src/presentation/dig-animation.ts` (new shovel rig), `discovery.ts` (hit/depth geometry and materials), `excavation.ts` (depth-aware wall bands), `world.ts` (rig integration). Museum construction is unchanged.
- Persistence/UI: `src/persistence/save.ts` (schema conversion), `src/ui/journey.ts` (remove obsolete automatic-clearing message). Cleaning behavior/canvas is unchanged.
- Verification: `tests/grid.test.ts`, `tests/journey.test.ts`, `tests/navigation.test.ts`, `scripts/check-digging.mjs`, `scripts/check-journey.mjs`, `scripts/check-browser.mjs`.
- Documentation: this contract, `decisions.md`, historical contract links, and the [QA record](qa/digging-shovel.md).

Only site 1 is playable. Multi-layer logic and rendering are checked with isolated fixtures, not a newly authored second site. Luka's hands-on review is still needed for shovel cadence, readability, and play feel.
