import { createCreditSave } from './expansion-credit.ts';
import type { CreditSave } from './expansion-credit.ts';
import type { PurchaseId } from '../content/purchases.ts';
import type { TicketLedger } from './ticket-ledger.ts';

// Bounded migration evidence distinguishes old prices/order and sales from new
// transactions without rewriting any receipt or granting a new entitlement.
export type PurchaseHistory = { version: 1; standIds: PurchaseId[]; siteIds: string[];
  deposits: Partial<Record<PurchaseId, number>>; sales: TicketLedger };
export type MvpSave = Omit<CreditSave, 'version'> & { version: 25; purchaseHistory: PurchaseHistory };
export const migrateMvpSave = (save: CreditSave): MvpSave => ({ ...save, version: 25,
  purchaseHistory: { version: 1, standIds: save.museum.owned.map(o => o.id), siteIds: save.world.owned.map(o => o.id),
    deposits: { ...save.payments.partial }, sales: structuredClone(save.visitors.sales) } });
export const createMvpSave = (seed: number) => migrateMvpSave(createCreditSave(seed));
