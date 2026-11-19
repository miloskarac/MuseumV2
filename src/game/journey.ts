import { DISCOVERY, discoveriesFor, sitesFor, activeSite, CLEANING_AREAS, HITS_PER_LAYER, SHOVEL_CONTACT, SHOVEL_SECONDS, SITE, SITE_PLOTS } from '../content/journey.ts';
import { PIT_WALLS, PLAYER_RADIUS } from './navigation.ts';
import type { DigSite } from '../content/journey.ts';
import type { Point, RoomId } from './navigation.ts';
import { findIsExposed } from './burial.ts';

export type JourneyState = {
  // Frozen discovery sub-contract; the full application save is schema 13
  // (GameSave) and adds an economy without changing historical journey rules.
  version: 12 | 26;
  activeSiteId: string;
  room: RoomId;
  // Fraction of a whole column, independent of the content-defined layer count.
  // Increasing a site's depth preserves saved percentages and cleared columns.
  dig: Record<string, number>;
  cleaning: Record<string, number[]>;
  collected: string[];
  closedSites: string[];
  placed: string[];
};

export const freshJourney = (): JourneyState => ({ version: 12, activeSiteId: SITE.id, room: 'museum', dig: {}, cleaning: {}, collected: [], closedSites: [], placed: [] });
export const digProgress = (state: JourneyState) => activeSite(state).cells.reduce((sum, cell) => sum + (state.dig[cell.id] ?? 0), 0) / activeSite(state).cells.length;
export const isUncovered = (state: JourneyState, id: string = DISCOVERY.id) => discoveriesFor(state).some(find => find.id === id)
  && sitesFor(state).some(site => site.requiredDiscoveryIds.includes(id) && findIsExposed(state.dig, site, id));
export const isCollected = (state: JourneyState, id: string = DISCOVERY.id) => state.collected.includes(id);
export const cleaningProgress = (state: JourneyState, id: string = DISCOVERY.id) => isCollected(state, id) ? 1
  : (state.cleaning[id]?.length ?? 0) / CLEANING_AREAS.length;
export const isClean = (state: JourneyState, id: string = DISCOVERY.id) => isUncovered(state, id) && cleaningProgress(state, id) === 1;
export const pendingDiscovery = (state: JourneyState, unavailable: readonly string[] = []) => discoveriesFor(state).find(find => !unavailable.includes(find.id) && activeSite(state).requiredDiscoveryIds.includes(find.id) && isUncovered(state, find.id) && !isCollected(state, find.id));
export function digObstacles(_state: JourneyState) { return PIT_WALLS; }
export function tileSurface(progress: number, site: DigSite = SITE) {
  const depth = tileDepth(progress, site.grid.levels);
  return depth.cleared ? site.grid.floorY : site.grid.floorY * (depth.level + depth.hits * 0.1) / site.grid.levels;
}
export function groundHeight(state: JourneyState, position: Point, site: DigSite = activeSite(state)) {
  const { x, z, columns, rows, tileSize, floorY } = site.grid;
  const back = z + rows * tileSize / 2;
  if (Math.abs(position.x - x) >= columns * tileSize / 2 || position.z >= back
    || position.z <= z - rows * tileSize / 2) return 0;
  // Support the feet, including when straddling two tile heights.
  const half = tileSize / 2 + PLAYER_RADIUS;
  const soil = Math.max(floorY, ...site.cells.filter(cell => Math.abs(cell.x - position.x) < half
    && Math.abs(cell.z - position.z) < half).map(cell => tileSurface(state.dig[cell.id] ?? 0, site)));
  const ladder = Math.abs(position.x - site.interaction.x) < 0.6
    ? floorY * Math.min(1, (back - position.z) / 0.75) : floorY;
  return Math.max(soil, ladder);
}
// The shallowest remaining layer owns digging across the entire pit. Derive it
// from saved column progress so older uneven pits keep their completed work.
export function activeDigLayer(state: JourneyState, site: DigSite = activeSite(state)) {
  return site.cells.reduce((layer, cell) => Math.min(layer, tileDepth(state.dig[cell.id] ?? 0, site.grid.levels).level), site.grid.levels);
}
export function diggableCells(state: JourneyState, position: Point, site: DigSite = activeSite(state)) {
  if (state.room !== site.room) return [];
  const half = site.grid.tileSize / 2;
  const standingY = groundHeight(state, position, site);
  const layer = activeDigLayer(state, site);
  // Reach one layer (including its small first-hit dent). Deeper work needs a
  // nearby lower footing instead of stretching the shovel down an entire pit.
  const reachY = -site.grid.floorY / site.grid.levels * 1.1 + 1e-6;
  return site.cells.filter(cell => state.dig[cell.id] !== 1
    && tileDepth(state.dig[cell.id] ?? 0, site.grid.levels).level === layer
    && Math.abs(tileSurface(state.dig[cell.id] ?? 0, site) - standingY) <= reachY).map(cell => ({ cell,
    distance: Math.hypot(Math.max(0, Math.abs(position.x - cell.x) - half), Math.max(0, Math.abs(position.z - cell.z) - half)),
  })).filter(item => item.distance <= 0.65).sort((a, b) => a.distance - b.distance
    || Math.hypot(position.x - a.cell.x, position.z - a.cell.z) - Math.hypot(position.x - b.cell.x, position.z - b.cell.z));
}
export function nearestDigCell(state: JourneyState, position: Point, site: DigSite = activeSite(state)) {
  return diggableCells(state, position, site)[0]?.cell;
}
export const nearDig = (state: JourneyState, position: Point) => !!nearestDigCell(state, position) || (state.room === SITE.room && !!pendingDiscovery(state));
export function allSiteRecovered(state: JourneyState, site: DigSite = activeSite(state)) {
  const finds = site.requiredDiscoveryIds;
  return finds.length > 0 && finds.every(id => state.collected.includes(id) && !state.cleaning[id]
    && findIsExposed(state.dig, site, id));
}
export const isSiteComplete = (state: JourneyState, site: DigSite = activeSite(state)) => state.closedSites.includes(site.id);
export function siteAvailability(state: JourneyState, number: number): 'open' | 'complete' | 'locked' | 'future-purchase' {
  const plot = SITE_PLOTS.find(plot => plot.number === number);
  const completeIds = state.closedSites;
  if (!plot || (plot.requires && !completeIds.includes(plot.requires))) return 'locked';
  return completeIds.includes(plot.id) ? 'complete' : plot.playable ? 'open' : 'future-purchase';
}
// Progress is normalized across all layers of a column. Legacy fractions are
// retained until the next strike; new progress is committed only at shovel contact.
export function tileDepth(progress: number, levels: number) {
  const hits = Math.min(levels * HITS_PER_LAYER, Math.floor(progress * levels * HITS_PER_LAYER + 1e-9));
  return { level: Math.floor(hits / HITS_PER_LAYER), hits: hits % HITS_PER_LAYER, cleared: progress >= 1 };
}
export function digAt(state: JourneyState, position: Point, site: DigSite = activeSite(state)): JourneyState {
  if ((site.requires && !state.closedSites.includes(site.requires)) || allSiteRecovered(state, site) || state.closedSites.includes(site.id)) return state;
  const cell = nearestDigCell(state, position, site);
  if (!cell) return state;
  const totalHits = site.grid.levels * HITS_PER_LAYER;
  const progress = Math.min(1, (Math.floor((state.dig[cell.id] ?? 0) * totalHits + 1e-9) + 1) / totalHits);
  return { ...state, dig: { ...state.dig, [cell.id]: progress } };
}

