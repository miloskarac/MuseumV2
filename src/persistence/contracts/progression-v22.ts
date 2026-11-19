// Ownership/progression rules embedded in V2 schemas 14–22. Only persisted
// identities, prices and prerequisites belong here, never live catalogs/UI data.
import { freeze, GROUPS, ERYOPS_GROUPS, SLAB_PART, SITE, ERYOPS_SITE, SITES, allRecovered, isUncovered, completionPhase } from './journey-v12.ts';
import type { JourneyState } from '../../game/journey.ts';
import type { HelperTask } from '../../game/helpers.ts';
import type { MuseumSave } from '../../game/purchases.ts';
import type { TravelSave, WorldLocation } from '../../game/world-map.ts';

export const PURCHASES = freeze([
  { id: 'stand-dimetrodon', cost: 12 }, { id: 'stand-trilobite', cost: 8 },
  { id: 'west-wing', cost: 18 }, { id: 'stand-eryops', cost: 12 },
] as const);
export const EXHIBITS = freeze([
  { id: 'dimetrodon', stand: 'stand-dimetrodon', parts: GROUPS.map(p => p.id) },
  { id: 'trilobite', stand: 'stand-trilobite', parts: [SLAB_PART.id] },
  { id: 'eryops', stand: 'stand-eryops', parts: ERYOPS_GROUPS.map(p => p.id) },
]);
export const MAP_SITES = freeze([{ id: 'courtyard-dig', cost: 0, playable: true }, { id: 'eryops-dig', cost: 24, playable: true }]);
export const HELPERS = freeze({ cost: 60, available: 1 });
export const UPGRADES = freeze([{ id: 'boots', cost: 16 }, { id: 'shovel', cost: 24 }, { id: 'helper-tools', cost: 30 }]);
export const VISITORS = freeze({ capacity: 6, queueCapacity: 3 });
export const purchaseDefinition = (id: string) => PURCHASES.find(p => p.id === id);
export const mapSite = (id: string) => MAP_SITES.find(site => site.id === id);
type MuseumProgress = { placed: readonly string[]; museum: { owned: readonly { id: string }[] } };
type SiteProgress = { world: { owned: readonly { id: string }[] } };
export const owns = (save: MuseumProgress, id: string) => save.museum.owned.some(item => item.id === id);
export const standAvailable = (save: MuseumProgress, id: string) => {
  const exhibit = EXHIBITS.find(e => e.id === id);
  return !!exhibit && owns(save, exhibit.stand) && (id !== 'eryops' || owns(save, 'west-wing'));
};
export const displayedExhibits = (save: MuseumProgress) => EXHIBITS.filter(e => standAvailable(save, e.id)
  && e.parts.every(part => save.placed.includes(part))).map(e => e.id);
export const ticketPrice = (save: MuseumProgress) => { const count = displayedExhibits(save).length; return count ? 1 + count : 0; };
export const siteOwned = (save: SiteProgress, id: string) => id === SITE.id || !!mapSite(id)?.playable && save.world.owned.some(item => item.id === id);
export function validDeposit(save: MuseumProgress, id: string) {
  return !!purchaseDefinition(id) && !owns(save, id) && (id !== 'stand-eryops' || owns(save, 'west-wing'))
    && (id !== 'west-wing' || displayedExhibits(save).length > 0);
}
export function migrateTravel(save: MuseumSave): TravelSave {
  const earned = save.closedSites.includes(SITE.id) || ERYOPS_SITE.cells.some(cell => save.dig[cell.id] !== undefined);
  let location: WorldLocation = save.room === 'excavation'
    ? { kind: save.closedSites.includes(save.activeSiteId) ? 'site-camp' : 'site-pit', siteId: save.activeSiteId } : { kind: 'hub' };
  if (save.room === 'outdoors' && completionPhase(save) === 'exit') location = { kind: 'site-camp', siteId: save.activeSiteId };
  return { ...save, version: 15, room: location.kind === 'hub' ? 'museum' : location.kind === 'site-pit' ? 'excavation' : 'outdoors',
    world: { version: 1, location, owned: earned ? [{ id: ERYOPS_SITE.id, source: 'legacy', paid: 0 }] : [] } };
}
type HelperProgress = Omit<JourneyState, 'version'> & SiteProgress & { version: number; helpers: { nextTask: number } };
// Private helper tasks record seconds of base work. Pin the two-hit, half-hit
// per 1.5s interpretation and schema-17 no-exposure rule, not live helper speed.
export function validHelperTask(save: HelperProgress, task: HelperTask) {
  const site = SITES.find(s => s.id === task.siteId);
  if (!site || !siteOwned(save, site.id) || allRecovered(save, site) || save.closedSites.includes(site.id)) return false;
  const levels = site.grid.levels, cell = site.cells.find(c => c.id === task.cellId), start = save.dig[task.cellId] ?? 0;
  const layer = site.cells.reduce((min, c) => {
    const hits = Math.min(levels * 2, Math.floor((save.dig[c.id] ?? 0) * levels * 2 + 1e-9));
    return Math.min(min, Math.floor(hits / 2));
  }, levels);
  if (!cell || layer >= levels || Math.floor(start * levels + 1e-9) !== layer) return false;
  const end = (layer + 1) / levels;
  if (save.version === 17 && site.requiredDiscoveryIds.some(id => !isUncovered(save, id)
    && isUncovered({ dig: { ...save.dig, [task.cellId]: end } }, id))) return false;
  const required = (end - start) * levels * 2 / 0.5 * 1.5;
  return layer === task.layer && start === task.start && Math.abs(required - task.required) < 1e-9
    && Number.isSafeInteger(task.id) && task.id > 0 && task.id < save.helpers.nextTask
    && Number.isFinite(task.work) && task.work >= 0 && task.work < task.required;
}
