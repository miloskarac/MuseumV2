# Museum for Luka — V2 Decisions and Open Questions

Use this log to prevent ideas, assumptions, and current implementation details from being mistaken for approved requirements. New explicit decisions take precedence over older notes. Add dates when choices are made.

## Confirmed decisions

| Topic | Decision |
| --- | --- |
| Audience | The primary player is Luka, age six. |
| Language | Player-facing text is Serbian Cyrillic. |
| Project approach | V2 is a clean project; use V1 as a source of requirements and lessons, not as a codebase to copy wholesale. |
| Engine and language | Keep Babylon.js and TypeScript, with Vite for local development. |
| Visual direction | `docs/references/digging-master-reference.png` is the primary rendering-style reference: bright, stylized low-poly 3D, angled view, readable fossil displays, and simple characters. `docs/references/museum-layout.png` is the current V1 appearance and baseline to improve. `docs/references/target-state.png` is a secondary concept reference for a bright, welcoming museum and exhibit details; its hand-illustrated rendering is not the required 3D style. |
| First museum theme | Start with prehistoric life before the dinosaurs. |
| Future content direction | Dinosaur/fossil and Ice Age content are intended directions; their sequence and scope are not yet locked. |
| Gameplay values | Keep discovery, forgiving excavation/cleaning/assembly, visible progress, and short educational content central. |
| V1 save migration | Do not migrate V1 saves by default. Start V2 with a clean save contract unless the owner later asks for import. |
| Work process | Build small playable increments; Miloš makes product decisions and performs QA; Codex implements and verifies. |
| Phase 6 direction | Approved 2026-10-23: local museum economy, stands/expansions, world map and paid site progression, visitors/tickets, active-site helpers and per-site storage. Subsequent explicit packages authorize 6.1–6.7, now implemented in normal play under schema 19, including permanent boots/shovel/helper tools. Both development QA slots remain independent. Additional visitor improvements and new content require separate scope; Phase 5 acceptance stays open. |

## V1 behavior to consider carrying forward

These are implemented in V1 and are strong candidates, but changing them remains a product decision:

- Screen-relative keyboard movement and a fixed-angle orthographic camera.
- Partial digging progress persists when interrupted.
- Cleaning progress persists and errors cannot damage a fossil.
- Forgiving assembly snapping and a click-based alternative to drag-and-drop.
- Placed bones appear immediately; completed specimens unlock the story card.
- Short tutorial prompts disappear after the first discovery.
- Excavation sites finish only after their required discoveries are recovered and cleaned.
- Purchases, ticket income, visitors, and cash collection form a separate museum-management loop.

## Open questions — decide when needed

| Question | Why it matters | Default until decided |
| --- | --- | --- |
| What is the exact V2 first playable slice? | Determines early code and art scope. | One museum hall, one excavation area, and one complete discovery-to-display journey. |
| How many exhibits belong in the first museum? | Affects content definitions, progression, asset workload, and balance. | Do not hard-code a final total; design data structures to add exhibits without per-exhibit engine changes. |
| What is the sequence and scope of later museums? | Affects progression and future setting/content design. | Keep dinosaur/fossil and Ice Age ideas in the roadmap as uncommitted directions. |
| How closely should V2 preserve the V1 economy? | V1 prices and rewards were tuned for V1's smaller collection. | Do not copy V1 prices or reward amounts without a V2 playtest. |
| How should the Phase 6 cashier, prices and visitor scaling work? | Phase 6 economy/visitors are approved in direction, but the detailed design and all V2 numbers need approval. | Review `phase6-plan.md`; implement only the approved increment. |
| Which character/fossil assets will be hand-built, procedural, or externally created? | Determines art pipeline, visual fidelity, and performance. | Prototype one representative scene and one fossil before choosing a full asset pipeline. |
| Should V2 support tablets/touch? | Changes input, UI sizes, and interaction design. | Keep architecture open to touch, but do not block the first browser prototype on it. |
| Will V2 need V1 save import? | Adds migration complexity and may not benefit a fresh start. | No import unless explicitly requested. |
| What persistence and reset behavior should V2 have? | Prevents accidental loss or duplication of progress. | Define and test a small versioned save contract before adding substantial progression. |

## Historical V1 values — reference only

V1 currently has 16 discoveries across four exhibits, two excavation sites, and a particular set of prices, rewards, visitor limits, and save behavior. Those values document V1; they are not approved V2 requirements. See `v1-handoff.md` for details.

## Decision record

### 2026-10-04 — Distinguish the V1 baseline from the visual target

Historical decision: its rendering-style guidance is superseded by the reference hierarchy recorded below.

Decision: Treat `docs/references/museum-layout.png` as the current V1 appearance and starting point for improvement. Use `docs/references/target-state.png` as the desired warm, cartoonish, detailed, non-pixelated V2 visual direction.
Reason: Miloš explicitly clarified the roles of the two images.
Impacts: Visual guidance and comparison criteria in AGENTS.md, game-vision.md, architecture.md, and roadmap.md. The target filename mismatch is documented in game-vision.md; no assets are renamed by this change.
Supersedes: Earlier wording that identified museum-layout.png or an unspecified museum reference as the desired visual target.

