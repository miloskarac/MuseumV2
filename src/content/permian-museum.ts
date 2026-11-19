import type { ExhibitId } from './exhibit.ts';

// Approved planning metadata only. These are not playable exhibit definitions:
// no parts, discoveries, assembly recipes, purchase offers or save entitlements.
type ExhibitPlan = { readonly size: 'large' | 'small' } & (
  { readonly id: ExhibitId; readonly implementation: 'implemented' }
  | { readonly id: string; readonly implementation: 'planned' }
);
export const PERMIAN_EXHIBITS = [
  { id: 'dimetrodon', size: 'large', implementation: 'implemented' },
  { id: 'eryops', size: 'large', implementation: 'implemented' },
  { id: 'trilobite', size: 'small', implementation: 'implemented' },
  { id: 'walchia', size: 'small', implementation: 'implemented' },
  { id: 'moschops', size: 'large', implementation: 'planned' },
  { id: 'estemmenosuchus', size: 'large', implementation: 'planned' },
  { id: 'edaphosaurus', size: 'large', implementation: 'planned' },
  { id: 'arthropleura', size: 'small', implementation: 'planned' },
  { id: 'glossopteris', size: 'small', implementation: 'planned' },
  { id: 'captorhinus', size: 'small', implementation: 'planned' },
  { id: 'gorgonops', size: 'large', implementation: 'planned' },
  { id: 'scutosaurus', size: 'large', implementation: 'planned' },
  { id: 'inostrancevia', size: 'large', implementation: 'planned' },
  { id: 'helicoprion', size: 'small', implementation: 'planned' },
  { id: 'gorgonops-tooth', size: 'small', implementation: 'planned' },
  { id: 'dicynodon', size: 'small', implementation: 'planned' },
  { id: 'permian-ammonoid', size: 'small', implementation: 'planned' },
] as const satisfies readonly ExhibitPlan[];

export type PermianExhibitId = typeof PERMIAN_EXHIBITS[number]['id'];
export type PermianRoomId = 'permian-room-1' | 'permian-room-2' | 'permian-room-3';
export type PermianRoomDefinition = {
  readonly id: PermianRoomId;
  readonly displayName: string;
  readonly exhibitIds: readonly PermianExhibitId[];
  readonly largeExhibitIds: readonly PermianExhibitId[];
  readonly smallExhibitIds: readonly PermianExhibitId[];
  readonly predecessorRoomId: PermianRoomId | null;
  readonly requiredExhibitIds: readonly PermianExhibitId[];
  readonly featuredExhibitId: PermianExhibitId;
  readonly initiallyAvailable: boolean;
};

export const permianExhibitDefinition = (id: string) => PERMIAN_EXHIBITS.find(exhibit => exhibit.id === id);

// Every exhibit is required in the approved three-room design. Derive the
// subsets from one ordered membership list so size and completion cannot drift.
function defineRoom(room: Omit<PermianRoomDefinition, 'largeExhibitIds' | 'smallExhibitIds' | 'requiredExhibitIds'>): PermianRoomDefinition {
  return { ...room,
    largeExhibitIds: room.exhibitIds.filter(id => permianExhibitDefinition(id)?.size === 'large'),
    smallExhibitIds: room.exhibitIds.filter(id => permianExhibitDefinition(id)?.size === 'small'),
    requiredExhibitIds: room.exhibitIds,
  };
}
export const PERMIAN_ROOMS: readonly PermianRoomDefinition[] = [
  defineRoom({ id: 'permian-room-1', displayName: 'Рани перм',
    exhibitIds: ['dimetrodon', 'eryops', 'trilobite', 'walchia'],
    predecessorRoomId: null, featuredExhibitId: 'eryops', initiallyAvailable: true }),
  defineRoom({ id: 'permian-room-2', displayName: 'Пермски дивови',
    exhibitIds: ['moschops', 'estemmenosuchus', 'edaphosaurus', 'arthropleura', 'glossopteris', 'captorhinus'],
    predecessorRoomId: 'permian-room-1', featuredExhibitId: 'moschops', initiallyAvailable: false }),
  defineRoom({ id: 'permian-room-3', displayName: 'Касни перм',
    exhibitIds: ['gorgonops', 'scutosaurus', 'inostrancevia', 'helicoprion', 'gorgonops-tooth', 'dicynodon', 'permian-ammonoid'],
    predecessorRoomId: 'permian-room-2', featuredExhibitId: 'inostrancevia', initiallyAvailable: false }),
];
export const permianRoomDefinition = (id: string) => PERMIAN_ROOMS.find(room => room.id === id);
export const permianRoomForExhibit = (id: PermianExhibitId) => PERMIAN_ROOMS.find(room => room.exhibitIds.includes(id));
