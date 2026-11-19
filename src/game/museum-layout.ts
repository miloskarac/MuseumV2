import { nextMvpStand } from './mvp-progression.ts';
import { ASSEMBLED_STANDS, SLAB_EXHIBIT, EXHIBIT_SPOTS, MUSEUM_FLOOR,
  BENCH, PLANTS, ARRIVAL, WALCHIA_STAND, footprint, isWalkable } from './navigation.ts';
import type { Point } from './navigation.ts';
import { owns, standAvailable } from './purchases.ts';
import type { PlaySave } from './purchases.ts';
import { standOffer } from '../content/purchases.ts';
import { CASHIER, CASH_PILE, ENTRANCE_POSTS } from '../content/visitors.ts';
import { EARLY_PERMIAN_STANDS } from '../content/early-permian-layout.ts';

// Room 1 uses the whole existing floor. Historical QA schemas keep their old
// purchase flow; live schema 24 never offers the obsolete wing.
export const EXPANSION_SPOT = { x: -7, z: 0 };
export function museumLayout(save?: PlaySave) {
  const expanded = true;
  const available = (id: typeof EXHIBIT_SPOTS[number]['id']) => id === 'walchia' ? !!save && standAvailable(save, id) : !save || standAvailable(save, id);
  const assembled = ASSEMBLED_STANDS.filter(stand => available(stand.id));
  const slab = available('trilobite');
  const spots = EXHIBIT_SPOTS.filter(spot => available(spot.id));
  const purchases = save && save.version !== 13 ? EXHIBIT_SPOTS
    .filter(spot => (spot.id !== 'walchia' || save.version === 26) && !available(spot.id) && ((save.version === 25 || save.version === 26) ? standOffer(spot.id).id === nextMvpStand(save)
      : spot.id !== 'eryops' || save.version === 24 || owns(save, 'west-wing')))
    .map(spot => ({ id: standOffer(spot.id).id, x: spot.x, z: spot.z })) : [];
  if (save && save.version !== 13 && save.version < 24 && !owns(save, 'west-wing')) purchases.push({ id: 'west-wing', ...EXPANSION_SPOT });
  const floor = MUSEUM_FLOOR;
  const edge = footprint(floor);
  const cashier = !!save && 'visitors' in save;
  return { key: `${expanded}:${spots.map(spot => spot.id).join(',')}:${cashier}:${purchases.map(p => p.id).join(',')}`, expanded, floor, cashier,
    bounds: { minX: edge.minX + 0.3, maxX: edge.maxX - 0.3, minZ: edge.minZ + 0.3, maxZ: edge.maxZ - 0.3 },
    assembled, slab, walchia: available('walchia'), spots, purchases, reserved: WALCHIA_STAND,
    vacant: EARLY_PERMIAN_STANDS.filter(stand => stand.active && stand.id !== 'walchia' && !available(stand.id)),
    obstacles: [...assembled.map(footprint), ...(slab ? [footprint(SLAB_EXHIBIT)] : []),
      footprint(WALCHIA_STAND), footprint(BENCH), ...PLANTS.map(plant => footprint({ ...plant, width: 1, depth: 1 })),
      ...(cashier ? [footprint(CASHIER), footprint(CASH_PILE), ...ENTRANCE_POSTS.map(footprint)] : [])],
    camera: { halfHeight: 11.6, halfWidth: 17.1 } };
}
export type MuseumLayout = ReturnType<typeof museumLayout>;
export function safeMuseumPosition(position: Point, layout: MuseumLayout, preferred?: Point): Point {
  const walkable = (point: Point) => isWalkable(point, 'museum', layout.obstacles, layout.bounds);
  if (walkable(position)) return position;
  if (preferred && walkable(preferred)) return { ...preferred };
  return { ...ARRIVAL };
}
