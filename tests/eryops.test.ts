import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PARTS, FIRST_PARTS, ERYOPS_GROUPS, EXHIBITS } from '../src/content/exhibit.ts';
import { SITE, ERYOPS_SITE, SITES, siteFront } from '../src/content/journey.ts';
import { freshJourney, digAt, brush, collectFossil, allSiteRecovered, siteAvailability } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { placeGroup, exhibitComplete } from '../src/game/assembly.ts';
import { completionPhase, stepCompletion } from '../src/game/site-completion.ts';
import type { CleanupPop } from '../src/game/site-completion.ts';
import { ARRIVAL, EXHIBIT_SPOTS, isWalkable, movePlayer } from '../src/game/navigation.ts';
import { parseSave } from '../src/persistence/save.ts';

const firstComplete = (): JourneyState => ({ ...freshJourney(),
  dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: FIRST_PARTS.map(p => p.discoveryId),
  placed: FIRST_PARTS.map(p => p.id), closedSites: [SITE.id] });
const second = (): JourneyState => ({ ...firstComplete(), room: 'excavation', activeSiteId: ERYOPS_SITE.id });
const reload = (state: JourneyState) => { const loaded = parseSave(JSON.stringify(state)); assert.deepEqual(loaded, state); return loaded!; };

test('Eryops has six independent finds in the second site and its own museum stand', () => {
  assert.equal(ERYOPS_GROUPS.length, 6);
  assert.equal(SITE.requiredDiscoveryIds.length, 7);
  assert.equal(ERYOPS_SITE.cells.length, 64);
  assert.equal(ERYOPS_SITE.grid.levels, 2);
  assert.equal(ERYOPS_SITE.requires, SITE.id);
  for (const ids of [ALL_PARTS.map(p => p.id), ALL_PARTS.map(p => p.discoveryId), SITES.flatMap(s => s.cells.map(c => c.id))])
    assert.equal(new Set(ids).size, ids.length);
  for (const part of ALL_PARTS) {
    assert.ok(SITES.flatMap(s => s.cells).filter(c => c.discoveryId === part.discoveryId).length > 1);
    assert.equal(EXHIBITS.filter(e => (e.parts as readonly string[]).includes(part.id)).length, 1);
  }
  assert.equal(EXHIBIT_SPOTS.filter(s => s.id === 'eryops').length, 1);
  assert.equal(siteAvailability(freshJourney(), 2), 'locked');
  assert.equal(siteAvailability(firstComplete(), 2), 'open');
});

test('schema 9 preserves existing progress exactly while unlocking only an earned second site', () => {
  for (const old of [freshJourney(), firstComplete()]) {
    const migrated = parseSave(JSON.stringify({ ...old, version: 9 }));
    assert.deepEqual(migrated, old);
    reload(migrated!);
    assert.equal(migrated!.collected.some(id => id.startsWith('eryops')), false);
  }
  for (const version of [8, 9]) {
    assert.equal(parseSave(JSON.stringify({ ...second(), version })), null);
    assert.equal(parseSave(JSON.stringify({ ...firstComplete(), version, placed: ['eryops-skull'] })), null);
  }
});

