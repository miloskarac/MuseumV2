# Current gameplay systems

Source-verified behavior as of 2026-11-08. Runtime coordination is in `src/app/prototype.ts:startPrototype`; functions named below are the implementation entry points, not proposed services.

## Construction, acquisition and display

| System | Behavior and state | Implementation / dependencies | Limitations |
| --- | --- | --- | --- |
| Museum initialization | Starts in a compact hall with cashier, fixed furniture and unowned stand markers. Derives geometry from `museum.owned`. | `game/museum-layout.ts:museumLayout`; `presentation/world.ts:createWorld`, `buildRoom` | One hall with compact/expanded variants; no construction editor |
| Stand purchase | Click a projected purchase marker and pay the remaining cost, or stand in its circle to contribute coins. Every paid coin persists; the stand appears only when fully paid. | `game/purchases.ts:purchaseStatus`, `buyPurchase`; `game/purchase-payments.ts`; `ui/purchases.ts` | Fixed specimen-specific slots; no relocation, rotation, sale or refund UI |
| Expansion | Purchase `west-wing` after one complete displayed exhibit. Geometry expands west and enables the Eryops offer. | `museumLayout`, `owns`, `purchaseStatus` | No separate room ownership/list, doorway graph or all-previous-room completion gate |
| Excavation | Automatic stationary proximity digging, two hits per layer, global shallowest-layer order. Saved `dig` retains committed hits. | `game/journey.ts:stepDigging`, `digAt`, `activeDigLayer`; `game/burial.ts` | Two authored playable sites, shared pit plan |
| Cleaning and collection | Swept pointer brush, persistent cleaned grid, forgiving threshold, explicit bag action. | `brush`, `collectFossil`; `ui/journey.ts` | No damage, timers or consumable tools; all finds share cleaning-grid rules |
| Reconstruction | Place collected groups in their matching target; partial display visible. One-part slab follows the same placement rules. | `game/assembly.ts:inventory`, `placeGroup`, `exhibitComplete`; `placeOwnedGroup`; `ui/assembly.ts` | No separate restoration bench or arbitrary piece rotation |
| Exhibit completion | All required groups placed; story opens after final placement, display name appears, marker completes, admission recalculates. | `EXHIBITS`, `buildAssembledExhibit`, `buildSlabExhibit`, `createJourneyUi` | Three recipes/stories; no room celebration or featured-exhibit mechanic |
| Helper/storage | One hired helper works only in the active shared pit, delivers discoveries to original-site storage. Player cleans and collects. | `game/helpers.ts`, `helper-simulation.ts`, `storage.ts`; `custody`, `helpers.owned[].task` | Second helper only a configuration ceiling; no unattended/offline work |
| Upgrades | One permanent boots, shovel and helper-tool purchase; effective rates derived from receipts. | `game/upgrades.ts`, `upgrade-stats.ts`, `ui/upgrades.ts` | No repeatable upgrade levels or visitor upgrades |

For complete IDs and the fossil lifecycle see [fossils](05-fossils-and-excavation.md). For prices and purchase prerequisites see [economy](04-economy.md) and [progression](06-progression.md).

## Visitors and cashier

`game/visitors.ts` owns durable visitor transactions; `game/visitor-simulation.ts:createVisitorSimulation` owns transient actors, paths, arrival/service clocks and viewing timers. `presentation/visitors.ts:buildVisitors` creates and animates procedural people from simulation poses.

- No visitors before the first complete owned display. Arrivals require museum location, fewer than six total visitors and fewer than three unpaid visitors. A blocked arrival does not accumulate a backlog.
- New visitors begin at the front entrance and join ordered cashier queue positions. They are nonblocking for the player and do not spend on individual exhibits.
- A visitor pays once after reaching the front queue point while Luka attends the opposite cashier station for one second. Price comes from the current completed-display count.
- Each paid visitor chooses at most two complete displays, using visitor ID and exhibit order to choose stops. This is not random weighted popularity or a full tour of every exhibit.
- Viewing positions sample exhibit perimeter sides with small random jitter, validate clearance and reachable paths, and prefer less-occupied destinations. Visitors face the exhibit and observe for 3.5–6.5 seconds per stop, then leave through the entrance.
- Actors replan after a layout change. If a new stand overlaps their pose, they relocate to a nearby safe sample. An unreachable exhibit stop is skipped. There is no general crowd collision/avoidance; walking actors may overlap.
- Leaving the museum or loading retires paid visits without repeating income. Unpaid visits survive; restored actors stand at queue points. Arrival/service clocks and actor transforms do not persist.

