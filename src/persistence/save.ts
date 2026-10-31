import { CLEANING_AREAS, DISCOVERY, ELIGIBLE_AREAS, LEGACY_SITE as SITE, LEGACY_SLAB_SITE, LEGACY_SHARED_SITE, LEGACY_ERYOPS_SITE, LEGACY_FOOTPRINT_SITES, SITES } from '../content/journey.ts';
import { GROUPS, ALL_PARTS, FIRST_PARTS, SLAB_PART } from '../content/exhibit.ts';
import { freshJourney } from '../game/journey.ts';
import type { JourneyState } from '../game/journey.ts';
import { findIsExposed } from '../game/burial.ts';

// Historical schemas 1–12 and the reusable snapshot writer. The live game reads
// its schema-13 economy envelope through game-save.ts, which reuses this parser.

export const SAVE_KEY = 'museum-for-luka-v2';
export const CHECKPOINT_MS = 1000;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type LoadResult = { kind: 'ready'; state: JourneyState; restored: boolean }
  | { kind: 'invalid' | 'unavailable' };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function keysAre(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every(key => allowed.includes(key));
}

type Schema7 = Omit<JourneyState, 'version' | 'activeSiteId'> & { version: 7 };
type LegacyState = Omit<Schema7, 'version' | 'placed'> & { version: 5 };
function parseLegacySave(raw: string): LegacyState | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || ![1, 2, 3, 4, 5].includes(value.version as number)
      || !keysAre(value, Number(value.version) >= 4 ? ['version', 'room', 'dig', 'cleaning', 'collected', 'closedSites'] : ['version', 'room', 'dig', 'cleaning', 'collected'])
      || !(value.version === 1 ? ['museum', 'excavation'] : ['museum', 'outdoors', 'excavation']).includes(value.room as string)
      || !record(value.dig) || !record(value.cleaning) || !Array.isArray(value.collected)) return null;
    const oldGridIds = Array.from({ length: 36 }, (_, i) => `courtyard-l0-r${Math.floor(i / 6)}-c${i % 6}`);
    const cellIds = value.version === 1 ? ['courtyard-pocket'] : value.version === 2 ? oldGridIds : SITE.cells.map(cell => cell.id);
    if (!keysAre(value.dig, cellIds) || !keysAre(value.cleaning, [DISCOVERY.id])) return null;
    if (!Object.values(value.dig).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) return null;
    if (new Set(value.collected).size !== value.collected.length || value.collected.some(id => id !== DISCOVERY.id)) return null;
    const dig = value.dig;
    const uncovered = value.version === 1 ? dig['courtyard-pocket'] === 1 : value.version === 2 ? dig['courtyard-l0-r4-c2'] === 1
      : SITE.cells.filter(cell => cell.discoveryId === DISCOVERY.id).every(cell => dig[cell.id] === 1);
    const collected = value.collected.includes(DISCOVERY.id);
    if (collected && !uncovered) return null;
    const mask = value.cleaning[DISCOVERY.id];
    if (mask !== undefined) {
      if (!uncovered || collected || !Array.isArray(mask) || new Set(mask).size !== mask.length
        || !mask.every(index => Number.isInteger(index) && (value.version === 5 ? CLEANING_AREAS : ELIGIBLE_AREAS).includes(index))
        || (value.version !== 5 && mask.length / ELIGIBLE_AREAS.length >= DISCOVERY.cleaning.completion)) return null;
    }
    const upgrade = (dig: Record<string, number>): LegacyState => {
      const complete = collected && SITE.cells.every(cell => dig[cell.id] === 1);
      return { ...value, version: 5, dig, closedSites: complete ? [SITE.id] : [] } as LegacyState;
    };
    if (value.version === 1) {
      // Explicit V2 schema-1 upgrade, not V1-game import. Keep the existing find/mask.
      const progress = (dig['courtyard-pocket'] ?? 0) as number;
      const upgraded: Record<string, number> = {};
      if (collected) for (const cell of SITE.cells) upgraded[cell.id] = 1;
      else if (progress > 0) {
        const findCell = SITE.cells.find(cell => cell.discoveryId === DISCOVERY.id)!;
        upgraded[findCell.id] = progress;
        const approach = SITE.cells.find(cell => cell.row === SITE.grid.rows - 1 && cell.column === findCell.column)!;
        upgraded[approach.id] = 1;
      }
      return upgrade(upgraded);
    }
    if (value.version === 2) {
      const upgraded: Record<string, number> = {};
      // Anchor the old 6x6 area to the same ladder and fossil, adding two rows
      // at the far side and one column on each side. Keep exact partial values.
      oldGridIds.forEach((id, i) => {
        if (dig[id] !== undefined) upgraded[`courtyard-r${Math.floor(i / 6) + 2}-c${i % 6 + 1}`] = dig[id] as number;
      });
      if (collected && oldGridIds.every(id => dig[id] === 1)) {
        for (const cell of SITE.cells) upgraded[cell.id] = 1;
      }
      return upgrade(upgraded);
    }
    if (value.version === 3) return upgrade(dig as Record<string, number>);
    if (!Array.isArray(value.closedSites) || new Set(value.closedSites).size !== value.closedSites.length
      || value.closedSites.some(id => id !== SITE.id)
      || (value.closedSites.length > 0 && (!collected || !SITE.cells.every(cell => dig[cell.id] === 1)))) return null;
    return { ...value, version: 5 } as LegacyState;
  } catch { return null; }
}

