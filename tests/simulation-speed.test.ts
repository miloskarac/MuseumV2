import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceSimulation, GAME_SPEEDS } from '../src/game/simulation-speed.ts';
import { freshJourney, stepDigging } from '../src/game/journey.ts';
import type { DigSwing } from '../src/game/journey.ts';
import { SITE } from '../src/content/journey.ts';
import { movePlayer } from '../src/game/navigation.ts';
import { stepCompletion } from '../src/game/site-completion.ts';
import type { CleanupPop } from '../src/game/site-completion.ts';
import { parseSave } from '../src/persistence/save.ts';

test('all four speeds scale simulation time while preserving bounded updates and rejecting invalid time', () => {
  for (const speed of GAME_SPEEDS) {
    const steps: number[] = [];
    advanceSimulation(1 / 60, speed, dt => steps.push(dt));
    assert.equal(steps.length, speed);
    assert.ok(Math.abs(steps.reduce((sum, dt) => sum + dt, 0) - speed / 60) < 1e-9);
    advanceSimulation(100, speed, dt => assert.equal(dt, 0.05));
    for (const invalid of [0, -1, NaN, Infinity]) advanceSimulation(invalid, speed, () => assert.fail('invalid frame advanced'));
  }
});

test('accelerated digging matches ordinary steps with no duplicate hits, and survives reload', () => {
  for (const speed of GAME_SPEEDS) {
    let state = { ...freshJourney(), room: 'excavation' as const }, swing: DigSwing | null = null, hits = 0;
    const step = (dt: number) => {
      const next = stepDigging(state, SITE.interaction, dt, swing, true);
      state = { ...next.state, room: 'excavation' }; swing = next.swing; hits += Number(next.hit);
    };
    for (let frame = 0; frame < 40; frame++) advanceSimulation(0.05, speed, step);
    const accelerated = { state, swing, hits };
    state = { ...freshJourney(), room: 'excavation' }; swing = null; hits = 0;
    for (let frame = 0; frame < 40 * speed; frame++) step(0.05);
    assert.deepEqual({ state, swing, hits }, accelerated);
    assert.deepEqual(parseSave(JSON.stringify(state)), state);
  }
});

test('fast movement still respects walls and a panel opened mid-frame can stop remaining steps', () => {
  let position = { x: 0, z: 0 }, paused = false, calls = 0;
  advanceSimulation(0.05, 10, dt => {
    if (paused) return;
    position = movePlayer(position, { x: 1, z: 0 }, dt, 'excavation');
    calls++; paused = true;
  });
  assert.equal(calls, 1);
  const once = position.x;
  assert.ok(once > 0 && once < 0.3);
  for (let frame = 0; frame < 100; frame++) advanceSimulation(0.05, 10, dt => {
    position = movePlayer(position, { x: 1, z: 0 }, dt, 'excavation');
  });
  assert.ok(position.x < SITE.grid.columns * SITE.grid.tileSize / 2, 'pit wall cannot be crossed');
});

test('accelerated cleanup closes once and retains the save contract', () => {
  let state = { ...freshJourney(), room: 'excavation' as const,
    dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, cell.discoveryId ? 1 : 0])),
    collected: [...SITE.requiredDiscoveryIds] } as ReturnType<typeof freshJourney>;
  let position = { ...SITE.interaction }, pop: CleanupPop | null = null;
  for (let frame = 0; frame < 400; frame++) advanceSimulation(0.05, 10, dt => {
    const next = stepCompletion(state, position, dt, pop, true);
    state = next.state; position = next.position; pop = next.pop;
  });
  assert.deepEqual(state.closedSites, [SITE.id]);
  assert.equal(state.room, 'outdoors');
  assert.deepEqual(parseSave(JSON.stringify(state)), state);
  assert.equal('gameSpeed' in state, false);
});