### 2026-10-04 — Clarify the visual reference hierarchy

Decision: Use `docs/references/digging-master-reference.png` as the primary rendering-style reference: bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. Keep `docs/references/museum-layout.png` as the current V1 appearance and baseline. Use `docs/references/target-state.png` as a secondary concept reference for a bright, welcoming museum and exhibit details; its hand-illustrated rendering is not the required 3D style.
Reason: Miloš explicitly clarified the three references' roles and rendering priority.
Impacts: Visual guidance and acceptance criteria in AGENTS.md and the relevant docs. All three reference files are now present at their intended paths. This update changes documentation only.
Supersedes: The rendering-style guidance in the earlier same-day decision above. The V1 baseline role remains unchanged.

### 2026-10-05 — Implement Phase 2 only after visual approval

Decision: Miloš approved the current museum and excavation screenshots and authorized only Phase 2 of `roadmap.md`: one persistent excavation, cleaning, and collection journey. Preserve the approved visual direction and existing navigation; do not begin later phases.
Reason: Explicit visual approval and the subsequent bounded Phase 2 implementation request.
Impacts: One authored unnamed bone study, retained digging and spatial cleaning, collection once, a versioned local save, and tested failure/retry/confirmed-reset behavior. The [Phase 2 save contract](phase2-save-contract.md) records the implementation defaults and recovery behavior; timing, brush size, and threshold remain prototype tuning rather than separately approved product decisions.
Supersedes: Phase 2 was previously a proposed next step. Later phases remain outside the authorized implementation scope.

### 2026-10-05 — Outdoor dig-site and grid refinement

Decision: Miloš requested an outdoor landscape with multiple visible sites, ordered progression, a 6 × 6 one-level first pit, automatic opening of cleaning when a fossil is found, and sequential removal of every remaining tile after uncovering the final part. Build only the first site and the minimum structure for future locked sites. Preserve the approved museum and existing cleaning, save/retry, and exactly-once collection behavior.
Reason: Explicit excavation-refinement request with separate dig-site and museum reference folders.
Impacts: A third room (outdoors), tile-based excavation and collisions, data-defined prerequisites/dimension progression, reference-guided cleaning presentation, and schema 2 with explicit conversion from the existing V2 schema 1. Museum geometry and controls remain intact. [Implementation scope](excavation-refinement.md) distinguishes approved requirements from timing/depth defaults and the future-purchase placeholder.
Supersedes: The earlier Phase 2 single soil pocket and direct museum-to-pit transition. This request authorizes the specified clearing/progression behavior only, not other Phase 3 or management features.

### 2026-10-07 — V1-style shovel actions in the V2 pit

Decision: Miloš requested an 8 × 8 first pit with larger tiles, automatic proximity digging, a visible shovel action for each of two hits per tile layer, unchanged material within a layer, and different materials at deeper layers. Site 1 has exactly one layer; later site depths remain configurable. The existing cleaning popup suspends digging and normal digging resumes afterward. Do not bulk-clear remaining tiles or redesign the museum/cleaning systems.
Reason: Explicit gameplay engineering request using `dig-sites/V1 digging logic.mp4` and `dig-sites/V2 current state.mp4` as behavioral references.
Impacts: 1.05-unit tiles (previously 0.85), contact-driven shovel animation, normalized per-column layer progress, V2 save schema 3 with explicit schema-1/2 conversion, and updated navigation/visual QA. [Current digging and save contract](digging-shovel.md) records implementation and tuning.
Supersedes: The October 5 6 × 6 geometry, horizontal size progression, eight-second continuous tile shrinking, and remote post-discovery clearing sequence. Every remaining tile now requires nearby shovel hits. One-second swings are a reversible prototype timing choice, not a V1 measured constant. Existing first-site-only scope, cleaning, exactly-once collection, and future purchase placeholders remain.

### 2026-10-07 — Automatic cleanup, return, and site closure

Decision: After every assigned fossil is recovered and cleaned, automatically finish the cleaning result popup, remove all remaining soil tiles one at a time with visible animation, move the character in front of that site's outdoor entrance, and only then close the site. Closure is persistent, prevents re-entry, and preserves existing next-site eligibility. Normal digging and movement cannot interrupt this sequence.
Reason: Miloš explicitly requested the V1 end-of-site sequence as a separate follow-up to the shovel work.
Impacts: A bounded cleanup/exit controller, pop animation, automatic ladder/entrance/front movement using existing navigation, a closed-site rail and removed entry ring, schema 4 with validated closure flags and V2 schema-1/2/3 upgrades. [Current completion and persistence contract](site-completion.md) records the flow and checks.
Supersedes: The previous same-day requirement to manually dig remaining tiles after collection, leave the cleaning success panel manually, and keep completed pits enterable. The existing 8 × 8 geometry, depth configuration, two-hit shovel loop before recovery, cleaning mechanics, and unrelated museum/site content are unchanged.

### 2026-10-07 — Digging and cleaning polish

