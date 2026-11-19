import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCommitter } from '../src/app/commit.ts';
import { createCashSave, collectTicketRevenue } from '../src/game/cash.ts';
import type { CashSave } from '../src/game/cash.ts';
import { advanceMuseum, museumJourney, buyPurchase, displayedExhibits, placeOwnedGroup } from '../src/game/purchases.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { payVisitor } from '../src/game/visitors.ts';
import { travelTo, buySite } from '../src/game/world-map.ts';
import { buyHelper } from '../src/game/helpers.ts';
import { buyUpgrade } from '../src/game/upgrades.ts';
import { collectStored } from '../src/game/storage.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { parseCashSave, loadCashSave } from '../src/persistence/cash-save.ts';
import { parseSave, SAVE_KEY } from '../src/persistence/save.ts';
import type { StoragePort } from '../src/persistence/save.ts';
import { parseMuseumSave } from '../src/persistence/museum-save.ts';
import { parseUpgradeSave } from '../src/persistence/upgrade-save.ts';
import { parsePaymentSave } from '../src/persistence/payment-save.ts';

// Frozen inputs, never rebuilt from current constructors/content during tests.
// Historical entries are checked with their own readers before migration.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
const currentNames = ['fresh21', 'dig21', 'assembly21', 'deposits21', 'managed21'] as const;
const current = (name: typeof currentNames[number]): CashSave => structuredClone(fixtures[name]);
function readOnly(raw: string | null): StoragePort {
  return {
    getItem(key) { assert.equal(key, SAVE_KEY); return raw; },
    setItem() { assert.fail('Loading must not overwrite the source save'); },
    removeItem() { assert.fail('Loading must not delete the source save'); },
  };
}
function load(raw: string, seed = 987654321): CashSave {
  const result = loadCashSave(readOnly(raw), seed);
  assert.equal(result.kind, 'ready');
  if (result.kind !== 'ready') throw Error('Save did not load');
  assert.equal(result.restored, true);
  assert.equal(result.unassigned, false);
  return result.save;
}
const reload = (s: CashSave) => load(JSON.stringify(s));

for (const name of currentNames) test(`baseline: ${name} parses exactly and repeated loads preserve its durable state`, () => {
  const original = current(name), raw = JSON.stringify(original);
  assert.deepEqual(parseCashSave(raw, 987654321), original, 'persisted seed/manifests must win over the new-session seed');
  const expected = structuredClone(original);
  expected.visitors.visits = expected.visitors.visits.filter(v => v.paid === 0);
  for (const [id, custody] of Object.entries(expected.custody)) {
    if (custody.location === 'delivery') expected.custody[id] = { siteId: custody.siteId, location: 'storage' };
  }
  let loaded = load(raw);
  assert.deepEqual(loaded, expected, 'only paid visitor retirement and original-site delivery recovery are expected');
  for (let i = 0; i < 3; i++) {
    loaded = reload(loaded);
    assert.deepEqual(loaded, expected, 'reload must not grant income, rewards, ownership or collected finds');
    assert.deepEqual(advanceMuseum(loaded, museumJourney(loaded)), loaded, 'replaying retained soil must not pay again');
  }
});

test('baseline: fresh save and absent storage start with exactly 20 coins and no entitlements', () => {
  const expected = current('fresh21');
  assert.deepEqual(createCashSave(42), expected);
  assert.deepEqual(loadCashSave(readOnly(null), 42), { kind: 'ready', save: expected, restored: false, unassigned: false });
  assert.equal(expected.economy.coins, 20); assert.equal(expected.pendingTicketRevenue, 0);
  assert.deepEqual(expected.museum.owned, []); assert.deepEqual(expected.world.owned, []);
  assert.deepEqual(expected.helpers.owned, []); assert.deepEqual(expected.upgrades.owned, []);
});

test('baseline: partial digging retains half a tile, one claimed reward and the saved manifest', () => {
  const s = reload(current('dig21'));
  assert.deepEqual(s.dig, { 'courtyard-r0-c0': 0.5, 'courtyard-r1-c3': 1 });
  assert.equal(s.economy.coins, 21);
  assert.deepEqual(s.economy.sites['courtyard-dig'].claimed, ['courtyard-dig/v1/courtyard-r1-c3/0']);
  assert.deepEqual(s.closedSites, []); assert.deepEqual(s.collected, []);
});

