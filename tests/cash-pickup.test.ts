import test from 'node:test';
import assert from 'node:assert/strict';
import { collectNearbyTicketRevenue } from '../src/game/cash.ts';
import { CASHIER_STATION, CASH_PILE } from '../src/content/visitors.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { threeRoom1Displays } from './helpers/walchia-fixture.ts';
import { parseRoom1Game } from '../src/persistence/room1-game-save.ts';
import { createCommitter } from '../src/app/commit.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { isWalkable } from '../src/game/navigation.ts';

function sale(save = threeRoom1Displays()) {
  const next = arriveVisitor(save), id = next.visitors.nextId - 1;
  return finishVisit(payVisitor(next, id, CASHIER_STATION, true), id);
}
const near = { x: CASH_PILE.x, z: CASH_PILE.z + 0.85 };

test('cash proximity: reaching a walkable pickup edge transfers pending cash exactly once', () => {
  const save = sale(), layout = museumLayout(save);
  assert.ok(isWalkable(near, 'museum', layout.obstacles, layout.bounds));
  assert.equal(collectNearbyTicketRevenue(save, CASHIER_STATION), save, 'serving must still leave revenue pending');
  const outside = { x: CASH_PILE.x, z: CASH_PILE.z + CASH_PILE.pickupRadius + 0.01 };
  assert.equal(collectNearbyTicketRevenue(save, outside), save);
  const next = collectNearbyTicketRevenue(save, near);
  assert.deepEqual(next, { ...save, pendingTicketRevenue: 0, economy: { ...save.economy, coins: save.economy.coins + save.pendingTicketRevenue } });
  for (let i = 0; i < 100; i++) assert.equal(collectNearbyTicketRevenue(next, near), next);
  assert.deepEqual(parseRoom1Game(JSON.stringify(next), 42), next);
});

test('cash proximity: rapid crossings collect even when both endpoints are outside; near misses do not', () => {
  const save = sale();
  const from = { x: CASH_PILE.x - 3, z: CASH_PILE.z + 0.85 };
  const to = { x: CASH_PILE.x + 3, z: from.z };
  const next = collectNearbyTicketRevenue(save, to, from);
  assert.equal(next.pendingTicketRevenue, 0);
  assert.equal(collectNearbyTicketRevenue(next, from, to), next);
  assert.equal(collectNearbyTicketRevenue(save, { ...to, z: CASH_PILE.z + 1.2 }, { ...from, z: CASH_PILE.z + 1.2 }), save);
});

test('cash proximity: no collection outside museum or with invalid positions; a later sale is a new pile', () => {
  const save = sale(), away = { ...save, room: 'outdoors' as const };
  assert.equal(collectNearbyTicketRevenue(away, near), away);
  for (const x of [NaN, Infinity, -Infinity]) assert.equal(collectNearbyTicketRevenue(save, { x, z: near.z }), save);
  const once = collectNearbyTicketRevenue(save, near), newPile = sale(once);
  assert.ok(newPile.pendingTicketRevenue > 0);
  const twice = collectNearbyTicketRevenue(newPile, near);
  assert.equal(twice.economy.coins, once.economy.coins + newPile.pendingTicketRevenue);
  assert.deepEqual(twice.visitors, newPile.visitors);
  assert.deepEqual(parseRoom1Game(JSON.stringify(twice), 42), twice);
});

test('cash proximity: failed durable pickup blocks repeated collisions, retry publishes once and reload cannot repay', () => {
  let live = sale(), raw = JSON.stringify(live), fail = true, effects = 0;
  const old = live;
  const commit = createCommitter<typeof live>({ getItem: () => raw, removeItem() {},
    setItem(_key, value) { if (fail) throw Error('quota'); raw = value; } }, () => {});
  commit.enable();
  const publish = (save: typeof live) => { live = save; effects++; };
  assert.equal(commit.commit(collectNearbyTicketRevenue(live, near), publish), 'failed');
  assert.equal(live, old); assert.equal(effects, 0);
  for (let i = 0; i < 100; i++) assert.equal(commit.commit(collectNearbyTicketRevenue(live, near), publish), 'blocked');
  assert.deepEqual(JSON.parse(raw), old);
  fail = false; commit.flush(); commit.flush();
  assert.equal(effects, 1);
  assert.equal(live.economy.coins, old.economy.coins + old.pendingTicketRevenue);
  const loaded = parseRoom1Game(raw, 42)!;
  assert.deepEqual(loaded, live);
  assert.equal(collectNearbyTicketRevenue(loaded, near), loaded);
  commit.dispose();
});
