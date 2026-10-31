# Completed plate and fossil story — 2026-10-18

The physical white plate now displays **Диметродон** only after all six groups are placed. The plate is slightly wider for the Cyrillic name, with lettering drawn locally into a Babylon texture. Empty and partial stands keep a blank plate. Completion, reload and reset derive visibility from existing placement state; no save-format change.

The completed card follows the supplied V1 reference: Permian heading, greeting, existing live skeleton preview, specimen caption, four short question-and-answer sections, an observation prompt and **Назад у музеј**. Text is Serbian Cyrillic. Desktop uses two columns; narrow screens use one scrollable column. The card opens at its heading. Floor-circle activation and assembly remain intact.

## Source check

Short original Serbian paraphrases, checked on 2026-10-18:

- [Harvard Museum of Natural History: Dimetrodon](https://whatsinaname.hmnh.harvard.edu/dimetrodon) supports the Permian setting, predatory diet, differently sized teeth, long tail, sail supported by elongated vertebral spines, and closer relationship to mammals than dinosaurs. Four limbs are also visible in its specimen and reconstruction illustrations.
- [Natural History Museum: What are dinosaurs?](https://www.nhm.ac.uk/discover/what-are-dinosaurs.html) corroborates that Dimetrodon was not a dinosaur and lived earlier.

The observation prompt is an activity, not a scientific claim. No claim about the sail's function, exact species size or skin color is added. This is source verification, not expert anatomical review of the stylized model.

## Files changed

- `src/content/exhibit.ts`: expanded story text and source-check date.
- `src/presentation/world.ts`: physical plate lettering and completion visibility.
- `src/ui/assembly.ts`: completed specimen caption.
- `src/ui/journey.ts`, `src/style.css`: story layout and responsive presentation.
- `scripts/check-exhibit-story.mjs`: focused browser regression checks and screenshots.
- `scripts/check-journey.mjs`: update assertions for the new story title and four sections.
- `docs/decisions.md`: record the explicit request.

## Verification

- `npm test`: 42/42 passed.
- `npm run build`: passed; existing Vite large-chunk advisory.
- `node scripts/check-exhibit-story.mjs "F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs" http://127.0.0.1:5176/`: completion-only name, restored completion, final placement, reset, four story sections, preserved preview, modal close/Escape, responsive bounds and assembly isolation. Uses an isolated temporary Edge profile; no access to Luka's saved game.
- Browser: Microsoft Edge 154.0.4258.53. Screenshot inspection at 1280 × 720, 1440 × 1000 and 390 × 844. No Luka playtest. Plate text remains small at phone width; the same name appears at a large readable size in the card.

Before: [blank plate](exhibit-story-before-museum.png), [short card](exhibit-story-before-card.png).

After: [named plate](exhibit-story-after-museum.png), [expanded card](exhibit-story-after-card.png), [large viewport](exhibit-story-after-card-1440.png), [phone top](exhibit-story-after-card-390.png), [phone bottom](exhibit-story-after-card-bottom-390.png).
