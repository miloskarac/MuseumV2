import { VISITOR_CAPACITIES } from '../content/visitors.ts';
import { ownedPermianRoomIds } from './room-ownership.ts';
import { validRoomOwnership, ROOM_DEFINITIONS_V1 } from '../persistence/contracts/rooms-v1.ts';
import type { OwnedRoomId } from '../persistence/contracts/rooms-v1.ts';
import type { Visit } from './visitors.ts';

declare const validatedRooms: unique symbol;
// Only an authoritative ownership reader may produce this projection. Future
// tiers are exercised with explicitly synthetic projections in tests, never by
// accepting future room receipts in the current save contract.
export type VisitorOwnedRooms = readonly OwnedRoomId[] & { readonly [validatedRooms]: true };
export type VisitorCapacity = Readonly<{ waiting: number; admitted: number }>;
export function visitorOwnedRooms(value: unknown): VisitorOwnedRooms {
  const ids = validRoomOwnership(value) ? ownedPermianRoomIds(value) : [];
  return Object.freeze(ids) as unknown as VisitorOwnedRooms;
}
export function visitorCapacityForOwnedRooms(owned: VisitorOwnedRooms): VisitorCapacity {
  if (!Array.isArray(owned) || owned.length < 1 || owned.length > 3
    || owned.some((id, i) => id !== ROOM_DEFINITIONS_V1[i].id)) return { waiting: 0, admitted: 0 };
  return VISITOR_CAPACITIES[owned.length as 1 | 2 | 3];
}
export const visitorCounts = (visits: readonly Visit[]) => ({
  waiting: visits.filter(v => v.paid === 0).length,
  // Includes movement toward exhibits, viewing and the complete exit route.
  admitted: visits.filter(v => v.paid > 0).length,
});
export const hasWaitingPlace = (visits: readonly Visit[], capacity: VisitorCapacity) => visitorCounts(visits).waiting < capacity.waiting;
export const hasAdmissionPlace = (visits: readonly Visit[], capacity: VisitorCapacity) => visitorCounts(visits).admitted < capacity.admitted;
