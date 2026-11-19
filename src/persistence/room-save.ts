import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { createRoomSave, migrateRoomSave } from '../game/room-ownership.ts';
import type { RoomSave } from '../game/room-ownership.ts';
import { validRoomOwnership } from './contracts/rooms-v1.ts';
import { parseLedgerSave } from './ledger-save.ts';
import { retirePaid } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';

export function parseRoomSave(raw: string, seed: number, rules: ProgressionReadRules = HISTORICAL_READ_RULES): RoomSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (v.version !== 23) {
      const old = parseLedgerSave(raw, seed);
      return old ? migrateRoomSave(old) : null;
    }
    const { rooms, ...base } = v;
    if (!validRoomOwnership(rooms)) return null;
    // Existing schema-22 accounting and historical contracts remain authoritative.
    // No refund or credit adjustment: the only reachable room spending is zero.
    const ledger = parseLedgerSave(JSON.stringify({ ...base, version: 22 }), seed, rules);
    return ledger ? { ...ledger, version: 23, rooms } : null;
  } catch { return null; }
}

export function loadRoomSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: RoomSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createRoomSave(seed), restored: false, unassigned: false };
    const save = parseRoomSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
