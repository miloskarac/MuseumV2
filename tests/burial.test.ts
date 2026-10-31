import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERYOPS_SITE, SITE, SITES } from '../src/content/journey.ts';
import { findBurial, findIsExposed } from '../src/game/burial.ts';
import { freshJourney, digAt, isUncovered, brush, collectFossil, allSiteRecovered, activeDigLayer } from '../src/game/journey.ts';
import { parseSave } from '../src/persistence/save.ts';
import { completionPhase, stepCompletion } from '../src/game/site-completion.ts';

const id = 'eryops-spine-find';
const base = () => ({ ...freshJourney(), room: 'excavation' as const, activeSiteId: ERYOPS_SITE.id,
  dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] });
const reload = <T>(state: T) => { assert.deepEqual(parseSave(JSON.stringify(state)), state); return state; };

test('two-layer spine occupies both depths while default finds stay on the floor', () => {
  const burial = findBurial(ERYOPS_SITE, id);
  assert.deepEqual(burial.coverage.map(c => [c.firstLayer, c.lastLayer]), [[0, 0], [0, 1], [1, 1]]);
  const ends = burial.coverage.map(({ cell }) => burial.heightAt(cell.x, cell.z));
  assert.ok(ends[0] > -0.7 && ends.at(-1)! < -0.7);
  for (const site of SITES) for (const find of site.requiredDiscoveryIds) {
    if (find === id) continue;
    const flat = findBurial(site, find);
    for (const { cell, firstLayer, lastLayer } of flat.coverage) {
      assert.equal(firstLayer, site.grid.levels - 1); assert.equal(lastLayer, firstLayer);
      assert.ok(Math.abs(flat.heightAt(cell.x, cell.z) - (site.grid.floorY + 0.035)) < 1e-9);
    }
  }
});

test('three-layer and offset placements use the same coverage and elevation rules', () => {
  for (const [levels, topLayer, bottomLayer] of [[3, 0, 2], [5, 1, 3]]) {
    const site = { ...ERYOPS_SITE, grid: { ...ERYOPS_SITE.grid, levels, floorY: -0.7 * levels },
      burial: { [id]: { topLayer, bottomLayer, axis: 'z' as const } } };
    const burial = findBurial(site, id), dig: Record<string, number> = {};
    assert.equal(burial.coverage[0].firstLayer, topLayer);
    assert.equal(burial.coverage.at(-1)!.lastLayer, bottomLayer);
    const occupied = new Set(burial.coverage.flatMap(c => Array.from({ length: c.lastLayer - c.firstLayer + 1 }, (_, i) => c.firstLayer + i)));
    assert.deepEqual([...occupied], [topLayer, topLayer + 1, bottomLayer]);
    for (const { cell, lastLayer } of burial.coverage) {
      dig[cell.id] = (lastLayer + 1) / levels;
      for (const z of [cell.z - 0.4, cell.z, cell.z + 0.4]) {
        const layer = Math.floor(-burial.heightAt(cell.x, z) / 0.7);
        assert.ok(layer <= lastLayer && layer >= topLayer);
      }
    }
    assert.equal(findIsExposed(dig, site, id), true);
    for (const { cell } of burial.coverage) {
      assert.equal(findIsExposed({ ...dig, [cell.id]: dig[cell.id] - 1 / (levels * 2) }, site, id), false);
    }
  }
  assert.throws(() => findBurial({ ...ERYOPS_SITE, burial: { [id]: { topLayer: 0, bottomLayer: 2, axis: 'z' } } }, id), /Invalid burial/);
  assert.equal(findIsExposed({}, ERYOPS_SITE, 'missing'), false);
});

test('upper reveal cannot be cleaned; final occupied layer unlocks cleaning without digging below the shallow end', () => {
  const coverage = findBurial(ERYOPS_SITE, id).coverage;
  let state = reload({ ...base(), dig: { ...base().dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])) } });
  assert.equal(activeDigLayer(state), 1);
  assert.equal(isUncovered(state, id), false);
  assert.equal(brush(state, { x: 0, y: 0.5 }, { x: 1, y: 0.5 }, id), state);
  assert.equal(collectFossil(state, id), state);
  assert.equal(parseSave(JSON.stringify({ ...state, cleaning: { [id]: [1] } })), null);
  for (const { cell, lastLayer } of coverage.filter(c => c.lastLayer === 1)) {
    state = reload(digAt(state, cell));
    assert.equal(isUncovered(state, id), false);
    state = reload(digAt(state, cell));
    assert.equal(state.dig[cell.id], (lastLayer + 1) / ERYOPS_SITE.grid.levels);
  }
  assert.equal(state.dig[coverage[0].cell.id], 0.5, 'soil beneath shallow end need not be removed');
  assert.equal(isUncovered(state, id), true);
  state = reload(brush(state, { x: 0, y: 0.2 }, { x: 1, y: 0.2 }, id));
  for (const y of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) state = brush(state, { x: 0, y }, { x: 1, y }, id);
  state = reload(collectFossil(state, id));
  assert.equal(collectFossil(state, id), state);
  assert.equal(state.collected.filter(found => found === id).length, 1);
});

test('old schema-12 progress still loads; recovered spanning bones allow cleanup but never early closure', () => {
  const coverage = findBurial(ERYOPS_SITE, id).coverage;
  const shallow = coverage[0].cell;
  const old = { ...base(), dig: { ...base().dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) },
    collected: [...base().collected, ...ERYOPS_SITE.requiredDiscoveryIds] };
  reload(old);
  const state = reload({ ...old, dig: { ...old.dig, [shallow.id]: 0.5 } });
  assert.equal(allSiteRecovered(state), true);
  assert.equal(completionPhase(state), 'cleanup');
  assert.equal(parseSave(JSON.stringify({ ...state, closedSites: [...state.closedSites, ERYOPS_SITE.id] })), null);
  let result = { state, position: ERYOPS_SITE.interaction, pop: null as import('../src/game/site-completion.ts').CleanupPop | null };
  for (let i = 0; i < 8; i++) result = stepCompletion(result.state, result.position, 0.05, result.pop, true);
  assert.equal(result.state.dig[shallow.id], 1);
  reload(result.state);
});
