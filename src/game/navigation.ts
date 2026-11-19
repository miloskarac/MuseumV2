import { SITE, SITE_PLOTS } from '../content/journey.ts';
import { cameraOffset } from '../content/view.ts';
import { EARLY_PERMIAN_FLOOR, EARLY_PERMIAN_STANDS } from '../content/early-permian-layout.ts';
export type Point = { x: number; z: number };
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type RoomId = 'museum' | 'outdoors' | 'excavation';

export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 3.4;

export const EXHIBIT = EARLY_PERMIAN_STANDS[0];
export const ERYOPS_EXHIBIT = EARLY_PERMIAN_STANDS[2];
export const ASSEMBLED_STANDS = [EXHIBIT, ERYOPS_EXHIBIT] as const;
export const MUSEUM_FLOOR = EARLY_PERMIAN_FLOOR;
export const EXHIBIT_MARKER = { x: EXHIBIT.x, z: EXHIBIT.z - EXHIBIT.depth / 2 - 1.2 };
export const EXHIBIT_MARKER_RADIUS = 0.85;
export const SLAB_EXHIBIT = EARLY_PERMIAN_STANDS[1];
export const WALCHIA_STAND = EARLY_PERMIAN_STANDS[3];
export const EXHIBIT_SPOTS = [
  { id: 'dimetrodon', ...EXHIBIT_MARKER, buttonId: 'exhibit-button' },
  { id: 'trilobite', x: SLAB_EXHIBIT.x - SLAB_EXHIBIT.width / 2 - 1.05, z: SLAB_EXHIBIT.z, buttonId: 'exhibit-trilobite' },
  { id: 'eryops', x: ERYOPS_EXHIBIT.x, z: ERYOPS_EXHIBIT.z - ERYOPS_EXHIBIT.depth / 2 - 1.2, buttonId: 'exhibit-eryops' },
  { id: 'walchia', x: -11 - 2.2 / 2 - 1.05, z: 4.5, buttonId: 'exhibit-walchia' },
] as const;
export const BENCH = { x: -5.8, z: -3.8, width: 2.3, depth: 0.8 };
export const PLANTS: Point[] = [{ x: -6.6, z: 4.5 }, { x: 6.5, z: -4.5 }];
export const PIT = { x: SITE.grid.x, z: SITE.grid.z, width: SITE.grid.columns * SITE.grid.tileSize, depth: SITE.grid.rows * SITE.grid.tileSize };
export const PORTAL: Point = { x: 5.4, z: 3.7 };
export const PORTAL_RADIUS = 0.85;
export const ARRIVAL: Point = { x: 5.4, z: 1.6 };
// Keep the initial explorer visible above the new foreground entrance.
export const START: Point = { x: 2.5, z: -2.4 };
export const ROOM_BOUNDS: Bounds = { minX: -7.7, maxX: 7.7, minZ: -5.7, maxZ: 5.7 };
export const MUSEUM_BOUNDS: Bounds = { ...ROOM_BOUNDS, minX: -16.7 };

export function footprint(item: Point & { width: number; depth: number }): Bounds {
  return {
    minX: item.x - item.width / 2, maxX: item.x + item.width / 2,
    minZ: item.z - item.depth / 2, maxZ: item.z + item.depth / 2,
  };
}

const edge = footprint(PIT);
// The near apron is cut away; keep feet on the remaining outdoor ground.
const EXCAVATION_BOUNDS: Bounds = { ...ROOM_BOUNDS, minZ: edge.minZ };
// Soil supports walking. Only the pit walls block it; the ladder has a generous opening.
export const PIT_WALLS: Bounds[] = [
  { ...edge, maxX: edge.minX + 0.05 }, { ...edge, minX: edge.maxX - 0.05 },
  { ...edge, maxZ: edge.minZ + 0.05 },
  { ...edge, minZ: edge.maxZ - 0.05, maxX: SITE.interaction.x - 0.6 },
  { ...edge, minZ: edge.maxZ - 0.05, minX: SITE.interaction.x + 0.6 },
];
export const OBSTACLES: Record<RoomId, Bounds[]> = {
  museum: [...ASSEMBLED_STANDS.map(footprint), footprint(SLAB_EXHIBIT), footprint(WALCHIA_STAND), footprint(BENCH), ...PLANTS.map(plant => footprint({ ...plant, width: 1, depth: 1 }))],
  excavation: PIT_WALLS,
  outdoors: SITE_PLOTS.map(plot => footprint({ ...plot, width: 2.8, depth: 2.4 })),
};

export function isWalkable(point: Point, room: RoomId, obstacles = OBSTACLES[room],
  bounds = room === 'museum' ? MUSEUM_BOUNDS : room === 'excavation' ? EXCAVATION_BOUNDS : ROOM_BOUNDS): boolean {
  if (point.x < bounds.minX + PLAYER_RADIUS || point.x > bounds.maxX - PLAYER_RADIUS
    || point.z < bounds.minZ + PLAYER_RADIUS || point.z > bounds.maxZ - PLAYER_RADIUS) return false;
  return !obstacles.some(rect => {
    const nearestX = Math.max(rect.minX, Math.min(point.x, rect.maxX));
    const nearestZ = Math.max(rect.minZ, Math.min(point.z, rect.maxZ));
    return Math.hypot(point.x - nearestX, point.z - nearestZ) < PLAYER_RADIUS;
  });
}

export function screenDirection(horizontal: number, vertical: number, room: RoomId = 'museum'): Point {
  const length = Math.hypot(horizontal, vertical);
  if (!length) return { x: 0, z: 0 };
  const view = cameraOffset(room), radius = Math.hypot(view.x, view.z);
  const right = { x: -view.z / radius, z: view.x / radius };
  const up = { x: -right.z, z: right.x };
  return {
    x: (horizontal * right.x + vertical * up.x) / length,
    z: (horizontal * right.z + vertical * up.z) / length,
  };
}

export function movePlayer(position: Point, direction: Point, seconds: number, room: RoomId, obstacles = OBSTACLES[room], bounds?: Bounds, speed = WALK_SPEED): Point {
  const distance = speed * Math.max(0, Math.min(seconds, 0.05));
  const steps = Math.max(1, Math.ceil(distance / 0.08));
  const result = { ...position };
  // Short steps prevent tunneling; separate axes let the player slide along furniture.
  for (let step = 0; step < steps; step++) {
    const nextX = { x: result.x + direction.x * distance / steps, z: result.z };
    if (isWalkable(nextX, room, obstacles, bounds)) result.x = nextX.x;
    const nextZ = { x: result.x, z: result.z + direction.z * distance / steps };
    if (isWalkable(nextZ, room, obstacles, bounds)) result.z = nextZ.z;
  }
  return result;
}

export function destinationAt(position: Point, room: RoomId): RoomId | null {
  if (Math.hypot(position.x - PORTAL.x, position.z - PORTAL.z) > PORTAL_RADIUS) return null;
  return room === 'outdoors' ? 'museum' : 'outdoors';
}
