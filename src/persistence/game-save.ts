import { ECONOMY } from '../content/economy.ts';
import { SITES } from '../content/journey.ts';
import { freshJourney } from '../game/journey.ts';
import { createGameSave, soilUnits, layerCleared, coinOutcome } from '../game/economy.ts';
import type { GameSave } from '../game/economy.ts';
import { parseSave, SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).length === allowed.length
  && Object.keys(value).every(key => allowed.includes(key));
const unique = (value: unknown): value is string[] => Array.isArray(value)
  && value.every(id => typeof id === 'string') && new Set(value).size === value.length;

// The schema-1–12 parser stays frozen as the historical journey contract.
// Schema 13 validates that contract plus a separate, inseparable economy snapshot.
export function parseGameSave(raw: string, migrationSeed: number): GameSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 13) {
      const journey = parseSave(raw);
      return journey ? createGameSave(journey, migrationSeed) : null;
    }
    const { economy: e, ...progress } = value;
    const journey = parseSave(JSON.stringify({ ...progress, version: 12 }));
    if (!journey || !record(e) || !keys(e, ['version', 'seed', 'coins', 'sites']) || e.version !== 1
      || !Number.isInteger(e.seed) || Number(e.seed) < 0 || Number(e.seed) > 0xffffffff
      || !Number.isSafeInteger(e.coins) || Number(e.coins) < 0 || !record(e.sites)
      || !e.sites[SITES[0].id] || !e.sites[journey.activeSiteId]
      || Object.keys(e.sites).some(id => !SITES.some(site => site.id === id))) return null;
    let earned = 0;
    for (const site of SITES) {
      const m = e.sites[site.id];
      if (m === undefined) {
        if (site.cells.some(cell => journey.dig[cell.id] !== undefined)) return null;
        continue;
      }
      if (!record(m) || !keys(m, ['layout', 'levels', 'outcomes', 'excluded', 'claimed'])
        || m.layout !== 1 || m.levels !== site.grid.levels || !record(m.outcomes)
        || !unique(m.excluded) || !unique(m.claimed)) return null;
      const units = soilUnits(site), ids = units.map(unit => unit.id);
      if (!keys(m.outcomes, ids) || [...m.excluded, ...m.claimed].some(id => !ids.includes(id))) return null;
      for (const unit of units) {
        const amount = m.outcomes[unit.id], excluded = m.excluded.includes(unit.id), claimed = m.claimed.includes(unit.id);
        const cleared = layerCleared(journey.dig, unit.cellId, unit.layer, site.grid.levels);
        if (amount !== coinOutcome(Number(e.seed), unit.id) || (excluded && (!cleared || claimed))
          || claimed !== (!excluded && cleared && amount === ECONOMY.dropCoins)) return null;
        if (claimed) earned += Number(amount);
      }
    }
    // 6.1 has no spending or other income. Later increments version this invariant.
    if (e.coins !== ECONOMY.startingCoins + earned) return null;
    return value as GameSave;
  } catch { return null; }
}

export function loadGameSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: GameSave; restored: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createGameSave(freshJourney(), seed), restored: false };
    const save = parseGameSave(raw, seed);
    return save ? { kind: 'ready', save, restored: true } : { kind: 'invalid' };
  } catch { return { kind: 'unavailable' }; }
}
