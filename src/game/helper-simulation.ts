import { HELPERS } from '../content/helpers.ts';
import { activeSite } from '../content/journey.ts';
import { isWalkable } from './navigation.ts';
import type { Point } from './navigation.ts';
import { diggableCells } from './journey.ts';
import { museumJourney } from './purchases.ts';
import { helperActive, helperLayer, validHelperTask, cancelHelperTask, pauseHelper, startHelperTask, workHelper } from './helpers.ts';
import type { HelperPlaySave } from './helpers.ts';
import { carriedFinds, depositAtBox } from './storage.ts';
import { storageApproach } from '../content/storage.ts';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// Authored pit grid + ladder connection. Every segment uses the player's wall
// clearance, so reaching a work point cannot cut through the rim or a wall.
export function helperPath(save: HelperPlaySave, from: Point, target: Point): Point[] {
  const site = activeSite(save);
  const clear = (a: Point, b: Point) => {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.04));
    for (let i = 0; i <= steps; i++) if (!isWalkable({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps }, 'excavation')) return false;
    return true;
  };
  if (clear(from, target)) return [target];
  const nodes: Point[] = [from, site.interaction, ...site.cells, target], end = nodes.length - 1;
  const queue = [0], previous = new Map<number, number>([[0, -1]]);
  for (let n = 0; n < queue.length && !previous.has(end); n++) {
    const current = queue[n];
    for (let i = 1; i < nodes.length; i++) {
      if (previous.has(i) || !clear(nodes[current], nodes[i])) continue;
      previous.set(i, current); queue.push(i);
    }
  }
  if (!previous.has(end)) return [];
  const path: Point[] = []; let index = end;
  while (index > 0) { path.unshift({ x: nodes[index].x, z: nodes[index].z }); index = previous.get(index)!; }
  return path;
}
export type HelperPose = Point & { direction: Point; moving: boolean; carrying?: boolean; pickup?: number; swing: { cellId: string; elapsed: number } | null };
export function helperWorkRoute(save: HelperPlaySave, from: Point, cellId: string) {
  const cell = activeSite(save).cells.find(c => c.id === cellId);
  if (!cell) return null;
  // Leave space for the shovel between planted feet and the actual target.
  // Candidate sides also handle rim tiles without standing through a wall.
  const points = [[0, 0.8], [0.8, 0], [0, -0.8], [-0.8, 0]]
    .map(([x, z]) => ({ x: cell.x + x, z: cell.z + z }))
    .filter(p => isWalkable(p, 'excavation') && diggableCells(museumJourney(save), p).some(item => item.cell.id === cellId))
    .sort((a, b) => distance(from, a) - distance(from, b));
  for (const point of points) {
    const path = helperPath(save, from, point);
    if (path.length) return { point, path };
  }
  return null;
}
export function createHelperSimulation() {
  let pose: HelperPose | null = null, siteId = '', taskId = 0, path: Point[] = [], workPoint: Point | null = null;
  let pickupTime = 0;
  const reset = () => { pose = null; siteId = ''; taskId = 0; path = []; workPoint = null; };
  return {
    reset,
    pose: () => pose,
    step<T extends HelperPlaySave>(save: T, seconds: number, enabled: boolean): T {
      const retained = save.helpers.owned[0]?.task;
      if (retained && !validHelperTask(save, retained)) {
        taskId = 0; path = []; if (pose) { pose.moving = false; pose.swing = null; }
        return cancelHelperTask(save);
      }
      if (!enabled || !helperActive(save) || !Number.isFinite(seconds) || seconds <= 0) {
        if (pose) { pose.moving = false; pose.swing = null; }
        if (!helperActive(save)) reset();
        return pauseHelper(save);
      }
      const site = activeSite(save), helper = save.helpers.owned[0], task = helper.task;
      if (!pose || siteId !== site.id) { pose = { ...site.interaction, direction: { x: 0, z: -1 }, moving: false, swing: null }; siteId = site.id; }
      pose.moving = false; pose.swing = null; pose.pickup = 0;
      pose.carrying = 'custody' in save && carriedFinds(save).length > 0;
      if (pose.carrying && 'custody' in save) {
        const destination = storageApproach(save);
        if (taskId !== -1) { path = helperPath(save, pose, destination); taskId = -1; pickupTime = 0; }
        if (pickupTime < 0.5) { pickupTime = Math.min(0.5, pickupTime + Math.min(seconds, 0.05)); pose.pickup = Math.sin(pickupTime / 0.5 * Math.PI); return save; }
        const point = path[0];
        if (point) {
          const d = distance(pose, point), step = Math.min(d, Math.min(seconds, 0.05) * HELPERS.speed);
          if (d > 0.001) {
            pose.direction = { x: (point.x - pose.x) / d, z: (point.z - pose.z) / d };
            pose.x += pose.direction.x * step; pose.z += pose.direction.z * step; pose.moving = true;
          }
          if (d <= step + 0.001) path.shift();
        }
        // No teleport/fallback deposit from the pit: follow the ladder route.
        if (distance(pose, destination) > 0.03) return save;
        return depositAtBox(save, pose) as T;
      }
      if (!task) {
        const cells = site.cells.filter(c => helperLayer(save, site.id, c.id)).sort((a, b) => distance(pose!, a) - distance(pose!, b));
        for (const cell of cells) if (helperWorkRoute(save, pose, cell.id)) return startHelperTask(save, cell.id);
        return save;
      }
      if (taskId !== task.id) {
        const route = helperWorkRoute(save, pose, task.cellId);
        if (!route) return cancelHelperTask(save);
        path = route.path; workPoint = route.point; taskId = task.id;
      }
      if (distance(pose, workPoint!) > 0.02) {
        const point = path[0]; if (!point) return cancelHelperTask(save);
        const d = distance(pose, point), step = Math.min(d, Math.min(seconds, 0.05) * HELPERS.speed);
        if (d > 0.001) {
          pose.direction = { x: (point.x - pose.x) / d, z: (point.z - pose.z) / d };
          const next = { x: pose.x + pose.direction.x * step, z: pose.z + pose.direction.z * step };
          if (!isWalkable(next, 'excavation')) return cancelHelperTask(save);
          pose.x = next.x; pose.z = next.z; pose.moving = true;
        }
        if (d <= step + 0.001) path.shift();
        return pauseHelper(save);
      }
      const next = workHelper(save, pose, seconds);
      const active = next.helpers.owned[0].task;
      if (active) pose.swing = { cellId: active.cellId, elapsed: (active.work % HELPERS.swingSeconds) / HELPERS.swingSeconds };
      return next;
    },
  };
}
