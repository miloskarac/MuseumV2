# Museum for Luka — V1 Handoff

## Purpose

This document records the playable V1 project as a source of requirements and lessons for V2. It is a handoff, not an instruction to copy the V1 implementation line by line. Where this document conflicts with a newer explicit product decision, the newer decision wins.

## V1 at a glance

V1 is a local-browser fossil discovery and museum game for Luka, age six. It has one museum hall, two excavation sites, four exhibits, and a working discovery-to-display progression loop.

- Engine: Babylon.js 9.26.1
- Language/build: TypeScript and Vite
- Interface: HTML/CSS alongside the Babylon.js scene
- No backend, account system, cloud save, or online requirement
- Models and textures are generated in code
- Development commands: `npm install`, then `npm run dev`
- V1's documented Node baseline is 24.11+; Microsoft Edge is its primary tested browser

The V1 repository is the reference for actual current behavior. This handoff is based on a code summary, not an independent review of the source.

## Implemented V1 gameplay

### Movement and spaces

- Screen-relative arrow keys or WASD movement, including physical WASD keys with a Cyrillic keyboard layout.
- Fixed-angle orthographic camera with smooth follow.
- Furniture collision boundaries and marked circles for room travel.
- Ladders provide access into excavation areas.

### Excavation, cleaning, collection, and assembly

- Shoveling starts automatically near soil and is interrupted by walking away.
- Partial block progress persists. The first pit has one 6×6 layer; the second has an 8×8 grid of smaller blocks.
- Uncovered fossils open a mouse-controlled brushing activity. Cleaned areas persist; repeated strokes over clean areas add nothing; mistakes cannot damage the fossil.
- The collection bag has unlimited capacity.
- Large skeletons use drag-and-drop assembly with forgiving snapping and a click-then-click alternative.
- Small fossils are displayed whole on stone slabs.

### Museum progression and content

- Placed bones appear immediately in the museum and increase ticket value, even before a skeleton is complete.
- Completed exhibits show short educational cards in Serbian Cyrillic.
- Current content includes 16 discoveries across four exhibits: Dimetrodon (six anatomical groups), Eryops (eight parts), Apateon, and Paleolimulus.
- Completing Dimetrodon unlocks purchases for the second site, Eryops, and the whole-fossil exhibits.
- A pit completes only after all its discoveries are recovered and cleaned; remaining soil disappears in a finishing animation, the player returns outside, and the exhausted entrance closes.

### Economy and visitors

- V1 starts with 200 coins.
- Pedestals cost 100, 125, 150, and 175 coins in purchase order; sites cost 50 and 75.
- Standing at a purchase point contributes money gradually; partial payments persist.
- Each discovery gives four digging coins and adds two to admission when displayed. The first display has a one-time 100-coin reward.
- Visitors arrive about every four seconds, with limits of 20 waiting and 40 total. Standing behind the cashier serves the queue immediately.
- Ticket revenue forms a separate cash pile that the player collects physically. Visitors tour available exhibits.

Treat V1 numerical values as observed behavior, not locked V2 balance requirements.

### Save behavior

- Autosave runs every 750 ms and at important transitions.
- V1 save version 12 includes location, digging, cleaning, assembly, purchases, partial payments, money, queues, and active visits.
- V1 has backup recovery, JSON export/import, confirmed reset, and migrations from older formats.
- Saves are tied to the browser profile and exact origin. `localhost` and `127.0.0.1` use different browser storage.
- Hidden tabs and activity menus pause simulation; there is no offline income.

V2 should start with a clean save format unless the owner explicitly asks to import V1 progress. Do not inherit V1's migration burden by default.

## Decisions and player-facing rules worth carrying forward

These choices worked well in V1 and are good V2 defaults:

- Short, clear player-facing text in Serbian Cyrillic; large, readable controls.
- Mouse activities are separated from keyboard movement.
- Give immediate, visible progress and forgiving interactions.
- Do not punish incorrect assembly attempts.
- Yellow marks purchase points, blue marks incomplete exhibits, and green marks completed exhibits.
- Tutorial arrows disappear permanently after the first displayed discovery.
- Empty stands reveal only bones already placed; show species names and stories when an exhibit is complete.
- Reuse shared anatomy/content definitions across excavation, cleaning, assembly, and museum display.
- Human owner makes product decisions and performs QA; Codex implements and checks bounded changes; Luka's play sessions judge clarity and enjoyment.
- Work in small playable increments. Use screenshots, reference images/videos, and specific corrections.
- Preserve rewards and progress; prevent duplicate rewards.
- Separate confirmed requirements from suggestions and open questions.

## V1 visual state

V1 is a colorful, angled 3D museum with simple toy-like characters and procedural fossils. Its recent uncommitted refresh adds cream tiled floors, muted teal platforms, brass trim, dark specimen backing, woven mats, and softer shadows. `docs/references/museum-layout.png` records this V1 appearance as the baseline. For V2, `docs/references/digging-master-reference.png` is the primary rendering-style reference: bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. `docs/references/target-state.png` is a secondary concept reference for a bright, welcoming museum and exhibit details; its hand-illustrated rendering is not the required 3D style. Do not assume the V1 look or implementation must be copied.

## Lessons and known V1 limitations

- Documentation drift occurred: older docs disagreed with current prices, queue limits, save formats, and visitor behavior. V2 should have one concise current specification and a small decision log.
- `world.ts` grew to about 787 lines; `main.ts` mixes simulation coordination, DOM updates, and progression conditions.
- Sites and exhibits have hard-coded special cases. V2 should prefer data-driven exhibit/site definitions and scene builders separated by responsibility.
- Some player-facing text remains embedded in logic and collection definitions. Keep text/content separate from behavior where practical.
- Twelve save versions and historical pit layouts created migration work. Start V2 with a deliberate small save contract and add migrations only when V2 actually needs them.
- Characters are simple, fossils are stylized reconstructions, and visitor avoidance is not full crowd separation. Small-specimen readability and busy-screen clarity need playtesting.
- Larger ideas such as helpers, restoration, diamonds, narration, discovery journal, tablet controls, more eras, and a 40–60 exhibit ambition were not implemented or fully decided. Treat them as proposals until explicitly prioritized.
- The latest V1 visual refresh included uncommitted changes and a new untracked `src/museum-finish.ts`. Keep the V1 folder intact if that work may be needed as a reference.

## V1 verification record

The supplied summary reports 126 passing unit tests and a passing production build. It does not report a fresh Edge/Playwright E2E run. This is a historical report, not a V2 verification result.
