import type { Room1GameSave } from './room1-economy.ts';
import type { MvpSave } from './mvp-economy.ts';
import { PURCHASE_PAYMENT, purchaseDefinition } from '../content/purchases.ts';
import type { CashSave } from './cash.ts';
import type { LedgerSave } from './ticket-ledger.ts';
import type { RoomSave } from './room-ownership.ts';
import { syncExpansionCredit } from './expansion-credit.ts';
import type { CreditSave } from './expansion-credit.ts';
import type { PurchaseId } from '../content/purchases.ts';
import { createUpgradeSave } from './upgrades.ts';
import type { UpgradeSave } from './upgrades.ts';
import { buyPurchase, purchaseStatus, remainingPurchaseCost } from './purchases.ts';
import { museumLayout } from './museum-layout.ts';
import type { Point } from './navigation.ts';

export type PaymentSave = Omit<UpgradeSave, 'version'> & { version: 20;
  payments: { version: 1; partial: Partial<Record<PurchaseId, number>> } };
export const migratePaymentSave = (save: UpgradeSave): PaymentSave => ({ ...save, version: 20, payments: { version: 1, partial: {} } });
export const createPaymentSave = (seed: number) => migratePaymentSave(createUpgradeSave(seed));
export const purchaseAt = (save: PaymentSave | CashSave | LedgerSave | RoomSave | CreditSave | MvpSave | Room1GameSave, position: Point) => save.room === 'museum'
  ? museumLayout(save).purchases.find(spot => Math.hypot(position.x - spot.x, position.z - spot.z) <= PURCHASE_PAYMENT.radius)?.id ?? null : null;
export function contributePurchase<T extends PaymentSave | CashSave | LedgerSave | RoomSave | CreditSave | MvpSave | Room1GameSave>(save: T, id: string, position: Point): T {
  if (purchaseAt(save, position) !== id || !Number.isSafeInteger(save.economy.coins) || save.economy.coins < 1) return save;
  const status = purchaseStatus(save, id);
  if (status !== 'ready' && status !== 'insufficient') return save;
  const offer = purchaseDefinition(id)!;
  if (remainingPurchaseCost(save, id) === 1) return buyPurchase(save, id);
  return syncExpansionCredit({ ...save, economy: { ...save.economy, coins: save.economy.coins - 1 },
    payments: { version: 1, partial: { ...save.payments.partial, [id]: (save.payments.partial[offer.id] ?? 0) + 1 } } });
}
// Only the fractional delay is transient. Every paid coin is an immediate saved transaction.
export function createPurchasePaymentSimulation() {
  let target: string | null = null, elapsed = 0;
  const reset = () => { target = null; elapsed = 0; };
  return {
    reset,
    step<T extends PaymentSave | CashSave | LedgerSave | RoomSave | CreditSave | MvpSave | Room1GameSave>(save: T, position: Point, seconds: number, enabled: boolean): T {
      const id = enabled ? purchaseAt(save, position) : null;
      const status = id ? purchaseStatus(save, id) : null;
      if (!id || save.economy.coins < 1 || status !== 'ready' && status !== 'insufficient') { reset(); return save; }
      if (id !== target) { target = id; elapsed = 0; }
      if (!Number.isFinite(seconds) || seconds <= 0) return save;
      elapsed += Math.min(seconds, 0.05);
      if (elapsed + 1e-9 < PURCHASE_PAYMENT.secondsPerCoin) return save;
      elapsed = 0;
      return contributePurchase(save, id, position);
    },
  };
}
