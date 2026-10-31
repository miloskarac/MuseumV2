import type { Material } from '@babylonjs/core/Materials/material';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Shapes, XYZ } from './shapes';
import { ERYOPS_GROUPS } from '../content/exhibit';
import type { JourneyState } from '../game/journey';

export const ERYOPS_ANCHORS: Record<string, XYZ> = {
  'eryops-skull': [-2.45, 1.75, -0.3], 'eryops-spine': [-0.3, 2.35, 0],
  'eryops-ribs': [-0.25, 1.55, -0.65], 'eryops-front-legs': [-1.2, 1, -1.2],
  'eryops-hind-legs': [0.9, 1, -1.2], 'eryops-tail': [2.5, 1.35, 0.12],
};

// Simplified mounted skeleton, guided by docs/references/museum/Eryops.png.
// Group ownership is shared by the museum display and assembly preview.
export function buildEryops(base: Shapes, bone: Material, dark: Material, mount: Material, x: number, z: number) {
  const groups: Record<string, Mesh[]> = Object.fromEntries(ERYOPS_GROUPS.map(part => [part.id, []]));
  let active = 'eryops-spine';
  const shape = Object.fromEntries(Object.entries(base).map(([key, build]) => [key, (...args: unknown[]) => {
    const mesh = (build as (...args: unknown[]) => Mesh)(...args);
    mesh.metadata = { ...mesh.metadata, fossilGroup: active };
    groups[active].push(mesh); return mesh;
  }])) as Shapes;
  const p = (dx: number, y: number, dz = 0): XYZ => [x + dx, y, z + dz];
  const spine: XYZ[] = [];
  for (let i = 0; i < 17; i++) {
    const dx = -1.55 + i * 0.165, y = 1.78 + Math.sin(i / 16 * Math.PI) * 0.25;
    active = 'eryops-spine'; spine.push(p(dx, y));
    shape.beveledBox('eryops-vertebra', [0.145, 0.22, 0.3], p(dx, y), bone);
    const process = shape.beveledBox('eryops-neural-spine', [0.105, 0.32, 0.09], p(dx + 0.025, y + 0.22), bone);
    process.rotation.z = -0.14;
    shape.tube('eryops-vertebra-wings', [p(dx, y - 0.02, -0.28), p(dx, y + 0.04), p(dx, y - 0.02, 0.28)], 0.055, bone);
    if (i > 1 && i < 14) {
      active = 'eryops-ribs';
      const breadth = 0.42 + Math.sin((i - 1) / 13 * Math.PI) * 0.37;
      for (const side of [-1, 1]) {
        const rib: XYZ[] = [];
        for (let j = 0; j <= 10; j++) {
          const angle = j / 10 * Math.PI * 0.65;
          rib.push(p(dx + 0.12 * Math.sin(angle), y - 0.72 * j / 10, side * Math.sin(angle) * breadth));
        }
        shape.tube('eryops-rib', rib, 0.055, bone);
      }
    }
  }
  active = 'eryops-spine'; shape.tube('eryops-spine', spine, 0.09, bone);
  for (const dx of [-1, 0.7]) shape.cylinder('eryops-support', 0.85, 0.045, 0.045, p(dx, 1.35), mount);

  active = 'eryops-skull';
  const skull: [number, number][] = [[-0.85, -0.3], [-0.58, -0.65], [0.45, -0.7], [0.75, -0.43],
    [0.75, 0.43], [0.45, 0.7], [-0.58, 0.65], [-0.85, 0.3]];
  shape.facet('eryops-jaw', skull.map(([a, b]) => [a * 0.98, b * 0.97]), 0.13, p(-2.35, 1.32), bone);
  shape.facet('eryops-mouth', skull.map(([a, b]) => [a * 0.96, b * 0.96]), 0.045, p(-2.35, 1.47), dark);
  shape.facet('eryops-skull', skull, 0.26, p(-2.35, 1.55), bone);
  for (const side of [-1, 1]) {
    shape.ball('eryops-eye-rim', [0.44, 0.14, 0.38], p(-1.98, 1.79, side * 0.43), bone);
    shape.ball('eryops-eye-socket', [0.28, 0.055, 0.24], p(-1.99, 1.87, side * 0.43), dark);
    shape.ball('eryops-nostril', [0.11, 0.035, 0.09], p(-2.98, 1.82, side * 0.24), dark);
    for (let i = 0; i < 9; i++) {
      const tooth = shape.cylinder('eryops-tooth', 0.09, 0.006, 0.045, p(-2.98 + i * 0.14, 1.49, side * (i < 2 ? 0.48 : 0.62)), bone);
      tooth.rotation.z = -0.1;
    }
  }

  for (const side of [-1, 1]) for (const hip of [-1.2, 0.85]) {
    const hind = hip > 0;
    active = hind ? 'eryops-hind-legs' : 'eryops-front-legs';
    const knee = hip + (hind ? 0.3 : -0.25), foot = hip - 0.22;
    const girdle = shape.beveledBox('eryops-girdle', [hind ? 0.48 : 0.3, 0.55, 0.14], p(hip, 1.58, side * 0.33), bone);
    girdle.rotation.x = side * 0.32;
    shape.tube('eryops-upper-limb', [p(hip, 1.65, side * 0.4), p(knee, 1.26, side * 0.94)], 0.11, bone);
    shape.ball('eryops-limb-joint', [0.24, 0.2, 0.21], p(knee, 1.26, side * 0.94), bone);
    for (const offset of [-0.075, 0.075]) shape.tube('eryops-lower-limb',
      [p(knee + offset, 1.24, side * 0.96), p(foot + offset, 0.99, side * 1.2)], 0.045, bone);
    shape.beveledBox('eryops-foot', [0.3, 0.1, 0.16], p(foot, 0.98, side * 1.22), bone);
    const digits = hind ? 5 : 4;
    for (let i = 0; i < digits; i++) {
      const spread = i - (digits - 1) / 2;
      shape.tube('eryops-digit', [p(foot + spread * 0.055, 0.97, side * 1.24),
        p(foot - 0.1 + spread * 0.12, 0.94, side * 1.4), p(foot - 0.16 + spread * 0.17, 0.93, side * (1.48 - Math.abs(spread) * 0.035))], 0.026, bone);
    }
  }
  active = 'eryops-tail';
  for (let i = 0; i < 23; i++) {
    const dx = 1.14 + i * 0.09, y = 1.78 - i * 0.031, breadth = 0.23 * (1 - i / 25);
    shape.beveledBox('eryops-tail-vertebra', [0.085, breadth, breadth], p(dx, y, i * 0.009), bone);
    shape.tube('eryops-tail-process', [p(dx, y, i * 0.009 - breadth), p(dx, y + breadth * 0.9, i * 0.009), p(dx, y, i * 0.009 + breadth)], 0.023, bone);
  }
  const update = (state: JourneyState) => {
    for (const [id, meshes] of Object.entries(groups)) for (const mesh of meshes) mesh.setEnabled(state.placed.includes(id));
  };
  return Object.assign(update, { groups });
}