// Validate schema 6 against its actual two-group content before splitting it.
const PREVIOUS_GROUPS = [
  { id: 'body', discoveryId: 'bone-study-01' },
  { id: 'head', discoveryId: 'bone-study-head' },
];
type PreviousState = Omit<Schema7, 'version'> & { version: 6 };
function upgradeGroups(previous: PreviousState): Schema7 {
  const dig = { ...previous.dig }, cleaning: Record<string, number[]> = {};
  const collected: string[] = [], placed: string[] = [];
  for (const group of GROUPS) {
    const old = PREVIOUS_GROUPS[group.id === 'skull' ? 1 : 0];
    const cell = SITE.cells.find(cell => cell.discoveryId === group.discoveryId)!;
    const oldCell = SITE.cells.find(cell => cell.discoveryId === old.discoveryId)!;
    const progress = previous.dig[oldCell.id] ?? 0;
    // A legacy body represented all five non-skull groups. Split its accepted
    // work, not an animation/reward, and never reduce existing tile progress.
    if (progress > 0) dig[cell.id] = Math.max(dig[cell.id] ?? 0, progress);
    const mask = previous.cleaning[old.discoveryId];
    if (mask) cleaning[group.discoveryId] = [...mask];
    if (previous.collected.includes(old.discoveryId)) collected.push(group.discoveryId);
    if (previous.placed.includes(old.id)) placed.push(group.id);
  }
  return { ...previous, version: 7, dig, cleaning, collected, placed };
}
function parsePreviousSave(raw: string): Schema7 | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 6 && value.version !== 7) {
      const legacy = parseLegacySave(raw);
      if (!legacy) return null;
      const collected = legacy.collected.length ? PREVIOUS_GROUPS.map(group => group.discoveryId) : [];
      const dig = { ...legacy.dig };
      if (collected.length) for (const cell of SITE.cells) if (collected.includes(cell.discoveryId ?? "")) dig[cell.id] = 1;
      return upgradeGroups({ ...legacy, version: 6, dig, collected, placed: [] });
    }
    const groups = value.version === 6 ? PREVIOUS_GROUPS : GROUPS;
    if (!keysAre(value, ['version', 'room', 'dig', 'cleaning', 'collected', 'closedSites', 'placed'])
      || !['museum', 'outdoors', 'excavation'].includes(value.room as string)
      || !record(value.dig) || !record(value.cleaning)) return null;
    const uniqueIds = (items: unknown, allowed: readonly string[]): items is string[] => Array.isArray(items)
      && new Set(items).size === items.length && items.every(id => allowed.includes(id));
    if (!uniqueIds(value.collected, groups.map(group => group.discoveryId))
      || !uniqueIds(value.placed, groups.map(group => group.id))
      || !uniqueIds(value.closedSites, [SITE.id])
      || !keysAre(value.dig, SITE.cells.map(cell => cell.id))
      || !keysAre(value.cleaning, groups.map(group => group.discoveryId))
      || !Object.values(value.dig).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) return null;
    const dig = value.dig;
    for (const group of groups) {
      const uncovered = SITE.cells.filter(cell => cell.discoveryId === group.discoveryId).every(cell => dig[cell.id] === 1);
      const collected = value.collected.includes(group.discoveryId);
      const mask = value.cleaning[group.discoveryId];
      if ((collected && !uncovered) || (value.placed.includes(group.id) && !collected)) return null;
      if (mask !== undefined && (!uncovered || collected || !Array.isArray(mask)
        || new Set(mask).size !== mask.length || !mask.every(index => Number.isInteger(index) && CLEANING_AREAS.includes(index)))) return null;
    }
    if (value.closedSites.length && (value.collected.length !== groups.length || !SITE.cells.every(cell => dig[cell.id] === 1))) return null;
    return value.version === 6 ? upgradeGroups(value as PreviousState) : value as Schema7;
  } catch { return null; }
}

