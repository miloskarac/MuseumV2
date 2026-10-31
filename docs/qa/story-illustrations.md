# Fossil and living-animal comparison — 2026-10-21

Completed story cards now pair the existing fossil preview on the left with a living-animal illustration on the right. The same layout serves Dimetrodon, Eryops and the trilobite slab. Below 700px, the fossil comes first and the illustration stacks underneath. Assembly remains full width with its original part tray and targets.

Each image is captioned **Тако је могао да изгледа**. **О слици** expands to show the reconstruction/color caveat, artist credit, source and license links. The trilobite picture is explicitly an Isotelus example, without assigning that species to the game's generic slab.

## Image sources

Inspected the source descriptions, license declarations and downloaded images:

- [Dimetrodon8DB.jpg](https://commons.wikimedia.org/wiki/File:Dimetrodon8DB.jpg): Dmitry Bogdanov, source revisions by Monsieur X; CC BY 3.0.
- [Eryops1DB.jpg](https://commons.wikimedia.org/wiki/File:Eryops1DB.jpg): Dmitry Bogdanov; selected CC BY-SA 3.0.
- [Isotelus Solo Reconstruction.jpg](https://commons.wikimedia.org/wiki/File:Isotelus_Solo_Reconstruction.jpg): Prehistorica CM; CC BY 4.0.

The three 960px thumbnails are bundled locally (about 428 KB total), with no runtime image-service dependency. No cropping, recoloring or mirroring. Full download URLs, licensing and interpretation notes are in [asset credits](../../src/assets/animals/README.md).

## Files changed

- `src/assets/animals/`: three JPGs and attribution README.
- `src/content/animal-illustrations.ts`: per-exhibit images, Serbian descriptions and source/license metadata.
- `src/ui/journey.ts`: comparison container, illustration and attribution disclosure.
- `src/style.css`: side-by-side story layout and narrow-screen stacking.
- `scripts/check-story-illustrations.mjs`: all three images, external-request blocking, responsive positions, reload/final-placement and assembly isolation.
- `scripts/check-exhibit-story.mjs`: corrected its old closed-site fixture to include the already-required trilobite recovery.
- `docs/decisions.md`, this report and screenshots.

## Verification

- `npm test`: **76 passed**.
- `npm run build`: **passed**, including all three image assets; existing large-chunk warning remains.
- `node scripts/check-story-illustrations.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5176/`: **passed** with external requests blocked. All three local images decode, have alt text and appear in the correct order. Story facts, saved parts, reload and final placement remain intact.
- `node scripts/check-exhibit-story.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5176/`: **passed** for stand names, completion/reload/reset, story facts, modal close, responsive bounds and assembly isolation.
- Disposable **Microsoft Edge 155.0.4283.62** profiles at **1440 × 1000**, **1280 × 720** and **390 × 844**. Visually inspected all three desktop cards and the narrow Dimetrodon view. Pictures are uncropped and the fossil previews remain readable. No horizontal overflow or browser errors; Luka's save was not accessed.
- These are artists' reconstructions, not confirmation of precise living colors or patterns. Existing educational text and scientific-review status remain unchanged.

| View | Screenshot |
| --- | --- |
| Original fossil-only card | [Before](story-illustration-before-1440.png) |
| Dimetrodon comparison | [After](story-illustration-dimetrodon-1440.png) |
| Eryops comparison | [Eryops](story-illustration-eryops-1440.png) |
| Trilobite comparison | [Trilobite](story-illustration-trilobite-1440.png) |
| Narrow-screen stacking | [390 × 844](story-illustration-dimetrodon-390.png) |
