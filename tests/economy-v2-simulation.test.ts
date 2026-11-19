import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPrice, Visitors, PRICES, simulate, earlyOrders, runResearch, earningWindow } from '../scripts/simulate-economy-v2.mjs';
import { PERMIAN_EXHIBITS, PERMIAN_ROOMS } from '../src/content/permian-museum.ts';

test('simulation ticket rules require complete, owned, placed displays and count unique exhibits once', () => {
  const valid = { id: 'dimetrodon', complete: true, ownedStand: true, displayed: true, ownedRoom: true };
  assert.equal(displayPrice([]), 0); assert.equal(displayPrice([], 1), 0);
  assert.equal(displayPrice([valid]), 4); assert.equal(displayPrice([valid, valid]), 4);
  for (const key of ['complete', 'ownedStand', 'displayed', 'ownedRoom']) assert.equal(displayPrice([{ ...valid, [key]: false }]), 0);
  assert.equal(displayPrice([{ ...valid, id: 'decoration' }]), 0);
  assert.equal(displayPrice(PERMIAN_EXHIBITS.map(e => ({ ...valid, id: e.id }))), 50);
});

test('research keeps supplied 30% prices exact and rounds 25/35% from unrounded compounded bases', () => {
  assert.deepEqual(PRICES[30].large, [12, 16, 20, 26, 34, 45, 58, 75]);
  assert.deepEqual(PRICES[30].small, [8, 10, 14, 18, 23, 30, 39, 50, 65]);
  for (const rate of [25, 35]) for (const [size, base] of [['large', 12], ['small', 8]] as const)
    PRICES[rate][size].forEach((price: number, i: number) => assert.equal(price, Math.round(base * (1 + rate / 100) ** i)));
});

test('visitor model respects queue/cap, attended service and pending collection', () => {
  const v = new Visitors();
  for (let i = 0; i < 6000; i++) v.step(4, 1, false);
  assert.equal(v.queue.length, 3); assert.equal(v.income, 0); assert.equal(v.pending, 0);
  for (let i = 0; i < 19; i++) v.step(4, 1, true);
  assert.equal(v.sold, 0); v.step(4, 1, true); assert.equal(v.sold, 1); assert.equal(v.pending, 4);
  assert.equal(v.collect(), 4); assert.equal(v.collect(), 0);
  v.travel(); assert.equal(v.paid.length, 0); assert.equal(v.queue.length, 2); assert.equal(v.income, 4);
  assert.equal(v.arrival, 0); assert.equal(v.service, 0);
  for (let i = 0; i < 20000; i++) v.step(50, 17, true);
  assert.ok(v.maxPeople <= 6); assert.ok(v.maxQueue <= 3);
});

test('zero displays cannot attract visitors even with attended desk time', () => {
  const v = new Visitors(); for (let i = 0; i < 12000; i++) v.step(0, 0, true);
  assert.equal(v.income, 0); assert.equal(v.queue.length, 0);
});

test('global stand sequences and room order preserve planned membership and all spending', () => {
  const r = simulate(); assert.deepEqual(r.spending, { stand: 543, site: 365, room: 330, optional: 0 });
  assert.deepEqual(r.rooms.map((room: {price: number}) => room.price), [12, 30, 50]);
  let start = 0;
  for (const room of PERMIAN_ROOMS) {
    assert.deepEqual(r.displayEvents.slice(start, start + room.exhibitIds.length).map((e: {id: string}) => e.id).sort(), [...room.exhibitIds].sort());
    start += room.exhibitIds.length;
  }
  for (const t of r.transactions.filter((t: { kind: string }) => t.kind === 'room')) {
    assert.equal(t.price, t.id === 'room-2' ? 12 : 30);
  }
});

test('all research scenarios conserve money without credit, refunds or negative balances', () => {
  const r = runResearch();
  const rows = [...r.matrix, ...r.visitorSensitivity, ...r.siteSensitivity, ...r.timingSensitivity, ...r.otherSensitivity];
  assert.equal(rows.length, 82);
  for (const row of rows) {
    assert.equal(row.coins + row.pending + Object.values(row.spending).reduce((sum: number, n) => sum + Number(n), 0), 20 + row.soil + row.income);
    assert.ok(row.transactions.every((t: { after: number }) => t.after >= 0));
    assert.equal(row.rooms.length, 3); assert.equal(row.displayEvents.length, 17);
  }
  assert.deepEqual(simulate({ soilSeed: 42 }), simulate({ soilSeed: 42 }));
});

test('early-order enumeration exposes unrestricted traps and verifies a restricted viable bootstrap', () => {
  const r = earlyOrders(); assert.equal(r.terminalOrders, 10); assert.equal(r.deadOrders.length, 2);
  assert.ok(r.strandedEvenAllFree > 0); assert.equal(r.example.paid.reduce((a: number, b: number) => a + b, 0), 20);
  const safe = earlyOrders({ available: ['dimetrodon', 'trilobite'] });
  assert.equal(safe.deadOrders.length, 0); assert.equal(safe.strandedFreePair, 0);
  assert.equal(safe.contributionStates, 117);
});

test('rate windows use total active play time and do not sell during away activities', () => {
  const distracted = earningWindow('distracted', [17, 50]);
  assert.equal(distracted.income, distracted.tickets * 50);
  assert.ok(distracted.tickets < distracted.minutes, 'not continuous cashier sales');
  assert.equal(distracted.collected + distracted.pending, distracted.income);
});
