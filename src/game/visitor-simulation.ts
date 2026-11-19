import { CASHIER, CASHIER_STATION, VISITORS, VISITOR_DOOR, queuePoint } from '../content/visitors.ts';
import type { ExhibitId } from '../content/exhibit.ts';
import { displayedExhibits } from './purchases.ts';
import { museumLayout } from './museum-layout.ts';
import type { MuseumLayout } from './museum-layout.ts';
import { ASSEMBLED_STANDS, SLAB_EXHIBIT, WALCHIA_STAND, isWalkable, PORTAL } from './navigation.ts';
import type { Point } from './navigation.ts';
import { arriveVisitor, arrivalSeconds, atCashier, canArrive, finishVisit, payVisitor, visitorCapacity } from './visitors.ts';
import { hasAdmissionPlace } from './visitor-capacity.ts';
import type { VisitorSave } from './visitors.ts';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function visitorWalkable(p: Point, layout: MuseumLayout) {
  return isWalkable(p, 'museum', layout.obstacles, layout.bounds)
    && distance(p, PORTAL) > 1.15 && distance(p, CASHIER_STATION) > CASHIER_STATION.radius + 0.3
    && layout.spots.every(spot => distance(p, spot) > 1.05)
    && layout.purchases.every(spot => distance(p, spot) > 0.95);
}
// A bounded half-unit grid keeps paths clear in either owned museum layout.
// No visitor is added to player collision, and paths never use interaction circles.
export function visitorPath(from: Point, target: Point, layout: MuseumLayout): Point[] {
  const clear = (a: Point, b: Point) => {
    const steps = Math.ceil(distance(a, b) / 0.02);
    for (let i = 1; i <= steps; i++) if (!visitorWalkable({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps }, layout)) return false;
    return true;
  };
  if (clear(from, target)) return [target];
  const nodes: Point[] = [];
  for (let x = Math.ceil(layout.bounds.minX * 2) / 2; x <= layout.bounds.maxX; x += 0.5)
    for (let z = -5; z <= 5; z += 0.5) if (visitorWalkable({ x, z }, layout)) nodes.push({ x, z });
  const closest = (p: Point) => nodes.map((n, i) => ({ i, d: distance(n, p) })).sort((a, b) => a.d - b.d).find(n => clear(p, nodes[n.i]))?.i;
  const start = closest(from), end = closest(target);
  if (start === undefined || end === undefined) return [];
  const lookup = new Map(nodes.map((p, i) => [`${p.x},${p.z}`, i]));
  const queue = [start], previous = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length && !previous.has(end); i++) {
    const p = nodes[queue[i]];
    for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      const next = lookup.get(`${p.x + dx},${p.z + dz}`);
      if (next !== undefined && !previous.has(next) && clear(p, nodes[next])) { previous.set(next, queue[i]); queue.push(next); }
    }
  }
  if (!previous.has(end)) return [];
  const path = [target]; let index = end;
  while (index !== -1) { path.unshift(nodes[index]); index = previous.get(index)!; }
  // Remove redundant waypoints without cutting through exhibits or markers.
  const compact: Point[] = []; let p = from;
  while (path.length) {
    let last = path.length - 1; while (last > 0 && !clear(p, path[last])) last--;
    p = path[last]; compact.push(p); path.splice(0, last + 1);
  }
  return compact;
}
export type VisitorPose = Point & { id: number; direction: Point; moving: boolean; paid: boolean };
export const viewingCenter = (id: ExhibitId) => id === 'trilobite' ? SLAB_EXHIBIT : id === 'walchia' ? WALCHIA_STAND : ASSEMBLED_STANDS.find(s => s.id === id)!;
// Sample the perimeter of the real footprint, then validate against furniture,
// walls and interaction circles. Narrow sides may legitimately have fewer slots.
export function viewingPositions(id: ExhibitId, layout: MuseumLayout, random = Math.random): Point[] {
  const stand = viewingCenter(id), points: Point[] = [];
  for (const side of [-1, 1]) for (const fraction of [-0.6, 0, 0.6]) {
    const jitter = () => (random() - 0.5) * 0.2;
    points.push({ x: stand.x + fraction * stand.width / 2 + jitter(), z: stand.z + side * (stand.depth / 2 + 0.8) });
    points.push({ x: stand.x + side * (stand.width / 2 + 0.8), z: stand.z + fraction * stand.depth / 2 + jitter() });
  }
  return points.filter(p => visitorWalkable(p, layout));
}
type Actor = { pose: VisitorPose; path: Point[]; target: Point | null; layout: string;
  stops: (ExhibitId | null)[]; stop: number; viewing: number; duration: number; paid: boolean };
