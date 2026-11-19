import { mvpRecoveredFirst, mvpDisplay, mvpSale, mvpRecoverEryops } from './mvp-fixture.ts';
import { buyPurchase, advanceMuseum, museumJourney } from '../../src/game/purchases.ts';
import { buySite, travelTo } from '../../src/game/world-map.ts';
import { migrateRoom1Game } from '../../src/game/room1-economy.ts';
import type { Room1GameSave } from '../../src/game/room1-economy.ts';
import { brush, collectFossil } from '../../src/game/journey.ts';
import { WALCHIA_PART } from '../../src/content/exhibit.ts';
import { stepCompletion } from '../../src/game/site-completion.ts';
import { activeSite } from '../../src/content/journey.ts';

export function room1BeforeSite2() {
  let s = mvpDisplay(buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon'), 'dimetrodon');
  s = mvpDisplay(buyPurchase(s, 'stand-trilobite'), 'trilobite');
  for (let i = 0; i < 8; i++) s = mvpSale(s);
  return buySite(buyPurchase(s, 'stand-eryops'), 'eryops-dig');
}
export const threeRoom1Displays = () => migrateRoom1Game(mvpDisplay(mvpRecoverEryops(room1BeforeSite2()), 'eryops'));
export function recoverWalchia(save: Room1GameSave): Room1GameSave {
  let s = travelTo(travelTo(save, { kind: 'site-camp', siteId: 'eryops-dig' }), { kind: 'site-pit', siteId: 'eryops-dig' });
  // Fixture requires previously exposed soil; actual brush/collection commands.
  for (let y = 0; y <= 1; y += 0.1) s = advanceMuseum(s, brush(museumJourney(s), { x: 0, y }, { x: 1, y }, WALCHIA_PART.discoveryId)) as Room1GameSave;
  s = advanceMuseum(s, collectFossil(museumJourney(s), WALCHIA_PART.discoveryId)) as Room1GameSave;
  let position = { ...activeSite(s).interaction };
  for (let n = 0; n < 300 && !s.closedSites.includes('eryops-dig'); n++) {
    const state = museumJourney(s), next = stepCompletion(state, position, 0.05, null, true);
    if (next.state === state && next.position === position) break;
    s = advanceMuseum(s, next.state) as Room1GameSave; position = next.position;
  }
  return travelTo(s, { kind: 'hub' });
}
