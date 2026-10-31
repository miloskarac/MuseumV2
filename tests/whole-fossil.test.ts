import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_PARTS as ALL_PARTS, EXHIBITS, GROUPS, SLAB_PART } from '../src/content/exhibit.ts';
import { SITES, SITE, LEGACY_SITE, LEGACY_SLAB_SITE, SITE_PLOTS, CLEANING_AREAS } from '../src/content/journey.ts';
import { freshJourney, digAt, brush, collectFossil, allSiteRecovered, siteAvailability, cleaningProgress } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { inventory, exhibitComplete, placeGroup } from '../src/game/assembly.ts';
import { completionPhase } from '../src/game/site-completion.ts';
import { EXHIBIT_SPOTS, EXHIBIT_MARKER_RADIUS, ARRIVAL, START, isWalkable, movePlayer } from '../src/game/navigation.ts';
import { parseSave } from '../src/persistence/save.ts';
const find = SITE.cells.find(c => c.discoveryId === SLAB_PART.discoveryId)!;
const oldFind = LEGACY_SLAB_SITE.cells.find(c => c.discoveryId === SLAB_PART.discoveryId)!;
const legacy = () => ({ ...freshJourney(), version: 8, dig: Object.fromEntries(LEGACY_SITE.cells.map(c => [c.id, 1])),
  collected: GROUPS.map(g => g.discoveryId), closedSites: [SITE.id], placed: ['skull'] });
const reload = (state: JourneyState) => { const loaded = parseSave(JSON.stringify(state)); assert.deepEqual(loaded, state); return loaded!; };

test('both exhibits share one site, with unique find IDs, multiple tiles and reachable markers', () => {
  assert.equal(SITES.length, 2); assert.equal(SITE_PLOTS.filter(p => p.playable).length, 2);
  for (const ids of [ALL_PARTS.map(p => p.id), ALL_PARTS.map(p => p.discoveryId), SITE.cells.map(c => c.id)]) assert.equal(new Set(ids).size, ids.length);
  for (const part of ALL_PARTS) {
    assert.equal(EXHIBITS.filter(e => (e.parts as readonly string[]).includes(part.id)).length, 1);
    assert.ok(SITE.cells.filter(c => c.discoveryId === part.discoveryId).length > 1);
    assert.ok(SITE.requiredDiscoveryIds.includes(part.discoveryId));
  }
  assert.deepEqual(SITE.cells.map(c => c.id), LEGACY_SITE.cells.map(c => c.id));
  for (const exhibit of EXHIBITS) { assert.ok(exhibit.text.storyFacts.length); assert.equal(EXHIBIT_SPOTS.filter(s => s.id === exhibit.id).length, 1); }
});

test('old closed first pit reopens only for the missing slab, without granting it or losing bones', () => {
  for (const version of [7, 8]) {
    const old: Record<string, unknown> = { ...legacy(), version };
    if (version === 7) delete old.activeSiteId;
    const state = parseSave(JSON.stringify(old))!;
    assert.equal(state.version, 12); assert.deepEqual(state.dig, old.dig);
    assert.deepEqual(state.collected, old.collected); assert.deepEqual(state.placed, old.placed);
    assert.deepEqual(state.closedSites, []); assert.equal(siteAvailability(state, 1), 'open');
    assert.equal(siteAvailability(state, 2), 'locked'); reload(state);
  }
});

test('schema 8 moves partial slab cleaning and finished placement into shared pit exactly once', () => {
  for (const room of ['museum', 'outdoors', 'excavation']) {
    const old = { ...legacy(), room, activeSiteId: LEGACY_SLAB_SITE.id, dig: { ...legacy().dig, [oldFind.id]: 1 }, cleaning: { [SLAB_PART.discoveryId]: [1, 2, 3] } };
    const state = parseSave(JSON.stringify(old))!;
    assert.equal(state.activeSiteId, SITE.id); assert.equal(state.room, room);
    assert.deepEqual(state.cleaning, old.cleaning); assert.equal(state.dig[find.id], 1);
    assert.ok(!Object.keys(state.dig).some(id => id.startsWith('slab-'))); reload(state);
    const complete = parseSave(JSON.stringify({ ...old, cleaning: {}, collected: [...old.collected, SLAB_PART.discoveryId], placed: [...old.placed, SLAB_PART.id] }))!;
    assert.deepEqual(complete.closedSites, [SITE.id]); assert.ok(exhibitComplete(complete, 'trilobite')); reload(complete);
  }
  const partial = parseSave(JSON.stringify({ ...legacy(), activeSiteId: LEGACY_SLAB_SITE.id, dig: { ...legacy().dig, [oldFind.id]: 0.5 } }))!;
  assert.ok(partial.dig[find.id] >= 0.5); assert.equal(partial.collected.includes(SLAB_PART.discoveryId), false);
  const finished = { ...legacy(), activeSiteId: LEGACY_SLAB_SITE.id,
    dig: { ...legacy().dig, ...Object.fromEntries(LEGACY_SLAB_SITE.cells.map(c => [c.id, 1])) },
    collected: ALL_PARTS.map(p => p.discoveryId), placed: ALL_PARTS.map(p => p.id), closedSites: [SITE.id, LEGACY_SLAB_SITE.id] };
  const merged = parseSave(JSON.stringify(finished))!;
  assert.deepEqual(merged.placed, finished.placed); assert.deepEqual(merged.collected, finished.collected);
  assert.deepEqual(merged.closedSites, [SITE.id]); reload(merged);
});

