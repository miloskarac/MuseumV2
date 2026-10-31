# V2 architecture proposal

Status: proposal for review, 2026-10-04. No implementation is authorized by this document alone, and no open product choice is promoted to a confirmed decision. Prepared with the read-only museum architect review.

**Current-status note — 2026-10-26:** this document preserves the original design proposal and its historical starter-state assessment. The game has three exhibits, two sites and schema-19 normal/QA saves. Phase 6.1–6.7 economy, purchases, map, visitors, helpers, storage and permanent upgrades are implemented; 159 unit tests and the production build pass. Both development QA slots retain independent saves and locks. [Upgrade QA](qa/upgrades.md) records the current flow. Rules, simulation, presentation and UI remain separate modules. Canonical custody records each helper find once as delivery or original-site storage; cleaned collection atomically removes custody and adds the bag entitlement. Travel/reassignment/shutdown settle delivery, and loading safely normalizes unfinished delivery before play. Helper final clears, soil rewards and custody commit together. Schema 19 adds bounded paid upgrade receipts and validates their expenditure through frozen schema-18 validation, with no gameplay refund. Effective stats derive from ownership; helper tasks retain baseline work units and percentages. No actor positions or offline timestamps are saved. Use the [Phase 6 plan](phase6-plan.md) and [roadmap](roadmap.md) for current scope. Phase 5 human acceptance remains open; visitor upgrades and further content require separate scope.
## Basis and current state

This proposal follows [AGENTS.md](../AGENTS.md), the [game vision](game-vision.md), the [decision log](decisions.md), and the [V1 handoff](v1-handoff.md). [digging-master-reference.png](references/museum/digging-master-reference.png) is the primary rendering-style reference for bright, stylized low-poly 3D. The [V1 appearance baseline](references/museum/museum-layout.png) is the starting point for visual improvement; [target-state.png](references/museum/target-state.png) is a secondary concept reference for a bright, welcoming museum and exhibit details, not a requirement to adopt its hand-illustrated rendering. The latest explicit decision from Miloš takes precedence. V1 is behavioral history, not an implementation template.

At review time, V2 contains the TypeScript/Vite starter page and counter. Neither `@babylonjs/core` nor `@babylonjs/loaders` is declared in `package.json`, recorded in `package-lock.json`, or present in the local `node_modules`; Babylon.js has not yet been installed or integrated into the app. The existing scripts are `dev`, `build`, and `preview`; there is no test script or game test suite. This is a proposed architecture to grow into, not a description of completed systems. Implementation order and acceptance gates are in [roadmap.md](roadmap.md).

## Requirements and proposed carryover

| Area | Treatment in V2 |
| --- | --- |
| Platform and audience | Confirmed: Babylon.js, TypeScript, Vite; local browser; Luka, age six; Serbian Cyrillic player-facing text. |
| Discovery loop | Preserve exploration, excavation, cleaning, collection, assembly where appropriate, display, short educational cards, and a clear next goal. |
| Forgiveness and progress | Preserve interrupted digging progress, remembered cleaned areas, no fossil damage, assembly without penalties, forgiving snapping, and a click-based alternative to dragging. |
| Museum feedback | Preserve immediate visibility of placed parts and a clear completed-exhibit card. Do not attach unapproved monetary effects to placement. |
| Movement | Retain the documented V1 default: fixed-angle orthographic view, screen-relative arrows and physical WASD keys, including a Cyrillic keyboard layout. Tune follow, speed, and collision for V2 readability. |
| Site completion | Retain the rule that all required discoveries must be recovered and cleaned. Museum placement is a separate milestone. Preserve clear transitions and completion feedback. |
| First theme | Confirmed: prehistoric life before dinosaurs. Exact species, exhibit count, and later museum sequence remain open. |
| Guidance and information reveal | Carry forward the V1 defaults: short first-use guidance, names/stories revealed at exhibit completion, and tutorial arrows disappearing permanently after the first displayed discovery. Preserve this cutoff unless Miloš explicitly approves a change. |
| Inventory and markers | Carry forward the V1 defaults: unlimited bag; blue for incomplete and green for completed displays; yellow for purchases only if purchases return. Proposed readability enhancement: pair color with shape/icon feedback. |
| Economy and visitors | Deferred product choice. Do not carry over prices, starting cash, reward amounts, spawn timings, limits, or ticket increases as requirements. |
| Persistence | Confirmed direction: a small, explicit, versioned V2 contract; no V1 import by default. Recovery, reset UX, and exact checkpoint behavior below are proposals. |

