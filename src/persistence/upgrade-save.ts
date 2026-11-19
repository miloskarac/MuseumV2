import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { UPGRADES } from './contracts/progression-v22.ts';
import { createUpgradeSave, migrateUpgradeSave } from '../game/upgrades.ts';
import type { UpgradeSave, UpgradePlaySave } from '../game/upgrades.ts';
import type { UpgradeReceipt } from '../game/upgrade-stats.ts';
import { settleDeliveries } from '../game/storage.ts';
import { retirePaid } from '../game/visitors.ts';
import { parseStorageSave } from './storage-save.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseUpgradeOwnership(upgrades: unknown): UpgradeSave['upgrades'] | null {
  if (!record(upgrades) || upgrades.version !== 1 || Object.keys(upgrades).length !== 2 || !Array.isArray(upgrades.owned)
    || upgrades.owned.length > UPGRADES.length) return null;
  const ids = new Set<string>();
  for (const receipt of upgrades.owned) {
    if (!record(receipt)) return null;
    const offer = UPGRADES.find(o => o.id === receipt.id);
    if (!offer || ids.has(offer.id) || receipt.paid !== offer.cost) return null;
    if (offer.id === 'helper-tools' ? Object.keys(receipt).length !== 3 || receipt.helperId !== 'helper-1' : Object.keys(receipt).length !== 2) return null;
    ids.add(offer.id);
  }
  return { version: 1, owned: upgrades.owned as UpgradeReceipt[] };
}
export const validUpgradeOwnership = (save: UpgradePlaySave, rules: ProgressionReadRules = HISTORICAL_READ_RULES) => save.upgrades.owned.every(receipt =>
  receipt.id === 'helper-tools' ? save.helpers.owned.some(h => h.id === 'helper-1') : rules.displayedExhibits(save).length > 0);
export function parseUpgradeSave(raw: string, seed: number): UpgradeSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 19) { const old = parseStorageSave(raw, seed); return old ? migrateUpgradeSave(old) : null; }
    const { upgrades: rawUpgrades, ...base } = value;
    const upgrades = parseUpgradeOwnership(rawUpgrades);
    if (!upgrades || !record(base.economy)
      || !Number.isSafeInteger(base.economy.coins) || Number(base.economy.coins) < 0) return null;
    const spent = upgrades.owned.reduce((sum, receipt) => sum + receipt.paid, 0);
    const coins = Number(base.economy.coins), accounting = coins + spent;
    if (!Number.isSafeInteger(accounting)) return null;
    const old = parseStorageSave(JSON.stringify({ ...base, version: 18, economy: { ...base.economy, coins: accounting } }), seed);
    if (!old) return null;
    const save: UpgradeSave = { ...old, version: 19, economy: { ...old.economy, coins }, upgrades };
    return validUpgradeOwnership(save) ? save : null;
  } catch { return null; }
}
export function loadUpgradeSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: UpgradeSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createUpgradeSave(seed), restored: false, unassigned: false };
    const save = parseUpgradeSave(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