test('baseline: collected inventory and partial assembly remain distinct from site closure and stand deposits', () => {
  const s = reload(current('assembly21'));
  assert.equal(s.collected.length, 7); assert.deepEqual(s.placed, ['skull', 'spine-sail']);
  assert.deepEqual(s.closedSites, ['courtyard-dig']); assert.deepEqual(displayedExhibits(s), []);
  assert.deepEqual(s.museum.owned, [{ id: 'stand-dimetrodon', source: 'purchase', paid: 12 }]);
  assert.deepEqual(s.payments.partial, { 'stand-trilobite': 2 }); assert.equal(s.economy.coins, 15);
  assert.deepEqual(advanceMuseum(s, placeOwnedGroup(s, 'dimetrodon', 'skull', 'skull')), s);
  const next = reload(advanceMuseum(s, placeOwnedGroup(s, 'dimetrodon', 'ribs', 'ribs')) as CashSave);
  assert.deepEqual(next.placed, ['skull', 'spine-sail', 'ribs']);
  assert.deepEqual(next.collected, s.collected); assert.deepEqual(next.economy, s.economy);
});

test('baseline: separate partial purchases and active ticket history retain exact balances', () => {
  const original = current('deposits21'), s = reload(original);
  assert.deepEqual(s.payments.partial, { 'stand-trilobite': 2, 'west-wing': 5 });
  assert.equal(s.museum.owned.some(r => r.id === 'west-wing'), false);
  assert.deepEqual(displayedExhibits(s), ['dimetrodon']);
  assert.equal(s.economy.coins, 16); assert.equal(s.pendingTicketRevenue, 2);
  assert.deepEqual(s.visitors.sales, [4, 0, 0]); assert.equal(s.visitors.nextId, 6);
  assert.deepEqual(original.visitors.visits, [{ id: 4, paid: 2 }, { id: 5, paid: 0 }]);
  assert.deepEqual(s.visitors.visits, [{ id: 5, paid: 0 }]);
  assert.equal(payVisitor(s, 4, CASHIER_STATION, true), s, 'retired visitor cannot repay');
  const collected = reload(collectTicketRevenue(s));
  assert.equal(collected.economy.coins, 18); assert.equal(collected.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(collected), collected);
  assert.deepEqual(collected.visitors, s.visitors);
});

test('baseline: paid wing, stands, site two, helper, original-site custody and all upgrades survive together', () => {
  const original = current('managed21'), s = reload(original);
  assert.equal(s.economy.coins, 77); assert.equal(s.pendingTicketRevenue, 6);
  assert.deepEqual(s.visitors.sales, [3, 82, 0]);
  assert.deepEqual(displayedExhibits(s), ['dimetrodon', 'trilobite']);
  assert.deepEqual(s.museum.owned, [
    { id: 'stand-dimetrodon', source: 'purchase', paid: 12 },
    { id: 'stand-trilobite', source: 'purchase', paid: 8 },
    { id: 'west-wing', source: 'purchase', paid: 18 },
    { id: 'stand-eryops', source: 'purchase', paid: 12 },
  ]);
  assert.deepEqual(s.payments.partial, {});
  assert.deepEqual(s.world.owned, [{ id: 'eryops-dig', source: 'purchase', paid: 24 }]);
  assert.deepEqual(s.world.location, { kind: 'site-pit', siteId: 'eryops-dig' });
  assert.deepEqual(s.closedSites, ['courtyard-dig']);
  assert.deepEqual(s.helpers.owned, [{ id: 'helper-1', paid: 60, siteId: 'eryops-dig', phase: 'idle', task: null }]);
  assert.deepEqual(s.upgrades.owned, [{ id: 'boots', paid: 16 }, { id: 'shovel', paid: 24 },
    { id: 'helper-tools', paid: 30, helperId: 'helper-1' }]);
  assert.deepEqual(s.custody, {
    'eryops-skull-find': { siteId: 'eryops-dig', location: 'storage' },
    'eryops-spine-find': { siteId: 'eryops-dig', location: 'storage' },
  });
  assert.equal(s.cleaning['eryops-skull-find'].length, 30);
  assert.deepEqual(s.cleaning, original.cleaning);
  assert.ok(!s.collected.some(id => id.startsWith('eryops-')));
  assert.equal(collectStored(s, 'eryops-skull-find'), s, 'unfinished cleaning must not auto-collect');
  const home = reload(travelTo(s, { kind: 'hub' }));
  assert.equal(buyPurchase(home, 'west-wing'), home); assert.equal(buyPurchase(home, 'stand-eryops'), home);
  assert.equal(buySite(home, 'eryops-dig'), home); assert.equal(buyHelper(home), home);
  for (const id of ['boots', 'shovel', 'helper-tools']) assert.equal(buyUpgrade(home, id), home);
  const collected = reload(collectTicketRevenue(home));
  assert.equal(collected.economy.coins, 83); assert.equal(collected.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(collected), collected);
});

