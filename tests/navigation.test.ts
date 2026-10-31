import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARRIVAL, START, PORTAL, EXHIBIT, BENCH, PIT, PLANTS, ROOM_BOUNDS, PLAYER_RADIUS, WALK_SPEED, destinationAt, isWalkable, movePlayer, screenDirection } from '../src/game/navigation.ts';
import { SITE } from '../src/content/journey.ts';
import { cameraOffset } from '../src/content/view.ts';

test('screen-relative directions match the camera and diagonals keep the same speed', () => {
  assert.deepEqual(screenDirection(1, 0), { x: 0.8, z: 0.6 });
  assert.deepEqual(screenDirection(0, 1), { x: -0.6, z: 0.8 });
  assert.deepEqual(screenDirection(0, 0), { x: 0, z: 0 });
  for (const h of [-1, 0, 1]) for (const v of [-1, 0, 1]) {
    if (h || v) assert.ok(Math.abs(Math.hypot(...Object.values(screenDirection(h, v))) - 1) < 1e-10);
  }
});

test('excavation turns eight degrees while movement remains aligned with each room camera', () => {
  const original = cameraOffset('museum'), turned = cameraOffset('excavation');
  assert.deepEqual(cameraOffset('outdoors'), original);
  assert.equal(turned.y, original.y);
  assert.ok(Math.abs(Math.hypot(turned.x, turned.z) - 20) < 1e-10);
  const angle = Math.atan2(original.x, -original.z) - Math.atan2(turned.x, -turned.z);
  assert.ok(Math.abs(angle - 8 * Math.PI / 180) < 1e-10);
  for (const room of ['museum', 'outdoors', 'excavation'] as const) {
    const camera = cameraOffset(room), right = screenDirection(1, 0, room), up = screenDirection(0, 1, room);
    assert.ok(Math.abs(right.x * camera.x + right.z * camera.z) < 1e-10, 'right has no depth component');
    assert.ok(up.x * camera.x + up.z * camera.z < 0, 'up moves away from the camera');
    assert.ok(Math.abs(right.x * up.x + right.z * up.z) < 1e-10);
    for (const h of [-1, 0, 1]) for (const v of [-1, 0, 1]) {
      const direction = screenDirection(h, v, room);
      assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - (h || v ? 1 : 0)) < 1e-10);
    }
  }
});

test('safe starts and arrivals stay outside travel triggers in both rooms', () => {
  for (const room of ['museum', 'outdoors', 'excavation'] as const) {
    for (const position of room === 'excavation' ? [SITE.interaction, ARRIVAL] : [START, ARRIVAL]) {
      assert.ok(isWalkable(position, room));
      assert.equal(destinationAt(position, room), null);
    }
    assert.equal(destinationAt(PORTAL, room), room === 'outdoors' ? 'museum' : 'outdoors');
  }
});

test('furniture and pit walls block walking, but soil supports walking', () => {
  for (const object of [EXHIBIT, BENCH, ...PLANTS]) assert.equal(isWalkable(object, 'museum'), false);
  assert.equal(isWalkable(PIT, 'excavation'), true);
  assert.equal(isWalkable({ x: PIT.x - PIT.width / 2, z: PIT.z }, 'excavation'), false);
  assert.equal(isWalkable({ x: ROOM_BOUNDS.maxX - PLAYER_RADIUS / 2, z: 0 }, 'museum'), false);
});

test('the ladder allows entry onto soil; walking across it cannot pass the far pit wall', () => {
  let position = { ...SITE.interaction };
  for (let i = 0; i < 100; i++) position = { ...position, ...movePlayer(position, { x: 0, z: -1 }, 0.05, 'excavation') };
  assert.ok(position.z < PIT.z, 'crossed several unexcavated rows');
  assert.ok(position.z >= PIT.z - PIT.depth / 2 + PLAYER_RADIUS);
  assert.ok(isWalkable(position, 'excavation'));
});

