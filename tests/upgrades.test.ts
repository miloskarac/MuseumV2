import test from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES } from '../src/content/upgrades.ts';
import { SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { freshJourney, stepDigging } from '../src/game/journey.ts';
import type { DigSwing } from '../src/game/journey.ts';
import { createGameSave } from '../src/game/economy.ts';
import { createMuseumSave, advanceMuseum, museumJourney, buyPurchase, placeOwnedGroup } from '../src/game/purchases.ts';
import { createTravelSave, buySite, travelTo } from '../src/game/world-map.ts';
import { createTicketSave, arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { createHelperSave, buyHelper, assignHelper, startHelperTask, workHelper } from '../src/game/helpers.ts';
import { createStorageSave, settleDeliveries, brushStored, collectStored } from '../src/game/storage.ts';
import { createUpgradeSave, buyUpgrade, upgradeStatus } from '../src/game/upgrades.ts';
import type { UpgradeSave } from '../src/game/upgrades.ts';
import { playerWalkRate, playerDigRate, helperWorkRate } from '../src/game/upgrade-stats.ts';
import { parseUpgradeSave, loadUpgradeSave } from '../src/persistence/upgrade-save.ts';
import { parseStorageSave } from '../src/persistence/storage-save.ts';
import { createCommitter } from '../src/app/commit.ts';
import { movePlayer, WALK_SPEED, isWalkable } from '../src/game/navigation.ts';
import { createHelperSimulation } from '../src/game/helper-simulation.ts';

const reload = (s: UpgradeSave) => { const r = parseUpgradeSave(JSON.stringify(s), 42); assert.ok(r); return r; };
function sale(s: UpgradeSave) { s = arriveVisitor(s); const id = s.visitors.nextId - 1; return finishVisit(payVisitor(s, id, CASHIER_STATION, true), id); }
function fixture() {
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: EXHIBITS.slice(0, 2).flatMap(e => [...e.parts]) }, 42);
  let s = parseUpgradeSave(JSON.stringify(old), 42)!;
  for (let i = 0; i < 50; i++) s = sale(s);
  return reload(s);
}
const pit = (s: UpgradeSave) => travelTo(travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }), { kind: 'site-pit', siteId: ERYOPS_SITE.id });
const work = (s: UpgradeSave, n: number, point = ERYOPS_SITE.cells[0]) => { for (let i = 0; i < n; i++) s = workHelper(s, point, 0.05); return s; };

test('upgrades require earned progress, useful work, funds and one unique receipt', () => {
  const fresh = createUpgradeSave(42);
  for (const id of ['boots', 'shovel']) { assert.equal(upgradeStatus(fresh, id), 'displayFirst'); assert.equal(buyUpgrade(fresh, id), fresh); }
  assert.equal(upgradeStatus(fresh, 'helper-tools'), 'helperFirst');
  let s = fixture(); assert.equal(upgradeStatus(s, 'unknown'), 'unknown');
  assert.equal(upgradeStatus(pit(s), 'boots'), 'notHere');
  assert.equal(upgradeStatus(s, 'helper-tools'), 'helperFirst');
  assert.equal(upgradeStatus({ ...s, closedSites: [SITE.id, ERYOPS_SITE.id] }, 'shovel'), 'exhausted');
  assert.equal(upgradeStatus({ ...s, closedSites: [SITE.id, ERYOPS_SITE.id] }, 'boots'), 'ready');
  s = buyHelper(s);
  for (const offer of UPGRADES) {
    const short = { ...s, economy: { ...s.economy, coins: offer.cost - 1 } };
    assert.equal(upgradeStatus(short, offer.id), 'insufficient'); assert.equal(buyUpgrade(short, offer.id), short);
    assert.equal(buyUpgrade({ ...s, economy: { ...s.economy, coins: offer.cost } }, offer.id).economy.coins, 0);
    const coins = s.economy.coins; s = reload(buyUpgrade(s, offer.id));
    assert.equal(s.economy.coins, coins - offer.cost); assert.equal(buyUpgrade(s, offer.id), s);
  }
  assert.equal(s.upgrades.owned.length, 3); assert.equal(playerWalkRate(s), 1.2); assert.equal(playerDigRate(s), 1.25); assert.equal(helperWorkRate(s), 1.25);
});

