import { parseHelperSave } from './helper-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
import { createStorageSave, migrateStorageSave, settleDeliveries } from '../game/storage.ts';
import type { StorageSave, Custody } from '../game/storage.ts';
import { validHelperTask } from '../game/helpers.ts';
import type { HelperTask } from '../game/helpers.ts';
import { isUncovered } from '../game/journey.ts';
import { museumJourney } from '../game/purchases.ts';
import { SITES } from '../content/journey.ts';
import { siteOwned } from '../game/world-map.ts';
import { retirePaid } from '../game/visitors.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
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
    if (Object.keys(custody).length && !save.helpers.owned.length) return null;
    for (const [id, c] of Object.entries(custody)) {
      const site = SITES.find(s => s.requiredDiscoveryIds.includes(id));
      if (!site || !record(c) || c.siteId !== site.id || !siteOwned(save, site.id) || save.closedSites.includes(site.id)
        || save.collected.includes(id) || !isUncovered(museumJourney(save), id)) return null;
      if (c.location === 'storage') { if (Object.keys(c).length !== 2) return null; }
      else if (c.location === 'delivery') {
        if (Object.keys(c).length !== 3 || !save.helpers.owned.some(h => h.id === c.helperId) || save.cleaning[id]) return null;
      } else return null;
      save.custody[id] = c as Custody;
    }
    const original = (v.helpers as StorageSave['helpers']).owned;
    save.helpers.owned = save.helpers.owned.map((h, i) => {
      const task = original[i].task;
      const valid = record(task) && Object.keys(task).length === 7 && task.siteId === h.siteId
        && ['id', 'layer', 'start', 'work', 'required'].every(key => typeof task[key as keyof HelperTask] === 'number')
        && validHelperTask(save, task as HelperTask);
      // A delivery and an excavation task cannot simultaneously belong to one helper.
      if (valid && Object.values(save.custody).some(c => c.location === 'delivery' && c.helperId === h.id)) throw Error('Concurrent work and delivery');
      return { ...h, task: valid ? task : null, phase: valid ? 'paused' : 'idle' };
    });
    return save;
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
