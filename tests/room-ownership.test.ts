import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRoomSave, migrateRoomSave, ownedPermianRoomIds, isPermianRoomOwned } from '../src/game/room-ownership.ts';
import type { RoomSave } from '../src/game/room-ownership.ts';
import { migrateCreditSave } from '../src/game/expansion-credit.ts';
import type { CreditSave } from '../src/game/expansion-credit.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { creditForInvestment, westWingInvestment } from '../src/persistence/contracts/expansion-credit-v1.ts';
import { ROOM_DEFINITIONS_V1 } from '../src/persistence/contracts/rooms-v1.ts';
import { parseRoomSave, loadRoomSave } from '../src/persistence/room-save.ts';
import { parseLedgerSave, loadLedgerSave } from '../src/persistence/ledger-save.ts';
import type { LedgerSave } from '../src/game/ticket-ledger.ts';
import { createLedgerSave, ledgerTotals } from '../src/game/ticket-ledger.ts';
import { PERMIAN_ROOMS } from '../src/content/permian-museum.ts';
import { permianRoomStatus } from '../src/game/permian-rooms.ts';
import { createCommitter } from '../src/app/commit.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import type { StoragePort } from '../src/persistence/save.ts';
import { advanceMuseum, museumJourney, economyOf, buyPurchase, placeOwnedGroup } from '../src/game/purchases.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { collectTicketRevenue } from '../src/game/cash.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { buySite, travelTo } from '../src/game/world-map.ts';
import { buyHelper, assignHelper, startHelperTask, workHelper, pauseHelper } from '../src/game/helpers.ts';
import { buyUpgrade } from '../src/game/upgrades.ts';
import { depositAtBox, brushStored, collectStored } from '../src/game/storage.ts';
import { freshJourney, digAt, brush, collectFossil } from '../src/game/journey.ts';
import { createGameSave } from '../src/game/economy.ts';
import { SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { FIRST_PARTS } from '../src/content/exhibit.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { storageApproach } from '../src/content/storage.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
const port = (raw: string | null): StoragePort => ({ getItem: () => raw,
  setItem: () => assert.fail('Reader wrote storage'), removeItem: () => assert.fail('Reader reset storage') });
const ledger = (value: unknown): LedgerSave => { const s = parseLedgerSave(JSON.stringify(value), 42); assert.ok(s); return s; };
const parsed = (value: unknown): RoomSave => { const s = parseRoomSave(JSON.stringify(value), 42); assert.ok(s); return s; };
const withoutRooms = ({ rooms: _rooms, ...base }: RoomSave): LedgerSave => ({ ...base, version: 22 });
function defaults(s: RoomSave) {
  assert.equal(s.version, 23); assert.deepEqual(s.rooms, { version: 1, owned: [] });
  assert.deepEqual(ownedPermianRoomIds(s.rooms), ['permian-room-1']);
  assert.equal(isPermianRoomOwned(s.rooms, 'permian-room-2'), false);
  assert.equal(isPermianRoomOwned(s.rooms, 'permian-room-3'), false);
}

test('fresh room contract derives only initial Room 1, with isolated defaults and unchanged schema-22 history', () => {
  const fresh = createRoomSave(42), another = createRoomSave(42); defaults(fresh);
  assert.notEqual(fresh.rooms, another.rooms); assert.notEqual(fresh.rooms.owned, another.rooms.owned);
  assert.deepEqual(withoutRooms(fresh), createLedgerSave(42));
  assert.deepEqual(loadRoomSave(port(null), 42), { kind: 'ready', save: fresh, restored: false, unassigned: false });
  assert.equal(parseLedgerSave(JSON.stringify(fresh), 42), null, 'historical schema 22 stays closed');
  assert.equal(isPermianRoomOwned(fresh.rooms, 'unknown-room'), false);
  assert.deepEqual(ROOM_DEFINITIONS_V1, PERMIAN_ROOMS.map(({ id, initiallyAvailable }) => ({ id, initiallyAvailable })));
  assert.ok(Object.isFrozen(ROOM_DEFINITIONS_V1)); assert.ok(ROOM_DEFINITIONS_V1.every(Object.isFrozen));
});

for (const [name, fixture] of Object.entries(fixtures)) for (const from22 of [false, true])
  test(`room migration preserves complete ${name} snapshot${from22 ? ' via schema 22' : ''}`, () => {
    const old = ledger(fixture), input = from22 ? old : fixture;
    const next = parsed(input); defaults(next);
    assert.deepEqual(withoutRooms(next), old);
    assert.deepEqual(ledgerTotals(next.visitors.sales), ledgerTotals(old.visitors.sales));
    assert.deepEqual(parsed(next), next); assert.deepEqual(parsed(parsed(next)), next);
    const priorLoad = loadLedgerSave(port(JSON.stringify(input)), 42); assert.equal(priorLoad.kind, 'ready');
    if (priorLoad.kind !== 'ready') throw Error('Old load failed');
    const loaded = loadRoomSave(port(JSON.stringify(input)), 42); assert.equal(loaded.kind, 'ready');
    if (loaded.kind !== 'ready') throw Error('New load failed');
    assert.deepEqual(loaded, { ...priorLoad, save: migrateRoomSave(priorLoad.save) });
    assert.deepEqual(loadRoomSave(port(JSON.stringify(loaded.save)), 99), loaded);
  });

test('every supported schema 1-22 migrates through the original chain to strict schema 23', () => {
  for (let version = 1; version <= 22; version++) {
    let old: Record<string, unknown>;
    if (version <= 12) {
      old = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
      if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = [];
      if (version >= 8) old.activeSiteId = SITE.id;
    } else if (version === 22) old = { ...createLedgerSave(42) };
    else {
      old = { ...fixtures.fresh21, version };
      for (const [minimum, field] of [[14, 'museum'], [15, 'world'], [16, 'visitors'], [17, 'helpers'],
        [18, 'custody'], [19, 'upgrades'], [20, 'payments'], [21, 'pendingTicketRevenue']] as const)
        if (version < minimum) delete old[field];
    }
    const next = parsed(old); defaults(next); assert.deepEqual(next, migrateRoomSave(ledger(old)));
  }
});

test('paid 18-coin wing, zero-paid legacy wing and partial contributions never become rooms or credits', () => {
  const paid = parsed(fixtures.managed21), legacy = parsed(fixtures.legacy12), partial = parsed(fixtures.deposits21);
  assert.deepEqual(paid.museum.owned.find(r => r.id === 'west-wing'), { id: 'west-wing', source: 'purchase', paid: 18 });
  assert.deepEqual(legacy.museum.owned.find(r => r.id === 'west-wing'), { id: 'west-wing', source: 'legacy', paid: 0 });
  assert.equal(partial.payments.partial['west-wing'], 5);
  for (const s of [paid, legacy, partial]) { defaults(s); assert.deepEqual(Object.keys(s.rooms).sort(), ['owned', 'version']); }
  for (let amount = 1; amount < 18; amount++) {
    const old = ledger(fixtures.deposits21); old.economy.coins += 5 - amount; old.payments.partial['west-wing'] = amount;
    assert.equal(parsed(old).payments.partial['west-wing'], amount); assert.deepEqual(withoutRooms(parsed(old)), old);
  }
});

test('pure completion and purchase eligibility cannot mutate persisted room ownership', () => {
  const s = createRoomSave(42), room = PERMIAN_ROOMS[0], before = JSON.stringify(s);
  const definitions = { exhibits: room.requiredExhibitIds.map(id => ({ id, requiredPartIds: ['test-part'] })),
    stands: room.requiredExhibitIds.map(id => ({ id: `test-${id}`, roomId: room.id, exhibitId: id })) };
  const progress = { unlockedRoomIds: ownedPermianRoomIds(s.rooms), ownedStandIds: definitions.stands.map(s => s.id),
    exhibits: room.requiredExhibitIds.map(id => ({ id, assembledPartIds: ['test-part'], displayedOnStandId: `test-${id}` })) };
  assert.equal(permianRoomStatus(room.id, progress, definitions), 'completed');
  assert.equal(permianRoomStatus('permian-room-2', progress, definitions), 'eligible-for-purchase');
  assert.equal(JSON.stringify(s), before); defaults(s);
  assert.equal(buyPurchase(s, 'permian-room-2'), s); assert.equal(buyPurchase(s, 'permian-room-3'), s);
});

const invalidRooms: [string, unknown][] = [
  ['missing', undefined], ['null', null], ['array', []], ['scalar', 1], ['missing owned', { version: 1 }],
  ['missing version', { owned: [] }], ['future version', { version: 2, owned: [] }], ['owned object', { version: 1, owned: {} }],
  ['completion flag', { version: 1, owned: [], completed: true }], ['credit', { version: 1, owned: [], credit: 18 }],
  ['partial payments', { version: 1, owned: [], partial: {} }],
  ...['permian-room-1', 'permian-room-2', 'permian-room-3', 'unknown-room'].map(id =>
    [`unverified receipt ${id}`, { version: 1, owned: [{ id, source: 'purchase', paid: 18 }] }] as [string, unknown]),
  ['free grant', { version: 1, owned: [{ id: 'permian-room-2', source: 'legacy', paid: 0 }] }],
  ['duplicate receipts', { version: 1, owned: Array(2).fill({ id: 'permian-room-2', source: 'purchase', paid: 18 }) }],
  ['string ID', { version: 1, owned: ['permian-room-2'] }], ['malformed receipt', { version: 1, owned: [null] }],
];
for (const [name, rooms] of invalidRooms) test(`strict room reader rejects ${name} without altering storage`, () => {
  const raw = JSON.stringify({ ...createRoomSave(42), rooms });
  assert.equal(parseRoomSave(raw, 42), null); assert.deepEqual(loadRoomSave(port(raw), 42), { kind: 'invalid' });
});
test('room envelope does not weaken finances, root field checks or future-schema rejection', () => {
  const s = createRoomSave(42);
  for (const value of [{ ...s, version: 24 }, { ...s, extra: 0 }, { ...s, economy: { ...s.economy, coins: 21 } },
    { ...s, pendingTicketRevenue: 1 }, { ...withoutRooms(s), rooms: s.rooms }]) assert.equal(parseRoomSave(JSON.stringify(value), 42), null);
  for (const raw of ['{', 'null', '[]']) assert.deepEqual(loadRoomSave(port(raw), 42), { kind: 'invalid' });
  assert.deepEqual(loadRoomSave({ ...port(null), getItem() { throw Error('unavailable'); } }, 42), { kind: 'unavailable' });
  assert.deepEqual(ownedPermianRoomIds({ version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 18 }] }), []);
});