test('boots move 20 percent farther with collision substeps and frame-time limits intact', () => {
  const start = { x: 0, z: -4 }, direction = { x: 1, z: 0 };
  const base = movePlayer(start, direction, 0.05, 'museum', []);
  const fast = movePlayer(start, direction, 0.05, 'museum', [], undefined, WALK_SPEED * 1.2);
  assert.ok(Math.abs(fast.x / base.x - 1.2) < 1e-9);
  assert.deepEqual(movePlayer(start, direction, 9999, 'museum', [], undefined, WALK_SPEED * 1.2), fast);
  let p = { x: 0, z: -4 };
  const obstacle = [{ minX: 1, maxX: 1.02, minZ: -5, maxZ: -3 }];
  for (let i = 0; i < 100; i++) { p = movePlayer(p, direction, 0.05, 'museum', obstacle, undefined, WALK_SPEED * 1.2); assert.ok(isWalkable(p, 'museum', obstacle)); }
  assert.ok(p.x < 1);
});

test('shovel rate changes the shared animation clock, not hit strength or contact count', () => {
  for (const rate of [1, 1.25]) {
    let s = { ...freshJourney(), room: 'excavation' as const }, swing: DigSwing | null = null;
    const hits: number[] = [], cell = SITE.cells[0];
    for (let i = 1; i <= (rate === 1 ? 35 : 28); i++) {
      const result = stepDigging(s, cell, 0.05, swing, true, SITE, rate); s = result.state; swing = result.swing;
      if (result.hit) hits.push(i * 0.05);
    }
    assert.deepEqual(hits.map(n => Math.round(n * 100)), rate === 1 ? [75, 175] : [60, 140]);
    assert.equal(s.dig[cell.id], 1); assert.equal(Object.keys(s.dig).length, 1);
    assert.equal(stepDigging(s, cell, 999, swing, false, SITE, rate).swing, null);
  }
});

test('helper tools keep 60 percent work across purchase and reload and finish only remaining work', () => {
  let s = startHelperTask(pit(assignHelper(buyHelper(fixture()), ERYOPS_SITE.id)), ERYOPS_SITE.cells[0].id);
  s = work(s, 72); const before = s.helpers.owned[0].task!; assert.ok(Math.abs(before.work / before.required - 0.6) < 1e-9);
  s = travelTo(s, { kind: 'hub' }); const dig = s.dig, coins = s.economy.coins;
  s = reload(buyUpgrade(s, 'helper-tools')); assert.deepEqual(s.helpers.owned[0].task, before); assert.deepEqual(s.dig, dig); assert.equal(s.economy.coins, coins - 30);
  s = pit(s); s = work(s, 38); assert.ok(s.helpers.owned[0].task); s = reload(work(s, 1));
  assert.equal(s.helpers.owned[0].task, null); assert.equal(s.dig[ERYOPS_SITE.cells[0].id], 0.5);
  const reassigned = reload(assignHelper(s, SITE.id)); assert.deepEqual(reassigned.upgrades, s.upgrades);
  for (const partial of [false, true]) {
    let next = pit(assignHelper(buyUpgrade(buyHelper(fixture()), 'helper-tools'), ERYOPS_SITE.id));
    if (partial) next = advanceMuseum(next, { ...museumJourney(next), dig: { ...next.dig, [ERYOPS_SITE.cells[0].id]: 0.25 } }) as UpgradeSave;
    next = startHelperTask(next, ERYOPS_SITE.cells[0].id); next = work(next, (partial ? 48 : 96) - 1); assert.ok(next.helpers.owned[0].task);
    assert.equal(reload(work(next, 1)).helpers.owned[0].task, null);
  }
});

