import test from 'node:test';
import assert from 'node:assert/strict';
import { visitorOwnedRooms, visitorCapacityForOwnedRooms, visitorCounts, hasAdmissionPlace, hasWaitingPlace } from '../src/game/visitor-capacity.ts';
import type { VisitorOwnedRooms } from '../src/game/visitor-capacity.ts';
import { visitorCapacity, arriveVisitor, payVisitor, finishVisit, ticketPrice, canArrive, arrivalSeconds } from '../src/game/visitors.ts';
import { createVisitorSimulation, visitorPath, visitorWalkable, viewingPositions } from '../src/game/visitor-simulation.ts';
import { mvpRecoveredFirst, mvpDisplay } from './helpers/mvp-fixture.ts';
import { createMvpSave } from '../src/game/mvp-economy.ts';
import type { MvpSave } from '../src/game/mvp-economy.ts';
import { buyPurchase } from '../src/game/purchases.ts';
import { collectTicketRevenue } from '../src/game/cash.ts';
import { payLedgerTicket, ledgerTotals } from '../src/game/ticket-ledger.ts';
import { parseMvpSave, loadMvpSave } from '../src/persistence/mvp-save.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import { parseLedgerVisitors } from '../src/persistence/ledger-save.ts';
import { createCommitter } from '../src/app/commit.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { CASHIER_STATION, VISITOR_DOOR, VISITORS, queuePoint } from '../src/content/visitors.ts';
import { ARRIVAL } from '../src/game/navigation.ts';
import { travelTo } from '../src/game/world-map.ts';

