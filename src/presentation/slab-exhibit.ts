import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Shapes } from './shapes';
import { FOSSIL_PROFILES } from './fossil-profiles';
import { exhibitDefinition } from '../content/exhibit';
import { SLAB_EXHIBIT, WALCHIA_STAND, EXHIBIT_SPOTS, EXHIBIT_MARKER_RADIUS } from '../game/navigation';
import { exhibitComplete } from '../game/assembly';
import type { JourneyState } from '../game/journey';

export function buildSlabExhibit(scene: Scene, shape: Shapes, material: (name: string, hex: string) => StandardMaterial, id: 'trilobite' | 'walchia' = 'trilobite') {
  const { x, z, width, depth } = id === 'walchia' ? WALCHIA_STAND : SLAB_EXHIBIT;
  const exhibit = exhibitDefinition(id), part = id === 'walchia' ? 'walchia-whole' : 'trilobite-whole';
  const scale = id === 'walchia' ? 0.075 : 0.12;
  const teal = material('slab-stand-teal', '#379c94'), rim = material('slab-stand-rim', '#e9e7cf');
  const stone = material('slab-stone', '#b09b78'), shell = material('slab-shell', '#e4cf9e');
  const shade = material('slab-shade', '#ac8e5c'), recess = material('slab-recess', '#635638');
  shape.beveledBox('slab-stand', [width, 0.65, depth], [x, 0.35, z], teal);
  shape.beveledBox('slab-stand-top', [width + 0.1, 0.14, depth + 0.1], [x, 0.75, z], rim);
  const slab = shape.beveledBox('whole-fossil-slab', [1.75, 0.14, 1.65], [x, 0.89, z], stone);
  const pieces = FOSSIL_PROFILES[part].map((facet, i) => shape.facet(`${id}-slab-fossil-${i}`,
    facet.points.map(([px, py]) => [(px - 12) * scale, (py - 7) * scale]),
    0.025, [x, 0.98 + i * 0.001, z], { bone: shell, shade, recess }[facet.tone]));
  const labelTexture = new DynamicTexture('slab-name-texture', { width: 512, height: 128 }, scene, true);
  labelTexture.drawText(exhibit.text.name, null, 94, 'bold 90px "Segoe UI", sans-serif', '#294d47', '#fff9e9', true);
  const ink = material('slab-name-ink', '#ffffff'); ink.diffuseTexture = labelTexture;
  ink.disableLighting = true; ink.emissiveColor = Color3.White();
  shape.box('slab-name-plate', [1.7, 0.33, 0.06], [x, 0.44, z - depth / 2 - 0.03], rim);
  const label = MeshBuilder.CreatePlane('slab-name', { width: 1.6, height: 0.29 }, scene);
  label.position.set(x, 0.44, z - depth / 2 - 0.065); label.material = ink; label.isPickable = false;
  const marker = EXHIBIT_SPOTS.find(spot => spot.id === id)!;
  const ringMaterial = material('slab-marker', '#328ed1');
  const ring = MeshBuilder.CreateTorus('slab-ring', { diameter: EXHIBIT_MARKER_RADIUS * 2, thickness: 0.09, tessellation: 64 }, scene);
  ring.position.set(marker.x, 0.075, marker.z); ring.material = ringMaterial; ring.isPickable = false;
  return (state: JourneyState) => {
    const complete = exhibitComplete(state, id);
    for (const mesh of [slab, ...pieces, label]) mesh.setEnabled(complete);
    ringMaterial.diffuseColor = Color3.FromHexString(complete ? '#449b80' : '#328ed1');
    ringMaterial.emissiveColor = ringMaterial.diffuseColor.scale(0.22);
  };
}