test('upgraded exposure, delivery, partial brushing and collection preserve receipts exactly once', () => {
  const id = ERYOPS_SITE.requiredDiscoveryIds[0], footprint = ERYOPS_SITE.cells.filter(c => c.discoveryId === id), cell = footprint.at(-1)!;
  let s = pit(assignHelper(buyUpgrade(buyHelper(fixture()), 'helper-tools'), ERYOPS_SITE.id));
  s = advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])),
    ...Object.fromEntries(footprint.slice(0, -1).map(c => [c.id, 1])) } }) as UpgradeSave;
  s = reload(work(startHelperTask(s, cell.id), 96, cell)); const receipt = s.upgrades;
  assert.equal(s.custody[id].location, 'delivery'); assert.equal(startHelperTask(s, cell.id), s);
  const loaded = loadUpgradeSave({ getItem: () => JSON.stringify(s), setItem() {}, removeItem() {} }, 42);
  assert.equal(loaded.kind, 'ready'); if (loaded.kind !== 'ready') return;
  s = loaded.save; assert.equal(s.custody[id].location, 'storage'); assert.deepEqual(s.upgrades, receipt);
  s = brushStored(s, id, { x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }); const mask = s.cleaning[id];
  s = reload(travelTo(s, { kind: 'hub' })); assert.deepEqual(s.cleaning[id], mask);
  s = buyUpgrade(s, 'boots'); s = travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  for (let row = 0; row < 14; row++) s = brushStored(s, id, { x: 0, y: (row + 0.5) / 14 }, { x: 1, y: (row + 0.5) / 14 });
  s = reload(collectStored(s, id)); assert.equal(s.upgrades.owned.length, 2); assert.equal(s.custody[id], undefined); assert.equal(collectStored(s, id), s);
});

test('schema 19 rejects forged upgrade receipts and balances; frozen schema 18 remains frozen', () => {
  const s = buyUpgrade(buyHelper(fixture()), 'helper-tools');
  assert.equal(parseStorageSave(JSON.stringify(s), 42), null);
  for (const change of [
    (v: any) => v.upgrades.owned.push(v.upgrades.owned[0]),
    (v: any) => v.upgrades.owned[0].paid = 0,
    (v: any) => v.upgrades.owned[0].helperId = 'helper-2',
    (v: any) => v.upgrades.owned[0].id = 'future',
    (v: any) => v.upgrades.owned[0].level = 2,
    (v: any) => v.upgrades.level = 1,
    (v: any) => v.upgrades.owned = null,
    (v: any) => v.economy.coins++,
    (v: any) => v.helpers.owned = [],
    (v: any) => v.version = 20,
  ]) { const bad = structuredClone(s); change(bad); assert.equal(parseUpgradeSave(JSON.stringify(bad), 42), null); }
  const noDisplay = createUpgradeSave(42); noDisplay.economy.coins = 4; noDisplay.upgrades.owned = [{ id: 'boots', paid: 16 }];
  assert.equal(parseUpgradeSave(JSON.stringify(noDisplay), 42), null);
});

test('schemas 1 through 18 migrate without free upgrades, refunds or task loss', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = []; if (version >= 8) old.activeSiteId = SITE.id;
    const s = parseUpgradeSave(JSON.stringify(old), 42)!; assert.ok(s); assert.deepEqual(s.upgrades.owned, []); assert.equal(s.economy.coins, 20);
  }
  const oldSaves = [createGameSave(freshJourney(), 42), createMuseumSave(42), createTravelSave(42), createTicketSave(42), createHelperSave(42), createStorageSave(42)];
  for (const old of oldSaves) { const s = parseUpgradeSave(JSON.stringify(old), 42)!; assert.ok(s); assert.deepEqual(s.upgrades.owned, []); assert.deepEqual(s.economy, old.economy); reload(s); }
  const current = work(startHelperTask(pit(assignHelper(buyHelper(fixture()), ERYOPS_SITE.id)), ERYOPS_SITE.cells[0].id), 72);
  const { upgrades: _upgrades, ...base } = current;
  const migrated = parseUpgradeSave(JSON.stringify({ ...base, version: 18 }), 42)!;
  assert.deepEqual(migrated.helpers.owned[0].task, current.helpers.owned[0].task); assert.deepEqual(migrated.economy, current.economy);
});

