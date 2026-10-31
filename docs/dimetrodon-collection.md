# Dimetrodon excavation and collection — 2026-10-08

This supersedes the two-group Eryops content assumption in [the original Phase 3 implementation](phase3-slice.md). The first and only specimen is now Dimetrodon. V1 screenshots/references describe intended behavior/content, not evidence of V2 implementation.

## Confirmed content

Exactly six required discoveries are defined for the existing first site:

| Anatomy group | Player label | Group ID | Discovery ID | Tile |
| --- | --- | --- | --- | --- |
| Skull | Лобања | `skull` | `bone-study-head` | `courtyard-r5-c3` |
| Spine and sail | Кичма и једро | `spine-sail` | `bone-study-01` | `courtyard-r6-c3` |
| Ribs | Ребра | `ribs` | `dimetrodon-ribs` | `courtyard-r4-c3` |
| Front legs | Предње ноге | `front-legs` | `dimetrodon-front-legs` | `courtyard-r3-c3` |
| Hind legs | Задње ноге | `hind-legs` | `dimetrodon-hind-legs` | `courtyard-r2-c3` |
| Tail | Реп | `tail` | `dimetrodon-tail` | `courtyard-r1-c3` |

The two old discovery IDs/locations deliberately remain stable. The six cells run down the ladder's column within the existing 8×8, one-layer pit. Tile placement is an implementation assumption, not a claim to reproduce a V1 screenshot exactly. Finds may be recovered in any order. No other specimen, playable site, purchase, reward system or progression expansion was added.

## Authoritative rules

- Each find requires its tile to be fully excavated, then its own cleaning mask to be completed, then the existing explicit **Стави у торбу** action. Being uncovered or clean/ready does not count as collected.
- `collected` contains unique discovery IDs. Collection deletes only that discovery's redundant cleaning mask. Duplicate or premature bag actions are harmless.
- `SITE.requiredDiscoveryIds`, derived from the six shared definitions, names every required find. Site exhaustion requires all six collected, no remaining masks for those finds, and an actual excavated tile for each. A missing content placement cannot accidentally satisfy an empty `every()` test in the exhaustion rule.
- Museum placement remains the separate `placed` list. Inventory and exhibit completion are derived. No museum placement is required to exhaust or close the site; placing five groups cannot substitute for the sixth collection.
- The existing app coordinator immediately writes the final collection snapshot **before** advancing the completion animation. On failed writes, live progress stays available for retry and the completion controller remains paused. There is no extra exhaustion boolean to conflict with collection.
- Exhaustion starts the existing sequential soil cleanup and automatic return. `closedSites` records the later entrance closure. Reload resumes unfinished cleanup/exit from accepted tile/collection facts, without recollection or replaying an earned reward. This slice has no monetary rewards.
- Activity close, page hide and collection use the existing save flushing behavior. Reload restores a safe location and reopening cleaning restores coverage; animation clocks, open dialogs and drag state remain transient.

## Schema 7 and compatibility assumption

The same local key (`museum-for-luka-v2`) and fields remain: `version`, `room`, `dig`, `cleaning`, `collected`, `closedSites`, `placed`. Version 7 identifies the six-group content contract and validates collection/placement against it. Schema 6 is first validated against its actual two-group contract. Schemas 1–5 retain their original validation/conversion path before the group split. Invalid saves remain protected.

**Explicit compatibility assumption:** the previous `head` maps to `skull`; the previous combined `body` represented spine, ribs, limbs and tail and maps to the five non-skull groups. Its accepted digging, mask, collection and placement are split consistently across those groups. Existing tile progress is never reduced, masks are copied by value, and closed legacy sites stay closed. Earlier single-find whole-specimen entitlements continue through the same conversion. No completion animation grants these conversions; reloading the resulting schema-7 save is idempotent.

This means an old combined-body save can enter schema 7 with five collected groups. It does **not** mean fresh games can skip finds: new progress requires all six separate excavations, cleaning activities and bag actions. Uncollected legacy cleaning remains uncollected. No V1-game save import was implemented.

