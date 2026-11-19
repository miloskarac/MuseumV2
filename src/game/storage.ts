import type { Room1GameSave } from './room1-economy.ts';
import type { MvpSave } from './mvp-economy.ts';
import { sitesFor } from '../content/journey.ts';
import { storageApproach } from '../content/storage.ts';
import { brush, collectFossil, isUncovered, pendingDiscovery } from './journey.ts';
import type { BrushPoint } from './journey.ts';
import { advanceMuseum, museumJourney } from './purchases.ts';
import { createHelperSave } from './helpers.ts';
import type { UpgradeSave } from './upgrades.ts';
import type { CashSave } from './cash.ts';
import type { LedgerSave } from './ticket-ledger.ts';
import type { RoomSave } from './room-ownership.ts';
import type { CreditSave } from './expansion-credit.ts';
import type { PaymentSave } from './purchase-payments.ts';
import type { HelperSave } from './helpers.ts';
import type { Point } from './navigation.ts';
export type Custody = { siteId: string; location: 'storage' } | { siteId: string; location: 'delivery'; helperId: string };
export type StorageSave = Omit<HelperSave, 'version'> & { version: 18; custody: Record<string, Custody> };
export type StoragePlaySave = StorageSave | UpgradeSave | PaymentSave | CashSave | LedgerSave | RoomSave | CreditSave | MvpSave | Room1GameSave;
export const migrateStorageSave = (save: HelperSave): StorageSave => ({ ...save, version: 18, custody: {} });
export const createStorageSave = (seed: number) => migrateStorageSave(createHelperSave(seed));
export const storedFinds = (save: StoragePlaySave, siteId = save.activeSiteId) => Object.keys(save.custody)
  .filter(id => save.custody[id].siteId === siteId && save.custody[id].location === 'storage');
export const carriedFinds = (save: StoragePlaySave, helperId = 'helper-1') => Object.keys(save.custody)
  .filter(id => save.custody[id].location === 'delivery' && save.custody[id].helperId === helperId);
export const manualDiscovery = (save: StoragePlaySave) => pendingDiscovery(museumJourney(save), Object.keys(save.custody));
export function claimHelperFinds<T extends StoragePlaySave>(before: StoragePlaySave, after: T): T {
  const state = museumJourney(before), next = museumJourney(after), custody = { ...after.custody };
  let changed = false;
  for (const id of sitesFor(after).find(s => s.id === after.activeSiteId)!.requiredDiscoveryIds) {
    if (!isUncovered(state, id) && isUncovered(next, id) && !before.cleaning[id] && !after.collected.includes(id) && !custody[id]) {
      custody[id] = { siteId: after.activeSiteId, location: 'delivery', helperId: 'helper-1' }; changed = true;
    }
  }
  return changed ? { ...after, custody } : after;
}
export function settleDeliveries<T extends HelperSave | StoragePlaySave>(save: T, helperId?: string): T {
  if (!('custody' in save)) return save;
  const ids = Object.keys(save.custody).filter(id => { const c = save.custody[id]; return c.location === 'delivery' && (!helperId || c.helperId === helperId); });
  if (!ids.length) return save;
  const custody = { ...save.custody };
  for (const id of ids) custody[id] = { siteId: custody[id].siteId, location: 'storage' };
  return { ...save, custody };
}
export const atStorage = (save: StoragePlaySave, position: Point) => (save.room === 'excavation' || save.room === 'outdoors')
  && Math.hypot(position.x - storageApproach(save).x, position.z - storageApproach(save).z) <= 1.2;
export function depositAtBox<T extends StoragePlaySave>(save: T, position: Point): T {
  const carried = carriedFinds(save);
  return !carried.length || !atStorage(save, position) || carried.some(id => save.custody[id].siteId !== save.activeSiteId)
    ? save : settleDeliveries(save, 'helper-1');
}
export const canCleanStored = (save: StoragePlaySave, id: string) => (save.room === 'excavation' || save.room === 'outdoors')
  && save.custody[id]?.siteId === save.activeSiteId && save.custody[id]?.location === 'storage' && !save.collected.includes(id);
export function brushStored<T extends StoragePlaySave>(save: T, id: string, from: BrushPoint, to: BrushPoint): T {
  if (!canCleanStored(save, id)) return save;
  const view = { ...museumJourney(save), room: 'excavation' as const }, next = brush(view, from, to, id);
  return next === view ? save : advanceMuseum(save, { ...next, room: save.room }) as T;
}
export function collectStored<T extends StoragePlaySave>(save: T, id: string): T {
  if (!canCleanStored(save, id)) return save;
  const view = { ...museumJourney(save), room: 'excavation' as const }, next = collectFossil(view, id);
  if (next === view) return save;
  const custody = { ...save.custody }; delete custody[id];
  return { ...advanceMuseum(save, { ...next, room: save.room }) as T, custody };
}
