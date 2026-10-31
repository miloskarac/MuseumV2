# V2 phased roadmap proposal

Status: phased delivery roadmap, updated 2026-10-26. Original sequence proposed 2026-10-04; later explicit decisions authorize bounded increments. Phase 6's gameplay direction and bounded Increments 6.1–6.4 are approved and implemented in normal play, with an independent development QA slot. Increments 6.5 and 6.6 now enable helpers, original-site storage and manual cleaning/collection in normal play. The approved 6.7 package adds permanent boots, shovel and helper-tool upgrades. Both development QA slots remain independent. Further content and visitor improvements retain separate decision gates. Phases are delivery gates, not calendar commitments. This document accompanies [architecture.md](architecture.md) and follows the [game vision](game-vision.md), [decision log](decisions.md), and [V1 handoff](v1-handoff.md). [digging-master-reference.png](references/museum/digging-master-reference.png) is the primary rendering-style reference: bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. The [V1 appearance baseline](references/museum/museum-layout.png) is the starting point to improve; [target-state.png](references/museum/target-state.png) is a secondary concept reference for a bright, welcoming museum and exhibit details. Its hand-illustrated rendering is not the required 3D style.

## Starting point and priorities

**Current implementation update — 2026-10-26:** Phases 1–3 and two authorized Phase 4 increments are implemented. The whole trilobite shares the first pit with Dimetrodon's six parts and uses explicit click/drag placement at its stand. Eryops adds six parts in a second excavation, its own stand, and a larger museum. Normal play and both independent development QA slots now use schema **19** for the combined economy/map/visitor/helper/storage/upgrade loop. Subsequent polish includes multi-tile/depth burial, whole-layer excavation, shovel poses, illustrated stories, optional completed-story controls and an open-front, rotated excavation view. See [Eryops scope and QA](qa/eryops.md), [shared-pit contract](qa/shared-pit-slab.md), [burial depth](qa/burial-depth.md) and [latest excavation HUD](qa/excavation-hud.md). Scientific review, Luka's comprehension playtest and acceptance of the Eryops artwork remain open.

The repository contains a playable Babylon.js/TypeScript/Vite game with local persistence and rule/save tests. Configured scripts are `dev`, `build`, `preview` and `test`. The October 26 implementation passes **159 tests** and the production build (existing large-chunk warning). Increment 6.1 adds starting coins, stable soil rewards, save-before-success commits and a balance HUD. Isolated browser checks and screenshots are recorded in [economy QA](qa/economy.md); they do not establish Luka's acceptance. The development-only [6.2 preview](qa/purchases.md) adds paid stands and expansion; [6.3](qa/world-map.md) adds map travel, separate camps and paid site access. [6.4](qa/visitors.md) completes visitors, the attended cashier and recurring ticket income. [6.5](qa/helpers.md) adds the approved 60-coin helper, assignment, reachable slower work and retained tasks initially in a separate schema-17 preview. [6.6](qa/storage.md) supplies canonical custody, carrying, site boxes and manual brushing/collection, enabling the combined flow in normal play under schema 18. [6.7](qa/upgrades.md) adds permanent paid boots, shovel and helper tools under schema 19.

The original one-hall/one-site planning slice has grown through explicit approvals to three exhibits and two playable sites. Phase 5 acceptance remains open. The approved [Phase 6 plan](phase6-plan.md) led to the combined 6.1–6.7 implementation, including helpers, storage/cleaning and the selected permanent upgrades. Additional visitor improvements and new content retain separate decision gates.

Preserve short Serbian Cyrillic text, clear next actions, interrupted digging/cleaning progress, assembly without penalties, partial display, and educational completion cards throughout. Do not import V1 balance, collection totals, saves, or code structure.

## Phase 1 — Walkable visual prototype

**Visual review — complete (2026-10-05):** Miloš approved the current [museum](qa/excavation-match-after.png) and [excavation](qa/excavation-match-excavation.png) screenshots. The visual direction is accepted for this prototype; see the [visual comparison and QA record](qa/excavation-style-match.md). Phase 2 scope and acceptance criteria remain unchanged.

