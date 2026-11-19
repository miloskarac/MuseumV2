import { parseHelperSave } from './helper-save.ts';
import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
import { createStorageSave, migrateStorageSave, settleDeliveries } from '../game/storage.ts';
import type { StorageSave, StoragePlaySave, Custody } from '../game/storage.ts';
import { siteOwned } from './contracts/progression-v22.ts';
import type { HelperTask } from '../game/helpers.ts';
import { retirePaid } from '../game/visitors.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
// Reuse the same custody/task rules after either historical or ledger accounting.
export function restoreCustody<T extends StoragePlaySave>(base: T, custody: unknown, original: StorageSave['helpers']['owned'], rules: ProgressionReadRules = HISTORICAL_READ_RULES): T | null {
  if (!record(custody)) return null;
  const save = { ...base, custody: {}, helpers: { ...base.helpers } } as T;
  if (Object.keys(custody).length && !save.helpers.owned.length) return null;
  for (const [id, c] of Object.entries(custody)) {
    const siteId = rules.custodySite(id);
    if (!siteId || !record(c) || c.siteId !== siteId || !siteOwned(save, siteId) || save.closedSites.includes(siteId)
      || save.collected.includes(id) || !rules.isUncovered(save, id)) return null;
    if (c.location === 'storage') { if (Object.keys(c).length !== 2) return null; }
    else if (c.location === 'delivery') {
      if (Object.keys(c).length !== 3 || !save.helpers.owned.some(h => h.id === c.helperId) || save.cleaning[id]) return null;
    } else return null;
    save.custody[id] = c as Custody;
  }
  save.helpers.owned = save.helpers.owned.map((h, i) => {
    const task = original[i].task;
    const valid = record(task) && Object.keys(task).length === 7 && task.siteId === h.siteId
      && ['id', 'layer', 'start', 'work', 'required'].every(key => typeof task[key as keyof HelperTask] === 'number')
      && rules.validHelperTask(save, task as HelperTask);
    // A delivery and an excavation task cannot simultaneously belong to one helper.
    if (valid && Object.values(save.custody).some(c => c.location === 'delivery' && c.helperId === h.id)) throw Error('Concurrent work and delivery');
    return { ...h, task: valid ? task : null, phase: valid ? 'paused' : 'idle' };
  });
  return save;
}
export function parseStorageSave(raw: string, seed: number): StorageSave | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!record(v)) return null;
    if (v.version !== 18) { const old = parseHelperSave(raw, seed); return old ? migrateStorageSave(old) : null; }
    const { custody, ...base } = v;
    if (!record(custody)) return null;
    // Retain frozen payment/journey validation; only task validity differs now
    // that final fossil-exposure work is allowed under the custody contract.
    const helper = parseHelperSave(JSON.stringify({ ...base, version: 17 }), seed);
    if (!helper) return null;
    const save: StorageSave = { ...helper, version: 18, custody: {} };
    return restoreCustody(save, custody, (v.helpers as StorageSave['helpers']).owned);
  } catch { return null; }
}
export function loadStorageSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: StorageSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createStorageSave(seed), restored: false, unassigned: false };
    const save = parseStorageSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
