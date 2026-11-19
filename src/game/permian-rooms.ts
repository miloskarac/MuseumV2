import { permianExhibitDefinition, permianRoomDefinition, permianRoomForExhibit } from '../content/permian-museum.ts';
import type { PermianExhibitId, PermianRoomDefinition, PermianRoomId } from '../content/permian-museum.ts';

// Caller-supplied definitions, not a live catalog or a save envelope. Future
// integration must supply authoritative recipes/stand assignments separately
// from player progress. Tests can supply synthetic definitions for planned IDs.
export type PermianProgressDefinitions = {
  readonly exhibits: readonly { readonly id: PermianExhibitId; readonly requiredPartIds: readonly string[] }[];
  readonly stands: readonly { readonly id: string; readonly roomId: PermianRoomId; readonly exhibitId: PermianExhibitId }[];
};
export type PermianExhibitProgress = {
  readonly id: PermianExhibitId;
  readonly assembledPartIds: readonly string[];
  // Null means not displayed; having collected/restored parts alone is not enough.
  readonly displayedOnStandId: string | null;
};
export type PermianRoomProgress = {
  readonly unlockedRoomIds: readonly PermianRoomId[];
  readonly ownedStandIds: readonly string[];
  readonly exhibits: readonly PermianExhibitProgress[];
};
export type PermianRoomStatus = 'initially-available' | 'locked' | 'eligible-for-purchase' | 'unlocked' | 'completed';

export type RoomDependencyIssue = {
  code: 'duplicate-room' | 'unknown-predecessor' | 'predecessor-cycle'
    | 'initial-room-has-predecessor' | 'locked-root' | 'unassigned-exhibit'
    | 'ambiguous-exhibit' | 'successor-exhibit';
  roomId: PermianRoomId;
  dependencyId?: string;
};

// Validates only declared room/predecessor and required-display membership.
// An empty result does NOT establish acquisition/assembly reachability: those
// site, recipe and stand dependencies are not defined by this planning layer.
export function validatePermianRoomDependencies(rooms: readonly PermianRoomDefinition[]): RoomDependencyIssue[] {
  const issues: RoomDependencyIssue[] = [], byId = new Map<PermianRoomId, PermianRoomDefinition>();
  for (const room of rooms) {
    if (byId.has(room.id)) issues.push({ code: 'duplicate-room', roomId: room.id });
    byId.set(room.id, room);
  }
  // Duplicate identities cannot be resolved by choosing one definition.
  if (issues.length) return issues;
  const ancestors = new Map<PermianRoomId, Set<PermianRoomId>>(), cycles = new Set<string>();
  for (const room of rooms) {
    const predecessor = room.predecessorRoomId;
    if (room.initiallyAvailable && predecessor !== null) issues.push({ code: 'initial-room-has-predecessor', roomId: room.id });
    if (!room.initiallyAvailable && predecessor === null) issues.push({ code: 'locked-root', roomId: room.id });
    if (predecessor !== null && !byId.has(predecessor))
      issues.push({ code: 'unknown-predecessor', roomId: room.id, dependencyId: predecessor });
    const path: PermianRoomId[] = [];
    let current: PermianRoomDefinition | undefined = room;
    while (current) {
      const repeated = path.indexOf(current.id);
      if (repeated !== -1) {
        const cycle = path.slice(repeated).sort().join('|');
        if (!cycles.has(cycle)) { cycles.add(cycle); issues.push({ code: 'predecessor-cycle', roomId: current.id }); }
        break;
      }
      path.push(current.id);
      current = current.predecessorRoomId === null ? undefined : byId.get(current.predecessorRoomId);
    }
    ancestors.set(room.id, new Set(path.slice(1)));
  }
  for (const room of rooms) for (const exhibit of room.requiredExhibitIds) {
    const owners = rooms.filter(candidate => candidate.exhibitIds.includes(exhibit));
    if (owners.length !== 1) {
      issues.push({ code: owners.length ? 'ambiguous-exhibit' : 'unassigned-exhibit', roomId: room.id, dependencyId: exhibit });
    } else if (owners[0].id !== room.id && ancestors.get(owners[0].id)?.has(room.id)) {
      // Displaying this required exhibit needs a later room whose purchase
      // eligibility already depends, directly or transitively, on this room.
      issues.push({ code: 'successor-exhibit', roomId: room.id, dependencyId: exhibit });
    }
  }
  return issues;
}

const available = (room: PermianRoomDefinition, progress: PermianRoomProgress) =>
  room.initiallyAvailable || progress.unlockedRoomIds.includes(room.id);

export function isPermianExhibitDisplayed(id: string, progress: PermianRoomProgress, definitions: PermianProgressDefinitions): boolean {
  const exhibit = permianExhibitDefinition(id), room = exhibit && permianRoomForExhibit(exhibit.id);
  if (!room || !available(room, progress)) return false;
  const requirements = definitions.exhibits.filter(item => item.id === id);
  const states = progress.exhibits.filter(item => item.id === id);
  // Ambiguous identities are invalid; never combine duplicate partial records
  // into one completed exhibit or choose an arbitrary conflicting definition.
  if (requirements.length !== 1 || states.length !== 1) return false;
  const parts = requirements[0].requiredPartIds, state = states[0];
  if (!parts.length || parts.some(part => !part.length) || new Set(parts).size !== parts.length
    || !parts.every(part => state.assembledPartIds.includes(part))
    || !state.displayedOnStandId || !progress.ownedStandIds.includes(state.displayedOnStandId)) return false;
  const stands = definitions.stands.filter(stand => stand.id === state.displayedOnStandId);
  return stands.length === 1 && stands[0].exhibitId === id && stands[0].roomId === room.id;
}

// Unknown room is undefined, distinct from a known room with no missing exhibits.
export function missingPermianRoomExhibits(id: string, progress: PermianRoomProgress, definitions: PermianProgressDefinitions): PermianExhibitId[] | undefined {
  const room = permianRoomDefinition(id);
  return room?.requiredExhibitIds.filter(exhibit => !isPermianExhibitDisplayed(exhibit, progress, definitions));
}

export function isPermianFeaturedExhibitDisplayed(id: string, progress: PermianRoomProgress, definitions: PermianProgressDefinitions): boolean {
  const room = permianRoomDefinition(id);
  return !!room && isPermianExhibitDisplayed(room.featuredExhibitId, progress, definitions);
}

export function isPermianRoomComplete(id: string, progress: PermianRoomProgress, definitions: PermianProgressDefinitions): boolean {
  const room = permianRoomDefinition(id);
  return !!room && available(room, progress)
    && missingPermianRoomExhibits(id, progress, definitions)?.length === 0;
}

export function permianRoomStatus(id: string, progress: PermianRoomProgress, definitions: PermianProgressDefinitions): PermianRoomStatus | undefined {
  const room = permianRoomDefinition(id);
  if (!room) return undefined;
  if (isPermianRoomComplete(id, progress, definitions)) return 'completed';
  if (room.initiallyAvailable) return 'initially-available';
  // Supplied ownership is authoritative. This helper neither purchases a room
  // nor revokes it when predecessor completion is absent from the input.
  if (available(room, progress)) return 'unlocked';
  return room.predecessorRoomId && isPermianRoomComplete(room.predecessorRoomId, progress, definitions)
    ? 'eligible-for-purchase' : 'locked';
}