// Compare actual schema-23 commands with the same command on validated schema
// 22. Require a real change, and validate both results, so no-op checks cannot
// accidentally stand in for exercising reconstruction paths.
type Command = (s: LedgerSave | RoomSave | CreditSave) => LedgerSave | RoomSave | CreditSave;
function transition(s: LedgerSave, command: Command, historicalOnly = false): LedgerSave {
  const current = migrateRoomSave(s), expected = command(s), actual = command(current) as RoomSave;
  assert.notDeepEqual(expected, s, 'command must exercise a real transition');
  defaults(actual); assert.equal(actual.rooms, current.rooms, 'room envelope is carried through, not replaced');
  assert.deepEqual(withoutRooms(actual), expected); assert.deepEqual(withoutRooms(parsed(actual)), ledger(expected));
  assert.ok(!('rooms' in museumJourney(actual))); assert.ok(!('rooms' in economyOf(actual)));
  // Reuse the actual transition scenarios for the credit schema as well. Older
  // expectations remain unchanged; only accepted wing payments change credit.
  if (historicalOnly) return expected as LedgerSave;
  const credited = migrateCreditSave(current), creditActual = command(credited) as CreditSave;
  const { expansionCredit, ...roomState } = creditActual;
  assert.equal(creditActual.version, 24);
  assert.deepEqual({ ...roomState, version: 23 }, actual);
  assert.equal(creditActual.rooms, credited.rooms);
  assert.deepEqual(expansionCredit, creditForInvestment(westWingInvestment(actual)));
  if (westWingInvestment(actual) === westWingInvestment(current)) assert.equal(expansionCredit, credited.expansionCredit);
  assert.ok(parseCreditSave(JSON.stringify(creditActual), 42));
  assert.ok(!('expansionCredit' in museumJourney(creditActual))); assert.ok(!('expansionCredit' in economyOf(creditActual)));
  return expected as LedgerSave;
}
test('room state survives travel, digging, cleaning, manual collection, stand buying and assembly', () => {
  let s = createLedgerSave(42);
  s = transition(s, s => travelTo(s, { kind: 'site-camp', siteId: SITE.id }));
  s = transition(s, s => travelTo(s, { kind: 'site-pit', siteId: SITE.id }));
  s = transition(s, s => advanceMuseum(s, digAt(museumJourney(s), SITE.cells[0])) as LedgerSave | RoomSave);
  const find = 'bone-study-head';
  s = transition(s, s => advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig,
    ...Object.fromEntries(SITE.cells.filter(c => c.discoveryId === find).map(c => [c.id, 1])) } }) as LedgerSave | RoomSave);
  s = transition(s, s => advanceMuseum(s, brush(museumJourney(s), { x: 0.2, y: 0.4 }, { x: 0.6, y: 0.4 }, find)) as LedgerSave | RoomSave);
  s = transition(s, s => {
    let journey = museumJourney(s);
    for (let row = 0; row < 14; row++) journey = brush(journey, { x: 0, y: (row + 0.5) / 14 }, { x: 1, y: (row + 0.5) / 14 }, find);
    return advanceMuseum(s, journey) as LedgerSave | RoomSave;
  });
  s = transition(s, s => advanceMuseum(s, collectFossil(museumJourney(s), find)) as LedgerSave | RoomSave);
  s = transition(s, s => travelTo(s, { kind: 'hub' }));
  s = transition(s, s => buyPurchase(s, 'stand-dimetrodon'));
  s = transition(s, s => advanceMuseum(s, placeOwnedGroup(s, 'dimetrodon', 'skull', 'skull')) as LedgerSave | RoomSave);
  assert.ok(s.placed.includes('skull'));
});
test('room state survives existing west-wing contributions and completion while Walchia remains absent', () => {
  let s = ledger(fixtures.deposits21);
  const spot = museumLayout(s).purchases.find(p => p.id === 'west-wing')!;
  s = transition(s, s => contributePurchase(s, 'west-wing', spot), true);
  s = transition(s, s => buyPurchase(s, 'west-wing'), true);
  assert.equal(s.museum.owned.find(p => p.id === 'west-wing')!.paid, 18);
  assert.equal(s.payments.partial['west-wing'], undefined);
});
test('room state survives ticket payment, cash collection and paid site purchase', () => {
  let s = ledger(fixtures.deposits21);
  s = transition(s, collectTicketRevenue);
  s = transition(s, s => payVisitor(s, 5, CASHIER_STATION, true));
  s = transition(s, collectTicketRevenue);
  for (let n = 0; n < 2; n++) {
    s = transition(s, arriveVisitor); const id = s.visitors.nextId - 1;
    s = transition(s, s => payVisitor(s, id, CASHIER_STATION, true)); s = transition(s, collectTicketRevenue);
  }
  s = transition(s, s => buySite(s, ERYOPS_SITE.id));
  assert.deepEqual(s.world.owned, [{ id: ERYOPS_SITE.id, source: 'purchase', paid: 24 }]);
});
test('room state survives helper hire/work, upgrades and partial-task travel/reload', () => {
  let s = ledger(createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: FIRST_PARTS.map(p => p.id) }, 42));
  for (let i = 0; i < 40; i++) {
    s = arriveVisitor(s); const id = s.visitors.nextId - 1;
    s = finishVisit(payVisitor(s, id, CASHIER_STATION, true), id);
  }
  s = collectTicketRevenue(s); assert.ok(ledger(s));
  s = transition(s, buyHelper);
  for (const id of ['boots', 'shovel', 'helper-tools']) s = transition(s, s => buyUpgrade(s, id));
  s = transition(s, s => assignHelper(s, ERYOPS_SITE.id));
  s = transition(s, s => travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }));
  s = transition(s, s => travelTo(s, { kind: 'site-pit', siteId: ERYOPS_SITE.id }));
  const cell = ERYOPS_SITE.cells[0];
  s = transition(s, s => startHelperTask(s, cell.id));
  s = transition(s, s => workHelper(s, cell, 0.05));
  s = transition(s, pauseHelper);
  s = transition(s, s => travelTo(s, { kind: 'hub' }));
  assert.ok(parsed(migrateRoomSave(s)).helpers.owned[0].task!.work > 0);
  s = transition(s, s => travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }));
  s = transition(s, s => travelTo(s, { kind: 'site-pit', siteId: ERYOPS_SITE.id }));
  s = transition(s, s => { for (let i = 0; i < 200 && s.helpers.owned[0].task; i++) s = workHelper(s, cell, 0.05); return s; });
  assert.equal(s.dig[cell.id], 0.5);
});
test('room state survives original-site delivery, storage cleaning and manual storage collection', () => {
  let s = ledger(fixtures.managed21);
  s = transition(s, s => depositAtBox(s, storageApproach(s)));
  const id = 'eryops-skull-find';
  s = transition(s, s => brushStored(s, id, { x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 }));
  s = transition(s, s => { for (let row = 0; row < 14; row++) s = brushStored(s, id, { x: 0, y: (row + 0.5) / 14 }, { x: 1, y: (row + 0.5) / 14 }); return s; });
  s = transition(s, s => collectStored(s, id)); assert.ok(s.collected.includes(id)); assert.equal(s.custody[id], undefined);
});