test('long or negative frame gaps cannot teleport the player', () => {
  assert.deepEqual(movePlayer(START, screenDirection(1, 0), -1, 'museum'), START);
  const next = movePlayer(START, screenDirection(1, 1), 60, 'museum');
  assert.ok(Math.hypot(next.x - START.x, next.z - START.z) <= WALK_SPEED * 0.05 + 1e-10);
});

test('selected museum bounds and obstacles govern walking without changing other rooms', () => {
  const compact = { ...ROOM_BOUNDS };
  const west = { x: -10, z: -2.5 };
  assert.equal(isWalkable(west, 'museum', [], compact), false);
  assert.equal(isWalkable(west, 'museum', []), true);
  assert.equal(isWalkable(EXHIBIT, 'museum', [], compact), true, 'an unbuilt stand has no collision');
  assert.equal(isWalkable(EXHIBIT, 'museum'), false, 'the existing full museum keeps its collision');
  let position = { x: -7, z: -2.5 };
  for (let i = 0; i < 100; i++) position = movePlayer(position, { x: -1, z: 0 }, 0.05, 'museum', [], compact);
  assert.ok(position.x >= compact.minX + PLAYER_RADIUS);
  assert.ok(isWalkable(position, 'museum', [], compact));
});

test('the cutaway stops walking off either side apron without changing the outdoor room', () => {
  const front = PIT.z - PIT.depth / 2;
  for (const x of [-6.3, 4]) {
    let position = { x, z: 0 };
    for (let i = 0; i < 100; i++) position = movePlayer(position, { x: 0, z: -1 }, 0.05, 'excavation');
    assert.ok(position.z >= front + PLAYER_RADIUS);
    assert.ok(position.z < front + PLAYER_RADIUS + 0.2);
    assert.ok(isWalkable(position, 'excavation'));
    assert.equal(isWalkable({ x, z: -4.7 }, 'excavation'), false);
    assert.equal(isWalkable({ x, z: -4.7 }, 'outdoors'), true);
  }
});

test('walking into the display or boundary stops without tunneling', () => {
  let position = { x: EXHIBIT.x, z: -3 };
  for (let i = 0; i < 300; i++) position = movePlayer(position, { x: 0, z: 1 }, 0.05, 'museum');
  assert.ok(isWalkable(position, 'museum'));
  assert.ok(position.z <= EXHIBIT.z - EXHIBIT.depth / 2 - PLAYER_RADIUS);
  position = { ...START };
  for (let i = 0; i < 300; i++) position = movePlayer(position, { x: 1, z: 0 }, 0.05, 'museum');
  assert.ok(isWalkable(position, 'museum'));
  assert.ok(position.x <= ROOM_BOUNDS.maxX - PLAYER_RADIUS);
});

test('the player can walk from the entrance around the display and travel both ways', () => {
  let position = { ...START };
  for (const room of ['museum', 'excavation'] as const) {
    // Tour the available routes around the central obstacle before the door.
    const points = room === 'museum'
      ? [{ x: 4, z: -3 }, { x: -5.5, z: -2.5 }, { x: -5.5, z: 3 }, { x: 4, z: 3 }, PORTAL]
      : [{ x: 4, z: -3.4 }, { x: 4, z: 5.1 }, { x: -6.3, z: 5.1 }, { x: -6.3, z: -3.4 }, { x: -6.3, z: 5.1 }, { x: 4, z: 5.1 }, PORTAL];
    for (const target of points) {
      for (let i = 0; i < 500 && Math.hypot(target.x - position.x, target.z - position.z) > 0.1; i++) {
        const distance = Math.hypot(target.x - position.x, target.z - position.z);
        position = movePlayer(position, { x: (target.x - position.x) / distance, z: (target.z - position.z) / distance }, 0.02, room);
      }
      assert.ok(Math.hypot(target.x - position.x, target.z - position.z) < 0.1, `${room}: reachable ${JSON.stringify(target)}`);
    }
    assert.notEqual(destinationAt(position, room), null);
    position = { ...ARRIVAL };
  }
});