type Schema8 = Omit<JourneyState, 'version'> & { version: 8 };
type Schema10 = Omit<JourneyState, 'version'> & { version: 10 };
type Schema11 = Omit<JourneyState, 'version'> & { version: 11 };
function mergeSites(previous: Schema8): Schema10 {
  const site = LEGACY_SHARED_SITE, dig = { ...previous.dig };
  const oldCell = LEGACY_SLAB_SITE.cells.find(cell => cell.discoveryId === SLAB_PART.discoveryId)!;
  const cell = site.cells.find(cell => cell.discoveryId === SLAB_PART.discoveryId)!;
  if (previous.dig[oldCell.id] !== undefined) dig[cell.id] = Math.max(dig[cell.id] ?? 0, previous.dig[oldCell.id]);
  for (const old of LEGACY_SLAB_SITE.cells) delete dig[old.id];
  // Reopen only when the newly shared find still needs recovery. Never grant it.
  const closedSites = previous.closedSites.includes(site.id) && previous.collected.includes(SLAB_PART.discoveryId) ? [site.id] : [];
  return { ...previous, version: 10, activeSiteId: site.id, dig, closedSites };
}

function expandFinds(previous: Schema10 | Schema11): JourneyState {
  const dig = { ...previous.dig };
  // Validate against the old layout first. Already uncovered finds stay exposed,
  // including finds with no brush strokes yet. Preserve all other earth work.
  const oldSites = previous.version === 11 ? LEGACY_FOOTPRINT_SITES : [LEGACY_SHARED_SITE, LEGACY_ERYOPS_SITE];
  for (const oldSite of oldSites) {
    const site = SITES.find(site => site.id === oldSite.id)!;
    for (const id of oldSite.requiredDiscoveryIds) {
      if (oldSite.cells.filter(cell => cell.discoveryId === id).every(cell => previous.dig[cell.id] === 1)) {
        for (const cell of site.cells) if (cell.discoveryId === id) dig[cell.id] = 1;
      }
    }
  }
  return { ...previous, version: 12, dig };
}