Decision: Improve the shovel motion while keeping feet planted; allow brushing throughout the dirt canvas; require the explicit **Стави у торбу** action after cleaning; modestly accelerate sequential cleanup; allow walking over unexcavated soil while preserving pit boundaries.
Reason: Miloš's explicit follow-up polishing request for the existing V2 systems.
Impacts: Bent-arm shovel poses and torso lean, full-tray coverage with readiness derived from the existing mask, schema 5, a guarded bag action, 0.32-second tile pops, surface-relative walking, and ladder entry/exit collision. [Implementation and persistence details](digging-polish.md).
Supersedes: Automatic collection and dismissal of the cleaning popup, the 0.45-second cleanup default, and solid unexcavated-tile obstacles. The existing forgiving cleaning threshold remains tuning; at completion the final specks clear before the bag action is enabled. Museum, site layout, content, and progression remain intact.

### 2026-10-08 — Authorize the first complete discovery-to-display slice

Decision: Miloš requested Phase 3: recover/clean every required find, assemble a growing display with forgiving drag and click placement, reveal the completed specimen's name/story, and end the bounded slice clearly. Preserve the first-displayed-discovery tutorial cutoff and site completion independent of museum placement. Do not add further specimens, sites or simulation systems.
Reason: Explicit Phase 3 implementation request supplied as an attachment.
Impacts: Two anatomy groups, accepted placement persistence (schema 6), derived inventory/completion/tutorial dismissal, and bounded completion/card UI. The user explicitly delegated the minimum anatomy-group count: the implementation chooses **two**, head and body/legs, because this is the minimum that exposes partial assembly. [Content, save compatibility and review contract](phase3-slice.md).
Supersedes: The Phase-2-only implementation boundary for this requested slice. The latest shovel, full-tray brushing, explicit bag action, cleanup/exit timing and closure decisions remain intact.

Implementation assumptions, not separately confirmed owner decisions: identify the reused quadruped study as stylized Eryops pending content/art review; use a 28px forgiving drop margin; convert an older collected single-find entitlement to both groups so a previously exhausted site stays closed. These choices and their rationale are recorded in the contract above. Scientific review is still required.

Observed comprehension issues are recorded separately in [Phase 3 QA](qa/phase3.md). No Luka play session occurred during implementation, and no tutorial-cutoff change was made or approved.

### 2026-10-08 — Dimetrodon requires six finds

Decision: The first specimen is Dimetrodon, with exactly six required groups: skull, spine and sail, ribs, front legs, hind legs and tail. Every find must be recovered and cleaned before collection. Collection, site completion and museum placement remain distinct; exhaustion is saved before animation and does not depend on placement. V1 reference screenshots do not establish existing V2 implementation.
Reason: Miloš's explicit Phase 3 excavation/collection request.
Impacts: Six shared definitions and first-site tiles, schema 7, rule/save regression tests and the existing six-group presentation integration. [Current contract and migration assumptions](dimetrodon-collection.md).
Supersedes: The earlier same-day two-group minimum and Eryops implementation assumption. No additional specimen or broader progression is authorized.

Compatibility assumption: map the previous combined-body progress to its five component groups and head progress to skull, preserving already accepted work and closed legacy sites. Fresh saves require six separate finds. This is documented implementation behavior, not a new owner-approved balance rule or a reward.

### 2026-10-11 — Assemble Dimetrodon against a whole-skeleton guide

Decision: Miloš requested museum assembly guided by the V1 video, with recovered parts placed once into their anatomical positions, a visibly growing skeleton, and persistent partial/completed displays. Preserve excavation, cleaning, movement, museum layout and six-part recovery progression.
Reason: Explicit museum fossil assembly request. The supplied video is present at `docs/references/museum/fossil assembly.mp4`.
Impacts: A close preview reusing the actual museum model, anatomical placement markers, recovered-part thumbnails, brief placement feedback, and a completed-model view on the story card. Existing `placed` state, validation and schema 7 remain. [Behavior, assumptions and QA](qa/museum-assembly.md).
Supersedes: The separate-card assembly presentation. The video's demonstrated ordering is not treated as mandatory; existing any-order placement remains an implementation assumption.

### 2026-10-18 — Replace floating exhibit cards with floor circles

Decision: Remove the floating exhibit card in every assembly state. Use a floor circle like the museum exit: blue for a stand with no placed bones, yellow for partial assembly, green for a complete fossil.
Reason: Miloš's explicit screenshot-based request.
Impacts: Museum presentation and the assembly/story entry point. Color derives from existing placed groups; inventory and saved progression remain unchanged. Walking onto the circle opens assembly or the completed story; closing it requires leaving and re-entering before automatic reopening. Clicking the circle remains available.
Supersedes: The floating plaque/button entry point and historical V1 incomplete-exhibit color guidance.

### 2026-10-18 — Name completed stands and expand the fossil story

