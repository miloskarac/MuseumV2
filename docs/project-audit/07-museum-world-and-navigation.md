# Museum world, rendering and navigation

Verified source geometry, 2026-11-08. World dimensions are engine units; X/Z are horizontal and Y is height. No fresh visual/browser session was run for this documentation audit.

## Layout and fixed positions

Sources: `src/game/navigation.ts`, `src/game/museum-layout.ts`, `src/content/visitors.ts`.

| Element | Center X/Z or rule | Size / significance |
| --- | --- | --- |
| Compact floor | (0, 0) | 16×12; physical edges X −8..8, Z −6..6 |
| Expanded floor | (−4.5, 0) | 25×12; edges X −17..8, Z −6..6 |
| Dimetrodon stand | (−1.2, 0.5) | 7.2×3.5 |
| Eryops stand | (−11, 0.5) | 7.2×3.5; west wing required |
| Trilobite stand | (2.7, 4.5) | 2.2×1.8 |
| Skeleton interaction circles | Stand X, Z = −2.45 | Radius 0.85 |
| Trilobite interaction circle | (0.55, 4.5) | Radius 0.85 |
| Expansion purchase point | (−7, 0) | Appears before wing ownership |
| Purchase contribution radius | Around purchase point | 0.72 |
| Travel portal | (5.4, 3.7) | Radius 0.85; normal map entry from museum/camp |
| New-game player | (2.5, −2.4) | `START` |
| Museum return spawn | (5.4, 1.6) | `ARRIVAL` |
| Cashier desk | (5.3, −1.6) | 1.8×0.8 |
| Player cashier station | (5.3, −0.55) | Radius 0.65, opposite visitor queue |
| Queue points | (5.3, −2.65 − index×0.9) | Three positions |
| Front doorway | (3.8, −5.85) | Width 2.4; posts at X 2.6 and 5.0 |
| Visitor spawn/exit target | (3.8, −5.3) | Inside the front opening |
| Cash tray | (6.85, −1.6) | 0.9×0.9 footprint |
| Bench | (−5.8, −3.8) | 2.3×0.8 |
| Plants | (−6.6, 4.5), (6.5, −4.5) | Each has a 1×1 collision footprint |

`museumLayout()` first insets physical floor edges by 0.3. `isWalkable()` then checks another player radius of 0.3 against those supplied bounds. Effective center limits are therefore X −7.4..7.4 compact / −16.4..7.4 expanded and Z −5.4..5.4, before furniture exclusions. These runtime layout bounds differ from using default navigation constants without an explicit layout.

`layout.key` depends on expansion, available exhibit spots and cashier presence. Purchasing a new stand changes obstacles and can rebuild the scene; partial payments alone do not build geometry. `safeMuseumPosition()` keeps a valid player position or falls back to a preferred marker/arrival.

## Procedural scene

`presentation/world.ts:buildRoom` constructs foundation, individual floor tiles, far/back and left walls, skirting, trim, wall panels, exhibits, bench, plants, cashier and player. Walls are intentionally tall on far sides to preserve the angled view; collision is represented by separate bounds/footprints rather than a mesh physics engine. No partition doors connect multiple museum rooms.

`presentation/museum-exterior.ts:buildMuseumExterior` adds the plaza, street/crossing, bus stop with stationary bus, parking/cars and planted areas. This is scenery; it does not extend player travel or visitor transport simulation. Wall shell/leaf reliefs, exterior props and exhibit decoration have no price/progression rules. Some furniture participates in collision, so changing decorative layout can indirectly affect reachability even though it has no economic statistic.

`shapes.ts` builds boxes/beveled boxes, facets, tubes and other procedural forms. Skeletons/characters are procedural; local JPGs are educational illustrations. There is no active external model-loading or online asset-fetch path in the application source. The loaders package is declared but not imported by the active game.

Lighting/material settings in `world.ts` include hemispheric intensity 0.76, directional intensity 0.48, a 2048 shadow generator, blur kernel 16, configured darkness 0.12 and high-quality percentage-closer filtering. Standard materials use a bright cream/teal/brass/ivory palette. The main engine caps device-pixel-ratio rendering at 2. These are source settings, not measured device-performance guarantees.

