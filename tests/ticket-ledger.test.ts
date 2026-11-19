import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLedgerSave, ledgerTotals, migrateLedgerSave, payLedgerTicket, recordTicketSale, ticketPriceForDisplays } from '../src/game/ticket-ledger.ts';
import type { LedgerSave, TicketLedger } from '../src/game/ticket-ledger.ts';
import { loadLedgerSave, parseLedgerSave, parseLedgerVisitors } from '../src/persistence/ledger-save.ts';
import { parseCashSave, loadCashSave } from '../src/persistence/cash-save.ts';
import { parseTicketSave } from '../src/persistence/ticket-save.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import type { StoragePort } from '../src/persistence/save.ts';
import { collectTicketRevenue, createCashSave } from '../src/game/cash.ts';
import { arriveVisitor, payVisitor, ticketIncome, ticketPrice, arrivalSeconds } from '../src/game/visitors.ts';
import { advanceMuseum, museumJourney, buyPurchase } from '../src/game/purchases.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { travelTo } from '../src/game/world-map.ts';
import { createCommitter } from '../src/app/commit.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITES, SITE } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
const port = (raw: string | null): StoragePort => ({
  getItem(key) { assert.equal(key, SAVE_KEY); return raw; },
  setItem() { assert.fail('Reader cannot overwrite a save'); }, removeItem() { assert.fail('Reader cannot delete a save'); },
});
function parsed(s: unknown): LedgerSave {
  const result = parseLedgerSave(JSON.stringify(s), 987654321); assert.ok(result); return result;
}
function loaded(s: unknown): LedgerSave {
  const result = loadLedgerSave(port(JSON.stringify(s)), 987654321);
  assert.equal(result.kind, 'ready'); if (result.kind !== 'ready') throw Error('Load failed');
  assert.equal(result.restored, true); return result.save;
}
const migrated = (name: string) => parsed(fixtures[name]);
function displays(count: number) {
  return parsed(createGameSave({ ...freshJourney(),
    dig: Object.fromEntries(SITES.flatMap(site => site.cells.map(c => [c.id, 1]))),
    collected: SITES.flatMap(site => [...site.requiredDiscoveryIds]), closedSites: SITES.map(site => site.id),
    placed: EXHIBITS.slice(0, count).flatMap(e => [...e.parts]),
  }, 42));
}

for (const [name, original] of Object.entries(fixtures)) test(`ledger migration preserves every baseline field: ${name}`, () => {
  const raw = JSON.stringify(original), old = parseCashSave(raw, 987654321); assert.ok(old);
  const next = parsed(original);
  const counts = Object.fromEntries(old.visitors.sales.flatMap((count, i) => count ? [[String(i + 2), count]] : []));
  assert.deepEqual(next, { ...old, version: 22, visitors: { ...old.visitors, sales: { version: 1, counts } } });
  assert.equal(next.economy.coins, old.economy.coins); assert.equal(next.pendingTicketRevenue, old.pendingTicketRevenue);
  assert.equal(ticketIncome(next.visitors.sales), ticketIncome(old.visitors.sales));
  assert.deepEqual(next.visitors.visits, old.visitors.visits, 'parsing preserves locked paid prices before load retires tours');
  assert.deepEqual(parsed(next), next);
  const oldLoad = loadCashSave(port(raw), 987654321); assert.equal(oldLoad.kind, 'ready');
  if (oldLoad.kind !== 'ready') throw Error('Historical load failed');
  const restored = loaded(original);
  assert.deepEqual(restored, migrateLedgerSave(oldLoad.save));
  for (let i = 0; i < 3; i++) assert.deepEqual(loaded(restored), restored);
  assert.deepEqual(advanceMuseum(restored, museumJourney(restored)), restored, 'no replayed soil reward');
});

test('ledger reader retains support for every historical schema 1–21', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = []; if (version >= 8) old.activeSiteId = SITE.id;
    const prior = parseCashSave(JSON.stringify(old), 42); assert.ok(prior);
    assert.deepEqual(parseLedgerSave(JSON.stringify(old), 42), migrateLedgerSave(prior));
  }
  for (let version = 13; version <= 21; version++) {
    const old: Record<string, unknown> = { ...createCashSave(42), version };
    for (const [minimum, field] of [[14, 'museum'], [15, 'world'], [16, 'visitors'], [17, 'helpers'],
      [18, 'custody'], [19, 'upgrades'], [20, 'payments'], [21, 'pendingTicketRevenue']] as const)
      if (version < minimum) delete old[field];
    const prior = parseCashSave(JSON.stringify(old), 42); assert.ok(prior);
    assert.deepEqual(parseLedgerSave(JSON.stringify(old), 42), migrateLedgerSave(prior));
  }
});

