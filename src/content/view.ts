// Shared by rendering and screen-relative controls. Only excavation turns.
const turn = 8 * Math.PI / 180;
const original = { x: 12, y: 16, z: -16 };
const excavation = {
  x: original.x * Math.cos(turn) + original.z * Math.sin(turn),
  y: original.y,
  z: -original.x * Math.sin(turn) + original.z * Math.cos(turn),
};

export function cameraOffset(room: string) {
  return room === 'excavation' ? excavation : original;
}
