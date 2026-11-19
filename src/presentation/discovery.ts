import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CLEANUP_TILE_SECONDS, ROOM1_DISCOVERIES, SITE, soilColorIndex } from '../content/journey';
import type { CleanupPop } from '../game/site-completion';
import type { DigSite } from '../content/journey';
import { isCollected, tileDepth } from '../game/journey';
import type { JourneyState } from '../game/journey';
import type { Shapes } from './shapes';
import { FOSSIL_PROFILES } from './fossil-profiles';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { ROOM1_EXHIBITS } from '../content/exhibit';
import { findBurial } from '../game/burial';

export function buildDiscovery(shape: Shapes, bone: StandardMaterial, soils: StandardMaterial[], site: DigSite = SITE) {
  const { tileSize, floorY, levels } = site.grid;
  const shade = bone.clone('find-bone-facet');
  shade.diffuseColor = Color3.FromHexString('#d4c29b');
  const recess = bone.clone('find-bone-recess');
  recess.diffuseColor = Color3.FromHexString('#53665a');
  const layerHeight = -floorY / levels;
  const tiles = site.cells.map(cell => Array.from({ length: levels }, (_, layer) =>
    shape.box(`soil-tile-${cell.id}${layer ? `-layer-${layer}` : ''}`,
      [tileSize - 0.022, layerHeight, tileSize - 0.022], [cell.x, -(layer + 0.5) * layerHeight, cell.z], soils[soilColorIndex(layer)])));
  // Thin seams make individual layers countable on the open front, including
  // adjacent layers in the same color band. Parenting follows digging/cleanup.
  const seamMaterials = soils.map((soil, i) => {
    const seam = soil.clone(`soil-front-seam-${i}`);
    seam.diffuseColor = soil.diffuseColor.scale(0.78);
    return seam;
  });
  site.cells.forEach((cell, i) => {
    if (cell.row !== 0) return;
    tiles[i].forEach((tile, layer) => {
      const seam = shape.box('soil-front-seam', [tileSize - 0.024, 0.018, 0.006],
        [0, -layerHeight / 2 + 0.009, -(tileSize - 0.022) / 2 - 0.003], seamMaterials[soilColorIndex(layer)]);
      seam.parent = tile;
    });
  });
  const finds = ROOM1_DISCOVERIES.filter(find => site.requiredDiscoveryIds.includes(find.id)).map(find => {
    const onSlab = ROOM1_EXHIBITS.find(exhibit => (exhibit.parts as readonly string[]).includes(find.groupId))?.mode === 'whole';
    const cells = site.cells.filter(c => c.discoveryId === find.id);
    const burial = findBurial(site, find.id);
    const left = Math.min(...cells.map(c => c.x)) - tileSize / 2;
    const right = Math.max(...cells.map(c => c.x)) + tileSize / 2;
    const front = Math.min(...cells.map(c => c.z)) - tileSize / 2;
    const back = Math.max(...cells.map(c => c.z)) + tileSize / 2;
    const facets = FOSSIL_PROFILES[find.groupId];
    const points = facets.flatMap(facet => facet.points);
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
    // Fit the intact silhouette inside its entire footprint. Opaque soil above
    // it naturally hides the still-buried sections as individual tiles clear.
    const width = right - left - 0.18, depth = back - front - 0.18;
    const normalScale = Math.min(width / (maxX - minX), depth / (maxY - minY));
    const rotatedScale = Math.min(width / (maxY - minY), depth / (maxX - minX));
    const rotate = rotatedScale > normalScale;
    const scale = Math.max(normalScale, rotatedScale);
    const pieces = facets.map((facet, index) => shape.facet(index === 0 ? `find-${find.id}` : `find-${find.id}-${index}`,
      facet.points.map(([x, y]) => {
        const dx = (x - (minX + maxX) / 2) * scale, dz = (y - (minY + maxY) / 2) * scale;
        return rotate ? [dz, -dx] : [dx, dz];
      }),
      onSlab ? 0.025 : facet.tone === 'bone' ? 0.065 : 0.006,
      // Slab profiles include their stone foundation first: layer the shell above it.
      [(left + right) / 2, onSlab ? index * 0.001 : facet.tone === 'bone' ? 0 : 0.067, (front + back) / 2],
      { bone, shade, recess }[facet.tone],
      (x, z) => burial.heightAt(x + (left + right) / 2, z + (front + back) / 2)));
    return { id: find.id, burial, pieces };
  });
  return (state: JourneyState, pop: CleanupPop | null = null, unavailable: readonly string[] = []) => {
    site.cells.forEach((cell, i) => {
      const progress = state.dig[cell.id] ?? 0;
      const depth = tileDepth(progress, levels);
      let popScale = 1, lift = 0;
      if (!depth.cleared && pop?.cellId === cell.id) {
        const phase = Math.min(1, pop.elapsed / CLEANUP_TILE_SECONDS);
        popScale = phase < 0.3 ? 1 + Math.sin(phase / 0.3 * Math.PI) * 0.1 : Math.max(0.01, (1 - phase) / 0.7);
        lift = Math.sin(phase * Math.PI) * 0.25;
      }
      // Every remaining cube keeps its own material; exposing a lower layer
      // cannot repaint the full column. Shrink cleanup stacks together.
      const top = -(depth.level + depth.hits * 0.1) * layerHeight;
      const center = (floorY + top) / 2;
      tiles[i].forEach((tile, layer) => {
        tile.setEnabled(!depth.cleared && layer >= depth.level);
        const height = layer === depth.level ? 1 - depth.hits * 0.1 : 1;
        const y = -(layer + 1) * layerHeight + height * layerHeight / 2;
        tile.scaling.set(popScale, height * popScale, popScale);
        tile.position.y = center + (y - center) * popScale + lift;
      });
    });
    for (const find of finds) {
      const visible = !unavailable.includes(find.id) && !isCollected(state, find.id) && find.burial.coverage.some(({ cell, firstLayer }) =>
        (state.dig[cell.id] ?? 0) >= (firstLayer + 1) / levels);
      for (const piece of find.pieces) piece.setEnabled(visible);
    }
  };
}
