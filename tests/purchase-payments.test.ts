import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentSave, migratePaymentSave, contributePurchase, createPurchasePaymentSimulation } from '../src/game/purchase-payments.ts';
import type { PaymentSave } from '../src/game/purchase-payments.ts';
import { parsePaymentSave, loadPaymentSave } from '../src/persistence/payment-save.ts';
import { parseUpgradeSave } from '../src/persistence/upgrade-save.ts';
import { createUpgradeSave, buyUpgrade } from '../src/game/upgrades.ts';
import { buyPurchase, advanceMuseum, museumJourney, placeOwnedGroup, remainingPurchaseCost } from '../src/game/purchases.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { travelTo, buySite } from '../src/game/world-map.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { createCommitter } from '../src/app/commit.ts';

const reload = (s: PaymentSave) => { const read = parsePaymentSave(JSON.stringify(s), 42); assert.deepEqual(read, s); return read!; };
const spot = (s: PaymentSave, id = 'stand-dimetrodon') => museumLayout(s).purchases.find(p => p.id === id)!;
function pay(s: PaymentSave, count: number, id = 'stand-dimetrodon') {
  const p = spot(s, id); for (let i = 0; i < count; i++) s = reload(contributePurchase(s, id, p)); return s;
}
function ready() {
  const state = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] };
  return reload({ ...createPaymentSave(42), ...state, version: 20, economy: createGameSave(state, 42).economy });
}
function sale(s: PaymentSave) { s = arriveVisitor(s); const id = s.visitors.nextId - 1; return reload(finishVisit(payVisitor(s, id, CASHIER_STATION, true), id)); }

test('partial payments debit once per coin and build only on the saved final coin', () => {
  let s = createPaymentSave(42); const p = spot(s);
  for (let paid = 1; paid < 12; paid++) {
    s = reload(contributePurchase(s, p.id, p));
    assert.equal(s.economy.coins, 20 - paid); assert.equal(remainingPurchaseCost(s, p.id), 12 - paid);
    assert.equal(museumLayout(s).assembled.length, 0);
  }
  s = reload(contributePurchase(s, p.id, p));
  assert.equal(s.economy.coins, 8); assert.equal(museumLayout(s).assembled.length, 1);
  assert.deepEqual(s.payments.partial, {}); assert.deepEqual(s.museum.owned, [{ id: p.id, source: 'purchase', paid: 12 }]);
  assert.equal(contributePurchase(s, p.id, p), s); assert.equal(buyPurchase(s, p.id), s);
});

test('separate deposits survive leaving, travelling and reloading; click completion pays only the remainder', () => {
  let s = pay(createPaymentSave(42), 3); s = pay(s, 2, 'stand-trilobite');
  const deposits = structuredClone(s.payments);
  s = reload(travelTo(s, { kind: 'site-camp', siteId: SITE.id })); assert.deepEqual(s.payments, deposits);
  assert.equal(contributePurchase(s, 'stand-dimetrodon', { x: -1.2, z: -2.45 }), s);
  s = reload(travelTo(s, { kind: 'hub' })); s = reload(buyPurchase(s, 'stand-dimetrodon'));
  assert.equal(s.economy.coins, 6); assert.deepEqual(s.payments.partial, { 'stand-trilobite': 2 });
  s = reload(buyPurchase(s, 'stand-trilobite')); assert.equal(s.economy.coins, 0); assert.deepEqual(s.payments.partial, {});
});

test('the standing clock pauses off-circle, during blocking states and without funds; long frames never catch up', () => {
  let s = createPaymentSave(42); const sim = createPurchasePaymentSimulation(), p = spot(s);
  for (let i = 0; i < 4; i++) assert.equal(sim.step(s, p, 0.05, true), s);
  assert.equal(sim.step(s, p, 10_000, false), s);
  for (let i = 0; i < 4; i++) assert.equal(sim.step(s, p, 0.05, true), s);
  s = reload(sim.step(s, p, 0.05, true)); assert.equal(s.economy.coins, 19);
  sim.step(s, p, 0.05, true); sim.step(s, { x: 0, z: -5 }, 10_000, true);
  for (const dt of [-1, 0, NaN, Infinity]) assert.equal(sim.step(s, p, dt, true), s);
  assert.equal(sim.step(s, p, 10_000, true), s);
  sim.reset(); for (let i = 0; i < 4; i++) assert.equal(sim.step(s, p, 0.05, true), s);
  assert.equal(sim.step({ ...s, economy: { ...s.economy, coins: 0 } }, p, 0.05, true).economy.coins, 0);
});

test('locked space, locked stands, wrong circles and non-museum commands never take coins', () => {
  const s = createPaymentSave(42);
  for (const id of ['west-wing', 'stand-eryops', 'unknown']) assert.equal(contributePurchase(s, id, spot(s, id) ?? { x: -11, z: -2.45 }), s);
  assert.equal(contributePurchase(s, 'stand-dimetrodon', spot(s, 'stand-trilobite')), s);
  assert.equal(contributePurchase(s, 'stand-dimetrodon', { x: 0, z: 0 }), s);
});