const historical = [
  ['legacy12', 12, (raw: string) => parseSave(raw)],
  ['purchased14', 14, (raw: string) => parseMuseumSave(raw, 42)],
  ['managed19', 19, (raw: string) => parseUpgradeSave(raw, 42)],
  ['deposits20', 20, (raw: string) => parsePaymentSave(raw, 42)],
] as const;
for (const [name, version, nativeReader] of historical) test(`baseline: authentic schema ${version} migrates through the normal-play loader`, () => {
  const original = fixtures[name], raw = JSON.stringify(original);
  assert.equal(original.version, version); assert.deepEqual(nativeReader(raw), original);
  const s = load(raw, 42);
  assert.equal(s.version, 21); assert.equal(s.pendingTicketRevenue, 0, 'old income was already spendable');
  for (const key of ['dig', 'cleaning', 'collected', 'placed', 'closedSites'] as const) assert.deepEqual(s[key], original[key]);
  if (original.economy) assert.deepEqual(s.economy, original.economy);
  if (original.museum) assert.deepEqual(s.museum, original.museum);
  if (original.world) assert.deepEqual(s.world, original.world);
  if (original.helpers) assert.deepEqual(s.helpers, original.helpers);
  if (original.upgrades) assert.deepEqual(s.upgrades, original.upgrades);
  assert.deepEqual(s.payments, original.payments ?? { version: 1, partial: {} });
  if (original.visitors) {
    assert.deepEqual(s.visitors.sales, original.visitors.sales);
    assert.equal(s.visitors.nextId, original.visitors.nextId);
    assert.deepEqual(s.visitors.visits, original.visitors.visits.filter(v => !v.paid));
  }
  if (version < 19) { assert.deepEqual(s.helpers.owned, []); assert.deepEqual(s.upgrades.owned, []); assert.deepEqual(s.custody, {}); }
  if (version === 19) assert.deepEqual(s.custody, reload(current('managed21')).custody);
  assert.deepEqual(reload(s), s); assert.equal(collectTicketRevenue(s), s);
  assert.deepEqual(advanceMuseum(s, museumJourney(s)), s);
});

test('baseline: pre-economy ownership stays legacy with no invented west-wing payment or retroactive soil rewards', () => {
  const s = load(JSON.stringify(fixtures.legacy12), 42);
  assert.equal(s.economy.coins, 20); assert.equal(s.economy.sites['courtyard-dig'].excluded.length, 64);
  assert.deepEqual(s.economy.sites['courtyard-dig'].claimed, []);
  assert.deepEqual(s.museum.owned, ['stand-dimetrodon', 'stand-trilobite', 'west-wing', 'stand-eryops']
    .map(id => ({ id, source: 'legacy', paid: 0 })));
  assert.deepEqual(s.world.owned, [{ id: 'eryops-dig', source: 'legacy', paid: 0 }]);
  assert.deepEqual(s.payments.partial, {});
});

for (const paid of [5, 17]) test(`baseline: interrupted west-wing completion from ${paid} coins retries exactly once`, () => {
  let live = reload(current('deposits21'));
  const spot = museumLayout(live).purchases.find(p => p.id === 'west-wing')!;
  for (let n = 5; n < paid; n++) live = contributePurchase(live, 'west-wing', spot);
  live = reload(live);
  let raw = JSON.stringify(live), fail = true, effects = 0;
  const before = raw;
  const port: StoragePort = {
    getItem: () => raw,
    setItem(key, value) { assert.equal(key, SAVE_KEY); if (fail) throw Error('quota'); raw = value; },
    removeItem() { assert.fail('Purchase retry must not reset storage'); },
  };
  const committer = createCommitter<CashSave>(port, () => {}); committer.enable();
  try {
    const candidate = paid === 17 ? contributePurchase(live, 'west-wing', spot) : buyPurchase(live, 'west-wing');
    assert.equal(committer.commit(candidate, saved => { live = saved; effects++; }), 'failed');
    assert.equal(raw, before); assert.equal(effects, 0);
    assert.deepEqual(load(raw), live, 'restarting before retry keeps the previous deposit');
    assert.equal(committer.commit(candidate, () => assert.fail('Duplicate publish')), 'blocked');
    fail = false;
    assert.equal(committer.flush(), 'saved'); assert.equal(committer.flush(), 'idle'); assert.equal(effects, 1);
    assert.deepEqual(load(raw), live); assert.equal(live.economy.coins, 3); assert.equal(live.pendingTicketRevenue, 2);
    assert.deepEqual(live.payments.partial, { 'stand-trilobite': 2 });
    assert.deepEqual(live.museum.owned.find(r => r.id === 'west-wing'), { id: 'west-wing', source: 'purchase', paid: 18 });
    assert.equal(buyPurchase(live, 'west-wing'), live);
  } finally { committer.dispose(); }
});

