import type { RoomSave } from '../../game/room-ownership.ts';

// Frozen schema-24 rules, independent of future live prices or room content.
export const WEST_WING_CREDIT_MAX = 18;
export type ExpansionCredit = { version: 1; sources: [{
  id: 'west-wing'; recognized: number; remaining: number; consumed: number;
}] };
type InvestmentState = Pick<RoomSave, 'museum' | 'payments'>;

// Input receipts/deposits must already have passed the historical validator.
// A completed receipt replaces a deposit: never add both sources of evidence.
export function westWingInvestment(save: InvestmentState): number {
  const receipt = save.museum.owned.find(item => item.id === 'west-wing');
  return receipt ? receipt.source === 'purchase' ? receipt.paid : 0 : save.payments.partial['west-wing'] ?? 0;
}
export const creditForInvestment = (recognized: number): ExpansionCredit => ({ version: 1,
  sources: [{ id: 'west-wing', recognized, remaining: recognized, consumed: 0 }] });

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const amount = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= WEST_WING_CREDIT_MAX;
export function validExpansionCredit(value: unknown, investment: number): value is ExpansionCredit {
  if (!amount(investment) || !record(value) || Object.keys(value).length !== 2 || value.version !== 1
    || !Array.isArray(value.sources) || value.sources.length !== 1) return false;
  const source = value.sources[0];
  return record(source) && Object.keys(source).length === 4 && source.id === 'west-wing'
    && amount(source.recognized) && amount(source.remaining) && amount(source.consumed)
    && source.recognized === investment && source.remaining === investment && source.consumed === 0;
}