**Player flow:** enter the hall, walk around a representative display, find a marked exit, and return from a simple excavation-area blockout.

**Deliver:**

- Add Babylon.js and replace the starter page with a local playable scene.
- Establish the minimal app/rules/presentation/UI boundaries as needed; do not generate every future module up front.
- Implement fixed-angle framing, screen-relative arrows/physical WASD, simple collision, forgiving interaction markers, and explicit transition anchors.
- Build one representative fossil/display composition in the bright, stylized low-poly 3D style of `digging-master-reference.png`, with an angled view, readable fossils, simple characters, and soft lighting. Treat the cream tiles and teal-and-brass presentation in `museum-layout.png` as the V1 starting point; draw museum atmosphere and exhibit details from `target-state.png` as a secondary concept reference.
- Provide a small Cyrillic HUD and short movement guidance. Keep visitors and money UI out of this slice.

**Exit gate:** the player can navigate and return without getting stuck or bouncing between transitions. Held keys do not survive focus loss. Routes, player, display, and interaction marker are clear at gameplay scale. Record a manual browser/viewport check and screenshots; identify improvements over the V1 baseline in `museum-layout.png`, assess rendering against `digging-master-reference.png`, and assess museum atmosphere and exhibit details against the secondary concept in `target-state.png`. The prototype is not a commitment to final asset fidelity. Run `npm run build`.

**Resolve here:** target play machine/window, camera comfort, representative specimen choice, and whether the visual sample needs authored assets. Asset pipeline selection follows the sample, not a full collection commitment.

## Phase 2 — One persistent excavation and cleaning journey

**Excavation refinement (2026-10-05):** Miloš requested an outdoor landscape with ordered dig sites, a playable 6 × 6 one-level first pit, automatic cleaning on discovery, and visible sequential clearing after the final find is uncovered. This bounded refinement preserves the museum and Phase 2 cleaning/collection/save guarantees. The implementation adds only the first playable site and two future-site markers. Site 2 becomes eligible for a future purchase only after the first pit is cleared and its find collected; no currency, price, payment, or second playable site is introduced. Future dimensions are data: 6 × 6 for the first two sites, then 7 × 7, then 8 × 8 maximum. Depth increases by one level per pair as a documented prototype default; later pits are not built. See [scope and current save contract](excavation-refinement.md).

**Player flow:** travel to a site, begin uncovering a find, walk away and return, brush it clean, and see it enter the collection.

**Deliver:**

- Author one site and discovery using stable IDs and shared content definitions.
- Implement retained digging progress, an uncovered-find interaction, and forgiving cleaning that remembers eligible cleaned areas.
- Separate movement from mouse activities; provide a large, clear exit/resume path.
- Define the small V2 save contract alongside the first meaningful progress. Restore a safe location and resume digging/cleaning from saved state.
- Implement validated loading, failure feedback, and agreed reset/recovery behavior before treating the build as a durable playthrough.
- Add focused rule/persistence tests using deliberately selected test tooling. The current project has no test script; define one when the tests are introduced.

**Exit gate:** interruption and reload preserve saved digging and spatial cleaning progress. Repeated strokes over cleaned areas add nothing; mistakes cannot damage the fossil. A cleaned find enters the bag exactly once. A corrupt/unsupported save is not silently overwritten, failed writes do not claim success, and confirmed reset cannot be undone by an old queued autosave. Check the flow manually in a separate QA profile and run the new relevant tests plus `npm run build`.

**Resolve here:** checkpoint cadence, exact recovery/reset UX, brush scale and completion threshold. Keep these settings distinct from historical V1 values. Do not wait until many exhibits exist to establish persistence.

## Phase 3 — Complete the first discovery-to-display slice

**Current content correction (2026-10-08):** The first specimen is Dimetrodon with exactly six required finds: skull, spine and sail, ribs, front legs, hind legs and tail. Collection requires separate recovery and cleaning of every find. Site exhaustion remains independent of museum placement and is committed before cleanup animation. Schema 7 explicitly converts older coarse-group V2 saves. [Current rules, assumptions and validation](dimetrodon-collection.md).

