import { ECONOMY } from '../content/economy.ts';
import { SITES } from '../content/journey.ts';
import type { DigSite } from '../content/journey.ts';
import type { JourneyState } from './journey.ts';

export type CoinManifest = {
  layout: 1; levels: number;
  outcomes: Record<string, number>;
  excluded: string[];
  claimed: string[];
};
export type EconomyState = { version: 1; seed: number; coins: number; sites: Record<string, CoinManifest> };
export type GameSave = Omit<JourneyState, 'version'> & { version: 13; economy: EconomyState };
export const journeyOf = ({ economy: _economy, ...save }: GameSave): JourneyState => ({ ...save, version: 12 });
export const soilKey = (site: DigSite, cellId: string, layer: number) => `${site.id}/v1/${cellId}/${layer}`;
export const soilUnits = (site: DigSite) => site.cells.flatMap(cell => Array.from({ length: site.grid.levels }, (_, layer) => ({
  id: soilKey(site, cell.id, layer), cellId: cell.id, layer,
})));
export const layerCleared = (dig: Record<string, number>, cellId: string, layer: number, levels: number) =>
  (dig[cellId] ?? 0) * levels + 1e-9 >= layer + 1;

// Version 1: stable integer hash, independent of iteration order and live RNG.
// Store the resulting manifest too; later generators must not reroll existing soil.
export function coinOutcome(seed: number, key: string) {
  let hash = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15; hash = Math.imul(hash, 0x846ca68b); hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296 < ECONOMY.dropChance ? ECONOMY.dropCoins : 0;
}
function manifest(site: DigSite, dig: Record<string, number>, seed: number): CoinManifest {
  const units = soilUnits(site);
  return { layout: ECONOMY.layoutRevision, levels: site.grid.levels,
    outcomes: Object.fromEntries(units.map(unit => [unit.id, coinOutcome(seed, unit.id)])),
    excluded: units.filter(unit => layerCleared(dig, unit.cellId, unit.layer, site.grid.levels)).map(unit => unit.id), claimed: [] };
}

export function createGameSave(journey: JourneyState, seed: number): GameSave {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Invalid economy seed');
  const sites: Record<string, CoinManifest> = {};
  for (const site of SITES) if (site === SITES[0] || site.id === journey.activeSiteId
    || site.cells.some(cell => journey.dig[cell.id] !== undefined)) sites[site.id] = manifest(site, journey.dig, seed);
  return { ...journey, version: 13, economy: { version: 1, seed, coins: ECONOMY.startingCoins, sites } };
}

// Called once for every accepted journey transition, including cleanup. Only
// newly cleared soil pays; rendering, repeated commands and migration never do.
export function advanceEconomy(save: GameSave, next: JourneyState): GameSave {
  if (!Number.isSafeInteger(save.economy.coins) || save.economy.coins < 0) return save;
  const sites = { ...save.economy.sites };
  const entering = SITES.find(site => site.id === next.activeSiteId);
  if (!entering) return save;
  if (!sites[entering.id]) sites[entering.id] = manifest(entering, save.dig, save.economy.seed);
  let coins = save.economy.coins;
  for (const site of SITES) {
    const reward = sites[site.id];
    if (!reward) continue;
    const claimed = [...reward.claimed];
    for (const unit of soilUnits(site)) {
      if (layerCleared(save.dig, unit.cellId, unit.layer, reward.levels)
        || !layerCleared(next.dig, unit.cellId, unit.layer, reward.levels)
        || reward.excluded.includes(unit.id) || claimed.includes(unit.id) || !reward.outcomes[unit.id]) continue;
      const amount = reward.outcomes[unit.id];
      if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(coins + amount)) return save;
      claimed.push(unit.id); coins += amount;
    }
    if (claimed.length !== reward.claimed.length) sites[site.id] = { ...reward, claimed };
  }
  return { ...next, version: 13, economy: { ...save.economy, coins, sites } };
}
