import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMvpSave, migrateMvpSave } from '../src/game/mvp-economy.ts';
import type { MvpSave } from '../src/game/mvp-economy.ts';
import { parseMvpSave, loadMvpSave } from '../src/persistence/mvp-save.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { buyPurchase, purchaseStatus, remainingPurchaseCost, displayedExhibits, placeOwnedGroup } from '../src/game/purchases.ts';
import { buySite, sitePurchaseStatus, travelTo } from '../src/game/world-map.ts';
import { museumLayout } from '../src/game/museum-layout.ts';
import { contributePurchase } from '../src/game/purchase-payments.ts';
import { ticketPrice, canArrive, arriveVisitor, payVisitor } from '../src/game/visitors.ts';
import { ledgerTotals } from '../src/game/ticket-ledger.ts';
import { collectTicketRevenue } from '../src/game/cash.ts';
import { buyUpgrade } from '../src/game/upgrades.ts';
import { buyHelper } from '../src/game/helpers.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { createCommitter } from '../src/app/commit.ts';
import { isPermianRoomComplete, isPermianExhibitDisplayed } from '../src/game/permian-rooms.ts';
import { eligiblePermianStand } from '../src/game/permian-progression.ts';
import { MVP_DEFINITIONS, mvpProgress, nextMvpStand, mvpNeedsRecoveryNotice } from '../src/game/mvp-progression.ts';
import { mvpRecoveredFirst, mvpDisplay, mvpSale, mvpRecoverEryops } from './helpers/mvp-fixture.ts';