The earlier two-group Eryops prototype and its 37-test QA report are historical, superseded content: [previous evidence](qa/phase3.md). Existing forgiving placement, save recovery, tutorial cutoff and bounded completion remain; no later-phase content or progression is introduced.

**Open exit gates:** the Serbian educational draft is source-checked and explicitly marked **requires scientific review**, not scientifically reviewed. Luka has not yet demonstrated the journey without adult explanation beyond the initial prompt. His comprehension/enjoyment check and Miloš's content/art acceptance remain required. Miloš separately authorized the bounded Phase 4 increment on 2026-10-18; that authorization does not close these gates.

**Player flow:** recover the representative specimen's required finds, return to the hall, place parts, see the display grow, and receive its short completed-exhibit card.

**Deliver:**

- Use the confirmed first specimen, Dimetrodon, with exactly six required anatomy groups: skull, spine and sail, ribs, front legs, hind legs and tail.
- Implement forgiving drag snapping and click-then-click placement through one rule path.
- Derive inventory and exhibit completion from collection/placement; show placed groups immediately.
- Add a concise, scientifically reviewed Serbian Cyrillic description and interesting fact.
- Complete the site only when every required find has been recovered and cleaned. Commit exhaustion before its animation and restore it correctly after reload.
- Provide clear site completion, return/transition feedback, and a next goal. At the end of this bounded slice, show a clear completion state instead of implying unbuilt content is available.
- Carry forward V1's name/story reveal at exhibit completion and permanent tutorial-arrow dismissal after the first displayed discovery. Review presentation clarity with Miloš and Luka; change the cutoff only if Miloš explicitly approves it.

**Exit gate:** a fresh QA save can complete the entire journey without adult explanation beyond the initial prompt. Wrong placement is harmless, the click alternative works, and closing/reopening an activity preserves progress. Reload during partial assembly or site/exhibit completion cannot lose accepted progress or repeat an entitlement. Tutorial arrows disappear after the first displayed discovery and remain dismissed after reload. Site completion does not require museum placement. Run rule/save tests, a browser journey check, manual visual QA, and `npm run build`.

**Milestone:** first complete playable V2 slice. Review enjoyment and visual direction with Luka before increasing content or simulation scope. Record explicit product decisions and observed comprehension problems separately.

## Phase 4 — Prove content reuse and settle the art pipeline

**First increment — implemented and corrected (2026-10-18):** Miloš selected a trilobite and then requested shared pits and the same placement controls as large specimens. One pit contains six Dimetrodon parts plus the whole slab. Its stand opens a one-part click/drag placement screen, then reveals the name, green circle and educational card on completion. Shared authored facets supply the excavation object, cleaning image, bag thumbnail and slab display. Schema 9 consolidates prior separate-site saves without granting finds or losing collection/placement/cleaning. See [contract, screenshots and checks](qa/shared-pit-slab.md).

**Second increment — Eryops (2026-10-19):** Miloš requested Eryops in another excavation, on its own stand in a larger museum. The second pit opens after the first closes; six separate finds reuse cleaning, pictured inventory and forgiving assembly. A distinct procedural skeleton follows the supplied reference. Schema 10 preserves prior progress and separates the new site's IDs from the retired trilobite pit. See [scope, save contract and QA](qa/eryops.md). Further species and management remain uncommissioned.

**Player flow:** discover another kind of find and display a small whole fossil alongside the assembled specimen.

**Deliver:**

- Add a whole-fossil/slab example to prove the alternate display mode without forcing unnecessary assembly.
- As a separate bounded increment if needed, add another assembled specimen or site to expose duplication in anatomy/layout handling. This is a reuse check, not a confirmed launch collection size.
- Add content validation for references, required parts, anchors, text, and any approved progression prerequisites.
- Refine the shared materials, exhibit footprints, fossil silhouettes, readable small-specimen presentation, and asset loading/disposal conventions to support the primary low-poly 3D style in `digging-master-reference.png`. Use `museum-layout.png` to assess improvement over V1 and `target-state.png` for secondary museum and exhibit concepts.
- Keep mechanics/save format unchanged when adding instances of supported content. Fix demonstrated duplication; do not generalize hypothetical future systems.

