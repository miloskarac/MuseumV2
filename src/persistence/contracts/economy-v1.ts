// Economy sub-contract 1, used by save schemas 13–22. Never consult live tuning.
import { freeze, SITES } from './journey-v12.ts';
import type { HistoricalSite } from './journey-v12.ts';
import type { JourneyState } from '../../game/journey.ts';
import type { GameSave, CoinManifest } from '../../game/economy.ts';

export const ECONOMY = freeze({ version: 1, startingCoins: 20, dropChance: 0.125, dropCoins: 1, layoutRevision: 1 } as const);
export const soilUnits = (site: HistoricalSite) => site.cells.flatMap(cell => Array.from({ length: site.grid.levels }, (_, layer) => ({
  id: `${site.id}/v1/${cell.id}/${layer}`, cellId: cell.id, layer,
})));
export const layerCleared = (dig: Record<string, number>, cellId: string, layer: number, levels: number) =>
  (dig[cellId] ?? 0) * levels + 1e-9 >= layer + 1;
export function coinOutcome(seed: number, key: string) {
  let hash = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296 < 0.125 ? 1 : 0;
}
// Migrating pre-economy saves excludes cleared soil and grants only the original
// starting balance; future sites and future rewards cannot enter this snapshot.
export function migrateEconomy(journey: JourneyState, seed: number): GameSave {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid economy seed');
  const sites: Record<string, CoinManifest> = {};
  for (const site of SITES) if (site === SITES[0] || site.id === journey.activeSiteId || site.cells.some(c => journey.dig[c.id] !== undefined)) {
    const units = soilUnits(site);
    sites[site.id] = { layout: 1, levels: site.grid.levels,
      outcomes: Object.fromEntries(units.map(unit => [unit.id, coinOutcome(seed, unit.id)])),
      excluded: units.filter(unit => layerCleared(journey.dig, unit.cellId, unit.layer, site.grid.levels)).map(unit => unit.id), claimed: [] };
  }
  return { ...journey, version: 13, economy: { version: 1, seed, coins: 20, sites } };
}