export type DigSwing = { cellId: string; elapsed: number };
// A single shared clock drives the shovel pose and the gameplay strike. No
// animation callback can fire after leaving, opening a dialog, or resetting.
export function stepDigging(state: JourneyState, position: Point, seconds: number,
  swing: DigSwing | null, enabled: boolean, site: DigSite = activeSite(state), rate = 1): { state: JourneyState; swing: DigSwing | null; hit: boolean } {
  const recovering = swing && swing.elapsed >= SHOVEL_CONTACT && swing.elapsed < SHOVEL_SECONDS;
  const cell = enabled && (!site.requires || state.closedSites.includes(site.requires)) && !allSiteRecovered(state, site) && !state.closedSites.includes(site.id)
    ? recovering ? site.cells.find(cell => cell.id === swing.cellId) : nearestDigCell(state, position, site) : undefined;
  if (!cell || !Number.isFinite(seconds) || seconds <= 0) return { state, swing: null, hit: false };
  const previous = swing?.cellId === cell.id && swing.elapsed < SHOVEL_SECONDS ? swing.elapsed : 0;
  const elapsed = Math.min(SHOVEL_SECONDS, previous + Math.min(seconds, 0.05) * rate);
  const hit = previous < SHOVEL_CONTACT && elapsed >= SHOVEL_CONTACT;
  return { state: hit ? digAt(state, position, site) : state,
    swing: { cellId: cell.id, elapsed }, hit };
}

export type BrushPoint = { x: number; y: number };
// Coordinates are normalized to the stable mask, independent of canvas size/DPR.
export function brush(state: JourneyState, from: BrushPoint, to: BrushPoint, id: string = DISCOVERY.id): JourneyState {
  if (state.room !== activeSite(state).room || !activeSite(state).requiredDiscoveryIds.includes(id) || !isUncovered(state, id) || isCollected(state, id) || isClean(state, id)) return state;
  if (![from.x, from.y, to.x, to.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return state;
  const { columns, rows, brushRadius, completion } = DISCOVERY.cleaning;
  const ax = from.x * columns, ay = from.y * rows, bx = to.x * columns, by = to.y * rows;
  const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy;
  const cleaned = new Set(state.cleaning[id] ?? []);
  for (const index of CLEANING_AREAS) {
    const x = index % columns + 0.5, y = Math.floor(index / columns) + 0.5;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0;
    if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= brushRadius) cleaned.add(index);
  }
  if (cleaned.size === (state.cleaning[id]?.length ?? 0)) return state;
  const cleaning = { ...state.cleaning };
  // Keep the existing forgiving threshold: finish the last specks visibly,
  // then wait for the explicit bag action. Readiness is derived from this mask.
  cleaning[id] = cleaned.size / CLEANING_AREAS.length >= completion
    ? [...CLEANING_AREAS] : [...cleaned].sort((a, b) => a - b);
  return { ...state, cleaning };
}
export function collectFossil(state: JourneyState, id: string = DISCOVERY.id): JourneyState {
  if (state.room !== activeSite(state).room || !activeSite(state).requiredDiscoveryIds.includes(id) || isCollected(state, id) || !isClean(state, id)) return state;
  const cleaning = { ...state.cleaning };
  delete cleaning[id];
  return { ...state, cleaning, collected: [...state.collected, id] };
}
