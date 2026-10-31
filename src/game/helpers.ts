import { claimHelperFinds, carriedFinds, settleDeliveries } from './storage.ts';
import { helperWorkRate } from './upgrade-stats.ts';
import type { StoragePlaySave } from './storage.ts';
import { HELPERS } from '../content/helpers.ts';
import { SITES, ERYOPS_SITE, HITS_PER_LAYER } from '../content/journey.ts';
import { activeDigLayer, allSiteRecovered, diggableCells, isUncovered } from './journey.ts';
import { advanceMuseum, displayedExhibits, museumJourney } from './purchases.ts';
import { createTicketSave } from './visitors.ts';
import type { TicketSave } from './visitors.ts';
import { siteOwned, travelBusy } from './world-map.ts';
import type { Point } from './navigation.ts';
import { isWalkable } from './navigation.ts';

export type HelperTask = { id: number; siteId: string; cellId: string; layer: number; start: number; work: number; required: number };
export type Helper = { id: 'helper-1'; paid: number; siteId: string | null; phase: 'idle' | 'paused' | 'digging'; task: HelperTask | null };
export type HelperSave = Omit<TicketSave, 'version'> & { version: 17; helpers: { version: 1; nextTask: number; owned: Helper[] } };
export type HelperPlaySave = HelperSave | StoragePlaySave;
export const migrateHelperSave = (save: TicketSave): HelperSave => ({ ...save, version: 17, helpers: { version: 1, nextTask: 1, owned: [] } });
export const createHelperSave = (seed: number) => migrateHelperSave(createTicketSave(seed));

// 6.5 boundary: no helper may cause a new fossil exposure before custody exists.
export function helperLayer(save: HelperPlaySave, siteId: string, cellId: string) {
  const site = SITES.find(s => s.id === siteId), state = museumJourney(save);
  if (!site || !siteOwned(save, siteId) || allSiteRecovered(state, site) || save.closedSites.includes(siteId)) return null;
  const cell = site.cells.find(c => c.id === cellId), layer = activeDigLayer(state, site), start = save.dig[cellId] ?? 0;
  if (!cell || layer >= site.grid.levels || Math.floor(start * site.grid.levels + 1e-9) !== layer) return null;
  const end = (layer + 1) / site.grid.levels;
  const next = { ...state, dig: { ...state.dig, [cellId]: end } };
  if (save.version === 17 && site.requiredDiscoveryIds.some(id => !isUncovered(state, id) && isUncovered(next, id))) return null;
  return { layer, start, end, required: (end - start) * site.grid.levels * HITS_PER_LAYER / HELPERS.workPerSwing * HELPERS.swingSeconds };
}
export function helperPurchaseStatus(save: HelperPlaySave) {
  if (save.helpers.owned.length >= Math.min(HELPERS.maximumOwned, HELPERS.available)) return 'owned';
  if (travelBusy(save)) return 'busy';
  if (displayedExhibits(save).length < 2) return 'displays';
  if (!siteOwned(save, ERYOPS_SITE.id)) return 'site';
  if (!SITES.some(site => site.cells.some(cell => helperLayer(save, site.id, cell.id)))) return 'exhausted';
  if (!Number.isSafeInteger(save.economy.coins) || save.economy.coins < HELPERS.cost) return 'insufficient';
  return 'ready';
}
export function buyHelper<T extends HelperPlaySave>(save: T): T {
  if (helperPurchaseStatus(save) !== 'ready') return save;
  return { ...save, economy: { ...save.economy, coins: save.economy.coins - HELPERS.cost },
    helpers: { ...save.helpers, owned: [{ id: 'helper-1', paid: HELPERS.cost, siteId: null, phase: 'idle', task: null }] } };
}
export function assignHelper<T extends HelperPlaySave>(save: T, siteId: string | null): T {
  const helper = save.helpers.owned[0];
  if (!helper || helper.siteId === siteId || travelBusy(save) || siteId !== null && (!SITES.some(s => s.id === siteId) || !siteOwned(save, siteId))) return save;
  return { ...settleDeliveries(save), helpers: { ...save.helpers, owned: [{ ...helper, siteId, phase: 'idle', task: null }] } };
}
export const helperActive = (save: HelperPlaySave) => save.room === 'excavation' && !travelBusy(save)
  && save.helpers.owned[0]?.siteId === save.activeSiteId && !save.closedSites.includes(save.activeSiteId);
export function validHelperTask(save: HelperPlaySave, task: HelperTask): boolean {
  const layer = helperLayer(save, task.siteId, task.cellId);
  return !!layer && layer.layer === task.layer && layer.start === task.start && Math.abs(layer.required - task.required) < 1e-9
    && Number.isSafeInteger(task.id) && task.id > 0 && task.id < save.helpers.nextTask
    && Number.isFinite(task.work) && task.work >= 0 && task.work < task.required;
}
export function pauseHelper<T extends HelperPlaySave>(save: T): T {
  if (!save.helpers.owned.some(h => h.phase === 'digging')) return save;
  return { ...save, helpers: { ...save.helpers, owned: save.helpers.owned.map(h => ({ ...h, phase: h.task ? 'paused' : 'idle' })) } };
}
export function startHelperTask<T extends HelperPlaySave>(save: T, cellId: string): T {
  const helper = save.helpers.owned[0], layer = helper && helper.siteId ? helperLayer(save, helper.siteId, cellId) : null;
  if ('custody' in save && carriedFinds(save).length) return save;
  if (!helper || !layer || !helperActive(save) || helper.task || !Number.isSafeInteger(save.helpers.nextTask + 1)) return save;
  const task = { id: save.helpers.nextTask, siteId: helper.siteId!, cellId, layer: layer.layer,
    start: layer.start, required: layer.required, work: 0 };
  return { ...save, helpers: { ...save.helpers, nextTask: task.id + 1, owned: [{ ...helper, task, phase: 'paused' }] } };
}
export function cancelHelperTask<T extends HelperPlaySave>(save: T): T {
  const helper = save.helpers.owned[0];
  return !helper?.task ? save : { ...save, helpers: { ...save.helpers, owned: [{ ...helper, task: null, phase: 'idle' }] } };
}
export function workHelper<T extends HelperPlaySave>(save: T, position: Point, seconds: number): T {
  const helper = save.helpers.owned[0], task = helper?.task;
  if (!task || !helperActive(save) || !Number.isFinite(seconds) || seconds <= 0) return save;
  if (!validHelperTask(save, task)) return cancelHelperTask(save);
  if (!isWalkable(position, 'excavation') || !diggableCells(museumJourney(save), position).some(item => item.cell.id === task.cellId)) return pauseHelper(save);
  const work = Math.min(task.required, task.work + Math.min(seconds, 0.05) * helperWorkRate(save));
  if (work + 1e-9 < task.required) return { ...save, helpers: { ...save.helpers,
    owned: [{ ...helper, phase: 'digging', task: { ...task, work } }] } };
  // World progress and the frozen soil reward are one candidate for the writer.
  const layer = helperLayer(save, task.siteId, task.cellId)!;
  const next = advanceMuseum(save, { ...museumJourney(save), dig: { ...save.dig, [task.cellId]: layer.end } }) as T;
  const completed = cancelHelperTask(next);
  return ('custody' in save && 'custody' in completed ? claimHelperFinds(save, completed) : completed) as T;
}