## What should be redesigned

- Replace V1's mixed scene/UI/progression coordination with explicit ownership boundaries. Keep startup small and put each rule in one place.
- Replace species-specific progression branches and fixed site/exhibit totals with definitions linked by stable IDs.
- Improve the V1 appearance shown in `museum-layout.png` toward the bright, stylized low-poly 3D rendering of `digging-master-reference.png`, using `target-state.png` for secondary museum and exhibit concepts. Do not transplant V1 procedural geometry wholesale or commit to an asset pipeline before testing a representative fossil.
- Replace the inherited save history and visitor snapshots with a minimal V2 snapshot. Add compatibility work only for changes to saves actually shipped in V2.
- Establish one source for balance/content values, with the decision log recording approval. Keep historical values in the handoff rather than scattering them into current requirements.
- Separate educational text and research notes from mechanics. Scientific claims need review before shipping; this proposal does not select species or invent facts.

## Proposed system boundaries

Use ordinary TypeScript modules and explicit function calls. Start with one file per responsibility and split as real complexity appears; no ECS, generic event bus, plugin framework, UI framework, backend, or physics dependency is required by this proposal.

| Suggested location | Responsibility | Boundary |
| --- | --- | --- |
| `src/main.ts` | Create the app and mount it. | No specimen rules, balancing, or scene construction. |
| `src/app/` | Own current session, active activity, room changes, pause/resume, command dispatch, and save scheduling. | Coordinates rules, views, and storage without becoming their implementation. |
| `src/game/` | Typed state and transitions for digging, cleaning, collection, placement, and derived progression. | No Babylon, DOM, or browser storage imports. |
| `src/content/` | Specimens, parts/anatomy groups, discoveries, exhibits, sites, explicit prerequisites, and content validation. | Immutable definitions; IDs and semantic data, not live meshes. |
| `src/content/text/` | Serbian Cyrillic UI strings, descriptions, facts, and author-only source notes. | Text keys connect content and UI; no mechanics embedded in prose. |
| `src/presentation/` | Babylon engine/scene lifecycle, camera, player, room/site builders, exhibit visuals, materials, and effects. | Render state and report interaction candidates; cannot grant progress or rewards. |
| `src/input/` | Translate keyboard/pointer events into movement and activity intents. | Interaction rules remain in the game/app layers. |
| `src/ui/` | HTML/CSS HUD, activity panels, progress feedback, and story cards. | Render view data and issue commands; cannot mutate saved state directly. |
| `src/persistence/` | Serialize, validate, load, and write the V2 save; restore safe checkpoints. | Storage mechanics are separate from game transitions. |

Dependency direction: app composes everything; game rules consume typed content and state; presentation and UI consume read-only state/view data; persistence exchanges plain serializable state with the app. Content and rules do not depend on presentation.

### One authoritative transition path

1. Input or an activity panel submits an intent, such as digging a cell, brushing an area, or placing a collected part.
2. The game transition validates location/activity eligibility and prerequisites, then updates authoritative state.
3. Selectors derive inventory, available interactions, exhibit completion, site exhaustion, and the next goal.
4. The app updates scene/UI views and schedules persistence. One-time sounds and celebrations follow a newly accepted transition, not a render or load event.

Repeated placement or collection attempts must be harmless. Dragging and click-then-click placement use the same validation path. A mesh disappearing, an animation finishing, or a modal closing must never be the only record that a discovery was earned.

