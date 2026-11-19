import type { Room1GameSave } from './room1-economy.ts';
import type { MvpSave } from './mvp-economy.ts';
import { createPaymentSave } from './purchase-payments.ts';
import type { PaymentSave } from './purchase-payments.ts';
import type { LedgerSave } from './ticket-ledger.ts';
import type { RoomSave } from './room-ownership.ts';
import type { CreditSave } from './expansion-credit.ts';
import { CASH_PILE } from '../content/visitors.ts';
import type { Point } from './navigation.ts';

export type CashSave = Omit<PaymentSave, 'version'> & { version: 21; pendingTicketRevenue: number };
// Earlier ticket income is already spendable: never grant it a second time.
export const migrateCashSave = (save: PaymentSave): CashSave => ({ ...save, version: 21, pendingTicketRevenue: 0 });
export const createCashSave = (seed: number) => migrateCashSave(createPaymentSave(seed));
// Check the travelled segment as well as its endpoint, so crossing the radius
// cannot miss a pickup. The pending ledger remains the sole collectible identity.
export function collectNearbyTicketRevenue<T extends Parameters<typeof collectTicketRevenue>[0]>(save: T, position: Point, previous: Point = position): T {
  if (![position.x, position.z, previous.x, previous.z].every(Number.isFinite)) return save;
  const dx = position.x - previous.x, dz = position.z - previous.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((CASH_PILE.x - previous.x) * dx + (CASH_PILE.z - previous.z) * dz) / lengthSquared)) : 0;
  if (Math.hypot(previous.x + t * dx - CASH_PILE.x, previous.z + t * dz - CASH_PILE.z) > CASH_PILE.pickupRadius) return save;
  return collectTicketRevenue(save);
}
export function collectTicketRevenue<T extends CashSave | LedgerSave | RoomSave | CreditSave | MvpSave | Room1GameSave>(save: T): T {
  if (save.room !== 'museum' || !Number.isSafeInteger(save.pendingTicketRevenue) || save.pendingTicketRevenue <= 0
    || !Number.isSafeInteger(save.economy.coins + save.pendingTicketRevenue)) return save;
  return { ...save, pendingTicketRevenue: 0,
    economy: { ...save.economy, coins: save.economy.coins + save.pendingTicketRevenue } };
}