test('fresh normal saves use schema 22; historical readers reject new ledgers and out-of-contract old tiers', () => {
  const fresh = createLedgerSave(42);
  assert.equal(fresh.version, 22); assert.deepEqual(fresh.visitors.sales, { version: 1, counts: {} });
  assert.equal(fresh.economy.coins, 20); assert.equal(fresh.pendingTicketRevenue, 0);
  assert.deepEqual(loadLedgerSave(port(null), 42), { kind: 'ready', save: fresh, restored: false, unassigned: false });
  assert.equal(parseCashSave(JSON.stringify(fresh), 42), null);
  for (const sales of [[0, 0, 0, 1], { version: 1, counts: { '5': 1 } }]) {
    const old = { ...fixtures.deposits21, visitors: { ...fixtures.deposits21.visitors, sales } };
    assert.equal(parseCashSave(JSON.stringify(old), 42), null); assert.equal(parseLedgerSave(JSON.stringify(old), 42), null);
  }
  const old = createCashSave(42);
  const { pendingTicketRevenue: _cash, payments: _payments, upgrades: _upgrades, custody: _custody, helpers: _helpers, ...ticket } = old;
  assert.equal(parseTicketSave(JSON.stringify({ ...ticket, version: 16, visitors: { ...ticket.visitors, sales: [0, 0, 0, 1] } }), 42), null);
});

test('schema-21 mixed paid visits retain their locked 2/3/4 prices during migration', () => {
  const base = displays(3);
  const old = { ...base, version: 21, pendingTicketRevenue: 9,
    visitors: { version: 1, nextId: 4, sales: [1, 1, 1], visits: [{ id: 1, paid: 2 }, { id: 2, paid: 3 }, { id: 3, paid: 4 }] } };
  assert.ok(parseCashSave(JSON.stringify(old), 42));
  const s = parsed(old);
  assert.deepEqual(s.visitors.visits, old.visitors.visits);
  assert.deepEqual(s.visitors.sales, { version: 1, counts: { '2': 1, '3': 1, '4': 1 } });
  assert.equal(s.economy.coins, 20); assert.equal(s.pendingTicketRevenue, 9);
  const restored = loaded(s); assert.deepEqual(restored.visitors.visits, []);
  assert.equal(restored.pendingTicketRevenue, 9); assert.equal(restored.economy.coins, 20);
});

for (const count of [0, 1, 2, 3]) test(`existing ${count}-display pricing, arrival timing and attended payment remain unchanged`, () => {
  let s = displays(count);
  assert.equal(ticketPrice(s), count ? count + 1 : 0); assert.equal(arrivalSeconds(s), [12, 12, 10, 8][count]);
  const before = s; s = arriveVisitor(s);
  if (!count) { assert.equal(s, before); assert.equal(payVisitor(s, 1, CASHIER_STATION, true), s); return; }
  assert.equal(payVisitor(s, 1, CASHIER_STATION, false), s);
  assert.equal(payVisitor(s, 1, { x: 100, z: 100 }, true), s);
  assert.equal(payVisitor({ ...s, room: 'outdoors' }, 1, CASHIER_STATION, true).pendingTicketRevenue, 0);
  const paid = parsed(payVisitor(s, 1, CASHIER_STATION, true));
  assert.equal(paid.economy.coins, 20); assert.equal(paid.pendingTicketRevenue, count + 1);
  assert.deepEqual(paid.visitors.sales, { version: 1, counts: { [count + 1]: 1 } });
  assert.equal(payVisitor(paid, 1, CASHIER_STATION, true), paid);
  const restored = loaded(paid); assert.deepEqual(restored.visitors.visits, []);
  const cash = parsed(collectTicketRevenue(restored));
  assert.equal(cash.economy.coins, 21 + count); assert.equal(cash.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(cash), cash);
});

