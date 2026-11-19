# Current state, technical debt and readiness

Source audit, 2026-11-08. “Implemented” is distinct from scientific review, child acceptance or performance certification.

## Capability status

| Status | Systems |
| --- | --- |
| Implemented for current content | Desktop movement; three space types; two pits; retained digging/cleaning; 13 discoveries; two six-group skeletons and one whole slab; paid fixed stands/one wing; inventory/assembly/stories; deterministic soil coins; paid second site/map; visitors/cashier; saved pending revenue/manual collection; partial deposits; one helper/storage; three permanent upgrades; schema-21 save/recovery/reset/exclusive writer |
| Partial/generalization needed | Content-driven logic exists, but stand layouts, slab UI, story previews, site access and ledger validation assume the current collection; responsive UI and touch interactions exist without touch movement; helper cap mentions two but only one helper is supported |
| Missing for expansion | Three-room model/ownership/doorways, all-previous-room gate, locked-room preview/dimming, fourteen new exhibits and their assets/sites, generalized whole-fossil renderer, admission ledger beyond three displays, room completion effects/featured-exhibit metadata |
| Unverified acceptance | Scientific/content review, chosen taxa/art suitability for a strictly Permian collection, Luka's independent comprehension/enjoyment, phone playability and target-device performance; no current browser session was run in this audit |

## Prioritized risks

| Priority | Verified limitation / inferred expansion risk | Consequence and recommendation |
| --- | --- | --- |
| Blocker before fourth display | `visitors.sales` has three price bins; payment writes `price-2`; parser only permits 0/2/3/4 paid values | Fourth display derives price 5 but cannot record a valid sale. Version/generalize the ledger before more content. |
| High | Historical parsers import live offers/sites/parts and current prices | Adding offers can invalidate old legacy receipts or accidentally grant all new stands; content edits can contradict closed sites, exposure and reward manifests. Freeze historic definitions and migrate deliberately. |
| High | Current wing gate is any one display; Eryops is hard-coded to the wing | The intended Room 1 now includes Eryops, so mapping the old wing to a new room without redesign risks circular gates or misplaced entitlement. Decide migration policy explicitly. |
| High | `parseTravelSave` accepts only one paid site, specifically Eryops | New site rows alone will not produce loadable saved progression. Update ownership validation and predecessor handling. |
| High | One rectangular floor, fixed slot coordinates, visitor grid Z −5..5 | Three rooms need real topology/barriers and generalized path sampling. Unreachable stops are skipped, potentially hiding bad layouts unless tests assert all required targets are reachable. |
| Medium | Whole-fossil UI and display hard-code `SLAB_PART`/trilobite; skeleton map has two recipes | Additional plants, teeth and small fossils may show wrong art or fail missing lookups. Add presentation metadata per exhibit/part. |
| Medium | `advanceMuseum` explicitly reconstructs schema layers and full saves are repeatedly projected | A new field can disappear during unrelated digging, travel or helper transitions. Test preservation across every mutation path. |
| Medium | Runtime coordinator and world builder carry many responsibilities | New room rules added inline would increase branching; isolate room definitions/queries without a broad framework rewrite. |
| Medium | Lifetime sales validation assumes current display count never decreases | Future removal/relocation or migration that temporarily reduces available displays can invalidate past higher-price receipts. Current game has no removal, so this is a future integration risk. |
| Medium | Complete-hall orthographic fit, DOM labels and second preview engine | Three rooms may become unreadably small; more content increases rendering/UI work. Decide framing and measure actual hardware before optimization. |
| Low/current limit | Visitors prefer unoccupied viewing spots but do not collide while walking | Temporary overlap is expected. More doors/visitors need congestion tests, not an assumption of crowd simulation. |
| Low/current wording | `ui/journey.ts` selects Eryops-open text from first-site closure, not paid ownership | Goal wording can get ahead of actual map access; generalize hints when adding room/site progression. |

The first row is an expansion blocker demonstrated by source arithmetic, not a failing path in the currently supported three-exhibit game. No new high-severity current-game defect was observed in the executed test/build checks.

## Performance and maintainability

Fresh build passes with a 1,208.06 kB main minified chunk warning. No runtime performance measurements were taken. The scene creates many procedural meshes (including one mesh per floor tile and soil layer), and layout changes rebuild the current scene. Visitor path searches create sampled grids per route; helper routes use sampled pair connectivity. Whole-save localStorage writes and layered parsing grow with manifests/content. These are concrete scaling surfaces, not proof of present slowdown.

Retained Vite starter files (`src/counter.ts`, starter SVGs) are outside the active `main.ts` path. The declared loaders package has no active source import. Removing these is optional cleanup, not required for the museum expansion and not performed by the audit.

The source already makes good use of stable IDs, pure commands, derived completion, shared visual recipes and explicit transaction boundaries. Preserve those. Scientific metadata has review statuses and attribution; it should remain reviewable as content grows.

## Reuse without changing its behavior

- Keyboard direction/focus handling, basic collision stepping and fixed-camera conventions.
- Soil hit/cleaning/explicit collection rules, inventory derivation, matching-target placement and harmless mistakes.
- Atomic candidate commit/retry, checkpoint writer, session lock, recovery and confirmed reset mechanisms.
- Unique deterministic soil claims, pending-cash transfer and duplicate purchase/visitor protections (adapt schema/definitions where needed).
- Helper original-site custody/manual cleaning, permanent stat derivation and activity pause model.
- Procedural material/shape helpers, existing skeletons, story structure and illustration-credit UI.

Do not interpret “reuse” as zero changes to wrappers or validators: content and room changes still need integration at those boundaries.

## Readiness recommendation

The existing three-exhibit game is a tested foundation for a bounded expansion, but it is not a 17-exhibit-ready engine through configuration alone. First fix the extensibility constraints in ledger/content/save/room definitions; then add one room and one new whole-fossil example with complete lifecycle coverage. Author the remaining content in small batches with visual/scientific review. Keep optional decoration outside exhibit counts and progression predicates.

Priority regression scenarios: legacy wing receipts; mixed old/new ticket prices with pending cash; partial room/stand payments; all prior-room exhibits completed but one undisplayed; new finds in exhausted sites; stored/in-flight finds during migration; reset/reload during final placement/room purchase; every doorway/viewing position; zero-soil-income purchase ordering. Human review remains required even after all automated checks pass.
