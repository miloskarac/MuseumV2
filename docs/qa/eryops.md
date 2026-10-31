# Eryops: second excavation and expanded museum

The later [depth progression update](depth-progression.md) makes the second pit two layers deep, with two layers per soil band. The one-layer description below records this feature's original release.

2026-10-19. Implements Miloš's requested Eryops fossil, separate excavation, dedicated stand and larger hall. The visual reference is [Eryops.png](../references/museum/Eryops.png).

## Playable scope

The first pit retains six Dimetrodon finds plus the whole trilobite. Closing it opens the second outdoor plot without a purchase. The second 8 × 8 one-level pit contains six Eryops finds: skull, spine, ribs, front legs, hind legs and tail. These counts/dimensions are bounded implementation defaults, not a commitment to later collection size or balance.

Each find requires digging, cleaning and explicit collection. The bag shows its picture. Cleanup waits for all six finds; site closure is independent of museum placement. Eryops uses the existing click/drag assembly with harmless mistakes and persistent partial placement. Its circle is blue when empty, yellow when partial, green when complete. Completion prints Ериопс on the physical plate and opens four short Serbian Cyrillic facts with a close view of the skeleton.

The hall extends left from 16 to 25 units wide. Existing exhibits, entrance and arrival positions stay fixed. The new stand has space on all sides; collision bounds and camera framing follow the larger room. Outdoor and pit bounds remain unchanged. Skeleton recipes are selected by specimen; stand construction and assembly preview are shared.

## Save contract

Schema **10** keeps the same fields and localStorage key. New IDs use `eryops-dig`, `eryops-r{row}-c{column}`, `eryops-…-find` and `eryops-…` part IDs. The historical `future-site-02` trilobite pit remains a migration input only; its progress never becomes Eryops progress.

- Schema 9 validates against the original seven finds and first site, then advances only the version. Nothing is granted or discarded.
- Schemas 1–8 retain their existing validations/conversions, including moving the former trilobite find into the shared first pit.
- Second-site progress requires first-site closure. Collection requires its own exposed tile; placement requires its own collected find. Duplicate IDs, unearned work and premature closure are rejected.
- Reload preserves partial digging, cleaning, accepted placement and completed cleanup. Closure occurs once at the second site's own outdoor front. Failed saves retain the existing retry behavior.

## Visual evidence

| View | Screenshot |
| --- | --- |
| Before: previous hall | [Before](eryops-museum-before.png) |
| After: three completed exhibits | [Expanded museum](eryops-museum-complete.png) |
| Six-part assembly | [Desktop](eryops-assembly.png) · [1280 × 720](eryops-assembly-1280.png) · [390 × 844](eryops-assembly-390.png) |
| Partial display | [Yellow circle and skull](eryops-museum-partial.png) |
| Educational card | [Desktop story](eryops-story.png) |
| New excavation | [Second site](eryops-second-site.png) · [Cleaning](eryops-cleaning.png) |
| Recovered Eryops parts | [Pictured bag](eryops-bag.png) |

## Content review

The procedural skeleton is a stylized interpretation of the supplied mount, emphasizing the broad flat skull, rib cage, splayed limbs and tapering tail. It is not an anatomical reconstruction. Short educational paraphrases were checked against the [Natural History Museum's fossil amphibian collection](https://www.nhm.ac.uk/our-science/services/collections/palaeontology/fossil-amphibians.html) and [AMNH's Eryops skull record](https://digitalcollections.amnh.org/archive/Eryops-skull--1909-2URM1THIB6ZP.html). Scientific review remains open.

Miloš's acceptance of this new artwork and Luka's comprehension/play-feel check are not yet recorded. Automated input checks and screenshot inspection do not establish enjoyment or ease of independent play.

## Verification and files

`npm test`: **55/55 passed**. `npm run build`: **passed**, with the existing large JavaScript chunk warning. New tests cover unique ownership, second-site prerequisites, old-save migration, independent partial cleaning/placement, cleanup/reload/closure and walking routes around the enlarged hall.

`scripts/check-eryops.mjs` **passed** in disposable Microsoft Edge **155.0.4283.62** profiles. It seeds the previous completed first-site save, walks into the second site, digs and cleans all six Eryops finds through real keyboard/pointer input, reloads during cleanup, checks closure at the correct front, verifies pictured inventory, walks back to the museum and reaches Eryops's circle. Separate fixtures check wrong-target placement, partial reload, completion, switching among all three exhibits and responsive cards. There were no console/page errors.

Both existing browser regressions **passed** on the same build: `scripts/check-journey.mjs` (fresh first-pit recovery, both original exhibits, failed writes/retry, corrupt/newer saves, reset/cancel, storage recovery, 768 × 1024 included) and `scripts/check-phase4.mjs` (explicit slab placement, misses, failed placement save/retry, schema-8 partial cleaning migration). The Eryops visual checks were rerun after the narrow-window exit-caption correction and passed.

Screenshots were inspected at **1440 × 1000**, **1280 × 720** and **390 × 844**. The narrow window keeps the assembly targets, pictures and close button accessible; the museum overview is necessarily smaller there. Desktop remains the clearest view of the enlarged hall. The exit caption is kept within the viewport.

Application files changed:

- `src/content/exhibit.ts`, `src/content/journey.ts`: Eryops content, six discoveries, second-site definition and guidance.
- `src/game/journey.ts`, `src/persistence/save.ts`: version 10 and validated compatibility.
- `src/game/navigation.ts`, `src/presentation/world.ts`: room bounds, stand location, collision and framing.
- New `src/presentation/eryops.ts`, `eryops-profiles.ts`, `skeletons.ts`, `assembled-exhibit.ts`: specimen geometry, part pictures and shared stand/recipe selection.
- `src/presentation/fossil-profiles.ts`, `assembly-preview.ts`, `src/ui/assembly.ts`, `journey.ts`, `hud.ts`: specimen-aware pictures/preview, inventory, guidance and viewport-safe exit caption.
- Updated focused tests and browser scripts; added `tests/eryops.test.ts` and `scripts/check-eryops.mjs`. Decisions, roadmap and this QA record document the change. No dependencies added.