Decision: Show the fossil's name on the stand's white plate once assembly is complete. Expand the opened educational card using the supplied V1 screenshot as a reference: a skeleton preview and short explanations about when it lived, its food, appearance and whether it was a dinosaur.
Reason: Miloš's explicit follow-up request and two screenshots.
Impacts: Completion-derived lettering on the physical plate, a slightly wider plate for Cyrillic lettering, and Serbian Cyrillic story content/layout. Preserve the floor-circle entry point, assembly behavior and existing saved progression. Facts are checked against museum sources, with source notes in `docs/qa/exhibit-story.md`.
Supersedes: The blank completed plate and short two-paragraph fossil card.

### 2026-10-18 — Show bone pictures in the bag

Decision: Replace the bag's text-only list with pictures of the owned parts, matching the assembly tray.
Reason: Miloš's explicit request and bag/assembly screenshots.
Impacts: Reuse the assembly illustrations, Serbian names and part numbering in a responsive bag grid. Keep existing inventory rules: only collected parts that have not been placed appear. Tiles are for viewing; assembly still happens at the stand.
Supersedes: The bag's plain bulleted list.

### 2026-10-18 — First whole fossil: trilobite

Decision: Start the proposed Phase 4 whole-fossil increment, using a trilobite on a stone slab. A whole fossil goes directly from the bag onto its stand without an assembly puzzle.
Reason: Miloš asked to start the proposed solution and explicitly selected “Trilobite (recommended)” over Apateon.
Impacts: Add one find, one small museum stand and a short Serbian Cyrillic card. Reuse digging, cleaning, bag pictures, floor-circle interaction and persistence. As the smallest playable acquisition path, make the existing second-site marker enter a separate one-level 8 × 8 pit after the first site closes; there is no purchase or currency. These dimensions and free prerequisite entry are implementation defaults for this increment, not a commitment to later site balance. Preserve all existing Dimetrodon progress. The third site remains unavailable. Existing scientific-review and Luka-playtest gates remain open.
Supersedes: The second marker being reserved for a future purchase in the earlier one-site prototype. Does not authorize visitors, economy or a larger collection.

### 2026-10-18 — Shared pits and explicit placement for small fossils

Decision: Small whole fossils belong in the same dig pit as large specimens. The trilobite shares the first pit with Dimetrodon's six parts. Placing a small fossil should work like placing a large fossil's parts: open the stand, select its recovered picture and click its target or drag it into place.
Reason: Miloš explicitly requested both corrections after reviewing the first trilobite increment.
Impacts: Seven discoveries in one pit; closure requires all seven collected. The slab remains one intact part. Entering its circle opens placement without consuming the bag item. The second pit is no longer playable. Schema 9 preserves recovered/placed fossils and partial cleaning from schema 8; older first pits reopen only if the slab is missing, with existing bone and earth progress retained. See [current behavior and QA](qa/shared-pit-slab.md).
Supersedes: The separate trilobite pit and automatic museum placement from the earlier Phase 4 increment. No new site, economy or collection batch is authorized.

### 2026-10-18 — Eryops, second excavation and larger museum

Decision: Eryops is the next fossil, recovered in another excavation site and displayed on its own stand in an enlarged museum. Use Miloš's `docs/references/museum/Eryops.png` as the skeletal reference.
Reason: Miloš explicitly requested these four additions.
Impacts: Add a distinct low, broad-headed skeleton, its recovered-part pictures and educational card; reuse digging, cleaning, click/drag assembly and saved progress. Extend the museum to fit another large stand with clear routes. Implementation defaults: six groups (skull, spine, ribs, front legs, hind legs, tail), a second 8 × 8 one-level pit opening after first-site closure, and no purchase. These defaults do not establish later content counts or balance. The trilobite stays with Dimetrodon in the first pit.
Supersedes: The second plot being unavailable in the preceding shared-pit increment. No visitors, economy or extra small species are included.

### 2026-10-19 — Fossils span multiple dirt tiles

Decision: Larger finds must lie beneath several dirt tiles: long tails, broad ribs and whole fossils should no longer be squeezed into one tile.
Reason: Miloš explicitly requested size-appropriate excavation footprints.
Impacts: Both current pits use non-overlapping footprints, with intact silhouettes revealed progressively beneath removed soil. Cleaning starts only after every covering tile is cleared. Implementation defaults: four-tile tails, 2 × 2 ribs/limbs/slab, and proportionate skull/spine areas. Preserve the two-hit shovel action, collection, assembly and closure rules. Schema 11 retains old earth work and expands already uncovered finds so existing cleaning and collection never regress. See [behavior, save contract and QA](qa/find-footprints.md).
Supersedes: One dirt tile per discovery and the fixed single-column find layout. Does not add finds, sites, rewards or dependencies.

### 2026-10-19 — Gradually deeper sites and two-layer soil bands

Decision: Each successive excavation site is deeper than its predecessor, and each soil color spans two vertical excavation layers. Keep the first tutorial pit approachable and the sequential completion prerequisite unchanged.
Reason: Miloš explicitly requested data-driven depth progression, matching soil bands and safe saved-progress behavior.
Impacts: The gradual implementation default is one additional layer per site: 1, 2, 3, 4…; the existing 8 × 8 horizontal grid and 0.7-unit layer height remain. The first site's single layer is a truncated first color band. Soil columns and walls share the same band mapping, with ladders reaching the deeper floors. Schema 11 retains normalized excavation percentages and all recovered finds; fully cleared columns stay clear. Only the existing two sites are playable. See [depth progression and QA](qa/depth-progression.md).
Supersedes: Equal depth for the first two sites, depth increasing only every second site, and one color per layer. Does not unlock additional sites or change collection/placement rewards.

