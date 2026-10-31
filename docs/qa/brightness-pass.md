# Phase 1 brightness and room palette

2026-10-04. Reference inspected: [target-state.png](../references/target-state.png), now present at its intended path.

This is a historical brightness comparison using the secondary concept reference. Current rendering guidance comes primarily from [digging-master-reference.png](../references/digging-master-reference.png): bright, stylized low-poly 3D with an angled view, readable fossil displays, and simple characters. [museum-layout.png](../references/museum-layout.png) is the V1 baseline. `target-state.png` guides a bright, welcoming museum and exhibit details; its hand-illustrated rendering is not the required 3D style. This QA pass does not establish acceptance against the primary rendering reference.

## Comparison

- [Before](brightness-before.png)
- [After — production build](brightness-after.png)

Both were captured in headless Microsoft Edge 154.0.4258.53, 1440 × 1000, device pixel ratio 1, with the same fixed camera, framing, initial player position, layout, and UI. The before image was captured from the development server before editing; the after image is from the production preview at http://127.0.0.1:4175/. Each capture used an isolated temporary browser context. The final screenshot was visually inspected; hands-on visual approval on the intended display remains with Miloš.

## Changes

Application changes are confined to `src/presentation/world.ts`:

- Increased hemispheric diffuse fill from 0.6 to 0.85 and lightened its ground bounce to remove brown shading from vertical surfaces and bone undersides. Disabled specular highlights from this broad fill.
- Balanced the warm directional key from 0.75 to 0.35, leaving exposure unchanged. The fill contributes more of the room's brightness while the key supplies directional shading.
- Made plaster a lighter cream. Reduced floor material brightness/yellow saturation so tile variations survive the lighting. Lifted teal paint/base and display backing while retaining fossil contrast; made the bone material less yellow.
- Reduced shadow blur kernel from 24 to 16 and normal bias from 0.035 to 0.015 to retain small contact detail. Adjusted the shadow darkness setting from 0.2 to 0.12; diffuse fill keeps shadowed surfaces legible.

Lighting and shared materials also apply to the excavation blockout. No geometry, camera, layout, gameplay, controls, content, or reference-image background was changed.

Additional files: `scripts/capture-lighting.mjs` (repeatable screenshot helper using an existing Playwright installation), this note, and the two comparison PNGs. Earlier Phase 1 captures are preserved.

## Verification

- `npm run build`: passed. Existing large Babylon bundle warning remains (approximately 1.04 MB minified entry, 255 KB gzip).
- `npm test`: all 7 existing tests passed. No new logic tests were needed for material/light tuning.
- Production preview loaded in Edge with no console or page errors; final screenshot captured and inspected.

The walls and bones are lighter, the floor retains alternating cream tiles, and the teal platform remains distinct. Review the running scene against the current reference hierarchy for final brightness, shadow strength, and comfort on Luka's monitor; this pass does not establish full visual acceptance.
