# Phase 1 — primary-reference visual pass

2026-10-04. Requested museum-architect review and first focused implementation pass. Rendering follows [digging-master-reference.png](../references/digging-master-reference.png). [target-state.png](../references/target-state.png) contributes welcoming atmosphere and exhibit details only.

## Architect findings and prioritized plan

1. **Flat lighting and beige materials:** the earlier screenshot had little directional modeling on the bones and room. Establish bright neutral daylight, controlled cast shadows, quieter stone tiles, and separate paint/stone/brass material responses.
2. **Unfinished exhibit presentation:** the broad dark slab and nearly invisible mounts flattened the fossil. Finish the existing plinth with a pale rim, beveled tiers, a sage display bed, and distinct metal supports.
3. **Blockout room detail:** blank panels, a solid bench, and identical plants added little museum identity. Add shallow shell/leaf reliefs, wall caps, bench slats, pot collars, and varied faceted foliage within existing footprints.

These priorities were stated before coding and implemented as one bounded presentation pass. The architect reviewed the draft and recommended reducing near-white highlights; final fill/key levels and bone color were adjusted accordingly. A future specimen-specific art pass could improve anatomical silhouette and articulation once content is chosen; this pass preserves the unnamed skeleton study and makes no new scientific claims.

## Comparison

- [Before — fresh capture](low-poly-before.png)
- [After — production build](low-poly-after.png)
- [Primary rendering reference](../references/digging-master-reference.png)

Both comparison captures use headless Microsoft Edge 154.0.4258.53, **1440 × 1000, DPR 1**, initial player position, and the same orthographic camera at `(12, 16, -16)` targeting `(0, 0, 0)`. Camera framing, room dimensions, obstacle positions, travel marker, controls, HUD, and gameplay are unchanged. The before capture used the development server; the after capture used the production preview at `http://127.0.0.1:4182/`. Each used an isolated temporary browser context, not Luka's profile.

## Implementation

- `src/presentation/world.ts`: brighter plaster/stone, richer teal, material-specific sheen, pale plinth cap and contrasting bed, framed reliefs, wall caps, slatted bench, pot collars, and faceted foliage. Museum light uses neutral fill `0.76` and warm directional key `0.48`. Percentage-closer filtered shadows and automatic light depth bounds replace the museum's exponential shadow filtering, which visibly darkened otherwise lit surfaces. Excavation retains its previous lighting and used material colors.
- `src/presentation/shapes.ts`: reusable beveled box geometry for the plinth, frames, bench, wall caps, and mount feet. Existing primitive helpers remain intact.
- `src/presentation/fossil.ts`: separate mount material and feet seated above the display bed. Skeleton anatomy and placement are unchanged.
- `scripts/check-browser.mjs`: optional screenshot prefix so new QA captures preserve historical Phase 1 images.
- This QA note and `low-poly-*.png` capture evidence, including an intermediate draft.

No dependency, asset pipeline, navigation, collision, content, persistence, or gameplay changes were introduced. All decoration is procedural local geometry.

## Verification

- `npm test`: **7 passed**.
- `npm run build`: **passed**. Existing large-chunk warning remains (approximately 1.047 MB minified main entry, 256 KB gzip).
- Existing `scripts/check-browser.mjs`: **passed** in Edge on the development build. Checks cover screen-relative movement, focus clearing, museum/excavation round trip, safe stationary arrivals, label bounds, no horizontal overflow, and no console errors at 1440 × 1000, 1280 × 720, 768 × 1024, and 390 × 844.
- Existing `scripts/capture-lighting.mjs`: production scene loaded without browser errors and captured the final unchanged camera view.
- Final desktop, narrow portrait, and excavation screenshots were visually inspected. Bone shadows and mount contact are visible, the rim separates from the teal body, tile variation remains, and the travel ring and open routes are readable. This was screenshot inspection plus scripted real keyboard input, not a hands-on play session.

Remaining manual QA: review brightness, shadow comfort, and frame rate on Luka's intended monitor while walking around the display. Narrow portrait still makes the room/fossil small with relatively large labels; this existing framing limitation was kept outside the pass. The skeleton remains a temporary study, not a finished match for the primary reference's specimen fidelity.

Reproduce (using the existing read-only Playwright installation from V1):

```powershell
node scripts/check-browser.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:5182/ docs/qa/low-poly-browser
node scripts/capture-lighting.mjs F:/Milos/Repos/Muzej/node_modules/playwright/index.mjs http://127.0.0.1:4182/ docs/qa/low-poly-after.png
```
