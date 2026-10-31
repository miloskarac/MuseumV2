import { SITE, DEPTH_COLORS, EXCAVATION_DEPTH, soilColorIndex } from '../content/journey';
import type { DigSite } from '../content/journey';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Shapes } from './shapes';

type Palette = Record<'cream' | 'rim' | 'teal' | 'tealDark' | 'brass' | 'wood' | 'grout', StandardMaterial>;

// Outdoor working pit: shared layered soil, with open routes around it.
export function buildExcavation(shape: Shapes,
  material: (name: string, hex: string, sheen?: number) => StandardMaterial, palette: Palette, site: DigSite = SITE) {
  const { rim, tealDark, brass, wood, teal, cream } = palette;
  const { x, z, columns, rows, tileSize, floorY } = site.grid;
  const width = columns * tileSize, depth = rows * tileSize;
  const left = x - width / 2, right = x + width / 2, front = z - depth / 2, back = z + depth / 2;
  const earth = material('site-earth', '#c7a274', 0);
  const grass = material('site-grass', '#a5bd83', 0);
  const strata = DEPTH_COLORS.map((hex, i) => material(`site-layer-${i}`, hex, 0));
  const layerHeight = -floorY / site.grid.levels;
  // Cut away the near (-Z) apron as well as its wall: either would hide the
  // character below the surface. The other three sides retain their routes.
  for (const [minX, maxX, minZ, maxZ] of [
    [-8.15, left, front, 6.15], [right, 8.15, front, 6.15],
    [left, right, back, 6.15],
  ]) {
    shape.box('floor-site-foundation', [maxX - minX, 0.35, maxZ - minZ], [(minX + maxX) / 2, -0.22, (minZ + maxZ) / 2], tealDark);
    shape.box('floor-site-earth', [maxX - minX, 0.055, maxZ - minZ], [(minX + maxX) / 2, -0.005, (minZ + maxZ) / 2], earth);
  }
  shape.box('floor-grass-back', [16.3, 0.045, 0.65], [0, 0.04, 5.83], grass);
  shape.box('floor-grass-side', [0.65, 0.045, 6.15 - front], [-7.83, 0.04, (6.15 + front) / 2], grass);
  // The exposed bed is not another diggable layer. Keep its warm, darker
  // backing so ivory fossils remain readable under every soil band.
  const bed = material('pit-bedrock', '#9d7858', 0);
  shape.box('pit-earth-bottom', [width, 0.12, depth], [x, floorY - 0.06, z], bed);
  for (const side of [-1, 1]) {
    for (let layer = 0; layer < site.grid.levels; layer += EXCAVATION_DEPTH.layersPerColor) {
      const bandHeight = Math.min(EXCAVATION_DEPTH.layersPerColor, site.grid.levels - layer) * layerHeight;
      const mat = strata[soilColorIndex(layer)], y = -layer * layerHeight - bandHeight / 2;
      if (side === 1) shape.box('pit-soil-band', [width, bandHeight, 0.05], [x, y, z + side * (depth / 2 - 0.025)], mat);
      shape.box('pit-soil-band', [0.05, bandHeight, depth], [x + side * (width / 2 - 0.025), y, z], mat);
    }
    for (let i = 0; i < columns; i++) {
      if (side === 1) shape.beveledBox('pit-coping', [tileSize - 0.02, 0.09, 0.17], [left + (i + 0.5) * tileSize, 0.04, z + side * (depth / 2 + 0.06)], rim);
      shape.beveledBox('pit-coping', [0.17, 0.09, tileSize - 0.02], [x + side * (width / 2 + 0.06), 0.04, front + (i + 0.5) * tileSize], rim);
    }
  }
  // Ladder aligns with the clearable entry column in the reference.
  const ladderX = site.interaction.x;
  for (const side of [-1, 1]) shape.tube('pit-ladder-rail', [[ladderX + side * 0.24, floorY, back - 0.28], [ladderX + side * 0.24, 0.32, back + 0.1]], 0.035, wood);
  const rungCount = Math.ceil((0.32 - floorY) / 0.26);
  for (let i = 0; i < rungCount; i++) {
    const t = i / rungCount, y = floorY + t * (0.32 - floorY), z = back - 0.28 + t * 0.38;
    shape.tube('pit-ladder-rung', [[ladderX - 0.24, y, z], [ladderX + 0.24, y, z]], 0.032, brass);
  }
  // Field equipment lives outside the player's walking bounds.
  shape.beveledBox('tool-rack', [2.5, 0.38, 0.12], [-4.8, 1.03, 5.97], tealDark);
  for (const rx of [-5.8, -3.8]) shape.box('tool-post', [0.1, 1.22, 0.1], [rx, 0.65, 6], wood);
  for (const rx of [-5.3, -4.3]) {
    shape.tube('tool-handle', [[rx, 0.35, 5.83], [rx, 1.45, 5.83]], 0.035, wood);
    shape.beveledBox('tool-spade', [0.28, 0.35, 0.06], [rx, 0.33, 5.83], teal);
    shape.tube('tool-grip', [[rx - 0.13, 1.45, 5.83], [rx + 0.13, 1.45, 5.83]], 0.04, brass);
  }
  shape.cylinder('field-bucket', 0.4, 0.29, 0.4, [-2.8, 0.24, 5.95], teal);
  shape.cylinder('field-bucket-mouth', 0.018, 0.33, 0.33, [-2.8, 0.45, 5.95], tealDark);
  shape.box('brush-on-rack', [0.14, 0.32, 0.07], [-4.8, 0.91, 5.8], cream);
}