Pending revenue and manual banknote collection use `game/cash.ts:collectTicketRevenue`; all collection paths use the same atomic command. Banknotes can be clicked/tapped from anywhere in the museum, with an accessible DOM amount button as another input path. Only spendable coins are available for purchases.

## Player controls and object interaction

`input/keyboard.ts:createKeyboard` handles physical WASD codes and arrows; diagonal movement is normalized and mapped to the current camera angle. Ctrl/Alt/Meta combinations and input inside buttons/forms/contenteditable are ignored. Blur, visibility changes and activities clear pressed keys. A held key must be released before movement resumes after clearing.

`game/navigation.ts:movePlayer` applies radius-aware bounds/rectangular collisions with short substeps and axis sliding. Default speed is 3.4 units/s; boots increase it to 4.08. Neither click-to-walk nor a touch joystick is implemented.

Museum exhibit markers are keyboard-accessible DOM buttons projected over 3D rings. Entering an incomplete stand's proximity circle also opens assembly automatically; the `enteredExhibit` latch prevents immediate reopening until leaving. Complete displays offer a nearby “about fossil” button, and their projected markers reopen the story. Marker clicks do not require walking into the proximity circle: `assemble()` checks museum/ownership/activity but no distance. Purchases similarly have both marker-click and standing-payment paths.

Cleaning and assembly use Pointer Events and pointer capture, with cancellation on focus loss. Assembly supports click-part/click-target and dragging; moving over 8 pixels starts drag feedback and a 28-pixel target-edge margin allows forgiving drops. Wrong targets keep the part available.

Only cashier banknotes have the active `metadata.collectCash` Babylon picking action. `world.ts` imports Babylon ray-picking registration and handles `POINTERTAP`. There is no generic 3D object selection/manipulation system.

## Camera, animations and feedback

The main orthographic camera has a fixed angle, no attached orbit/pan/zoom controls and aspect-based fit. It does not follow the player. Museum centering changes with hall size; excavation uses an 8-degree horizontal rotation of the shared offset. Assembly uses its own fixed close-up camera. See [world/navigation](07-museum-world-and-navigation.md).

Implemented visual feedback includes walking legs/body bob, shovel/contact/dirt motion, exposed fossil facets, brush progress, soil dents, sequential cleanup pops, automatic exit walking, skeleton group placement lift/highlight in assembly preview, ghost targets, colored stand markers, named completed plaques, tutorial arrow, money-gain HUD, payment remainder/completion cue, ticket-price increase cue, capped pending banknotes, and helper walking/shoveling/pickup/carrying. These effects reflect state; they are not independent reward authorities. No audio playback subsystem was found in `src`.

## UI and activity model

| Module | Player-facing surface |
| --- | --- |
| `ui/hud.ts` | Title, current space, canvas, projected markers, controls and goal footer |
| `ui/journey.ts` | Shared modal, cleaning, inventory, story/illustration/credits, save status/retry, recovery and confirmed reset |
| `ui/assembly.ts` | Numbered part tray/targets, click/drag feedback, assembly preview |
| `ui/economy.ts` | Spendable balance, gain feedback, session/conflict blocker |
| `ui/purchases.ts` | Fixed offers, prices, remaining contributions, purchase dialog |
| `ui/world-map.ts` | Museum and site destination cards, buy/travel status, camp instructions |
| `ui/visitors.ts` | Ticket amount, attended-cashier hint, visitor counts, exact pending-cash button |
| `ui/helpers.ts`, `ui/storage.ts`, `ui/upgrades.ts` | Hire/assign, original-site box inventory/cleaning, permanent equipment |
| `ui/development-speed.ts` | Development-only 1×/2×/5×/10× simulation control |

`Panel` includes cleaning, bag, recovery, reset, assembly, whole, story, purchase, map, helper, storage and upgrades. Some `whole` display support is retained internally, while normal whole-fossil placement opens the shared assembly path. Opening an activity pauses ordinary movement, digging, ticket simulation and helper activity; clearing a panel returns canvas focus. This is a single-player activity gate, not concurrent minigames.

CSS adapts panel layouts, fonts and widths to narrow/short windows, and common buttons have a 44-pixel minimum height. That does not constitute complete mobile play: movement still needs a keyboard, and fitting the entire museum makes world objects small on a phone. Current native-touch usability and child comprehension were not manually retested during this audit.