const reload = (save: MvpSave): MvpSave => { assert.deepEqual(parseMvpSave(JSON.stringify(save), 42), save); return save; };
const offer = (s: MvpSave) => museumLayout(s).purchases.map(p => p.id);
function first() { return reload(mvpDisplay(buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon'), 'dimetrodon')); }
function second() { return reload(mvpDisplay(buyPurchase(first(), 'stand-trilobite'), 'trilobite')); }
function funded() { let s = second(); for (let i = 0; i < 20; i++) s = mvpSale(s); return reload(s); }

test('fresh state offers only Dimetrodon, costs 12, leaves 8 and cannot spend on optional upgrades before income', () => {
  const s = reload(createMvpSave(42)); assert.equal(s.economy.coins, 20); assert.deepEqual(offer(s), ['stand-dimetrodon']);
  for (const id of ['stand-trilobite', 'stand-eryops', 'stand-walchia', 'west-wing', 'stand-moschops']) assert.equal(buyPurchase(s, id), s);
  for (const id of ['boots', 'shovel', 'helper-tools']) assert.equal(buyUpgrade(s, id), s);
  assert.equal(buyHelper(s), s); assert.equal(ticketPrice(s), 0); assert.equal(canArrive(s), false);
  assert.equal(buySite(s, 'eryops-dig'), s);
  const paid = reload(buyPurchase(s, 'stand-dimetrodon')); assert.equal(paid.economy.coins, 8);
  assert.deepEqual(offer(paid), []); assert.equal(purchaseStatus(paid, 'stand-trilobite'), 'dimetrodonFirst');
  assert.equal(travelTo(s, { kind: 'site-camp', siteId: 'courtyard-dig' }).room, 'outdoors');
  assert.equal(travelTo(s, { kind: 'site-camp', siteId: 'eryops-dig' }), s);
});
test('owned incomplete/partial stands never unlock the next stand or generate tickets', () => {
  let s = buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon');
  for (const count of [0, 1, 5]) {
    s = { ...s, placed: [...EXHIBITS[0].parts.slice(0, count)] };
    reload(s); assert.equal(ticketPrice(s), 0); assert.equal(nextMvpStand(s), undefined); assert.deepEqual(offer(s), []);
  }
});
test('valid displays offer Trilobite then Eryops, with admission 4 then 6 and no automatic charges', () => {
  const one = first(); assert.equal(one.economy.coins, 8); assert.equal(ticketPrice(one), 4); assert.deepEqual(offer(one), ['stand-trilobite']);
  const paid = reload(buyPurchase(one, 'stand-trilobite')); assert.equal(paid.economy.coins, 0); assert.deepEqual(offer(paid), []);
  const two = reload(mvpDisplay(paid, 'trilobite')); assert.equal(ticketPrice(two), 6); assert.deepEqual(offer(two), ['stand-eryops']);
  assert.equal(purchaseStatus(two, 'stand-eryops'), 'insufficient');
  assert.equal(sitePurchaseStatus(two, 'eryops-dig'), 'eryopsStandFirst');
});
test('ticket-only witness funds 16-coin Eryops stand then 20-coin site without a first-site-closure gate', () => {
  let s = second(); for (let i = 0; i < 6; i++) s = reload(mvpSale(s));
  assert.equal(s.economy.coins, 36);
  s = reload(buyPurchase(s, 'stand-eryops')); assert.equal(s.economy.coins, 20);
  assert.deepEqual(s.world.owned, []); assert.deepEqual(offer(s), []);
  assert.equal(sitePurchaseStatus({ ...s, closedSites: [] }, 'eryops-dig'), 'ready');
  s = reload(buySite(s, 'eryops-dig')); assert.equal(s.economy.coins, 0);
  assert.deepEqual(s.world.owned, [{ id: 'eryops-dig', source: 'purchase', paid: 20 }]);
  assert.equal(buySite(s, 'eryops-dig'), s); assert.equal(buyPurchase(s, 'stand-eryops'), s);
  s = reload(travelTo(s, { kind: 'site-camp', siteId: 'eryops-dig' }));
  s = reload(travelTo(s, { kind: 'site-pit', siteId: 'eryops-dig' })); assert.equal(s.room, 'excavation');
  s = reload(travelTo(s, { kind: 'hub' })); s = reload(mvpRecoverEryops(s));
  s = reload(mvpDisplay(s, 'eryops')); assert.equal(ticketPrice(s), 10); assert.equal(displayedExhibits(s).length, 3);
  s = reload(mvpSale(s, false)); assert.equal(s.pendingTicketRevenue, 10); assert.equal(s.visitors.sales.counts['10'], 1);
  const state = mvpProgress(s);
  assert.equal(isPermianRoomComplete('permian-room-1', { ...state, unlockedRoomIds: state.ownedRoomIds }, MVP_DEFINITIONS), false);
  assert.equal(nextMvpStand(s), undefined); assert.deepEqual(offer(s), []);
});
test('display projection rejects duplicate placement/ownership, missing finds and unavailable room', () => {
  const s = first();
  for (const invalid of [{ ...s, placed: [...s.placed, s.placed[0]] },
    { ...s, museum: { ...s.museum, owned: [...s.museum.owned, ...s.museum.owned] } },
    { ...s, collected: [] }, { ...s, rooms: { version: 2, owned: [] } }]) {
    assert.equal(ticketPrice(invalid as MvpSave), 0); assert.equal(purchaseStatus(invalid as MvpSave, 'stand-trilobite'), 'dimetrodonFirst');
  }
  const state = mvpProgress(s), exhibits = [...state.exhibits, state.exhibits[0]];
  assert.equal(isPermianExhibitDisplayed('dimetrodon', { ...state, exhibits, unlockedRoomIds: state.ownedRoomIds }, MVP_DEFINITIONS), false);
  assert.notEqual(eligiblePermianStand({ ...state, exhibits }, MVP_DEFINITIONS)?.id, 'stand-trilobite');
  const misplaced = state.exhibits.map(e => e.id === 'dimetrodon' ? { ...e, displayedOnStandId: 'stand-trilobite' } : e);
  assert.notEqual(eligiblePermianStand({ ...state, exhibits: misplaced }, MVP_DEFINITIONS)?.id, 'stand-trilobite');
});
test('16 one-coin Eryops contributions persist and complete once; pauses and insufficient funds preserve progress', () => {
  let s = funded(); const coins = s.economy.coins, spot = museumLayout(s).purchases[0];
  for (let n = 1; n <= 16; n++) {
    s = reload(contributePurchase(s, 'stand-eryops', spot)); assert.equal(s.economy.coins, coins - n);
    assert.equal(remainingPurchaseCost(s, 'stand-eryops'), n === 16 ? 16 : 16 - n);
    if (n < 16) assert.equal(s.payments.partial['stand-eryops'], n);
  }
  assert.equal(s.museum.owned.find(o => o.id === 'stand-eryops')!.paid, 16);
  assert.equal(contributePurchase(s, 'stand-eryops', spot), s);
});
test('waiting visitors pay the current price; already-paid visits and banknotes keep their original price', () => {
  let s = arriveVisitor(arriveVisitor(first()));
  s = reload(payVisitor(s, 1, CASHIER_STATION, true)); assert.equal(s.pendingTicketRevenue, 4);
  s = reload(mvpDisplay(buyPurchase(s, 'stand-trilobite'), 'trilobite'));
  s = reload(payVisitor(s, 2, CASHIER_STATION, true));
  assert.deepEqual(s.visitors.visits, [{ id: 1, paid: 4 }, { id: 2, paid: 6 }]); assert.equal(s.pendingTicketRevenue, 10);
  assert.deepEqual(ledgerTotals(s.visitors.sales), { income: 10, sold: 2 });
  assert.equal(payVisitor(s, 2, CASHIER_STATION, true), s);
  s = reload(collectTicketRevenue(s)); assert.equal(s.economy.coins, 10); assert.equal(s.pendingTicketRevenue, 0);
  assert.equal(collectTicketRevenue(s), s);
});
test('optional upgrades after first display cannot remove recurring ticket income', () => {
  let s = first(); for (let n = 0; n < 2; n++) s = mvpSale(s);
  s = reload(buyUpgrade(s, 'boots')); assert.equal(s.economy.coins, 0); assert.equal(ticketPrice(s), 4);
  for (let n = 0; n < 2; n++) s = reload(mvpSale(s));
  assert.equal(purchaseStatus(s, 'stand-trilobite'), 'ready');
});

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
for (const [name, input] of Object.entries(fixtures)) test(`historical migration preserves all fields and receipts: ${name}`, () => {
  const old = parseCreditSave(JSON.stringify(input), 42); assert.ok(old);
  const s = parseMvpSave(JSON.stringify(old), 42)!; assert.ok(s); reload(s);
  const { purchaseHistory, ...base } = s;
  assert.deepEqual({ ...base, version: 24 }, old);
  assert.deepEqual(purchaseHistory.sales, old.visitors.sales);
  assert.deepEqual(purchaseHistory.deposits, old.payments.partial);
  assert.equal(parseCreditSave(JSON.stringify(s), 42), null);
});
for (const n of [1, 7, 11]) test(`historical Eryops deposit ${n} is preserved, locked until its turn, and owes ${16 - n}`, () => {
  let old = createCreditSave(42); const spot = museumLayout(old).purchases.find(p => p.id === 'stand-eryops')!;
  for (let i = 0; i < n; i++) old = contributePurchase(old, 'stand-eryops', spot);
  assert.ok(parseCreditSave(JSON.stringify(old), 42));
  const s = reload(migrateMvpSave(old)); assert.equal(remainingPurchaseCost(s, 'stand-eryops'), 16 - n);
  assert.equal(s.economy.coins, 20 - n); assert.equal(contributePurchase(s, 'stand-eryops', spot), s);
  assert.deepEqual(offer(s), ['stand-dimetrodon']);
});
test('historical paid Eryops remains owned for 12 with no extra debit and historical sales remain unchanged', () => {
  const old = buyPurchase(createCreditSave(42), 'stand-eryops'), s = reload(migrateMvpSave(old));
  assert.deepEqual(s.museum.owned, old.museum.owned); assert.equal(s.economy.coins, 8); assert.equal(buyPurchase(s, 'stand-eryops'), s);
});

test('stranded historical development save retains its data and strict order, with manual recovery notice', () => {
  const old = buyPurchase(createCreditSave(11), 'stand-eryops'), raw = JSON.stringify(old);
  assert.equal(Object.values(old.economy.sites['courtyard-dig'].outcomes).reduce((a, b) => a + b, 0), 2);
  const result = loadMvpSave({ getItem: () => raw, setItem: () => assert.fail('loader must not write'), removeItem: () => assert.fail('no automatic reset') }, 42);
  assert.equal(result.kind, 'ready'); if (result.kind !== 'ready') return;
  const s = reload(result.save);
  assert.deepEqual(s.economy, old.economy); assert.deepEqual(s.museum, old.museum);
  assert.equal(mvpNeedsRecoveryNotice(s), true); assert.equal(s.economy.coins, 8);
  assert.deepEqual(offer(s), ['stand-dimetrodon']);
  assert.equal(purchaseStatus(s, 'stand-trilobite'), 'dimetrodonFirst');
  assert.equal(buyPurchase(s, 'stand-trilobite'), s); assert.equal(buySite(s, 'eryops-dig'), s);
  assert.equal(mvpNeedsRecoveryNotice(reload(s)), true);
});

test('historical partial Eryops payments never get a purchase-order exception', () => {
  let old = createCreditSave(11); const spot = museumLayout(old).purchases.find(p => p.id === 'stand-eryops')!;
  for (let i = 0; i < 11; i++) old = contributePurchase(old, 'stand-eryops', spot);
  const s = reload(migrateMvpSave(old));
  assert.equal(mvpNeedsRecoveryNotice(s), true); assert.equal(s.payments.partial['stand-eryops'], 11);
  assert.equal(contributePurchase(s, 'stand-eryops', spot), s); assert.equal(buyPurchase(s, 'stand-eryops'), s);
  assert.equal(buySite(s, 'eryops-dig'), s);
});

test('recovery notice excludes funded, paid-first-stand and income-earning games', () => {
  const fresh = createMvpSave(42);
  for (const s of [fresh, buyPurchase(fresh, 'stand-dimetrodon'), first(), second()]) assert.equal(mvpNeedsRecoveryNotice(s), false);
  let partial = fresh; const spot = museumLayout(partial).purchases[0];
  for (let i = 0; i < 11; i++) partial = contributePurchase(partial, 'stand-dimetrodon', spot);
  assert.equal(mvpNeedsRecoveryNotice(reload(partial)), false);
});

test('failed explicit recovery reset preserves old data; successful reset returns to fresh strict progression', () => {
  const old = migrateMvpSave(buyPurchase(createCreditSave(11), 'stand-eryops'));
  let raw = JSON.stringify(old), failReset = true;
  const port = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; },
    removeItem: () => { if (failReset) throw Error('denied'); raw = ''; } };
  const commit = createCommitter<MvpSave>(port, () => {}); commit.enable();
  assert.equal(commit.reset(), false); assert.deepEqual(parseMvpSave(raw, 42), old);
  assert.equal(commit.canMutate(), true); assert.equal(commit.flush(), 'idle');
  failReset = false; assert.equal(commit.reset(), true);
  assert.equal(commit.commit(createMvpSave(42), () => {}), 'saved');
  const s = parseMvpSave(raw, 42)!; assert.equal(s.economy.coins, 20); assert.deepEqual(s.placed, []);
  assert.deepEqual(s.museum.owned, []); assert.deepEqual(offer(s), ['stand-dimetrodon']);
  assert.equal(mvpNeedsRecoveryNotice(s), false); commit.dispose();
});

test('failed reset never unlocks or publishes an already-failed purchase candidate', () => {
  const original = createMvpSave(42), candidate = buyPurchase(original, 'stand-dimetrodon');
  let raw = JSON.stringify(original), fail = true, effects = 0;
  const commit = createCommitter<MvpSave>({ getItem: () => raw,
    setItem: (_key, value) => { if (fail) throw Error('quota'); raw = value; },
    removeItem: () => { throw Error('denied'); } }, () => {});
  commit.enable(); assert.equal(commit.commit(candidate, () => { effects++; }), 'failed');
  assert.equal(commit.reset(), false); assert.equal(commit.canMutate(), false); assert.equal(effects, 0);
  assert.deepEqual(parseMvpSave(raw, 42), original);
  fail = false; assert.equal(commit.flush(), 'saved'); assert.equal(commit.flush(), 'idle');
  assert.equal(effects, 1); assert.deepEqual(parseMvpSave(raw, 42), candidate); commit.dispose();
});

test('current validation rejects skipped stands, unearned site, missing history, repriced historical receipts and forged sales', () => {
  const s = createMvpSave(42), full = funded();
  const invalid = [
    { ...s, economy: { ...s.economy, coins: 12 }, museum: { version: 1, owned: [{ id: 'stand-trilobite', source: 'purchase', paid: 8 }] } },
    { ...s, economy: { ...s.economy, coins: 0 }, world: { ...s.world, owned: [{ id: 'eryops-dig', source: 'purchase', paid: 20 }] } },
    { ...s, purchaseHistory: undefined }, { ...s, purchaseHistory: { ...s.purchaseHistory, standIds: ['stand-walchia'] } },
    { ...full, visitors: { ...full.visitors, sales: { version: 1, counts: { '5': 20 } } } },
    { ...full, economy: { ...full.economy, coins: full.economy.coins + 1 } },
  ];
  for (const value of invalid) assert.equal(parseMvpSave(JSON.stringify(value), 42), null);
  const old = migrateMvpSave(buyPurchase(createCreditSave(42), 'stand-eryops'));
  assert.equal(parseMvpSave(JSON.stringify({ ...old, museum: { version: 1, owned: [{ id: 'stand-eryops', source: 'purchase', paid: 16 }] } }), 42), null);
});
for (const kind of ['stand', 'deposit', 'site', 'ticket', 'collect'] as const) test(`failed ${kind} commit, duplicate retry and reset stay atomic`, () => {
  let s = funded(); if (kind === 'site') s = buyPurchase(s, 'stand-eryops');
  if (kind === 'ticket') s = arriveVisitor(s); if (kind === 'collect') s = mvpSale(s, false);
  const original = s, spot = museumLayout(s).purchases[0];
  const candidate = kind === 'stand' ? buyPurchase(s, 'stand-eryops') : kind === 'site' ? buySite(s, 'eryops-dig')
    : kind === 'deposit' ? contributePurchase(s, 'stand-eryops', spot) : kind === 'collect' ? collectTicketRevenue(s)
      : payVisitor(s, s.visitors.nextId - 1, CASHIER_STATION, true);
  assert.notDeepEqual(candidate, original); reload(candidate);
  let raw = JSON.stringify(s), fail = true, effects = 0;
  const port = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fail) throw Error('quota'); raw = value; }, removeItem: () => { raw = ''; } };
  const commit = createCommitter<MvpSave>(port, () => {}); commit.enable();
  assert.equal(commit.commit(candidate, next => { s = next; effects++; }), 'failed'); assert.equal(s, original);
  assert.deepEqual(parseMvpSave(raw, 42), original);
  fail = false; commit.flush(); commit.flush(); assert.equal(effects, 1); assert.deepEqual(s, candidate); reload(s);
  assert.ok(commit.reset()); commit.commit(createMvpSave(42), next => { s = next; }); reload(s);
  assert.equal(s.economy.coins, 20); assert.deepEqual(offer(s), ['stand-dimetrodon']); commit.dispose();
});
test('loader preserves invalid storage and uses established paid-visitor retirement without losing ledger or cash', () => {
  const s = payVisitor(arriveVisitor(first()), 1, CASHIER_STATION, true);
  const port = (value: unknown) => ({ getItem: () => JSON.stringify(value), setItem: () => assert.fail(), removeItem: () => assert.fail() });
  const loaded = loadMvpSave(port(s), 42); assert.equal(loaded.kind, 'ready');
  if (loaded.kind === 'ready') { assert.deepEqual(loaded.save.visitors.visits, []); assert.equal(loaded.save.pendingTicketRevenue, 4); }
  assert.equal(loadMvpSave(port({ ...s, version: 26 }), 42).kind, 'invalid');
  assert.equal(placeOwnedGroup(createMvpSave(42), 'eryops', 'eryops-skull', 'eryops-skull').placed.length, 0);
});

for (const price of [2, 3, 5, 8]) test(`new sequential games reject financially balanced impossible ticket tier ${price}`, () => {
  const s = second();
  const forged = { ...s, pendingTicketRevenue: price,
    visitors: { version: 1, nextId: 2, visits: [], sales: { version: 1, counts: { [price]: 1 } } } };
  assert.equal(parseMvpSave(JSON.stringify(forged), 42), null);
});
test('site purchase can persist before initial pit closure when both displays and Eryops stand are valid', () => {
  let s = funded();
  // Finds may be recovered before the final cleanup/closure has completed.
  s = { ...s, closedSites: [] };
  s = reload(buyPurchase(s, 'stand-eryops')); s = reload(buySite(s, 'eryops-dig'));
  assert.equal(s.world.owned[0].paid, 20);
});