### 2026-10-19 — Clear whole layers and share the first pit's camera

Decision: Every tile of the current excavation layer must be cleared before digging any tile in the next layer. The second excavation site must use the same camera angle as the first.
Reason: Miloš explicitly requested both corrections after testing progressive depth.
Impacts: Derive the active layer from the shallowest remaining column across the whole active site. Both proximity selection and shovel actions obey that layer. Retain older uneven excavation saves without erasing deep progress; unfinished upper layers take priority. Use the original fixed camera position and target for every pit. Two-hit layers, paired soil-color bands, sequential site unlocks and automatic completion remain unchanged. See [QA](qa/layer-order.md).
Supersedes: Independent column-by-column descent and the steeper camera introduced for deeper pits.

### 2026-10-19 — Mixed directions for larger buried bones

Decision: Some larger fossil pieces run vertically across the dirt grid, alongside horizontal pieces.
Reason: Miloš requested more variation in the placement of large bones.
Impacts: The first pit's tail occupies one column by four rows, and the second pit's spine occupies one column by three rows. Move the first pit's slab to keep all footprints separate. Covered tile counts stay the same; the existing renderer fits and turns each silhouette to its footprint. Schema 12 validates schema 11 against its original layout, keeps earth progress, and exposes the new footprint of every previously uncovered find. Cleaning, collection, placement and site closure survive migration. See [QA and screenshots](qa/find-orientation.md).
Supersedes: The horizontal layouts for those two pieces. Layer order, depth progression, camera and sequential unlock rules stay as previously decided.

### 2026-10-21 — Bones extend through soil depth

Decision: A larger fossil piece can extend through two or three different vertical dirt layers. This means depth below the surface, not rotation across the pit floor.
Reason: Miloš clarified the meaning of “vertically” and requested reusable logic for future larger fossils.
Impacts: Define each find's optional shallow/deep layer and slope direction in content. Derive its covering dirt cells and rendered elevation from the same placement. Reveal shallow sections as their soil clears; cleaning waits for all occupied depths. Keep whole-layer digging order, the tutorial's single layer, existing camera and unlock rules. Use Eryops's spine as the two-layer example and verify three-layer placement in tests without adding another playable site. Existing tile progress and collected finds remain valid. See [implementation and QA](qa/burial-depth.md).
Supersedes: The preceding interpretation that turning bones across grid rows fulfilled the requested vertical placement.

### 2026-10-21 — Natural two-handed shovel motion

Decision: Correct the digging animation so the shovel stays clear of the head and the hands hold it naturally.
Reason: Miloš supplied `docs/references/dig-sites/digging.mp4`, showing the shovel passing through the head and awkward arm movement.
Impacts: A short forward shovel action, crossbar-centered interpolation, downward elbow bends and terrain-aware grip positioning. Preserve planted feet, digging cadence, hit timing and all progression/save behavior. See [before/after and QA](qa/shovel-pose.md).
Supersedes: The backward-lifting shovel poses from the October 7 polish pass.

### 2026-10-21 — Development game speed selector

Decision: Add ×1, ×2, ×5 and ×10 game speed controls for development and testing.
Reason: Miloš explicitly requested a testing toggle with these four speeds.
Impacts: Show the selector in the Vite development build. Scale movement, digging and automatic cleanup/return using bounded simulation steps. Default to ×1 on reload/reset; keep the setting outside saved game progress. Cleaning and assembly remain pointer-driven. Production builds retain normal speed without the testing control.
Supersedes: Development play previously always ran at normal speed.

### 2026-10-21 — Compare fossils with living-animal illustrations

Decision: Put the completed fossil on the left of its story card and a picture of the living animal on the right, using web-sourced illustrations.
Reason: Miloš marked this layout on the Dimetrodon story screenshot and requested pictures from the web.
Impacts: Use the same responsive comparison for the three current exhibits, with local licensed illustrations, attribution and reconstruction notes. Stack the two views on narrow screens. Preserve assembly, story facts and all saved progression.
Supersedes: The completed story card's full-width fossil-only preview.

### 2026-10-22 — Optional story button on completed exhibit circles

Decision: Stepping onto a completed fossil's circle shows an **О фосилу** button instead of automatically opening its story card.
Reason: Miloš wants to walk past completed exhibits without unwanted windows opening.
Impacts: All three completed exhibits offer an explicit button while the player is on their circle. Leaving hides it; closing the story lets the player reopen it without stepping off. Unfinished exhibits keep automatic assembly, and final placement keeps its existing completion reveal. Direct circle clicks remain an explicit way to open a card. No save or progression changes.
Supersedes: Automatic story opening on entry to completed circles in the October 18 marker decision.

### 2026-10-22 — Open the front of excavation pits

