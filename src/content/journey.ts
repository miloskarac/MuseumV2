import { GROUPS, SPECIMEN_ID, ALL_PARTS, FIRST_PARTS, ERYOPS_GROUPS, SLAB_PART, WALCHIA_PART } from './exhibit.ts';
// Stable content IDs and cleaning-grid indices are part of save version 1.
// Legacy bone study ID/template retained for V2 save compatibility.
export const DISCOVERY = {
  id: 'bone-study-01',
  name: 'Фосилна кост',
  cleaning: {
    columns: 24, rows: 14, brushRadius: 1.7, completion: 0.9,
    mask: [
      '000000000000000000000000',
      '000000000000000000000000',
      '000111100000000001111000',
      '001111110000000011111100',
      '001111111111111111111100',
      '000111111111111111111000',
      '000011111111111111110000',
      '000011111111111111110000',
      '000111111111111111111000',
      '001111111111111111111100',
      '001111110000000011111100',
      '000111100000000001111000',
      '000000000000000000000000',
      '000000000000000000000000',
    ],
  },
} as const;

export const DISCOVERIES = GROUPS.map(group => ({ ...DISCOVERY, id: group.discoveryId, name: group.label, groupId: group.id }));
export const FIRST_DISCOVERIES = FIRST_PARTS.map(group => ({ ...DISCOVERY, id: group.discoveryId, name: group.label, groupId: group.id }));
export const ALL_DISCOVERIES = ALL_PARTS.map(group => ({ ...DISCOVERY, id: group.discoveryId, name: group.label, groupId: group.id }));
export const ROOM1_DISCOVERIES = [...ALL_DISCOVERIES, { ...DISCOVERY, id: WALCHIA_PART.discoveryId, name: WALCHIA_PART.label, groupId: WALCHIA_PART.id }];
export const discoveriesFor = (state: { version: number }) => state.version === 26 ? ROOM1_DISCOVERIES : ALL_DISCOVERIES;

export type DigSite = {
  id: string; specimenId: string; requiredDiscoveryIds: readonly string[]; requires: string | null;
  room: 'excavation';
  grid: { columns: number; rows: number; levels: number; tileSize: number; x: number; z: number; floorY: number };
  interaction: { x: number; z: number; radius: number };
  // Zero-based soil layers, shallow to deep. Omitted finds lie on the pit floor.
  burial?: Readonly<Record<string, { topLayer: number; bottomLayer: number; axis: 'x' | 'z' }>>;
  cells: { id: string; row: number; column: number; x: number; z: number; discoveryId: string | null }[];
};

// One additional layer per sequential site; keep the tutorial pit unchanged.
export const EXCAVATION_DEPTH = { firstLevels: 1, levelsPerSite: 1, layerHeight: 0.7, layersPerColor: 2 } as const;
export const DEPTH_COLORS = ['#dec091', '#b78a61', '#886649', '#665345'] as const;
// Repeat whole bands if later content exceeds the palette; never wrap mid-band.
export const soilColorIndex = (layer: number) => Math.floor(Math.max(0, layer) / EXCAVATION_DEPTH.layersPerColor) % DEPTH_COLORS.length;
export function siteDimensions(completedBefore: number) {
  return { columns: 8, rows: 8,
    levels: EXCAVATION_DEPTH.firstLevels + Math.floor(Math.max(0, completedBefore)) * EXCAVATION_DEPTH.levelsPerSite };
}
// Historical layout stays frozen for save validation and conversion.
const grid = { columns: 8, rows: 8, levels: 1, tileSize: 1.05, x: -1.3, z: 0.25, floorY: -0.7 };
// Six reachable tiles down the ladder's column. Existing find tiles stay fixed.
const FIND_ROWS: Record<string, number> = { skull: 5, 'spine-sail': 6, ribs: 4, 'front-legs': 3, 'hind-legs': 2, tail: 1 };
export const LEGACY_SITE: DigSite = {
  id: 'courtyard-dig',
  requires: null,
  specimenId: SPECIMEN_ID,
  requiredDiscoveryIds: DISCOVERIES.map(find => find.id),
  room: 'excavation',
  grid,
  interaction: { x: grid.x - grid.tileSize / 2, z: grid.z + grid.rows * grid.tileSize / 2 + 0.55, radius: 0.8 },
  cells: Array.from({ length: grid.rows * grid.columns }, (_, index) => {
    const row = Math.floor(index / grid.columns), column = index % grid.columns;
    return {
      id: `courtyard-r${row}-c${column}`, row, column,
      x: grid.x + (column - (grid.columns - 1) / 2) * grid.tileSize,
      z: grid.z + (row - (grid.rows - 1) / 2) * grid.tileSize,
      discoveryId: column === grid.columns / 2 - 1
        ? DISCOVERIES.find(find => FIND_ROWS[find.groupId] === row)?.id ?? null : null,
    };
  }),
} as const;

