import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Shapes } from './shapes';
import type { VisitorPose } from '../game/visitor-simulation';
import { CASHIER, CASHIER_STATION, CASH_PILE, ENTRANCE_POSTS, VISITOR_ENTRANCE, VISITOR_CAPACITIES, queuePoint } from '../content/visitors';

export function buildCashier(shape: Shapes, material: (name: string, hex: string) => StandardMaterial) {
  const teal = material('cashier-teal', '#428e94'), wood = material('cashier-wood', '#bd8753');
  const cream = material('cashier-ticket', '#fff2c8');
  shape.beveledBox('cashier-desk', [CASHIER.width, 0.85, CASHIER.depth], [CASHIER.x, 0.45, CASHIER.z], teal);
  shape.beveledBox('cashier-top', [CASHIER.width + 0.05, 0.12, CASHIER.depth + 0.05], [CASHIER.x, 0.94, CASHIER.z], wood);
  shape.box('ticket-stack', [0.45, 0.11, 0.28], [CASHIER.x - 0.4, 1.06, CASHIER.z], cream);
  shape.beveledBox('ticket-register', [0.43, 0.29, 0.38], [CASHIER.x + 0.38, 1.14, CASHIER.z], teal);
  shape.box('ticket-register-screen', [0.32, 0.13, 0.025], [CASHIER.x + 0.38, 1.18, CASHIER.z + 0.2], cream);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= 40; i++) points.push([CASHIER_STATION.x + Math.cos(i * Math.PI / 20) * CASHIER_STATION.radius,
    0.07, CASHIER_STATION.z + Math.sin(i * Math.PI / 20) * CASHIER_STATION.radius]);
  shape.tube('cashier-circle', points, 0.045, teal);
  // Open front doorway: the lintel stays above visitor heads and the queue stays visible.
  const stone = material('entrance-stone', '#e9e7cf');
  const paper = material('ticket-banknote', '#83ca84'), ink = material('ticket-banknote-ink', '#26774e');
  for (const post of ENTRANCE_POSTS) {
    shape.beveledBox('entrance-post', [post.width, 2.25, post.depth], [post.x, 1.12, post.z], wood);
    shape.beveledBox('entrance-foot', [post.width, 0.28, post.depth], [post.x, 0.14, post.z], stone);
  }
  shape.beveledBox('entrance-lintel', [VISITOR_ENTRANCE.width + 0.5, 0.32, 0.34],
    [VISITOR_ENTRANCE.x, 2.36, VISITOR_ENTRANCE.z], wood);
  shape.beveledBox('entrance-threshold', [VISITOR_ENTRANCE.width, 0.14, 0.75],
    [VISITOR_ENTRANCE.x, -0.01, VISITOR_ENTRANCE.z], stone);
  shape.box('entrance-mat', [1.85, 0.025, 0.95], [VISITOR_ENTRANCE.x, 0.058, -5.4], teal);
  shape.tube('entrance-arrow', [[VISITOR_ENTRANCE.x - 0.2, 0.085, -5.4],
    [VISITOR_ENTRANCE.x, 0.085, -5.15], [VISITOR_ENTRANCE.x + 0.2, 0.085, -5.4]], 0.035, cream);
  for (let i = 0; i < VISITOR_CAPACITIES[1].waiting; i++) {
    const point = queuePoint(i);
    shape.box('queue-mark', [0.58, 0.025, 0.1], [point.x, 0.06, point.z - 0.32], wood);
  }
  shape.beveledBox('cash-pile-tray', [CASH_PILE.width, 0.22, CASH_PILE.depth], [CASH_PILE.x, 0.14, CASH_PILE.z], teal);
  shape.beveledBox('cash-pile-tray-top', [0.82, 0.05, 0.82], [CASH_PILE.x, 0.27, CASH_PILE.z], wood);
  const pickupRing = shape.tube('cash-pickup-radius', Array.from({ length: 49 }, (_, i): [number, number, number] =>
    [CASH_PILE.x + Math.cos(i * Math.PI / 24) * CASH_PILE.pickupRadius, 0.065,
      CASH_PILE.z + Math.sin(i * Math.PI / 24) * CASH_PILE.pickupRadius]), 0.035, ink);
  pickupRing.setEnabled(false);
  // Reuse a fixed mesh pool; the saved amount, not the pile height, is authoritative.
  const notes = Array.from({ length: CASH_PILE.maxNotes }, (_, i) => {
    const x = CASH_PILE.x + (i % 2 ? 0.035 : -0.035), y = 0.32 + i * 0.035;
    const note = shape.box('ticket-banknote', [0.78, 0.025, 0.42], [x, y, CASH_PILE.z], paper);
    const mark = shape.box('ticket-banknote-mark', [0.18, 0.004, 0.29], [x, y + 0.015, CASH_PILE.z], ink);
    const stripe = shape.box('ticket-banknote-stripe', [0.04, 0.004, 0.29], [x - 0.27, y + 0.015, CASH_PILE.z], cream);
    for (const mesh of [note, mark, stripe]) { mesh.isPickable = false; mesh.setEnabled(false); }
    return [note, mark, stripe];
  });
  let shown = 0;
  return (income: number) => {
    const count = Math.min(CASH_PILE.maxNotes, income);
    if (count === shown) return;
    notes.forEach((meshes, i) => meshes.forEach(mesh => mesh.setEnabled(i < count)));
    pickupRing.setEnabled(count > 0);
    shown = count;
  };
}
export function buildVisitors(scene: Scene, shape: Shapes, material: (name: string, hex: string) => StandardMaterial) {
  const skin = ['#e7b789', '#b77d54', '#edc79e'].map((hex, i) => material(`visitor-skin-${i}`, hex));
  const shirts = ['#619cab', '#ca7770', '#987eb0', '#88a76d'].map((hex, i) => material(`visitor-shirt-${i}`, hex));
  const trousers = material('visitor-trousers', '#475c66'), hair = material('visitor-hair', '#624d40');
  const actors = new Map<number, { root: TransformNode; legs: TransformNode[]; time: number }>();
  return (poses: VisitorPose[], seconds: number) => {
    for (const [id, actor] of actors) if (!poses.some(p => p.id === id)) { actor.root.dispose(); actors.delete(id); }
    for (const pose of poses) {
      let actor = actors.get(pose.id);
      if (!actor) {
        const root = new TransformNode(`visitor-${pose.id}`, scene), shirt = shirts[pose.id % shirts.length], face = skin[pose.id % skin.length];
        const body = shape.ball('visitor-body', [0.48, 0.56, 0.32], [0, 0.72, 0], shirt); body.parent = root;
        const head = shape.ball('visitor-head', [0.39, 0.43, 0.39], [0, 1.18, 0], face); head.parent = root;
        const cap = shape.ball('visitor-hair', [0.41, 0.18, 0.4], [0, 1.36, -0.02], hair); cap.parent = root;
        const legs: TransformNode[] = [];
        for (const side of [-1, 1]) {
          const arm = shape.ball('visitor-arm', [0.16, 0.4, 0.18], [side * 0.28, 0.69, 0], shirt); arm.parent = root;
          const leg = new TransformNode('visitor-leg', scene); leg.parent = root; leg.position.set(side * 0.13, 0.43, 0);
          const mesh = shape.box('visitor-shoe', [0.2, 0.36, 0.25], [0, -0.18, 0], trousers); mesh.parent = leg; legs.push(leg);
        }
        actor = { root, legs, time: 0 }; actors.set(pose.id, actor);
      }
      if (pose.moving) actor.time += seconds * 9;
      actor.root.position.set(pose.x, pose.moving ? Math.abs(Math.sin(actor.time)) * 0.025 : 0, pose.z);
      actor.root.rotation.y = Math.atan2(pose.direction.x, pose.direction.z);
      actor.legs.forEach((leg, i) => leg.rotation.x = pose.moving ? Math.sin(actor.time + i * Math.PI) * 0.35 : 0);
    }
  };
}
