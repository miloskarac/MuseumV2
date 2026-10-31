# Development game speed — 2026-10-21

Run `npm run dev` and use **Тест · брзина** in the header to choose **×1, ×2, ×5 or ×10**. The selected speed is highlighted. It affects walking, digging, falling to the soil surface, sequential cleanup and the automatic return walk. Cleaning and assembly remain driven by pointer actions. Selecting a speed returns keyboard focus to the game and preserves an ongoing shovel cycle.

Reloading or confirming a new game restores ×1. The setting is session-only and is not part of the saved game. Production builds do not show the testing control and run at ×1.

The frame loop repeats the existing bounded simulation update for the selected multiplier, rendering once afterward. Movement collisions, shovel contact, discovery panels, completion and pause guards are checked on each step. Real elapsed time is capped before multiplication, preserving the existing no-catch-up behavior after a stall. Save scheduling remains on real time; important gameplay transitions still flush immediately.

## Changed files

- `src/game/simulation-speed.ts`: allowed speeds and bounded simulation stepping.
- `src/app/prototype.ts`: development selector and simulation/render loop integration.
- `src/ui/development-speed.ts`, `src/style.css`: Serbian Cyrillic speed buttons, selected state and responsive header.
- `tests/simulation-speed.test.ts`: time scaling, digging/save equivalence, collision/pause and unique completion checks.
- `scripts/check-development-speed.mjs`: disposable browser interaction, timing, persistence and layout checks.
- `docs/decisions.md`, this report and screenshots.

## Verification

- `npm test`: **76 tests passed**.
- `npm run build`: **passed**, with the existing large-chunk warning.
- Browser QA passed in disposable **Edge 155.0.4283.62** profiles, using the development server and a local production preview. Luka's browser storage was not accessed.
- Deterministic 10 ms browser frames measured walking ratios of **1.00, 2.00, 5.00, 10.00**. First shovel hits occurred at frames **72, 36, 15, 8**, respectively, retaining one hit at contact.
- Verified switching speed during a swing, partial-hit reload, modal and hidden-tab pause, no catch-up on resume, accelerated cleanup/return with unique closure, reload/reset returning to ×1, and absence of controls in production.
- Visually inspected screenshots at **1440 × 1000** and **390 × 844**. Controls fit within the header, wrap on narrow screens, and leave the scene visible. High speeds intentionally make movement and animation harder to follow; ×1 remains the ordinary play setting.

| View | Screenshot |
| --- | --- |
| Header without testing controls (comparison capture) | [Before](development-speed-before.png) |
| Desktop, ×5 selected | [After](development-speed-1440x1000.png) |
| Narrow viewport | [390 × 844](development-speed-390x844.png) |

Browser check command:

```powershell
node scripts/check-development-speed.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5176/ http://127.0.0.1:5190/
```
