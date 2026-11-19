import { createMvpSave } from '../../src/game/mvp-economy.ts';
import type { MvpSave } from '../../src/game/mvp-economy.ts';
import { createGameSave } from '../../src/game/economy.ts';
import { advanceMuseum, museumJourney, placeOwnedGroup } from '../../src/game/purchases.ts';
import { EXHIBITS } from '../../src/content/exhibit.ts';
import type { ExhibitId } from '../../src/content/exhibit.ts';
import { SITE, ERYOPS_SITE } from '../../src/content/journey.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../../src/game/visitors.ts';
import { collectTicketRevenue } from '../../src/game/cash.ts';
import { CASHIER_STATION } from '../../src/content/visitors.ts';

// Synthetic recovered free site with excluded soil: no digging-income subsidy.
export function mvpRecoveredFirst(): MvpSave {
  const fresh = createMvpSave(42), journey = { ...museumJourney(fresh),
    dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] };
  return { ...fresh, ...journey, version: 25, economy: createGameSave(journey, 42).economy };
}
export function mvpDisplay(save: MvpSave, id: ExhibitId): MvpSave {
  for (const p of EXHIBITS.find(e => e.id === id)!.parts)
    save = advanceMuseum(save, placeOwnedGroup(save, id, p, p)) as MvpSave;
  return save;
}
export function mvpSale(save: MvpSave, collect = true): MvpSave {
  save = arriveVisitor(save); const id = save.visitors.nextId - 1;
  save = finishVisit(payVisitor(save, id, CASHIER_STATION, true), id);
  return collect ? collectTicketRevenue(save) : save;
}
export function mvpRecoverEryops(save: MvpSave): MvpSave {
  return advanceMuseum(save, { ...museumJourney(save), activeSiteId: ERYOPS_SITE.id,
    dig: { ...save.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) },
    collected: [...save.collected, ...ERYOPS_SITE.requiredDiscoveryIds], closedSites: [...save.closedSites, ERYOPS_SITE.id] }) as MvpSave;
}
