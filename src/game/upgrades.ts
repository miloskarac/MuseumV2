import type { Room1GameSave } from './room1-economy.ts';
import type { MvpSave } from './mvp-economy.ts';
import { UPGRADES } from '../content/upgrades.ts';
import { SITES } from '../content/journey.ts';
import { createStorageSave } from './storage.ts';
import type { StorageSave } from './storage.ts';
import { ownsUpgrade } from './upgrade-stats.ts';
import type { UpgradeState, UpgradeReceipt } from './upgrade-stats.ts';
import { helperLayer } from './helpers.ts';
import { displayedExhibits } from './purchases.ts';
import type { CashSave } from './cash.ts';
import type { LedgerSave } from './ticket-ledger.ts';
import type { RoomSave } from './room-ownership.ts';
import type { CreditSave } from './expansion-credit.ts';
import type { PaymentSave } from './purchase-payments.ts';
export type UpgradeSave = Omit<StorageSave, 'version'> & { version: 19; upgrades: UpgradeState };
export type UpgradePlaySave = UpgradeSave | PaymentSave | CashSave | LedgerSave | RoomSave | CreditSave | MvpSave | Room1GameSave;
export const migrateUpgradeSave = (save: StorageSave): UpgradeSave => ({ ...save, version: 19, upgrades: { version: 1, owned: [] } });
export const createUpgradeSave = (seed: number) => migrateUpgradeSave(createStorageSave(seed));
export type UpgradeStatus = 'ready' | 'owned' | 'unknown' | 'notHere' | 'displayFirst' | 'helperFirst' | 'exhausted' | 'insufficient';
export function upgradeStatus(save: UpgradePlaySave, id: string): UpgradeStatus {
  const offer = UPGRADES.find(o => o.id === id);
  if (!offer) return 'unknown';
  if (ownsUpgrade(save, offer.id)) return 'owned';
  if (save.room !== 'museum') return 'notHere';
  if (offer.id === 'helper-tools' ? !save.helpers.owned.some(h => h.id === 'helper-1') : !displayedExhibits(save).length)
    return offer.id === 'helper-tools' ? 'helperFirst' : 'displayFirst';
  if (offer.id !== 'boots' && !SITES.some(s => s.cells.some(c => helperLayer(save, s.id, c.id)))) return 'exhausted';
  if (!Number.isSafeInteger(save.economy.coins) || save.economy.coins < offer.cost) return 'insufficient';
  return 'ready';
}
export function buyUpgrade<T extends UpgradePlaySave>(save: T, id: string): T {
  if (upgradeStatus(save, id) !== 'ready') return save;
  const offer = UPGRADES.find(o => o.id === id)!;
  const receipt: UpgradeReceipt = offer.id === 'helper-tools'
    ? { id: offer.id, paid: offer.cost, helperId: 'helper-1' } : { id: offer.id, paid: offer.cost };
  return { ...save, economy: { ...save.economy, coins: save.economy.coins - offer.cost },
    upgrades: { version: 1, owned: [...save.upgrades.owned, receipt] } };
}
