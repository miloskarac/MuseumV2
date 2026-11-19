import { createRoomSave } from './room-ownership.ts';
import type { RoomSave } from './room-ownership.ts';
import type { PlaySave } from './purchases.ts';
import { creditForInvestment, westWingInvestment } from '../persistence/contracts/expansion-credit-v1.ts';
import type { ExpansionCredit } from '../persistence/contracts/expansion-credit-v1.ts';

export type CreditSave = Omit<RoomSave, 'version'> & { version: 24; expansionCredit: ExpansionCredit };
// Validated schema-23 input only. Credit records investment; it is not income.
export const migrateCreditSave = (save: RoomSave): CreditSave => ({ ...save, version: 24,
  expansionCredit: creditForInvestment(westWingInvestment(save)) });
export const createCreditSave = (seed: number) => migrateCreditSave(createRoomSave(seed));

// Called inside accepted purchase/payment transitions, before any durable write.
// Assign the cumulative total, never add the full investment to existing credit.
// This empty-consumption contract must be extended/versioned before spending.
export function syncExpansionCredit<T extends PlaySave>(save: T): T {
  if (save.version !== 24) return save;
  const recognized = westWingInvestment(save);
  return save.expansionCredit.sources[0].recognized === recognized ? save
    : { ...save, expansionCredit: creditForInvestment(recognized) };
}
