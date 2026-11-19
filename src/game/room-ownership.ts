import { createLedgerSave } from './ticket-ledger.ts';
import type { LedgerSave } from './ticket-ledger.ts';
import { ROOM_DEFINITIONS_V1, validRoomOwnership } from '../persistence/contracts/rooms-v1.ts';
import type { RoomOwnership, OwnedRoomId } from '../persistence/contracts/rooms-v1.ts';

export type RoomSave = Omit<LedgerSave, 'version'> & { version: 23; rooms: RoomOwnership };
// Call only on a validated schema-22 save. No old stand/wing entitlement is a
// new room receipt, and no balance or historical payment is changed here.
export const migrateRoomSave = (save: LedgerSave): RoomSave => ({ ...save, version: 23, rooms: { version: 1, owned: [] } });
export const createRoomSave = (seed: number) => migrateRoomSave(createLedgerSave(seed));

// Pure ownership projection for later progression integration; never consults
// room completion. Invalid/unverified receipts cannot grant availability.
export const ownedPermianRoomIds = (rooms: RoomOwnership): OwnedRoomId[] => validRoomOwnership(rooms)
  ? ROOM_DEFINITIONS_V1.filter(room => room.initiallyAvailable).map(room => room.id) : [];
export const isPermianRoomOwned = (rooms: RoomOwnership, id: string) => ownedPermianRoomIds(rooms).some(owned => owned === id);
