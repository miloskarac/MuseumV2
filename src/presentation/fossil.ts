import type { Material } from '@babylonjs/core/Materials/material';
import type { Shapes, XYZ } from './shapes';
import { shapes } from './shapes';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { GROUPS } from '../content/exhibit';
import type { JourneyState } from '../game/journey';
import { FOSSIL_PROFILES } from './fossil-profiles';

// Exhibit-local marker locations; the assembly preview uses this same model.
export const FOSSIL_ANCHORS: Record<typeof GROUPS[number]['id'], XYZ> = {
  skull: [-2.45, 1.9, -0.3], 'spine-sail': [-0.25, 2.95, 0],
  ribs: [-0.35, 1.5, -0.65], 'front-legs': [-1.48, 1, -1.15],
  'hind-legs': [0.83, 1, -1.15], tail: [2.45, 1.4, 0.15],
};

// Stylized Dimetrodon study; proportions still require scientific/art review.
export function buildFossil(base: Shapes, bone: Material, dark: Material, mount: Material, x: number, z: number) {
  const groups: Record<string, Mesh[]> = Object.fromEntries(GROUPS.map(group => [group.id, []]));
  let activeGroup = 'spine-sail';
  // Keep the existing shape/shadow pipeline while recording each group's meshes.
  const shape = Object.fromEntries(Object.entries(base).map(([key, build]) => [key, (...args: unknown[]) => {
    const mesh = (build as (...args: unknown[]) => Mesh)(...args);
    mesh.metadata = { ...mesh.metadata, fossilGroup: activeGroup };
    groups[activeGroup].push(mesh);
    return mesh;
  }])) as ReturnType<typeof shapes>;
  const point = (dx: number, y: number, dz = 0): XYZ => [x + dx, y, z + dz];
  const spine: XYZ[] = [];
  for (let i = 0; i < 15; i++) {
    const dx = -1.75 + i * 0.21;
    const y = 1.8 + Math.sin(i / 14 * Math.PI) * 0.12;
    spine.push(point(dx, y));
    activeGroup = 'spine-sail';
    shape.beveledBox('vertebra', [0.18, 0.18, 0.24], point(dx, y), bone);
    shape.tube('vertebra-process', [point(dx, y, -0.18), point(dx, y + 0.035), point(dx, y, 0.18)], 0.035, bone);
    if (i > 1 && i < 12) {
      shape.tube('sail-spine', [point(dx, y), point(dx, y + Math.sin((i - 1) / 11 * Math.PI) * 1.65)], 0.045, bone);
      activeGroup = 'ribs';
      const breadth = 0.4 + Math.sin((i - 1) / 11 * Math.PI) * 0.28;
      for (const side of [-1, 1]) {
        const rib: XYZ[] = [];
        for (let j = 0; j <= 12; j++) {
          const angle = j / 12 * Math.PI * 0.85;
          rib.push(point(dx + 0.08 * Math.sin(angle), y - 0.63 * (1 - Math.cos(angle)) / 2, side * Math.sin(angle) * breadth));
        }
        shape.tube('rib', rib, 0.045, bone);
      }
    }
  }
  activeGroup = 'spine-sail';
  shape.tube('spine', spine, 0.075, bone);
  activeGroup = 'skull';
  // Use the same long side profile and separate jaw as the recovered skull.
  for (const [i, facet] of FOSSIL_PROFILES.skull.entries()) {
    if (facet.tone === 'shade') continue;
    const outline: [number, number][] = facet.points.map(([px, py]) => [(px - 12) * 0.08, (py - 7) * 0.08]);
    const surfaces = facet.tone === 'recess' ? [-0.247, 0.241] : [-0.24];
    for (const side of surfaces) {
      const mesh = shape.facet(i === 0 ? 'skull' : 'skull-detail', outline, facet.tone === 'recess' ? 0.005 : 0.48,
        point(-2.4, 1.85, side), facet.tone === 'recess' ? dark : bone);
      mesh.rotation.x = Math.PI / 2;
    }
  }
  for (const side of [-1, 1]) {
    for (const hip of [-1.25, 0.72]) {
      activeGroup = hip < 0 ? 'front-legs' : 'hind-legs';
      const hind = hip > 0, knee = hip + (hind ? 0.28 : -0.23);
      const girdle = shape.facet(hind ? 'pelvis' : 'shoulder-blade', hind
        ? [[-0.25, -0.28], [0.2, -0.3], [0.3, 0.03], [0, 0.23], [-0.23, 0.1]]
        : [[-0.14, -0.48], [0.1, -0.48], [0.19, -0.15], [0.12, 0.12], [-0.1, 0.18], [-0.19, -0.13]],
        0.08, point(hip, 1.67, side * 0.24), bone);
      girdle.rotation.x = Math.PI / 2;
      shape.tube('upper-leg', [point(hip, 1.65, side * 0.3), point(knee, 1.3, side * 0.8)], hind ? 0.1 : 0.075, bone);
      shape.beveledBox('joint', [0.18, 0.13, 0.17], point(knee, 1.3, side * 0.8), bone);
      for (const offset of [-0.065, 0.065]) shape.tube('lower-leg',
        [point(knee + offset, 1.28, side * 0.82), point(hip - 0.15 + offset, 0.98, side * 1.07)], offset < 0 ? 0.042 : 0.031, bone);
      shape.beveledBox('wrist-ankle', [0.22, 0.08, 0.13], point(hip - 0.15, 0.98, side * 1.08), bone);
      for (let toe = 0; toe < 5; toe++) {
        shape.tube('toe', [point(hip - 0.24 + toe * 0.045, 0.96, side * 1.1),
          point(hip - 0.37 + toe * 0.105, 0.94, side * 1.23),
          point(hip - 0.45 + toe * 0.14, 0.92, side * (1.3 + Math.sin(toe / 4 * Math.PI) * 0.12))], 0.023, bone);
      }
    }
  }
  activeGroup = 'tail';
  for (let i = 0; i < 18; i++) {
    const dx = 1.23 + i * 0.106, y = 1.78 - i * 0.036;
    const width = 0.16 * (1 - i / 20);
    shape.beveledBox('tail-vertebra', [0.092, width, width], point(dx, y, i * 0.014), bone);
    shape.tube('tail', [point(dx, y, i * 0.014), point(dx + 0.11, y - 0.036, (i + 1) * 0.014)], width * 0.25, bone);
    if (i < 12) shape.tube('tail-process', [point(dx, y, i * 0.014 - width), point(dx, y + width * 0.4, i * 0.014), point(dx, y, i * 0.014 + width)], width * 0.2, bone);
  }
  activeGroup = 'spine-sail';
  for (const support of [-1.3, 0.7]) {
    shape.cylinder('mount', 0.8, 0.05, 0.05, point(support, 1.25), mount);
    shape.beveledBox('mount-foot', [0.45, 0.045, 0.38], point(support, 0.925), mount);
  }
  const update = (state: JourneyState) => {
    for (const [id, meshes] of Object.entries(groups)) for (const mesh of meshes) mesh.setEnabled(state.placed.includes(id));
  };
  return Object.assign(update, { groups });
}
