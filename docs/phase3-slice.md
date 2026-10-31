# Phase 3 discovery-to-display slice — 2026-10-08

**Historical implementation record:** the later explicit Dimetrodon decision supersedes this document's two-group/Eryops content and schema-6 contract. See [current six-find rules and schema 7](dimetrodon-collection.md). Previous QA evidence below describes the earlier build.

Implementation is playable. Scientific review and Luka's comprehension/enjoyment acceptance remain open; neither is established by automated tests. See [QA evidence](qa/phase3.md).

## Bounded content decision

Miloš authorized the implementer to choose the smallest anatomy-group count that demonstrates partial assembly. **Exactly two groups** were chosen: **head** (`head`, discovery `bone-study-head`) and **body/legs** (`body`, discovery `bone-study-01`). Body includes spine, ribs, four limbs and tail. One group cannot demonstrate partial completion; two gives empty → partial → complete with only two cleaning activities. This is a coarse teaching/interaction grouping, not a claim that an animal has only two anatomical parts.

The existing unnamed quadruped study is reused as a **stylized Eryops study**, with a broader, flatter head. Eryops is an implementation content assumption for this representative specimen, not Miloš's separate approval of a species roster or scientific fidelity. No additional specimen, exhibit, museum or playable site was added. Its name and story remain hidden until both groups are placed. Group names are visible during cleaning and assembly.

The original find remains at `courtyard-r6-c3`; the head is at `courtyard-r5-c3`, directly farther into the same first pit. The existing 8×8 grid, shovel timing, two-hit rule, cleaning mask/threshold, explicit bag action, cleanup timing and exit route remain. The old second/third outdoor markers remain, but say they are unavailable in this adventure, without suggesting a playable purchase.

## Rules and presentation

- Each find owns its uncovered state and cleaning mask. Both must be explicitly bagged before exhaustion. One collected find cannot start cleanup.
- Inventory is collected discoveries minus their placed groups. Exhibit completion requires both placements. Neither is a second saved counter/flag.
- The large blue exhibit-plaque button opens assembly from the museum. Matching silhouettes and labels support click-then-click or pointer dragging. Drops within 28 CSS pixels of the nearest target edge snap; the same `placeGroup` rule validates ownership, identity, room and uniqueness. Misses consume nothing.
- Accepted placement immediately reveals that group's 3D meshes. The completed plaque turns green and reveals the name. Final placement opens the card; reopening the plaque reads the same card without granting anything.
- Guidance and 3D travel arrows disappear after the **first accepted displayed group**, derived from nonempty `placed`. Travel rings, destination labels and ordinary movement-key instructions remain. Reload and room changes preserve the cutoff. Reset starts a new playthrough.
- The card states this small adventure is finished and invites a museum walk/viewing the exhibit. No reward, currency or new unlock entitlement is introduced.

## Current save contract: schema 6

The existing key `museum-for-luka-v2` and single local snapshot remain. Fields: `version`, `room`, sparse normalized `dig`, per-discovery `cleaning`, unique `collected`, `closedSites`, and new unique `placed` group IDs. Inventory, exhibit-complete, tutorial-dismissed, modal and animation state are derived/transient.

Collection and placement synchronously flush the complete snapshot. Exhaustion is the durable fact that every required discovery is collected, with its tile uncovered and no unfinished mask. The final collected snapshot precedes cleanup; storage failure retains live progress, exposes retry, and pauses cleanup/exit until a write succeeds. Accepted placement likewise retains its live display on write failure and exposes retry inside assembly/card. A failed write is never reported as saved; closing the browser before successful retry can only restore the last successful snapshot.

Site exhaustion remains separate from entrance closure: sequential cleanup and automatic return precede `closedSites`. Each removed tile and closure are checkpointed. Interrupted animation resumes from accepted facts and never recollects a find. Museum placement is not required for site cleanup/closure.

Validation rejects missing/unknown/duplicate group IDs, placement without collection, unknown discoveries, invalid masks, collection before uncovering, and closure before both finds and all tiles are complete. Existing invalid-save protection, recovery, storage retry and confirmed reset remain.

### Compatibility choice

V2 schemas 1–5 are validated against their previous single-find rules before conversion. **A previously collected single bone study becomes both collected groups, with no groups placed.** This preserves the old whole-find entitlement and keeps exhausted sites closed; it is a deliberate compatibility grant, not a new-play reward or a second collection event. Partial digging/masks remain exact, and an uncollected legacy save receives no collected group. The new find may already be uncovered where an older save cleared that tile; it can then be cleaned normally. No V1-game import is added.

## Educational draft and review status

Status: **source-checked draft; requires scientific review**. No established expert review source/workflow was found in the repository. No expert reviewed this text/model during this task. `educationReview.status` records that explicitly. Author notes stay out of Luka's play flow.

Player text:

> Ериопс је био древни водоземац. Живео је пре диносауруса.
>
> И жабе су водоземци! Ериопс је имао четири ноге и реп.

Source checks on 2026-10-08:

- [Smithsonian specimen USNM V6721](https://collections.si.edu/search/detail/edanmdm%3Anmnhpaleobiology_3342113): Eryops identification, Amphibia classification and Early Permian age.
- [Smithsonian Deep Time factsheet](https://www.si.edu/newsdesk/factsheets/david-h-koch-hall-fossils-deep-time): Eryops in the Permian section, preceding early dinosaurs. The child's chronological sentence synthesizes those dates.
- [Harvard body-size reconstruction thesis](https://dash.harvard.edu/bitstream/handle/1/37370064/Cavanaugh_Revised_Final.pdf?sequence=1), table 6: Eryops skeleton model lists right/left forelimbs, right/left hindlimbs and tail.
- [AMNH Amphibian Species of the World](https://amphibiansoftheworld.amnh.org/): frog classification within Amphibia. No claim of direct ancestry between Eryops and modern frogs is made.

Before scientific sign-off: review Serbian naming/wording, child suitability, simplified proportions, digit counts and anatomy-group depiction. The inherited procedural model is not a measured scientific reconstruction.

## Files changed

- Content: `src/content/exhibit.ts` (new), `src/content/journey.ts`.
- Rules/coordinator/save: `src/game/assembly.ts` (new), `src/game/journey.ts`, `src/app/prototype.ts`, `src/persistence/save.ts`.
- Presentation/UI: `src/presentation/fossil.ts`, `src/presentation/discovery.ts`, `src/presentation/world.ts`, `src/ui/assembly.ts` (new), `src/ui/journey.ts`, `src/style.css`.
- Checks: `tests/assembly.test.ts` (new), `tests/grid.test.ts`, `tests/save.test.ts`, `tests/site-completion.test.ts`; `scripts/check-journey.mjs`, `scripts/check-completion.mjs`, `scripts/check-browser.mjs`.
- Documentation: this contract, `docs/decisions.md`, `docs/roadmap.md`, `docs/qa/phase3.md`, and `docs/qa/phase3-*.png` evidence.

No dependencies or backend were added.