## Integration and limits

Existing bag/cleaning labels use the shared six-group content. Existing assembly controls and mesh visibility were adapted to six groups, with a simple sail on the reused procedural skeleton, so collection remains usable in the current display flow. This is compatibility work for the single specimen, not an assembly redesign or a claim of scientific model accuracy. Cleaning still uses the existing forgiving mask/template and stylized find shapes.

The old Eryops text was replaced with a short Dimetrodon draft. The [Harvard Museum of Natural History](https://whatsinaname.hmnh.harvard.edu/dimetrodon) supports the pre-dinosaur chronology and elongated bony sail supports; the [Natural History Museum](https://www.nhm.ac.uk/discover/what-are-dinosaurs.html) also distinguishes Dimetrodon from dinosaurs. `educationReview` remains **requires-scientific-review**. No expert review or child comprehension acceptance is claimed.

## Changed files

- Content/rules/save: `src/content/exhibit.ts`, `src/content/journey.ts`, `src/game/journey.ts`, `src/persistence/save.ts`.
- Existing presentation integration: `src/presentation/fossil.ts`, `src/presentation/discovery.ts`, `src/ui/assembly.ts`, `src/ui/journey.ts`, `src/style.css`.
- Tests: new `tests/dimetrodon.test.ts`; updated `tests/assembly.test.ts`, `tests/grid.test.ts`, `tests/save.test.ts`, `tests/site-completion.test.ts`.
- Browser journey: `scripts/check-journey.mjs` now recovers all six and checks the resulting collection/display path.
- Documentation: this contract, `docs/decisions.md`, `docs/roadmap.md`, and the supersession note in `docs/phase3-slice.md`; screenshots use `docs/qa/dimetrodon-*.png`.

## Validation

- `npm test`: **41/41 pass**. Includes all six approvals/content references; arbitrary recovery order; half-dug, partially brushed and ready-but-uncollected reload; no sixth-find shortcut; unique collection; six-find site completion and interrupted cleanup/exit with zero museum placements; failed write/retry; schema 1–6 compatibility and schema-7 round trips; invalid saves; confirmed reset protection.
- `npm run build`: **pass**. Existing Vite large-chunk advisory remains; no new dependencies.
- `node scripts/check-journey.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5184/`: **pass**. Fresh QA save recovers all six through actual input, reopens third-find cleaning, blocks cleanup on failed sixth collection write, reloads during cleanup, closes outdoors with `placed: []`, returns with six inventory items, and finishes the existing assembly/card flow. Also checks placement retry/reload, reset/recovery, responsive controls and no browser errors. An initial helper waypoint stopped outside the next tile's reach; the test walking target was corrected without changing gameplay range.
- `node scripts/check-completion.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5184/`: **pass** with six-find fixtures. Checks paced sequential tile removal, pause/reload, empty-pit cleaning gate, automatic ladder walk, exit reload and closure only at the outdoor front.

Browser: **Microsoft Edge 154.0.4258.53**, disposable Playwright profile, no access to Luka's save. Automated viewports: 1440×1000, 1280×720, 768×1024 and 390×844. Manual visual inspection was limited to captured browser renders of the bag and completed museum at **1440×1000**, plus assembly at **1280×720**. No hands-on manual session or Luka comprehension playtest was performed.

Evidence: [six-item bag](qa/dimetrodon-bag.png), [sixth cleaned find](qa/dimetrodon-sixth-cleaned.png), [closed site](qa/dimetrodon-closed.png), [six-group controls](qa/dimetrodon-assembly-1280x720.png). Museum comparison at 1440×1000: [previous two-group display](qa/phase3-museum-complete.png) → [Dimetrodon display](qa/dimetrodon-museum-complete.png).

Remaining limitations: stylized model and text still need scientific/content review; child clarity/enjoyment is untested. Six-find rule/save requirements have no known blocked implementation requirement.
