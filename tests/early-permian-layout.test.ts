import test from 'node:test';
import assert from 'node:assert/strict';
import { EARLY_PERMIAN_FLOOR, EARLY_PERMIAN_STANDS, FUTURE_ROOM_DOOR } from '../src/content/early-permian-layout.ts';
import { PERMIAN_ROOMS } from '../src/content/permian-museum.ts';
import { EXHIBITS, ROOM1_EXHIBITS } from '../src/content/exhibit.ts';
import { PURCHASES } from '../src/content/purchases.ts';
import { CASHIER_STATION, VISITOR_DOOR, queuePoint } from '../src/content/visitors.ts';
import { museumLayout, safeMuseumPosition } from '../src/game/museum-layout.ts';
import { footprint, isWalkable, ARRIVAL, START, PORTAL, EXHIBIT_SPOTS } from '../src/game/navigation.ts';
import { visitorPath, visitorWalkable, viewingPositions } from '../src/game/visitor-simulation.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import type { CreditSave } from '../src/game/expansion-credit.ts';
import { buyPurchase, purchaseStatus, displayedExhibits, standAvailable } from '../src/game/purchases.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { parseRoomSave } from '../src/persistence/room-save.ts';
import { buyUpgrade } from '../src/game/upgrades.ts';
import { room1Display, room1Earn, room1Recovered } from './helpers/room1-fixture.ts';
import { createCommitter } from '../src/app/commit.ts';

const roundTrip = (s: CreditSave) => { assert.deepEqual(parseCreditSave(JSON.stringify(s), 42), s); return s; };
test('four unique Room 1 footprints match the approved room membership and active anchors', () => {
  assert.deepEqual(EARLY_PERMIAN_STANDS.map(s => [s.id, s.size]), [
    ['dimetrodon', 'large'], ['trilobite', 'small'], ['eryops', 'large'], ['walchia', 'small']]);
  assert.deepEqual(new Set(EARLY_PERMIAN_STANDS.map(s => s.id)), new Set(PERMIAN_ROOMS[0].exhibitIds));
  assert.equal(new Set(EARLY_PERMIAN_STANDS.map(s => `${s.x},${s.z}`)).size, 4);
  assert.deepEqual(EARLY_PERMIAN_STANDS.filter(s => s.active).map(s => s.id).sort(), ROOM1_EXHIBITS.map(e => e.id).sort());
  assert.deepEqual(EXHIBIT_SPOTS.map(s => s.id), ['dimetrodon', 'trilobite', 'eryops', 'walchia']);
});
test('all four stands lie within Room 1 with at least 1.35 units of separation', () => {
  const room = footprint(EARLY_PERMIAN_FLOOR);
  for (const a of EARLY_PERMIAN_STANDS) {
    const rect = footprint(a);
    assert.ok(rect.minX > room.minX && rect.maxX < room.maxX && rect.minZ > room.minZ && rect.maxZ < room.maxZ, a.id);
    for (const b of EARLY_PERMIAN_STANDS.filter(b => b !== a)) {
      const other = footprint(b), dx = Math.max(0, rect.minX - other.maxX, other.minX - rect.maxX);
      const dz = Math.max(0, rect.minZ - other.maxZ, other.minZ - rect.maxZ);
      assert.ok(Math.hypot(dx, dz) >= 1.35 - 1e-9, `${a.id}/${b.id}`);
    }
  }
  assert.equal(isWalkable({ x: FUTURE_ROOM_DOOR.x, z: 6.1 }, 'museum', museumLayout().obstacles), false);
});

for (let mask = 0; mask < 8; mask++) {
  const s = createCreditSave(42);
  // Geometry-only combinations; financial validity is tested with real commands below.
  s.museum.owned = PURCHASES.filter(p => p.kind === 'stand').filter((_, i) => mask & 1 << i)
    .map(p => ({ id: p.id, source: 'purchase', paid: p.cost }));
  const layout = museumLayout(s);
  test(`Room 1 player routes reach every active interaction, entrance and cashier: ownership ${mask}`, () => {
    const walkable = (p: { x: number; z: number }) => isWalkable(p, 'museum', layout.obstacles, layout.bounds);
    const queue = [{ x: 5.5, z: 1.5 }], visited = new Set(['5.5,1.5']);
    for (let i = 0; i < queue.length; i++) for (const [dx, dz] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) {
      const p = { x: queue[i].x + dx, z: queue[i].z + dz }, key = `${p.x},${p.z}`;
      if (walkable(p) && !visited.has(key)) { visited.add(key); queue.push(p); }
    }
    for (const p of [...layout.spots, ...layout.purchases, START, ARRIVAL, PORTAL, CASHIER_STATION, VISITOR_DOOR]) {
      assert.ok(walkable(p)); assert.ok(queue.some(n => Math.hypot(n.x - p.x, n.z - p.z) < 0.2));
    }
    assert.equal(layout.purchases.some(p => p.id === 'west-wing'), false);
    assert.equal(isWalkable(layout.reserved, 'museum', layout.obstacles, layout.bounds), false);
    assert.deepEqual(museumLayout({ ...s, museum: { version: 1, owned: [...s.museum.owned,
      { id: 'west-wing', source: 'purchase', paid: 18 }] } }).bounds, layout.bounds);
  });
  test(`Room 1 visitor queue, all viewing candidates and exits are reachable: ownership ${mask}`, () => {
    const targets = [queuePoint(0), queuePoint(1), queuePoint(2)];
    for (const spot of layout.spots) {
      for (const random of [() => 0, () => 0.5, () => 0.999]) {
        const candidates = viewingPositions(spot.id, layout, random);
        assert.ok(candidates.length >= 3, spot.id); targets.push(...candidates);
      }
    }
    for (const p of targets) {
      assert.ok(visitorWalkable(p, layout));
      assert.ok(visitorPath(VISITOR_DOOR, p, layout).length, JSON.stringify(p));
      assert.ok(visitorPath(p, VISITOR_DOOR, layout).length);
    }
  });
}

