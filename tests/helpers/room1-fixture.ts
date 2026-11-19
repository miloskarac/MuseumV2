import { createCreditSave } from '../../src/game/expansion-credit.ts';
import type { CreditSave } from '../../src/game/expansion-credit.ts';
import { advanceMuseum, buyPurchase, museumJourney, placeOwnedGroup } from '../../src/game/purchases.ts';
import { arriveVisitor, finishVisit, payVisitor } from '../../src/game/visitors.ts';
import { collectTicketRevenue } from '../../src/game/cash.ts';
import { buySite } from '../../src/game/world-map.ts';
import { SITE, ERYOPS_SITE } from '../../src/content/journey.ts';
import { EXHIBITS } from '../../src/content/exhibit.ts';
import type { ExhibitId } from '../../src/content/exhibit.ts';
import { CASHIER_STATION } from '../../src/content/visitors.ts';

export function room1Display(save: CreditSave, id: ExhibitId): CreditSave {
  for (const part of EXHIBITS.find(e => e.id === id)!.parts)
    save = advanceMuseum(save, placeOwnedGroup(save, id, part, part)) as CreditSave;
  return save;
}
export function room1Earn(save: CreditSave, count: number): CreditSave {
  for (let i = 0; i < count; i++) {
    save = arriveVisitor(save);
    const id = save.visitors.nextId - 1;
    save = collectTicketRevenue(finishVisit(payVisitor(save, id, CASHIER_STATION, true), id));
  }
  return save;
}
export function room1Recovered(): CreditSave {
  let save = createCreditSave(42);
  const recover = (site: typeof SITE | typeof ERYOPS_SITE) => {
    save = advanceMuseum(save, { ...museumJourney(save), activeSiteId: site.id,
      dig: { ...save.dig, ...Object.fromEntries(site.cells.map(c => [c.id, 1])) },
      collected: [...save.collected, ...site.requiredDiscoveryIds], closedSites: [...save.closedSites, site.id],
    }) as CreditSave;
  };
  recover(SITE);
  save = room1Display(buyPurchase(save, 'stand-trilobite'), 'trilobite');
  save = room1Earn(save, 80);
  save = buySite(save, ERYOPS_SITE.id);
  recover(ERYOPS_SITE);
  return save;
}