**Exit gate:** supported exhibits/sites can be added through content and presentation assets without species-specific branches in game rules. A whole fossil and an assembled specimen both collect, save, display, and complete correctly. Small displays remain readable; added decoration leaves paths open. Previously saved progress still loads after additive content changes. Run focused tests/build and visual/browser checks at the recorded viewport.

**Resolve here:** authoring workflow, scientific text review workflow, asset pipeline, next small content batch, and whether explicit unlocking is needed. Do not choose a final exhibit total implicitly.

## Phase 5 — Stabilize the agreed first museum

**Status — open (2026-10-23):** recent corrections support stabilization, but the remaining scientific/content/art review, Luka playtest and target-machine performance/readiness evidence have not all been recorded. Phase 6 authorization does not close these gates. See [readiness findings and current checks](phase6-plan.md#2-phase-5-readiness-and-baseline-evidence).

**Player flow:** play the agreed collection over several sessions with a clear sense of progress and dependable return visits.

**Deliver:**

- Expand only the approved content batch and progression relationships.
- Test the real collection for unreachable requirements, blocked routes, repetitive activities, and unclear next goals.
- Refine tutorial wording, marker/readability feedback, camera framing, and specimen scale based on Luka's play sessions. Preserve permanent arrow dismissal after the first displayed discovery unless Miloš approves a change.
- Exercise reload, interrupted activities/transitions, resets, hidden tabs, and storage failures across the complete implemented loop.
- Measure performance on the intended machine. Optimize demonstrated scene/asset problems before adding complexity.
- Keep the decision log current; document only released save compatibility obligations. Add a migration only if a shipped V2 change needs one.

**Exit gate:** all approved content is reachable and recoverable, progress survives ordinary session boundaries, and the museum remains clear at its agreed populated scale. Tests/build pass; browser/viewport and practical before/after screenshots accompany visual changes. Miloš's QA and Luka's play feedback determine readiness, rather than automated checks alone.

**Resolve here:** first-museum completion experience and release scope. Export/import or backup recovery may be considered if playtesting reveals a need; they are not inherited requirements.

## Phase 6 — Museum management, excavation sites and helpers

**Status — 6.1–6.7 in normal play (2026-10-26):** Miloš approved the [Phase 6 plan](phase6-plan.md) for the bounded economy foundation: 20 starting coins, a 12.5% chance of one coin per cell-layer, cleanup rewards and non-retroactive old-save migration. See [implementation and QA](qa/economy.md). The subsequent 6.2 package is approved and implemented; see [purchase QA](qa/purchases.md). The 24-coin site price and preservation of already-earned access are approved and implemented in 6.3. The approved 6.4 cashier/ticket package is implemented; see [visitor QA](qa/visitors.md). The approved 6.5 helper and 6.6 storage/cleaning packages are implemented in normal play under schema 18; see [storage QA](qa/storage.md). The approved 6.7 upgrades are implemented under schema 19; see [upgrade QA](qa/upgrades.md). Visitor improvements remain deferred. Backend, accounts, multiplayer and cloud saves remain outside scope.

Confirmed direction includes ticket income from unique fully completed and displayed fossils, occasional one-time soil coins, purchases for stands/space/sites, a world map, permanent site unlocks and safe travel, then permanent helpers working only at their assigned active site. Helpers preserve partial tasks on leaving, cancel unfinished work on reassignment, and preserve confirmed discoveries in original-site storage. Delivery is visual; collection is manual and unique. No offline helper progress. The separately approved 6.7 package supplies one level of player walking, shovel timing and helper work improvements.

| Increment | Scope | Actual status |
| --- | --- | --- |
| 6.1 | Economy state, saved coin outcomes, reward integrity, balance UI and tests | Implemented; 95 unit tests, production build and isolated browser QA pass. Human acceptance remains open. |
| 6.2 | Stand purchases, ownership and incremental museum expansion | Implemented in isolated development QA; 107 unit tests, production build and purchase browser checks pass. Promoted to normal play with 6.4 ticket income. [QA and preview](qa/purchases.md). |
| 6.3 | World map, paid site unlocks, separate locations and saved travel | Implemented in isolated development QA; schema 15, 119 unit tests, production build, map/travel, purchase and ordinary-journey browser checks pass. Promoted to normal play with 6.4 ticket income. [QA and preview](qa/world-map.md). |
| 6.4 | Visitors, cashier, ticket payments and bounded scaling | Implemented in normal play; schema 16, 130 tests, build, visitor/purchase/map/full-journey browser checks and production migration/isolation pass. [QA and play](qa/visitors.md). |
| 6.5 | Basic helper purchases, assignments and slower active-site work | Initially delivered in schema-17 QA; promoted to normal play with 6.6. [Historical QA](qa/helpers.md). |
| 6.6 | Site storage, delivery, manual collection and helper interruption persistence | Implemented in normal play, schema 18; 149 tests, build and Edge interruption/collection checks pass. [QA and play](qa/storage.md). |
| 6.7 | Character/helper upgrades and optional visitor improvements | Approved boots/shovel/helper-tool package implemented in normal play, schema 19; 159 tests, build and focused Edge/production checks pass. Visitor improvements deferred. [QA](qa/upgrades.md). |

**Paid-progression release gate — accepted with 6.2:** develop purchases in bounded QA increments, but activate paid progression in Luka's build only when 6.4 supplies recurring ticket income. This prerequisite is fulfilled by 6.4 as of October 26: the combined paid loop is enabled in normal play. The development QA slot retains its independent save and lock. Miloš accepted the helper release gate with 6.5: keep helpers in separate QA until 6.6 supplies durable custody/storage and manual collection. The helper gate is fulfilled by 6.6: original-site custody, delivery recovery and explicit cleaned collection are implemented and verified. These dependencies do not authorize coding later increments early. Do not introduce rescue grants, temporary free unlocks or automatic helper-to-bag collection to bypass them.

**Exit gate per increment:** no negative balance or duplicated purchase, soil reward, ticket payment or fossil collection under repeated actions/reloads; successful saves preserve entitlements, failed writes report failure; active-site and hidden/blocking pause rules hold; core discovery remains usable. Test the zero-drop income path and existing V2 migrations. Visitors/helpers must remain readable and never block the player. Keep Phase 5 open until its actual human/readiness gates pass. Detailed acceptance criteria, provisional numbers and honest local-storage limitations are in the plan.

## Future directions — no committed order or scope

Dinosaur/fossil and Ice Age content are confirmed directions, with sequence and collection size still open. Reuse the content model and prove one new experience at a time when commissioned.

Touch/tablet controls, restoration, diamonds, narration, a discovery journal, and a 40–60 exhibit ambition remain unapproved proposals. Helpers and the selected upgrades are implemented in Phase 6; further upgrades require their own scope. New prehistoric site content still needs explicit scope approval. Backend/accounts/cloud saves, V1 import, and broader platform support need explicit decisions; do not build scaffolding for them now.

## Delivery discipline and decision gates

- Before each implementation task, state the small player flow, acceptance criteria, and behavior to preserve. Resolve only choices needed for that increment, recording approvals in [decisions.md](decisions.md).
- Keep content/art tasks small enough to inspect in a playable scene. A new visual asset does not pass solely because the build succeeds.
- Run the relevant scripts actually present in `package.json`: `dev`, `build`, `preview`, and `test`. Run `npm run build` whenever application code changes.
- Use a separate QA browser profile/save; record browser and viewport. For control/scene/UI changes, include manual inspection and before/after screenshots when practical.
- Keep unresolved acceptance gates visible and address them in bounded work. Explicit later-phase authorization does not establish acceptance of an earlier phase.
- Report changed files, checks/results, manual QA evidence, and remaining risks. The October 23 economy implementation and QA record do not establish a human playtest.

Dependencies are sequential through the first complete slice: visual navigation → persistent discovery → display/completion. Content reuse and stabilization follow. Phase 6 now has approved product direction and an implementation-approval gate; later museums and additional site content still require their own scope decisions.
