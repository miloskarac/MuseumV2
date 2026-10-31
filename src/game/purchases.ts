import { PURCHASES, purchaseDefinition, standOffer } from '../content/purchases.ts';
import type { PurchaseId } from '../content/purchases.ts';
import { EXHIBITS, exhibitDefinition } from '../content/exhibit.ts';
import type { ExhibitId } from '../content/exhibit.ts';
import { SITE } from '../content/journey.ts';
import { createGameSave, advanceEconomy, journeyOf } from './economy.ts';
import type { GameSave } from './economy.ts';
import { freshJourney } from './journey.ts';
import type { JourneyState } from './journey.ts';
import { exhibitComplete, placeGroup } from './assembly.ts';
import type { TravelSave } from './world-map.ts';
import type { TicketSave } from './visitors.ts';
import type { HelperPlaySave } from './helpers.ts';
import { settleDeliveries } from './storage.ts';

export type Ownership = { id: PurchaseId; source: 'purchase' | 'legacy'; paid: number };
export type MuseumSave = Omit<GameSave, 'version'> & { version: 14; museum: { version: 1; owned: Ownership[] } };
export type PlaySave = GameSave | MuseumSave | TravelSave | TicketSave | HelperPlaySave;
export function economyOf(save: PlaySave): GameSave {
  if (save.version === 13) return save;
  const withoutPayments = 'payments' in save ? (({ payments: _payments, ...rest }) => rest)(save) : save;
  const withoutUpgrades = 'upgrades' in withoutPayments ? (({ upgrades: _upgrades, ...rest }) => rest)(withoutPayments) : withoutPayments;
  const withoutCustody = 'custody' in withoutUpgrades ? (({ custody: _custody, ...rest }) => rest)(withoutUpgrades) : withoutUpgrades;
  const withoutHelpers = 'helpers' in withoutCustody ? (({ helpers: _helpers, ...rest }) => rest)(withoutCustody) : withoutCustody;
  const withoutVisitors = 'visitors' in withoutHelpers ? (({ visitors: _visitors, ...rest }) => rest)(withoutHelpers) : withoutHelpers;
  const withoutWorld = 'world' in withoutVisitors ? (({ world: _world, ...rest }) => rest)(withoutVisitors) : withoutVisitors;
  const { museum: _museum, ...base } = withoutWorld;
  return { ...base, version: 13 };
}
export const museumJourney = (save: PlaySave) => journeyOf(economyOf(save));
export const owns = (save: MuseumSave | TravelSave | TicketSave | HelperPlaySave, id: string) => save.museum.owned.some(item => item.id === id);
export const standAvailable = (save: PlaySave, id: ExhibitId) => save.version === 13
  || owns(save, standOffer(id).id) && (id !== 'eryops' || owns(save, 'west-wing'));
export const displayedExhibits = (save: PlaySave) => EXHIBITS.filter(exhibit =>
  standAvailable(save, exhibit.id) && exhibitComplete(museumJourney(save), exhibit.id)).map(exhibit => exhibit.id);

export function createMuseumSave(seed: number): MuseumSave {
  return { ...createGameSave(freshJourney(), seed), version: 14, museum: { version: 1, owned: [] } };
}
// Old games already had every stand and the whole hall, including empty ones.
export function migrateMuseumSave(save: GameSave): MuseumSave {
  return { ...save, version: 14, museum: { version: 1,
    owned: PURCHASES.map(offer => ({ id: offer.id, source: 'legacy', paid: 0 })) } };
}
export function advanceMuseum(save: PlaySave, next: JourneyState): PlaySave {
  const base = economyOf(save), result = advanceEconomy(base, next);
  if (result === base) return save;
  if (save.version === 13) return result;
  if (save.version === 14) return { ...result, version: 14, museum: save.museum };
  const travel: TravelSave = { ...result, version: 15, museum: save.museum, world: { ...save.world,
    location: next.room === 'museum' ? { kind: 'hub' } : {
      kind: next.room === 'outdoors' ? 'site-camp' : 'site-pit', siteId: next.activeSiteId } } };
  if (save.version === 15) return travel;
  const ticket: TicketSave = { ...travel, version: 16, visitors: next.room === 'museum' ? save.visitors
    : { ...save.visitors, visits: save.visitors.visits.filter(v => !v.paid) } };
  if (save.version === 16) return ticket;
  const helper = { ...ticket, version: 17 as const, helpers: { ...save.helpers,
    owned: save.helpers.owned.map(h => ({ ...h, phase: h.task ? 'paused' as const : 'idle' as const })) } };
  if (save.version === 17) return helper;
  const stored = { ...ticket, version: 18 as const, helpers: save.helpers, custody: save.custody };
  const upgraded = 'upgrades' in save ? { ...stored, version: 19 as const, upgrades: save.upgrades } : stored;
  const current = 'payments' in save ? { ...upgraded, version: 20 as const, upgrades: save.upgrades, payments: save.payments } : upgraded;
  return next.room !== save.room || next.activeSiteId !== save.activeSiteId ? settleDeliveries({ ...current,
    helpers: { ...save.helpers, owned: save.helpers.owned.map(h => ({ ...h, phase: h.task ? 'paused' as const : 'idle' as const })) } }) : current;
}
export type PurchaseStatus = 'ready' | 'owned' | 'unknown' | 'notHere' | 'displayFirst' | 'wingFirst' | 'siteFirst' | 'insufficient';
export const remainingPurchaseCost = (save: PlaySave, id: string) => {
  const offer = purchaseDefinition(id);
  return offer ? offer.cost - ('payments' in save ? save.payments.partial[offer.id] ?? 0 : 0) : 0;
};
export function purchaseStatus(save: MuseumSave | TravelSave | TicketSave | HelperPlaySave, id: string): PurchaseStatus {
  const offer = purchaseDefinition(id);
  if (!offer) return 'unknown';
  if (owns(save, id)) return 'owned';
  if (save.room !== 'museum') return 'notHere';
  if (offer.id === 'stand-eryops' && !owns(save, 'west-wing')) return 'wingFirst';
  if (offer.id === 'stand-eryops' && ('world' in save
    ? !save.world.owned.some(item => item.id === 'eryops-dig') : !save.closedSites.includes(SITE.id))) return 'siteFirst';
  if ((offer.kind === 'expansion' || offer.id === 'stand-eryops') && !displayedExhibits(save).length) return 'displayFirst';
  if (!Number.isSafeInteger(save.economy.coins) || save.economy.coins < remainingPurchaseCost(save, id)) return 'insufficient';
  return 'ready';
}
export function buyPurchase<T extends MuseumSave | TravelSave | TicketSave | HelperPlaySave>(save: T, id: string): T {
  if (purchaseStatus(save, id) !== 'ready') return save;
  const offer = purchaseDefinition(id)!;
  const payment = 'payments' in save ? { ...save.payments.partial } : undefined;
  if (payment) delete payment[offer.id];
  return { ...save, ...('payments' in save ? { payments: { version: 1 as const, partial: payment! } } : {}),
    economy: { ...save.economy, coins: save.economy.coins - remainingPurchaseCost(save, id) },
    museum: { ...save.museum, owned: [...save.museum.owned, { id: offer.id, source: 'purchase', paid: offer.cost }] } };
}
// Ownership is checked here as well as in UI interaction guards.
export function placeOwnedGroup(save: PlaySave, exhibit: ExhibitId, group: string, target: string): JourneyState {
  const state = museumJourney(save);
  if (!standAvailable(save, exhibit) || !(exhibitDefinition(exhibit).parts as readonly string[]).includes(group)) return state;
  return placeGroup(state, group, target);
}