// Future-count tests exercise the actual pure accounting and visitor validator
// with an explicit earned price. They do not add or mutate any fossil definitions.
for (const count of [4, 10, 17, 99]) test(`isolated ${count}-display input records and validates price ${count + 1}`, () => {
  const price = ticketPriceForDisplays(count); assert.equal(price, count + 1);
  const s = { ...createLedgerSave(42), visitors: { version: 1 as const, nextId: 2,
    sales: { version: 1 as const, counts: {} }, visits: [{ id: 1, paid: 0 }] } };
  const paid = payLedgerTicket(s, 1, price);
  assert.equal(paid.economy.coins, 20); assert.equal(paid.pendingTicketRevenue, price);
  assert.deepEqual(paid.visitors.sales.counts, { [price]: 1 });
  assert.deepEqual(parseLedgerVisitors(JSON.parse(JSON.stringify(paid.visitors)), price), paid.visitors);
  assert.equal(payLedgerTicket(paid, 1, price), paid);
  const collected = collectTicketRevenue(paid);
  assert.equal(collected.economy.coins, 20 + price); assert.equal(collected.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(collected), collected);
  assert.equal(parseLedgerSave(JSON.stringify(paid), 42), null, 'full reader cannot invent the currently unimplemented displays');
});

test('mixed historic and future prices reconcile exactly, including every price 2–18', () => {
  let ledger: TicketLedger = { version: 1, counts: { '2': 3, '3': 2, '4': 1 } };
  for (let price = 2; price <= 18; price++) ledger = recordTicketSale(ledger, price)!;
  assert.deepEqual(ledgerTotals(ledger), { income: 186, sold: 23 });
  assert.equal(ticketIncome(ledger), 186);
  const visitors = { version: 1, sales: ledger, nextId: 25, visits: [{ id: 22, paid: 11 }, { id: 23, paid: 18 }, { id: 24, paid: 0 }] };
  assert.deepEqual(parseLedgerVisitors(visitors, 18), visitors);
  assert.equal(parseLedgerVisitors(visitors, 17), null);
});

test('new sales append to migrated history; travel and purchases preserve schema, pending cash and deposits', () => {
  let s = loaded(fixtures.deposits21);
  s = parsed(payVisitor(s, 5, CASHIER_STATION, true));
  assert.deepEqual(s.visitors.sales.counts, { '2': 5 }); assert.equal(s.pendingTicketRevenue, 4); assert.equal(s.economy.coins, 16);
  const away = parsed(travelTo(s, { kind: 'site-camp', siteId: 'courtyard-dig' }));
  assert.equal(away.version, 22); assert.equal(away.pendingTicketRevenue, 4); assert.deepEqual(away.payments, s.payments);
  assert.deepEqual(away.visitors.visits, []); assert.equal(collectTicketRevenue(away), away);
  s = parsed(travelTo(away, { kind: 'hub' }));
  const spot = museumLayout(s).purchases.find(p => p.id === 'west-wing')!;
  s = parsed(contributePurchase(s, 'west-wing', spot)); assert.equal(s.payments.partial['west-wing'], 6);
  s = parsed(buyPurchase(s, 'west-wing')); assert.equal(s.economy.coins, 3); assert.equal(s.pendingTicketRevenue, 4);
  assert.deepEqual(s.payments.partial, { 'stand-trilobite': 2 });
  assert.deepEqual(s.museum.owned.find(r => r.id === 'west-wing'), { id: 'west-wing', source: 'purchase', paid: 18 });
  assert.equal(buyPurchase(s, 'west-wing'), s);
});

