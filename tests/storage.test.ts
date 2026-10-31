import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE, ERYOPS_SITE, CLEANING_AREAS, SITES } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { storageApproach } from '../src/content/storage.ts';
import { freshJourney, digAt, isUncovered } from '../src/game/journey.ts';
import { createGameSave } from '../src/game/economy.ts';
import { advanceMuseum, museumJourney } from '../src/game/purchases.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { travelTo } from '../src/game/world-map.ts';
import { buyHelper, assignHelper, startHelperTask, workHelper } from '../src/game/helpers.ts';
import { createHelperSimulation } from '../src/game/helper-simulation.ts';
import { storedFinds, carriedFinds, manualDiscovery, settleDeliveries, depositAtBox, brushStored, collectStored } from '../src/game/storage.ts';
import type { StorageSave } from '../src/game/storage.ts';
import { parseStorageSave, loadStorageSave } from '../src/persistence/storage-save.ts';
import { parseHelperSave } from '../src/persistence/helper-save.ts';
import { completionPhase, stepCompletion } from '../src/game/site-completion.ts';
import { createCommitter } from '../src/app/commit.ts';
import { isWalkable } from '../src/game/navigation.ts';
const id = ERYOPS_SITE.requiredDiscoveryIds[0];
const footprint = ERYOPS_SITE.cells.filter(c => c.discoveryId === id), last = footprint.at(-1)!;
const reload = (s: StorageSave) => { const parsed = parseStorageSave(JSON.stringify(s), 99); assert.ok(parsed); return parsed; };
function setup() {
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: EXHIBITS.slice(0, 2).flatMap(e => [...e.parts]) }, 42);
  let s = parseStorageSave(JSON.stringify(old), 42)!;
  for (let i = 0; i < 14; i++) { s = arriveVisitor(s); const visit = s.visitors.nextId - 1; s = finishVisit(payVisitor(s, visit, CASHIER_STATION, true), visit); }
  s = assignHelper(buyHelper(s), ERYOPS_SITE.id);
  s = travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }); s = travelTo(s, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  s = advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])),
    ...Object.fromEntries(footprint.slice(0, -1).map(c => [c.id, 1])) } }) as StorageSave;
  return reload(startHelperTask(s, last.id));
}
function reveal(s = setup()) { for (let i = 0; i < 120; i++) s = workHelper(s, last, 0.05); return reload(s); }
function clean(s: StorageSave, find = id) {
  for (let row = 0; row < 14; row++) s = brushStored(s, find, { x: 0, y: (row + 0.5) / 14 }, { x: 1, y: (row + 0.5) / 14 });
  return reload(s);
}
test('final helper exposure durably claims exactly one find before delivery or collection', () => {
  let s = setup(); assert.equal(isUncovered(museumJourney(s), id), false); assert.deepEqual(s.custody, {});
  for (let i = 0; i < 119; i++) s = workHelper(s, last, 0.05);
  assert.deepEqual(s.custody, {}); const done = workHelper(s, last, 0.05);
  assert.equal(done.dig[last.id], 1); assert.deepEqual(done.custody[id], { siteId: ERYOPS_SITE.id, location: 'delivery', helperId: 'helper-1' });
  assert.equal(done.collected.includes(id), false); assert.equal(manualDiscovery(done), undefined);
  assert.equal(workHelper(done, last, 0.05), done); assert.equal(startHelperTask(done, ERYOPS_SITE.cells[0].id), done);
  assert.equal(collectStored(done, id), done); reload(done);
});
test('delivery only deposits at the original box; travel, reassignment and reload preserve custody without income', () => {
  const s = reveal(), coins = s.economy.coins;
  assert.equal(depositAtBox(s, { x: 7, z: -3 }), s);
  const box = reload(depositAtBox(s, storageApproach(s))); assert.deepEqual(storedFinds(box), [id]);
  assert.equal(depositAtBox(box, storageApproach(box)), box); assert.equal(box.economy.coins, coins);
  for (const interrupted of [travelTo(s, { kind: 'hub' }), assignHelper(s, SITE.id), settleDeliveries(s)]) {
    const restored = reload(interrupted); assert.deepEqual(restored.custody[id], { siteId: ERYOPS_SITE.id, location: 'storage' });
    assert.equal(restored.economy.coins, coins); assert.equal(restored.collected.includes(id), false);
  }
  const result = loadStorageSave({ getItem: () => JSON.stringify(s), setItem() {}, removeItem() {} }, 99);
  assert.equal(result.kind, 'ready'); if (result.kind === 'ready') assert.deepEqual(result.save.custody, box.custody);
  const differentSite = travelTo(s, { kind: 'site-camp', siteId: SITE.id });
  assert.deepEqual(storedFinds(differentSite), []); assert.deepEqual(storedFinds(differentSite, ERYOPS_SITE.id), [id]);
});
test('dirty storage requires explicit cleaning and collection, retaining partial masks in camp through travel/reload', () => {
  let s = travelTo(reveal(), { kind: 'site-camp', siteId: ERYOPS_SITE.id }); const coins = s.economy.coins;
  assert.equal(collectStored(s, id), s);
  s = reload(brushStored(s, id, { x: 0.3, y: 0.4 }, { x: 0.6, y: 0.4 }));
  const mask = s.cleaning[id]; assert.ok(mask.length && mask.length < CLEANING_AREAS.length);
  const away = reload(travelTo(s, { kind: 'site-camp', siteId: SITE.id })); assert.deepEqual(away.cleaning[id], mask);
  assert.equal(brushStored(away, id, { x: 0, y: 0 }, { x: 1, y: 1 }), away); assert.equal(collectStored(away, id), away);
  s = clean(travelTo(away, { kind: 'site-camp', siteId: ERYOPS_SITE.id }));
  assert.equal(s.cleaning[id].length, CLEANING_AREAS.length); assert.equal(s.collected.includes(id), false);
  const collected = reload(collectStored(s, id)); assert.equal(collected.custody[id], undefined); assert.equal(collected.cleaning[id], undefined);
  assert.equal(collected.collected.filter(f => f === id).length, 1); assert.equal(collected.economy.coins, coins); assert.equal(collectStored(collected, id), collected);
});
test('player exposure wins contention and remains manual, including a started cleaning mask', () => {
  const s = setup();
  let player = digAt(digAt(museumJourney(s), last), last);
  player = { ...player, cleaning: { [id]: [CLEANING_AREAS[0]] } };
  const next = advanceMuseum(s, player) as StorageSave, helper = workHelper(next, last, 0.05);
  assert.deepEqual(helper.custody, {}); assert.equal(manualDiscovery(helper)?.id, id); assert.deepEqual(helper.cleaning[id], player.cleaning[id]);
  assert.equal(helper.helpers.owned[0].task, null); reload(helper);
});
test('carrying animation follows a walkable ladder route, pauses, and cannot dig before depositing', () => {
  let s = setup(); const sim = createHelperSimulation(); let sawCarry = false, prior: ReturnType<typeof sim.pose> = null;
  for (let i = 0; i < 900 && !storedFinds(s).includes(id); i++) {
    const before = s; s = sim.step(s, 0.05, true); const pose = sim.pose(); assert.ok(pose); assert.ok(isWalkable(pose, 'excavation'));
    if (prior) assert.ok(Math.hypot(pose.x - prior.x, pose.z - prior.z) <= 0.081);
    prior = structuredClone(pose);
    if (carriedFinds(s).length) { sawCarry = true; assert.equal(s.helpers.owned[0].task, null);
      const paused = sim.step(s, 1e6, false), p = structuredClone(sim.pose()); assert.deepEqual(sim.step(paused, 1e6, false), paused); assert.deepEqual(sim.pose(), p);
      if (carriedFinds(before).length) assert.deepEqual(s.dig, before.dig);
    }
  }
  assert.equal(sawCarry, true); assert.deepEqual(storedFinds(s), [id]); assert.equal(s.collected.includes(id), false); reload(s);
});
test('empty soil with stored finds stays open; manual collection of every find permits normal closure', () => {
  let s = reveal();
  s = advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) } }) as StorageSave;
  s = reload({ ...s, custody: Object.fromEntries(ERYOPS_SITE.requiredDiscoveryIds.map(id => [id, { siteId: ERYOPS_SITE.id, location: 'storage' as const }])) });
  assert.equal(completionPhase(museumJourney(s)), null);
  s = travelTo(s, { kind: 'site-camp', siteId: ERYOPS_SITE.id }); assert.equal(completionPhase(museumJourney(s)), null);
  for (const find of ERYOPS_SITE.requiredDiscoveryIds) s = reload(collectStored(clean(s, find), find));
  assert.deepEqual(s.custody, {}); assert.equal(completionPhase(museumJourney(s)), 'exit');
  let position = storageApproach(s);
  for (let i = 0; i < 300 && !s.closedSites.includes(ERYOPS_SITE.id); i++) {
    const next = stepCompletion(museumJourney(s), position, 0.05, null, true); position = next.position;
    s = advanceMuseum(s, next.state) as StorageSave;
  }
  assert.ok(reload(s).closedSites.includes(ERYOPS_SITE.id));
});
test('schema 18 rejects contradictory custody while recovering tasks and unavailable assignments independently', () => {
  const s = reveal(); assert.equal(parseHelperSave(JSON.stringify(s), 42), null);
  for (const patch of [{ siteId: SITE.id, location: 'storage' }, { siteId: 'unknown', location: 'storage' },
    { siteId: ERYOPS_SITE.id, location: 'delivery', helperId: 'unknown' }, { siteId: ERYOPS_SITE.id, location: 'bag' }]) {
    assert.equal(parseStorageSave(JSON.stringify({ ...s, custody: { [id]: patch } }), 42), null);
  }
  assert.equal(parseStorageSave(JSON.stringify({ ...s, collected: [...s.collected, id] }), 42), null);
  assert.equal(parseStorageSave(JSON.stringify({ ...s, cleaning: { [id]: [CLEANING_AREAS[0]] } }), 42), null);
  const hidden = setup(); assert.equal(parseStorageSave(JSON.stringify({ ...hidden, custody: s.custody }), 42), null);
  const unavailable = structuredClone(s); unavailable.helpers.owned[0].siteId = 'retired';
  const loaded = loadStorageSave({ getItem: () => JSON.stringify(unavailable), setItem() {}, removeItem() {} }, 42);
  assert.equal(loaded.kind, 'ready'); if (loaded.kind === 'ready') {
    assert.equal(loaded.save.helpers.owned[0].siteId, null); assert.deepEqual(loaded.save.custody[id], { siteId: ERYOPS_SITE.id, location: 'storage' });
  }
  const task = setup(); assert.ok(reload(task).helpers.owned[0].task); // exposure task rejected only by frozen schema 17
});
test('failed final exposure, delivery and collection retry once; reset cannot resurrect custody', () => {
  let s = setup(); for (let i = 0; i < 119; i++) s = workHelper(s, last, 0.05);
  let durable = JSON.stringify(s), fail = true, published = 0;
  const port = { getItem: () => durable, setItem(_key: string, raw: string) { if (fail) throw Error('quota'); durable = raw; }, removeItem() { durable = ''; } };
  const writer = createCommitter<StorageSave>(port, () => {}); writer.enable();
  const exposure = workHelper(s, last, 0.05);
  assert.equal(writer.commit(exposure, () => published++), 'failed'); assert.deepEqual(JSON.parse(durable).custody, {});
  fail = false; writer.flush(); writer.flush(); assert.equal(published, 1); assert.deepEqual(JSON.parse(durable).custody, exposure.custody);
  fail = true; assert.equal(writer.commit(settleDeliveries(exposure), () => published++), 'failed');
  assert.equal(JSON.parse(durable).custody[id].location, 'delivery'); fail = false; writer.flush(); assert.equal(published, 2);
  const cleaned = clean(JSON.parse(durable)); writer.commit(cleaned, () => {}); fail = true;
  assert.equal(writer.commit(collectStored(cleaned, id), () => published++), 'failed'); assert.equal(JSON.parse(durable).collected.includes(id), false);
  fail = false; writer.flush(); writer.flush(); assert.equal(published, 3); assert.equal(JSON.parse(durable).collected.includes(id), true);
  assert.equal(writer.reset(), true); writer.dispose(); assert.equal(durable, '');
});
test('migration adds no custody, helper or money to schemas 1–17, preserving existing 17 work', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = []; if (version >= 8) old.activeSiteId = SITE.id;
    const s = parseStorageSave(JSON.stringify(old), 42)!; assert.ok(s); assert.deepEqual(s.custody, {}); assert.deepEqual(s.helpers.owned, []); assert.equal(s.economy.coins, 20);
  }
  const old = parseHelperSave(JSON.stringify(createGameSave(freshJourney(), 42)), 42)!;
  const migrated = parseStorageSave(JSON.stringify(old), 42)!; assert.deepEqual(migrated.custody, {}); assert.deepEqual(migrated.economy, old.economy);
  assert.deepEqual(migrated.helpers, old.helpers); assert.deepEqual(reload(migrated), migrated);
  const current = setup(), { custody: _custody, ...withoutCustody } = current;
  const ordinaryCell = ERYOPS_SITE.cells.find(c => !c.discoveryId)!;
  const oldOwned = parseHelperSave(JSON.stringify({ ...withoutCustody, version: 17, helpers: { ...current.helpers,
    owned: current.helpers.owned.map(h => ({ ...h, task: null, phase: 'idle' })) } }), 42)!;
  assert.ok(oldOwned);
  let retained = startHelperTask(oldOwned, ordinaryCell.id);
  for (let i = 0; i < 72; i++) retained = workHelper(retained, ordinaryCell, 0.05);
  assert.ok(retained.helpers.owned[0].task);
  const restored = parseStorageSave(JSON.stringify(retained), 42)!;
  assert.deepEqual(restored.helpers.owned[0].task, retained.helpers.owned[0].task);
  assert.deepEqual(restored.economy, retained.economy); assert.deepEqual(restored.custody, {});
  assert.equal(SITES.length, 2);
});
