import type { HelperPlaySave } from './helpers.ts';
import { VISITORS, CASHIER_STATION } from '../content/visitors.ts';
import { displayedExhibits } from './purchases.ts';
import type { PlaySave } from './purchases.ts';
import { createTravelSave } from './world-map.ts';
import type { TravelSave } from './world-map.ts';
import type { Point } from './navigation.ts';

export type Visit = { id: number; paid: number }; // zero means unpaid; otherwise the locked ticket price
export type TicketSave = Omit<TravelSave, 'version'> & { version: 16;
  visitors: { version: 1; nextId: number; sales: [number, number, number]; visits: Visit[] } };
export type VisitorSave = TicketSave | HelperPlaySave;
export const ticketPrice = (save: PlaySave) => {
  const count = displayedExhibits(save).length;
  return count ? VISITORS.basePrice + VISITORS.perDisplay * count : 0;
};
export const arrivalSeconds = (save: PlaySave) => VISITORS.arrivalSeconds[Math.min(2, Math.max(0, displayedExhibits(save).length - 1))];
export const atCashier = (position: Point) => Math.hypot(position.x - CASHIER_STATION.x, position.z - CASHIER_STATION.z) <= CASHIER_STATION.radius;
export const ticketIncome = (sales: readonly number[]) => sales.reduce((sum, count, index) => sum + count * (index + 2), 0);
export function migrateTicketSave(save: TravelSave): TicketSave {
  return { ...save, version: 16, visitors: { version: 1, nextId: 1, sales: [0, 0, 0], visits: [] } };
}
export const createTicketSave = (seed: number) => migrateTicketSave(createTravelSave(seed));
export const canArrive = (save: VisitorSave) => save.room === 'museum' && ticketPrice(save) > 0
  && save.visitors.visits.length < VISITORS.capacity
  && save.visitors.visits.filter(v => !v.paid).length < VISITORS.queueCapacity
  && Number.isSafeInteger(save.visitors.nextId + 1);
export function arriveVisitor<T extends VisitorSave>(save: T): T {
  if (!canArrive(save)) return save;
  return { ...save, visitors: { ...save.visitors, nextId: save.visitors.nextId + 1,
    visits: [...save.visitors.visits, { id: save.visitors.nextId, paid: 0 }] } };
}
export function payVisitor<T extends VisitorSave>(save: T, id: number, position: Point, readyAtDesk: boolean): T {
  const price = ticketPrice(save), first = save.visitors.visits.find(v => !v.paid);
  if (save.room !== 'museum' || !atCashier(position) || !readyAtDesk || !price || first?.id !== id
    || !Number.isSafeInteger(save.economy.coins + price)) return save;
  const sales = [...save.visitors.sales] as [number, number, number]; sales[price - 2]++;
  if (!Number.isSafeInteger(ticketIncome(sales))) return save;
  return { ...save, economy: { ...save.economy, coins: save.economy.coins + price },
    visitors: { ...save.visitors, sales, visits: save.visitors.visits.map(v => v.id === id ? { ...v, paid: price } : v) } };
}
export function finishVisit<T extends VisitorSave>(save: T, id: number): T {
  if (!save.visitors.visits.some(v => v.id === id && v.paid)) return save;
  return { ...save, visitors: { ...save.visitors, visits: save.visitors.visits.filter(v => v.id !== id) } };
}
export function retirePaid<T extends VisitorSave>(save: T): T {
  if (!save.visitors.visits.some(v => v.paid)) return save;
  return { ...save, visitors: { ...save.visitors, visits: save.visitors.visits.filter(v => !v.paid) } };
}
