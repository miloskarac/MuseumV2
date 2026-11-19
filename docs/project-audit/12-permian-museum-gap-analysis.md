# Planned Permian museum: gap analysis

Audit date: 2026-11-08. This file treats the user's requested three-room design as **planned scope**, not current behavior. No requirement here was implemented during the audit. Large/small labels below are the requested gameplay categories, not claims about biological size or taxonomy.

## Exhibit-by-exhibit status

| Room | Planned exhibit | Category | Current implementation / missing work |
| --- | --- | --- | --- |
| 1 | Dimetrodon | Large | Existing six-part skeleton, first-site finds, stand and story. Assign to new Room 1 layout. |
| 1 | Eryops | Large | Existing six-part skeleton/second site. Currently needs west wing; move/assign into Room 1 and migrate old entitlement without creating a room-unlock cycle. |
| 1 | Trilobite | Small | Existing one-part slab. Generalize presentation mapping and verify period-specific taxon/text/art. Current illustration is labeled Isotelus. |
| 1 | Walchia | Small | Missing exhibit, finds, profiles/art, site assignment, restoration/placement definition, stand and story. |
| 2 | Moschops | Large | Missing all content; assembled mode can be reused with an authored recipe/anchors/parts. |
| 2 | Estemmenosuchus | Large | Missing all content; same integration needs. |
| 2 | Edaphosaurus | Large | Missing all content; same integration needs; do not substitute Dimetrodon's recipe without authored review. |
| 2 | Arthropleura | Small | Missing all content; choose its restoration representation explicitly. |
| 2 | Glossopteris | Small | Missing all content; a plant slab/profile may reuse whole-fossil flow if approved. |
| 2 | Captorhinus | Small | Missing all content; small category does not itself define one-piece versus multi-piece restoration. |
| 3 | Gorgonops | Large | Missing all content; stable identity must differ from the tooth exhibit. |
| 3 | Scutosaurus | Large | Missing all content; assembled pipeline available. |
| 3 | Inostrancevia | Large | Missing all content; assembled pipeline available. |
| 3 | Helicoprion | Small | Missing all content; define the displayed anatomical object and restoration before authoring. |
| 3 | Gorgonops tooth | Small | Missing distinct exhibit/discovery/part IDs; do not reuse the large Gorgonops part entitlement. |
| 3 | Dicynodon | Small | Missing all content; choose restoration representation. |
| 3 | Permian ammonoid | Small | Missing all content; select supported taxon/art/text and stable IDs. |

Total: **17 requested exhibits (8 large, 9 small); 3 current, 14 missing.** Current discovery count is 13; future discovery count is undecided because new anatomy/restoration parts have not been defined. No external paleontological verification was performed; scientific scope and illustration suitability need review separately from programming.

## Requirement mapping

| Planned requirement | Current status | Reusable behavior | Missing components / affected modules / risks |
| --- | --- | --- | --- |
| Three progressively unlockable interconnected rooms | Missing; one compact/expanded rectangular hall | Purchase receipts, layout derivation, scene builders | Room IDs/definitions, membership, doorway geometry, barriers, ownership and safe spawns. `game/museum-layout.ts`, `navigation.ts`, `presentation/world.ts`, `app/prototype.ts`, persistence. |
| All 17 require excavation, collection/reconstruction and placement | Implemented for three only | `DigSite`, discovery IDs, brushing, inventory, `placeGroup`, completion | Fourteen content packages; site distribution, parts, profiles, skeleton recipes/anchors or whole-fossil renderers; update `content/exhibit.ts`, `journey.ts`, world-map data, presentation and validators. |
| Displayed fossils influence economy through existing mechanics | Implemented at three-display scale | `displayedExhibits`, derived price/arrival tiers, cashier | Extend price ledger and save migration before fourth display. Preserve complete-owned-display counting and capped arrival frequency unless balance is explicitly changed. |
| Optional decoration has zero economy/progression effect | Existing scenery has no such statistic; no decoration customization system | Presentation-only props | Keep decorative props outside `EXHIBITS`, required-part lists and completion gates. If optional placement/purchases are desired, their UI/storage is a separate task. Collision must still leave routes clear. |
| Next room eligible only after every required previous-room exhibit is completed and displayed | Missing; current wing requires any one display | `exhibitComplete`, `standAvailable`, `displayedExhibits` | Data-defined `requiredExhibitIds`/predecessor and an all-members predicate. Purchase and load validation must agree. Room 2 requires all four Room 1 displays; Room 3 requires all six Room 2 displays, with prior room ownership preserved. |
| Room expansion spends available currency | Partial: west wing already costs 18 | `buyPurchase`, saved partial contributions, atomic commit | New room offers/prices/receipts and accounting; decide old-wing mapping. Eligibility is not free ownership. Pending cashier cash must remain unavailable until collected. |
| Future rooms visible, empty and softly dimmed until unlocked | Missing; unowned west area is not built as a preview | Shared room materials/lighting | Render locked geometry separately from traversable bounds/active stands; dim presentation without counting ghost exhibits or exposing purchase controls prematurely. |
| Pedestals purchasable in owned rooms independently of excavation unlocks | Implemented for existing offers, with Eryops wing exception | November 7 rule, contribution/full-payment paths | Replace species-specific wing check with generic room ownership and slot membership. Update `purchases.ts`, UI/layout and `museum-save.ts`/`payment-save.ts`; keep site rules independent. |
| Educational panels interactive after exhibit completion | Existing story modal/nearby about button and completed markers | Story text, illustrations, credit UI and completion-derived access | Content for new exhibits; generic preview mapping. If “panel” means a new physical clickable plaque mesh, that interaction is not currently implemented. |
| Featured exhibit per room | Missing | Existing distinctive skeleton/display builders | Optional metadata and authored visual emphasis; no special economy bonus is implied. |
| Short room-completion animation | Missing | Existing bounded placement/cleanup feedback patterns | Derive completion; decide replay versus one-time durable celebration policy; do not introduce a reward or a new progression condition accidentally. |
| Museum 1 strictly Permian; other periods out of scope | Current map calls both sites Permian, but content is a small general pre-dinosaur collection | Existing three content pipelines | Scientific/content audit and period-consistent names/art. No Devonian/Carboniferous/dinosaur museum implementation is needed for this task. |

