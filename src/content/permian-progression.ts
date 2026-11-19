import { PERMIAN_EXHIBITS, PERMIAN_ROOMS, permianRoomForExhibit } from './permian-museum.ts';
import type { PermianExhibitId, PermianRoomDefinition, PermianRoomId } from './permian-museum.ts';

// Phase 7.6A planning catalog only. Never import into live offers/travel or save contracts.
// Room membership order is presentation metadata; this is the authoritative purchase order.
export const PERMIAN_EXHIBIT_ORDER = [
  'dimetrodon', 'trilobite', 'eryops', 'walchia',
  'moschops', 'arthropleura', 'estemmenosuchus', 'glossopteris', 'edaphosaurus', 'captorhinus',
  'gorgonops', 'helicoprion', 'scutosaurus', 'gorgonops-tooth', 'inostrancevia', 'dicynodon', 'permian-ammonoid',
] as const satisfies readonly PermianExhibitId[];
export type PermianStandId = `stand-${PermianExhibitId}`;
export type PermianStandPlan = {
  readonly id: PermianStandId;
  readonly exhibitId: PermianExhibitId;
  readonly roomId: PermianRoomId;
  readonly requiredDisplayIds: readonly PermianExhibitId[];
};
export const PERMIAN_STAND_PLANS: readonly PermianStandPlan[] = PERMIAN_EXHIBIT_ORDER.map((exhibitId, i) => ({
  // These also preserve the existing three stand purchase identities.
  id: `stand-${exhibitId}`, exhibitId, roomId: permianRoomForExhibit(exhibitId)!.id,
  requiredDisplayIds: i === 0 ? [] : [PERMIAN_EXHIBIT_ORDER[i - 1]],
}));
export const PERMIAN_PROGRESSION: readonly { readonly position: number; readonly exhibitId: PermianExhibitId; readonly standId: PermianStandId }[] = PERMIAN_STAND_PLANS.map((stand, i) => ({
  position: i + 1, exhibitId: stand.exhibitId, standId: stand.id,
}));

// Existing live identities are retained literally, without importing mutable live grids.
// New IDs name their triggering specimen; future-site-03 is an unassigned live placeholder.
export const PERMIAN_SITE_IDS = ['courtyard-dig', 'eryops-dig', 'moschops-dig', 'estemmenosuchus-dig',
  'edaphosaurus-dig', 'gorgonops-dig', 'scutosaurus-dig', 'inostrancevia-dig'] as const;
export type PermianSiteId = typeof PERMIAN_SITE_IDS[number];
export type PermianSitePlan = {
  readonly id: PermianSiteId;
  readonly roomId: PermianRoomId;
  readonly exhibitIds: readonly PermianExhibitId[];
  readonly triggerStandId: PermianStandId;
  readonly initiallyAvailable: boolean;
  readonly candidatePrice: number;
  // None approved. Explicit dependencies let validation diagnose injected site cycles;
  // any nonempty list is rejected by this version of the approved graph contract.
  readonly requiredSiteIds: readonly PermianSiteId[];
};
export const PERMIAN_SITE_PLANS: readonly PermianSitePlan[] = [
  { id: 'courtyard-dig', roomId: 'permian-room-1', exhibitIds: ['dimetrodon', 'trilobite'], triggerStandId: 'stand-dimetrodon', initiallyAvailable: true, candidatePrice: 0, requiredSiteIds: [] },
  { id: 'eryops-dig', roomId: 'permian-room-1', exhibitIds: ['eryops', 'walchia'], triggerStandId: 'stand-eryops', initiallyAvailable: false, candidatePrice: 20, requiredSiteIds: [] },
  { id: 'moschops-dig', roomId: 'permian-room-2', exhibitIds: ['moschops', 'arthropleura'], triggerStandId: 'stand-moschops', initiallyAvailable: false, candidatePrice: 30, requiredSiteIds: [] },
  { id: 'estemmenosuchus-dig', roomId: 'permian-room-2', exhibitIds: ['estemmenosuchus', 'glossopteris'], triggerStandId: 'stand-estemmenosuchus', initiallyAvailable: false, candidatePrice: 40, requiredSiteIds: [] },
  { id: 'edaphosaurus-dig', roomId: 'permian-room-2', exhibitIds: ['edaphosaurus', 'captorhinus'], triggerStandId: 'stand-edaphosaurus', initiallyAvailable: false, candidatePrice: 50, requiredSiteIds: [] },
  { id: 'gorgonops-dig', roomId: 'permian-room-3', exhibitIds: ['gorgonops', 'helicoprion'], triggerStandId: 'stand-gorgonops', initiallyAvailable: false, candidatePrice: 60, requiredSiteIds: [] },
  { id: 'scutosaurus-dig', roomId: 'permian-room-3', exhibitIds: ['scutosaurus', 'gorgonops-tooth'], triggerStandId: 'stand-scutosaurus', initiallyAvailable: false, candidatePrice: 75, requiredSiteIds: [] },
  { id: 'inostrancevia-dig', roomId: 'permian-room-3', exhibitIds: ['inostrancevia', 'dicynodon', 'permian-ammonoid'], triggerStandId: 'stand-inostrancevia', initiallyAvailable: false, candidatePrice: 90, requiredSiteIds: [] },
];
export type PermianProgressionGraph = {
  readonly exhibits: readonly { readonly id: PermianExhibitId; readonly size: 'large' | 'small' }[];
  readonly rooms: readonly PermianRoomDefinition[];
  readonly sequence: readonly { readonly position: number; readonly exhibitId: PermianExhibitId; readonly standId: PermianStandId }[];
  readonly stands: readonly PermianStandPlan[];
  readonly sites: readonly PermianSitePlan[];
};
export const PERMIAN_PROGRESSION_GRAPH: PermianProgressionGraph = {
  exhibits: PERMIAN_EXHIBITS, rooms: PERMIAN_ROOMS, sequence: PERMIAN_PROGRESSION,
  stands: PERMIAN_STAND_PLANS, sites: PERMIAN_SITE_PLANS,
};

export const siteForPermianExhibit = (id: string): PermianSitePlan | undefined =>
  PERMIAN_SITE_PLANS.find(site => site.exhibitIds.some(exhibit => exhibit === id));