export function parseSave(raw: string): JourneyState | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 8 && value.version !== 9 && value.version !== 10 && value.version !== 11 && value.version !== 12) {
      const previous = parsePreviousSave(raw);
      return previous ? expandFinds(mergeSites({ ...previous, version: 8, activeSiteId: SITE.id })) : null;
    }
    const sites = value.version === 8 ? [SITE, LEGACY_SLAB_SITE] : value.version === 9 ? [LEGACY_SHARED_SITE]
      : value.version === 10 ? [LEGACY_SHARED_SITE, LEGACY_ERYOPS_SITE] : value.version === 11 ? LEGACY_FOOTPRINT_SITES : SITES;
    const parts = Number(value.version) >= 10 ? ALL_PARTS : FIRST_PARTS;
    if (!keysAre(value, ['version', 'activeSiteId', 'room', 'dig', 'cleaning', 'collected', 'closedSites', 'placed'])
      || !sites.some(site => site.id === value.activeSiteId)
      || !['museum', 'outdoors', 'excavation'].includes(value.room as string)
      || !record(value.dig) || !record(value.cleaning)) return null;
    const uniqueIds = (items: unknown, allowed: readonly string[]): items is string[] => Array.isArray(items)
      && new Set(items).size === items.length && items.every(id => allowed.includes(id));
    const cells = sites.flatMap(site => site.cells);
    if (!uniqueIds(value.collected, parts.map(part => part.discoveryId))
      || !uniqueIds(value.placed, parts.map(part => part.id))
      || !uniqueIds(value.closedSites, sites.map(site => site.id))
      || !keysAre(value.dig, cells.map(cell => cell.id))
      || !keysAre(value.cleaning, parts.map(part => part.discoveryId))
      || !Object.values(value.dig).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) return null;
    const dig = value.dig;
    for (const part of parts) {
      const site = sites.find(site => site.requiredDiscoveryIds.includes(part.discoveryId))!;
      const uncovered = findIsExposed(dig as Record<string, number>, site, part.discoveryId);
      const collected = value.collected.includes(part.discoveryId), mask = value.cleaning[part.discoveryId];
      if ((collected && !uncovered) || (value.placed.includes(part.id) && !collected)) return null;
      if (mask !== undefined && (!uncovered || collected || !Array.isArray(mask) || new Set(mask).size !== mask.length
        || !mask.every(index => Number.isInteger(index) && CLEANING_AREAS.includes(index)))) return null;
    }
    const collectedIds = value.collected;
    for (const site of sites) {
      const progressed = site.cells.some(cell => dig[cell.id] !== undefined) || value.activeSiteId === site.id || value.closedSites.includes(site.id);
      if (progressed && site.requires && !value.closedSites.includes(site.requires)) return null;
      if (value.closedSites.includes(site.id) && (!site.requiredDiscoveryIds.every(id => collectedIds.includes(id))
        || !site.cells.every(cell => dig[cell.id] === 1))) return null;
    }
    return value.version === 12 ? value as JourneyState
      : expandFinds(value.version === 11 ? value as Schema11
        : value.version === 8 ? mergeSites(value as Schema8) : { ...value, version: 10 } as Schema10);
  } catch { return null; }
}

export function loadSave(storage: StoragePort): LoadResult {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', state: freshJourney(), restored: false };
    const state = parseSave(raw);
    return state ? { kind: 'ready', state, restored: true } : { kind: 'invalid' };
  } catch { return { kind: 'unavailable' }; }
}

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'failed' | 'blocked';
type Scheduler = { set: (callback: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
const browserScheduler: Scheduler = { set: (callback, ms) => setTimeout(callback, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

export function createSaveWriter<T = JourneyState>(storage: StoragePort, onStatus: (status: SaveStatus) => void, scheduler = browserScheduler) {
  let pending: T | null = null;
  let timer: unknown = null;
  let generation = 0;
  let blocked = true;
  let disposed = false;
  let failed = false;
  function cancelTimer() {
    generation++;
    if (timer !== null) scheduler.clear(timer);
    timer = null;
  }
  function flush() {
    cancelTimer();
    if (disposed || blocked || !pending) return false;
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(pending));
      pending = null;
      failed = false;
      onStatus('saved');
      return true;
    } catch {
      failed = true;
      onStatus('failed');
      return false;
    }
  }
  return {
    enable() { if (!disposed) { blocked = false; onStatus('idle'); } },
    schedule(state: T) {
      if (disposed || blocked) return;
      pending = structuredClone(state);
      if (timer !== null) return;
      if (!failed) onStatus('pending');
      const token = generation;
      timer = scheduler.set(() => { if (token === generation) flush(); }, CHECKPOINT_MS);
    },
    flush,
    hasPending: () => pending !== null,
    cancel() { cancelTimer(); pending = null; blocked = true; },
    reset() {
      if (disposed) return false;
      cancelTimer();
      try {
        storage.removeItem(SAVE_KEY);
        pending = null;
        failed = false;
        blocked = false;
        onStatus('idle');
        return true;
      } catch { onStatus('failed'); return false; }
    },
    dispose() { cancelTimer(); pending = null; blocked = true; disposed = true; },
  };
}
