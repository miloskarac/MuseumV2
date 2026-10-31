import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, SPECIMEN_ID, SLAB_PART } from '../src/content/exhibit.ts';
import { SITE, CLEANING_AREAS } from '../src/content/journey.ts';
import { freshJourney, brush, collectFossil, digAt, allSiteRecovered, isCollected, cleaningProgress, isUncovered } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { inventory, placeGroup, exhibitComplete } from '../src/game/assembly.ts';
import { completionPhase, stepCompletion } from '../src/game/site-completion.ts';
import { createSaveWriter, loadSave, parseSave, SAVE_KEY } from '../src/persistence/save.ts';

const reload = (state: JourneyState) => {
  const loaded = parseSave(JSON.stringify(state)); assert.ok(loaded); assert.deepEqual(loaded, state); return loaded;
};
function clean(state: JourneyState, id: string) {
  for (const y of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) state = brush(state, { x: 0, y }, { x: 1, y }, id);
  return state;
}
test('Dimetrodon has exactly the six approved groups and one reachable find for each', () => {
  assert.equal(SPECIMEN_ID, 'dimetrodon');
  assert.deepEqual(GROUPS.map(g => g.id), ['skull', 'spine-sail', 'ribs', 'front-legs', 'hind-legs', 'tail']);
  assert.deepEqual(GROUPS.map(g => g.label), ['Лобања', 'Кичма и једро', 'Ребра', 'Предње ноге', 'Задње ноге', 'Реп']);
  assert.deepEqual(SITE.requiredDiscoveryIds, [...GROUPS.map(g => g.discoveryId), SLAB_PART.discoveryId]);
  assert.equal(new Set(SITE.cells.filter(c => c.discoveryId).map(c => c.discoveryId)).size, 7);
  assert.equal(new Set(SITE.requiredDiscoveryIds).size, 7);
  for (const group of GROUPS) assert.ok(SITE.cells.filter(c => c.discoveryId === group.discoveryId).length > 1);
  const broken = { ...SITE, cells: SITE.cells.filter(c => c.discoveryId !== GROUPS[0].discoveryId) };
  assert.equal(allSiteRecovered({ ...freshJourney(), collected: [...SITE.requiredDiscoveryIds], dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) }, broken), false);
});
test('every find needs recovery, full cleaning and explicit collection; each partial step survives reload', () => {
  let state: JourneyState = { ...freshJourney(), room: 'excavation' };
  // Deliberately recover in reverse order: rules cannot depend on array order.
  for (const group of [...GROUPS].reverse()) {
    const id = group.discoveryId;
    assert.equal(collectFossil(state, id), state);
    for (const cell of SITE.cells.filter(c => c.discoveryId === id)) {
      state = reload(digAt(state, cell)); assert.equal(state.dig[cell.id], 0.5);
      assert.equal(collectFossil(state, id), state);
      state = reload(digAt(state, cell));
    }
    assert.ok(isUncovered(state, id));
    assert.equal(collectFossil(state, id), state);
    const others = structuredClone(state.cleaning);
    state = brush(state, { x: 0.2, y: 0.3 }, { x: 0.3, y: 0.3 }, id);
    state = reload(state); // The activity can close/reopen without storing modal state.
    assert.ok(cleaningProgress(state, id) > 0 && cleaningProgress(state, id) < 1);
    assert.equal(collectFossil(state, id), state);
    for (const [other, mask] of Object.entries(others)) assert.deepEqual(state.cleaning[other], mask);
    state = reload(clean(state, id));
    assert.equal(isCollected(state, id), false, 'ready is not collected');
    state = reload(collectFossil(state, id));
    assert.equal(collectFossil(state, id), state, 'duplicate action cannot repeat entitlement');
    assert.equal(state.cleaning[id], undefined);
    assert.equal(inventory(state).length, state.collected.length);
    assert.equal(allSiteRecovered(state), false);
    assert.equal(completionPhase(state), null);
    assert.deepEqual(state.placed, []);
  }
  assert.equal(state.collected.length, 6); assert.equal(exhibitComplete(state), false);
});
test('five collected plus the sixth clean cannot finish the site; placement never substitutes for collection', () => {
  const last = GROUPS[5];
  const state: JourneyState = { ...freshJourney(), room: 'excavation', dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [SLAB_PART.discoveryId, ...GROUPS.slice(0, 5).map(g => g.discoveryId)], cleaning: { [last.discoveryId]: [...CLEANING_AREAS] } };
  assert.equal(allSiteRecovered(reload(state)), false); assert.equal(completionPhase(state), null);
  let museum: JourneyState = { ...state, room: 'museum' };
  for (const group of GROUPS) museum = placeGroup(museum, group.id, group.id);
  assert.equal(museum.placed.length, 5); assert.equal(allSiteRecovered(museum), false);
  assert.equal(parseSave(JSON.stringify({ ...state, closedSites: [SITE.id] })), null);
  assert.equal(allSiteRecovered(collectFossil(state, last.discoveryId)), true);
});
test('final collection snapshot is durable before animation; failed writes retry without a second collection', () => {
  const id = GROUPS[5].discoveryId;
  const before: JourneyState = { ...freshJourney(), room: 'excavation', dig: Object.fromEntries(SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])),
    collected: [SLAB_PART.discoveryId, ...GROUPS.slice(0, 5).map(g => g.discoveryId)], cleaning: { [id]: [...CLEANING_AREAS] } };
  const storage = new Map([[SAVE_KEY, JSON.stringify(before)]]); let fail = true;
  const port = { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => { storage.delete(key); },
    setItem: (key: string, raw: string) => { if (fail) throw Error('quota'); storage.set(key, raw); } };
  const writer = createSaveWriter(port, () => {}, { set: () => 0, clear: () => {} }); writer.enable();
  const collected = collectFossil(before, id); writer.schedule(collected);
  assert.equal(writer.flush(), false);
  assert.equal(stepCompletion(collected, SITE.interaction, 0.05, null, false).pop, null);
  assert.equal(allSiteRecovered(parseSave(storage.get(SAVE_KEY)!)!), false);
  fail = false; assert.equal(writer.flush(), true);
  const restored = loadSave(port); assert.equal(restored.kind, 'ready');
  if (restored.kind !== 'ready') return;
  assert.equal(allSiteRecovered(restored.state), true);
  assert.deepEqual(restored.state.placed, []);
  const step = stepCompletion(restored.state, SITE.interaction, 0.05, null, true);
  assert.ok(step.pop); assert.deepEqual(step.state.dig, before.dig, 'first pop starts after exhaustion checkpoint');
  assert.equal(collectFossil(restored.state, id), restored.state);
  writer.dispose();
});
test('schema 6 converts accepted coarse groups, masks and placements once, reopening only for the new slab', () => {
  const previous = { version: 6, room: 'excavation', dig: { 'courtyard-r6-c3': 1, 'courtyard-r5-c3': 0.5 },
    cleaning: { 'bone-study-01': [0, 1, 2] }, collected: [], closedSites: [], placed: [] };
  const partial = parseSave(JSON.stringify(previous))!; assert.ok(partial);
  assert.ok(partial.dig['courtyard-r5-c3'] >= 0.5, 'expanded recovered ribs may also clear this old skull tile');
  for (const group of GROUPS.slice(1)) assert.deepEqual(partial.cleaning[group.discoveryId], [0, 1, 2]);
  assert.deepEqual(partial.collected, []); reload(partial);
  const body = parseSave(JSON.stringify({ ...previous, cleaning: {}, collected: ['bone-study-01'], placed: ['body'] }))!;
  assert.deepEqual(body.placed, GROUPS.slice(1).map(g => g.id)); assert.equal(body.collected.length, 5);
  assert.equal(completionPhase(body), null); reload(body);
  const closed = parseSave(JSON.stringify({ ...previous, dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), cleaning: {},
    collected: ['bone-study-01', 'bone-study-head'], placed: ['body', 'head'], closedSites: [SITE.id] }))!;
  assert.equal(closed.collected.length, 6); assert.equal(closed.placed.length, 6); assert.equal(completionPhase(closed), null); reload(closed);
  assert.equal(parseSave(JSON.stringify({ ...previous, placed: ['body'] })), null, 'invalid old placement is not laundered by conversion');
  assert.equal(parseSave(JSON.stringify({ ...previous, collected: ['dimetrodon-tail'] })), null);
});
