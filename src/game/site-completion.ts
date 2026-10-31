import { CLEANUP_TILE_SECONDS, activeSite, sitePlot, siteFront } from '../content/journey.ts';
import { allSiteRecovered, isSiteComplete } from './journey.ts';
import type { JourneyState } from './journey.ts';
import { movePlayer, WALK_SPEED } from './navigation.ts';
import type { Point } from './navigation.ts';

export type CleanupPop = { cellId: string; elapsed: number };
export function completionPhase(state: JourneyState): 'cleanup' | 'exit' | 'closed' | null {
  if (isSiteComplete(state)) return 'closed';
  if (!allSiteRecovered(state)) return null;
  const remaining = activeSite(state).cells.some(cell => state.dig[cell.id] !== 1);
  if (state.room === 'excavation') return remaining ? 'cleanup' : 'exit';
  return state.room === 'outdoors' && !remaining ? 'exit' : null;
}

// Transient animation clocks are never saved. Completed removals and the final
// closure are checkpointed; reload replays only an unfinished pop or exit walk.
export function stepCompletion(state: JourneyState, position: Point, seconds: number, pop: CleanupPop | null, enabled: boolean) {
  const site = activeSite(state), front = siteFront(site);
  const still = { state, position, pop, direction: { x: 0, z: 0 } };
  if (!enabled || !Number.isFinite(seconds) || seconds <= 0) return still;
  const dt = Math.min(seconds, 0.05), phase = completionPhase(state);
  if (phase === 'cleanup') {
    const cell = site.cells.find(cell => state.dig[cell.id] !== 1)!;
    const elapsed = Math.min(CLEANUP_TILE_SECONDS, (pop?.cellId === cell.id ? pop.elapsed : 0) + dt);
    if (elapsed < CLEANUP_TILE_SECONDS - 1e-9) return { ...still, pop: { cellId: cell.id, elapsed } };
    // Exactly one column per update, including multi-layer columns and long frames.
    return { ...still, state: { ...state, dig: { ...state.dig, [cell.id]: 1 } }, pop: null };
  }
  if (phase !== 'exit') return { ...still, pop: null };
  const ladderApproach = { x: site.interaction.x, z: site.grid.z + site.grid.rows * site.grid.tileSize / 2 - 0.6 };
  const aligned = Math.abs(position.x - ladderApproach.x) < 0.1 && position.z >= ladderApproach.z - 0.05;
  const target = state.room === 'excavation' ? aligned || position.z >= site.interaction.z - 0.1
    ? site.interaction : ladderApproach : front;
  const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
  const direction = distance ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 };
  const nextPosition = movePlayer(position, direction, Math.min(dt, distance / WALK_SPEED), state.room,
    state.room === 'excavation' ? [] : undefined);
  if (Math.hypot(nextPosition.x - target.x, nextPosition.z - target.z) > 0.001) {
    return { ...still, position: nextPosition, direction, pop: null };
  }
  if (state.room === 'excavation') {
    if (target === ladderApproach) return { ...still, position: nextPosition, direction, pop: null };
    return { ...still, state: { ...state, room: 'outdoors' as const }, position: { ...sitePlot(site).entrance }, direction, pop: null };
  }
  return { ...still, position: { ...front }, direction, pop: null,
    state: { ...state, closedSites: [...state.closedSites, site.id] } };
}
