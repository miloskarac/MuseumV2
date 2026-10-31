import { HELPERS } from '../content/helpers.ts';
import { SITES, ERYOPS_SITE } from '../content/journey.ts';
import { createHelperSave, migrateHelperSave, validHelperTask } from '../game/helpers.ts';
import type { Helper, HelperSave, HelperTask } from '../game/helpers.ts';
import { displayedExhibits } from '../game/purchases.ts';
import { siteOwned } from '../game/world-map.ts';
import { retirePaid } from '../game/visitors.ts';
import { parseTicketSave } from './ticket-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
export const HELPER_QA_KEY = `${SAVE_KEY}:helpers-qa`;
export const HELPER_QA_LOCK = 'museum-for-luka-v2-helpers-qa-writer';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseHelperSave(raw: string, seed: number): HelperSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 17) {
      const old = parseTicketSave(raw, seed); return old ? migrateHelperSave(old) : null;
    }
    const { helpers, ...base } = value;
    // Ownership is never normalized into a free entitlement. Task metadata may
    // be retired independently without deleting a purchased helper or soil.
    if (!record(helpers) || helpers.version !== 1 || Object.keys(helpers).length !== 3
      || !Number.isSafeInteger(helpers.nextTask) || Number(helpers.nextTask) < 1
      || !Array.isArray(helpers.owned) || helpers.owned.length > HELPERS.available
      || !record(base.economy) || !Number.isSafeInteger(base.economy.coins) || Number(base.economy.coins) < 0) return null;
    for (const h of helpers.owned) if (!record(h) || Object.keys(h).length !== 5 || h.id !== 'helper-1' || h.paid !== HELPERS.cost
      || !(h.siteId === null || typeof h.siteId === 'string') || !['idle', 'paused', 'digging'].includes(String(h.phase))) return null;
    const coins = Number(base.economy.coins), refunded = coins + helpers.owned.length * HELPERS.cost;
    if (!Number.isSafeInteger(refunded)) return null;
    const ticket = parseTicketSave(JSON.stringify({ ...base, version: 16, economy: { ...base.economy, coins: refunded } }), seed);
    if (!ticket || helpers.owned.length && (displayedExhibits(ticket).length < 2 || !siteOwned(ticket, ERYOPS_SITE.id))) return null;
    const save: HelperSave = { ...ticket, version: 17, economy: { ...ticket.economy, coins },
      helpers: { version: 1, nextTask: Number(helpers.nextTask), owned: helpers.owned as Helper[] } };
    save.helpers.owned = save.helpers.owned.map(helper => {
      const siteId = helper.siteId && SITES.some(s => s.id === helper.siteId) && siteOwned(save, helper.siteId) ? helper.siteId : null;
      const task = helper.task;
      const valid = record(task) && Object.keys(task).length === 7 && task.siteId === siteId
        && ['id', 'layer', 'start', 'work', 'required'].every(key => typeof task[key as keyof HelperTask] === 'number')
        && validHelperTask(save, task as HelperTask);
      return { ...helper, siteId, task: valid ? task : null, phase: valid ? 'paused' : 'idle' };
    });
    return save;
  } catch { return null; }
}
export function loadHelperSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: HelperSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(HELPER_QA_KEY);
    if (raw === null) return { kind: 'ready', save: createHelperSave(seed), restored: false, unassigned: false };
    const save = parseHelperSave(raw, seed);
    if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: Helper, i: number) => h.siteId && !save?.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: retirePaid(save), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
