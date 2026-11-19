import { HISTORICAL_READ_RULES } from './room1-save-rules.ts';
import type { ProgressionReadRules } from './room1-save-rules.ts';
import { SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
import { parseGameSave } from './game-save.ts';
import { PURCHASES, purchaseDefinition, owns } from './contracts/progression-v22.ts';
import { createMuseumSave, migrateMuseumSave } from '../game/purchases.ts';
import type { MuseumSave } from '../game/purchases.ts';

export const PURCHASE_QA_KEY = `${SAVE_KEY}:purchases-qa`;
export const PURCHASE_QA_LOCK = 'museum-for-luka-v2-purchases-qa-writer';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parseMuseumSave(raw: string, seed: number, validatedTicketIncome = 0, rules: ProgressionReadRules = HISTORICAL_READ_RULES): MuseumSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value)) return null;
    if (value.version !== 14) {
      const old = parseGameSave(raw, seed);
      return old ? migrateMuseumSave(old) : null;
    }
    const { museum, ...base } = value;
    if (!record(museum) || museum.version !== 1 || Object.keys(museum).length !== 2
      || !Array.isArray(museum.owned) || museum.owned.length > PURCHASES.length + rules.extraPurchases.length || !record(base.economy)) return null;
    const seen = new Set<string>(); let spent = 0, legacy = 0;
    for (const item of museum.owned) {
      if (!record(item) || Object.keys(item).length !== 3 || typeof item.id !== 'string' || seen.has(item.id)) return null;
      const offer = purchaseDefinition(item.id) ?? rules.extraPurchases.find(p => p.id === item.id);
      if (!offer || (item.source !== 'legacy' && item.source !== 'purchase')
        || item.paid !== (item.source === 'legacy' ? 0 : rules.purchaseCost(offer.id))) return null;
      if (item.source === 'legacy' && !purchaseDefinition(item.id)) return null;
      seen.add(item.id); spent += Number(item.paid); if (item.source === 'legacy') legacy++;
    }
    // Migration grants the complete existing hall, never a partly paid mixture.
    if (legacy && (legacy !== PURCHASES.length || museum.owned.filter(item => purchaseDefinition(item.id)).length !== legacy)) return null;
    if (!Number.isSafeInteger(base.economy.coins) || Number(base.economy.coins) < 0) return null;
    // The frozen 6.1 validator still checks every manifest and lifetime coin.
    const economy = { ...base.economy, coins: Number(base.economy.coins) + spent - validatedTicketIncome };
    if (!parseGameSave(JSON.stringify({ ...base, version: 13, economy }), seed, rules.parseJourney)) return null;
    const save = value as MuseumSave;
    if (rules.requiresWestWing && owns(save, 'stand-eryops') && !owns(save, 'west-wing')) return null;
    if (rules.exhibits.some(exhibit => exhibit.parts.some(part => save.placed.includes(part)) && !rules.standAvailable(save, exhibit.id))) return null;
    if (!legacy && owns(save, 'west-wing') && !rules.displayedExhibits(save).some(id => id !== 'eryops')) return null;
    return save;
  } catch { return null; }
}
// The caller supplies the isolated storage adapter. This never reads Luka's key.
export function loadMuseumSave(storage: StoragePort, seed: number):
  { kind: 'ready'; save: MuseumSave; restored: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createMuseumSave(seed), restored: false };
    const save = parseMuseumSave(raw, seed);
    return save ? { kind: 'ready', save, restored: true } : { kind: 'invalid' };
  } catch { return { kind: 'unavailable' }; }
}
