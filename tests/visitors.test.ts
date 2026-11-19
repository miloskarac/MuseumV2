import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTicketSave, migrateTicketSave, ticketPrice, ticketIncome, arriveVisitor, payVisitor, finishVisit, retirePaid, canArrive } from '../src/game/visitors.ts';
import type { TicketSave } from '../src/game/visitors.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITE, SITES, ERYOPS_SITE } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { advanceMuseum, museumJourney, buyPurchase, placeOwnedGroup, migrateMuseumSave } from '../src/game/purchases.ts';
import { migrateTravelSave, buySite, travelTo } from '../src/game/world-map.ts';
import { parseTicketSave, loadTicketSave } from '../src/persistence/ticket-save.ts';
import { parseTravelSave } from '../src/persistence/travel-save.ts';
import { CASHIER, CASHIER_STATION, VISITOR_DOOR, queuePoint } from '../src/content/visitors.ts';
import { ARRIVAL, isWalkable } from '../src/game/navigation.ts';
import { createVisitorSimulation, visitorPath, visitorWalkable, viewingPositions } from '../src/game/visitor-simulation.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { createCommitter } from '../src/app/commit.ts';

const reload = (save: TicketSave) => { assert.deepEqual(parseTicketSave(JSON.stringify(save), 99), save); return save; };
function legacy(displays = 1) {
  const journey = { ...freshJourney(), dig: Object.fromEntries(SITES.flatMap(s => s.cells.map(c => [c.id, 1]))),
    collected: SITES.flatMap(s => [...s.requiredDiscoveryIds]), closedSites: SITES.map(s => s.id),
    placed: EXHIBITS.slice(0, displays).flatMap(e => [...e.parts]) };
  return reload(migrateTicketSave(migrateTravelSave(migrateMuseumSave(createGameSave(journey, 42)))));
}
function sale(save: TicketSave) {
  const arrived = arriveVisitor(save), id = arrived.visitors.nextId - 1;
  return finishVisit(payVisitor(arrived, id, CASHIER_STATION, true), id);
}
test('ticket price derives from unique complete owned displays, never partial parts or replay', () => {
  const fresh = createTicketSave(42); assert.equal(ticketPrice(fresh), 0); assert.equal(arriveVisitor(fresh), fresh);
  const all = legacy(0); assert.equal(ticketPrice(all), 0);
  assert.equal(ticketPrice({ ...all, placed: ['skull'] }), 0);
  for (let n = 1; n <= 3; n++) {
    const save = legacy(n); assert.equal(ticketPrice(save), n + 1); reload(save);
    assert.equal(ticketPrice(advanceMuseum(save, museumJourney(save))), n + 1);
  }
});
test('arrival and payment are bounded, ordered, attended and exactly once', () => {
  let save = legacy(); const initial = save.economy.coins;
  for (let i = 0; i < 3; i++) save = reload(arriveVisitor(save));
  assert.equal(arriveVisitor(save), save);
  const first = save.visitors.visits[0].id;
  assert.equal(payVisitor(save, first + 1, CASHIER_STATION, true), save);
  assert.equal(payVisitor(save, first, { x: 0, z: 0 }, true), save);
  assert.equal(payVisitor(save, first, CASHIER_STATION, false), save);
  save = reload(payVisitor(save, first, CASHIER_STATION, true));
  assert.equal(save.economy.coins, initial + 2); assert.deepEqual(save.visitors.sales, [1, 0, 0]);
  assert.equal(payVisitor(save, first, CASHIER_STATION, true), save);
  while (save.visitors.visits.length < 6) {
    save = arriveVisitor(save);
    const unpaid = save.visitors.visits.find(v => !v.paid)!;
    save = reload(payVisitor(save, unpaid.id, CASHIER_STATION, true));
  }
  assert.equal(canArrive(save), false); assert.equal(arriveVisitor(save), save);
  const paid = save.visitors.visits.find(v => v.paid)!;
  save = reload(finishVisit(save, paid.id)); assert.equal(finishVisit(save, paid.id), save);
  save = reload(arriveVisitor(save)); assert.ok(save.visitors.visits.at(-1)!.id > paid.id);
});
test('price locks at payment; later displays do not reprice or re-credit paid visits', () => {
  let save = arriveVisitor(legacy(1)); save = payVisitor(save, 1, CASHIER_STATION, true);
  save = reload(advanceMuseum(save, { ...museumJourney(save), placed: legacy(2).placed }) as TicketSave);
  assert.equal(ticketPrice(save), 3); assert.equal(save.visitors.visits[0].paid, 2);
  save = reload(arriveVisitor(save)); save = reload(payVisitor(save, 2, CASHIER_STATION, true));
  assert.deepEqual(save.visitors.sales, [1, 1, 0]); assert.equal(save.economy.coins, 25);
});
test('reload and travel retain the unpaid queue and retire paid tours without income', () => {
  let save = arriveVisitor(arriveVisitor(legacy())); save = reload(payVisitor(save, 1, CASHIER_STATION, true));
  const raw = JSON.stringify(save), port = { getItem: () => raw, setItem() {}, removeItem() {} };
  const loaded = loadTicketSave(port, 55); assert.equal(loaded.kind, 'ready');
  if (loaded.kind !== 'ready') return;
  assert.equal(loaded.save.economy.coins, save.economy.coins); assert.deepEqual(loaded.save.visitors.visits, [{ id: 2, paid: 0 }]);
  assert.deepEqual(retirePaid(loaded.save), loaded.save); reload(loaded.save);
  const camp = reload(travelTo(save, { kind: 'site-camp', siteId: SITE.id }));
  assert.deepEqual(camp.visitors, loaded.save.visitors);
  assert.equal(arriveVisitor(camp), camp); assert.equal(payVisitor(camp, 2, CASHIER_STATION, true), camp);
  reload(travelTo(camp, { kind: 'hub' }));
});
test('schemas 1–15 migrate without income or loss; schema 16 is rejected by older readers', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = []; if (version >= 8) old.activeSiteId = SITE.id;
    const save = parseTicketSave(JSON.stringify(old), 42)!; assert.ok(save); reload(save);
    assert.deepEqual(save.visitors.sales, [0, 0, 0]); assert.equal(save.economy.coins, 20); assert.equal(save.museum.owned.length, 4);
  }
  const game = createGameSave(freshJourney(), 42), museum = migrateMuseumSave(game), travel = migrateTravelSave(museum);
  for (const old of [game, museum, travel]) {
    const save = parseTicketSave(JSON.stringify(old), 4)!; reload(save); assert.deepEqual(save.economy, old.economy);
  }
  assert.equal(parseTravelSave(JSON.stringify(legacy()), 42), null);
});
test('invalid visit counts, IDs, receipts, arithmetic and future saves remain protected', () => {
  const save = sale(legacy()), v = save.visitors;
  const invalid = [
    { ...save, version: 17 }, { ...save, visitors: null }, { ...save, visitors: { ...v, extra: 1 } },
    { ...save, visitors: { ...v, sales: [1, 0] } }, { ...save, visitors: { ...v, sales: [0.5, 0, 0] } },
    { ...save, visitors: { ...v, sales: [Number.MAX_SAFE_INTEGER, 0, 0] } },
    { ...save, visitors: { ...v, visits: [{ id: 1, paid: 2 }, { id: 1, paid: 2 }] } },
    { ...save, visitors: { ...v, visits: [{ id: 2, paid: 0 }] } },
    { ...save, visitors: { ...v, visits: [{ id: 1, paid: 3 }] } },
    { ...save, visitors: { ...v, nextId: 5, visits: [1, 2, 3, 4].map(id => ({ id, paid: 0 })) } },
    { ...save, economy: { ...save.economy, coins: 21 } }, { ...save, placed: [] },
  ];
  for (const value of invalid) assert.equal(parseTicketSave(JSON.stringify(value), 42), null);
  const raw = JSON.stringify({ ...save, version: 17 });
  assert.deepEqual(loadTicketSave({ getItem: () => raw, setItem() { assert.fail(); }, removeItem() { assert.fail(); } }, 42), { kind: 'invalid' });
});
test('failed payment freezes one candidate; retry credits once and reset discards pending income', () => {
  let live = arriveVisitor(legacy()), raw = '', fail = false, effects = 0;
  const port = { getItem: () => raw, setItem(_key: string, value: string) { if (fail) throw Error('quota'); raw = value; }, removeItem() { raw = ''; } };
  const commit = createCommitter<TicketSave>(port, () => {}); commit.enable(); commit.commit(live, s => { live = s; });
  const before = raw; fail = true; commit.commit(payVisitor(live, 1, CASHIER_STATION, true), s => { live = s; effects++; });
  assert.equal(live.economy.coins, 20); assert.equal(raw, before); assert.equal(commit.canMutate(), false);
  fail = false; commit.flush(); commit.flush(); assert.equal(live.economy.coins, 22); assert.equal(effects, 1); reload(live);
  live = arriveVisitor(live); fail = true; commit.commit(payVisitor(live, 2, CASHIER_STATION, true), s => { live = s; effects++; });
  commit.reset(); fail = false; commit.commit(createTicketSave(7), s => { live = s; }); commit.flush();
  assert.equal(effects, 1); assert.equal(live.economy.coins, 20); assert.deepEqual(live.visitors.visits, []); commit.dispose();
});
test('zero soil income permits both first stand orders and every remaining purchase through ticket sales', () => {
  for (const first of ['stand-dimetrodon', 'stand-trilobite']) for (const wingFirst of [true, false]) {
    // A validated zero-soil-income checkpoint: all prior first-site soil is excluded.
    const journey = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] };
    const base = createTicketSave(42), economic = createGameSave(journey, 42);
    let save = reload({ ...base, ...journey, version: 16, economy: economic.economy });
    for (const id of [first, first === 'stand-dimetrodon' ? 'stand-trilobite' : 'stand-dimetrodon']) save = reload(buyPurchase(save, id));
    assert.equal(save.economy.coins, 0);
    for (const exhibit of EXHIBITS.filter(e => e.id !== 'eryops')) for (const part of exhibit.parts)
      save = reload(advanceMuseum(save, placeOwnedGroup(save, exhibit.id, part, part)) as TicketSave);
    assert.equal(ticketPrice(save), 3);
    for (const id of wingFirst ? ['west-wing', 'site', 'stand-eryops'] : ['site', 'west-wing', 'stand-eryops']) {
      const cost = id === 'site' ? 24 : id === 'west-wing' ? 18 : 12;
      while (save.economy.coins < cost) save = reload(sale(save));
      const coins = save.economy.coins;
      save = reload(id === 'site' ? buySite(save, ERYOPS_SITE.id) : buyPurchase(save, id));
      assert.equal(save.economy.coins, coins - cost);
    }
    assert.equal(ticketIncome(save.visitors.sales), 54); assert.equal(save.economy.coins, 0);
    assert.equal(Object.values(save.economy.sites).flatMap(s => s.claimed).length, 0);
  }
});
test('visitor routes remain clear of furniture and interaction circles in compact and expanded halls', () => {
  for (const save of [createTicketSave(1), buyPurchase(createTicketSave(1), 'stand-dimetrodon'), legacy(3)]) {
    const layout = museumLayout(save);
    const targets = [queuePoint(0), queuePoint(1), queuePoint(2), ...layout.spots.flatMap(e => viewingPositions(e.id, layout, () => 0.5))];
    for (const target of targets) {
      const path = visitorPath(VISITOR_DOOR, target, layout); assert.ok(path.length, JSON.stringify(target));
      let previous = VISITOR_DOOR;
      for (const next of path) {
        for (let t = 0; t <= 1; t += 0.02) assert.ok(visitorWalkable({ x: previous.x + (next.x - previous.x) * t, z: previous.z + (next.z - previous.z) * t }, layout));
        previous = next;
      }
    }
  }
});

