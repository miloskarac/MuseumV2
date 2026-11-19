import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { createLedgerSave, ledgerTotals, migrateLedgerSave, validTicketPrice } from '../game/ticket-ledger.ts';
import type { LedgerSave } from '../game/ticket-ledger.ts';
import { retirePaid } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
import { parseCashSave } from './cash-save.ts';
import { parseTravelSave } from './travel-save.ts';
import { parseHelperOwnership, restoreHelperState } from './helper-save.ts';
import { restoreCustody } from './storage-save.ts';
import { parseUpgradeOwnership, validUpgradeOwnership } from './upgrade-save.ts';
import { parsePurchasePayments, validPurchasePayments } from './payment-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;

// Count/price validation is independent of content. The full reader supplies the
// price earned by validated displays, never a maximum supplied in the save.
export function parseLedgerVisitors(value: unknown, maxPrice: number,
  limits = HISTORICAL_READ_RULES.visitorLimits): LedgerSave['visitors'] | null {
  if (!record(value) || Object.keys(value).length !== 4 || value.version !== 1
    || !integer(value.nextId) || value.nextId < 1 || !Array.isArray(value.visits) || value.visits.length > limits.total) return null;
  const totals = ledgerTotals(value.sales);
  if (!totals || !(maxPrice === 0 || validTicketPrice(maxPrice))) return null;
  const sales = value.sales as LedgerSave['visitors']['sales'];
  if (Object.entries(sales.counts).some(([price, count]) => count > 0 && Number(price) > maxPrice)) return null;
  let previous = 0, unpaid = 0;
  const activeSales: Record<string, number> = {};
  for (const visit of value.visits) {
    if (!record(visit) || Object.keys(visit).length !== 2 || !integer(visit.id) || visit.id <= previous || visit.id >= value.nextId
      || !integer(visit.paid) || visit.paid !== 0 && (!validTicketPrice(visit.paid) || visit.paid > maxPrice)) return null;
    previous = visit.id;
    if (visit.paid === 0) unpaid++;
    else activeSales[visit.paid] = (activeSales[visit.paid] ?? 0) + 1;
  }
  if (unpaid > limits.waiting || value.visits.length - unpaid > limits.admitted || !Number.isSafeInteger(totals.sold + unpaid)
    || totals.sold + unpaid !== value.nextId - 1 || !maxPrice && value.visits.length
    || Object.entries(activeSales).some(([price, count]) => count > (sales.counts[price] ?? 0))) return null;
  return value as LedgerSave['visitors'];
}

export function parseLedgerSave(raw: string, seed: number, rules: ProgressionReadRules = HISTORICAL_READ_RULES): LedgerSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 22) {
      const old = parseCashSave(raw, seed);
      return old ? migrateLedgerSave(old) : null;
    }
    const { visitors, helpers: rawHelpers, custody, upgrades: rawUpgrades, payments: rawPayments,
      pendingTicketRevenue: pending, ...base } = value;
    if (!record(visitors) || !record(base.economy) || !integer(base.economy.coins) || !integer(pending)) return null;
    const totals = ledgerTotals(visitors.sales), helpers = parseHelperOwnership(rawHelpers),
      upgrades = parseUpgradeOwnership(rawUpgrades), payments = parsePurchasePayments(rawPayments, rules);
    if (!totals || !helpers || !upgrades || !payments || pending > totals.income) return null;
    const coins = base.economy.coins;
    // Refund only validated post-travel spending and include pending tickets for
    // the existing financial reconciliation. No synthetic legacy sales records.
    let accounting = coins;
    for (const amount of [pending, ...helpers.owned.map(h => h.paid), ...upgrades.owned.map(u => u.paid), ...Object.values(payments.partial)]) {
      accounting += amount; if (!Number.isSafeInteger(accounting)) return null;
    }
    const travel = parseTravelSave(JSON.stringify({ ...base, version: 15,
      economy: { ...base.economy, coins: accounting } }), seed, totals.income, rules);
    if (!travel) return null;
    let totalAssets = accounting;
    for (const receipt of [...travel.museum.owned, ...travel.world.owned]) {
      totalAssets += receipt.paid; if (!Number.isSafeInteger(totalAssets)) return null;
    }
    const parsedVisitors = parseLedgerVisitors(visitors, rules.ticketPrice(travel), rules.visitorLimits);
    if (!parsedVisitors) return null;
    const save: LedgerSave = { ...travel, version: 22, economy: { ...travel.economy, coins },
      pendingTicketRevenue: pending, visitors: parsedVisitors, helpers, custody: {}, upgrades, payments };
    if (!validUpgradeOwnership(save, rules) || !validPurchasePayments(save, payments, rules)) return null;
    const restored = restoreHelperState(save, rules);
    return restored ? restoreCustody(restored, custody, helpers.owned, rules) : null;
  } catch { return null; }
}

export function loadLedgerSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: LedgerSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createLedgerSave(seed), restored: false, unassigned: false };
    const save = parseLedgerSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
