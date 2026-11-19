import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCreditSave, migrateCreditSave, syncExpansionCredit } from '../src/game/expansion-credit.ts';
import type { CreditSave } from '../src/game/expansion-credit.ts';
import { createRoomSave, ownedPermianRoomIds } from '../src/game/room-ownership.ts';
import type { RoomSave } from '../src/game/room-ownership.ts';
import { parseCreditSave, loadCreditSave } from '../src/persistence/credit-save.ts';
import { parseRoomSave, loadRoomSave } from '../src/persistence/room-save.ts';
import { parseLedgerSave } from '../src/persistence/ledger-save.ts';
import { creditForInvestment, validExpansionCredit, westWingInvestment } from '../src/persistence/contracts/expansion-credit-v1.ts';
import { buyPurchase, purchaseStatus } from '../src/game/purchases.ts';
import { contributePurchase, createPurchasePaymentSimulation } from '../src/game/purchase-payments.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { createCommitter } from '../src/app/commit.ts';
import type { StoragePort } from '../src/persistence/save.ts';
import { SITE } from '../src/content/journey.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
const room = (value: unknown): RoomSave => { const s = parseRoomSave(JSON.stringify(value), 42); assert.ok(s); return s; };
const parsed = (value: unknown): CreditSave => { const s = parseCreditSave(JSON.stringify(value), 42); assert.ok(s); return s; };
const withoutCredit = ({ expansionCredit: _credit, ...base }: CreditSave): RoomSave => ({ ...base, version: 23 });
const credit = (s: CreditSave, amount: number) => {
  assert.equal(s.version, 24); assert.deepEqual(s.expansionCredit, { version: 1,
    sources: [{ id: 'west-wing', recognized: amount, remaining: amount, consumed: 0 }] });
  assert.ok(validExpansionCredit(s.expansionCredit, westWingInvestment(s)));
  assert.deepEqual(ownedPermianRoomIds(s.rooms), ['permian-room-1']);
};
const port = (raw: string | null): StoragePort => ({ getItem: () => raw,
  setItem: () => assert.fail('Reader wrote storage'), removeItem: () => assert.fail('Reader erased storage') });
function partial(amount: number): RoomSave {
  const s = room(fixtures.deposits21);
  s.economy.coins += 5 - amount;
  if (amount) s.payments.partial['west-wing'] = amount; else delete s.payments.partial['west-wing'];
  return room(s);
}
const spot = (_s: CreditSave) => ({ x: -7, z: 0 });
const contribute = (s: CreditSave) => contributePurchase(s, 'west-wing', spot(s));

test('fresh schema 24 has independent zero credit, initial Room 1 and no extra currency', () => {
  const s = createCreditSave(42), other = createCreditSave(42); credit(s, 0);
  assert.deepEqual(withoutCredit(s), createRoomSave(42));
  assert.notEqual(s.expansionCredit.sources, other.expansionCredit.sources);
  assert.deepEqual(loadCreditSave(port(null), 42), { kind: 'ready', save: s, restored: false, unassigned: false });
  assert.equal(parseRoomSave(JSON.stringify(s), 42), null, 'schema-23 reader stays closed');
  assert.equal(syncExpansionCredit(s), s);
  assert.equal(buyPurchase(s, 'permian-room-2'), s); assert.equal(buyPurchase(s, 'permian-room-3'), s);
});

for (const [name, fixture] of Object.entries(fixtures)) for (const version of ['original', '22', '23'])
  test(`credit migration preserves ${name} (${version}) and repeated loads without new income`, () => {
    const input = version === 'original' ? fixture : version === '22' ? parseLedgerSave(JSON.stringify(fixture), 42) : room(fixture);
    const old = room(input), next = parsed(input); credit(next, westWingInvestment(old));
    assert.deepEqual(withoutCredit(next), old);
    assert.deepEqual(parsed(parsed(next)), next);
    const previous = loadRoomSave(port(JSON.stringify(input)), 42), loaded = loadCreditSave(port(JSON.stringify(input)), 42);
    assert.equal(previous.kind, 'ready'); assert.equal(loaded.kind, 'ready');
    if (previous.kind !== 'ready' || loaded.kind !== 'ready') throw Error('Failed migration');
    assert.deepEqual(loaded, { ...previous, save: migrateCreditSave(previous.save) });
    assert.deepEqual(loadCreditSave(port(JSON.stringify(loaded.save)), 99), loaded);
  });

test('all supported schema numbers 1-23 remain loadable through unmodified historical readers', () => {
  for (let version = 1; version <= 23; version++) {
    let old: Record<string, unknown>;
    if (version <= 12) {
      old = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
      if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = [];
      if (version >= 8) old.activeSiteId = SITE.id;
    } else if (version >= 22) old = version === 23 ? { ...createRoomSave(42) } : { ...parseLedgerSave(JSON.stringify(fixtures.fresh21), 42)! };
    else {
      old = { ...fixtures.fresh21, version };
      for (const [minimum, field] of [[14, 'museum'], [15, 'world'], [16, 'visitors'], [17, 'helpers'],
        [18, 'custody'], [19, 'upgrades'], [20, 'payments'], [21, 'pendingTicketRevenue']] as const)
        if (version < minimum) delete old[field];
    }
    assert.deepEqual(parsed(old), migrateCreditSave(room(old)));
  }
});

