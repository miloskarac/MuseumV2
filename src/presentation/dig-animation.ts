import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SHOVEL_CONTACT, SHOVEL_SECONDS, SITE, activeSite, DEPTH_COLORS, soilColorIndex } from '../content/journey';
import { tileSurface, tileDepth } from '../game/journey';
import type { DigSwing, JourneyState } from '../game/journey';
import type { Shapes } from './shapes';

const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// A planted stance, hip lean and bent two-segment arms share the gameplay clock.
export function buildDigAnimation(scene: Scene, shape: Shapes, player: TransformNode,
  body: TransformNode, torso: TransformNode, restingArms: Mesh[], materials: Record<'wood' | 'metal' | 'shirt' | 'skin' | 'soil', StandardMaterial>) {
  const rig = new TransformNode('dig-rig', scene);
  rig.parent = body;
  const shovel = new TransformNode('dig-shovel', scene);
  shovel.parent = rig;
  const shaft = shape.cylinder('shovel-shaft', 1.12, 0.065, 0.065, [0, 0.58, 0], materials.wood);
  const blade = shape.beveledBox('shovel-blade', [0.38, 0.34, 0.075], [0, -0.08, 0], materials.metal);
  const grip = shape.tube('shovel-grip', [[-0.14, 1.16, 0], [0.14, 1.16, 0]], 0.04, materials.wood);
  for (const mesh of [shaft, blade, grip]) mesh.parent = shovel;
  const arms = [-1, 1].map(() => {
    const upper = shape.ball('dig-upper-arm', [0.19, 1, 0.2], [0, 0, 0], materials.shirt);
    const forearm = shape.ball('dig-forearm', [0.17, 1, 0.18], [0, 0, 0], materials.shirt);
    const hand = shape.ball('dig-hand', [0.18, 0.19, 0.18], [0, 0, 0], materials.skin);
    for (const mesh of [upper, forearm, hand]) mesh.parent = rig;
    return { upper, forearm, hand };
  });
  const clods = Array.from({ length: 5 }, () => {
    const mesh = shape.box('shovel-earth', [0.08, 0.07, 0.08], [0, 0, 0], materials.soil);
    mesh.parent = rig; return mesh;
  });
  function segment(mesh: Mesh, from: Vector3, to: Vector3) {
    const direction = to.subtract(from), length = direction.length(); direction.normalize();
    mesh.position.copyFrom(from.add(to).scale(0.5)); mesh.scaling.y = length;
    const axis = Vector3.Cross(Vector3.Up(), direction);
    mesh.rotationQuaternion = axis.lengthSquared() > 1e-8
      ? Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, direction.y)))) : Quaternion.Identity();
  }
  let previous: DigSwing | null = null, surface = 0, startYaw = 0, turn = 0;
  rig.setEnabled(false);
  return (swing: DigSwing | null, state?: JourneyState) => {
    rig.setEnabled(!!swing);
    restingArms.forEach(mesh => mesh.setEnabled(!swing));
    torso.rotation.x = 0;
    if (!swing) { previous = null; return; }
    const site = state ? activeSite(state) : SITE;
    const cell = site.cells.find(cell => cell.id === swing.cellId)!;
    const dx = cell.x - player.position.x, dz = cell.z - player.position.z;
    if (!previous || previous.cellId !== swing.cellId || previous.elapsed >= swing.elapsed) {
      surface = tileSurface(state?.dig[cell.id] ?? 0, site);
      const layer = tileDepth(state?.dig[cell.id] ?? 0, site.grid.levels).level;
      materials.soil.diffuseColor = Color3.FromHexString(DEPTH_COLORS[soilColorIndex(layer)]);
      startYaw = body.rotation.y;
      const target = Math.hypot(dx, dz) < 0.05 ? startYaw : Math.atan2(dx, dz);
      turn = Math.atan2(Math.sin(target - startYaw), Math.cos(target - startYaw));
    }
    previous = swing;
    const phase = Math.min(1, swing.elapsed / SHOVEL_SECONDS);
    body.rotation.y = startYaw + turn * ease(phase / 0.32);
    // Keep the handle in front of the chest. At a raised soil edge, tilt the
    // blade forward instead of lifting the grip through the face. On a lower
    // edge the guiding hand slides up the shaft to keep the arm within reach.
    const soilY = surface - player.position.y;
    const contactAngle = -Math.acos(Math.min(Math.cos(0.18), (1.3 - soilY - 0.25) / 1.16));
    const contactY = soilY + 0.25 * Math.cos(contactAngle) + 0.0375 * Math.abs(Math.sin(contactAngle));
    const contactZ = Math.max(0.78, 0.58 - Math.sin(contactAngle) * 1.16);
    const guideHeight = Math.min(1, Math.max(0.66,
      (0.35 - contactY) / Math.cos(contactAngle),
      1.16 - 0.27 / Math.max(0.001, -Math.sin(contactAngle))));
    // Ready -> small lift -> forward push -> withdraw. The same grip locations
    // drive the hands and the tool; matching end/start poses avoid a jump.
    const keyframes = [
      { time: 0, y: 0.27, z: 0.68, angle: -0.18, lean: 0, guide: 0.66 },
      { time: 0.4, y: 0.43, z: 0.7, angle: -0.18, lean: -0.025, guide: 0.66 },
      { time: SHOVEL_CONTACT, y: contactY, z: contactZ, angle: contactAngle, lean: 0.16, guide: guideHeight },
      { time: 1, y: 0.27, z: 0.68, angle: -0.18, lean: 0, guide: 0.66 },
    ];
    const end = keyframes.findIndex((frame, i) => i > 0 && phase <= frame.time);
    const a = keyframes[Math.max(1, end) - 1], b = keyframes[Math.max(1, end)];
    const t = ease((phase - a.time) / (b.time - a.time));
    const lean = mix(a.lean, b.lean, t);
    torso.rotation.x = lean;
    shovel.rotation.x = mix(a.angle, b.angle, t);
    const sin = Math.sin(shovel.rotation.x), cos = Math.cos(shovel.rotation.x);
    // Interpolate around the held grip, not the blade, so changing the tilt
    // cannot arc the handle back through the head between safe keyframes.
    shovel.position.set(0.2,
      mix(a.y + Math.cos(a.angle) * 1.16, b.y + Math.cos(b.angle) * 1.16, t) - cos * 1.16,
      mix(a.z + Math.sin(a.angle) * 1.16, b.z + Math.sin(b.angle) * 1.16, t) - sin * 1.16);
    arms.forEach(({ upper, forearm, hand }, i) => {
      const height = i ? mix(a.guide, b.guide, t) : 1.16;
      const target = new Vector3(shovel.position.x - (i ? 0 : 0.1), shovel.position.y + cos * height, shovel.position.z + sin * height);
      const shoulder = new Vector3(i ? 0.32 : -0.32, 0.65 + Math.cos(lean) * 0.37, Math.sin(lean) * 0.37);
      const direction = target.subtract(shoulder), length = direction.length();
      direction.normalize();
      const outward = new Vector3(i ? 1 : -1, -1, 0.15);
      const bend = outward.subtract(direction.scale(Vector3.Dot(outward, direction))).normalize();
      const elbow = shoulder.add(target).scale(0.5).add(bend.scale(Math.sqrt(Math.max(0.01, 0.46 ** 2 - (length / 2) ** 2))));
      segment(upper, shoulder, elbow); segment(forearm, elbow, target); hand.position.copyFrom(target);
    });
    const impact = (phase - SHOVEL_CONTACT) / (1 - SHOVEL_CONTACT);
    clods.forEach((mesh, i) => {
      mesh.setEnabled(impact >= 0 && impact < 1);
      mesh.position.set(shovel.position.x + (i - 2) * 0.12 * impact, surface - player.position.y + 0.08 + Math.sin(impact * Math.PI) * 0.25,
        keyframes[2].z + (i % 2 ? 1 : -1) * impact * 0.14);
      mesh.rotation.set(impact * i, 0, impact);
    });
  };
}
