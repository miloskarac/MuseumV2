import test from 'node:test';
import assert from 'node:assert/strict';
import { FOSSIL_PROFILES } from '../src/presentation/fossil-profiles.ts';
import { ROOM1_PARTS } from '../src/content/exhibit.ts';

test('every fossil profile fits the cleaning tray and contains valid solid-mesh facets', () => {
  assert.deepEqual(Object.keys(FOSSIL_PROFILES).sort(), ROOM1_PARTS.map(g => g.id).sort());
  for (const [id, facets] of Object.entries(FOSSIL_PROFILES)) {
    for (const [index, { points }] of facets.entries()) {
      const label = `${id} facet ${index}`;
      assert.ok(points.length >= 3, label);
      for (const [x, y] of points) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < 24 && y > 0 && y < 14, label);
      const turns = points.map((a, i) => {
        const b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
        return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      });
      assert.ok(turns.some(v => Math.abs(v) > 1e-8), `${label} has area`);
      assert.ok(!(turns.some(v => v > 1e-8) && turns.some(v => v < -1e-8)), `${label} must be convex for solid triangulation`);
    }
  }
});
