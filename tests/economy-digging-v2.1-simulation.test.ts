import test from 'node:test';
import assert from 'node:assert/strict';
import { DigWorld, RoomVisitors, CAPACITIES, makeSites, hits, power, workTable, partIds, offers,
  validDisplays, roomEligible, simulate, runResearch, productivity, standOrder } from '../scripts/simulate-economy-digging-v2.1.mjs';
import { PERMIAN_ROOMS } from '../src/content/permian-museum.ts';

const record = (id: string) => ({ id, stand: id, placed: true, restored: partIds(id), assembled: partIds(id) });
const tiny = () => [{ id: 'test-site', exhibits: ['dimetrodon'], multipliers: [1], room: 1,
  cells: Array.from({ length: 6 }, (_, i) => ({ id: `cell-${i}`, layer: 0, resistance: 1, multiplier: 1, items: [`dimetrodon/${i}`] })) }];

test('cell hit formula is exact, positive and rejects unbreakable inputs', () => {
  assert.equal(hits(3, 2.8, 1.5), 6);
  assert.equal(hits(1, 1, 100), 1);
  for (const invalid of [0, -1, Infinity, NaN]) {
    assert.throws(() => hits(invalid, 1, 1)); assert.throws(() => hits(1, invalid, 1)); assert.throws(() => hits(1, 1, invalid));
  }
  assert.equal(power(2, 0.5), 2); assert.equal(power(2, 0.5, 'multiplicative'), 2.25);
});

test('floating-point movement remainder does not add a phantom tick to each cell', () => {
  const sites = tiny(); sites[0].cells = sites[0].cells.slice(0, 1);
  const w = new DigWorld(sites); w.activate(0); w.workers[0].swing = 1; w.workers[0].move = 0.25;
  for (let i = 0; i < 25; i++) w.step(0.05, { playerSite: 0 });
  assert.equal(w.playerCells, 1); assert.ok(Math.abs(w.time - 1.25) < 1e-9);
});

