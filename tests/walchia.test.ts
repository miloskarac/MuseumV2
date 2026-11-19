import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOM1_EXHIBITS, WALCHIA_PART, ALL_PARTS, ROOM1_PARTS } from '../src/content/exhibit.ts';
import { ROOM1_ERYOPS_SITE, ERYOPS_SITE, ROOM1_SITES, SITE, activeSite } from '../src/content/journey.ts';
import { EARLY_PERMIAN_STANDS } from '../src/content/early-permian-layout.ts';
import { PERMIAN_ROOMS } from '../src/content/permian-museum.ts';
import { createRoom1Game, migrateRoom1Game } from '../src/game/room1-economy.ts';
import type { Room1GameSave } from '../src/game/room1-economy.ts';
import { createMvpSave } from '../src/game/mvp-economy.ts';
import { parseMvpSave } from '../src/persistence/mvp-save.ts';
import { parseRoom1Game, loadRoom1Game } from '../src/persistence/room1-game-save.ts';
import { buyPurchase, purchaseStatus, advanceMuseum, museumJourney, placeOwnedGroup, displayedExhibits } from '../src/game/purchases.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { room1Complete, room1CompletionTransition, nextMvpStand } from '../src/game/mvp-progression.ts';
import { ticketPrice, arriveVisitor, payVisitor, visitorCapacity } from '../src/game/visitors.ts';
import { CASHIER_STATION, VISITOR_DOOR } from '../src/content/visitors.ts';
import { collectTicketRevenue } from '../src/game/cash.ts';
import { stepDigging, isUncovered, brush, collectFossil, allSiteRecovered } from '../src/game/journey.ts';
import { isPermianRoomComplete } from '../src/game/permian-rooms.ts';
import { travelTo, buySite } from '../src/game/world-map.ts';
import { createCommitter } from '../src/app/commit.ts';
import { room1BeforeSite2, threeRoom1Displays, recoverWalchia } from './helpers/walchia-fixture.ts';
import { FOSSIL_PROFILES } from '../src/presentation/fossil-profiles.ts';
import { visitorPath, visitorWalkable, viewingPositions } from '../src/game/visitor-simulation.ts';
import { buyHelper, assignHelper, startHelperTask, workHelper } from '../src/game/helpers.ts';
import { storedFinds, settleDeliveries, brushStored, collectStored, carriedFinds } from '../src/game/storage.ts';