### Movement and activity ownership

Use a small exclusive activity state: exploration, cleaning, assembly, story, or transition. Walking is active only during exploration. Clear held inputs on blur, activity entry, and room changes so closing a panel cannot cause unintended movement. Pause world simulation while hidden or inside blocking activities; avoid elapsed-time catch-up on return.

Separate walkable areas, collision footprints, interaction radii, and decorative geometry. Use forgiving interaction ranges and simple movement collision first. A visible marker should match the usable interaction region. Room changes have explicit arrival anchors outside the departure trigger to prevent immediate bounce-back.

Create/dispose scene-owned observers, controls, meshes, and activity resources predictably. Start with one active room scene, reusing shared materials and asset definitions; preserving inactive scenes is unnecessary until measurement shows a need.

## Data-driven exhibits and sites

The common unit is a stable content ID, independent of translated names, array positions, mesh names, or save version. Keep distinct concepts where their responsibilities differ:

| Definition | Minimum responsibility |
| --- | --- |
| Specimen | Identity, text keys, part set, display mode (`assembled` or `whole`), and visual recipe reference. |
| Anatomy group / part | A collectable and placeable unit with a stable ID, specimen relationship, and visual/assembly anchor reference. A group can represent several bones. |
| Discovery | One recoverable find; identifies the part it supplies and its cleaning template. |
| Exhibit | A museum display instance referencing a specimen, its required parts, a room placement anchor, and any explicitly approved prerequisites. |
| Site | Excavation layout, stable cell IDs, discovery placements, required discovery IDs, entry/exit anchors, and any approved prerequisites. |
| Presentation recipe | Asset or procedural builder reference, scales, part meshes, assembly anchors, display footprint, and camera framing. Lives outside mechanics. |
| Educational entry | Short Cyrillic description and fact, plus author-only sources/review status. |

**Assumption for the first slice:** each part has one discovery and one target exhibit. Each discovery belongs to one site. Do not implement duplicate specimens, trading, random loot, or a general item system without a requirement.

An assembled specimen uses several anatomy groups; its display shows only placed groups. A whole fossil uses one part and direct slab placement, bypassing an unnecessary assembly activity. Both use the same collection, placement, completion, and card rules. Implement the second mode when it enters the roadmap, rather than adding unused machinery up front.

A new exhibit should require content definitions, reviewed text, an art recipe/asset, and authored room/site placements. It should not require editing collection logic, save serialization, or a chain of species-name conditions. New anatomical shapes can require new presentation builders; data-driven does not mean every animal must reuse identical geometry.

Validate duplicate IDs, missing references, discovery/part ownership, unfindable required parts, missing anchors/text, and prerequisite cycles. Use explicit prerequisite ID lists when needed, not arbitrary embedded scripts. Add only the prerequisite types the approved progression uses.

### Progression invariants

- Digging progress is monotonic and bounded; leaving a cell does not reset it.
- Brushing records newly cleaned eligible areas. Repeated strokes over an already clean area add nothing; off-fossil strokes cause no damage.
- A discovery becomes collected exactly once when cleaning completes.
- A part can be placed only after collection, and can be placed only once.
- Bag contents are collected parts minus placed parts.
- Exhibit completion is derived from its required placed parts.
- Site exhaustion is derived from all its required discoveries being collected after cleaning, independent of remaining soil and exhibit completion.
- Site exhaustion is committed before its finishing animation. Reload reconstructs a completed site even if the animation was interrupted. Carry forward V1's automatic return and exhausted entrance closure unless Miloš approves a change; validate presentation clarity with Luka.
- Future rewards and purchases must update entitlement and money in the same state transition and saved snapshot. Effects and repeated commands cannot grant a second reward.

## Visual architecture and asset approach

