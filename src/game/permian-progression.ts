import { PERMIAN_EXHIBIT_ORDER, PERMIAN_STAND_PLANS, PERMIAN_SITE_PLANS } from '../content/permian-progression.ts';
import type { PermianSiteId, PermianStandPlan } from '../content/permian-progression.ts';
import { permianRoomDefinition } from '../content/permian-museum.ts';
import type { PermianExhibitId, PermianRoomId } from '../content/permian-museum.ts';
import { isPermianExhibitDisplayed, isPermianRoomComplete } from './permian-rooms.ts';
import type { PermianRoomProgress, PermianProgressDefinitions } from './permian-rooms.ts';

// Projections of already validated ownership, NOT receipts, save fields or commands.
export type PermianProgressionState = Omit<PermianRoomProgress, 'unlockedRoomIds'> & {
  readonly ownedRoomIds: readonly PermianRoomId[];
  readonly purchasedSiteIds: readonly PermianSiteId[];
};
export type PermianPlannedStatus = 'locked' | 'eligible-for-purchase' | 'available' | 'completed';

function roomOwned(id: PermianRoomId, state: PermianProgressionState): boolean {
  let room = permianRoomDefinition(id);
  if (!room) return false;
  // Ownership includes its predecessor rooms, but need not retain their current
  // displays. Missing ancestor entitlements are contradictory input.
  while (room) {
    if (!state.ownedRoomIds.includes(room.id)) return false;
    room = room.predecessorRoomId ? permianRoomDefinition(room.predecessorRoomId) : undefined;
  }
  return true;
}
function standDefinitionValid(stand: PermianStandPlan, definitions: PermianProgressDefinitions): boolean {
  const matches = definitions.stands.filter(s => s.id === stand.id);
  return matches.length === 1 && matches[0].exhibitId === stand.exhibitId && matches[0].roomId === stand.roomId;
}
function ownedStand(stand: PermianStandPlan, state: PermianProgressionState, definitions: PermianProgressDefinitions): boolean {
  return roomOwned(stand.roomId, state) && state.ownedStandIds.includes(stand.id) && standDefinitionValid(stand, definitions);
}
function roomProgress(state: PermianProgressionState, definitions: PermianProgressDefinitions): PermianRoomProgress {
  return { unlockedRoomIds: state.ownedRoomIds.filter(id => roomOwned(id, state)), exhibits: state.exhibits.filter(exhibit => {
    const site = PERMIAN_SITE_PLANS.find(s => s.exhibitIds.includes(exhibit.id));
    return site && roomOwned(site.roomId, state) && (site.initiallyAvailable || state.purchasedSiteIds.includes(site.id));
  }),
    ownedStandIds: PERMIAN_STAND_PLANS.filter(s => ownedStand(s, state, definitions)).map(s => s.id) };
}
function displayed(id: PermianExhibitId, state: PermianProgressionState, definitions: PermianProgressDefinitions): boolean {
  return isPermianExhibitDisplayed(id, roomProgress(state, definitions), definitions);
}
function previousDisplaysPresent(id: PermianExhibitId, state: PermianProgressionState, definitions: PermianProgressDefinitions): boolean {
  const index = PERMIAN_EXHIBIT_ORDER.indexOf(id);
  return index >= 0 && PERMIAN_EXHIBIT_ORDER.slice(0, index).every(previous => displayed(previous, state, definitions));
}

// Returns the earliest missing VALID display, even when its room/stand is locked.
// Later findings or supplied future ownership never skip an earlier gap.
export function nextPermianExhibit(state: PermianProgressionState, definitions: PermianProgressDefinitions): PermianExhibitId | undefined {
  return PERMIAN_EXHIBIT_ORDER.find(id => !displayed(id, state, definitions));
}
export function eligiblePermianStand(state: PermianProgressionState, definitions: PermianProgressDefinitions): PermianStandPlan | undefined {
  const next = nextPermianExhibit(state, definitions), stand = PERMIAN_STAND_PLANS.find(s => s.exhibitId === next);
  if (!stand || !roomOwned(stand.roomId, state) || state.ownedStandIds.includes(stand.id) || !standDefinitionValid(stand, definitions)) return undefined;
  // Do not offer content whose authoritative recipe is absent/ambiguous. This is
  // a definition check, not a second display predicate or a synthetic live recipe.
  const recipes = definitions.exhibits.filter(e => e.id === next);
  if (recipes.length !== 1 || !recipes[0].requiredPartIds.length || recipes[0].requiredPartIds.some(id => !id.length)
    || new Set(recipes[0].requiredPartIds).size !== recipes[0].requiredPartIds.length) return undefined;
  return { ...stand, requiredDisplayIds: [...stand.requiredDisplayIds] };
}
export function permianStandStatus(id: string, state: PermianProgressionState, definitions: PermianProgressDefinitions): PermianPlannedStatus | undefined {
  const stand = PERMIAN_STAND_PLANS.find(s => s.id === id);
  if (!stand) return undefined;
  if (ownedStand(stand, state, definitions)) return displayed(stand.exhibitId, state, definitions) ? 'completed' : 'available';
  return eligiblePermianStand(state, definitions)?.id === id ? 'eligible-for-purchase' : 'locked';
}
export function permianSiteStatus(id: string, state: PermianProgressionState, definitions: PermianProgressDefinitions): Exclude<PermianPlannedStatus, 'completed'> | undefined {
  const site = PERMIAN_SITE_PLANS.find(s => s.id === id);
  if (!site) return undefined;
  if (!roomOwned(site.roomId, state)) return 'locked';
  // Already validated ownership is retained even if a predecessor display is
  // subsequently missing. Neither a display nor eligibility creates this receipt.
  if (site.initiallyAvailable || state.purchasedSiteIds.includes(site.id)) return 'available';
  const trigger = PERMIAN_STAND_PLANS.find(s => s.id === site.triggerStandId)!;
  return ownedStand(trigger, state, definitions) && previousDisplaysPresent(trigger.exhibitId, state, definitions)
    ? 'eligible-for-purchase' : 'locked';
}
export function permianProgressionRoomStatus(id: string, state: PermianProgressionState, definitions: PermianProgressDefinitions): PermianPlannedStatus | undefined {
  const room = permianRoomDefinition(id);
  if (!room) return undefined;
  const progress = roomProgress(state, definitions);
  if (roomOwned(room.id, state)) return isPermianRoomComplete(id, progress, definitions) ? 'completed' : 'available';
  // A missing initial room is inconsistent input, not a new purchase opportunity.
  return !room.initiallyAvailable && room.predecessorRoomId && roomOwned(room.predecessorRoomId, state)
    && isPermianRoomComplete(room.predecessorRoomId, progress, definitions) ? 'eligible-for-purchase' : 'locked';
}
