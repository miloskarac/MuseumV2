# Shovel grip and swing — 2026-10-21

The supplied `docs/references/dig-sites/digging.mp4` showed the handle passing through the character and the upper hand moving behind the hat. Its opening swing was inspected as timestamped frames. The previous pose rotated the long shaft backward while independently lifting its blade.

The revised animation lifts the shovel in front of the body, pushes into the soil with a small hip lean, and withdraws smoothly. One hand holds the crossbar; the other guides the shaft. Elbows bend outward and down. Interpolation follows the held crossbar so intermediate poses also stay clear of the head. At higher/lower soil edges, the tool tilt and guiding hand position adapt to the surface without stretching the arms.

The feet, one-second cycle, contact at 0.72 seconds, two hits per layer, gameplay rules and save format remain unchanged.

## Files

- `src/presentation/dig-animation.ts`: grip-centered poses, elbow direction, terrain reach and aligned dirt particles.
- `scripts/check-dig-pose.mjs`: before/after capture and full-cycle geometry checks.
- `scripts/check-digging.mjs`: detect the revised lift by height instead of the old backward angle.
- `docs/decisions.md`, `docs/digging-polish.md`, this report and QA screenshots.

## Verification

- `npm test`: all 72 tests passed.
- `npm run build`: passed; existing large-chunk warning remains.
- `node scripts/check-dig-pose.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5176/ after`: passed. Checks 101 samples per swing at five relative soil heights, hand/shaft clearance from the head and hat brim, constant arm segment lengths, and restoration of idle arms when digging stops.
- `node scripts/check-digging.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5176/`: passed. Live digging still shows two contacts, reaches the pre-hit surface, keeps feet planted, retains the first-hit material and clears only the struck tile. Existing depth-rendering and viewport checks passed.
- Used disposable Microsoft Edge 155.0.4283.62 profiles. Visually inspected gameplay at 1440 × 1000 and six enlarged poses from the same viewing direction. Framing checks also ran at 1280 × 720, 768 × 1024 and 390 × 844. Luka's save was not accessed.
- The screenshots make the two-handed grip and clear separation from the face visible. Luka's assessment of the motion during play remains a human playtest.

| View | Before | After |
| --- | --- | --- |
| Six swing poses, enlarged for inspection | [Before](shovel-pose-before.png) | [After](shovel-pose-after.png) |
| Actual gameplay scale | [Before](shovel-pose-before-gameplay.png) | [After](shovel-pose-after-gameplay.png) |

[Supplied video frames](shovel-reference-frames.png)