The V1 baseline in `docs/references/museum/museum-layout.png` shows cream tiled floors, teal plinths, dark specimen backing, ivory fossils, brass details, simple rounded people, and an angled view. These describe the starting appearance to improve, rather than the finished V2 target.

Use `docs/references/museum/digging-master-reference.png` as the primary rendering-style reference: bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. Use `docs/references/museum/target-state.png` as a secondary concept reference for a bright, welcoming museum and exhibit details. Translate those details into the primary reference's 3D style; the concept's hand-illustrated rendering is not required. Improve lighting and exhibit presentation while retaining clear silhouettes and routes. Compare prototype screenshots against each image's role: primary rendering style, V1 baseline, and secondary museum concepts. No reference's HUD values, language, depicted species, exhibit count, visitor density, or text sizes override the confirmed product decisions.

Prototype a walkable hall with a representative fossil at actual camera distance. Keep main routes open; decorations, ropes, and plinth edges must not create confusing invisible barriers. Make the player distinct from any future visitors. Small fossils may need a closer activity/card view, but their world displays must still read as interactable objects.

Centralize a small palette/material set, camera framing, and lighting setup. Reuse repeated environment geometry/materials where practical, without premature optimization. Use HTML/CSS for readable text and large buttons rather than placing long instructions on tiny 3D plaques.

Begin with simple local geometry for blockout. Compare one procedural specimen with an authored local asset only if needed to reach the visual target. Decide the pipeline after inspecting silhouette, anatomy-group separation, asset licensing where relevant, runtime cost, and authoring effort. No runtime external asset service is proposed. Do not equate local-first with an unrequested offline installation/PWA feature.

## Minimal save contract

**Proposal:** one local browser save slot using a single serialized snapshot under a V2-specific key. Start the V2 schema at version 1. Storage choice and reset/recovery UX remain decisions to confirm before durable progression ships; localStorage is sufficient as the initial candidate for this small snapshot.

| Persist | Reason |
| --- | --- |
| Schema version | Validate the contract; migrate only when a released V2 format changes. |
| Room ID and safe arrival/checkpoint anchor | Restore a predictable location without exact camera/player transforms. |
| Sparse dig progress by site/cell ID | Preserve partially and fully excavated cells; absent means untouched. |
| Per-discovery cleaning coverage while unfinished | Preserve cleaned regions, using a compact fixed grid/mask with stable indexing. A percentage alone cannot reproduce which areas were cleaned. |
| Collected discovery IDs | Record completed cleaning/recovery once; discard their now-redundant cleaning masks. |
| Placed part IDs by exhibit | Rebuild partial and completed displays. |
| Explicit persistent choices only when introduced | For example, a dismissed hint that cannot be derived from progression. |

Derive inventory, cleaning percentage, uncovered-find visibility, exhibit completion, site exhaustion, and content-based unlocks from definitions and saved facts. Derive permanent tutorial-arrow dismissal after the first displayed discovery from placement while placement remains permanent; arrows must remain dismissed after reload. Do not save definitions, meshes, animations, drag positions, modal state, camera transforms, duplicate completion flags, visitor paths/queues, or an event history.

Freeze shipped content IDs and the meaning of saved dig-cell/cleaning-mask indices. A save schema version does not by itself protect against an edited excavation layout. If released content requires a breaking layout change, add an explicit content revision and deliberate conversion then; do not silently reuse old indices or prebuild a migration framework now.

### Checkpoints, recovery, and reset

