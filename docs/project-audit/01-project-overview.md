# Project overview

Audit date: 2026-11-08. Scope: the current **Museum v2** workspace, not the separate historical V1 repository. “Museum 1” in the expansion request means the proposed first themed museum. Source inspection establishes implementation; it does not establish human acceptance or the contents of Luka's browser save.

## Implemented game

Museum for Luka is a local-browser fossil discovery and museum-management game for a six-year-old. Player-facing text is Serbian Cyrillic. The current content is three exhibits, thirteen collectible discoveries and two playable excavation sites.

The current loop is:

1. Travel from the museum through the map to an owned site camp and enter its pit.
2. Stop near reachable soil to shovel; uncover a fossil, brush away dirt and explicitly collect it.
3. Buy a fixed museum stand; place collected anatomy groups or the whole slab using forgiving assembly controls.
4. Complete a display to attract visitors and increase admission.
5. Stand at the cashier to sell tickets; click/tap the banknotes or collection button to transfer pending revenue into spendable coins.
6. Buy the second site, west-wing extension, additional stands and optional helper/equipment. Helpers uncover and deliver finds but the player still cleans and collects them.

There is no backend, account, cloud save, offline earnings, general construction editor or completed three-room museum. After the three displays are complete, story cards and museum walking remain available, as does attended ticket income. Closed pits cannot be mined again.

## Stack and commands

Verified from `package.json`, `package-lock.json` and installed package manifests:

| Component | Declared | Installed during audit |
| --- | --- | --- |
| Babylon.js core | `^9.29.0` | 9.29.0 |
| Babylon.js loaders | `^9.29.0` | 9.29.0; no active loader import found in application source |
| TypeScript | `~6.0.2` | 6.0.3 |
| Vite | `^8.3.0` | 8.3.2 |
| UI | Native DOM, CSS, Canvas 2D | No React/Vue/state-store framework |
| Tests | Node built-in `node:test` and `node:assert/strict` | TypeScript test files run directly by Node |

`package.json` names the package `museum-v2`, version `0.0.0`, ES modules. `tsconfig.json` targets ES2023, uses bundler module resolution, and sets `noEmit: true`.

| Command | Actual script/purpose |
| --- | --- |
| `npm run dev` | `vite` development server |
| `npm run build` | `tsc && vite build` |
| `npm run preview` | `vite preview` |
| `npm test` | `node --test tests/*.test.ts` |

The scripts under `scripts/` are separate browser/visual checks; they are not package test scripts. See [testing](09-testing-and-quality.md) for execution results and environment requirements.

## Project organization

| Directory/file | Responsibility |
| --- | --- |
| `src/main.ts` | CSS import, application startup, Vite hot-reload disposal |
| `src/app/` | Runtime coordination and durable transaction publication |
| `src/content/` | Exhibits, anatomy IDs, sites, economy constants, UI text, illustration metadata |
| `src/game/` | Pure transitions, derived eligibility, movement, visitor/helper simulations |
| `src/persistence/` | Layered schema parsers/migrations, save writer and exclusive browser session |
| `src/presentation/` | Procedural Babylon scenes, skeletons, soil, actors, scenery and animations |
| `src/ui/` | DOM panels, HUD, cleaning canvas, assembly interaction and menus |
| `src/input/` | Keyboard movement |
| `src/assets/animals/` | Local educational illustrations and attribution |
| `tests/` | Rules, save, navigation, content and simulation tests |
| `scripts/` | Ad hoc Playwright browser checks and screenshot capture scripts |
| `docs/` | Decisions, phase plans, historic contracts, QA records, references and this audit |

The implementation is predominantly functions and plain typed objects rather than service classes. Important entry points are `startPrototype`, `createWorld`, `createCommitter`, `createSaveSession`, `loadCashSave`, and the `create*Simulation` factories.

## Status interpretation

Current source implements Phase 6 economy, paid progression, visitors, helpers, storage, upgrades, partial purchase payments and pending cashier cash. Older planning prose is not a reliable current specification. In particular, the roadmap still leaves Phase 5 human/scientific/performance acceptance open; “six phases completed” is not independently verified release acceptance. See [phase history](10-phase-history.md).