test('six Eryops finds survive partial digging, cleaning and collection reloads without changing the first site', () => {
  let state = second();
  // Clear each upper layer across the whole pit before recovering floor finds.
  for (let layer = 0; layer < ERYOPS_SITE.grid.levels - 1; layer++) for (const cell of ERYOPS_SITE.cells) {
    state = reload(digAt(digAt(state, cell), cell));
  }
  for (const part of ERYOPS_GROUPS) {
    for (const cell of ERYOPS_SITE.cells.filter(c => c.discoveryId === part.discoveryId)) {
      for (let hit = (ERYOPS_SITE.grid.levels - 1) * 2 + 1; hit <= ERYOPS_SITE.grid.levels * 2; hit++) {
        state = reload(digAt(state, cell)); assert.equal(state.dig[cell.id], hit / (ERYOPS_SITE.grid.levels * 2));
        assert.equal(collectFossil(state, part.discoveryId), state);
      }
    }
    state = reload(brush(state, { x: 0.2, y: 0.3 }, { x: 0.3, y: 0.3 }, part.discoveryId));
    assert.equal(collectFossil(state, part.discoveryId), state);
    for (const y of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) state = brush(state, { x: 0, y }, { x: 1, y }, part.discoveryId);
    state = reload(state);
    assert.equal(allSiteRecovered(state), false, 'cleaning alone cannot close the site');
    state = reload(collectFossil(state, part.discoveryId));
    assert.equal(collectFossil(state, part.discoveryId), state);
    assert.deepEqual(state.placed, firstComplete().placed);
    for (const cell of SITE.cells) assert.equal(state.dig[cell.id], 1);
  }
  assert.ok(allSiteRecovered(state)); assert.equal(completionPhase(state), 'cleanup');
  let museum: JourneyState = { ...state, room: 'museum' };
  for (const part of ERYOPS_GROUPS) {
    assert.equal(placeGroup(museum, part.id, 'skull'), museum, 'cannot place on another specimen');
    museum = reload(placeGroup(museum, part.id, part.id));
    assert.equal(placeGroup(museum, part.id, part.id), museum);
  }
  assert.ok(exhibitComplete(museum, 'eryops'));
  assert.ok(exhibitComplete(museum, 'dimetrodon'));
  assert.ok(exhibitComplete(museum, 'trilobite'));
});

test('second-site cleanup resumes after reload and closes once at its own outdoor entrance', () => {
  let state: JourneyState = { ...second(), collected: ALL_PARTS.map(p => p.discoveryId),
    dig: { ...firstComplete().dig, ...Object.fromEntries(ERYOPS_SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])) } };
  let position = { ...ERYOPS_SITE.interaction }, pop: CleanupPop | null = null;
  for (let i = 0; i < 750 && !state.closedSites.includes(ERYOPS_SITE.id); i++) {
    if (i === 10) { state = reload(state); pop = null; }
    const step = stepCompletion(state, position, 0.05, pop, true);
    state = step.state; position = step.position; pop = step.pop;
  }
  assert.deepEqual(state.closedSites, [SITE.id, ERYOPS_SITE.id]);
  assert.deepEqual(position, siteFront(ERYOPS_SITE)); assert.equal(state.room, 'outdoors');
  assert.equal(stepCompletion(state, position, 1, null, true).state, state);
  assert.deepEqual(state.placed, FIRST_PARTS.map(p => p.id)); reload(state);
});

test('save rejects locked second-site work, unearned bones and premature closure', () => {
  for (const state of [
    { ...freshJourney(), activeSiteId: ERYOPS_SITE.id },
    { ...freshJourney(), dig: { [ERYOPS_SITE.cells[0].id]: 0.5 } },
    { ...second(), collected: ALL_PARTS.map(p => p.discoveryId) },
    { ...second(), closedSites: [SITE.id, ERYOPS_SITE.id] },
    { ...second(), placed: ['eryops-skull'] },
  ]) assert.equal(parseSave(JSON.stringify(state)), null);
});

test('expanded hall has walking routes around both large stands, keeping outdoor bounds unchanged', () => {
  let position = { ...ARRIVAL };
  const route = [{ x: 4.5, z: 3 }, { x: -6, z: 3 }, { x: -6, z: -2.45 },
    EXHIBIT_SPOTS.find(s => s.id === 'eryops')!, { x: -15.2, z: -2.45 }, { x: -15.2, z: 3 },
    { x: -6, z: 3 }, { x: 4.5, z: 3 }];
  for (const target of route) {
    for (let i = 0; i < 200 && Math.hypot(position.x - target.x, position.z - target.z) > 0.03; i++) {
      const dx = target.x - position.x, dz = target.z - position.z, d = Math.hypot(dx, dz);
      position = movePlayer(position, { x: dx / d, z: dz / d }, Math.min(0.05, d / 3.4), 'museum');
    }
    assert.ok(Math.hypot(position.x - target.x, position.z - target.z) < 0.03, JSON.stringify(target));
  }
  assert.ok(isWalkable({ x: -15.2, z: 3 }, 'museum'));
  assert.equal(isWalkable({ x: -15.2, z: 3 }, 'outdoors'), false);
});
