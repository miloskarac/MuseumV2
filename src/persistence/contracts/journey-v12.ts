// Frozen V2 journey contracts for schemas 1-12 (embedded unchanged through 22).
// Data only: no runtime catalog imports, labels, art, world positions or navigation.
// Exposure thresholds pin burial interpretation without retaining rendering geometry.
import type { JourneyState } from '../../game/journey.ts';
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const GROUPS = freeze([
  { id: 'skull', discoveryId: 'bone-study-head' },
  { id: 'spine-sail', discoveryId: 'bone-study-01' },
  { id: 'ribs', discoveryId: 'dimetrodon-ribs' },
  { id: 'front-legs', discoveryId: 'dimetrodon-front-legs' },
  { id: 'hind-legs', discoveryId: 'dimetrodon-hind-legs' },
  { id: 'tail', discoveryId: 'dimetrodon-tail' },
] as const);
export const ERYOPS_GROUPS = freeze([
  { id: 'eryops-skull', discoveryId: 'eryops-skull-find' },
  { id: 'eryops-spine', discoveryId: 'eryops-spine-find' },
  { id: 'eryops-ribs', discoveryId: 'eryops-ribs-find' },
  { id: 'eryops-front-legs', discoveryId: 'eryops-front-legs-find' },
  { id: 'eryops-hind-legs', discoveryId: 'eryops-hind-legs-find' },
  { id: 'eryops-tail', discoveryId: 'eryops-tail-find' },
] as const);
export const SLAB_PART = freeze({"id":"trilobite-whole","discoveryId":"trilobite-slab"} as const);
export const FIRST_PARTS = freeze([...GROUPS, SLAB_PART]);
export const ALL_PARTS = freeze([...FIRST_PARTS, ...ERYOPS_GROUPS]);
export const DISCOVERY = freeze({ id: 'bone-study-01', cleaning: { completion: 0.9 } });
export const CLEANING_AREAS = freeze(Array.from({ length: 336 }, (_, i) => i));
export const ELIGIBLE_AREAS: readonly number[] = freeze([
  51, 52, 53, 54, 65, 66, 67, 68, 74, 75, 76, 77, 78, 79, 88, 89,
  90, 91, 92, 93, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
  110, 111, 112, 113, 114, 115, 116, 117, 123, 124, 125, 126, 127, 128, 129, 130,
  131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 148, 149, 150, 151, 152, 153,
  154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 172, 173, 174, 175, 176, 177,
  178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 195, 196, 197, 198, 199, 200,
  201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 218, 219, 220, 221,
  222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237,
  242, 243, 244, 245, 246, 247, 256, 257, 258, 259, 260, 261, 267, 268, 269, 270,
  281, 282, 283, 284,
]);
export type HistoricalSite = {
  readonly id: string; readonly requires: string | null; readonly requiredDiscoveryIds: readonly string[];
  readonly grid: { readonly rows: number; readonly columns: number; readonly levels: number };
  readonly cells: readonly { readonly id: string; readonly row: number; readonly column: number; readonly discoveryId: string | null; readonly exposure: number }[];
};
// Each find lists [cell index, required cleared fraction]. Cell order is row-major.
function site(id: string, prefix: string, levels: number, requires: string | null,
  finds: readonly (readonly [string, readonly (readonly [number, number])[]])[]): HistoricalSite {
  return freeze({ id, requires, requiredDiscoveryIds: finds.map(([id]) => id), grid: { rows: 8, columns: 8, levels },
    cells: Array.from({ length: 64 }, (_, index) => {
      const row = Math.floor(index / 8), column = index % 8;
      const find = finds.find(([, cells]) => cells.some(([i]) => i === index));
      return { id: `${prefix}-r${row}-c${column}`, row, column, discoveryId: find?.[0] ?? null,
        exposure: find?.[1].find(([i]) => i === index)?.[1] ?? 1 };
    }) });
}
export const LEGACY_SITE = site("courtyard-dig", "courtyard", 1, null, [
  ["bone-study-head",[[43,1]]],
  ["bone-study-01",[[51,1]]],
  ["dimetrodon-ribs",[[35,1]]],
  ["dimetrodon-front-legs",[[27,1]]],
  ["dimetrodon-hind-legs",[[19,1]]],
  ["dimetrodon-tail",[[11,1]]]
]);
export const LEGACY_SLAB_SITE = site("future-site-02", "slab", 1, "courtyard-dig", [
  ["trilobite-slab",[[43,1]]]
]);
export const LEGACY_SHARED_SITE = site("courtyard-dig", "courtyard", 1, null, [
  ["bone-study-head",[[43,1]]],
  ["bone-study-01",[[51,1]]],
  ["dimetrodon-ribs",[[35,1]]],
  ["dimetrodon-front-legs",[[27,1]]],
  ["dimetrodon-hind-legs",[[19,1]]],
  ["dimetrodon-tail",[[11,1]]],
  ["trilobite-slab",[[3,1]]]
]);
export const LEGACY_ERYOPS_SITE = site("eryops-dig", "eryops", 1, "courtyard-dig", [
  ["eryops-skull-find",[[51,1]]],
  ["eryops-spine-find",[[43,1]]],
  ["eryops-ribs-find",[[35,1]]],
  ["eryops-front-legs-find",[[27,1]]],
  ["eryops-hind-legs-find",[[19,1]]],
  ["eryops-tail-find",[[11,1]]]
]);
export const FOOTPRINT_FIRST_11 = site("courtyard-dig", "courtyard", 1, null, [
  ["bone-study-head",[[51,1],[52,1]]],
  ["bone-study-01",[[33,1],[34,1],[41,1],[42,1],[49,1],[50,1]]],
  ["dimetrodon-ribs",[[35,1],[36,1],[43,1],[44,1]]],
  ["dimetrodon-front-legs",[[45,1],[46,1],[53,1],[54,1]]],
  ["dimetrodon-hind-legs",[[9,1],[10,1],[17,1],[18,1]]],
  ["dimetrodon-tail",[[27,1],[28,1],[29,1],[30,1]]],
  ["trilobite-slab",[[13,1],[14,1],[21,1],[22,1]]]
]);
export const FOOTPRINT_SECOND_11 = site("eryops-dig", "eryops", 2, "courtyard-dig", [
  ["eryops-skull-find",[[43,1],[44,1],[51,1],[52,1]]],
  ["eryops-spine-find",[[33,1],[34,1],[35,1]]],
  ["eryops-ribs-find",[[37,1],[38,1],[45,1],[46,1]]],
  ["eryops-front-legs-find",[[9,1],[10,1],[17,1],[18,1]]],
  ["eryops-hind-legs-find",[[13,1],[14,1],[21,1],[22,1]]],
  ["eryops-tail-find",[[27,1],[28,1],[29,1],[30,1]]]
]);
export const SITE = site("courtyard-dig", "courtyard", 1, null, [
  ["bone-study-head",[[51,1],[52,1]]],
  ["bone-study-01",[[33,1],[34,1],[41,1],[42,1],[49,1],[50,1]]],
  ["dimetrodon-ribs",[[35,1],[36,1],[43,1],[44,1]]],
  ["dimetrodon-front-legs",[[45,1],[46,1],[53,1],[54,1]]],
  ["dimetrodon-hind-legs",[[9,1],[10,1],[17,1],[18,1]]],
  ["dimetrodon-tail",[[14,1],[22,1],[30,1],[38,1]]],
  ["trilobite-slab",[[11,1],[12,1],[19,1],[20,1]]]
]);
export const ERYOPS_SITE = site("eryops-dig", "eryops", 2, "courtyard-dig", [
  ["eryops-skull-find",[[43,1],[44,1],[51,1],[52,1]]],
  ["eryops-spine-find",[[25,0.5],[33,1],[41,1]]],
  ["eryops-ribs-find",[[37,1],[38,1],[45,1],[46,1]]],
  ["eryops-front-legs-find",[[9,1],[10,1],[17,1],[18,1]]],
  ["eryops-hind-legs-find",[[13,1],[14,1],[21,1],[22,1]]],
  ["eryops-tail-find",[[27,1],[28,1],[29,1],[30,1]]]
]);
export const LEGACY_FOOTPRINT_SITES = freeze([FOOTPRINT_FIRST_11, FOOTPRINT_SECOND_11]);
export const SITES = freeze([SITE, ERYOPS_SITE]);
export const findIsExposed = (dig: Record<string, number>, site: HistoricalSite, id: string) => {
  const cells = site.cells.filter(cell => cell.discoveryId === id);
  return cells.length > 0 && cells.every(cell => (dig[cell.id] ?? 0) >= cell.exposure);
};
export const isUncovered = (state: Pick<JourneyState, 'dig'>, id: string) => SITES.some(site =>
  site.requiredDiscoveryIds.includes(id) && findIsExposed(state.dig, site, id));
export const freshJourney = (): JourneyState => ({ version: 12, activeSiteId: SITE.id, room: 'museum', dig: {}, cleaning: {}, collected: [], closedSites: [], placed: [] });
export const allRecovered = (state: Pick<JourneyState, 'collected' | 'cleaning' | 'dig'>, site: HistoricalSite) =>
  site.requiredDiscoveryIds.length > 0 && site.requiredDiscoveryIds.every(id => state.collected.includes(id) && !state.cleaning[id] && findIsExposed(state.dig, site, id));
export function completionPhase(state: Omit<JourneyState, 'version'>): 'closed' | 'cleanup' | 'exit' | null {
  const site = SITES.find(site => site.id === state.activeSiteId)!;
  if (state.closedSites.includes(site.id)) return 'closed';
  if (!allRecovered(state, site)) return null;
  const remaining = site.cells.some(cell => state.dig[cell.id] !== 1);
  return state.room === 'excavation' ? remaining ? 'cleanup' : 'exit' : state.room === 'outdoors' && !remaining ? 'exit' : null;
}