const invalid: [string, typeof currentNames[number], (s: CashSave) => void][] = [
  ['extra spendable coin', 'managed21', s => { s.economy.coins++; }],
  ['negative money', 'fresh21', s => { s.economy.coins = -1; }],
  ['fractional pending income', 'managed21', s => { s.pendingTicketRevenue = 0.5; }],
  ['pending counted twice', 'managed21', s => { s.economy.coins += s.pendingTicketRevenue; }],
  ['pending without ticket sales', 'fresh21', s => { s.economy.coins--; s.pendingTicketRevenue = 1; }],
  ['unsafe money', 'managed21', s => { s.economy.coins = Number.MAX_SAFE_INTEGER; }],
  ['duplicate receipt', 'managed21', s => { s.museum.owned.push({ ...s.museum.owned[0] }); }],
  ['incorrect west-wing receipt', 'managed21', s => { s.museum.owned.find(r => r.id === 'west-wing')!.paid = 17; s.economy.coins++; }],
  ['mixed legacy and purchased hall', 'managed21', s => { Object.assign(s.museum.owned.find(r => r.id === 'west-wing')!, { source: 'legacy', paid: 0 }); s.economy.coins += 18; }],
  ['paid wing also has deposit', 'managed21', s => { s.payments.partial['west-wing'] = 1; s.economy.coins--; }],
  ['completed deposit without receipt', 'deposits21', s => { s.payments.partial['west-wing'] = 18; s.economy.coins -= 13; }],
  ['deposit before required display', 'fresh21', s => { s.payments.partial['west-wing'] = 1; s.economy.coins--; }],
  ['duplicate collection', 'assembly21', s => { s.collected.push(s.collected[0]); }],
  ['placement without collection', 'assembly21', s => { s.collected = s.collected.filter(id => id !== 'bone-study-head'); }],
  ['duplicate placement', 'assembly21', s => { s.placed.push(s.placed[0]); }],
  ['premature site closure', 'fresh21', s => { s.closedSites.push('courtyard-dig'); }],
  ['site-two ownership before closure', 'managed21', s => { s.closedSites = []; }],
  ['unowned site-two progress', 'managed21', s => { s.world.owned = []; s.economy.coins += 24; }],
  ['forgotten claimed reward', 'dig21', s => { s.economy.sites['courtyard-dig'].claimed = []; }],
  ['changed manifest outcome', 'fresh21', s => { s.economy.sites['courtyard-dig'].outcomes['courtyard-dig/v1/courtyard-r0-c0/0'] = 1; }],
  ['ticket sequence inconsistent with sales', 'deposits21', s => { s.visitors.nextId++; }],
  ['impossible ticket price history', 'deposits21', s => { s.visitors.sales = [3, 0, 1]; s.pendingTicketRevenue += 2; }],
  ['unpaid helper ownership', 'managed21', s => { s.helpers.owned[0].paid = 0; s.economy.coins += 60; }],
  ['wrong original storage site', 'managed21', s => { s.custody['eryops-skull-find'].siteId = 'courtyard-dig'; }],
  ['custody also collected', 'managed21', s => { s.collected.push('eryops-spine-find'); }],
  ['unknown delivery helper', 'managed21', s => { s.custody['eryops-spine-find'] = { siteId: 'eryops-dig', location: 'delivery', helperId: 'unknown' }; }],
  ['duplicate upgrade', 'managed21', s => { s.upgrades.owned.push({ ...s.upgrades.owned[0] }); }],
];
for (const [label, name, corrupt] of invalid) test(`baseline rejects ${label} without overwriting storage`, () => {
  const s = current(name); corrupt(s); const raw = JSON.stringify(s);
  assert.equal(parseCashSave(raw, 42), null);
  assert.deepEqual(loadCashSave(readOnly(raw), 42), { kind: 'invalid' });
});

test('baseline: malformed, unsupported and unavailable saves never silently become new games', () => {
  for (const raw of ['{broken', 'null', '[]', JSON.stringify({ ...current('fresh21'), version: 22 })])
    assert.deepEqual(loadCashSave(readOnly(raw), 42), { kind: 'invalid' });
  assert.deepEqual(loadCashSave({ ...readOnly(null), getItem() { throw Error('storage unavailable'); } }, 42), { kind: 'unavailable' });
});