Decision: Remove the highlighted camera-facing pit frame and foreground obstruction so deeper layers and the character remain visible.
Reason: Miloš's screenshot shows the front edge hiding the character as excavation descends.
Impacts: Cut away the front (-Z) wall, coping and ground apron; retain the other three sides, ladder and original camera. Mark exposed soil-layer boundaries with subtle seams, including layers of the same color. Match the outside walking limit to the removed apron so the character cannot walk into empty space; retain the pit barrier and ladder entry. Keep digging progress, depth, collection and saved state unchanged.
Supersedes: Fully enclosed excavation presentation at the near edge.

### 2026-10-22 — Slightly turn the excavation view

Decision: Rotate the excavation view a few degrees in the direction marked by Miloš, making the open front face the viewer more directly.
Reason: Miloš requested an angle adjustment after reviewing the front cutaway.
Impacts: Use an 8° horizontal camera orbit as the initial tuning, shared by both excavation sites. Keep camera height, distance, target and framing unchanged. Match screen-relative keyboard controls to the new view. Museum/outdoor views, pit geometry and saved progress stay unchanged.
Supersedes: The exact original camera azimuth for excavation; all pits still share one angle.

### 2026-10-22 — Remove excavation progress card

Decision: Remove the excavation card showing “Откопано”, its percentage/bar and digging instructions.
Reason: Miloš marked the card as unnecessary.
Impacts: No information card during excavation. Keep cleaning accessible through a standalone “Очисти фосил” / “Настави чишћење” button when a revealed find is available. Preserve outdoor site information, the header and gameplay/save behavior.
Supersedes: The persistent excavation progress/instruction card.

### 2026-10-23 — Authorize Phase 6 direction and a planning-only assessment

Decision: Proceed with Phase 6 museum management following Miloš's supplied specification. The immediate deliverable is a repository-grounded architecture, gameplay and implementation proposal; do not modify gameplay code and stop for approval before Increment 6.1. Keep Phase 5 open until its actual remaining gates pass.

Approved gameplay direction:

- Ticket income increases gradually for each unique fully completed and displayed fossil; incomplete/undisplayed fossils contribute nothing. Some dirt tiles grant small one-time coins. All V2 values remain configurable and require approval; do not inherit V1 numbers.
- Purchases cover museum expansions, stands and excavation sites, then helpers and separately approved upgrades. Validate prerequisites and affordability, keep ownership permanent, prevent duplicates and economic deadlocks.
- A dedicated hub/menu world map shows defined sites and their periods, availability, prices/prerequisites and travel. The first site is free; later unlocks cost money. Preserve independent progress and last valid location, with a safe hub fallback. New site content/periods need separate scope approval.
- Visitors follow readable routes, visit displayed fossils and leave without blocking Luka. Cashier/payment behavior and exact scaling are to be proposed before implementation.
- Helpers are approved for later increments only, after prerequisite systems. They are permanent purchases with configurable limits, less effective than Luka, assigned to one unlocked site, and work only while that site is active. No offline excavation/discovery/resources or elapsed-time catch-up; hidden tabs and blocking states pause work.
- Leaving pauses and preserves unfinished helper tasks; reassignment cancels only unfinished task progress while preserving ownership, future permanent upgrades and committed discoveries. Invalid tasks are cancelled without destroying unrelated entitlements.
- Each site has its own persistent fossil storage box for helper discoveries. Record confirmed discoveries before delivery animation; normal delivery deposits in that site's box for manual collection, not directly in the bag. Leaving/reloading/reassigning during delivery preserves the find in its original site's storage; collection cannot duplicate it.
- Persist money, entitlements, progress, helpers/tasks, confirmed discoveries/storage and necessary visitor/payment data in the existing local architecture. No backend, accounts, multiplayer or cloud saves. Explain client-side durability/integrity limits honestly.

Reason: Miloš explicitly supplied the consolidated Phase 6 requirements and requested planning before implementation.

Impacts: [Phase 6 plan](phase6-plan.md), updated roadmap and current-status note on the historical architecture proposal. Required sequence is 6.1 economy foundation, 6.2 stands/expansion, 6.3 map/sites, 6.4 visitors/tickets, 6.5 helpers, 6.6 storage/persistence, 6.7 separately approved upgrades. The plan's numbers, cashier recommendation, cleanup coin policy, helper cleaning/work semantics, migration entitlements and release grouping are recommendations, not decisions recorded as approved here.

Supersedes: Phase 6 being wholly deferred and helpers being unapproved future ideas. Earlier free site/stand behavior remains the running implementation until approved increments change it. Does not close Phase 5, approve new species/sites, authorize gameplay changes during this assessment, or approve upgrade implementation.

### 2026-10-23 — Approve Increment 6.1 economy foundation