test('zero-soil-income play resumes a part-paid expansion after earning tickets and preserves deposits through upgrades and digging', () => {
  let s = ready(); s = pay(s, 12);
  for (const part of EXHIBITS[0].parts) s = reload(advanceMuseum(s, placeOwnedGroup(s, 'dimetrodon', part, part)) as PaymentSave);
  s = pay(s, 8, 'west-wing'); assert.equal(s.economy.coins, 0); assert.equal(s.payments.partial['west-wing'], 8);
  assert.equal(contributePurchase(s, 'west-wing', spot(s, 'west-wing')), s);
  for (let i = 0; i < 20; i++) s = sale(s);
  s = reload(buyUpgrade(s, 'boots')); assert.equal(s.payments.partial['west-wing'], 8);
  s = pay(s, 10, 'west-wing'); assert.ok(museumLayout(s).expanded); assert.deepEqual(s.payments.partial, {});
  // Second-site ownership still gates its stand.
  assert.equal(contributePurchase(s, 'stand-eryops', spot(s, 'stand-eryops')), s);
  for (let i = 0; i < 12; i++) s = sale(s);
  s = reload(buySite(s, ERYOPS_SITE.id)); s = pay(s, 2, 'stand-eryops');
  s = reload(travelTo(travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }), { kind: 'site-pit', siteId: ERYOPS_SITE.id }));
  s = reload(advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig, [ERYOPS_SITE.cells[0].id]: 0.25 } }) as PaymentSave);
  assert.equal(s.payments.partial['stand-eryops'], 2); assert.equal(s.upgrades.owned.length, 1);
});

test('failed partial and final payments publish only after retry; duplicate retry and reset cannot double-charge', () => {
  for (const paid of [0, 11]) {
    let live = pay(createPaymentSave(42), paid), raw = JSON.stringify(live), fail = true, effects = 0;
    const initial = live, candidate = contributePurchase(live, 'stand-dimetrodon', spot(live));
    const port = { getItem: () => raw, setItem(_key: string, value: string) { if (fail) throw Error('quota'); raw = value; }, removeItem() { raw = ''; } };
    const commit = createCommitter<PaymentSave>(port, () => {}); commit.enable();
    assert.equal(commit.commit(candidate, s => { live = s; effects++; }), 'failed');
    assert.equal(live, initial); assert.equal(raw, JSON.stringify(initial)); assert.equal(commit.canMutate(), false);
    fail = false; commit.flush(); commit.flush(); assert.equal(effects, 1); assert.deepEqual(reload(live), candidate);
    commit.dispose();
    const reset = createCommitter<PaymentSave>(port, () => {}); reset.enable(); fail = true;
    reset.commit(candidate, () => assert.fail('discarded payment must never publish'));
    fail = false; assert.ok(reset.reset()); reset.commit(createPaymentSave(4), s => { live = s; }); reset.flush();
    assert.equal(live.economy.coins, 20); assert.deepEqual(live.payments.partial, {}); assert.deepEqual(live.museum.owned, []); reset.dispose();
  }
});

test('schema 20 rejects forged deposits, completed/locked/owned deposits and inconsistent balances', () => {
  const s = pay(createPaymentSave(42), 2);
  for (const partial of [{ unknown: 2 }, { 'stand-dimetrodon': 0 }, { 'stand-dimetrodon': -2 },
    { 'stand-dimetrodon': 2.5 }, { 'stand-dimetrodon': 12 }, { 'west-wing': 2 }, { 'stand-eryops': 2 }])
    assert.equal(parsePaymentSave(JSON.stringify({ ...s, payments: { version: 1, partial } }), 42), null);
  for (const payments of [null, {}, { version: 2, partial: {} }, { version: 1, partial: {}, extra: 1 }])
    assert.equal(parsePaymentSave(JSON.stringify({ ...s, payments }), 42), null);
  assert.equal(parsePaymentSave(JSON.stringify({ ...s, economy: { ...s.economy, coins: 20 } }), 42), null);
  const owned = buyPurchase(s, 'stand-dimetrodon');
  assert.equal(parsePaymentSave(JSON.stringify({ ...owned, economy: { ...owned.economy, coins: 7 }, payments: { version: 1, partial: { 'stand-dimetrodon': 1 } } }), 42), null);
  assert.equal(parseUpgradeSave(JSON.stringify(s), 42), null, 'older readers remain frozen');
});

test('old schemas migrate without deposits or money changes; loader protects corrupt saves and retires paid visitors', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = []; if (version >= 8) old.activeSiteId = SITE.id;
    const s = parsePaymentSave(JSON.stringify(old), 42)!; assert.ok(s); reload(s); assert.deepEqual(s.payments.partial, {});
  }
  const latest = createUpgradeSave(42);
  for (const version of [13, 14, 15, 16, 17, 18, 19]) {
    const old = { ...latest, version } as Record<string, unknown>;
    if (version < 19) delete old.upgrades; if (version < 18) delete old.custody; if (version < 17) delete old.helpers;
    if (version < 16) delete old.visitors; if (version < 15) delete old.world; if (version < 14) delete old.museum;
    const s = parsePaymentSave(JSON.stringify(old), 42)!; assert.ok(s); reload(s); assert.deepEqual(s.payments.partial, {}); assert.deepEqual(s.economy, latest.economy);
  }
  assert.deepEqual(migratePaymentSave(latest).museum, latest.museum);
  let raw: string | null = null; const storage = { getItem: () => raw, setItem() { assert.fail(); }, removeItem() { assert.fail(); } };
  assert.equal(loadPaymentSave(storage, 42).kind, 'ready');
  for (const value of ['bad json', JSON.stringify({ ...createPaymentSave(42), version: 21 })]) { raw = value; assert.equal(loadPaymentSave(storage, 42).kind, 'invalid'); }
  assert.equal(loadPaymentSave({ ...storage, getItem() { throw Error('blocked'); } }, 42).kind, 'unavailable');
});
