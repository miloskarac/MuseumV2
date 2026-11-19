import { mvpSiteEligible } from './mvp-progression.ts';
import { MAP_SITES as HISTORICAL_SITES } from '../persistence/contracts/progression-v22.ts';
import type { HelperPlaySave } from './helpers.ts';
import type { TicketSave } from './visitors.ts';
import { SITE, SITES, siteFront } from '../content/journey.ts';
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
// Historical migration must not inherit future site/layout definitions.
export { migrateTravel as migrateTravelSave } from '../persistence/contracts/progression-v22.ts';
export type SitePurchaseStatus = 'ready' | 'owned' | 'future' | 'busy' | 'siteFirst' | 'displayFirst' | 'eryopsStandFirst' | 'insufficient';
export const sitePrice = (save: TravelSave | TicketSave | HelperPlaySave, id: string) => ((save.version === 25 || save.version === 26) ? mapSite(id) : HISTORICAL_SITES.find(s => s.id === id))?.cost ?? 0;
export function sitePurchaseStatus(save: TravelSave | TicketSave | HelperPlaySave, id: string): SitePurchaseStatus {
  const site = mapSite(id);
  if (!site?.playable) return 'future';
  if (siteOwned(save, id)) return 'owned';
  if (travelBusy(save)) return 'busy';
  if ((save.version === 25 || save.version === 26)) {
    if (!mvpSiteEligible(save, id)) return 'eryopsStandFirst';
  } else {
    if (!save.closedSites.includes(SITE.id)) return 'siteFirst';
    if (!displayedExhibits(save).length) return 'displayFirst';
  }
  if (!Number.isSafeInteger(save.economy.coins) || save.economy.coins < sitePrice(save, id)) return 'insufficient';
  return 'ready';
}
export function buySite<T extends TravelSave | TicketSave | HelperPlaySave>(save: T, id: string): T {
  if (sitePurchaseStatus(save, id) !== 'ready') return save;
  const cost = sitePrice(save, id);
  return { ...save, economy: { ...save.economy, coins: save.economy.coins - cost },
    world: { ...save.world, owned: [...save.world.owned, { id, source: 'purchase', paid: cost }] } };
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