const first = () => mvpDisplay(buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon'), 'dimetrodon');
const reload = (s: MvpSave) => { assert.deepEqual(parseMvpSave(JSON.stringify(s), 42), s); return s; };
function populate(admitted: number, waiting = 0) {
  let s = first();
  for (let i = 0; i < admitted; i++) s = payVisitor(arriveVisitor(s), s.visitors.nextId, CASHIER_STATION, true);
  for (let i = 0; i < waiting; i++) s = arriveVisitor(s);
  return reload(s);
}
// Explicit test-only projection standing in for a FUTURE authoritative receipt
// reader. Current save validation and live commands never accept these receipts.
const syntheticRooms = (count: number) => Array.from({ length: count }, (_, i) => `permian-room-${i + 1}`) as unknown as VisitorOwnedRooms;
const stepMany = (s: MvpSave, sim: ReturnType<typeof createVisitorSimulation>, n: number, player = ARRIVAL) => {
  for (let i = 0; i < n; i++) {
    s = sim.step(s, player, 0.05);
    const counts = visitorCounts(s.visitors.visits); assert.ok(counts.waiting <= 6 && counts.admitted <= 6);
  }
  return reload(s);
};

for (const [rooms, waiting, admitted] of [[1, 6, 6], [2, 10, 12], [3, 14, 18]]) {
  test(`${rooms} validated rooms enforce ${waiting} waiting and ${admitted} admissions in isolated transitions`, () => {
    const capacity = visitorCapacityForOwnedRooms(syntheticRooms(rooms)); assert.deepEqual(capacity, { waiting, admitted });
    let s = first();
    // Exercise the same pure admission/queue guards and accounting operation as
    // runtime, with no future room receipts or gameplay purchase override.
    for (let i = 0; i < admitted; i++) {
      assert.ok(hasWaitingPlace(s.visitors.visits, capacity));
      s = { ...s, visitors: { ...s.visitors, nextId: i + 2, visits: [...s.visitors.visits, { id: i + 1, paid: 0 }] } };
      assert.ok(hasAdmissionPlace(s.visitors.visits, capacity)); s = payLedgerTicket(s, i + 1, ticketPrice(s));
    }
    for (let i = 0; i < waiting; i++) {
      assert.ok(hasWaitingPlace(s.visitors.visits, capacity));
      s = { ...s, visitors: { ...s.visitors, nextId: s.visitors.nextId + 1, visits: [...s.visitors.visits, { id: s.visitors.nextId, paid: 0 }] } };
    }
    assert.equal(hasWaitingPlace(s.visitors.visits, capacity), false); assert.equal(hasAdmissionPlace(s.visitors.visits, capacity), false);
    assert.equal(s.pendingTicketRevenue, admitted * 4); assert.equal(ticketPrice(s), 4);
    assert.deepEqual(visitorCounts(s.visitors.visits), capacity);
  });
}
test('initial ownership gives 6/6; eligibility and completed exhibits grant no capacity', () => {
  const s = createMvpSave(1); assert.deepEqual(visitorCapacity(s), { waiting: 6, admitted: 6 });
  assert.deepEqual(visitorCapacity({ ...s, eligibleRoomIds: ['permian-room-2'] } as MvpSave), visitorCapacity(s));
  assert.deepEqual(visitorCapacity(first()), visitorCapacity(s));
});
test('invalid, duplicate, unknown, or unverified future ownership cannot grant capacity', () => {
  for (const rooms of [null, { version: 2, owned: [] }, { version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 18 }] }]) {
    assert.deepEqual(visitorCapacityForOwnedRooms(visitorOwnedRooms(rooms)), { waiting: 0, admitted: 0 });
    assert.equal(canArrive({ ...first(), rooms } as MvpSave), false);
    assert.equal(parseMvpSave(JSON.stringify({ ...first(), rooms }), 42), null);
  }
  for (const ids of [[], ['unknown'], ['permian-room-1', 'unknown'], ['permian-room-1', 'permian-room-1'], ['permian-room-2'], ['permian-room-1', 'permian-room-3']])
    assert.deepEqual(visitorCapacityForOwnedRooms(ids as unknown as VisitorOwnedRooms), { waiting: 0, admitted: 0 });
});
test('capacity increases preserve existing visits, prices and cash, allowing new admissions only', () => {
  let s = populate(6, 6); const original = structuredClone(s);
  for (const count of [2, 3]) {
    const cap = visitorCapacityForOwnedRooms(syntheticRooms(count)); assert.ok(hasAdmissionPlace(s.visitors.visits, cap));
    assert.deepEqual(s, original); assert.equal(ticketPrice(s), 4); assert.equal(arrivalSeconds(s), 12);
  }
  s = payLedgerTicket(s, 7, 4); assert.equal(s.pendingTicketRevenue, 28);
  assert.deepEqual(s.visitors.visits.slice(0, 6), original.visitors.visits.slice(0, 6));
});
test('waiting consumes no occupancy; payment reserves exactly one place and one sale', () => {
  let s = populate(0, 6); assert.deepEqual(visitorCounts(s.visitors.visits), { waiting: 6, admitted: 0 });
  assert.equal(s.pendingTicketRevenue, 0);
  s = reload(payVisitor(s, 1, CASHIER_STATION, true));
  assert.deepEqual(visitorCounts(s.visitors.visits), { waiting: 5, admitted: 1 });
  assert.equal(s.pendingTicketRevenue, 4); assert.deepEqual(s.visitors.sales.counts, { '4': 1 });
  assert.equal(payVisitor(s, 1, CASHIER_STATION, true), s);
});
test('full museum blocks payment, retains unpaid queue and leaves all accounting unchanged', () => {
  const s = populate(6, 6); const before = structuredClone(s);
  for (let i = 0; i < 20; i++) assert.equal(payVisitor(s, 7, CASHIER_STATION, true), s);
  assert.deepEqual(s, before); assert.equal(s.visitors.visits[6].paid, 0);
});
test('exit releases one place exactly once; next queued visitor can pay', () => {
  const full = populate(6, 6); const exited = reload(finishVisit(full, 1));
  assert.equal(finishVisit(exited, 1), exited); assert.equal(finishVisit(exited, 7), exited);
  const next = reload(payVisitor(exited, 7, CASHIER_STATION, true));
  assert.equal(visitorCounts(next.visitors.visits).admitted, 6); assert.equal(next.pendingTicketRevenue, 28);
  assert.equal(payVisitor(next, 8, CASHIER_STATION, true), next);
});
test('museum full permits arrivals until the independent queue reaches six', () => {
  let s = populate(6); assert.ok(canArrive(s));
  for (let i = 0; i < 6; i++) { assert.ok(canArrive(s)); s = reload(arriveVisitor(s)); }
  assert.equal(s.visitors.visits.length, 12); assert.equal(canArrive(s), false); assert.equal(arriveVisitor(s), s);
  assert.equal(s.pendingTicketRevenue, 24);
});
test('cashier attendance, front-of-queue order and physical readiness still gate payment', () => {
  const s = populate(0, 6);
  assert.equal(payVisitor(s, 1, ARRIVAL, true), s); assert.equal(payVisitor(s, 1, CASHIER_STATION, false), s);
  assert.equal(payVisitor(s, 2, CASHIER_STATION, true), s);
  assert.equal(payVisitor(travelTo(s, { kind: 'site-camp', siteId: 'courtyard-dig' }), 1, CASHIER_STATION, true).pendingTicketRevenue, 0);
});
test('waiting visitors pay current price; admitted visitors retain their original paid amount', () => {
  let s = populate(1, 2); s = reload(mvpDisplay(buyPurchase(s, 'stand-trilobite'), 'trilobite'));
  assert.equal(ticketPrice(s), 6); assert.equal(s.visitors.visits[0].paid, 4);
  s = reload(payVisitor(s, 2, CASHIER_STATION, true)); assert.equal(s.pendingTicketRevenue, 10);
  assert.deepEqual(s.visitors.sales.counts, { '4': 1, '6': 1 });
  const coins = s.economy.coins; s = reload(collectTicketRevenue(s));
  assert.equal(s.economy.coins, coins + 10); assert.equal(s.pendingTicketRevenue, 0); assert.equal(collectTicketRevenue(s), s);
});
test('no admission or arrivals before a valid first display', () => {
  const s = createMvpSave(42); assert.equal(arriveVisitor(s), s);
  assert.equal(payVisitor(s, 1, CASHIER_STATION, true), s); assert.equal(ticketPrice(s), 0);
});
test('schema 25 accepts six plus six, rejecting either independent limit even with balanced money', () => {
  const s = populate(6, 6); reload(s);
  const tooManyWaiting = { ...s, visitors: { ...s.visitors, nextId: 14, visits: [...s.visitors.visits, { id: 13, paid: 0 }] } };
  assert.equal(parseMvpSave(JSON.stringify(tooManyWaiting), 42), null);
  const tooManyPaid = payLedgerTicket(s, 7, 4); assert.equal(ledgerTotals(tooManyPaid.visitors.sales)!.sold, 7);
  assert.equal(parseMvpSave(JSON.stringify(tooManyPaid), 42), null);
  assert.equal(parseLedgerVisitors(s.visitors, 4), null, 'historical reader retains total 6 / waiting 3');
});
test('historical schema-24 readers and migration remain unchanged', () => {
  const old = createCreditSave(42); assert.deepEqual(parseCreditSave(JSON.stringify(old), 42), old);
  const s = parseMvpSave(JSON.stringify(old), 42)!; assert.equal(s.version, 25); assert.deepEqual(s.economy, old.economy);
  assert.deepEqual(visitorCapacity(s), { waiting: 6, admitted: 6 });
});
test('reload retires transient paid tours, preserves six waiting visitors and committed cash exactly', () => {
  const s = populate(6, 6), raw = JSON.stringify(s);
  const result = loadMvpSave({ getItem: () => raw, setItem: () => assert.fail(), removeItem: () => assert.fail() }, 42);
  assert.equal(result.kind, 'ready'); if (result.kind !== 'ready') return;
  reload(result.save); assert.deepEqual(visitorCounts(result.save.visitors.visits), { waiting: 6, admitted: 0 });
  assert.deepEqual(result.save.visitors.sales, s.visitors.sales); assert.equal(result.save.pendingTicketRevenue, 24);
  assert.equal(payVisitor(result.save, 1, CASHIER_STATION, true), result.save);
});
test('travel retires tours without repricing, losing revenue or losing the unpaid queue', () => {
  const s = populate(6, 6), away = reload(travelTo(s, { kind: 'site-camp', siteId: 'courtyard-dig' }));
  const home = reload(travelTo(away, { kind: 'hub' }));
  assert.deepEqual(visitorCounts(home.visitors.visits), { waiting: 6, admitted: 0 });
  assert.equal(home.pendingTicketRevenue, 24); assert.deepEqual(home.visitors.sales, s.visitors.sales);
});
test('failed admission writes reserve no phantom place or income; duplicate retry publishes once', () => {
  let live = populate(5, 6), raw = JSON.stringify(live), fail = true, effects = 0;
  const before = raw, candidate = payVisitor(live, 6, CASHIER_STATION, true);
  const commit = createCommitter<MvpSave>({ getItem: () => raw, setItem: (_k, v) => { if (fail) throw Error('quota'); raw = v; }, removeItem: () => { raw = ''; } }, () => {});
  commit.enable(); assert.equal(commit.commit(candidate, s => { live = s; effects++; }), 'failed');
  assert.equal(raw, before); assert.equal(visitorCounts(live.visitors.visits).admitted, 5); assert.equal(live.pendingTicketRevenue, 20);
  assert.equal(commit.canMutate(), false); fail = false; commit.flush(); commit.flush();
  assert.equal(effects, 1); assert.equal(visitorCounts(live.visitors.visits).admitted, 6); assert.equal(live.pendingTicketRevenue, 24); reload(live);
  assert.equal(payVisitor(live, 6, CASHIER_STATION, true), live); commit.dispose();
});
test('failed departure write retains occupancy until the exact departure commits; revenue is unchanged', () => {
  let live = populate(6, 6), raw = JSON.stringify(live), fail = true, effects = 0;
  const commit = createCommitter<MvpSave>({ getItem: () => raw,
    setItem: (_k, value) => { if (fail) throw Error('quota'); raw = value; }, removeItem: () => {} }, () => {});
  commit.enable(); assert.equal(commit.commit(finishVisit(live, 1), next => { live = next; effects++; }), 'failed');
  assert.equal(visitorCounts(live.visitors.visits).admitted, 6); assert.equal(payVisitor(live, 7, CASHIER_STATION, true), live);
  fail = false; commit.flush(); commit.flush(); assert.equal(effects, 1);
  assert.equal(visitorCounts(live.visitors.visits).admitted, 5); assert.equal(live.pendingTicketRevenue, 24);
  assert.deepEqual(parseMvpSave(raw, 42), live); commit.dispose();
});
test('simulation fills six waiting slots and discards blocked arrival time without a burst', () => {
  let s = first(); const sim = createVisitorSimulation(() => 0.5); sim.reset(s);
  s = stepMany(s, sim, 1700); assert.equal(visitorCounts(s.visitors.visits).waiting, 6);
  const full = s; s = stepMany(s, sim, 500); assert.deepEqual(s, full);
  s = payVisitor(s, 1, CASHIER_STATION, true); const id = s.visitors.nextId;
  s = stepMany(s, sim, 239); assert.equal(s.visitors.nextId, id);
  s = stepMany(s, sim, 2); assert.equal(s.visitors.nextId, id + 1);
  assert.equal(visitorCounts(s.visitors.visits).waiting, 6);
});
test('service timing is not banked while admission is full', () => {
  let s = populate(6, 1); const sim = createVisitorSimulation(() => 0.5); sim.reset(s);
  s = stepMany(s, sim, 21, CASHIER_STATION); assert.equal(s.pendingTicketRevenue, 24);
  s = finishVisit(s, 1); s = stepMany(s, sim, 19, CASHIER_STATION); assert.equal(s.pendingTicketRevenue, 24);
  s = stepMany(s, sim, 1, CASHIER_STATION); assert.equal(s.pendingTicketRevenue, 28);
});
test('paid visitors remain occupants through viewing and exit movement, and disappear only at the door', () => {
  let s = populate(1); const sim = createVisitorSimulation(() => 0.5); sim.reset(s);
  let movedAway = false, leaving = false, exited = false;
  for (let i = 0; i < 1600; i++) {
    const before = s; s = sim.step(s, ARRIVAL, 0.05); const pose = sim.poses().find(p => p.id === 1)!;
    const distance = Math.hypot(pose.x - VISITOR_DOOR.x, pose.z - VISITOR_DOOR.z);
    if (distance > 1) movedAway = true;
    if (movedAway && pose.moving && distance < 1 && s.visitors.visits.some(v => v.id === 1)) leaving = true;
    if (before.visitors.visits.some(v => v.id === 1) && !s.visitors.visits.some(v => v.id === 1)) {
      assert.ok(distance < 0.02); exited = true; break;
    }
    assert.equal(visitorCounts(s.visitors.visits).admitted, 1); assert.equal(s.pendingTicketRevenue, 4);
  }
  assert.ok(movedAway && leaving && exited); s = sim.step(s, ARRIVAL, 0.05);
  assert.equal(sim.poses().some(p => p.id === 1), false); assert.equal(visitorCounts(s.visitors.visits).admitted, 0); reload(s);
});
test('six queue positions and each promotion/entrance/exit route stay inside walkable space', () => {
  for (const s of [first(), mvpDisplay(buyPurchase(first(), 'stand-trilobite'), 'trilobite')]) {
    const layout = museumLayout(s);
    for (let i = 0; i < 6; i++) {
      const p = queuePoint(i); assert.ok(visitorWalkable(p, layout));
      for (let j = 0; j < i; j++) assert.ok(Math.hypot(p.x - queuePoint(j).x, p.z - queuePoint(j).z) >= 0.85);
      for (const [from, target] of [[VISITOR_DOOR, p], [p, VISITOR_DOOR], [p, queuePoint(Math.max(0, i - 1))]]) {
        const path = visitorPath(from, target, layout); assert.ok(path.length);
        let prior = from;
        for (const next of path) {
          for (let f = 0; f <= 1; f += 0.02) assert.ok(visitorWalkable({ x: prior.x + (next.x - prior.x) * f, z: prior.z + (next.z - prior.z) * f }, layout));
          prior = next;
        }
      }
    }
    assert.ok(viewingPositions('dimetrodon', layout, () => 0.5).length >= 6);
  }
});
test('scene layout changes preserve paid identity and allow tours to finish; reset clears actors and capacities', () => {
  let s = populate(4, 2); const sim = createVisitorSimulation(() => 0.5); sim.reset(s);
  s = stepMany(s, sim, 40); const sales = structuredClone(s.visitors.sales);
  s = buyPurchase(s, 'stand-trilobite'); s = stepMany(s, sim, 1800);
  assert.deepEqual(s.visitors.sales, sales); assert.ok(s.visitors.visits.every(v => !v.paid));
  const fresh = createMvpSave(42); sim.reset(fresh); assert.deepEqual(sim.poses(), []);
  assert.deepEqual(visitorCapacity(fresh), { waiting: 6, admitted: 6 }); assert.equal(fresh.pendingTicketRevenue, 0);
});
test('long frames and repeated paused ticks cannot generate admissions or arrival bursts', () => {
  const s = first(), sim = createVisitorSimulation(); sim.reset(s);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(sim.step(s, CASHIER_STATION, dt), s);
  assert.equal(sim.step(s, CASHIER_STATION, 10000), s); assert.equal(VISITORS.arrivalSeconds.join(','), '12,10,8');
});
