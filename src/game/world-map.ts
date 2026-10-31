import type { HelperPlaySave } from './helpers.ts';
import type { TicketSave } from './visitors.ts';
import { SITE, ERYOPS_SITE, SITES, siteFront } from '../content/journey.ts';
import { mapSite } from '../content/world-map.ts';
import { createMuseumSave, advanceMuseum, displayedExhibits, museumJourney } from './purchases.ts';
import type { MuseumSave } from './purchases.ts';
import { completionPhase } from './site-completion.ts';
import { ARRIVAL, footprint } from './navigation.ts';
import { sitePlot } from '../content/journey.ts';

export type WorldLocation = { kind: 'hub' } | { kind: 'site-camp' | 'site-pit'; siteId: string };
export type SiteOwnership = { id: string; source: 'purchase' | 'legacy'; paid: number };
export type TravelSave = Omit<MuseumSave, 'version'> & { version: 15;
  world: { version: 1; location: WorldLocation; owned: SiteOwnership[] } };
export const siteOwned = (save: TravelSave | TicketSave | HelperPlaySave, id: string) => id === SITE.id
  || !!mapSite(id)?.playable && save.world.owned.some(item => item.id === id);
export const travelBusy = (save: TravelSave | TicketSave | HelperPlaySave) => {
  const phase = completionPhase(museumJourney(save));
  return phase === 'cleanup' || phase === 'exit';
};
export function createTravelSave(seed: number): TravelSave {
  return { ...createMuseumSave(seed), version: 15, world: { version: 1, location: { kind: 'hub' }, owned: [] } };
}
export function migrateTravelSave(save: MuseumSave): TravelSave {
  const earned = save.closedSites.includes(SITE.id)
    || ERYOPS_SITE.cells.some(cell => save.dig[cell.id] !== undefined);
  let location: WorldLocation = save.room === 'excavation'
    ? { kind: save.closedSites.includes(save.activeSiteId) ? 'site-camp' : 'site-pit', siteId: save.activeSiteId }
    : { kind: 'hub' };
  // Keep an interrupted automatic exit in its camp so closure can finish.
  if (save.room === 'outdoors' && completionPhase(museumJourney(save)) === 'exit') {
    location = { kind: 'site-camp', siteId: save.activeSiteId };
  }
  return { ...save, version: 15, room: location.kind === 'hub' ? 'museum' : location.kind === 'site-pit' ? 'excavation' : 'outdoors',
    world: { version: 1, location, owned: earned ? [{ id: ERYOPS_SITE.id, source: 'legacy', paid: 0 }] : [] } };
}
export type SitePurchaseStatus = 'ready' | 'owned' | 'future' | 'busy' | 'siteFirst' | 'displayFirst' | 'insufficient';
export function sitePurchaseStatus(save: TravelSave | TicketSave | HelperPlaySave, id: string): SitePurchaseStatus {
  const site = mapSite(id);
  if (!site?.playable) return 'future';
  if (siteOwned(save, id)) return 'owned';
  if (travelBusy(save)) return 'busy';
  if (!save.closedSites.includes(SITE.id)) return 'siteFirst';
  if (!displayedExhibits(save).length) return 'displayFirst';
  if (!Number.isSafeInteger(save.economy.coins) || save.economy.coins < site.cost) return 'insufficient';
  return 'ready';
}
export function buySite<T extends TravelSave | TicketSave | HelperPlaySave>(save: T, id: string): T {
  if (sitePurchaseStatus(save, id) !== 'ready') return save;
  const site = mapSite(id)!;
  return { ...save, economy: { ...save.economy, coins: save.economy.coins - site.cost },
    world: { ...save.world, owned: [...save.world.owned, { id, source: 'purchase', paid: site.cost }] } };
}
export function travelTo<T extends TravelSave | TicketSave | HelperPlaySave>(save: T, destination: WorldLocation): T {
  if (travelBusy(save)) return save;
  if (destination.kind !== 'hub' && (!siteOwned(save, destination.siteId) || !mapSite(destination.siteId)?.playable)) return save;
  // Pits can only be entered from their own camp, never through a map shortcut.
  if (destination.kind === 'site-pit' && (save.world.location.kind !== 'site-camp'
    || save.world.location.siteId !== destination.siteId || save.closedSites.includes(destination.siteId))) return save;
  const room = destination.kind === 'hub' ? 'museum' : destination.kind === 'site-camp' ? 'outdoors' : 'excavation';
  const next = advanceMuseum(save, { ...museumJourney(save), room,
    activeSiteId: destination.kind === 'hub' ? save.activeSiteId : destination.siteId }) as T;
  return { ...next, world: { ...save.world, location: destination } };
}
export function travelSpawn(save: TravelSave | TicketSave | HelperPlaySave) {
  const location = save.world.location;
  if (location.kind === 'hub') return { ...ARRIVAL };
  const site = SITES.find(site => site.id === location.siteId)!;
  if (location.kind === 'site-pit') return { ...site.interaction };
  return completionPhase(museumJourney(save)) === 'exit' ? { ...sitePlot(site).entrance } : siteFront(site);
}
export const campObstacles = (id: string) => {
  const site = SITES.find(site => site.id === id)!;
  return [footprint({ ...sitePlot(site), width: 2.8, depth: 2.4 })];
};
