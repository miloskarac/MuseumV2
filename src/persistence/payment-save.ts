import { purchaseDefinition } from '../content/purchases.ts';
import type { PurchaseId } from '../content/purchases.ts';
import { purchaseStatus } from '../game/purchases.ts';
import { createPaymentSave, migratePaymentSave } from '../game/purchase-payments.ts';
import type { PaymentSave } from '../game/purchase-payments.ts';
import { retirePaid } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
import { parseUpgradeSave } from './upgrade-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parsePaymentSave(raw: string, seed: number): PaymentSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 20) { const old = parseUpgradeSave(raw, seed); return old ? migratePaymentSave(old) : null; }
    const { payments, ...base } = value;
    if (!record(payments) || payments.version !== 1 || Object.keys(payments).length !== 2 || !record(payments.partial)
      || !record(base.economy) || !Number.isSafeInteger(base.economy.coins) || Number(base.economy.coins) < 0) return null;
    let spent = 0;
    for (const [id, paid] of Object.entries(payments.partial)) {
      const offer = purchaseDefinition(id);
      if (!offer || !Number.isSafeInteger(paid) || Number(paid) <= 0 || Number(paid) >= offer.cost) return null;
      spent += Number(paid);
    }
    const coins = Number(base.economy.coins), accounting = coins + spent;
    if (!Number.isSafeInteger(accounting)) return null;
    // Refund only partial deposits for the frozen schema-19 accounting check.
    const old = parseUpgradeSave(JSON.stringify({ ...base, version: 19, economy: { ...base.economy, coins: accounting } }), seed);
    if (!old) return null;
    for (const id of Object.keys(payments.partial)) {
      const status = purchaseStatus({ ...old, room: 'museum' }, id);
      if (status !== 'ready' && status !== 'insufficient') return null;
    }
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