test('failed upgrade purchase cannot publish stats, charge twice or survive a confirmed reset', () => {
  let live = fixture(), raw = JSON.stringify(live), fail = true, published = 0;
  const port = { getItem: () => raw, setItem(_key: string, value: string) { if (fail) throw Error('quota'); raw = value; }, removeItem() { raw = ''; } };
  const writer = createCommitter<UpgradeSave>(port, () => {}); writer.enable();
  assert.equal(writer.commit(buyUpgrade(live, 'boots'), saved => { live = saved; published++; }), 'failed');
  assert.equal(playerWalkRate(live), 1); assert.equal(writer.canMutate(), false);
  fail = false; writer.flush(); writer.flush(); assert.equal(published, 1); assert.equal(playerWalkRate(live), 1.2); reload(live);
  fail = true; writer.commit(buyUpgrade(live, 'shovel'), saved => { live = saved; published++; }); assert.equal(writer.reset(), true);
  fail = false; writer.commit(createUpgradeSave(42), saved => live = saved); writer.flush();
  assert.equal(published, 1); assert.equal(playerDigRate(live), 1); assert.equal(playerWalkRate(live), 1); writer.dispose();
});

test('upgraded work remains paused without eligibility and never catches up hidden time', () => {
  let s = pit(assignHelper(buyUpgrade(buyHelper(fixture()), 'helper-tools'), ERYOPS_SITE.id));
  s = startHelperTask(s, ERYOPS_SITE.cells[0].id); s = work(s, 20);
  const sim = createHelperSimulation(), task = s.helpers.owned[0].task;
  for (let i = 0; i < 100; i++) s = sim.step(s, 1000, false);
  assert.deepEqual(s.helpers.owned[0].task, task);
  const away = travelTo(s, { kind: 'hub' }); assert.equal(workHelper(away, ERYOPS_SITE.cells[0], 1000), away);
  const one = workHelper(s, ERYOPS_SITE.cells[0], 1000); assert.ok(Math.abs(one.helpers.owned[0].task!.work - task!.work - 0.0625) < 1e-9);
});

test('every permitted optional-spending order retains zero-soil-income access to required purchases', () => {
  for (const first of ['stand-dimetrodon', 'stand-trilobite']) {
    const journey = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] };
    let initial = { ...createUpgradeSave(42), ...journey, version: 19 as const, economy: createGameSave(journey, 42).economy };
    initial = buyPurchase(initial, first);
    const firstExhibit = first === 'stand-dimetrodon' ? EXHIBITS[0] : EXHIBITS[1];
    for (const part of firstExhibit.parts) initial = advanceMuseum(initial, placeOwnedGroup(initial, firstExhibit.id, part, part)) as UpgradeSave;
    const second = first === 'stand-dimetrodon' ? 'stand-trilobite' : 'stand-dimetrodon';
    const offers = [{ id: second, cost: first === 'stand-dimetrodon' ? 8 : 12 }, { id: 'site', cost: 24 }, { id: 'west-wing', cost: 18 },
      { id: 'stand-eryops', cost: 12 }, { id: 'helper', cost: 60 }, ...UPGRADES];
    const queue = [{ save: reload(initial), mask: 0 }], seen = new Set<string>(); let completed = 0;
    while (queue.length) {
      const { save, mask } = queue.shift()!, key = `${mask}:${save.economy.coins}`;
      if (seen.has(key)) continue; seen.add(key);
      if (mask === (1 << offers.length) - 1) { completed++; continue; }
      let successors = 0;
      offers.forEach((o, i) => {
        if (mask & (1 << i)) return;
        let funded = save; while (funded.economy.coins < o.cost) { const next = sale(funded); assert.ok(next.economy.coins > funded.economy.coins); funded = next; }
        let next = o.id === 'site' ? buySite(funded, ERYOPS_SITE.id) : o.id === 'helper' ? buyHelper(funded)
          : UPGRADES.some(u => u.id === o.id) ? buyUpgrade(funded, o.id) : buyPurchase(funded, o.id);
        if (next === funded) return;
        if (o.id === second) {
          const exhibit = firstExhibit.id === 'dimetrodon' ? EXHIBITS[1] : EXHIBITS[0];
          for (const part of exhibit.parts) next = advanceMuseum(next, placeOwnedGroup(next, exhibit.id, part, part)) as UpgradeSave;
        }
        assert.equal(Object.values(next.economy.sites).flatMap(s => s.claimed).length, 0);
        queue.push({ save: reload(next), mask: mask | (1 << i) }); successors++;
      });
      assert.ok(successors, `deadlock at ${mask}`);
    }
    assert.ok(completed > 0); assert.ok(seen.size > 50);
  }
});