Decision: Implement 6.1 with 20 starting coins, a saved 12.5% chance of one coin per cleared soil cell-layer, and exactly-once settlement during both ordinary excavation and automatic cleanup. Existing V2 saves receive the starting amount once and keep their progress; already-cleared soil earns no retroactive money. Publish economic success only after saving, with gameplay paused for retry after a failed write.
Reason: Miloš explicitly approved the proposed 6.1 defaults and implementation.
Impacts: Money/coin state, versioned local persistence, balance/earnings UI, transaction/session protection and focused unit/browser QA. Existing stands and site access remain free during 6.1. The approved implementation plan is [Phase 6 plan](phase6-plan.md).
Supersedes: The planning-only gate for 6.1. Later increments and their proposed numerical/interaction decisions remain outside this authorization; Phase 5 stays open.

### 2026-10-23 — Approve Increment 6.2 stands and expansion in isolated QA

Decision: Implement fixed-slot stand purchases at 12 coins for Dimetrodon, 8 for the trilobite and 12 for Eryops, plus an 18-coin expansion opening the existing Eryops wing. Assembly remains at owned stands and accepts partial placement. Existing V2 saves retain every current stand and all current space, including empty stands, without payment or refunds. Keep paid progression in a separate QA mode until ticket income is ready.

Reason: Miloš requested 6.2 and explicitly selected the proposed price, fixed-slot, assembly, migration and QA-release package.

Impacts: New games in the purchase preview start with the original 16-unit hall and no stands. Expansion requires a completed first-pit display; Eryops's stand requires the wing and access to site two (currently first-site closure; paid site ownership belongs to 6.3). A schema-14 QA snapshot stores ownership and paid/legacy provenance. Normal 6.1 play retains schema 13 and free stands/site progression. The development preview uses `?purchases=1`, a separate save key and writer lock; production ignores that parameter. See [6.2 QA](qa/purchases.md).

Supersedes: The unapproved status of 6.2 prices, fixed slots, first-hall/wing layout, assembly-at-stand interpretation and grandfathering. Authorizes neither visitors nor a money grant to compensate for missing ticket income. Phase 5 acceptance and later increments remain open.

### 2026-10-24 — Approve Increment 6.3 map, sites and saved travel

Decision: Miloš requested Phase 6.3 after the proposed 24-coin second-site package. The first site remains free. New access to site two requires first-site closure, one completed display and a single 24-coin purchase. Purchasing and travelling are separate actions. Miloš explicitly chose “Preserve already-earned access”: an existing save keeps site two free if first-site closure or legitimate second-site progress already earned access; early saves adopt the purchase rule.

Impacts: The same isolated `?purchases=1` preview now uses schema 15, with site receipts and `hub` / `site-camp` / `site-pit` locations. Schema 14 remains a frozen migration reader. Map access is available in the header and at the world travel sign. Automatic cleanup/exit completes before travel resumes. Invalid location metadata falls back to the museum while invalid economic/progress data remains protected. Closed pits restore to their visitable camps. Normal play remains schema 13 until 6.4 supplies recurring income.

Reversible presentation choices for review: Зелена пољана and Окерни брег, green/ochre campsite palettes and simple vector map pictures. “Перм” reuses the existing large-specimen period text; the camps are gameplay settings, not ancient habitat reconstructions, and no narrower age is asserted for the generic trilobite. The third site is an unavailable placeholder with no selected period. No fossil redistribution or new specimen facts.

Supersedes: The pending 6.3 cost/prerequisite and legacy-access decisions. Visitors, helpers, storage boxes and future site content remain outside this increment. See [6.3 QA](qa/world-map.md).

### 2026-10-24 — Approve Increment 6.4 visitors and attended ticket sales

Decision: Miloš requested 6.4 and explicitly selected the proposed package: standing at the desk serves one visitor per second; payment credits the coin balance immediately after saving. Tickets cost 2/3/4 coins for 1/2/3 unique completed displays. Visitors arrive every 12/10/8 seconds respectively, capped at six total and three unpaid. No visitors arrive before the first completed display. No offline income. Reload retains unpaid visitors and retires paid visitors without repayment. No cash pile or automatic cashier.

Impacts: Implement bounded visit records and a monotonic sequence, derived ticket price, simple nonblocking visitor routes and safe income commits. Keep existing digging rewards and purchase prices. Verify the zero-drop progression route, migrations and browser flows before enabling the combined 6.2–6.4 paid progression in normal play under the existing release gate. Existing saves retain stands/space and already-earned site access. Helpers and storage remain later increments; Phase 5 human acceptance remains open.

Delivery update, 2026-10-26: schema 16 and the combined paid loop are enabled in normal development/production play after 130 tests, the build, visitor/purchase/map/full-journey browser regressions and production migration/isolation checks passed. The development QA flag still selects an independent slot. See [6.4 QA](qa/visitors.md). This fulfills the previously accepted recurring-income prerequisite; it does not close Phase 5 human acceptance.

### 2026-10-26 — Approve Increment 6.5 helpers in isolated QA

Decision: Miloš requested 6.5 and explicitly selected the proposed package: one permanent helper costs 60 coins, requires two completed displays, second-site ownership and unfinished eligible work. The global limit is two, with only the first available until later productive content is approved. A helper contributes half a player hit every 1.5 seconds: six seconds of work per untouched layer, plus walking. Leaving preserves private task progress; reassignment cancels only unfinished work. No offline work.

