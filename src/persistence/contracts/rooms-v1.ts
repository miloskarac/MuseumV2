// Schema-23 room ownership sub-contract. Freeze initial availability separately
// from future live room content, just as the older save contracts are frozen.
export const ROOM_DEFINITIONS_V1 = Object.freeze(([
  { id: 'permian-room-1', initiallyAvailable: true },
  { id: 'permian-room-2', initiallyAvailable: false },
  { id: 'permian-room-3', initiallyAvailable: false },
] as const).map(room => Object.freeze(room)));
export type OwnedRoomId = typeof ROOM_DEFINITIONS_V1[number]['id'];
export type PurchasedRoomId = Exclude<OwnedRoomId, 'permian-room-1'>;
// Reserved receipt shape only. No nonempty receipt is valid in version 1;
// prices, credit accounting and purchase rules need a versioned extension.
export type RoomPurchaseReceipt = { id: PurchasedRoomId; source: 'purchase'; paid: number };
export type RoomOwnership = { version: 1; owned: RoomPurchaseReceipt[] };
export function validRoomOwnership(value: unknown): value is RoomOwnership {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rooms = value as RoomOwnership;
  return Object.keys(rooms).length === 2 && rooms.version === 1 && Array.isArray(rooms.owned) && rooms.owned.length === 0;
}