- Save accepted progress on a short bounded cadence, or debounce with a maximum wait, and immediately after collection, placement, and room/site transitions. Continuous digging or brushing must not postpone saving indefinitely. Flush pending work when leaving an activity or hiding the page when possible. Exact timing is a prototype setting, not V1's inherited 750 ms requirement.
- Persist durable state before presenting a critical completion as safely saved. Unexpected termination can lose progress since the last successful write; minimize that interval and test it. If a write fails, retain the live state, expose a short Cyrillic save-status message, and allow retry without claiming success.
- On reload, open a safe exploration checkpoint, not a half-drag or modal. Reopening cleaning restores its mask. Already earned collection/placement cannot depend on replaying the activity or celebration.
- A missing save starts a fresh session. Otherwise, parse and validate version, IDs, bounds, mask dimensions, and cross-field invariants before replacing session state. Unknown newer versions, malformed saves, or removed content must not silently become a fresh game and overwrite the original value. Suspend autosave while recovery is pending.
- Propose a simple recovery choice with Miloš before shipping persistence. Preserve the invalid raw value while recovery is pending. Backup slots and JSON export/import are later options, not automatically copied V1 requirements.
- Reset requires a clear confirmation. Cancel leaves progress untouched; confirm clears the V2 slot, pending writes, activities, and current session together. Invalidate callbacks from the old session so stale asynchronous work cannot resurrect progress. Do not clear unrelated browser storage or V1 saves.
- Saves belong to the browser profile and origin. Use a consistent local address for play and a separate QA profile/save for all testing.

If economy returns, extend the snapshot only with owned purchases, partial contributions if retained, wallet balance, earned uncollected cash if retained, and any one-time reward IDs that cannot be derived. Reconstruct decorative visitor activity after reload. Decide paid/unpaid visitor semantics before implementation; do not accidentally erase an earned payment or create income by respawning visitors. No offline income is the proposed V1 default, subject to the economy decision.

## Verification strategy

Introduce focused rule/save tests with the first mechanics. Cover interruption, repeated cleaning strokes, invalid and duplicate placement, derived site/exhibit completion, reload at each durable milestone, failed writes, and reset with pending autosave. Add content-reference validation as a focused automated check.

Use browser checks for movement under Cyrillic input, activity focus, room transitions, and the complete discovery-to-display journey. For scene/control/UI changes, inspect the game manually in a separate QA profile and record browser, viewport, and practical before/after screenshots. Edge is a sensible first test target from V1 history, not an approved exclusive support policy. Luka's play sessions assess clarity and enjoyment.

Run only scripts that exist; add test tooling deliberately when implementation reaches those tests. Run `npm run build` for application changes. This documentation task does not add dependencies, implement systems, or establish a new test result.

## Assumptions and open questions

| Item | Proposed working assumption | Decision needed by |
| --- | --- | --- |
| First playable scope | One hall, one site, one complete discovery-to-display journey; no economy. Matches the decision log's default. | Before committing the slice's content/art workload. |
| Representative specimen | A small number of anatomy groups to exercise partial display; exact species and group count unselected. | Before authored fossil content. |
| Camera and input | Fixed-angle orthographic, desktop keyboard/mouse first, simple forgiving collision. | Validate during movement prototype; touch remains open. |
| Art pipeline | Blockout first; one representative fossil determines procedural versus authored asset needs. | Before producing a collection. |
| Save and recovery | One versioned local snapshot, safe checkpoint resume, confirmed reset, no V1 import. | Before meaningful saved progression ships. |
| Guidance presentation | Exact prompt wording and visual treatment remain open; retain completion-based name/story reveal and permanent arrow dismissal after the first displayed discovery. | Review clarity during the first complete journey playtest; changing the V1 cutoff requires Miloš's approval. |
| Site finish presentation | Animation and transition presentation remain open; retain safe return outside and exhausted entrance closure as V1 defaults. | During excavation UX testing; changing those defaults requires Miloš's approval. |
| Economy and visitors | Defer; no prices/rewards/limits selected. | Only if a management phase is commissioned. |
| Collection scope and later museums | No fixed total or release sequence. | Before each content expansion. |
| Target hardware and viewport | Measure the intended play machine and window; do not invent a performance budget. | During the first visual prototype. |

These uncertainties do not block the architecture proposal. Record explicit resolutions in [decisions.md](decisions.md) before implementing dependent behavior. Helpers, restoration, diamonds, narration, a journal, touch support, and a 40–60 exhibit target remain uncommitted ideas.
