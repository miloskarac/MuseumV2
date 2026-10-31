import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS } from '../src/content/exhibit.ts';
import { DISCOVERY, SITE } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { exhibitComplete, inventory, placeGroup, tutorialDismissed } from '../src/game/assembly.ts';
import { parseSave } from '../src/persistence/save.ts';

const recovered = () => ({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])), collected: GROUPS.map(g => g.discoveryId) });
test('six content groups have exactly one find and a unique identity', () => {
  assert.equal(GROUPS.length, 6);
  assert.equal(new Set(GROUPS.map(g => g.id)).size, GROUPS.length);
  for (const group of GROUPS) assert.ok(SITE.cells.filter(c => c.discoveryId === group.discoveryId).length > 1);
});
test('wrong, premature, duplicate and off-room placements are harmless; progress is derived', () => {
  const empty = freshJourney();
  assert.equal(placeGroup(empty, 'spine-sail', 'spine-sail'), empty);
  let state = recovered();
  for (const [group, target] of [['spine-sail', 'skull'], ['skull', 'outside'], ['unknown', 'unknown']]) assert.equal(placeGroup(state, group, target), state);
  const away = { ...state, room: 'excavation' as const };
  assert.equal(placeGroup(away, 'spine-sail', 'spine-sail'), away);
  assert.equal(inventory(state).length, 6); assert.equal(tutorialDismissed(state), false);
  state = placeGroup(state, 'skull', 'skull');
  assert.equal(inventory(state).length, 5); assert.equal(exhibitComplete(state), false);
  assert.equal(tutorialDismissed(state), true);
  assert.equal(placeGroup(state, 'skull', 'skull'), state);
  const partial = parseSave(JSON.stringify(state))!;
  assert.deepEqual(partial, state); assert.equal(tutorialDismissed(partial), true);
  state = partial;
  for (const group of GROUPS) state = placeGroup(state, group.id, group.id);
  assert.equal(exhibitComplete(state), true); assert.deepEqual(inventory(state), []);
  const completed = parseSave(JSON.stringify(state))!;
  assert.deepEqual(completed, state); assert.equal(placeGroup(completed, 'spine-sail', 'spine-sail'), completed);
});
test('save rejects unearned or duplicate placement and incomplete site closure', () => {
  for (const value of [
    { ...freshJourney(), placed: ['skull'] },
    { ...recovered(), placed: ['spine-sail', 'spine-sail'] },
    { ...recovered(), placed: ['unknown'] },
    { ...recovered(), placed: null },
    { ...recovered(), closedSites: [SITE.id] },
    { ...recovered(), collected: [GROUPS[0].discoveryId], closedSites: [SITE.id], dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) },
  ]) assert.equal(parseSave(JSON.stringify(value)), null);
});
test('schema 5 upgrade preserves old whole-find entitlement without inventing placement; masks survive', () => {
  const { placed: _, activeSiteId: _site, ...old } = recovered();
  const legacy = { ...old, version: 5, collected: [DISCOVERY.id] };
  const upgraded = parseSave(JSON.stringify(legacy))!;
  assert.deepEqual(upgraded.collected, GROUPS.map(g => g.discoveryId));
  assert.deepEqual(upgraded.placed, []); assert.deepEqual(parseSave(JSON.stringify(upgraded)), upgraded);
  const partial = { ...legacy, collected: [], cleaning: { [DISCOVERY.id]: [0, 1, 2] } };
  assert.deepEqual(parseSave(JSON.stringify(partial))!.cleaning[DISCOVERY.id], partial.cleaning[DISCOVERY.id]);
  assert.deepEqual(parseSave(JSON.stringify(partial))!.collected, []);
});
