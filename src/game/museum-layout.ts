import { ASSEMBLED_STANDS, SLAB_EXHIBIT, EXHIBIT_SPOTS, MUSEUM_FLOOR,
  BENCH, PLANTS, ARRIVAL, footprint, isWalkable } from './navigation.ts';
import type { Point } from './navigation.ts';
import { owns, standAvailable } from './purchases.ts';
import type { PlaySave } from './purchases.ts';
import { standOffer } from '../content/purchases.ts';
import { CASHIER, CASH_PILE, ENTRANCE_POSTS } from '../content/visitors.ts';

// The entrance, first exhibits and furniture retain their existing coordinates.
export const EXPANSION_SPOT = { x: -7, z: 0 };
export function museumLayout(save?: PlaySave) {
  const expanded = !save || save.version === 13 || owns(save, 'west-wing');
  const available = (id: typeof EXHIBIT_SPOTS[number]['id']) => !save || standAvailable(save, id);
  const assembled = ASSEMBLED_STANDS.filter(stand => available(stand.id));
  const slab = available('trilobite');
  const spots = EXHIBIT_SPOTS.filter(spot => available(spot.id));
  const purchases = save && save.version !== 13 ? EXHIBIT_SPOTS
    .filter(spot => !available(spot.id) && (spot.id !== 'eryops' || expanded))
    .map(spot => ({ id: standOffer(spot.id).id, x: spot.x, z: spot.z })) : [];
  if (!expanded) purchases.push({ id: 'west-wing', ...EXPANSION_SPOT });
  const floor = expanded ? MUSEUM_FLOOR : { x: 0, z: 0, width: 16, depth: 12 };
  const edge = footprint(floor);
  const cashier = !!save && 'visitors' in save;
  return { key: `${expanded}:${spots.map(spot => spot.id).join(',')}:${cashier}`, expanded, floor, cashier,
    bounds: { minX: edge.minX + 0.3, maxX: edge.maxX - 0.3, minZ: edge.minZ + 0.3, maxZ: edge.maxZ - 0.3 },
    assembled, slab, spots, purchases,
    obstacles: [...assembled.map(footprint), ...(slab ? [footprint(SLAB_EXHIBIT)] : []),
      footprint(BENCH), ...PLANTS.map(plant => footprint({ ...plant, width: 1, depth: 1 })),
      ...(cashier ? [footprint(CASHIER), footprint(CASH_PILE), ...ENTRANCE_POSTS.map(footprint)] : [])],
    camera: expanded ? { halfHeight: 11.6, halfWidth: 17.1 } : { halfHeight: 10, halfWidth: 13.4 } };
}
export type MuseumLayout = ReturnType<typeof museumLayout>;
export function safeMuseumPosition(position: Point, layout: MuseumLayout, preferred?: Point): Point {
  const walkable = (point: Point) => isWalkable(point, 'museum', layout.obstacles, layout.bounds);
  if (walkable(position)) return position;
  if (preferred && walkable(preferred)) return { ...preferred };
  return { ...ARRIVAL };
}