Impacts: Implement ownership, assignment, reachable tasks, player priority and a visible helper in a separate `?helpers=1` development save. Normal play remains schema 16. In this preview helpers skip clears that would reveal a fossil; Luka retains manual discovery/cleaning. Release helpers only after 6.6 supplies original-site custody, delivery recovery and manual storage collection. No storage, upgrades, free helper migration or new site is authorized in 6.5.

Supersedes: The unapproved 6.5 price, limits, effectiveness and release grouping. The 6.6 cleaning decision and Phase 5 human acceptance remain open.

### 2026-10-26 — Approve Increment 6.6 storage and manual cleaning

Decision: Miloš requested 6.6 and selected the proposed storage flow: a helper's confirmed find belongs to its original site's box, with one slot per finite authored find and no capacity fee. Luka selects a dirty stored find, uses the existing forgiving brushing activity, then explicitly presses Стави у торбу. Interrupted cleaning retains its mask. Leaving, reassigning or reloading during delivery safely deposits the find at its original site.

Impacts: Add canonical discovery custody, visible carrying and site boxes, strict save validation/migration and interruption checks. Preserve manual discovery, prices, helper effectiveness and site completion only after manual cleaning/collection. Fulfill the accepted 6.5–6.6 release gate before enabling helpers in normal play; QA slots remain independent. No upgrades or new sites are included.

Supersedes: The pending 6.6 cleaning/capacity choice and the temporary 6.5 no-exposure boundary once storage is available. Phase 5 human acceptance remains open.

Delivery update, 2026-10-26: schema 18 and the combined helper/storage flow are enabled in normal play after 149 tests, the production build, storage/helper/visitor/map/full-journey browser regressions and production purchase/migration/isolation checks passed. Both development QA slots remain independent. See [6.6 QA](qa/storage.md). This fulfills the accepted storage prerequisite for releasing helpers; it does not approve upgrades or close Phase 5 human acceptance.

### 2026-10-26 — Approve Increment 6.7 permanent upgrades

Decision: Miloš selected the proposed package: one permanent level each of boots (16 coins, +20% player walking), shovel (24 coins, 0.8-second swing with two hits unchanged) and helper tools (30 coins, 4.8 seconds per untouched layer). Player upgrades require one completed display; helper tools require the owned helper; digging upgrades also require useful unfinished work at an owned site. Existing saves receive no free upgrades. Visitor improvements remain deferred. Enable normal play after verification.

Impacts: Implement the [6.7 package](phase6-7-upgrades.md), retaining helper task percentage, original-site custody and existing income/completion rules. Persist unique paid upgrade ownership; migrate without grants. Phase 5 human acceptance remains open.

Supersedes: The pending 6.7 price/effect/prerequisite and release decisions. No additional helper, site or species is authorized.

Delivery update, 2026-10-26: all three upgrades are enabled in normal play under schema 19 after 159 tests, the production build, focused upgrade and production checks, and helper/storage/map/visitor/full-journey browser regressions passed. Existing saves retain progress with no free upgrades. See [6.7 QA and screenshots](qa/upgrades.md). Remaining work is combined human playtesting and Phase 5 readiness; no further content scope is implied.

### 2026-10-30 — Front visitor entrance, reversed cashier and visible ticket money

Decision: Add an entrance on the museum's front edge, with visitors arriving there and waiting in front of the cashier. Move Luka's selling circle to the opposite side of the desk. Show money piling beside the cashier. Miloš explicitly selected a visual pile with ticket payments still credited immediately.

Impacts: Shared doorway/queue/station geometry in both hall sizes, a register facing the selling circle, visitor routing around that circle and a bounded gold-coin display derived from committed lifetime ticket income. The display restores from existing sales counters, stays unchanged on failed payments and clears on reset. It is not money waiting to be collected; spending does not erase the visual history of ticket sales. The pile's visual size caps at 40 coins to preserve readability. No new save fields or migration, prices, service timing, capacity or collection interaction.

Supersedes: The October 24 “no cash pile” presentation choice and the previous rear arrival point. Immediate credit and all payment integrity rules remain in force. See [entrance and cashier QA](qa/visitor-entrance.md).

### 2026-10-30 — Museum plaza, street, bus stop and parking

Decision: Add a plaza and street in front of the museum, with a bus stop and parking.
Reason: Miloš requested this next step after the front visitor entrance.
Impacts: A paved frontage, crossing aligned with the entrance, sheltered bus stop with a stationary bus, three parking spaces with two parked cars, and small planted beds. Match the existing low-poly scene and both hall sizes; reframe the museum camera without changing its angle or screen-relative controls.
Bounded implementation assumption: these are scenery in this pass. Player bounds, visitor spawning/service, travel, income and save schema remain unchanged. No bus schedules, vehicle simulation or new outdoor activities are introduced. See [exterior QA](qa/museum-exterior.md).

Add new entries below in this format:

```text
### YYYY-MM-DD — Short decision title
Decision: What was explicitly chosen.
Reason: Why it was chosen.
Impacts: Systems, docs, or tests affected.
Supersedes: Earlier decision, if any.
```