export function createVisitorSimulation(random = Math.random) {
  const actors = new Map<number, Actor>(); let arrival = 0, service = 0;
  function sync(save: VisitorSave, restored = false) {
    for (const id of actors.keys()) if (!save.visitors.visits.some(v => v.id === id)) actors.delete(id);
    let unpaidIndex = 0;
    for (const visit of save.visitors.visits) {
      let actor = actors.get(visit.id);
      if (!actor) {
        const p = restored && !visit.paid ? queuePoint(unpaidIndex) : VISITOR_DOOR;
        actor = { pose: { ...p, id: visit.id, direction: { x: 0, z: -1 }, moving: false, paid: !!visit.paid },
          path: [], target: null, layout: '', stops: [], stop: 0, viewing: 0, duration: 0, paid: false };
        actors.set(visit.id, actor);
      }
      if (visit.paid && !actor.paid) {
        const exhibits = displayedExhibits(save);
        const chosen = Array.from({ length: Math.min(2, exhibits.length) }, (_, i) => exhibits[(visit.id + i - 1) % exhibits.length]);
        actor.stops = [...chosen, null]; actor.target = null;
        actor.paid = true; actor.pose.paid = true;
      }
      if (!visit.paid) unpaidIndex++;
    }
  }
  return {
    reset(save: VisitorSave) { actors.clear(); arrival = 0; service = 0; sync(save, true); },
    poses: () => [...actors.values()].map(a => a.pose),
    step<T extends VisitorSave>(save: T, player: Point, seconds: number): T {
      if (save.room !== 'museum' || !Number.isFinite(seconds) || seconds <= 0) return save;
      const dt = Math.min(seconds, 0.05), layout = museumLayout(save); sync(save);
      const unpaid = save.visitors.visits.filter(v => !v.paid); let finished: number | undefined;
      for (const visit of save.visitors.visits) {
        const actor = actors.get(visit.id)!;
        const exhibit = visit.paid ? actor.stops[actor.stop] : undefined;
        actor.pose.moving = false;
        if (visit.paid && exhibit === undefined) { finished = visit.id; continue; }
        const queueTarget = queuePoint(unpaid.findIndex(v => v.id === visit.id));
        if (!actor.target || !visit.paid && distance(actor.target, queueTarget) > 0.001 || actor.layout !== layout.key) {
          if (!visitorWalkable(actor.pose, layout)) {
            const safe: Point[] = [];
            for (let x = Math.ceil(layout.bounds.minX * 2) / 2; x < layout.bounds.maxX; x += 0.5)
              for (let z = -5; z <= 5; z += 0.5) if (visitorWalkable({ x, z }, layout)) safe.push({ x, z });
            const nearest = safe.sort((a, b) => distance(a, actor.pose) - distance(b, actor.pose))[0];
            if (nearest) { actor.pose.x = nearest.x; actor.pose.z = nearest.z; }
          }
          if (exhibit) {
            const others = [...actors.values()].filter(a => a !== actor);
            const crowding = (p: Point) => others.reduce((score, a) => score
              + (distance(p, a.pose) < 0.85 ? 1 : 0)
              + (a.target && distance(p, a.target) < 0.85 ? 1 : 0), 0);
            const candidates = viewingPositions(exhibit, layout, random).map(p => ({ p, crowd: crowding(p), tie: random() }))
              .sort((a, b) => a.crowd - b.crowd || a.tie - b.tie);
            actor.target = null; actor.path = [];
            for (const { p } of candidates) {
              const path = visitorPath(actor.pose, p, layout);
              if (path.length) { actor.target = p; actor.path = path; break; }
            }
            actor.duration = VISITORS.viewingSeconds * (0.7 + random() * 0.6);
            actor.viewing = 0;
            // No retry loop if a future layout makes a display unreachable.
            if (!actor.target) { actor.stop++; continue; }
          } else {
            actor.target = visit.paid ? VISITOR_DOOR : queueTarget;
            actor.path = visitorPath(actor.pose, actor.target, layout);
          }
          actor.layout = layout.key;
        }
        const target = actor.target!;
        const point = actor.path[0];
        if (point) {
          const d = distance(actor.pose, point), step = Math.min(d, dt * VISITORS.speed);
          if (d > 0.001) {
            actor.pose.direction = { x: (point.x - actor.pose.x) / d, z: (point.z - actor.pose.z) / d };
            actor.pose.x += actor.pose.direction.x * step; actor.pose.z += actor.pose.direction.z * step; actor.pose.moving = true;
          }
          if (d <= step + 0.001) actor.path.shift();
        }
        if (visit.paid && distance(actor.pose, target) < 0.02) {
          if (exhibit) {
            const center = viewingCenter(exhibit), d = distance(actor.pose, center);
            actor.pose.direction = { x: (center.x - actor.pose.x) / d, z: (center.z - actor.pose.z) / d };
          }
          actor.viewing += dt;
          if (actor.stop === actor.stops.length - 1) finished = visit.id;
          else if (actor.viewing >= actor.duration) { actor.stop++; actor.viewing = 0; actor.target = null; }
        }
        if (!visit.paid && distance(actor.pose, target) < 0.02) {
          actor.pose.moving = false;
          const d = distance(actor.pose, CASHIER);
          actor.pose.direction = { x: (CASHIER.x - actor.pose.x) / d, z: (CASHIER.z - actor.pose.z) / d };
        }
      }
      if (finished !== undefined) return finishVisit(save, finished);
      const first = unpaid[0], ready = first && distance(actors.get(first.id)!.pose, queuePoint(0)) < 0.02;
      service = ready && atCashier(player) && hasAdmissionPlace(save.visitors.visits, visitorCapacity(save)) ? service + dt : 0;
      if (service + 1e-9 >= VISITORS.serviceSeconds) {
        service = 0; return payVisitor(save, first.id, player, true);
      }
      if (!canArrive(save)) { arrival = 0; return save; }
      arrival += dt;
      if (arrival + 1e-9 >= arrivalSeconds(save)) { arrival = 0; return arriveVisitor(save); }
      return save;
    },
  };
}
