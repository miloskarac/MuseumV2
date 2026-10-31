# Bag picture tiles — 2026-10-18

Replaced the bag's bulleted text with a grid of bone pictures, Serbian names and the assembly tray's stable part numbers. The same `groupPicture` renderer supplies both views. Tiles are noninteractive list items; inventory remains collected parts minus placed parts. Empty-bag guidance, close controls and saving are unchanged.

Changed files: `src/ui/journey.ts` (picture markup), `src/style.css` (three desktop columns/two narrow-screen columns), `scripts/check-bag.mjs` (browser QA), and `docs/decisions.md` (request record).

Validation:

- `npm test`: 42/42 passed.
- `npm run build`: passed; existing large-chunk advisory remains.
- `node scripts/check-bag.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5176/`: passed. Checks identical bag/assembly illustrations, all six names, removal after actual placement, reload, partial recovery, empty bag/reset, close/Escape and responsive bounds. No page errors.
- Visually inspected Edge 154.0.4258.53 screenshots at 1280 × 720 and 390 × 844. All six tiles and the close button fit at both sizes. QA used an isolated temporary profile; Luka's save was untouched. No Luka playtest.

[Before](bag-before.png) · [After, desktop](bag-after-1280.png) · [After, phone](bag-after-390.png) · [Empty bag](bag-after-empty.png).
