import test from 'node:test';
import assert from 'node:assert/strict';
import { SITE, ERYOPS_SITE, SITES } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { HELPERS } from '../src/content/helpers.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney, digAt, isUncovered, groundHeight } from '../src/game/journey.ts';
import { advanceMuseum, museumJourney } from '../src/game/purchases.ts';
import { travelTo } from '../src/game/world-map.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { assignHelper, buyHelper, createHelperSave, helperLayer, helperPurchaseStatus, pauseHelper, startHelperTask, workHelper } from '../src/game/helpers.ts';
import type { HelperSave } from '../src/game/helpers.ts';
import { createHelperSimulation, helperPath, helperWorkRoute } from '../src/game/helper-simulation.ts';
import { parseHelperSave, loadHelperSave } from '../src/persistence/helper-save.ts';
import { parseTicketSave } from '../src/persistence/ticket-save.ts';
import { createCommitter } from '../src/app/commit.ts';
import { isWalkable } from '../src/game/navigation.ts';

function fixture() {
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: EXHIBITS.slice(0, 2).flatMap(e => [...e.parts]) }, 42);
  let save = parseHelperSave(JSON.stringify(old), 42)!; assert.ok(save);
  for (let i = 0; i < 14; i++) { save = arriveVisitor(save); const id = save.visitors.nextId - 1; save = finishVisit(payVisitor(save, id, CASHIER_STATION, true), id); }
  return save;
}
function pit() {
  let save = assignHelper(buyHelper(fixture()), ERYOPS_SITE.id);
  save = travelTo(save, { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  return travelTo(save, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
}
const reload = (save: HelperSave) => { const parsed = parseHelperSave(JSON.stringify(save), 999); assert.ok(parsed); return parsed; };
const cell = ERYOPS_SITE.cells[0];
const task = (save: HelperSave) => save.helpers.owned[0].task!;
function work(save: HelperSave, ticks: number, position = cell) { for (let i = 0; i < ticks; i++) save = workHelper(save, position, 0.05); return save; }

test('helper purchase is permanent, gated, paid once and limited to one available helper', () => {
  const fresh = createHelperSave(42); assert.equal(helperPurchaseStatus(fresh), 'displays'); assert.equal(buyHelper(fresh), fresh);
  const ready = fixture(); assert.equal(ready.economy.coins, 62); assert.equal(helperPurchaseStatus(ready), 'ready');
  assert.equal(helperPurchaseStatus({ ...ready, world: { ...ready.world, owned: [] } }), 'site');
  assert.equal(helperPurchaseStatus({ ...ready, economy: { ...ready.economy, coins: 59 } }), 'insufficient');
  const owned = reload(buyHelper(ready)); assert.equal(owned.economy.coins, 2); assert.equal(owned.helpers.owned.length, 1);
  assert.equal(buyHelper(owned), owned); assert.equal(HELPERS.maximumOwned, 2);
  assert.deepEqual(owned.collected, ready.collected); assert.deepEqual(owned.placed, ready.placed);
  assert.equal(helperPurchaseStatus({ ...ready, closedSites: SITES.map(s => s.id) }), 'exhausted');
});
test('assignment validates sites, preserves ownership and clears only private work on change', () => {
  let save = startHelperTask(pit(), cell.id); save = work(save, 72);
  assert.ok(Math.abs(task(save).work / task(save).required - 0.6) < 1e-9);
  assert.equal(assignHelper(save, 'future-site-03'), save); assert.equal(assignHelper(save, 'bad'), save);
  assert.equal(assignHelper(save, ERYOPS_SITE.id), save);
  const moved = reload(assignHelper(save, SITE.id)); assert.equal(moved.helpers.owned[0].task, null);
  assert.deepEqual(moved.dig, save.dig); assert.equal(moved.economy.coins, save.economy.coins);
  const unassigned = assignHelper(moved, null); assert.equal(unassigned.helpers.owned[0].siteId, null);
});
test('six seconds completes one layer atomically, partial player work needs three seconds, replay cannot reward', () => {
  let save = startHelperTask(pit(), cell.id); assert.equal(task(save).required, 6);
  save = work(save, 119); assert.equal(save.dig[cell.id], undefined);
  const done = reload(work(save, 1)); assert.equal(done.dig[cell.id], 0.5); assert.equal(done.helpers.owned[0].task, null);
  assert.equal(workHelper(done, cell, 0.05), done); assert.equal(startHelperTask(done, cell.id), done);
  const partial = advanceMuseum(pit(), digAt(museumJourney(pit()), cell)) as HelperSave;
  save = startHelperTask(partial, cell.id); assert.equal(task(save).required, 3);
  assert.equal(work(save, 59).dig[cell.id], 0.25); assert.equal(reload(work(save, 60)).dig[cell.id], 0.5);
});
test('60 percent survives pause, travel and reload with no elapsed-time work', () => {
  let save = work(startHelperTask(pit(), cell.id), 72), retained = task(save).work;
  save = travelTo(save, { kind: 'hub' }); assert.equal(save.helpers.owned[0].phase, 'paused');
  save = reload(save); assert.equal(task(save).work, retained); assert.equal(workHelper(save, cell, 99999), save);
  save = travelTo(save, { kind: 'site-camp', siteId: ERYOPS_SITE.id }); save = travelTo(save, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  assert.equal(task(save).work, retained);
  const sim = createHelperSimulation(); const before = save;
  save = sim.step(save, 99999, true); assert.equal(task(save).work, retained); // walk first, one bounded step
  assert.ok(Math.hypot(sim.pose()!.x - ERYOPS_SITE.interaction.x, sim.pose()!.z - ERYOPS_SITE.interaction.z) <= 0.081);
  assert.deepEqual(pauseHelper(before), before);
});
test('player changes invalidate private work without erasing the accepted player hit', () => {
  const save = work(startHelperTask(pit(), cell.id), 119);
  const player = advanceMuseum(save, digAt(museumJourney(save), cell)) as HelperSave;
  const next = workHelper(player, cell, 0.05); assert.equal(next.dig[cell.id], 0.25); assert.equal(next.helpers.owned[0].task, null);
  assert.equal(task(startHelperTask(next, cell.id)).required, 3);
  const loaded = reload(player); assert.equal(loaded.helpers.owned[0].task, null); assert.equal(loaded.dig[cell.id], 0.25);
});
test('reach and whole-layer rules prevent remote and lower-layer work', () => {
  const save = startHelperTask(pit(), cell.id);
  assert.equal(task(workHelper(save, { x: 7, z: 5 }, 0.05)).work, 0);
  const done = work(save, 120); assert.equal(helperLayer(done, ERYOPS_SITE.id, cell.id), null);
  const inactive = assignHelper(done, SITE.id); assert.equal(startHelperTask(inactive, cell.id), inactive);
});
test('QA helper stops before fossil exposure; manual discovery remains possible', () => {
  let save = pit(); const state = museumJourney(save);
  save = advanceMuseum(save, { ...state, dig: { ...state.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])) } }) as HelperSave;
  let cleared = 0;
  for (const c of ERYOPS_SITE.cells) {
    if (!helperLayer(save, ERYOPS_SITE.id, c.id)) continue;
    const next = work(startHelperTask(save, c.id), 120, c);
    if (next.dig[c.id] === 1) cleared++; save = reload(next);
  }
  assert.ok(cleared > 20); assert.ok(ERYOPS_SITE.requiredDiscoveryIds.every(id => !isUncovered(museumJourney(save), id)));
  assert.deepEqual(save.collected, [...SITE.requiredDiscoveryIds]);
  const remaining = ERYOPS_SITE.cells.find(c => save.dig[c.id] !== 1)!;
  const manual = digAt(digAt(museumJourney(save), remaining), remaining);
  assert.equal(manual.dig[remaining.id], 1);
});
test('helper routes cross the ladder opening, stay walkable, and resume work only on arrival', () => {
  let save = pit(); const sim = createHelperSimulation();
  for (const c of ERYOPS_SITE.cells) {
    const workRoute = helperWorkRoute(save, ERYOPS_SITE.interaction, c.id); assert.ok(workRoute);
    assert.ok(Math.abs(Math.hypot(workRoute.point.x - c.x, workRoute.point.z - c.z) - 0.8) < 1e-9);
    const path = helperPath(save, ERYOPS_SITE.interaction, c); assert.ok(path.length);
    let from = ERYOPS_SITE.interaction;
    for (const to of path) {
      for (let f = 0; f <= 1; f += 0.01) assert.ok(isWalkable({ x: from.x + (to.x - from.x) * f, z: from.z + (to.z - from.z) * f }, 'excavation'));
      from = { ...to, radius: 0.8 };
    }
  }
  for (let i = 0; i < 600; i++) {
    const before = save; save = sim.step(save, 0.05, true);
    assert.ok(isWalkable(sim.pose()!, 'excavation')); assert.ok(Number.isFinite(groundHeight(museumJourney(save), sim.pose()!)));
    if (sim.pose()!.moving && before.helpers.owned[0].task?.id === save.helpers.owned[0].task?.id)
      assert.equal(before.helpers.owned[0].task?.work, save.helpers.owned[0].task?.work);
  }
  assert.ok(ERYOPS_SITE.cells.some(c => save.dig[c.id] === 0.5));
  const paused = sim.step(save, 30, false), still = structuredClone(sim.pose());
  for (let i = 0; i < 100; i++) assert.deepEqual(sim.step(paused, 30, false), paused);
  assert.deepEqual(sim.pose(), still); reload(paused);
});
test('schema 17 validates helper payments, normalizes tasks separately, and preserves old migration contracts', () => {
  const save = work(startHelperTask(pit(), cell.id), 72);
  assert.equal(parseTicketSave(JSON.stringify(save), 42), null);
  for (const patch of [{ paid: 0 }, { id: 'helper-2' }]) {
    const bad = structuredClone(save); Object.assign(bad.helpers.owned[0], patch); assert.equal(parseHelperSave(JSON.stringify(bad), 42), null);
  }
  const duplicate = structuredClone(save); duplicate.helpers.owned.push(duplicate.helpers.owned[0]); assert.equal(parseHelperSave(JSON.stringify(duplicate), 42), null);
  const inflated = structuredClone(save); inflated.economy.coins++; assert.equal(parseHelperSave(JSON.stringify(inflated), 42), null);
  for (const patch of [{ cellId: 'retired' }, { layer: 99 }, { start: 1 }, { work: -1 }, { work: 8 }, { required: '6' }, { id: 0 }]) {
    const bad = structuredClone(save); Object.assign(bad.helpers.owned[0].task!, patch);
    const parsed = reload(bad); assert.equal(parsed.helpers.owned[0].task, null); assert.equal(parsed.economy.coins, save.economy.coins); assert.deepEqual(parsed.dig, save.dig);
  }
  const removed = structuredClone(save); removed.helpers.owned[0].siteId = 'retired-site';
  const loaded = loadHelperSave({ getItem: () => JSON.stringify(removed), setItem() {}, removeItem() {} }, 99);
  assert.equal(loaded.kind, 'ready'); if (loaded.kind === 'ready') { assert.equal(loaded.unassigned, true); assert.equal(loaded.save.helpers.owned[0].siteId, null); }
  const old = parseTicketSave(JSON.stringify(createGameSave(freshJourney(), 42)), 42)!;
  const migrated = parseHelperSave(JSON.stringify(old), 42)!; assert.deepEqual(migrated.helpers.owned, []); assert.equal(migrated.economy.coins, old.economy.coins);
  assert.deepEqual(reload(migrated), migrated);
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = []; if (version >= 8) old.activeSiteId = SITE.id;
    const next = parseHelperSave(JSON.stringify(old), 42)!; assert.ok(next); assert.deepEqual(next.helpers.owned, []); assert.equal(next.economy.coins, 20); reload(next);
  }
  for (const raw of ['null', '{}', '{', '{"version":18}'])
    assert.equal(loadHelperSave({ getItem: () => raw, setItem() {}, removeItem() {} }, 42).kind, 'invalid');
});
test('failed helper clearing retains one exact candidate; retry and reset cannot duplicate soil or ownership', () => {
  let durable = JSON.stringify(work(startHelperTask(pit(), cell.id), 119)), published = 0, fail = true;
  const port = { getItem: () => durable, setItem(_key: string, raw: string) { if (fail) throw Error('quota'); durable = raw; }, removeItem() { durable = ''; } };
  const committer = createCommitter<HelperSave>(port, () => {}); committer.enable();
  const before = JSON.parse(durable), candidate = workHelper(before, cell, 0.05);
  assert.equal(committer.commit(candidate, () => published++), 'failed'); assert.equal(published, 0); assert.equal(JSON.parse(durable).dig[cell.id], undefined);
  assert.equal(committer.canMutate(), false); fail = false; assert.equal(committer.flush(), 'saved'); assert.equal(published, 1);
  assert.equal(JSON.parse(durable).dig[cell.id], 0.5); assert.equal(committer.flush(), 'idle'); assert.equal(published, 1);
  fail = true; assert.equal(committer.commit(assignHelper(candidate, null), () => published++), 'failed'); fail = false;
  assert.equal(committer.reset(), true); committer.commit(createHelperSave(99), () => published++);
  assert.deepEqual(JSON.parse(durable).helpers.owned, []); assert.deepEqual(JSON.parse(durable).dig, {}); committer.dispose();
});
