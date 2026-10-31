import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE, ERYOPS_SITE, SITES } from '../src/content/journey.ts';
import { createTravelSave, migrateTravelSave, buySite, siteOwned, sitePurchaseStatus, travelTo, travelSpawn, travelBusy, campObstacles } from '../src/game/world-map.ts';
import type { TravelSave } from '../src/game/world-map.ts';
import { advanceMuseum, museumJourney, buyPurchase, placeOwnedGroup, purchaseStatus, createMuseumSave } from '../src/game/purchases.ts';
import type { MuseumSave } from '../src/game/purchases.ts';
import { freshJourney, digAt, brush } from '../src/game/journey.ts';
import { stepCompletion } from '../src/game/site-completion.ts';
import type { CleanupPop } from '../src/game/site-completion.ts';
import { createGameSave } from '../src/game/economy.ts';
import { parseTravelSave, loadTravelSave } from '../src/persistence/travel-save.ts';
import { parseMuseumSave } from '../src/persistence/museum-save.ts';
import { createCommitter } from '../src/app/commit.ts';
import { isWalkable, destinationAt } from '../src/game/navigation.ts';

const reload = (save: TravelSave) => { assert.deepEqual(parseTravelSave(JSON.stringify(save), 999), save); return save; };
function completedFirst(seed: number): TravelSave {
  return advanceMuseum(createTravelSave(seed), { ...freshJourney(),
    dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] }) as TravelSave;
}
function funded() {
  let save = completedFirst(0), seed = 0;
  while (save.economy.coins < 32) save = completedFirst(++seed);
  save = buyPurchase(save, 'stand-trilobite');
  return advanceMuseum(save, placeOwnedGroup(save, 'trilobite', 'trilobite-whole', 'trilobite-whole')) as TravelSave;
}
test('first site is free; opening the second requires closure, a display and 24 coins', () => {
  let save = reload(createTravelSave(42));
  assert.equal(siteOwned(save, SITE.id), true);
  assert.equal(sitePurchaseStatus(save, ERYOPS_SITE.id), 'siteFirst');
  save = completedFirst(42);
  assert.equal(sitePurchaseStatus(save, ERYOPS_SITE.id), 'displayFirst');
  save = reload(funded());
  const poor = { ...save, economy: { ...save.economy, coins: 23 } };
  assert.equal(sitePurchaseStatus(poor, ERYOPS_SITE.id), 'insufficient');
  assert.equal(buySite(poor, ERYOPS_SITE.id), poor);
  const bought = reload(buySite(save, ERYOPS_SITE.id));
  assert.equal(bought.economy.coins, save.economy.coins - 24);
  assert.deepEqual(bought.world.location, { kind: 'hub' });
  assert.equal(buySite(bought, ERYOPS_SITE.id), bought);
  for (const id of ['future-site-03', 'missing']) {
    assert.equal(buySite(save, id), save);
    assert.equal(travelTo(save, { kind: 'site-camp', siteId: id }), save);
  }
});
test('map travel requires ownership, saves a camp, and keeps museum and first-site progress', () => {
  const save = funded();
  assert.equal(travelTo(save, { kind: 'site-camp', siteId: ERYOPS_SITE.id }), save);
  let next = reload(travelTo(buySite(save, ERYOPS_SITE.id), { kind: 'site-camp', siteId: ERYOPS_SITE.id }));
  assert.equal(next.room, 'outdoors'); assert.equal(next.activeSiteId, ERYOPS_SITE.id);
  assert.deepEqual(next.dig, save.dig); assert.deepEqual(next.placed, save.placed); assert.deepEqual(next.collected, save.collected);
  assert.equal(travelTo(next, { kind: 'site-pit', siteId: SITE.id }), next);
  next = reload(travelTo(next, { kind: 'site-pit', siteId: ERYOPS_SITE.id }));
  const firstBefore = { ...next.dig };
  const cell = ERYOPS_SITE.cells[0];
  for (let i = 0; i < 2; i++) next = reload(advanceMuseum(next, digAt(museumJourney(next), cell)) as TravelSave);
  assert.equal(next.dig[cell.id], 0.5);
  for (const cell of SITE.cells) assert.equal(next.dig[cell.id], firstBefore[cell.id]);
  const coins = next.economy.coins;
  next = reload(travelTo(next, { kind: 'hub' }));
  next = reload(travelTo(next, { kind: 'site-camp', siteId: ERYOPS_SITE.id }));
  assert.equal(next.economy.coins, coins); assert.equal(next.dig[cell.id], 0.5);
});
test('automatic cleanup and exit block map transactions; completed camps remain visitable', () => {
  let save = travelTo(createTravelSave(42), { kind: 'site-camp', siteId: SITE.id });
  save = travelTo(save, { kind: 'site-pit', siteId: SITE.id });
  save = advanceMuseum(save, { ...museumJourney(save), collected: [...SITE.requiredDiscoveryIds],
    dig: Object.fromEntries(SITE.cells.filter(cell => cell.discoveryId).map(cell => [cell.id, 1])) }) as TravelSave;
  for (const phaseSave of [save, { ...save, dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])) },
    { ...save, room: 'outdoors' as const, dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])) }]) {
    assert.equal(travelBusy(phaseSave), true);
    assert.equal(travelTo(phaseSave, { kind: 'hub' }), phaseSave);
    assert.equal(buySite(phaseSave, ERYOPS_SITE.id), phaseSave);
  }
  const complete = reload(travelTo(completedFirst(42), { kind: 'site-camp', siteId: SITE.id }));
  assert.equal(travelBusy(complete), false);
  assert.equal(travelTo(complete, { kind: 'site-pit', siteId: SITE.id }), complete);
  reload(travelTo(complete, { kind: 'hub' }));
});
test('all camp, pit and hub reload spawns are walkable and outside travel triggers', () => {
  let save = buySite(funded(), ERYOPS_SITE.id);
  for (const site of SITES) {
    save = reload(travelTo(save, { kind: 'site-camp', siteId: site.id }));
    const point = travelSpawn(save);
    assert.ok(isWalkable(point, 'outdoors', campObstacles(site.id)));
    assert.equal(destinationAt(point, 'outdoors'), null);
    const pit = travelTo(save, { kind: 'site-pit', siteId: site.id });
    if (pit !== save) { reload(pit); assert.equal(destinationAt(travelSpawn(pit), 'excavation'), null); }
  }
  save = reload(travelTo(save, { kind: 'hub' }));
  assert.equal(destinationAt(travelSpawn(save), 'museum'), null);
});
test('migration preserves earned access only, without charging or replaying rewards', () => {
  const oldFresh = createMuseumSave(42);
  assert.deepEqual(migrateTravelSave(oldFresh).world.owned, []);
  let old = advanceMuseum(oldFresh, { ...museumJourney(completedFirst(42)) }) as MuseumSave;
  let migrated = parseTravelSave(JSON.stringify(old), 999)!;
  assert.equal(migrated.world.owned[0].source, 'legacy'); assert.equal(migrated.world.owned[0].paid, 0);
  assert.deepEqual(migrated.economy, old.economy); reload(migrated);
  old = advanceMuseum(old, { ...museumJourney(old), room: 'excavation', activeSiteId: ERYOPS_SITE.id }) as MuseumSave;
  migrated = parseTravelSave(JSON.stringify(old), 999)!; reload(migrated);
  assert.deepEqual(migrated.world.location, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  const older = createGameSave(freshJourney(), 42);
  migrated = parseTravelSave(JSON.stringify(older), 99)!; reload(migrated);
  assert.equal(migrated.museum.owned.length, 4); assert.deepEqual(migrated.world.owned, []);
  assert.equal(parseMuseumSave(JSON.stringify(migrated), 42), null);
});
test('bad location recovers at hub without altering coins, receipts or progress; closed pit restores to its camp', () => {
  const save = buySite(funded(), ERYOPS_SITE.id);
  for (const location of [null, {}, { kind: 'gone' }, { kind: 'site-camp', siteId: 'removed-site' }, { kind: 'site-pit', siteId: 'future-site-03' }]) {
    const restored = parseTravelSave(JSON.stringify({ ...save, activeSiteId: 'removed-site', world: { ...save.world, location } }), 42)!;
    assert.ok(restored); assert.deepEqual(restored.world.location, { kind: 'hub' });
    assert.deepEqual(restored.economy, save.economy); assert.deepEqual(restored.dig, save.dig); assert.deepEqual(restored.museum, save.museum);
    reload(restored);
  }
  const unowned = createTravelSave(42);
  const restored = parseTravelSave(JSON.stringify({ ...unowned, activeSiteId: ERYOPS_SITE.id, world: { ...unowned.world, location: { kind: 'site-camp', siteId: ERYOPS_SITE.id } } }), 42)!;
  assert.deepEqual(restored.world.location, { kind: 'hub' });
  const closed = parseTravelSave(JSON.stringify({ ...save, world: { ...save.world, location: { kind: 'site-pit', siteId: SITE.id } } }), 42)!;
  assert.equal(closed.room, 'outdoors'); assert.equal(closed.world.location.kind, 'site-camp'); reload(closed);
});
test('schema 15 rejects invalid coins, receipts, progress, unearned unlocks and future schemas', () => {
  const save = buySite(funded(), ERYOPS_SITE.id), fresh = createTravelSave(42);
  const invalid = [
    { ...save, version: 16 },
    { ...save, world: { ...save.world, owned: [...save.world.owned, ...save.world.owned] } },
    { ...save, world: { ...save.world, owned: [{ id: 'future-site-03', source: 'purchase', paid: 24 }] } },
    { ...save, world: { ...save.world, owned: [{ id: ERYOPS_SITE.id, source: 'purchase', paid: 1 }] } },
    { ...fresh, world: { ...fresh.world, owned: [{ id: ERYOPS_SITE.id, source: 'legacy', paid: 0 }] } },
    { ...save, placed: [] }, { ...save, closedSites: [] }, { ...save, dig: {} },
    { ...save, economy: { ...save.economy, coins: save.economy.coins + 1 } },
  ];
  const progressed = travelTo(save, { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  invalid.push({ ...progressed, world: { ...progressed.world, owned: [], location: { kind: 'hub' } } });
  for (const value of invalid) assert.equal(parseTravelSave(JSON.stringify(value), 42), null);
});
test('Eryops stand requires purchased or migrated site access, even after the first site closes', () => {
  const save = funded();
  const wing = { ...save, museum: { ...save.museum, owned: [...save.museum.owned, { id: 'west-wing' as const, source: 'purchase' as const, paid: 18 }] } };
  assert.equal(purchaseStatus(wing, 'stand-eryops'), 'siteFirst');
  assert.notEqual(purchaseStatus(buySite(wing, ERYOPS_SITE.id), 'stand-eryops'), 'siteFirst');
});
test('failed site purchase and travel publish only after a successful retry; reset drops pending travel', () => {
  let live = funded(), raw = '', fail = false, effects = 0;
  const port = { getItem: () => raw || null, setItem(_key: string, value: string) { if (fail) throw Error('quota'); raw = value; }, removeItem() { raw = ''; } };
  const commit = createCommitter<TravelSave>(port, () => {}); commit.enable();
  commit.commit(live, next => { live = next; });
  for (const candidate of [buySite(live, ERYOPS_SITE.id)]) {
    const before = live; fail = true;
    assert.equal(commit.commit(candidate, next => { live = next; effects++; }), 'failed');
    assert.equal(live, before); assert.equal(siteOwned(live, ERYOPS_SITE.id), false);
    fail = false; commit.flush(); commit.flush(); assert.equal(effects, 1); reload(live);
  }
  const before = live; fail = true;
  commit.commit(travelTo(live, { kind: 'site-camp', siteId: ERYOPS_SITE.id }), next => { live = next; effects++; });
  assert.equal(live, before); fail = false; commit.flush(); commit.flush(); assert.equal(effects, 2); reload(live);
  fail = true; commit.commit(travelTo(live, { kind: 'hub' }), next => { live = next; effects++; });
  commit.reset(); fail = false; commit.commit(createTravelSave(15), next => { live = next; }); commit.flush();
  assert.equal(effects, 2); assert.equal(live.world.location.kind, 'hub'); reload(live); commit.dispose();
});
test('loader preserves invalid storage and reports unavailable reads', () => {
  const port = { getItem: () => '{broken', setItem() { throw Error('must not write'); }, removeItem() { throw Error('must not remove'); } };
  assert.deepEqual(loadTravelSave(port, 42), { kind: 'invalid' });
  assert.deepEqual(loadTravelSave({ ...port, getItem() { throw Error('denied'); } }, 42), { kind: 'unavailable' });
  const fresh = loadTravelSave({ ...port, getItem: () => null }, 42);
  assert.equal(fresh.kind, 'ready'); if (fresh.kind === 'ready') reload(fresh.save);
});

test('unfinished cleaning survives travel between sites, museum and reload', () => {
  let save = travelTo(buySite(funded(), ERYOPS_SITE.id), { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  save = travelTo(save, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  const find = ERYOPS_SITE.requiredDiscoveryIds[0];
  const dig = { ...save.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, c.discoveryId === find ? 1 : 0.5])) };
  save = advanceMuseum(save, { ...museumJourney(save), dig }) as TravelSave;
  save = reload(advanceMuseum(save, brush(museumJourney(save), { x: 0.2, y: 0.3 }, { x: 0.4, y: 0.3 }, find)) as TravelSave);
  const mask = save.cleaning[find]; assert.ok(mask.length);
  for (const location of [{ kind: 'hub' as const }, { kind: 'site-camp' as const, siteId: SITE.id },
    { kind: 'site-camp' as const, siteId: ERYOPS_SITE.id }, { kind: 'site-pit' as const, siteId: ERYOPS_SITE.id }]) {
    save = reload(travelTo(save, location)); assert.deepEqual(save.cleaning[find], mask); assert.deepEqual(save.dig, dig);
  }
});

test('second-site automatic return saves its own camp and closure once, including reload mid-exit', () => {
  let save = travelTo(buySite(funded(), ERYOPS_SITE.id), { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  save = travelTo(save, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  save = reload(advanceMuseum(save, { ...museumJourney(save),
    dig: { ...save.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) },
    collected: [...save.collected, ...ERYOPS_SITE.requiredDiscoveryIds] }) as TravelSave);
  let position = { ...ERYOPS_SITE.interaction }, pop: CleanupPop | null = null, emerged = false;
  const coins = save.economy.coins;
  for (let i = 0; i < 200 && !save.closedSites.includes(ERYOPS_SITE.id); i++) {
    const step = stepCompletion(museumJourney(save), position, 0.05, pop, true);
    save = reload(advanceMuseum(save, step.state) as TravelSave); position = step.position; pop = step.pop;
    if (save.room === 'outdoors' && !emerged) {
      emerged = true; assert.deepEqual(save.world.location, { kind: 'site-camp', siteId: ERYOPS_SITE.id });
      position = travelSpawn(save); assert.equal(travelBusy(save), true);
    }
  }
  assert.ok(emerged); assert.deepEqual(save.closedSites, [SITE.id, ERYOPS_SITE.id]); assert.equal(save.economy.coins, coins);
  assert.equal(travelBusy(save), false); reload(travelTo(save, { kind: 'hub' }));
});
