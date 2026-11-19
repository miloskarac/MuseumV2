import { createCashSave, migrateCashSave } from '../game/cash.ts';
import type { CashSave } from '../game/cash.ts';
import { retirePaid, ticketIncome } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
import { parsePaymentSave } from './payment-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

export function parseCashSave(raw: string, seed: number): CashSave | null {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.version !== 21) { const old = parsePaymentSave(raw, seed); return old ? migrateCashSave(old) : null; }
    const { pendingTicketRevenue: pending, ...base } = value;
    if (!Number.isSafeInteger(pending) || pending < 0 || !Number.isSafeInteger(base.economy?.coins)
      || base.economy.coins < 0 || !Number.isSafeInteger(base.economy.coins + pending)) return null;
    // The earlier ledger accounts for all earned tickets. Temporarily include
    // uncollected cash for validation, then restore the spendable balance.
    const old = parsePaymentSave(JSON.stringify({ ...base, version: 20,
      economy: { ...base.economy, coins: base.economy.coins + pending } }), seed);
    if (!old || pending > ticketIncome(old.visitors.sales)) return null;
    return { ...old, version: 21, pendingTicketRevenue: pending, economy: { ...old.economy, coins: base.economy.coins } };
  } catch { return null; }
}
export function loadCashSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: CashSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createCashSave(seed), restored: false, unassigned: false };
    const save = parseCashSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