test('paid wing recognizes exactly 18, legacy recognizes zero, every partial amount retains original evidence', () => {
  const paid = parsed(fixtures.managed21), legacy = parsed(fixtures.legacy12);
  credit(paid, 18); credit(legacy, 0);
  assert.deepEqual(paid.museum.owned.find(p => p.id === 'west-wing'), { id: 'west-wing', source: 'purchase', paid: 18 });
  assert.deepEqual(legacy.museum.owned.find(p => p.id === 'west-wing'), { id: 'west-wing', source: 'legacy', paid: 0 });
  for (let amount = 0; amount < 18; amount++) {
    const before = partial(amount), after = parsed(before); credit(after, amount);
    assert.deepEqual(withoutCredit(after), before); assert.equal(purchaseStatus(after, 'west-wing'), 'unknown');
  }
});

test('historical payments 7 to 18 still migrate with exact credit; current Room 1 cannot add wing payments', () => {
  let old = partial(7);
  for (let amount = 8; amount <= 18; amount++) {
    old = contributePurchase(old, 'west-wing', { x: -7, z: 0 });
    const current = parsed(old); credit(current, amount);
    assert.deepEqual(withoutCredit(current), old);
    assert.equal(contribute(current), current);
    assert.equal(buyPurchase(current, 'west-wing'), current);
    assert.deepEqual(parsed(current), current);
  }
});

for (const amount of [0, 7, 10, 17]) test(`retired wing preserves ${amount} deposit without a refund or new purchase`, () => {
  const old = partial(amount), s = parsed(old);
  assert.equal(buyPurchase(s, 'west-wing'), s); assert.equal(contribute(s), s);
  credit(s, amount); assert.deepEqual(parsed(s), s);
  // Full historical purchases remain readable and retain their original cost.
  const completed = parsed(buyPurchase(old, 'west-wing'));
  credit(completed, 18);
});

test('unrelated stand deposits and completion preserve west-wing credit without counting other spending', () => {
  const s = parsed(partial(7)), location = museumLayout(s).purchases.find(p => p.id === 'stand-trilobite')!;
  const next = contributePurchase(s, 'stand-trilobite', location);
  assert.notEqual(next, s); assert.equal(next.expansionCredit, s.expansionCredit); credit(next, 7);
  assert.deepEqual(withoutCredit(next), contributePurchase(withoutCredit(s), 'stand-trilobite', location));
  const complete = buyPurchase(next, 'stand-trilobite'); assert.notEqual(complete, next);
  assert.equal(complete.expansionCredit, s.expansionCredit); credit(complete, 7);
  assert.equal(complete.payments.partial['stand-trilobite'], undefined);
  assert.deepEqual(withoutCredit(complete), buyPurchase(withoutCredit(next), 'stand-trilobite'));
  assert.deepEqual(parsed(complete), complete);
});

test('payment timing and no-op guards do not recognize unaccepted contributions', () => {
  const s = parsed(partial(7)), simulation = createPurchasePaymentSimulation();
  assert.equal(contributePurchase(s, 'west-wing', { x: 999, z: 999 }), s);
  assert.equal(contributePurchase(s, 'unknown', spot(s)), s);
  assert.equal(simulation.step(s, spot(s), 0.05, false), s);
  assert.equal(simulation.step(s, spot(s), 0.05, true), s);
  simulation.reset();
  let current = s;
  for (let n = 0; n < 100 && current === s; n++) current = simulation.step(s, spot(s), 0.05, true);
  assert.equal(current, s); credit(current, 7); assert.deepEqual(parsed(current), current);
  const exhausted = { ...current, economy: { ...current.economy, coins: 0 } };
  assert.equal(contribute(exhausted), exhausted); assert.equal(buyPurchase(exhausted, 'west-wing'), exhausted);
});

const source = { id: 'west-wing', recognized: 7, remaining: 7, consumed: 0 };
const invalid: [string, unknown][] = [
  ['missing', undefined], ['null', null], ['array', []], ['empty', {}], ['future version', { version: 2, sources: [source] }],
  ['unknown field', { version: 1, sources: [source], bonus: 1 }], ['no sources', { version: 1, sources: [] }],
  ['sources object', { version: 1, sources: source }], ['duplicate sources', { version: 1, sources: [source, source] }],
  ['null source', { version: 1, sources: [null] }],
  ...Object.entries({ unknown: { id: 'other-wing' }, negative: { recognized: -1 }, fractional: { remaining: 6.5 },
    unsafe: { recognized: Number.MAX_SAFE_INTEGER + 1 }, inflated: { recognized: 8, remaining: 8 },
    stale: { recognized: 6, remaining: 6 }, overCap: { recognized: 19, remaining: 19 },
    consumed: { remaining: 6, consumed: 1 }, overConsumed: { consumed: 8 }, negativeConsumed: { consumed: -1 },
    stringAmount: { recognized: '7' }, unknownSourceField: { bonus: 0 }, missingRemaining: { remaining: undefined },
    missingConsumed: { consumed: undefined }, fractionalConsumed: { consumed: 0.5 }, unsafeRemaining: { remaining: 1e30 },
  }).map(([name, changes]) => [name, { version: 1, sources: [{ ...source, ...changes }] }] as [string, unknown]),
];
for (const [name, expansionCredit] of invalid) test(`invalid credit rejects ${name} without storage mutation`, () => {
  const raw = JSON.stringify({ ...parsed(partial(7)), expansionCredit });
  assert.equal(parseCreditSave(raw, 42), null); assert.deepEqual(loadCreditSave(port(raw), 42), { kind: 'invalid' });
});