test('failed sale/collection/migration commit retries an immutable candidate once; reset cannot resurrect pending income', () => {
  let live = arriveVisitor(displays(3)), raw = JSON.stringify(live), fail = false, effects = 0;
  const storage: StoragePort = { getItem: () => raw, setItem(_key, value) { if (fail) throw Error('quota'); raw = value; }, removeItem() { raw = ''; } };
  const commit = createCommitter<LedgerSave>(storage, () => {}); commit.enable();
  try {
    for (const command of [(s: LedgerSave) => payVisitor(s, 1, CASHIER_STATION, true), collectTicketRevenue<LedgerSave>]) {
      const before = raw, previous = live, candidate = command(live); fail = true;
      assert.equal(commit.commit(candidate, value => { live = value; effects++; }), 'failed');
      assert.equal(raw, before); assert.equal(live, previous);
      assert.equal(commit.commit(command(live), () => assert.fail()), 'blocked');
      assert.deepEqual(parsed(JSON.parse(raw)), previous);
      candidate.economy.coins = 999; // publish must use the committer's frozen copy
      fail = false; assert.equal(commit.flush(), 'saved'); assert.equal(commit.flush(), 'idle'); parsed(live);
    }
    assert.equal(effects, 2); assert.equal(live.economy.coins, 24); assert.equal(live.pendingTicketRevenue, 0);
    assert.deepEqual(live.visitors.sales.counts, { '4': 1 });
    raw = JSON.stringify(fixtures.managed21); fail = true;
    assert.equal(commit.commit(migrated('managed21'), value => { live = value; effects++; }), 'failed');
    assert.equal(JSON.parse(raw).version, 21);
    fail = false; commit.flush(); commit.flush(); assert.equal(effects, 3);
    assert.equal(live.economy.coins, 77); assert.equal(live.pendingTicketRevenue, 6); assert.equal(JSON.parse(raw).version, 22);
    fail = true; commit.commit(createLedgerSave(42), () => assert.fail('reset must discard failed candidate'));
    fail = false; assert.ok(commit.reset()); commit.commit(createLedgerSave(42), value => { live = value; }); commit.flush();
    assert.deepEqual(live, createLedgerSave(42));
  } finally { commit.dispose(); }
});

const malformedLedgers: [string, unknown][] = [
  ['null', null], ['array', [1, 2, 3]], ['missing counts', { version: 1 }], ['wrong version', { version: 2, counts: {} }],
  ['extra property', { version: 1, counts: {}, extra: 0 }], ['array counts', { version: 1, counts: [] }],
  ...['0', '1', '-2', '2.5', '02', '+2', '2e0', ' 2', 'Infinity', '9007199254740992', '__proto__'].map(key =>
    [`invalid price ${key}`, { version: 1, counts: { [key]: 1 } }] as [string, unknown]),
  ...[-1, 0.5, '1', null, true, Number.MAX_SAFE_INTEGER + 1].map(count =>
    [`invalid count ${String(count)}`, { version: 1, counts: { '2': count } }] as [string, unknown]),
  ['unsafe multiplication', { version: 1, counts: { '2': Number.MAX_SAFE_INTEGER } }],
  ['unsafe sum', { version: 1, counts: { '2': 4503599627370495, '3': 1 } }],
];
for (const [name, sales] of malformedLedgers) test(`malformed ledger rejected safely: ${name}`, () => {
  assert.equal(ledgerTotals(sales), null);
  const s = migrated('deposits21'); const raw = JSON.stringify({ ...s, visitors: { ...s.visitors, sales } });
  assert.equal(parseLedgerSave(raw, 42), null); assert.deepEqual(loadLedgerSave(port(raw), 42), { kind: 'invalid' });
});

test('integer boundaries and duplicate payment guards never create unsafe income', () => {
  const max = Number.MAX_SAFE_INTEGER;
  assert.deepEqual(ledgerTotals({ version: 1, counts: { [max]: 1 } }), { income: max, sold: 1 });
  assert.equal(recordTicketSale({ version: 1, counts: { [max]: 1 } }, 2), null);
  for (const count of [-1, 0.5, NaN, Infinity, max]) assert.equal(ticketPriceForDisplays(count), 0);
  const s = arriveVisitor(displays(1));
  assert.equal(payLedgerTicket({ ...s, economy: { ...s.economy, coins: max } }, 1, 2).pendingTicketRevenue, 0);
  for (const price of [-1, 0, 1, 1.5, NaN, Infinity, max]) assert.equal(payLedgerTicket(s, 1, price), s);
  const overflowing = { ...s, pendingTicketRevenue: max };
  assert.equal(collectTicketRevenue(overflowing), overflowing);
});

test('a near-limit wallet with existing spending cannot accept an unreloadable ticket payment', () => {
  const s = migrated('deposits21'), count = (Number.MAX_SAFE_INTEGER - 29) / 2;
  s.visitors.sales = { version: 1, counts: { '2': count } };
  s.visitors.nextId = count + 2; s.visitors.visits = [{ id: count + 1, paid: 0 }];
  s.pendingTicketRevenue = 0; s.economy.coins = Number.MAX_SAFE_INTEGER - 19;
  assert.deepEqual(parsed(s), s, 'starting + claimed soil + tickets exactly equals MAX_SAFE_INTEGER');
  assert.equal(payVisitor(s, count + 1, CASHIER_STATION, true), s);
  assert.deepEqual(parsed(s), s);
});