## Important integration choices still open

- Exact room geometry, doorway positions and whether the camera shows all rooms simultaneously or follows a selected room.
- Allocation of the 17 exhibits to excavation sites, site counts/prices/depths and access prerequisites. Rooms are not automatically equivalent to excavation sites.
- New stand/room prices and pacing. The current starter-safety argument uses 20 coins and first stands totaling 20; preserve a reachable first completed display under every legal purchase order.
- Anatomy groups and restoration interaction for each new small specimen. Reusing one-part cleaned-slab placement is the smallest compatible option where appropriate, but is a recommendation, not a decision for every small exhibit.
- Treatment of existing purchased or legacy west-wing/stand entitlements, closed pits and old partial deposits when Room 1 changes.
- Featured-exhibit presentation and room-celebration replay behavior. No extra rewards are requested.

These are planning decisions, not blockers to documenting the existing implementation. They were not resolved by changing code.

## Small independent implementation tasks recommended

The sequence below is a recommendation. Each task should preserve a playable three-exhibit baseline and carry focused migration/regression tests.

| Task | Bounded deliverable | Depends on / acceptance focus |
| --- | --- | --- |
| 1. Freeze current compatibility fixtures | Representative schema-21 new/partial/complete/legacy-wing saves, pending cash, deposits, helper delivery and historical price receipts | No new gameplay; preserve IDs, finances and entitlements. |
| 2. Extend admission accounting | Versioned ledger supporting more than three display-derived ticket prices; migration from three counters | Task 1. Fourth display must sell successfully; old income/pending cash cannot duplicate. |
| 3. Define room/content relationships and gates | Three room definitions with required exhibit IDs, predecessor, slot membership, purchase offers and derived eligibility | Approve migration/prices. Tests can exercise rules without finished art. Preserve excavation-independent stand access. |
| 4. Add room state/migration | Current-room ownership/payment fields and explicit schema-21 conversion | Tasks 1 and 3. No lost old wing/deposits or accidental free future rooms. All mutation paths retain state. |
| 5. Build rooms and navigation | Authored three-room shell, empty dimmed locked rooms, door barriers, safe bounds/spawns and camera framing | Tasks 3–4. Player/cashier/visitors can reach every required unlocked marker; locked rooms remain inaccessible. |
| 6. Generalize whole-exhibit presentation | Per-exhibit slab/profile/preview/footprint metadata; remove trilobite-only selection from active whole-fossil paths | Task 3. Existing trilobite unchanged; one new whole specimen works end to end. |
| 7. Complete Room 1 content | Integrate Walchia; assign existing Dimetrodon/Eryops/trilobite to Room 1; author site/migration changes | Tasks 2–6 plus chosen site policy. All four displays required before Room 2 purchase. |
| 8. Add Room 2 then Room 3 in content batches | Authored parts, profiles, models, stories, sites, stands and full restoration loops for each exhibit | Validated pipeline; do not hard-code every new species into mechanics. Test unique Gorgonops/tooth IDs. |
| 9. Add optional presentation polish | Featured display emphasis and bounded room-completion animation | Functional rooms first; decoration/animations do not alter income or unlock rules. |
| 10. Run combined release regression/acceptance | Full save journey, all purchase orders, input/browser checks and target-machine profiling, science/art and Luka review | All shipped content. Tests alone do not establish clarity or age-appropriate pacing. |

No new dependencies, backend, cloud system, generic construction editor or engine replacement is necessary to deliver these bounded requirements. The highest-priority work is the current ledger/save/content/room coupling, not a wholesale rewrite.