test('the entrance queue faces the cashier across from the reachable player station', () => {
  for (const save of [createTicketSave(1), legacy(3)]) {
    const layout = museumLayout(save);
    assert.ok(isWalkable(CASHIER_STATION, 'museum', layout.obstacles, layout.bounds));
    for (let t = 0; t <= 1; t += 0.02) {
      assert.ok(isWalkable({ x: ARRIVAL.x + (CASHIER_STATION.x - ARRIVAL.x) * t,
        z: ARRIVAL.z + (CASHIER_STATION.z - ARRIVAL.z) * t }, 'museum', layout.obstacles, layout.bounds));
    }
    assert.equal(visitorWalkable(CASHIER_STATION, layout), false, 'visitors leave space for Luka');
    assert.ok(VISITOR_DOOR.z < queuePoint(2).z);
    for (let i = 0; i < 3; i++) {
      const point = queuePoint(i);
      assert.ok(point.z < CASHIER.z && CASHIER_STATION.z > CASHIER.z);
      assert.equal(payVisitor(arriveVisitor(legacy()), 1, point, true).economy.coins, 20, 'waiting side cannot sell');
      assert.ok(visitorPath(point, VISITOR_DOOR, layout).length, 'return path to the entrance');
    }
  }
  const save = arriveVisitor(arriveVisitor(arriveVisitor(legacy()))), simulation = createVisitorSimulation();
  simulation.reset(save); simulation.step(save, ARRIVAL, 0.05);
  simulation.poses().forEach(pose => { assert.equal(pose.moving, false); assert.ok(pose.direction.z > 0); });
});
test('simulation has no waiting backlog, honors service time, finishes tours and bounds long frames', () => {
  let save = legacy(3); const sim = createVisitorSimulation(); sim.reset(save);
  for (let i = 0; i < 159; i++) save = sim.step(save, CASHIER_STATION, 0.05);
  assert.equal(save.visitors.nextId, 1); save = reload(sim.step(save, CASHIER_STATION, 0.05)); assert.equal(save.visitors.nextId, 2);
  const coins = save.economy.coins;
  for (let i = 0; i < 10; i++) save = sim.step(save, CASHIER_STATION, 0.05);
  assert.equal(save.economy.coins, coins, 'cannot pay before the visitor reaches the desk');
  for (let i = 0; i < 3000; i++) {
    const next = sim.step(save, CASHIER_STATION, 0.05); if (next !== save) save = reload(next);
    assert.ok(save.visitors.visits.length <= 6);
  }
  assert.ok(save.visitors.sales[2] >= 8); assert.ok(!save.visitors.visits.some(v => v.id === 1), 'first tour leaves');
  const away = createVisitorSimulation(); save = legacy(); away.reset(save);
  for (let i = 0; i < 2000; i++) save = away.step(save, { x: 0, z: 0 }, 0.05);
  assert.equal(save.visitors.visits.length, 3); assert.equal(save.economy.coins, 20);
  const full = save; for (let i = 0; i < 100; i++) save = away.step(save, { x: 0, z: 0 }, 10000);
  assert.equal(save, full);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(away.step(save, CASHIER_STATION, dt), save);
});