## Camera and responsive framing

`content/view.ts:cameraOffset()` returns (12,16,−16) for museum/camp. Excavation rotates its horizontal offset by 8 degrees. Museum camera target is `(layout.floor.x, 0, −2.8)`; position adds the shared offset to that center. Camp/pit target is the origin. `camera.inputs.clear()` disables interactive orbit/pan/zoom; near/far planes are 0.1/100. This is a stationary room camera, not a follow camera.

`world.ts:resize()` fits an orthographic view using `max(halfHeight, halfWidth/aspect)`: museum compact 10/13.4, expanded 11.6/17.1; camp/pit 8.3/11.5. `ResizeObserver` adjusts the engine. As the viewport narrows, the world shrinks to preserve coverage. UI CSS adapts at several widths/heights, but there is no mobile movement controller and no proof that all world details remain readable at phone scale.

Assembly uses a separate fixed orthographic preview at (0.1,3.7,−9), target (0,2,0), also resized to aspect. Its recipe/anchors must fit the current preview framing; a much larger new specimen may need authored framing.

## Player and helper navigation

`navigation.ts:isWalkable` tests a radius-0.3 point against rectangle bounds/obstacles. `movePlayer` clamps frame delta to 0.05 s, uses substeps no longer than 0.08 units and separates X/Z motion to slide along furniture. No physics engine, navmesh or full 3D collision system is used.

Museum obstacles are owned stand footprints, bench/plants and cashier/tray/entrance posts. Visitors are not obstacles. Camps use the selected site's plot footprint. Pits use `PIT_WALLS`, with a ladder opening; soil supports walking and `groundHeight()` follows tile/ladder elevation. Pit collision and default bounds are derived from the first site's geometry, which works because both current pits share its horizontal layout.

`helper-simulation.ts:helperPath` samples clear segments against pit walkability, with nodes from the current position, ladder interaction, authored cells and destination. `helperWorkRoute` tries reachable sides of a target. Helper pathing is separate from the museum visitor router; it does not provide cross-room museum navigation.

## Visitor paths and viewing

`visitor-simulation.ts:visitorWalkable` additionally excludes the travel portal (1.15), player cashier station (station radius + 0.3), exhibit interaction spots (1.05) and purchase circles (0.95).

`visitorPath()` first tests a direct segment with 0.02-unit sampling. Otherwise it builds a half-unit grid across layout X bounds, with **Z hard-coded from −5 to 5**, uses four-neighbor breadth-first search and removes redundant waypoints only when segments are clear. There is no persistent/shared precomputed navmesh. Paths are actor-local and rebuilt on target/layout changes.

`viewingCenter()` special-cases trilobite, otherwise searches `ASSEMBLED_STANDS`. `viewingPositions()` proposes 12 points around real stand width/depth, 0.8 units beyond the edge, with ±0.1 positional jitter. Candidates are filtered for walkability, ranked by crowding within 0.85 of other poses/targets and randomized ties, then tested for reachability. Dwell time is `5 × (0.7 + random×0.6)` seconds. A visitor faces the display while stopped. At most two exhibits are chosen per visit.

Current prevention is destination preference, not collision between moving visitors. Narrow doors/corridors and more complex future room geometry require new reachability/congestion tests. The six-visitor cap currently bounds this work.

## Three-room constraints and recommendations

The expanded single rectangle cannot simply be relabeled as three rooms. Introduce explicit room/doorway geometry, room membership for slots and purchase points, locked-room barriers, available walkable bounds, and a layout revision/key that changes with room ownership. Update `navigation.ts`, `museum-layout.ts`, `world.ts`, `visitor-simulation.ts`, HUD marker projection and purchase UI together.

Keep locked-room visibility separate from traversability and exhibit availability. Reuse the bright procedural materials while adding the requested soft dimming; no dim-locked-room state exists today. Decide camera framing before placing 17 displays: fitting all rooms into one viewport could undermine readability. Profile the enlarged scene, per-target path searches and second preview engine before increasing visitor limits. These are recommendations, not measured present defects.
