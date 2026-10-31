import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCOVERY, ELIGIBLE_AREAS, SITE } from '../src/content/journey.ts';
import { brush, cleaningProgress, collectFossil, digAt, digProgress, freshJourney, isCollected, nearDig } from '../src/game/journey.ts';
import { isWalkable } from '../src/game/navigation.ts';
import { parseSave } from '../src/persistence/save.ts';

const findCell = SITE.cells.find(cell => cell.discoveryId === DISCOVERY.id)!;
const exposed = () => ({ ...freshJourney(), room: 'excavation' as const,
  dig: Object.fromEntries(SITE.cells.filter(c => c.discoveryId === DISCOVERY.id).map(c => [c.id, 1])) });
test('content IDs, mask and interaction point are coherent and reachable', () => {
  assert.equal(findCell.discoveryId, DISCOVERY.id);
  assert.equal(DISCOVERY.cleaning.mask.length, DISCOVERY.cleaning.rows);
  assert.ok(DISCOVERY.cleaning.mask.every(row => row.length === DISCOVERY.cleaning.columns && /^[01]+$/.test(row)));
  assert.ok(ELIGIBLE_AREAS.length > 0);
  assert.ok(isWalkable(SITE.interaction, 'excavation'));
  assert.ok(nearDig({ ...freshJourney(), room: 'excavation' }, SITE.interaction));
  assert.equal(nearDig(freshJourney(), SITE.interaction), false);
});
test('digging retains bounded progress through leaving, interruption and serialization', () => {
  let state = { ...freshJourney(), room: 'excavation' as const };
  const original = state;
  state = digAt(state, SITE.interaction) as typeof state;
  assert.equal(digProgress(original), 0);
  assert.ok(digProgress(state) > 0 && digProgress(state) < 1);
  const paused = digAt(state, { x: 6, z: -4 });
  assert.equal(paused, state);
  state = parseSave(JSON.stringify(state)) as typeof state;
  state = digAt(state, SITE.interaction) as typeof state;
  assert.ok(Object.values(state.dig).some(progress => progress === 1));
  assert.ok(digProgress(state) < 1, 'clearing one tile does not remove the grid');
});
test('brushing requires an uncovered find, preserves spatial coverage, and never damages', () => {
  const point = { x: 0.25, y: 0.4 };
  const fresh = freshJourney();
  assert.equal(brush(fresh, point, point), fresh);
  const state = exposed();
  const off = { x: 0, y: 0 };
  assert.ok(cleaningProgress(brush(state, off, off)) > 0, 'corner dirt is brushable');
  const partial = brush(state, point, point);
  assert.ok(cleaningProgress(partial) > 0 && cleaningProgress(partial) < 0.9);
  assert.equal(brush(partial, point, point), partial);
  assert.deepEqual(parseSave(JSON.stringify(partial)), partial);
  assert.equal(brush(partial, { x: -1, y: 0 }, point), partial);
  assert.equal(brush(partial, { x: NaN, y: 0 }, point), partial);
  assert.ok(cleaningProgress(brush(partial, off, off)) > cleaningProgress(partial));
  assert.equal(collectFossil(partial), partial, 'cannot bag a dirty fossil');
});
test('full-tray cleaning waits for an explicit, idempotent bag action, including after reload', () => {
  let state = exposed();
  state = brush(state, { x: 0.15, y: 0.5 }, { x: 0.85, y: 0.5 }) as typeof state;
  assert.ok((state.cleaning[DISCOVERY.id]?.length ?? 0) > 30);
  for (const y of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) state = brush(state, { x: 0, y }, { x: 1, y }) as typeof state;
  assert.equal(cleaningProgress(state), 1);
  assert.equal(isCollected(state), false, 'ready popup does not collect automatically');
  assert.deepEqual(parseSave(JSON.stringify(state)), state, 'ready mask persists without a second fossil state');
  state = collectFossil(parseSave(JSON.stringify(state))!) as typeof state;
  assert.ok(isCollected(state));
  assert.deepEqual(state.collected, [DISCOVERY.id]);
  assert.deepEqual(state.cleaning, {});
  const loaded = parseSave(JSON.stringify(state))!;
  assert.equal(brush(loaded, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }), loaded);
  assert.equal(cleaningProgress(loaded), 1);
  assert.equal(collectFossil(loaded), loaded);
});