// Same proven pit dimensions and shovel tuning, with independent progress IDs.
export const LEGACY_SLAB_SITE: DigSite = {
  ...LEGACY_SITE, id: 'future-site-02', specimenId: 'trilobite', requires: LEGACY_SITE.id,
  requiredDiscoveryIds: [SLAB_PART.discoveryId],
  cells: LEGACY_SITE.cells.map(cell => ({ ...cell, id: `slab-r${cell.row}-c${cell.column}`,
    discoveryId: cell.row === 5 && cell.column === 3 ? SLAB_PART.discoveryId : null })),
};
// Small whole fossils share the pit. Existing bone tiles stay fixed.
export const LEGACY_SHARED_SITE: DigSite = {
  ...LEGACY_SITE, requiredDiscoveryIds: FIRST_PARTS.map(part => part.discoveryId),
  cells: LEGACY_SITE.cells.map(cell => ({ ...cell,
    discoveryId: cell.row === 0 && cell.column === 3 ? SLAB_PART.discoveryId : cell.discoveryId })),
};
export const LEGACY_ERYOPS_SITE: DigSite = {
  ...LEGACY_SITE, id: 'eryops-dig', specimenId: 'eryops', requires: LEGACY_SHARED_SITE.id,
  requiredDiscoveryIds: ERYOPS_GROUPS.map(part => part.discoveryId),
  cells: LEGACY_SITE.cells.map(cell => ({ ...cell, id: `eryops-r${cell.row}-c${cell.column}`,
    discoveryId: cell.column === 3 ? ERYOPS_GROUPS[6 - cell.row]?.discoveryId ?? null : null })),
};
// Non-overlapping footprints: row, column, width and depth in dirt tiles.
// These are excavation silhouettes, not anatomical scale measurements.
type Footprint = readonly [groupId: typeof ALL_PARTS[number]['id'], row: number, column: number, width: number, depth: number];
function withFootprints(site: DigSite, completedBefore: number, footprints: readonly Footprint[]): DigSite {
  const dimensions = siteDimensions(completedBefore);
  return { ...site, grid: { ...site.grid, ...dimensions, floorY: -dimensions.levels * EXCAVATION_DEPTH.layerHeight },
    cells: site.cells.map(cell => {
      const footprint = footprints.find(([, row, column, width, depth]) => cell.row >= row && cell.row < row + depth
        && cell.column >= column && cell.column < column + width);
      return { ...cell, discoveryId: footprint ? ALL_PARTS.find(part => part.id === footprint[0])!.discoveryId : null };
    }) };
}
const SCHEMA11_FIRST_FOOTPRINTS: readonly Footprint[] = [
  ['skull', 6, 3, 2, 1], ['spine-sail', 4, 1, 2, 3], ['ribs', 4, 3, 2, 2],
  ['front-legs', 5, 5, 2, 2], ['hind-legs', 1, 1, 2, 2], ['tail', 3, 3, 4, 1],
  ['trilobite-whole', 1, 5, 2, 2],
];
const SCHEMA11_ERYOPS_FOOTPRINTS: readonly Footprint[] = [
  ['eryops-skull', 5, 3, 2, 2], ['eryops-spine', 4, 1, 3, 1], ['eryops-ribs', 4, 5, 2, 2],
  ['eryops-front-legs', 1, 1, 2, 2], ['eryops-hind-legs', 1, 5, 2, 2], ['eryops-tail', 3, 3, 4, 1],
];
// Keep the old tile assignments available to validate saved discoveries.
export const LEGACY_FOOTPRINT_SITES = [
  withFootprints(LEGACY_SHARED_SITE, 0, SCHEMA11_FIRST_FOOTPRINTS),
  withFootprints(LEGACY_ERYOPS_SITE, 1, SCHEMA11_ERYOPS_FOOTPRINTS),
] as const;
// Long finds face both directions on the pit floor, with the same covered area.
const REORIENTED_FOOTPRINTS: Partial<Record<Footprint[0], Footprint>> = {
  tail: ['tail', 1, 6, 1, 4],
  'trilobite-whole': ['trilobite-whole', 1, 3, 2, 2],
  'eryops-spine': ['eryops-spine', 3, 1, 1, 3],
};
export const SITE = withFootprints(LEGACY_SHARED_SITE, 0,
  SCHEMA11_FIRST_FOOTPRINTS.map(footprint => REORIENTED_FOOTPRINTS[footprint[0]] ?? footprint));