test('credit cannot weaken financial, room, receipt or partial-payment validation', () => {
  const s = parsed(partial(7)), paid = parsed(fixtures.managed21), legacy = parsed(fixtures.legacy12);
  const receipt = { id: 'west-wing', source: 'purchase', paid: 18 };
  const bad = [
    { ...s, version: 25 }, { ...s, extra: true }, { ...s, expansionCredit: undefined },
    { ...s, economy: { ...s.economy, coins: s.economy.coins + 7 } },
    { ...s, pendingTicketRevenue: s.pendingTicketRevenue + 7 },
    { ...s, rooms: { version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 7 }] } },
    { ...s, museum: { version: 1, owned: [...s.museum.owned, receipt] } },
    { ...paid, payments: { version: 1, partial: { 'west-wing': 7 } } },
    { ...paid, expansionCredit: creditForInvestment(17) }, { ...legacy, expansionCredit: creditForInvestment(18) },
    { ...paid, museum: { version: 1, owned: [...paid.museum.owned, receipt] } },
    { ...s, payments: { version: 1, partial: { 'west-wing': 18 } }, expansionCredit: creditForInvestment(18) },
    { ...withoutCredit(s), expansionCredit: s.expansionCredit },
  ];
  for (const value of bad) assert.equal(parseCreditSave(JSON.stringify(value), 42), null);
  for (const raw of ['{', 'null', '[]']) assert.deepEqual(loadCreditSave(port(raw), 42), { kind: 'invalid' });
  assert.deepEqual(loadCreditSave({ ...port(null), getItem() { throw Error('unavailable'); } }, 42), { kind: 'unavailable' });
});

for (const kind of ['migration', 'partial', 'last-coin', 'full-buy'] as const)
  test(`failed ${kind} write retains payment and credit together; retry publishes one frozen candidate`, () => {
    const old = partial(kind === 'last-coin' ? 17 : 7); let live = parsed(old);
    let raw = JSON.stringify(kind === 'migration' ? old : live), fail = true, effects = 0, writes = 0;
    const storage: StoragePort = { getItem: () => raw, setItem: (_, value) => {
      if (fail) throw Error('quota'); writes++; raw = value;
    }, removeItem: () => { raw = ''; } };
    const committer = createCommitter<CreditSave>(storage, () => {}); committer.enable();
    try {
      const original = raw, originalLive = structuredClone(live);
      // Exercise interrupted migration of historical evidence at every payment boundary.
      const historical = kind === 'migration' ? old : kind === 'full-buy' ? buyPurchase(old, 'west-wing')
        : contributePurchase(old, 'west-wing', { x: -7, z: 0 });
      const candidate = parsed(historical);
      const expected = structuredClone(candidate);
      assert.equal(committer.commit(candidate, saved => { live = saved; effects++; }), 'failed');
      assert.equal(raw, original); assert.deepEqual(live, originalLive); assert.equal(effects, 0);
      const reloaded = loadCreditSave(port(raw), 42); assert.equal(reloaded.kind, 'ready');
      if (reloaded.kind !== 'ready') throw Error('Interrupted save failed to reload');
      assert.deepEqual(reloaded.save.expansionCredit, originalLive.expansionCredit);
      assert.deepEqual(reloaded.save.payments, originalLive.payments);
      assert.deepEqual(reloaded.save.museum, originalLive.museum);
      assert.equal(reloaded.save.economy.coins, originalLive.economy.coins);
      candidate.expansionCredit.sources[0].recognized = 18;
      assert.equal(committer.commit(contribute(live), () => assert.fail('duplicate commit')), 'blocked');
      fail = false; assert.equal(committer.flush(), 'saved'); assert.equal(committer.flush(), 'idle');
      assert.equal(writes, 1); assert.equal(effects, 1); assert.deepEqual(live, expected); assert.deepEqual(parsed(JSON.parse(raw)), expected);
      credit(live, westWingInvestment(live));
      assert.ok(committer.checkpoint(live)); assert.equal(committer.flush(), 'saved'); assert.deepEqual(parsed(JSON.parse(raw)), expected);
      fail = true; committer.commit(createCreditSave(99), () => assert.fail('reset must discard pending write'));
      fail = false; assert.ok(committer.reset());
      assert.equal(committer.commit(createCreditSave(42), saved => { live = saved; }), 'saved');
      credit(live, 0); assert.deepEqual(parsed(JSON.parse(raw)), createCreditSave(42));
    } finally { committer.dispose(); }
  });
