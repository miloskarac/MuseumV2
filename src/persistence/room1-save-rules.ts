// Schema 24 retains its data shape, prices and receipts. Only the approved
// Eryops prerequisite differs. Never infer this policy from untrusted save data.
import * as historical from './contracts/progression-v22.ts';
import type { TravelSave } from '../game/world-map.ts';
import { parseSave } from './save.ts';
import { SITES, isUncovered } from './contracts/journey-v12.ts';
export const HISTORICAL_READ_RULES = {
  extraPurchases: [] as readonly { id: string; cost: number }[],
  exhibits: historical.EXHIBITS as readonly { id: string; parts: readonly string[] }[],
  parseJourney: parseSave,
  custodySite: (id: string): string | undefined => SITES.find(s => s.requiredDiscoveryIds.includes(id))?.id,
  isUncovered,
  validHelperTask: historical.validHelperTask,
  visitorLimits: { waiting: historical.VISITORS.queueCapacity as number, admitted: historical.VISITORS.capacity as number, total: historical.VISITORS.capacity as number },
  requiresWestWing: true,
  standAvailable: historical.standAvailable,
  displayedExhibits: historical.displayedExhibits,
  ticketPrice: historical.ticketPrice,
  validDeposit: historical.validDeposit,
  purchaseCost: (id: string): number => historical.purchaseDefinition(id)?.cost ?? 0,
  siteCost: (id: string): number => historical.mapSite(id)?.cost ?? 0,
  siteRequirements: (save: TravelSave) => (!save.world.owned.length || save.closedSites.includes('courtyard-dig'))
    && (!save.world.owned.some(o => o.source === 'purchase') || historical.displayedExhibits(save).length > 0),
};
export type ProgressionReadRules = typeof HISTORICAL_READ_RULES;
const standAvailable: typeof historical.standAvailable = (save, id) => {
  const exhibit = historical.EXHIBITS.find(e => e.id === id);
  return !!exhibit && historical.owns(save, exhibit.stand);
};
const displayedExhibits: typeof historical.displayedExhibits = save => historical.EXHIBITS.filter(e =>
  standAvailable(save, e.id) && e.parts.every(p => save.placed.includes(p))).map(e => e.id);
export const ROOM1_READ_RULES: ProgressionReadRules = {
  ...HISTORICAL_READ_RULES,
  requiresWestWing: false, standAvailable, displayedExhibits,
  siteRequirements: save => (!save.world.owned.length || save.closedSites.includes('courtyard-dig'))
    && (!save.world.owned.some(o => o.source === 'purchase') || displayedExhibits(save).length > 0),
  ticketPrice: save => { const count = displayedExhibits(save).length; return count ? 1 + count : 0; },
  // Existing partial wing payments remain valid evidence, although no live
  // interaction can add to them. Their original prerequisite is preserved.
  validDeposit: (save, id) => id === 'stand-eryops' ? !historical.owns(save, id) : historical.validDeposit(save, id),
};