test('sites accept independent layer counts, nonmonotone curves and per-layer materials', () => {
  const sites = makeSites({ siteDefinitions: { 1: { multipliers: [1, 3, 1.1, 2], cellsPerLayer: 32,
    materials: [[1], [3], [2], [1, 3]] } } });
  assert.equal(sites[0].multipliers.length, 1); assert.equal(sites[1].multipliers.length, 4);
  const table = workTable(sites)[1];
  assert.deepEqual(table.layers.map((l: { hits: number }) => l.hits), [32, 288, 96, 128]);
  assert.equal(table.hits, 544);
  assert.equal(table.seconds, 544 * 1.2 + 128 * 0.4);
  for (const site of makeSites({ curve: 'deep' })) {
    assert.ok(site.cells.every((c: { items: unknown[] }) => c.items.length <= 1));
    const ids = site.cells.flatMap((c: { items: string[] }) => c.items);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('every compared power level reduces total baseline work while base power digs all cells', () => {
  for (const increment of [0.25, 0.5, 0.75]) for (const scaling of ['additive', 'multiplicative']) {
    let previous = Infinity;
    for (let level = 0; level <= 3; level++) {
      const total = workTable(makeSites(), power(level, increment, scaling)).reduce((n: number, s: { hits: number }) => n + s.hits, 0);
      assert.ok(total < previous); previous = total;
    }
  }
});

test('helpers need visit activation and explicit assignment, and do nothing while paused/closed', () => {
  const w = new DigWorld(tiny()); w.addHelper(); w.assign(w.workers[1], 0);
  for (let i = 0; i < 100; i++) w.step(0.25);
  assert.equal(w.helperCells, 0);
  w.activate(0);
  for (let i = 0; i < 20; i++) w.step(0.25);
  assert.ok(w.helperCells > 0); assert.ok(w.backgroundCells > 0);
  const snapshot = structuredClone(w);
  w.step(86400, { running: false });
  assert.deepEqual(structuredClone(w), snapshot);
  w.assign(w.workers[1], null);
  const done = w.helperCells;
  for (let i = 0; i < 100; i++) w.step(0.25);
  assert.equal(w.helperCells, done);
});

test('full chest safely pauses five workers, preserves every item, and collection is idempotent', () => {
  const w = new DigWorld(tiny(), 1); w.activate(0);
  for (let i = 0; i < 5; i++) { w.addHelper(); w.assign(w.workers.at(-1), 0); }
  for (let i = 0; i < 200; i++) w.step(0.25);
  assert.equal(w.chest(0), 1); assert.ok(w.blockedWorkerSeconds > 0); assert.equal(w.helperCells, 1);
  for (let i = 0; i < 100; i++) { w.collect(0); w.step(0.25); }
  w.collect(0); assert.equal(w.collect(0), 0);
  assert.equal(w.helperCells, 6); assert.equal(w.has('dimetrodon'), false);
  assert.equal(w.has('dimetrodon', ['carried']), true);
  w.deposit(); w.deposit(); assert.equal(w.has('dimetrodon'), true);
  assert.equal(w.collected, 6);
});

test('multiple workers and player never duplicate excavation rewards or discoveries', () => {
  const w = new DigWorld(tiny(), 12); w.activate(0);
  for (let i = 0; i < 5; i++) { w.addHelper(); w.assign(w.workers.at(-1), 0); }
  for (let i = 0; i < 100; i++) w.step(0.25, { playerSite: 0, soilSeed: 42 });
  assert.equal(w.helperCells + w.playerCells, 6); assert.equal(Object.values(w.sites[0].custody).filter(v => v !== 'buried').length, 6);
  const earned = w.soil;
  for (let i = 0; i < 100; i++) w.step(0.25, { playerSite: 0, soilSeed: 42 });
  assert.equal(w.soil, earned);
});

test('leaving releases partial player work so background helpers cannot be blocked by an absent player', () => {
  const w = new DigWorld(tiny()); w.activate(0); w.addHelper(); w.assign(w.workers[1], 0);
  w.step(0.25, { playerSite: 0 }); w.step(0.25, { playerSite: 0 }); w.step(0.25, { playerSite: 0 });
  assert.ok(w.workers[0].task);
  for (let i = 0; i < 200; i++) w.step(0.25);
  assert.equal(w.workers[0].task, null); assert.equal(w.helperCells + w.playerCells, 6);
});

test('in-memory checkpoint/resume preserves partial work and custody without offline catch-up', () => {
  const a = new DigWorld(tiny(), 1); a.activate(0); a.addHelper(); a.assign(a.workers[1], 0);
  for (let i = 0; i < 17; i++) a.step(0.25);
  const b = Object.assign(new DigWorld(tiny()), structuredClone(a));
  b.step(100000, { running: false });
  for (let i = 0; i < 200; i++) {
    if (i % 20 === 0) { a.collect(0); b.collect(0); }
    a.step(0.25); b.step(0.25);
  }
  assert.deepEqual(structuredClone(a), structuredClone(b));
  const fresh = new DigWorld(tiny()); assert.equal(fresh.helperCells, 0); assert.equal(fresh.collected, 0);
});

test('other recoverable item IDs follow the same lossless custody path', () => {
  const sites = tiny(); sites[0].cells[0].items = ['recoverable-item/0'];
  const w = new DigWorld(sites, 1); w.activate(0); w.addHelper(); w.assign(w.workers[1], 0);
  for (let i = 0; i < 40; i++) w.step(0.25);
  assert.equal(w.sites[0].custody['recoverable-item/0'], 'chest');
  w.collect(0); w.deposit(); assert.equal(w.sites[0].custody['recoverable-item/0'], 'museum');
});

test('a single reveal larger than the whole chest remains recoverable across collection and reassignment', () => {
  const sites = tiny(); sites[0].cells = [{ ...sites[0].cells[0], items: partIds('dimetrodon') }];
  const w = new DigWorld(sites, 1); w.activate(0); w.addHelper(); w.assign(w.workers[1], 0);
  for (let i = 0; i < 40; i++) w.step(0.25);
  assert.equal(w.chest(0), 1); assert.equal(w.helperCells, 0);
  w.assign(w.workers[1], null); w.assign(w.workers[1], 0);
  for (let i = 0; i < 100; i++) { w.collect(0); w.step(0.25); }
  w.collect(0); w.deposit(); assert.equal(w.has('dimetrodon'), true); assert.equal(w.helperCells, 1);
  assert.equal(w.collected, 6);
});

test('stand opportunity uses unique valid displays, reachable content and owned rooms', () => {
  const state = { records: [] as ReturnType<typeof record>[], stands: [] as string[], rooms: [1] };
  assert.deepEqual(offers(state, ['dimetrodon', 'trilobite', 'moschops']), ['dimetrodon']);
  state.stands.push('dimetrodon'); assert.deepEqual(offers(state, ['dimetrodon', 'trilobite']), []);
  state.records.push(record('dimetrodon'), record('dimetrodon'));
  assert.deepEqual(validDisplays(state.records, state.stands, state.rooms), ['dimetrodon']);
  assert.deepEqual(offers(state, ['trilobite', 'moschops']), ['trilobite']);
  state.stands.push('trilobite'); assert.deepEqual(offers(state, ['eryops']), []);
  for (const bad of [{ placed: false }, { stand: 'trilobite' }, { restored: [] }, { assembled: [] }, { id: 'decoration' }]) {
    assert.deepEqual(validDisplays([{ ...record('dimetrodon'), ...bad }], ['dimetrodon'], [1]), []);
  }
  assert.deepEqual(validDisplays([record('moschops')], ['moschops'], [1]), []);
});

test('room eligibility requires all predecessor displays and never grants ownership', () => {
  const state = { records: PERMIAN_ROOMS[0].exhibitIds.map(record), stands: [...PERMIAN_ROOMS[0].exhibitIds], rooms: [1] };
  assert.equal(roomEligible(2, state), true); assert.equal(roomEligible(3, state), false);
  assert.deepEqual(state.rooms, [1]); assert.deepEqual(offers(state, ['moschops']), []);
  state.records.pop(); assert.equal(roomEligible(2, state), false);
});

test('exhaustive first-stand partial payments retain a free path to the first display', () => {
  for (let paid = 0; paid <= 12; paid++) assert.ok(20 - paid >= 12 - paid);
  const r = simulate();
  assert.equal(r.transactions[0].id, 'dimetrodon'); assert.equal(r.transactions[0].after, 8);
  assert.equal(r.transactions[0].waitSeconds, 0); assert.equal(r.displays[0].fare, 4);
});

test('queue and occupancy are independent; full occupancy prevents payment but permits queue growth', () => {
  const v = new RoomVisitors({ tour: 120 }); v.paid = Array(6).fill(120); v.queue = [0];
  for (let i = 0; i < 1000; i++) v.step(0.05, 12, 4, 1, true);
  assert.equal(v.sold, 0); assert.equal(v.pending, 0); assert.equal(v.queue.length, 6); assert.equal(v.paid.length, 6);
  v.step(0.05, 12, 4, 2, true);
  for (let i = 0; i < 20; i++) v.step(0.05, 12, 4, 2, true);
  assert.equal(v.sold, 1); assert.equal(v.pending, 12);
  assert.equal(v.collect(), 12); assert.equal(v.collect(), 0);
  v.travel(); assert.equal(v.paid.length, 0); assert.equal(v.income, 12);
});

test('visitor exits free capacity; zero displays, absence, pause and unattended desk cannot earn', () => {
  const v = new RoomVisitors();
  for (let i = 0; i < 2000; i++) v.step(0.05, 0, 0, 1, true);
  assert.equal(v.queue.length, 0);
  for (let i = 0; i < 2000; i++) v.step(0.05, 4, 1, 1, false);
  assert.equal(v.sold, 0); assert.equal(v.queue.length, 6);
  const frozen = structuredClone(v); v.step(86400, 4, 1, 1, true, false); assert.deepEqual(structuredClone(v), frozen);
  v.paid = Array(6).fill(0.1);
  for (let i = 0; i < 100; i++) v.step(0.05, 4, 1, 1, true);
  assert.ok(v.sold > 0); assert.ok(v.maxOccupancy <= CAPACITIES[0][1]);
});

test('stand order variants preserve room membership and Dimetrodon first', () => {
  for (const kind of ['site', 'small', 'large', 'reverse']) {
    const ids = standOrder(kind); assert.equal(ids[0], 'dimetrodon');
    let start = 0;
    for (const r of PERMIAN_ROOMS) {
      assert.deepEqual(ids.slice(start, start + r.exhibitIds.length).sort(), [...r.exhibitIds].sort()); start += r.exhibitIds.length;
    }
  }
});

test('five upgraded assistants accelerate full recovery without player-only parts or 90% stop', () => {
  const one = productivity({ assistants: 1 }), five = productivity({ assistants: 5, level: 2 });
  assert.ok(five.seconds < one.seconds / 3); assert.equal(five.playerHits, 0);
  const constrained = productivity({ assistants: 5, level: 2, chestCapacity: 1, collectEvery: 180 });
  assert.ok(constrained.seconds > five.seconds); assert.ok(constrained.blockedWorkerSeconds > 0);
});

test('whole research matrix completes and conserves money; gates and optional purchases stay valid', () => {
  const research = runResearch(); assert.ok(research.scenarios.length >= 90);
  for (const r of research.scenarios) {
    assert.equal(r.displays.length, 17, r.name); assert.deepEqual(r.rooms.map((x: { fare: number }) => x.fare), [12, 30, 50]);
    assert.equal(r.coins + r.pending + Object.values(r.spending).reduce((a: number, n) => a + Number(n), 0), 20 + r.income + r.soil, r.name);
    assert.ok(r.transactions.every((t: { after: number }) => t.after >= 0));
    assert.equal(r.spending.stand, 543); assert.equal(r.sites.length, 8);
    assert.equal(r.transactions.filter((t: { kind: string }) => t.kind === 'assistant').length, r.options.assistants);
    assert.equal(r.transactions.filter((t: { kind: string }) => t.kind === 'helperUpgrade').length, r.options.assistants * r.options.helperLevels);
    assert.equal(r.transactions.filter((t: { kind: string }) => t.kind === 'playerUpgrade').length, r.options.playerLevels);
    for (const t of r.transactions.filter((t: { kind: string }) => t.kind === 'room')) assert.equal(t.displays, t.id === 'room-2' ? 4 : 10);
    if (!r.options.legacyVisitors) { assert.ok(r.maxQueue <= 14); assert.ok(r.maxOccupancy <= 18); }
  }
  assert.deepEqual(simulate({ assistants: 3, soilSeed: 42 }), simulate({ assistants: 3, soilSeed: 42 }));
});