test('building a stand during a tour moves an overlapped visitor to a safe route and the visit still finishes', () => {
  const journey = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] };
  let save = { ...createTicketSave(42), ...journey, version: 16 as const, economy: createGameSave(journey, 42).economy };
  save = buyPurchase(save, 'stand-trilobite');
  save = advanceMuseum(save, placeOwnedGroup(save, 'trilobite', 'trilobite-whole', 'trilobite-whole')) as TicketSave;
  save = payVisitor(arriveVisitor(save), 1, CASHIER_STATION, true);
  const sim = createVisitorSimulation(() => 0); sim.reset(save); let built = false;
  for (let i = 0; i < 2000 && save.visitors.visits.some(v => v.id === 1); i++) {
    save = sim.step(save, { x: 0, z: -5 }, 0.05);
    const actor = sim.poses().find(p => p.id === 1);
    if (!built && actor && actor.x < 2.5 && actor.x > -4.8 && actor.z > -1.55 && actor.z < 2.55) {
      save = reload(buyPurchase(save, 'stand-dimetrodon')); built = true;
      save = sim.step(save, { x: 0, z: -5 }, 0.05);
      assert.ok(visitorWalkable(sim.poses().find(p => p.id === 1)!, museumLayout(save)));
    }
  }
  assert.ok(built, 'fixture constructs the stand while the visitor crosses its future footprint');
  assert.ok(!save.visitors.visits.some(v => v.id === 1)); reload(save);
});
