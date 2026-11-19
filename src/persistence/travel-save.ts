import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
import { parseMuseumSave } from './museum-save.ts';
import { SITE, ERYOPS_SITE, SITES } from './contracts/journey-v12.ts';
import { mapSite, siteOwned } from './contracts/progression-v22.ts';
import { createTravelSave, migrateTravelSave } from '../game/world-map.ts';
import type { TravelSave, WorldLocation, SiteOwnership } from '../game/world-map.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseTravelSave(raw: string, seed: number, validatedTicketIncome = 0, rules: ProgressionReadRules = HISTORICAL_READ_RULES): TravelSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 15) {
      const old = parseMuseumSave(raw, seed);
      return old ? migrateTravelSave(old) : null;
    }
    const { world, ...base } = value;
    if (!record(world) || world.version !== 1 || Object.keys(world).length !== 3
      || !Array.isArray(world.owned) || world.owned.length > 1 || !record(base.economy)) return null;
    let spent = 0;
    for (const item of world.owned) {
      if (!record(item) || Object.keys(item).length !== 3 || item.id !== ERYOPS_SITE.id
        || (item.source !== 'purchase' && item.source !== 'legacy')
        || item.paid !== (item.source === 'purchase' ? rules.siteCost(ERYOPS_SITE.id) : 0)) return null;
      spent += Number(item.paid);
    }
    const owned = world.owned as SiteOwnership[];
    if (!Number.isSafeInteger(base.economy.coins) || Number(base.economy.coins) < 0) return null;
    // Location is recoverable metadata; the independent economic/progress snapshot is not.
    const l = world.location;
    let location: WorldLocation = { kind: 'hub' };
    if (record(l) && (l.kind === 'site-camp' || l.kind === 'site-pit') && Object.keys(l).length === 2
      && typeof l.siteId === 'string' && mapSite(l.siteId)?.playable
      && (l.siteId === SITE.id || owned.some(item => item.id === l.siteId))) {
      location = { kind: l.kind, siteId: l.siteId };
    }
    const activeSiteId = location.kind !== 'hub' ? location.siteId
      : SITES.some(site => site.id === base.activeSiteId && (site.id === SITE.id || owned.some(item => item.id === site.id))) ? base.activeSiteId : SITE.id;
    const room = location.kind === 'hub' ? 'museum' : location.kind === 'site-camp' ? 'outdoors' : 'excavation';
    const museum = parseMuseumSave(JSON.stringify({ ...base, version: 14, room, activeSiteId,
      economy: { ...base.economy, coins: Number(base.economy.coins) + spent } }), seed, validatedTicketIncome, rules);
    if (!museum) return null;
    const save: TravelSave = { ...museum, version: 15, economy: { ...museum.economy, coins: Number(base.economy.coins) },
      world: { version: 1, location, owned } };
    if (!rules.siteRequirements(save)) return null;
    if (!siteOwned(save, ERYOPS_SITE.id) && (save.economy.sites[ERYOPS_SITE.id]
      || ERYOPS_SITE.cells.some(cell => save.dig[cell.id] !== undefined))) return null;
    if (location.kind === 'site-pit' && save.closedSites.includes(location.siteId)) {
      save.world.location = { ...location, kind: 'site-camp' }; save.room = 'outdoors';
    }
    return save;
  } catch { return null; }
}
export function loadTravelSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: TravelSave; restored: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createTravelSave(seed), restored: false };
    const save = parseTravelSave(raw, seed);
    return save ? { kind: 'ready', save, restored: true } : { kind: 'invalid' };
  } catch { return { kind: 'unavailable' }; }
}
