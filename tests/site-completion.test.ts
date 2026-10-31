import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLEANUP_TILE_SECONDS, DISCOVERY, FIRST_DISCOVERIES as DISCOVERIES, SITE, SITE_FRONT, SITE_PLOTS } from '../src/content/journey.ts';
import { allSiteRecovered, freshJourney, isSiteComplete, siteAvailability, stepDigging } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { completionPhase, stepCompletion } from '../src/game/site-completion.ts';
import type { CleanupPop } from '../src/game/site-completion.ts';
import { parseSave } from '../src/persistence/save.ts';

const find = SITE.cells.find(c => c.discoveryId)!;
const recovered = (): JourneyState => ({ ...freshJourney(), room: 'excavation', dig: Object.fromEntries(SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])), collected: DISCOVERIES.map(d => d.id) });
const empty = (): JourneyState => ({ ...recovered(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) });

test('cleanup requires every assigned find to be recovered and cleaned, not just uncovered', () => {
  const state = recovered();
  assert.equal(completionPhase({ ...state, collected: [] }), null);
  assert.equal(completionPhase({ ...state, cleaning: { [DISCOVERY.id]: [5] } }), null);
  const site = { ...SITE, requiredDiscoveryIds: [...SITE.requiredDiscoveryIds, 'second-find'], cells: [...SITE.cells, { ...find, id: 'second-tile', discoveryId: 'second-find' }] };
  assert.equal(allSiteRecovered(state, site), false);
  assert.equal(allSiteRecovered({ ...state, collected: [...state.collected, 'second-find'], dig: { ...state.dig, 'second-tile': 1 } }, site), true);
  assert.equal(stepDigging(state, SITE.interaction, 10, null, true).state, state);
});

test('cleanup animates only one tile and commits one removal, with pause and reload safety', () => {
  let state = recovered(), pop: CleanupPop | null = null;
  for (let i = 0; i < Math.ceil(CLEANUP_TILE_SECONDS / 0.05) - 1; i++) {
    const step = stepCompletion(state, SITE.interaction, 10, pop, true);
    assert.equal(step.state, state); pop = step.pop;
    assert.ok(pop && pop.elapsed < CLEANUP_TILE_SECONDS, 'long frames cannot skip visible animation');
  }
  const paused = stepCompletion(state, SITE.interaction, 100, pop, false);
  assert.equal(paused.state, state); assert.deepEqual(paused.pop, pop);
  const struck = stepCompletion(state, SITE.interaction, 0.05, pop, true);
  assert.equal(Object.keys(struck.state.dig).length, Object.keys(state.dig).length + 1); assert.equal(struck.pop, null);
  state = parseSave(JSON.stringify(struck.state))!;
  assert.equal(completionPhase(state), 'cleanup');
  const restarted = stepCompletion(state, SITE.interaction, 100, null, true);
  assert.equal(restarted.state, state); assert.equal(restarted.pop!.elapsed, 0.05);
  for (const dt of [-1, NaN, Infinity]) assert.equal(stepCompletion(state, SITE.interaction, dt, pop, true).state, state);
});

test('all remaining columns clear sequentially, including partial layers, without collection changes', () => {
  let state = { ...recovered(), dig: { ...recovered().dig, [SITE.cells[0].id]: 0.5 } };
  let pop: CleanupPop | null = null;
  for (let i = 0; i < 650 && completionPhase(state) === 'cleanup'; i++) {
    const step = stepCompletion(state, SITE.interaction, 0.05, pop, true);
    assert.ok(SITE.cells.filter(c => state.dig[c.id] !== step.state.dig[c.id]).length <= 1);
    state = step.state; pop = step.pop;
  }
  assert.equal(completionPhase(state), 'exit');
  assert.equal(isSiteComplete(state), false); assert.equal(siteAvailability(state, 2), 'locked');
  assert.deepEqual(state.collected, DISCOVERIES.map(d => d.id));
});

test('empty pit walks to the ladder, emerges outside, and closes only at the front', () => {
  let state = empty(), position = { x: SITE.grid.x, z: SITE.grid.z };
  let sawOutsideBeforeClosed = false;
  for (let i = 0; i < 200 && !isSiteComplete(state); i++) {
    const step = stepCompletion(state, position, 0.05, null, true);
    position = step.position; state = step.state;
    if (state.room === 'outdoors' && !isSiteComplete(state)) sawOutsideBeforeClosed = true;
    if (isSiteComplete(state)) assert.deepEqual(position, SITE_FRONT);
    else assert.equal(siteAvailability(state, 2), 'locked');
  }
  assert.ok(sawOutsideBeforeClosed); assert.equal(state.room, 'outdoors');
  assert.deepEqual(state.closedSites, [SITE.id]);
  assert.deepEqual(state.placed, [], 'all seven finds close the site without any museum placement');
  assert.equal(state.collected.length, 7);
  assert.equal(siteAvailability(state, 2), 'open');
  assert.equal(stepCompletion(state, position, 1, null, true).state, state, 'closure is idempotent');
  assert.deepEqual(parseSave(JSON.stringify(state)), state);
});

test('reload during exit resumes without replaying removal; older completed pits reopen for the missing slab', () => {
  const duringExit = { ...empty(), room: 'outdoors' as const };
  let state = parseSave(JSON.stringify(duringExit))!, position = { ...SITE_PLOTS[0].entrance };
  for (let i = 0; i < 20; i++) {
    const step = stepCompletion(state, position, 0.05, null, true);
    state = step.state; position = step.position;
  }
  assert.ok(isSiteComplete(state)); assert.deepEqual(position, SITE_FRONT);
  const { closedSites: _, placed: _placed, activeSiteId: _site, ...all } = empty();
  const legacy = { ...all, collected: [DISCOVERY.id] };
  const upgraded = parseSave(JSON.stringify({ ...legacy, version: 3 }))!;
  assert.equal(isSiteComplete(upgraded), false); assert.equal(upgraded.version, 12);
  const partialLegacy = parseSave(JSON.stringify({ ...legacy, version: 3, dig: recovered().dig }))!;
  assert.equal(completionPhase(partialLegacy), null);
});

test('invalid closure flags are protected rather than granting progression', () => {
  for (const state of [
    { ...recovered(), closedSites: [SITE.id] },
    { ...empty(), closedSites: [SITE.id, SITE.id] },
    { ...empty(), closedSites: ['unknown'] },
    { ...empty(), closedSites: null },
  ]) assert.equal(parseSave(JSON.stringify(state)), null);
});