test('Eryops purchase and every partial payment round-trip without west-wing ownership', () => {
  let save = createCreditSave(42);
  assert.equal(purchaseStatus(save, 'stand-eryops'), 'ready');
  const p = museumLayout(save).purchases.find(p => p.id === 'stand-eryops')!;
  for (let i = 1; i <= 12; i++) {
    save = roundTrip(contributePurchase(save, 'stand-eryops', p));
    assert.equal(save.economy.coins, 20 - i);
    assert.equal(standAvailable(save, 'eryops'), i === 12);
  }
  assert.equal(save.version, 24); assert.equal(save.museum.owned.length, 1);
  assert.equal(buyPurchase(save, 'stand-eryops'), save); assert.equal(contributePurchase(save, 'stand-eryops', p), save);
  assert.equal(save.expansionCredit.sources[0].recognized, 0);
  const { expansionCredit: _credit, ...old } = save;
  assert.equal(parseRoomSave(JSON.stringify({ ...old, version: 23 }), 42), null, 'historical reader remains frozen');
});
test('Eryops assembly, tickets, helpers and upgrades reload with no wing; all three displays remain active', () => {
  let save = roundTrip(room1Recovered());
  save = roundTrip(room1Display(buyPurchase(save, 'stand-eryops'), 'eryops'));
  assert.deepEqual(displayedExhibits(save), ['trilobite', 'eryops']);
  save = roundTrip(room1Earn(save, 1));
  assert.equal(save.visitors.sales.counts['3'], 1);
  // Restore a paid, idle helper with two displays, one of which is Eryops.
  // Hiring after both pits close is intentionally unavailable in live play.
  save = roundTrip({ ...save, economy: { ...save.economy, coins: save.economy.coins - 60 },
    helpers: { ...save.helpers, owned: [{ id: 'helper-1', paid: 60, siteId: null, phase: 'idle', task: null }] } });
  save = roundTrip(buyUpgrade(save, 'boots')); assert.equal(save.upgrades.owned.length, 1);
  save = roundTrip(room1Display(buyPurchase(save, 'stand-dimetrodon'), 'dimetrodon'));
  save = roundTrip(room1Earn(save, 1));
  assert.equal(save.visitors.sales.counts['4'], 1);
  assert.deepEqual(displayedExhibits(save), ['dimetrodon', 'trilobite', 'eryops']);
  assert.equal(save.museum.owned.some(o => o.id === 'west-wing'), false);
  assert.equal(museumLayout(save).assembled.length, 2);
});
test('schema 24 retains a reserved Walchia stand without new entitlement', () => {
  const save = createCreditSave(42);
  assert.equal(purchaseStatus(save, 'stand-walchia'), 'unknown'); assert.equal(buyPurchase(save, 'stand-walchia'), save);
  assert.equal(EXHIBITS.some(e => String(e.id) === 'walchia'), false);
  assert.equal(PURCHASES.some(p => String(p.id) === 'stand-walchia'), true);
  assert.equal(museumLayout(save).purchases.some(p => String(p.id) === 'stand-walchia'), false);
  for (const source of ['purchase', 'legacy']) assert.equal(parseCreditSave(JSON.stringify({ ...save,
    museum: { version: 1, owned: [{ id: 'stand-walchia', source, paid: 0 }] } }), 42), null);
});
test('Room 1 reader still rejects forged ownership, money, placement, deposits and future rooms', () => {
  const save = roundTrip(buyPurchase(createCreditSave(42), 'stand-eryops'));
  for (const candidate of [
    { ...save, economy: { ...save.economy, coins: 9 } },
    { ...save, museum: { version: 1, owned: [...save.museum.owned, ...save.museum.owned] } },
    { ...save, museum: { version: 1, owned: [{ id: 'stand-eryops', source: 'purchase', paid: 0 }] } },
    { ...save, placed: ['eryops-skull'] },
    { ...save, payments: { version: 1, partial: { 'stand-eryops': 1 } } },
    { ...save, rooms: { version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 0 }] } },
    { ...save, payments: { version: 1, partial: { 'stand-walchia': 1 } } },
  ]) assert.equal(parseCreditSave(JSON.stringify(candidate), 42), null);
});
test('Eryops failure, retry, collision relocation and reset do not duplicate ownership or charges', () => {
  let save = createCreditSave(42), raw = JSON.stringify(save), fail = true, applied = 0;
  const port = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fail) throw Error('quota'); raw = value; }, removeItem: () => { raw = ''; } };
  const commit = createCommitter<CreditSave>(port, () => {}); commit.enable();
  const candidate = buyPurchase(save, 'stand-eryops');
  assert.equal(commit.commit(candidate, next => { save = next; applied++; }), 'failed');
  assert.equal(save.economy.coins, 20); assert.equal(standAvailable(save, 'eryops'), false);
  fail = false; commit.flush(); commit.flush(); assert.equal(applied, 1); roundTrip(save);
  const layout = museumLayout(save), stand = EARLY_PERMIAN_STANDS[2];
  assert.ok(isWalkable(safeMuseumPosition(stand, layout), 'museum', layout.obstacles, layout.bounds));
  assert.ok(commit.reset()); commit.commit(createCreditSave(42), next => { save = next; });
  roundTrip(save); assert.deepEqual(save.museum.owned, []); assert.equal(save.economy.coins, 20); commit.dispose();
});

