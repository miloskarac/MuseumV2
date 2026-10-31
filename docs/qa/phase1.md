# Phase 1 — walkable visual prototype

Implemented 2026-10-04. Visual acceptance is pending Miloš's inspection of the running scene.

## Run and controls

Run `npm run dev` and open the URL Vite prints. The current QA server uses http://127.0.0.1:5175/ because ports 5173 and 5174 were occupied.

- Arrow keys or physical W/A/S/D move relative to the fixed camera, including with a Cyrillic keyboard layout.
- Walk into the green ring by the marked doorway to change areas. The destination ring leads back.
- Arrival is outside the trigger. Release and press a movement key again after travel or losing focus.
- This is keyboard navigation only; touch controls are not implemented.

One museum hall has a temporary unnamed skeleton study, rounded teal platform with brass trim, a readable DOM plaque, two plants, and a bench. The second area is an intentionally plain soil-bed blockout. The fossil is not a scientific species reconstruction or a final asset choice. There is no digging, cleaning, collection, assembly, visitor, economy, or persistence system.

## Reference and screenshot evidence

At the time of this QA pass, `docs/references/target-state.png` was absent; the available file was named `target style.png`. That historical filename is no longer present; all three current references are now available. [museum-layout.png](../references/museum-layout.png) remains the V1 baseline.

Current reference hierarchy: [digging-master-reference.png](../references/digging-master-reference.png) is primary for bright, stylized low-poly 3D rendering with an angled view, readable fossil displays, and simple characters. [target-state.png](../references/target-state.png) is secondary for a bright, welcoming museum and exhibit details; its hand-illustrated rendering is not the required 3D style. The comparisons below record the earlier QA pass and do not establish acceptance against the new primary reference.

- [Existing starter screenshot](phase1-before.png): already present before this task; not a fresh capture.
- [Museum, 1440 × 1000](phase1-after.png).
- [Excavation blockout, 1440 × 1000](phase1-excavation.png).
- [1280 × 720](phase1-1280x720.png).
- [768 × 1024](phase1-768x1024.png).
- [390 × 844](phase1-390x844.png).

The new captures are from headless Microsoft Edge 154.0.4258.53 in an isolated temporary browser context. Museum, excavation, and narrow screenshots were visually inspected. This is screenshot review and scripted input testing, not a hands-on play session.

Compared with V1, the prototype presents a single focal display, open routes, a persistent legible plaque, and a simpler HUD. The tiled hall, rounded plinth and character, ivory bones, warm materials, and softened shadow setup explore the target direction. It remains substantially simpler than the target illustration; no claim of matching it is made. On a narrow portrait viewport, the hall fits but the character and fossil are small.

## Checks

- `npm test`: **7 passed**. Uses Node's built-in test runner with TypeScript support (tested on Node 24.11.0); no test dependency added. Covers camera-relative directions, equal diagonal speed, collision, frame-gap clamping, reachable routes, safe arrival anchors, physical key codes, focus clearing, and input disposal.
- `npm run build`: **passed** after the final code changes. Vite warns about the approximately 1.04 MB minified Babylon entry chunk (approximately 255 KB gzip); it does not fail the build.
- Headless Edge: **passed** screen-relative movement, blur stopping, museum → excavation → museum, stationary safe arrivals, responsive label bounds, no horizontal overflow, and no browser console/page errors at the captured viewports.
- Optional browser check: `node scripts/check-browser.mjs <path-to-an-existing-playwright/index.mjs> <Vite-URL>`. This helper requires a separately available Playwright installation and Edge. QA used the existing Playwright installation in the neighboring V1 repository, read-only; no dependency or file there was changed. The helper inspects Vite's live engine module and is intended for the development server.

## Manual checks still needed

Use a separate QA browser profile on Luka's intended desktop/window:

1. Walk around all sides of the display and along the bench/plants. Check collision sliding, speed, camera comfort, and whether the character stays easy to track.
2. Read the plaque and find the exit without extra explanation. Make several return trips and confirm the ring and arrival behavior feel clear.
3. Hold a direction, switch applications/tabs, release it, and return. Confirm movement stays stopped until a fresh key press. Try physical WASD with the Serbian layout.
4. Resize the window and check the player, plaque, door, and footer. Inspect shadows and frame rate on the intended hardware.
5. Compare the running scene with all three references according to the current hierarchy above. Decide which art/lighting changes are needed; acceptance of the implemented visuals remains pending.

## Files changed in this task

- `src/main.ts` — replace starter mounting with prototype lifecycle.
- `src/app/prototype.ts` — coordinate input, movement, travel, rendering, and cleanup.
- `src/ui/hud.ts`, `src/style.css` — responsive Cyrillic HUD and anchored labels.
- `src/presentation/world.ts`, `src/presentation/shapes.ts` — finish existing scene with adjusted lighting/framing and rounded display geometry.
- `index.html` — suppress the browser's missing default favicon request.
- `package.json`, `tests/navigation.test.ts`, `tests/keyboard.test.ts` — focused dependency-free tests.
- `scripts/check-browser.mjs` — optional browser QA helper.
- `docs/qa/phase1.md` and five new `phase1-*.png` captures — verification and review evidence.

Existing `src/game/navigation.ts`, `src/input/keyboard.ts`, `src/content/prototype.ts`, and `src/presentation/fossil.ts` were inspected and integrated without edits. Babylon dependencies were already installed. This folder has no Git metadata, so this inventory describes edits made during the task rather than a Git diff.
