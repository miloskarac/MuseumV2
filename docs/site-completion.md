# Automatic site completion — 2026-10-07

Historical implementation record. The subsequent [digging polish](digging-polish.md) replaces automatic cleaning collection/dismissal with **Стави у торбу**, shortens each pop to 0.32 seconds, allows walking on soil, and writes schema 5. Completion still closes only at the front position.

## Behavior

Normal excavation retains the current V2 8 × 8 larger tiles, configurable depth, and two-hit shovel actions. Completion is a separate controller; it does not rewrite digging or brushing.

1. The completion gate derives every unique discovery ID assigned to the site's cells. Each must be uncovered, collected, and have no outstanding cleaning mask. Merely uncovering the last fossil does not start cleanup. V2 currently authors one find; a two-find rule fixture tests the gate without adding content.
2. The completed cleaning card stays visible for 1.2 active seconds, then closes automatically. No new button press is required. Hidden/unfocused pages and unrelated panels pause the sequence. An unfinished cleaning panel remains resumable as before.
3. The first remaining column in stable content order pops up slightly and shrinks away over 0.45 active seconds. Only that column animates. Its progress becomes 1 only at the end; already cleared columns are skipped. The next column starts on the next update. Partly dug or multi-layer columns also finish through one visible pop per remaining horizontal tile. Long frames cannot fast-forward the sequence.
4. During cleanup, keyboard movement, manual travel, and normal shovel actions are suspended. No further discovery or collection action is generated. Bag/reset panels may safely pause the sequence; a confirmed reset discards it.
5. Once no soil remains, the character walks through the empty pit to the existing ladder-side anchor, transitions to the outdoor site entrance, and walks to its front position (`x = -4.5, z = -1.6`). The existing movement speed, walking rig, and room transition systems are reused.
6. Only at the front position is the site's closure flag committed. The entrance ring disappears and a rail matching the existing field palette closes the surveyed plot. Re-entry is disabled. Site 2 gains the same future-purchase eligibility as before; site 3 remains locked. No new rewards, economy, or later playable sites are introduced.

The V1 recording's final seconds were re-inspected. Its automatic return informs this sequence; its exact cleanup timing is partly hidden by cleaning. The 0.45-second pop and 1.2-second success-card hold are reversible V2 presentation defaults, not claimed V1 measurements.

## Persistence: schema 4

The key stays `museum-for-luka-v2`. Existing state fields retain their meaning; schema 4 adds `closedSites: string[]`.

```json
{
  "version": 4,
  "room": "excavation",
  "dig": { "courtyard-r7-c3": 0.5 },
  "cleaning": {},
  "collected": [],
  "closedSites": []
}
```

The example is an unfinished site after one shovel hit. A closed save contains `"closedSites": ["courtyard-dig"]`, the collected find, and all 64 columns at 1. Validation rejects premature closure, duplicate/unknown closure IDs, invalid discovery state, and unsupported versions without overwriting the source.

- Each finished tile removal checkpoints immediately. The closure and outdoor room transition also checkpoint immediately using the existing writer/failure/retry behavior.
- Cleanup phase is derived from recovered fossils plus remaining tiles. An empty, recovered, unclosed pit goes directly to the exit walk. Outdoor empty/recovered/unclosed state resumes the walk from the entrance to the front. No animation timer or character coordinates are serialized.
- Reload keeps every completed removal; an interrupted pop restarts for its still-present tile. Reload during the exit walk uses a safe ladder or outdoor-entrance anchor and finishes automatically. A closed excavation-room save is redirected safely outdoors, never reopened.
- Previously valid schema-1/2 conversions still preserve exact fractional dig work and cleaning masks. Schema 3 gains closure flags. Already completed old saves retain completion/unlock status; partially recovered old saves resume the new sequence upon returning to the pit. Completed finds are never awarded again.
- Closure is idempotent and separate from an empty pit, so unlocking cannot happen before arrival. Failed writes retain the latest pending state and expose the existing retry controls; no false durability claim is made.

## Changed files

- `src/game/site-completion.ts`: cleanup/exit state transitions and automatic movement.
- `src/game/journey.ts`: all-assigned-fossils gate, normal digging exclusion, durable closure semantics.
- `src/app/prototype.ts`: automatic cleaning-card dismissal, exclusive completion updates, safe restore and entry gating.
- `src/content/journey.ts`: timings, front position, Serbian completion text.
- `src/persistence/save.ts`: schema 4 validation and upgrades.
- `src/presentation/discovery.ts`: per-tile pop presentation; `outdoors.ts`: closure rail/ring; `world.ts`: state/animation wiring.
- `src/ui/journey.ts`: cleanup/exit/closed status messages.
- `tests/site-completion.test.ts`, `tests/grid.test.ts`: completion, migration, duplicate/pause and gate coverage.
- `scripts/check-completion.mjs`, `scripts/check-journey.mjs`: focused completion/browser edge cases and real-input journey.
- Documentation: decision log, this contract, superseded-contract links, and [QA record](qa/site-completion.md).

Remaining scope: only the existing first site is playable. Luka's hands-on review should judge the cleanup pace and clarity of the automatic return. Existing museum content, manual movement rules outside completion, and fossil-brushing mechanics are unchanged.
