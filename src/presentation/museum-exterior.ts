import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Shapes } from './shapes';
import { VISITOR_ENTRANCE } from '../content/visitors';

// Static frontage. Visitor service, player bounds and saved progression stay indoors.
export function buildMuseumExterior(shape: Shapes, material: (name: string, hex: string) => StandardMaterial,
  floor: { x: number; width: number }) {
  const paving = material('plaza-stone', '#d6d2bf'), joint = material('plaza-joint', '#b4b7a6');
  const curb = material('street-curb', '#f2ead4'), road = material('street-asphalt', '#74848b');
  const white = material('street-paint', '#fff2d2'), teal = material('bus-stop-teal', '#367f85');
  const wood = material('plaza-wood', '#c89561'), grass = material('plaza-grass', '#a2bd7b');
  const leaves = material('plaza-leaves', '#78a66a'), trunk = material('plaza-trunk', '#a17d56');
  const tire = material('vehicle-tire', '#46545b'), glass = material('vehicle-glass', '#a9d8dc');
  const cream = material('vehicle-cream', '#fff1ca'), yellow = material('bus-yellow', '#e7b84f');
  const blue = material('parking-blue', '#488ba9');
  const left = floor.x - floor.width / 2, right = floor.x + floor.width / 2;

  shape.box('floor-plaza-base', [floor.width + 0.3, 0.26, 3.7], [floor.x, -0.22, -7.95], joint);
  for (let column = 0; column < floor.width; column++) for (let row = 0; row < 3; row++) {
    shape.box('floor-plaza-paver', [0.98, 0.06, 1.18], [left + column + 0.5, -0.06, -6.75 - row * 1.2], paving);
  }
  shape.box('floor-street', [floor.width + 0.3, 0.16, 3.4], [floor.x, -0.28, -11.45], road);
  shape.box('floor-far-sidewalk', [floor.width + 0.3, 0.2, 0.75], [floor.x, -0.21, -13.5], paving);
  for (const z of [-9.78, -13.1]) {
    // Leave a lowered crossing directly in front of the museum door.
    for (const [a, b] of [[left, VISITOR_ENTRANCE.x - 1], [VISITOR_ENTRANCE.x + 1, right]])
      shape.beveledBox('street-curb', [b - a, 0.18, 0.18], [(a + b) / 2, -0.09, z], curb);
  }
  for (let x = left + 0.8; x < right - 0.4; x += 2.2) {
    if (Math.abs(x - VISITOR_ENTRANCE.x) < 1.8) continue;
    shape.box('street-center-line', [1.1, 0.015, 0.08], [x, -0.19, -11.55], white);
  }
  for (let i = 0; i < 7; i++) shape.box('street-crossing', [1.6, 0.018, 0.25],
    [VISITOR_ENTRANCE.x, -0.185, -10.05 - i * 0.46], white);
  // A clear stone approach connects the crossing to the entrance threshold.
  shape.box('plaza-entrance-path', [1.9, 0.035, 3.65], [VISITOR_ENTRANCE.x, -0.015, -7.95], curb);

  // Three parking spaces, two occupied, kept away from the entrance approach.
  shape.box('floor-parking', [5.9, 0.04, 3.15], [-4.75, -0.005, -8.05], road);
  for (let i = 0; i < 4; i++) shape.box('parking-line', [0.06, 0.018, 2.9], [-7.6 + i * 1.9, 0.025, -8.05], white);
  shape.box('parking-end-line', [5.7, 0.018, 0.06], [-4.75, 0.025, -6.6], white);
  function wheel(x: number, y: number, z: number, acrossX: boolean) {
    const mesh = shape.cylinder('vehicle-wheel', 0.16, 0.43, 0.43, [x, y, z], tire);
    if (acrossX) mesh.rotation.z = Math.PI / 2; else mesh.rotation.x = Math.PI / 2;
  }
  for (const [index, x] of [-6.65, -2.85].entries()) {
    const paint = material(`parked-car-${index}`, index ? '#cd7966' : '#5f9ca0');
    shape.beveledBox('parked-car-body', [1.05, 0.42, 2.1], [x, 0.44, -8.0], paint);
    shape.beveledBox('parked-car-cabin', [0.86, 0.46, 1.06], [x, 0.85, -7.95], glass);
    shape.beveledBox('parked-car-roof', [0.89, 0.09, 0.7], [x, 1.12, -7.95], paint);
    for (const side of [-1, 1]) {
      for (const z of [-8.67, -7.33]) wheel(x + side * 0.52, 0.27, z, true);
      shape.box('car-headlight', [0.23, 0.13, 0.025], [x + side * 0.32, 0.5, -9.06], cream);
    }
  }
  shape.box('parking-sign-pole', [0.08, 1.5, 0.08], [-7.5, 0.73, -6.45], teal);
  shape.beveledBox('parking-sign', [0.65, 0.65, 0.09], [-7.5, 1.52, -6.45], blue);
  // Cyrillic П for parking, constructed as a large simple sign rather than tiny text.
  for (const x of [-7.66, -7.34]) shape.box('parking-sign-letter', [0.07, 0.37, 0.025], [x, 1.51, -6.505], white);
  shape.box('parking-sign-letter', [0.39, 0.07, 0.025], [-7.5, 1.69, -6.505], white);

  // Open-sided bus shelter with a bench and a readable bus pictogram.
  for (const x of [-0.9, 1.3]) for (const z of [-7.35, -8.55])
    shape.box('bus-stop-post', [0.08, 1.8, 0.08], [x, 0.84, z], teal);
  shape.beveledBox('bus-stop-roof', [2.6, 0.18, 1.65], [0.2, 1.82, -7.95], teal);
  shape.box('bus-stop-back', [2.15, 0.65, 0.06], [0.2, 0.66, -7.35], glass);
  shape.beveledBox('bus-stop-bench', [1.8, 0.12, 0.4], [0.2, 0.42, -7.7], wood);
  for (const x of [-0.45, 0.85]) shape.box('bus-stop-bench-leg', [0.12, 0.43, 0.3], [x, 0.17, -7.7], teal);
  shape.box('bus-stop-sign-pole', [0.08, 1.9, 0.08], [1.65, 0.89, -9.2], teal);
  shape.beveledBox('bus-stop-sign', [0.68, 0.73, 0.1], [1.65, 1.85, -9.2], blue);
  shape.beveledBox('bus-stop-symbol', [0.44, 0.45, 0.025], [1.65, 1.88, -9.26], white);
  shape.box('bus-stop-symbol-window', [0.31, 0.18, 0.025], [1.65, 1.97, -9.28], blue);
  for (const x of [1.51, 1.79]) shape.box('bus-stop-symbol-wheel', [0.09, 0.12, 0.03], [x, 1.63, -9.26], white);

  // A parked toy-like bus supplies an immediately recognizable bus stop silhouette.
  shape.beveledBox('bus-body', [3.7, 1.05, 1.2], [-0.25, 0.61, -10.55], yellow);
  shape.beveledBox('bus-roof', [3.65, 0.13, 1.23], [-0.25, 1.2, -10.55], cream);
  for (const side of [-1, 1]) {
    for (const x of [-1.55, -0.75, 0.05, 0.85])
      shape.box('bus-window', [0.64, 0.45, 0.025], [x, 0.9, -10.55 + side * 0.61], glass);
    shape.box('bus-stripe', [3.55, 0.12, 0.025], [-0.25, 0.42, -10.55 + side * 0.61], cream);
    for (const x of [-1.4, 0.9]) wheel(x, 0.18, -10.55 + side * 0.59, false);
  }
  shape.box('bus-windshield', [0.025, 0.46, 0.92], [1.61, 0.9, -10.55], glass);
  for (const z of [-10.94, -10.16]) shape.box('bus-headlight', [0.03, 0.15, 0.2], [1.62, 0.38, z], cream);

  // Low planted beds frame the plaza without hiding the entrance or cashier.
  for (const x of [6.8, ...(floor.width > 16 ? [left + 2, left + 6] : [])]) {
    shape.beveledBox('plaza-planter', [1.7, 0.28, 1.25], [x, 0.05, -7.2], curb);
    shape.box('plaza-planter-grass', [1.5, 0.04, 1.05], [x, 0.21, -7.2], grass);
    shape.cylinder('plaza-tree-trunk', 0.7, 0.17, 0.12, [x, 0.52, -7.2], trunk);
    shape.beveledBox('plaza-tree-crown', [0.95, 0.9, 0.95], [x, 1.15, -7.2], leaves);
    shape.beveledBox('plaza-tree-top', [0.65, 0.55, 0.65], [x + 0.08, 1.7, -7.2], grass);
  }
}
