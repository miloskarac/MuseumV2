import { createMvpSave, migrateMvpSave } from '../game/mvp-economy.ts';
import type { MvpSave, PurchaseHistory } from '../game/mvp-economy.ts';
import { parseCreditSave } from './credit-save.ts';
import { parseRoomSave } from './room-save.ts';
import { ROOM1_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { purchaseDefinition, owns } from './contracts/progression-v22.ts';
import { validExpansionCredit, westWingInvestment } from './contracts/expansion-credit-v1.ts';
import { ledgerTotals } from '../game/ticket-ledger.ts';
import { retirePaid } from '../game/visitors.ts';
import { visitorOwnedRooms, visitorCapacityForOwnedRooms } from '../game/visitor-capacity.ts';
import { settleDeliveries } from '../game/storage.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const unique = (v: unknown): v is string[] => Array.isArray(v) && v.every(id => typeof id === 'string') && new Set(v).size === v.length;
// Schema-25 terms are fixed here, independently of later live catalogs.
const schema25Prices: Record<string, number> = { 'stand-dimetrodon': 12, 'stand-trilobite': 8, 'stand-eryops': 16, 'west-wing': 18 };
function historyOf(v: unknown): PurchaseHistory | null {
  if (!record(v) || Object.keys(v).length !== 5 || v.version !== 1
    || !unique(v.standIds) || v.standIds.some(id => !purchaseDefinition(id))
    || !unique(v.siteIds) || v.siteIds.some(id => id !== 'eryops-dig')
    || !record(v.deposits) || !ledgerTotals(v.sales)) return null;
  for (const [id, amount] of Object.entries(v.deposits)) {
    const cost = purchaseDefinition(id)?.cost;
    if (!cost || !Number.isSafeInteger(amount) || Number(amount) <= 0 || Number(amount) >= cost || v.standIds.includes(id)) return null;
  }
  if (Object.entries((v.sales as PurchaseHistory['sales']).counts).some(([p, count]) => count > 0 && !['2', '3', '4'].includes(p))) return null;
  return v as PurchaseHistory;
}
export function parseMvpSave(raw: string, seed: number, extension?: {
  rules: Partial<ProgressionReadRules>; order: string[]; prices: Record<string, number>;
}): MvpSave | null {
  const prices = extension?.prices ?? schema25Prices, order = extension?.order ?? ['dimetrodon', 'trilobite', 'eryops'];
  try {
    const v: unknown = JSON.parse(raw);
    if (!record(v)) return null;
    if (v.version !== 25) { const old = parseCreditSave(raw, seed); return old ? migrateMvpSave(old) : null; }
    const { purchaseHistory: rawHistory, expansionCredit, ...base } = v;
    const history = historyOf(rawHistory); if (!history) return null;
    const capacity = visitorCapacityForOwnedRooms(visitorOwnedRooms(v.rooms));
    const rules: ProgressionReadRules = {
      ...ROOM1_READ_RULES,
      visitorLimits: { ...capacity, total: capacity.waiting + capacity.admitted },
      purchaseCost: id => history.standIds.some(owned => owned === id) ? purchaseDefinition(id)?.cost ?? 0 : prices[id] ?? 0,
      siteCost: () => history.siteIds.includes('eryops-dig') ? 24 : 20,
      siteRequirements: save => !save.world.owned.length || (history.siteIds.includes('eryops-dig')
        ? save.closedSites.includes('courtyard-dig') && (!save.world.owned.some(o => o.source === 'purchase') || ROOM1_READ_RULES.displayedExhibits(save).length > 0)
        : owns(save, 'stand-eryops')),
      validDeposit: (save, id) => !!prices[id] && !owns(save, id)
        && (id !== 'west-wing' || !!history.deposits['west-wing'] && ROOM1_READ_RULES.validDeposit(save, id)),
      ticketPrice: save => ROOM1_READ_RULES.displayedExhibits(save).reduce((sum, id) => sum + (id === 'trilobite' ? 2 : 4), 0),
      ...extension?.rules,
    };
    const room = parseRoomSave(JSON.stringify({ ...base, version: 23 }), seed, rules);
    if (!room || !validExpansionCredit(expansionCredit, westWingInvestment(room))) return null;
    const save: MvpSave = { ...room, version: 25, expansionCredit, purchaseHistory: history };
    const displays = rules.displayedExhibits(save);
    const prefix = (id: string) => {
      const index = order.indexOf(id.replace('stand-', ''));
      return index >= 0 && order.slice(0, index).every(previous => displays.includes(previous));
    };
    // Preserve already-paid historical receipts as evidence, even if acquired
    // out of order. Every new purchase uses the current strict display prefix.
    if (history.standIds.some(id => !owns(save, id))
      || history.siteIds.some(id => !save.world.owned.some(o => o.id === id))) return null;
    for (const receipt of save.museum.owned) if (!history.standIds.includes(receipt.id)
      && (receipt.source !== 'purchase' || !prefix(receipt.id))) return null;
    for (const receipt of save.world.owned) if (!history.siteIds.includes(receipt.id)
      && (receipt.source !== 'purchase' || !prefix('stand-eryops'))) return null;
    for (const [id, amount] of Object.entries(save.payments.partial)) {
      const inherited = history.deposits[id as keyof typeof history.deposits];
      if (inherited === undefined ? !prefix(id) : amount < inherited) return null;
      if (inherited !== undefined && amount > inherited && !prefix(id)) return null;
      if (id === 'west-wing' && amount !== inherited) return null;
    }
    for (const [id, amount] of Object.entries(history.deposits))
      if (!owns(save, id) && (save.payments.partial[id as keyof typeof history.deposits] ?? 0) < amount) return null;
    // Original sales retain their original prices. New sales must use a sum of
    // valid display contributions (historical saves may have non-prefix displays).
    const allowed = new Set<number>();
    for (let mask = 0; mask < 1 << displays.length; mask++) {
      const subset = displays.filter((_, i) => mask & 1 << i);
      if (subset.every(id => history.standIds.some(stand => stand === `stand-${id}`)
        || order.slice(0, order.indexOf(id)).every(previous => subset.includes(previous))))
        allowed.add(subset.reduce((sum, id) => sum + (id === 'trilobite' || id === 'walchia' ? 2 : 4), 0));
    }
    for (const [price, count] of Object.entries(history.sales.counts))
      if (Number(price) > (displays.length ? displays.length + 1 : 0) && count > 0
        || (save.visitors.sales.counts[price] ?? 0) < count) return null;
    for (const [price, count] of Object.entries(save.visitors.sales.counts))
      if (count > (history.sales.counts[price] ?? 0) && !allowed.has(Number(price))) return null;
    return save;
  } catch { return null; }
}
export function loadMvpSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: MvpSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createMvpSave(seed), restored: false, unassigned: false };
    const save = parseMvpSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