const id = WALCHIA_PART.discoveryId, part = WALCHIA_PART.id;
const reload = (s: Room1GameSave) => { assert.deepEqual(parseRoom1Game(JSON.stringify(s), 42), s); return s; };
const display = (s: Room1GameSave) => advanceMuseum(s, placeOwnedGroup(s, 'walchia', part, part)) as Room1GameSave;
const full = () => reload(display(buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia')));

test('Walchia is one small whole plant fossil in Room 1 at the approved stand and shared site', () => {
  const exhibit = ROOM1_EXHIBITS.find(e => e.id === 'walchia')!;
  assert.equal(exhibit.mode, 'whole'); assert.deepEqual(exhibit.parts, [part]);
  assert.equal(ROOM1_PARTS.length, ALL_PARTS.length + 1); assert.ok(PERMIAN_ROOMS[0].exhibitIds.includes('walchia'));
  const stand = EARLY_PERMIAN_STANDS.find(s => s.id === 'walchia')!;
  assert.deepEqual([stand.x, stand.z, stand.width, stand.depth], [-11, 4.5, 2.2, 1.8]);
  assert.equal(ROOM1_SITES.length, 2); assert.equal(ROOM1_ERYOPS_SITE.id, ERYOPS_SITE.id);
  assert.deepEqual(ROOM1_ERYOPS_SITE.requiredDiscoveryIds, [...ERYOPS_SITE.requiredDiscoveryIds, id]);
});
test('Walchia occupies two reachable unused grid cells without changing Eryops or depth', () => {
  assert.equal(ROOM1_ERYOPS_SITE.grid.levels, 2);
  const cells = ROOM1_ERYOPS_SITE.cells.filter(c => c.discoveryId === id);
  assert.deepEqual(cells.map(c => [c.row, c.column]), [[0, 3], [0, 4]]);
  for (const c of ERYOPS_SITE.cells) {
    const current = ROOM1_ERYOPS_SITE.cells.find(n => n.id === c.id)!;
    if (c.discoveryId) assert.equal(current.discoveryId, c.discoveryId);
    assert.deepEqual([current.x, current.z], [c.x, c.z]);
  }
  assert.notDeepEqual(FOSSIL_PROFILES[part], FOSSIL_PROFILES['trilobite-whole']);
});
test('fresh schema 26 preserves prices, initial funds, free site and 6/6 visitors', () => {
  const s = reload(createRoom1Game(42)); assert.equal(s.economy.coins, 20); assert.equal(ticketPrice(s), 0);
  assert.deepEqual(visitorCapacity(s), { waiting: 6, admitted: 6 }); assert.deepEqual(s.museum.owned, []);
  assert.equal(nextMvpStand(s), 'stand-dimetrodon'); assert.equal(purchaseStatus(s, 'stand-walchia'), 'eryopsFirst');
  assert.equal(parseMvpSave(JSON.stringify(s), 42), null);
});
test('old completed Site 2 migration preserves all soil, rewards, ownership and fossils while reopening for new material', () => {
  const current = threeRoom1Displays(), old = { ...current, version: 25, closedSites: ['courtyard-dig', 'eryops-dig'] };
  assert.ok(parseMvpSave(JSON.stringify(old), 42));
  const migrated = parseRoom1Game(JSON.stringify(old), 42)!; reload(migrated);
  for (const key of ['dig', 'economy', 'collected', 'placed', 'museum', 'world', 'visitors', 'payments', 'helpers', 'upgrades', 'rooms', 'expansionCredit'])
    assert.deepEqual(migrated[key as keyof Room1GameSave], old[key as keyof typeof old], key);
  assert.deepEqual(migrated.closedSites, ['courtyard-dig']); assert.equal(migrated.collected.includes(id), false);
  assert.equal(isUncovered(museumJourney(migrated), id), true); assert.equal(buySite(migrated, 'eryops-dig'), migrated);
});
test('empty/partial historical sites migrate without granting Walchia or altering a column', () => {
  for (const old of [createMvpSave(7), room1BeforeSite2()]) {
    const s = parseRoom1Game(JSON.stringify(old), 42)!; reload(s);
    assert.deepEqual(s.dig, old.dig); assert.deepEqual(s.economy, old.economy); assert.equal(s.collected.includes(id), false);
    assert.equal(s.museum.owned.some(o => o.id === 'stand-walchia'), false);
  }
});

const historical = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
for (const [name, fixture] of Object.entries(historical)) test(`schema 26 preserves historical ${name} accounts and inventory`, () => {
  const raw = JSON.stringify(fixture), previous = parseMvpSave(raw, 42)!;
  assert.ok(previous); const current = parseRoom1Game(raw, 42)!; assert.ok(current); reload(current);
  assert.deepEqual(current, { ...previous, version: 26, closedSites: previous.closedSites.filter(id => id !== 'eryops-dig') });
  assert.equal(current.collected.includes(id), false);
  assert.equal(current.museum.owned.some(o => o.id === 'stand-walchia'), false);
});

test('recovering new material in an old closed pit cannot repay soil rewards', () => {
  const before = threeRoom1Displays(), after = recoverWalchia(before);
  assert.ok(after.closedSites.includes('eryops-dig')); assert.ok(after.collected.includes(id));
  assert.deepEqual(after.economy, before.economy); assert.deepEqual(after.dig, before.dig);
  assert.deepEqual(advanceMuseum(after, museumJourney(after)), after); reload(after);
});
test('actual shovel strikes expose Walchia and permit early cleaning/collection before Eryops display', () => {
  let s = migrateRoom1Game(room1BeforeSite2());
  s = travelTo(travelTo(s, { kind: 'site-camp', siteId: 'eryops-dig' }), { kind: 'site-pit', siteId: 'eryops-dig' });
  let state = museumJourney(s);
  // Exercise both layers using the real shovel clock, at every cell centre.
  for (let layer = 0; layer < 2; layer++) for (const cell of ROOM1_ERYOPS_SITE.cells) {
    let swing = null;
    for (let n = 0; n < 40; n++) { const next = stepDigging(state, cell, 0.05, swing, true); state = next.state; swing = next.swing; }
  }
  assert.equal(isUncovered(state, id), true); s = reload(advanceMuseum(s, state) as Room1GameSave);
  assert.equal(purchaseStatus({ ...s, room: 'museum' }, 'stand-walchia'), 'eryopsFirst');
  const incomplete = collectFossil(museumJourney(s), id); assert.equal(incomplete.collected.includes(id), false);
  s = reload(recoverWalchia(travelTo(s, { kind: 'hub' }))); assert.ok(s.collected.includes(id));
  assert.equal(display(s).placed.includes(part), false); assert.equal(room1Complete(s), false); assert.equal(ticketPrice(s), 6);
});
test('partial cleaning survives reload; collection, transport and placement are separate and duplicate-safe', () => {
  let s = threeRoom1Displays(); s = travelTo(travelTo(s, { kind: 'site-camp', siteId: 'eryops-dig' }), { kind: 'site-pit', siteId: 'eryops-dig' });
  s = reload(advanceMuseum(s, brush(museumJourney(s), { x: 0, y: 0 }, { x: 1, y: 0 }, id)) as Room1GameSave);
  assert.ok(s.cleaning[id].length > 0 && s.cleaning[id].length < 336); assert.equal(s.collected.includes(id), false);
  s = reload(recoverWalchia(travelTo(s, { kind: 'hub' }))); assert.equal(s.collected.filter(p => p === id).length, 1);
  assert.equal(collectFossil(museumJourney(s), id).collected.filter(p => p === id).length, 1);
  assert.equal(ticketPrice(s), 10); assert.equal(s.placed.includes(part), false); assert.equal(display(s).placed.includes(part), false);
});
test('helper custody preserves Walchia through delivery, chest, cleaning and collection', () => {
  let s = migrateRoom1Game(room1BeforeSite2());
  // Earn enough via real tickets before hiring; preserve account reconciliation.
  for (let i = 0; i < 10; i++) { s = arriveVisitor(s); s = payVisitor(s, s.visitors.nextId - 1, CASHIER_STATION, true); s = { ...s, visitors: { ...s.visitors, visits: [] } }; s = collectTicketRevenue(s); }
  s = buyHelper(s); s = assignHelper(s, 'eryops-dig');
  s = travelTo(travelTo(s, { kind: 'site-camp', siteId: 'eryops-dig' }), { kind: 'site-pit', siteId: 'eryops-dig' });
  const cells = ROOM1_ERYOPS_SITE.cells.filter(c => c.discoveryId === id), last = cells[1];
  s = advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig, ...Object.fromEntries(ROOM1_ERYOPS_SITE.cells.map(c => [c.id, c.id === last.id ? 0.5 : 1])) } }) as Room1GameSave;
  s = startHelperTask(s, last.id);
  for (let n = 0; n < 160 && !carriedFinds(s).includes(id); n++) s = workHelper(s, last, 0.05);
  assert.ok(carriedFinds(s).includes(id));
  const loaded = parseRoom1Game(JSON.stringify(s), 42)!; assert.ok(loaded); s = settleDeliveries(loaded);
  assert.ok(storedFinds(s).includes(id)); assert.equal(s.collected.includes(id), false);
  s = reload(brushStored(s, id, { x: 0, y: 0 }, { x: 1, y: 0 }));
  for (let y = 0; y <= 1; y += 0.1) s = brushStored(s, id, { x: 0, y }, { x: 1, y });
  s = reload(collectStored(s, id)); assert.ok(s.collected.includes(id)); assert.equal(s.custody[id], undefined);
  assert.equal(collectStored(s, id), s);
});
test('Walchia stand unlocks after valid Eryops display and charges 10 only once', () => {
  const s = threeRoom1Displays(); assert.equal(nextMvpStand(s), 'stand-walchia'); assert.equal(purchaseStatus(s, 'stand-walchia'), 'ready');
  const bought = reload(buyPurchase(s, 'stand-walchia')); assert.equal(bought.economy.coins, s.economy.coins - 10);
  assert.equal(bought.museum.owned.at(-1)!.paid, 10); assert.equal(buyPurchase(bought, 'stand-walchia'), bought);
  assert.equal(ticketPrice(bought), 10); assert.equal(room1Complete(bought), false);
});
test('ten one-coin payments persist once; insufficient funds cannot complete purchase', () => {
  let s = threeRoom1Displays(); const spot = museumLayout(s).purchases.find(p => p.id === 'stand-walchia')!;
  for (let n = 1; n <= 10; n++) { s = reload(contributePurchase(s, 'stand-walchia', spot)); if (n < 10) assert.equal(s.payments.partial['stand-walchia'], n); }
  assert.equal(s.museum.owned.at(-1)!.paid, 10); assert.equal(s.payments.partial['stand-walchia'], undefined);
  assert.equal(contributePurchase(s, 'stand-walchia', spot), s);
  const poor = { ...threeRoom1Displays(), economy: { ...s.economy, coins: 0 } };
  assert.equal(buyPurchase(poor, 'stand-walchia'), poor);
});
test('four valid displays complete Room 1 with price 12, no bonus, room grant or future offer', () => {
  const before = buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia'), after = reload(display(before));
  assert.equal(room1Complete(before), false); assert.equal(room1Complete(after), true); assert.equal(ticketPrice(after), 12);
  assert.equal(after.economy.coins, before.economy.coins); assert.deepEqual(after.rooms, before.rooms);
  assert.deepEqual(displayedExhibits(after), ['dimetrodon', 'trilobite', 'eryops', 'walchia']);
  assert.equal(nextMvpStand(after), undefined); assert.deepEqual(museumLayout(after).purchases, []);
  assert.equal(buyPurchase(after, 'permian-room-2'), after); assert.equal(buyPurchase(after, 'stand-moschops'), after);
});
test('completion transition occurs once; reload, travel and repeated placement do not replay it', () => {
  const before = buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia'), after = display(before);
  assert.ok(room1CompletionTransition(before, after)); assert.equal(room1CompletionTransition(after, reload(after)), false);
  assert.equal(room1CompletionTransition(after, display(after)), false);
  const home = travelTo(travelTo(after, { kind: 'site-camp', siteId: 'eryops-dig' }), { kind: 'hub' });
  assert.equal(room1CompletionTransition(after, home), false);
});
test('missing material, duplicate placement, absent stand or unavailable room prevent Walchia display/completion', () => {
  const s = full();
  for (const bad of [{ ...s, collected: s.collected.filter(p => p !== id) }, { ...s, placed: [...s.placed, part] },
    { ...s, museum: { ...s.museum, owned: s.museum.owned.filter(o => o.id !== 'stand-walchia') } },
    { ...s, rooms: { version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 0 }] } }]) {
    assert.equal(room1Complete(bad as Room1GameSave), false); assert.ok(ticketPrice(bad as Room1GameSave) < 12);
    assert.equal(parseRoom1Game(JSON.stringify(bad), 42), null);
  }
});
test('waiting tickets use 12, previously paid 10 remains locked, cash reconciles and reload does not duplicate', () => {
  let s = buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia');
  s = arriveVisitor(arriveVisitor(s)); s = payVisitor(s, s.visitors.visits[0].id, CASHIER_STATION, true);
  const oldId = s.visitors.visits[0].id; s = display(s); s = reload(payVisitor(s, s.visitors.visits[1].id, CASHIER_STATION, true));
  assert.equal(s.visitors.visits[0].paid, 10); assert.equal(s.pendingTicketRevenue, 22);
  const loaded = loadRoom1Game({ getItem: () => JSON.stringify(s), setItem: () => assert.fail(), removeItem: () => assert.fail() }, 42);
  assert.equal(loaded.kind, 'ready'); if (loaded.kind !== 'ready') return;
  assert.equal(loaded.save.pendingTicketRevenue, 22); assert.equal(payVisitor(loaded.save, oldId, CASHIER_STATION, true), loaded.save);
  const coins = loaded.save.economy.coins, collected = reload(collectTicketRevenue(loaded.save)); assert.equal(collected.economy.coins, coins + 22);
});
for (const operation of ['purchase', 'display', 'collect'] as const) test(`failed Walchia ${operation} commit publishes nothing and retries exactly once`, () => {
  let live = operation === 'purchase' ? threeRoom1Displays() : buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia');
  if (operation === 'collect') {
    live = travelTo(travelTo(threeRoom1Displays(), { kind: 'site-camp', siteId: 'eryops-dig' }), { kind: 'site-pit', siteId: 'eryops-dig' });
    for (let y = 0; y <= 1; y += 0.1) live = advanceMuseum(live, brush(museumJourney(live), { x: 0, y }, { x: 1, y }, id)) as Room1GameSave;
  }
  const original = live; let raw = JSON.stringify(live), fail = true, effects = 0;
  const candidate = operation === 'purchase' ? buyPurchase(live, 'stand-walchia') : operation === 'display' ? display(live)
    : advanceMuseum(live, collectFossil(museumJourney(live), id)) as Room1GameSave;
  const commit = createCommitter<Room1GameSave>({ getItem: () => raw, setItem: (_k, v) => { if (fail) throw Error('quota'); raw = v; }, removeItem: () => { raw = ''; } }, () => {});
  commit.enable(); assert.equal(commit.commit(candidate, s => { live = s; effects++; }), 'failed'); assert.equal(live, original);
  assert.deepEqual(parseRoom1Game(raw, 42), original); fail = false; commit.flush(); commit.flush(); assert.equal(effects, 1); reload(live);
  assert.ok(commit.reset()); commit.commit(createRoom1Game(42), s => { live = s; }); assert.equal(room1Complete(live), false); assert.equal(live.economy.coins, 20); commit.dispose();
});
test('Walchia viewing and player stand marker are reachable without changing room geometry', () => {
  const s = full(), layout = museumLayout(s), positions = viewingPositions('walchia', layout, () => 0.5);
  assert.ok(layout.walchia); assert.ok(positions.length > 0);
  for (const p of positions) { assert.ok(visitorWalkable(p, layout)); assert.ok(visitorPath(VISITOR_DOOR, p, layout).length); assert.ok(visitorPath(p, VISITOR_DOOR, layout).length); }
});
test('corrupt Walchia material/price/custody is rejected without resetting stored data', () => {
  const s = full();
  for (const bad of [{ ...s, cleaning: { [id]: [999] } }, { ...s, collected: [...s.collected, id] },
    { ...s, dig: { ...s.dig, 'eryops-r0-c3': 0 } }, { ...s, custody: { [id]: { siteId: 'courtyard-dig', location: 'storage' } } },
    { ...s, museum: { ...s.museum, owned: s.museum.owned.map(o => o.id === 'stand-walchia' ? { ...o, paid: 0 } : o) } }]) {
    assert.equal(parseRoom1Game(JSON.stringify(bad), 42), null);
    assert.equal(loadRoom1Game({ getItem: () => JSON.stringify(bad), setItem: () => assert.fail(), removeItem: () => assert.fail() }, 42).kind, 'invalid');
  }
});
