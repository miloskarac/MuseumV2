import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Shapes } from './shapes';
import { SKELETONS } from './skeletons';
import type { SkeletonId } from './skeletons';
import { exhibitDefinition } from '../content/exhibit';
import { exhibitComplete } from '../game/assembly';
import { EXHIBIT_SPOTS, EXHIBIT_MARKER_RADIUS } from '../game/navigation';
import type { JourneyState } from '../game/journey';

export function buildAssembledExhibit(scene: Scene, shape: Shapes, material: (name: string, hex: string, sheen?: number) => StandardMaterial,
  stand: { id: SkeletonId; x: number; z: number; width: number; depth: number }) {
  const id = stand.id, exhibit = exhibitDefinition(id), marker = EXHIBIT_SPOTS.find(spot => spot.id === id)!;
  const tealDark = material(`${id}-base`, '#286c67'), teal = material(`${id}-teal`, '#379c94');
  const brass = material(`${id}-brass`, '#d4ad64'), rim = material(`${id}-rim`, '#e9e7cf');
  const bed = material(`${id}-bed`, '#929b80'), cream = material(`${id}-cream`, '#fff9e9');
  const bone = material(`${id}-bone`, '#f5edd5'), dark = material(`${id}-dark`, '#515e55');
  const mount = material(`${id}-mount`, '#516d68');
  const { x, z, width, depth } = stand;
  shape.beveledBox('platform-foot', [width, 0.16, depth], [x, 0.13, z], tealDark);
  shape.beveledBox('platform-body', [width - 0.2, 0.48, depth - 0.2], [x, 0.44, z], teal);
  shape.beveledBox('platform-brass', [width, 0.065, depth], [x, 0.71, z], brass);
  shape.beveledBox('platform-top', [width - 0.12, 0.18, depth - 0.12], [x, 0.805, z], rim);
  shape.beveledBox('fossil-backing', [width - 0.56, 0.025, depth - 0.56], [x, 0.9, z], bed);
  for (const side of [-1, 1]) {
    // Recessed panels stay on the existing plinth faces, inside its collision footprint.
    shape.box('platform-face-inset', [width - 0.65, 0.23, 0.025], [x, 0.43, z + side * (depth / 2 - 0.095)], tealDark);
    for (const dx of [-width / 2 + 0.5, width / 2 - 0.5]) {
      shape.box('platform-face-accent', [0.045, 0.24, 0.035], [x + dx, 0.43, z + side * (depth / 2 - 0.09)], brass);
    }
  }
  const updateExhibit = SKELETONS[id].build(shape, bone, dark, mount, x, z);
  const exhibitMarkerMaterial = material('exhibit-marker', '#328ed1');
  const exhibitRing = MeshBuilder.CreateTorus(id === 'dimetrodon' ? 'exhibit-ring' : `${id}-ring`, { diameter: EXHIBIT_MARKER_RADIUS * 2, thickness: 0.09, tessellation: 64 }, scene);
  exhibitRing.position.set(marker.x, 0.075, marker.z);
  exhibitRing.material = exhibitMarkerMaterial;
  exhibitRing.isPickable = false;
  // The name is printed on the front of the physical plate, not a floating label.
  shape.box('plaque-brass', [2.8, 0.4, 0.06], [x, 0.48, z - depth / 2 - 0.035], brass);
  shape.box('plaque-face', [2.66, 0.3, 0.07], [x, 0.48, z - depth / 2 - 0.07], cream);
  const nameTexture = new DynamicTexture('exhibit-name-texture', { width: 1024, height: 128 }, scene, true);
  nameTexture.drawText(exhibit.text.name, null, 98, 'bold 112px "Segoe UI", sans-serif', '#294d47', '#fff9e9', true);
  const nameMaterial = material('exhibit-name-ink', '#ffffff', 0);
  nameMaterial.diffuseTexture = nameTexture;
  nameMaterial.emissiveColor = Color3.White();
  nameMaterial.disableLighting = true;
  const namePlate = MeshBuilder.CreatePlane(id === 'dimetrodon' ? 'exhibit-name' : `${id}-name`, { width: 2.6, height: 0.28 }, scene);
  namePlate.position.set(x, 0.48, z - depth / 2 - 0.108);
  namePlate.material = nameMaterial;
  namePlate.isPickable = false;
  namePlate.setEnabled(false);
  return (state: JourneyState) => {
    updateExhibit(state);
    const color = exhibitComplete(state, id) ? '#449b80' : exhibit.parts.some(part => state.placed.includes(part)) ? '#e4b52b' : '#328ed1';
    exhibitMarkerMaterial.diffuseColor = Color3.FromHexString(color);
    exhibitMarkerMaterial.emissiveColor = exhibitMarkerMaterial.diffuseColor.scale(0.22);
    namePlate.setEnabled(exhibitComplete(state, id));
  };

}
