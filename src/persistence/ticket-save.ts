import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
import { parseTravelSave } from './travel-save.ts';
import { createTicketSave, migrateTicketSave, retirePaid, ticketIncome } from '../game/visitors.ts';
import type { TicketSave } from '../game/visitors.ts';
import { VISITORS, ticketPrice } from './contracts/progression-v22.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
export function parseTicketSave(raw: string, seed: number): TicketSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 16) {
      const old = parseTravelSave(raw, seed);
      return old ? migrateTicketSave(old) : null;
    }
    const { visitors: v, ...base } = value;
    if (!record(v) || Object.keys(v).length !== 4 || v.version !== 1 || !integer(v.nextId) || v.nextId < 1
      || !Array.isArray(v.sales) || v.sales.length !== 3 || !v.sales.every(integer)
      || !Array.isArray(v.visits) || v.visits.length > VISITORS.capacity) return null;
    const sales = v.sales;
    const income = ticketIncome(sales), sold = sales.reduce((a, b) => a + b, 0);
    if (!Number.isSafeInteger(income) || !Number.isSafeInteger(sold)) return null;
    let previous = 0, unpaid = 0; const activeSales = [0, 0, 0];
    for (const visit of v.visits) {
      if (!record(visit) || Object.keys(visit).length !== 2 || !integer(visit.id) || visit.id <= previous || visit.id >= v.nextId
        || !integer(visit.paid) || ![0, 2, 3, 4].includes(visit.paid)) return null;
      previous = visit.id;
      if (!visit.paid) unpaid++; else activeSales[visit.paid - 2]++;
    }
    if (unpaid > VISITORS.queueCapacity || sold + unpaid !== v.nextId - 1 || activeSales.some((n, i) => n > sales[i])) return null;
    // Subtract ticket income only after all purchase receipts are refunded for
    // validation: legitimate players can spend more than their soil income.
    const travel = parseTravelSave(JSON.stringify({ ...base, version: 15 }), seed, income);
    if (!travel) return null;
    const save: TicketSave = { ...travel, version: 16, visitors: v as TicketSave['visitors'] };
    const price = ticketPrice(save);
    if (v.sales.some((n, i) => n > 0 && i + 2 > price) || (!price && v.visits.length)) return null;
    return save;
  } catch { return null; }
}
export function loadTicketSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: TicketSave; restored: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createTicketSave(seed), restored: false };
    const save = parseTicketSave(raw, seed);
    return save ? { kind: 'ready', save: retirePaid(save), restored: true } : { kind: 'invalid' };
  } catch { return { kind: 'unavailable' }; }
}
