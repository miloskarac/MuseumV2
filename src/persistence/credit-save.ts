import { ROOM1_READ_RULES } from './room1-save-rules.ts';
import { createCreditSave, migrateCreditSave } from '../game/expansion-credit.ts';
import type { CreditSave } from '../game/expansion-credit.ts';
import { validExpansionCredit, westWingInvestment } from './contracts/expansion-credit-v1.ts';
import { parseRoomSave } from './room-save.ts';
import { retirePaid } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

export function parseCreditSave(raw: string, seed: number): CreditSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (v.version !== 24) {
      const old = parseRoomSave(raw, seed);
      return old ? migrateCreditSave(old) : null;
    }
    const { expansionCredit, ...base } = v;
    // Credit is a claim on existing investment, not additional wealth. Do not
    // refund it into the old accounting, which already includes wing spending.
    const room = parseRoomSave(JSON.stringify({ ...base, version: 23 }), seed, ROOM1_READ_RULES);
    return room && validExpansionCredit(expansionCredit, westWingInvestment(room))
      ? { ...room, version: 24, expansionCredit } : null;
  } catch { return null; }
}

export function loadCreditSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: CreditSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createCreditSave(seed), restored: false, unassigned: false };
    const save = parseCreditSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