test('slab can be recovered and placed before bones, with interruption and harmless duplicate/wrong placement', () => {
  let state: JourneyState = { ...freshJourney(), room: 'excavation' };
  state = reload(digAt(state, find)); assert.equal(state.dig[find.id], 0.5);
  state = reload(digAt(state, find));
  for (const cell of SITE.cells.filter(c => c.discoveryId === SLAB_PART.discoveryId && c.id !== find.id)) {
    state = reload(digAt(digAt(state, cell), cell));
  }
  state = reload(brush(state, { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, SLAB_PART.discoveryId));
  assert.ok(cleaningProgress(state, SLAB_PART.discoveryId) > 0 && cleaningProgress(state, SLAB_PART.discoveryId) < 1);
  assert.equal(collectFossil(state, SLAB_PART.discoveryId), state);
  for (const y of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) state = brush(state, { x: 0, y }, { x: 1, y }, SLAB_PART.discoveryId);
  state = reload(collectFossil(state, SLAB_PART.discoveryId));
  assert.equal(allSiteRecovered(state), false); assert.equal(completionPhase(state), null);
  assert.equal(placeGroup(state, SLAB_PART.id, SLAB_PART.id), state);
  state = { ...state, room: 'museum' };
  assert.equal(placeGroup(state, SLAB_PART.id, 'skull'), state);
  assert.equal(inventory(state).length, 1);
  state = reload(placeGroup(state, SLAB_PART.id, SLAB_PART.id));
  assert.ok(exhibitComplete(state, 'trilobite')); assert.equal(exhibitComplete(state), false);
  assert.equal(placeGroup(state, SLAB_PART.id, SLAB_PART.id), state);
  assert.equal(inventory(state).length, 0);
});

test('six bones cannot exhaust the shared pit; slab must be cleaned and explicitly collected', () => {
  let state: JourneyState = { ...freshJourney(), room: 'excavation', dig: legacy().dig, collected: legacy().collected };
  assert.equal(allSiteRecovered(state), false);
  state = { ...state, cleaning: { [SLAB_PART.discoveryId]: [...CLEANING_AREAS] } };
  assert.equal(allSiteRecovered(reload(state)), false);
  state = reload(collectFossil(state, SLAB_PART.discoveryId));
  assert.equal(allSiteRecovered(state), true); assert.equal(completionPhase(state), 'exit');
});

test('new and legacy save validation reject unearned slab work, duplicates and unsupported pit IDs', () => {
  const base = { ...freshJourney(), dig: legacy().dig, collected: legacy().collected };
  for (const state of [
    { ...base, activeSiteId: LEGACY_SLAB_SITE.id },
    { ...base, closedSites: [SITE.id] },
    { ...base, placed: [SLAB_PART.id] },
    { ...base, dig: { ...base.dig, [oldFind.id]: 1 } },
    { ...base, collected: [...base.collected, SLAB_PART.discoveryId, SLAB_PART.discoveryId] },
    { ...legacy(), placed: [SLAB_PART.id] },
    { ...legacy(), cleaning: { [SLAB_PART.discoveryId]: [1] } },
  ]) assert.equal(parseSave(JSON.stringify(state)), null);
});

test('both stand interaction centers are reachable and safe spawns do not trigger either stand', () => {
  for (const spot of EXHIBIT_SPOTS) {
    assert.ok(isWalkable(spot, 'museum'));
    for (const spawn of [START, ARRIVAL]) assert.ok(Math.hypot(spot.x - spawn.x, spot.z - spawn.z) > EXHIBIT_MARKER_RADIUS);
  }
  let p = { ...ARRIVAL };
  for (const target of [{ x: 4.5, z: 3 }, { x: 0.55, z: 3 }, EXHIBIT_SPOTS[1]]) {
    for (let i = 0; i < 500 && Math.hypot(p.x - target.x, p.z - target.z) > 0.1; i++) {
      const d = Math.hypot(p.x - target.x, p.z - target.z);
      p = movePlayer(p, { x: (target.x - p.x) / d, z: (target.z - p.z) / d }, 0.02, 'museum');
    }
    assert.ok(Math.hypot(p.x - target.x, p.z - target.z) < 0.1);
  }
});
