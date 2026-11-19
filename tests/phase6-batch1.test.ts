import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCashSave, collectTicketRevenue } from '../src/game/cash.ts';
import type { CashSave } from '../src/game/cash.ts';
import { parseCashSave, loadCashSave } from '../src/persistence/cash-save.ts';
import { parsePaymentSave } from '../src/persistence/payment-save.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITES, SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { arriveVisitor, payVisitor, finishVisit, ticketIncome } from '../src/game/visitors.ts';
import { CASHIER_STATION, VISITOR_DOOR } from '../src/content/visitors.ts';
import { advanceMuseum, buyPurchase, museumJourney, purchaseStatus } from '../src/game/purchases.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { siteOwned, travelTo } from '../src/game/world-map.ts';
import { createCommitter } from '../src/app/commit.ts';
import { createVisitorSimulation, viewingPositions, viewingCenter, visitorWalkable, visitorPath } from '../src/game/visitor-simulation.ts';

const reload = (s: CashSave) => { const next = parseCashSave(JSON.stringify(s), 42); assert.deepEqual(next, s); return next!; };
function fixture(displays = 3) {
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITES.flatMap(s => s.cells.map(c => [c.id, 1]))),
    collected: SITES.flatMap(s => [...s.requiredDiscoveryIds]), closedSites: SITES.map(s => s.id),
    placed: EXHIBITS.slice(0, displays).flatMap(e => [...e.parts]) }, 42);
  return reload(parseCashSave(JSON.stringify(old), 42)!);
}
function sale(s: CashSave) {
  s = arriveVisitor(s); const id = s.visitors.nextId - 1;
  return reload(finishVisit(payVisitor(s, id, CASHIER_STATION, true), id));
}
test('cash: sales stay pending, mixed prices collect exactly once, new sales start another pile', () => {
  let s = fixture(1); s = payVisitor(arriveVisitor(s), 1, CASHIER_STATION, true);
  assert.equal(s.economy.coins, 20); assert.equal(s.pendingTicketRevenue, 2);
  assert.equal(payVisitor(s, 1, CASHIER_STATION, true), s);
  s = reload(advanceMuseum(s, { ...museumJourney(s), placed: fixture(3).placed }) as CashSave);
  s = sale(s); assert.equal(s.pendingTicketRevenue, 6); assert.equal(s.economy.coins, 20);
  s = reload(collectTicketRevenue(s)); assert.equal(s.economy.coins, 26); assert.equal(s.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(s), s);
  s = sale(s); assert.equal(s.pendingTicketRevenue, 4); assert.equal(s.economy.coins, 26);
});
test('cash: load retires paid visitors without losing pending revenue; travel and progression retain it', () => {
  const paid = payVisitor(arriveVisitor(fixture()), 1, CASHIER_STATION, true);
  const loaded = loadCashSave({ getItem: () => JSON.stringify(paid), setItem() {}, removeItem() {} }, 42);
  assert.equal(loaded.kind, 'ready'); if (loaded.kind !== 'ready') return;
  assert.equal(loaded.save.pendingTicketRevenue, 4); assert.deepEqual(loaded.save.visitors.visits, []);
  const away = reload(travelTo(loaded.save, { kind: 'site-camp', siteId: SITE.id }));
  assert.equal(collectTicketRevenue(away), away);
  const home = reload(travelTo(away, { kind: 'hub' }));
  assert.equal(reload(collectTicketRevenue(home)).economy.coins, 24);
});
test('cash: failed sale and collection freeze exact candidates; retry, reload and reset never double-credit', () => {
  let live = arriveVisitor(fixture()), raw = JSON.stringify(live), fail = false, effects = 0;
  const port = { getItem: () => raw, setItem(_k: string, v: string) { if (fail) throw Error('quota'); raw = v; }, removeItem() { raw = ''; } };
  const commit = createCommitter<CashSave>(port, () => {}); commit.enable();
  for (const command of [(s: CashSave) => payVisitor(s, 1, CASHIER_STATION, true), collectTicketRevenue]) {
    const before = live, stored = raw; fail = true;
    assert.equal(commit.commit(command(live), s => { live = s; effects++; }), 'failed');
    assert.equal(raw, stored); assert.equal(live, before); assert.equal(commit.canMutate(), false);
    assert.equal(commit.commit(command(live), () => assert.fail()), 'blocked');
    fail = false; commit.flush(); commit.flush(); reload(live);
  }
  assert.equal(effects, 2); assert.equal(live.economy.coins, 24); assert.equal(live.pendingTicketRevenue, 0);
  live = sale(live); fail = true; commit.commit(collectTicketRevenue(live), () => assert.fail('reset must discard candidate'));
  fail = false; assert.ok(commit.reset()); commit.commit(createCashSave(42), s => { live = s; }); commit.flush();
  assert.equal(live.pendingTicketRevenue, 0); assert.equal(live.economy.coins, 20); commit.dispose();
});
test('cash: migration keeps earlier paid income and partial purchases without manufacturing collectible cash', () => {
  const fresh = createCashSave(42);
  let s = reload(contributePurchase(fresh, 'stand-dimetrodon', museumLayout(fresh).purchases.find(p => p.id === 'stand-dimetrodon')!));
  const { pendingTicketRevenue: _pending, ...base } = s;
  const old = { ...base, version: 20 };
  assert.ok(parsePaymentSave(JSON.stringify(old), 42));
  assert.deepEqual(parseCashSave(JSON.stringify(old), 42), s);
  s = collectTicketRevenue(sale(fixture()));
  const { pendingTicketRevenue: _cash, ...paid } = s;
  const migrated = parseCashSave(JSON.stringify({ ...paid, version: 20 }), 42)!;
  assert.equal(migrated.economy.coins, 24); assert.equal(migrated.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(migrated), migrated);
  assert.equal(parsePaymentSave(JSON.stringify(s), 42), null);
});
test('cash: corrupt, missing, excessive and inconsistent pending amounts are protected', () => {
  const s = sale(fixture());
  for (const pending of [-1, 1.5, null, '4', 5, Number.MAX_SAFE_INTEGER])
    assert.equal(parseCashSave(JSON.stringify({ ...s, pendingTicketRevenue: pending }), 42), null);
  const { pendingTicketRevenue: _pending, ...missing } = s;
  assert.equal(parseCashSave(JSON.stringify(missing), 42), null);
  assert.equal(parseCashSave(JSON.stringify({ ...s, economy: { ...s.economy, coins: 24 } }), 42), null);
  assert.equal(parseCashSave(JSON.stringify({ ...s, version: 22 }), 42), null);
});
test('stands: every stand buys before site two; early Eryops purchase/deposit reloads without closing site one', () => {
  const journey = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: ['trilobite-slab'], placed: ['trilobite-whole'] };
  const old = createGameSave(journey, 42);
  let s = reload({ ...createCashSave(42), ...journey, version: 21, custody: parseCashSave(JSON.stringify(old), 42)!.custody, economy: { ...old.economy, coins: 12 },
    museum: { version: 1, owned: [{ id: 'stand-trilobite', source: 'purchase', paid: 8 }] } });
  for (let i = 0; i < 20; i++) s = sale(s);
  assert.equal(purchaseStatus(s, 'west-wing'), 'insufficient', 'pending cash is not spendable');
  s = reload(collectTicketRevenue(s));
  s = reload(buyPurchase(s, 'west-wing'));
  for (const id of ['stand-dimetrodon', 'stand-eryops']) {
    const before = s.economy.coins;
    s = reload(contributePurchase(s, id, museumLayout(s).purchases.find(p => p.id === id)!));
    s = reload(buyPurchase(s, id));
    assert.equal(s.economy.coins, before - 12); assert.equal(buyPurchase(s, id), s);
  }
  assert.deepEqual(s.closedSites, []); assert.equal(siteOwned(s, ERYOPS_SITE.id), false);
  assert.equal(travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }), s);
});
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
test('visitors: perimeter candidates offer multiple sides with reachable obstacle-free paths in both halls', () => {
  for (const s of [fixture(), { ...fixture(2), museum: { version: 1 as const, owned: fixture(2).museum.owned.filter(p => !['west-wing', 'stand-eryops'].includes(p.id)) } }]) {
    const layout = museumLayout(s);
    for (const spot of layout.spots) {
      const center = viewingCenter(spot.id), points = viewingPositions(spot.id, layout, rng(42));
      assert.ok(points.length >= 3);
      assert.ok(new Set(points.map(p => Math.abs(p.x - center.x) > center.width / 2 ? p.x < center.x ? 'left' : 'right' : p.z < center.z ? 'front' : 'back')).size >= 2);
      for (const target of points) {
        const path = visitorPath(VISITOR_DOOR, target, layout); assert.ok(path.length);
        let prev = VISITOR_DOOR;
        for (const next of path) {
          for (let t = 0; t <= 1; t += 0.02) assert.ok(visitorWalkable({ x: prev.x + (next.x - prev.x) * t, z: prev.z + (next.z - prev.z) * t }, layout));
          prev = next;
        }
      }
    }
  }
});
test('visitors: randomized tours vary positions/durations, face exhibits, avoid shared viewing spots and finish', () => {
  const observed = new Set<string>(), durations = new Set<number>();
  for (let seed = 1; seed <= 8; seed++) {
    let s = fixture(1);
    for (let i = 0; i < 6; i++) { s = arriveVisitor(s); s = payVisitor(s, i + 1, CASHIER_STATION, true); }
    const sim = createVisitorSimulation(rng(seed)); sim.reset(s);
    const times = new Map<number, number>(), layout = museumLayout(s);
    for (let frame = 0; frame < 1800 && s.visitors.visits.some(v => v.id <= 6); frame++) {
      s = sim.step(s, { x: 0, z: -5 }, 0.05);
      const viewing = sim.poses().filter(p => p.paid && !p.moving && Math.hypot(p.x - VISITOR_DOOR.x, p.z - VISITOR_DOOR.z) > 0.1);
      for (const p of sim.poses()) assert.ok(visitorWalkable(p, layout));
      for (const p of viewing) {
        observed.add(`${p.x.toFixed(1)},${p.z.toFixed(1)}`); times.set(p.id, (times.get(p.id) ?? 0) + 1);
        const c = viewingCenter('dimetrodon');
        assert.ok(p.direction.x * (c.x - p.x) + p.direction.z * (c.z - p.z) > 0);
        for (const other of viewing) if (p.id !== other.id) assert.ok(Math.hypot(p.x - other.x, p.z - other.z) >= 0.85);
      }
    }
    assert.ok(!s.visitors.visits.some(v => v.id <= 6));
    for (const duration of times.values()) { assert.ok(duration >= 65 && duration <= 132); durations.add(duration); }
    assert.equal(s.economy.coins, 20); assert.equal(s.pendingTicketRevenue, ticketIncome(s.visitors.sales)); reload(s);
  }
  assert.ok(observed.size > 10); assert.ok(durations.size > 3);
});