export const ERYOPS_SITE: DigSite = {
  ...withFootprints(LEGACY_ERYOPS_SITE, 1,
    SCHEMA11_ERYOPS_FOOTPRINTS.map(footprint => REORIENTED_FOOTPRINTS[footprint[0]] ?? footprint)),
  burial: { 'eryops-spine-find': { topLayer: 0, bottomLayer: 1, axis: 'z' } },
};
export const SITES = [SITE, ERYOPS_SITE] as const;
export const ROOM1_ERYOPS_SITE: DigSite = { ...ERYOPS_SITE,
  requiredDiscoveryIds: [...ERYOPS_SITE.requiredDiscoveryIds, WALCHIA_PART.discoveryId],
  cells: ERYOPS_SITE.cells.map(cell => ({ ...cell, discoveryId: cell.row === 0 && (cell.column === 3 || cell.column === 4)
    ? WALCHIA_PART.discoveryId : cell.discoveryId })) };
export const ROOM1_SITES = [SITE, ROOM1_ERYOPS_SITE] as const;
export const sitesFor = (state: { version?: number }) => state.version === 26 ? ROOM1_SITES : SITES;
export const activeSite = (state: { activeSiteId: string; version?: number }) => sitesFor(state).find(site => site.id === state.activeSiteId)!;
export const sitePlot = (site: DigSite) => SITE_PLOTS.find(plot => plot.id === site.id)!;
export const siteFront = (site: DigSite) => ({ x: sitePlot(site).entrance.x, z: sitePlot(site).entrance.z - 1.15 });

export const SITE_PLOTS = [
  { id: SITE.id, number: 1, requires: null, dimensions: siteDimensions(0), x: -4.5, z: 1.6, entrance: { x: -4.5, z: -0.45 }, playable: true },
  { id: ERYOPS_SITE.id, number: 2, requires: SITE.id, dimensions: siteDimensions(1), x: 0, z: 0.6, entrance: { x: 0, z: -1.45 }, playable: true },
  { id: 'future-site-03', number: 3, requires: ERYOPS_SITE.id, dimensions: siteDimensions(2), x: 4.5, z: -2.5, entrance: { x: 4.5, z: -4.55 }, playable: false },
] as const;
export const SHOVEL_SECONDS = 1;
export const SHOVEL_CONTACT = 0.72;
export const HITS_PER_LAYER = 2;
export const CLEANUP_TILE_SECONDS = 0.32;
export const SITE_FRONT = { x: SITE_PLOTS[0].entrance.x, z: SITE_PLOTS[0].entrance.z - 1.15 };

