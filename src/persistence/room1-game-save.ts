import { parseMvpSave } from './mvp-save.ts';
import { parseSave, SAVE_KEY } from './save.ts';
import type { StoragePort } from './save.ts';
import { ROOM1_EXHIBITS, WALCHIA_PART } from '../content/exhibit.ts';
import { ROOM1_SITES, CLEANING_AREAS } from '../content/journey.ts';
import { findIsExposed } from '../game/burial.ts';
import type { JourneyState } from '../game/journey.ts';
import { isUncovered } from '../game/journey.ts';
import { validHelperTask } from '../game/helpers.ts';
import { createRoom1Game, migrateRoom1Game } from '../game/room1-economy.ts';
import type { Room1GameSave } from '../game/room1-economy.ts';
import { retirePaid } from '../game/visitors.ts';
import { settleDeliveries } from '../game/storage.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
// Validate the new item before projecting it out of the frozen terrain reader.
function parseRoom1Journey(raw: string): JourneyState | null {
  try {
    const v = JSON.parse(raw), id = WALCHIA_PART.discoveryId, part = WALCHIA_PART.id;
    if (!record(v) || !Array.isArray(v.collected) || !Array.isArray(v.placed) || !record(v.cleaning) || !record(v.dig)
      || !Array.isArray(v.closedSites) || new Set(v.collected).size !== v.collected.length || new Set(v.placed).size !== v.placed.length) return null;
    const collected = v.collected.includes(id), placed = v.placed.includes(part), mask = v.cleaning[id];
    const exposed = findIsExposed(v.dig as Record<string, number>, ROOM1_SITES[1], id);
    if ((collected || mask !== undefined) && !exposed || placed && !collected
      || v.closedSites.includes('eryops-dig') && !collected) return null;
    if (mask !== undefined && (collected || !Array.isArray(mask) || new Set(mask).size !== mask.length
      || !mask.every(n => CLEANING_AREAS.includes(n)))) return null;
    const cleaning = { ...v.cleaning }; delete cleaning[id];
    if (!parseSave(JSON.stringify({ ...v, version: 12, cleaning,
      collected: v.collected.filter(p => p !== id), placed: v.placed.filter(p => p !== part) }))) return null;
    return { ...v, version: 26 } as JourneyState;
  } catch { return null; }
}
export function parseRoom1Game(raw: string, seed: number): Room1GameSave | null {
  try {
    const v = JSON.parse(raw); if (!record(v)) return null;
    if (v.version !== 26) { const old = parseMvpSave(raw, seed); return old ? migrateRoom1Game(old) : null; }
    const displayed = (s: { placed: readonly string[]; museum: { owned: readonly { id: string }[] } }) => ROOM1_EXHIBITS.filter(e =>
      s.museum.owned.some(o => o.id === `stand-${e.id}`) && e.parts.every(p => s.placed.includes(p))).map(e => e.id);
    const save = parseMvpSave(JSON.stringify({ ...v, version: 25 }), seed, {
      order: ROOM1_EXHIBITS.map(e => e.id), prices: { 'stand-dimetrodon': 12, 'stand-trilobite': 8, 'stand-eryops': 16, 'stand-walchia': 10, 'west-wing': 18 },
      rules: { parseJourney: parseRoom1Journey, extraPurchases: [{ id: 'stand-walchia', cost: 10 }], exhibits: ROOM1_EXHIBITS,
        standAvailable: (s, id) => s.museum.owned.some(o => o.id === `stand-${id}`), displayedExhibits: displayed,
        ticketPrice: s => displayed(s).reduce((sum, id) => sum + (id === 'trilobite' || id === 'walchia' ? 2 : 4), 0),
        custodySite: id => ROOM1_SITES.find(site => site.requiredDiscoveryIds.includes(id))?.id,
        isUncovered: (s, id) => isUncovered({ ...s, version: 26 } as JourneyState, id),
        validHelperTask: (s, task) => validHelperTask({ ...s, version: 26 } as Room1GameSave, task),
      },
    });
    return save ? { ...save, version: 26 } : null;
  } catch { return null; }
}
export function loadRoom1Game(storage: StoragePort, seed: number):
  { kind: 'ready'; save: Room1GameSave; restored: boolean; unassigned: boolean } | { kind: 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { kind: 'ready', save: createRoom1Game(seed), restored: false, unassigned: false };
    const save = parseRoom1Game(raw, seed); if (!save) return { kind: 'invalid' };
    const old = JSON.parse(raw);
    const unassigned = !!old.helpers?.owned?.some((h: { siteId: string | null }, i: number) => h.siteId && !save.helpers.owned[i]?.siteId);
    return { kind: 'ready', save: settleDeliveries(retirePaid(save)), restored: true, unassigned };
  } catch { return { kind: 'unavailable' }; }
}
