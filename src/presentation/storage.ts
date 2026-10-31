import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Shapes } from './shapes';
import type { JourneyState } from '../game/journey';
import { storageAnchor, storageApproach } from '../content/storage';
export function buildStorageBox(shape: Shapes, material: (name: string, hex: string) => StandardMaterial, state: JourneyState) {
  const p = storageAnchor(state), approach = storageApproach(state);
  const wood = material('storage-wood', '#ad794b'), lid = material('storage-lid', '#d3a05f'), bone = material('storage-bone', '#fff0c9');
  const teal = material('storage-teal', '#438f91');
  shape.beveledBox('fossil-storage-box', [1.1, 0.65, 0.68], [p.x, 0.35, p.z], wood);
  shape.beveledBox('storage-lid', [1.16, 0.12, 0.74], [p.x, 0.73, p.z], lid);
  shape.box('storage-band', [0.13, 0.66, 0.7], [p.x - 0.38, 0.36, p.z], teal);
  shape.box('storage-band', [0.13, 0.66, 0.7], [p.x + 0.38, 0.36, p.z], teal);
  shape.box('box-bone', [0.34, 0.1, 0.04], [p.x, 0.42, p.z - 0.36], bone);
  for (const side of [-1, 1]) shape.ball('box-bone-end', [0.14, 0.17, 0.06], [p.x + side * 0.18, 0.42, p.z - 0.37], bone);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= 32; i++) points.push([approach.x + Math.cos(i * Math.PI / 16) * 0.5, 0.04, approach.z + Math.sin(i * Math.PI / 16) * 0.5]);
  shape.tube('storage-circle', points, 0.04, teal);
}
