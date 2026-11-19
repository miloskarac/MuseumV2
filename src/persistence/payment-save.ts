import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { purchaseDefinition, validDeposit } from './contracts/progression-v22.ts';
import type { PurchaseId } from '../content/purchases.ts';
import { createPaymentSave, migratePaymentSave } from '../game/purchase-payments.ts';
import type { PaymentSave } from '../game/purchase-payments.ts';
import { retirePaid } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
import { parseUpgradeSave } from './upgrade-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parsePurchasePayments(payments: unknown, rules: ProgressionReadRules = HISTORICAL_READ_RULES): PaymentSave['payments'] | null {
  if (!record(payments) || payments.version !== 1 || Object.keys(payments).length !== 2 || !record(payments.partial)) return null;
  for (const [id, paid] of Object.entries(payments.partial)) {
    const offer = purchaseDefinition(id) ?? rules.extraPurchases.find(p => p.id === id);
    if (!offer || !Number.isSafeInteger(paid) || Number(paid) <= 0 || Number(paid) >= rules.purchaseCost(id)) return null;
  }
  return { version: 1, partial: payments.partial as Partial<Record<PurchaseId, number>> };
}
export function validPurchasePayments(save: Parameters<typeof validDeposit>[0], payments: PaymentSave['payments'], rules: ProgressionReadRules = HISTORICAL_READ_RULES) {
  return Object.keys(payments.partial).every(id => rules.validDeposit(save, id));
}
export function parsePaymentSave(raw: string, seed: number): PaymentSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 20) { const old = parseUpgradeSave(raw, seed); return old ? migratePaymentSave(old) : null; }
    const { payments: rawPayments, ...base } = value;
    const payments = parsePurchasePayments(rawPayments);
    if (!payments || !record(base.economy) || !Number.isSafeInteger(base.economy.coins) || Number(base.economy.coins) < 0) return null;
    const spent = Object.values(payments.partial).reduce((sum, paid) => sum + paid, 0);
    const coins = Number(base.economy.coins), accounting = coins + spent;
    if (!Number.isSafeInteger(accounting)) return null;
    // Refund only partial deposits for the frozen schema-19 accounting check.
    const old = parseUpgradeSave(JSON.stringify({ ...base, version: 19, economy: { ...base.economy, coins: accounting } }), seed);
    if (!old || !validPurchasePayments(old, payments)) return null;
    return { ...old, version: 20, economy: { ...old.economy, coins },
      payments: { version: 1, partial: payments.partial as Partial<Record<PurchaseId, number>> } };
  } catch { return null; }
}
export function loadPaymentSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: PaymentSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createPaymentSave(seed), restored: false, unassigned: false };
    const save = parsePaymentSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
