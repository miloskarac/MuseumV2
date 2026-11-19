import { VISITORS } from '../content/visitors.ts';
import { ECONOMY } from '../content/economy.ts';
import { createCashSave } from './cash.ts';
import type { CashSave } from './cash.ts';

// Canonical decimal price keys; absent prices have zero sales. No content-sized array.
export type TicketLedger = { version: 1; counts: Record<string, number> };
export type LedgerSave = Omit<CashSave, 'version' | 'visitors'> & { version: 22;
  visitors: Omit<CashSave['visitors'], 'sales'> & { sales: TicketLedger } };

export const ticketPriceForDisplays = (count: number) => {
  if (!Number.isSafeInteger(count) || count < 0) return 0;
  const price = count ? VISITORS.basePrice + VISITORS.perDisplay * count : 0;
  return Number.isSafeInteger(price) ? price : 0;
};
export const validTicketPrice = (price: number) => Number.isSafeInteger(price) && price >= 2;

export function ledgerTotals(value: unknown): { income: number; sold: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ledger = value as TicketLedger;
  if (Object.keys(ledger).length !== 2 || ledger.version !== 1 || !ledger.counts
    || typeof ledger.counts !== 'object' || Array.isArray(ledger.counts)) return null;
  let income = 0, sold = 0;
  for (const [key, count] of Object.entries(ledger.counts)) {
    const price = Number(key);
    if (!validTicketPrice(price) || String(price) !== key || !Number.isSafeInteger(count) || count < 0) return null;
    const amount = price * count;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(income + amount) || !Number.isSafeInteger(sold + count)) return null;
    income += amount; sold += count;
  }
  return { income, sold };
}

export function recordTicketSale(ledger: TicketLedger, price: number): TicketLedger | null {
  if (!validTicketPrice(price) || !ledgerTotals(ledger)) return null;
  const next: TicketLedger = { version: 1, counts: { ...ledger.counts, [price]: (ledger.counts[price] ?? 0) + 1 } };
  return ledgerTotals(next) ? next : null;
}

// Pure accounting step. The caller derives the earned price and enforces the
// attended cashier interaction; the first unpaid visit can be charged only once.
export function payLedgerTicket<T extends Pick<LedgerSave, 'economy' | 'visitors' | 'pendingTicketRevenue'>>(save: T, id: number, price: number): T {
  if (save.visitors.visits.find(v => v.paid === 0)?.id !== id
    || !Number.isSafeInteger(save.pendingTicketRevenue) || save.pendingTicketRevenue < 0
    || !Number.isSafeInteger(save.economy.coins) || save.economy.coins < 0
    || !Number.isSafeInteger(save.economy.coins + save.pendingTicketRevenue + price)) return save;
  const sales = recordTicketSale(save.visitors.sales, price);
  if (!sales) return save;
  // Spending does not remove assets from reconciliation. Guard the conserved
  // lifetime total too, so a payment can never produce an unloadable snapshot.
  let total = ECONOMY.startingCoins + ledgerTotals(sales)!.income;
  if (!Number.isSafeInteger(total)) return save;
  for (const manifest of Object.values(save.economy.sites)) for (const claim of manifest.claimed) {
    total += manifest.outcomes[claim]; if (!Number.isSafeInteger(total)) return save;
  }
  return { ...save, pendingTicketRevenue: save.pendingTicketRevenue + price,
    visitors: { ...save.visitors, sales, visits: save.visitors.visits.map(v => v.id === id ? { ...v, paid: price } : v) } };
}

// Called only after the historical reader validates the full original snapshot.
export function migrateLedgerSave(save: CashSave): LedgerSave {
  return { ...save, version: 22, visitors: { ...save.visitors, sales: { version: 1,
    counts: Object.fromEntries(save.visitors.sales.flatMap((count, index) => count ? [[String(index + 2), count]] : [])) } } };
}
export const createLedgerSave = (seed: number) => migrateLedgerSave(createCashSave(seed));