test('paid visits must be backed by counts at their own price; queue/order/shape checks remain strict', () => {
  const base = { version: 1, sales: { version: 1, counts: { '2': 1, '3': 2 } }, nextId: 4,
    visits: [{ id: 1, paid: 2 }, { id: 2, paid: 3 }] };
  assert.deepEqual(parseLedgerVisitors(base, 3), base);
  for (const visits of [[{ id: 1, paid: 2 }, { id: 2, paid: 2 }], [{ id: 2, paid: 3 }, { id: 1, paid: 2 }],
    [{ id: 1, paid: 1 }], [{ id: 1, paid: 2.5 }], [{ id: 1, paid: 2, extra: true }], [{ id: 4, paid: 2 }]])
    assert.equal(parseLedgerVisitors({ ...base, visits }, 3), null);
  assert.equal(parseLedgerVisitors({ ...base, nextId: 8, visits: [4, 5, 6, 7].map(id => ({ id, paid: 0 })) }, 3), null);
  assert.equal(parseLedgerVisitors({ ...base, visits: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, paid: 2 })) }, 3), null);
  assert.equal(parseLedgerVisitors({ ...base, extra: true }, 3), null);
});

const corruptions: [string, (s: LedgerSave) => void][] = [
  ['wrong balance', s => { s.economy.coins++; }],
  ['negative pending', s => { s.pendingTicketRevenue = -1; }],
  ['pending above lifetime tickets', s => { s.pendingTicketRevenue = 253; }],
  ['paid plus pending duplicate', s => { s.economy.coins += s.pendingTicketRevenue; }],
  ['invalid price for earned displays', s => { s.visitors.sales.counts['18'] = 1; s.visitors.nextId++; s.pendingTicketRevenue += 18; }],
  ['unbacked active payment', s => { s.visitors.visits = [{ id: 86, paid: 4 }]; s.visitors.nextId--; }],
  ['duplicate visit IDs', s => { s.visitors.visits = [{ id: 86, paid: 0 }, { id: 86, paid: 0 }]; s.visitors.nextId++; }],
  ['wrong next sequence', s => { s.visitors.nextId++; }],
  ['negative sale', s => { s.visitors.sales.counts['3'] = -1; }],
  ['modified west-wing receipt', s => { s.museum.owned.find(r => r.id === 'west-wing')!.paid = 0; s.economy.coins += 18; }],
  ['owned plus deposit', s => { s.payments.partial['west-wing'] = 1; s.economy.coins--; }],
  ['unpaid helper', s => { s.helpers.owned[0].paid = 0; s.economy.coins += 60; }],
  ['invalid custody', s => { s.custody['eryops-spine-find'].siteId = 'courtyard-dig'; }],
  ['unearned placement', s => { s.placed.push('eryops-skull'); }],
  ['premature second-site closure', s => { s.closedSites.push('eryops-dig'); }],
  ['duplicate upgrade', s => { s.upgrades.owned.push({ ...s.upgrades.owned[0] }); }],
  ['unsafe reconciled assets', s => { s.economy.coins = Number.MAX_SAFE_INTEGER - 1; }],
];
for (const [name, corrupt] of corruptions) test(`schema 22 rejects ${name} without resetting`, () => {
  const s = migrated('managed21'); corrupt(s); const raw = JSON.stringify(s);
  assert.equal(parseLedgerSave(raw, 42), null); assert.deepEqual(loadLedgerSave(port(raw), 42), { kind: 'invalid' });
});

test('loader protects corrupt/future/unavailable storage; existing source is never overwritten', () => {
  for (const raw of ['{', 'null', '[]', JSON.stringify({ ...createLedgerSave(42), version: 23 })])
    assert.deepEqual(loadLedgerSave(port(raw), 42), { kind: 'invalid' });
  assert.deepEqual(loadLedgerSave({ ...port(null), getItem() { throw Error('unavailable'); } }, 42), { kind: 'unavailable' });
});