export const ELIGIBLE_AREAS: readonly number[] = DISCOVERY.cleaning.mask.flatMap((row, y) =>
  [...row].flatMap((cell, x) => cell === '1' ? [y * DISCOVERY.cleaning.columns + x] : []));
// The legacy silhouette above is retained only to validate older saves.
export const CLEANING_AREAS = Array.from({ length: DISCOVERY.cleaning.columns * DISCOVERY.cleaning.rows }, (_, i) => i);

export const journeyText = {
  bag: 'Торба', emptyBag: 'Торба је празна. Потражи фосил на налазишту.',
  bagItem: 'Очишћена фосилна кост', closeBag: 'Настави шетњу',
  approach: 'Уђи поред мердевина. Ходај по земљи и стани да копаш.',
  dig: 'Откопавамо…', digHint: 'Можеш да одеш и наставиш касније.',
  siteComplete: 'Налазиште је завршено!',
  finishDigging: 'Сви налази су у торби. Рашчишћавамо налазиште…',
  leavingSite: 'Враћамо се испред налазишта…', closedSite: 'Налазиште је завршено и затворено.',
  outdoorsHint: 'Уђи у прво налазиште. Ту су кости и мали фосил на плочи.',
  nextSite: 'Потражи преостале налазе у првом налазишту.',
  eryopsSite: 'У другом налазишту потражи ериопса и гранчицу валхије!',
  slabMissing: 'Пронађи и очисти фосил на плочи у првом налазишту.',
  slabReady: 'Приђи кругу поред малог постоља. Изабери плочу, па њено место.',
  placeWhole: 'Постави фосил',
  slabUnknown: 'Фосил на плочи',
  allDone: 'Сви експонати су готови! Прошетај музејом и погледај њихове приче.',
  returnFinds: 'Врати се у музеј кроз круг поред врата. Приђи постољу свог фосила.',
  siteLocked: 'Прво заврши претходно налазиште.',
  lockedSite: 'Ово налазиште није део ове пустоловине.',
  futurePurchase: 'Ово налазиште није део ове пустоловине.',
  siteName: 'Налазиште', enter: 'Уђи', brushLabel: 'Четкица',
  uncover: 'Фосил је откривен!', clean: 'Очисти фосил', resume: 'Настави чишћење',
  cleanHint: 'Држи дугме миша и превлачи четкицу преко земље.',
  cleanSafe: 'Не можеш да оштетиш фосил.', cleanTitle: 'Очистимо фосил',
  leave: 'Настави касније', collected: 'Фосил је у торби!',
  collect: 'Стави у торбу', cleaned: 'Фосил је чист!', cleanedHint: 'Сада стави фосил у торбу.',
  collectedHint: 'Налази су очишћени. Можеш да се вратиш у музеј.',
  digProgress: 'Откопано', cleanProgress: 'Очишћено',
  saving: 'Чувамо напредак…', saved: 'Напредак је сачуван.',
  saveFailed: 'Напредак није сачуван. Покушај поново пре затварања.',
  retry: 'Покушај поново', reset: 'Нови почетак',
  recoveryTitle: 'Не можемо да отворимо сачувану игру',
  recovery: 'Сачувана игра је остала нетакнута. Покушај поново или, уз помоћ одрасле особе, изабери нови почетак.',
  milestoneTitle: 'Нови редослед у музеју',
  milestoneHint: 'Сада прво слажемо диметродона, затим трилобита, па ериопса. Твој напредак је сачуван. За прво постоље тренутно нема довољно новчића. У старој пробној игри можда нећеш моћи даље. Можеш да задржиш игру или, уз помоћ одрасле особе, изабереш нови почетак.',
  keepGame: 'Задржи игру',
  storageUnavailable: 'Чување тренутно није доступно. Покушај поново.',
  resetTitle: 'Обрисати напредак?',
  resetHint: 'Ово брише откопавање, торбу и експонате у овој игри. Нека ти помогне одрасла особа.',
  confirmReset: 'Обриши и почни поново', cancel: 'Одустани',
  resetFailed: 'Брисање није успело. Напредак није ресетован. Покушај поново.',
} as const;