for (const kind of ['migration', 'wing', 'ticket', 'cash'] as const) test(`failed ${kind} commit freezes room state and retry publishes once; reset discards pending work`, () => {
  const old = ledger(fixtures.deposits21); let live = migrateRoomSave(old);
  let raw: string | null = JSON.stringify(kind === 'migration' ? old : live), fail = true, effects = 0;
  const storage: StoragePort = { getItem: () => raw, setItem: (_, value) => { if (fail) throw Error('quota'); raw = value; }, removeItem: () => { raw = null; } };
  const committer = createCommitter<RoomSave>(storage, () => {}); committer.enable();
  try {
    const candidate = kind === 'migration' ? parsed(old) : kind === 'wing' ? buyPurchase(live, 'west-wing')
      : kind === 'ticket' ? payVisitor(live, 5, CASHIER_STATION, true) : collectTicketRevenue(live);
    const expected = structuredClone(candidate), prior = raw;
    assert.equal(committer.commit(candidate, saved => { live = saved; effects++; }), 'failed');
    assert.equal(raw, prior); assert.equal(effects, 0);
    candidate.rooms.owned.push({ id: 'permian-room-2', source: 'purchase', paid: 18 });
    assert.equal(committer.commit(candidate, () => assert.fail('duplicate publish')), 'blocked');
    fail = false; assert.equal(committer.flush(), 'saved'); assert.equal(committer.flush(), 'idle');
    assert.equal(effects, 1); assert.deepEqual(live, expected); assert.deepEqual(parsed(JSON.parse(raw!)), expected); defaults(live);
    assert.ok(committer.checkpoint(live)); committer.flush(); defaults(parsed(JSON.parse(raw!)));
    fail = true; committer.commit(createRoomSave(99), () => assert.fail('reset must discard failed candidate'));
    fail = false; assert.ok(committer.reset());
    assert.equal(committer.commit(createRoomSave(42), saved => { live = saved; }), 'saved');
    assert.deepEqual(live, createRoomSave(42)); defaults(parsed(JSON.parse(raw!)));
  } finally { committer.dispose(); }
});
