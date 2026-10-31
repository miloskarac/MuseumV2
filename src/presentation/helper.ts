import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Shapes } from './shapes';
import type { HelperPose } from '../game/helper-simulation';
import type { JourneyState } from '../game/journey';
import { groundHeight } from '../game/journey';
import { buildDigAnimation } from './dig-animation';
export function buildHelper(scene: Scene, shape: Shapes, material: (name: string, hex: string) => StandardMaterial) {
  const root = new TransformNode('digging-helper', scene), body = new TransformNode('helper-body', scene); body.parent = root;
  const skin = material('helper-skin', '#dca676'), shirt = material('helper-shirt', '#6a9ca3'), hat = material('helper-hat', '#f0d587');
  const dark = material('helper-trousers', '#485c68'), wood = material('helper-wood', '#a17950');
  const torso = new TransformNode('helper-torso', scene); torso.parent = body; torso.position.y = 0.65;
  const meshes = [shape.ball('helper-jacket', [0.55, 0.62, 0.39], [0, 0.17, 0], shirt),
    shape.ball('helper-head', [0.43, 0.46, 0.43], [0, 0.69, 0], skin),
    shape.cylinder('helper-brim', 0.075, 0.66, 0.66, [0, 0.89, 0], hat),
    shape.cylinder('helper-crown', 0.2, 0.43, 0.36, [0, 1.01, 0], hat)];
  meshes.forEach(m => m.parent = torso);
  const arms = [-1, 1].map(side => { const arm = shape.ball('helper-arm', [0.19, 0.48, 0.22], [side * 0.32, 0.15, 0], shirt); arm.parent = torso; return arm; });
  const legs = [-1, 1].map(side => {
    const leg = new TransformNode('helper-leg', scene); leg.parent = body; leg.position.set(side * 0.15, 0.47, 0);
    const shin = shape.ball('helper-shin', [0.22, 0.4, 0.24], [0, -0.15, 0], dark); shin.parent = leg;
    const shoe = shape.ball('helper-shoe', [0.23, 0.16, 0.34], [0, -0.36, 0.06], dark); shoe.parent = leg; return leg;
  });
  const animate = buildDigAnimation(scene, shape, root, body, torso, arms,
    { skin, shirt, wood, metal: material('helper-steel', '#82a6a9'), soil: material('helper-earth', '#dec091') });
  const parcel = new TransformNode('helper-fossil-parcel', scene); parcel.parent = body;
  const tray = shape.beveledBox('helper-tray', [0.65, 0.15, 0.45], [0, 0.78, 0.43], wood); tray.parent = parcel;
  const bone = material('helper-carried-bone', '#fff1ce');
  const shaft = shape.box('carried-fossil', [0.36, 0.1, 0.1], [0, 0.91, 0.43], bone); shaft.parent = parcel;
  for (const x of [-0.19, 0.19]) { const end = shape.ball('carried-bone-end', [0.16, 0.14, 0.21], [x, 0.91, 0.43], bone); end.parent = parcel; }
  let time = 0; root.setEnabled(false);
  return (pose: HelperPose | null, state: JourneyState, seconds: number) => {
    root.setEnabled(!!pose); if (!pose) return;
    if (pose.moving) time += seconds * 9;
    root.position.set(pose.x, groundHeight(state, pose), pose.z);
    if (!pose.swing) body.rotation.y = Math.atan2(pose.direction.x, pose.direction.z);
    body.position.y = pose.moving ? Math.abs(Math.sin(time)) * 0.025 : 0;
    legs.forEach((leg, i) => leg.rotation.x = pose.moving ? Math.sin(time + i * Math.PI) * 0.35 : 0);
    animate(pose.swing, state);
    parcel.setEnabled(!!pose.carrying);
    if (pose.pickup) { body.position.y -= pose.pickup * 0.15; torso.rotation.x = pose.pickup * 0.25; }
    if (pose.carrying) arms.forEach(arm => { arm.rotation.x = -0.8; });
    else arms.forEach(arm => { arm.rotation.x = 0; });
  };
}
