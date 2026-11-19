// Physical Room 1 locations. Ownership and schema determine live availability.
export const EARLY_PERMIAN_FLOOR = { x: -4.5, z: 0, width: 25, depth: 12 } as const;
export const EARLY_PERMIAN_STANDS = [
  { id: 'dimetrodon', size: 'large', active: true, x: -1.2, z: 0.5, width: 7.2, depth: 3.5 },
  { id: 'trilobite', size: 'small', active: true, x: 2.7, z: 4.5, width: 2.2, depth: 1.8 },
  { id: 'eryops', size: 'large', active: true, x: -11, z: 0.5, width: 7.2, depth: 3.5 },
  { id: 'walchia', size: 'small', active: true, x: -11, z: 4.5, width: 2.2, depth: 1.8 },
] as const;
// Closed recess in the existing far wall, with no traversable floor beyond it.
export const FUTURE_ROOM_DOOR = { x: -15.5, z: 5.84, width: 1.8 } as const;
