import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXCAVATION_DEPTH, DEPTH_COLORS, soilColorIndex, siteDimensions, SITES, SITE, ERYOPS_SITE, SITE_PLOTS } from '../src/content/journey.ts';
import { freshJourney, digAt, groundHeight, tileSurface, isUncovered, nearestDigCell, siteAvailability, activeDigLayer, stepDigging } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { parseSave } from '../src/persistence/save.ts';
import { stepCompletion } from '../src/game/site-completion.ts';
import { isWalkable, movePlayer } from '../src/game/navigation.ts';

const second = (): JourneyState => ({ ...freshJourney(), room: 'excavation', activeSiteId: ERYOPS_SITE.id,
  dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] });

test('sequential depth configuration grows one layer per site without changing the tutorial or unlock rule', () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => siteDimensions(i).levels), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(siteDimensions(0), { rows: 8, columns: 8, levels: 1 });
  assert.equal(SITE.grid.floorY, -0.7);
  SITES.forEach((site, i) => {
    assert.equal(site.grid.levels, siteDimensions(i).levels);
    assert.equal(site.grid.floorY, -site.grid.levels * EXCAVATION_DEPTH.layerHeight);
    assert.equal(SITE_PLOTS[i].dimensions.levels, site.grid.levels);
  });
  assert.equal(siteAvailability(freshJourney(), 2), 'locked');
  assert.equal(siteAvailability(second(), 2), 'open');
  assert.equal(SITE_PLOTS.filter(p => p.playable).length, 2);
});

test('soil colors form two-layer bands, including palette rollover and a truncated last band', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => soilColorIndex(i)), [0, 0, 1, 1, 2, 2, 3, 3, 0, 0]);
  for (let i = 0; i < 20; i += 2) {
    assert.equal(soilColorIndex(i), soilColorIndex(i + 1));
    assert.notEqual(DEPTH_COLORS[soilColorIndex(i)], DEPTH_COLORS[soilColorIndex(i + 2)]);
  }
  assert.deepEqual(Array.from({ length: siteDimensions(2).levels }, (_, i) => soilColorIndex(i)), [0, 0, 1]);
});

test('deep footprints require all layers; each hit, surface and final reveal survives reload', () => {
  for (const levels of [2, 3, 5]) {
    const site = { ...ERYOPS_SITE, grid: { ...ERYOPS_SITE.grid, levels, floorY: -levels * EXCAVATION_DEPTH.layerHeight } };
    let state = second();
    const id = site.requiredDiscoveryIds.at(-1)!;
    for (let layer = 0; layer < levels; layer++) for (const cell of site.cells) for (let strike = 1; strike <= 2; strike++) {
      const hit = layer * 2 + strike;
      assert.equal(activeDigLayer(state, site), layer);
      state = digAt(state, cell, site);
      assert.equal(state.dig[cell.id], hit / (levels * 2));
      const surface = hit === levels * 2 ? site.grid.floorY : -(Math.floor(hit / 2) + (hit % 2) * 0.1) * EXCAVATION_DEPTH.layerHeight;
      assert.ok(Math.abs(tileSurface(state.dig[cell.id], site) - surface) < 1e-8);
      if (cell.row !== 7) assert.ok(Math.abs(groundHeight(state, cell, site) - surface) < 1e-8);
      assert.deepEqual(parseSave(JSON.stringify(state)), state);
      assert.equal(isUncovered(state, id), site.cells.filter(c => c.discoveryId === id).every(c => state.dig[c.id] === 1));
    }
    assert.equal(activeDigLayer(state, site), levels);
  }
});

test('deep holes need lower footing; soil and ladder remain walkable without trapping the player', () => {
  const site = { ...ERYOPS_SITE, grid: { ...ERYOPS_SITE.grid, levels: 5, floorY: -3.5 } };
  const cell = site.cells.find(c => c.row === 3 && c.column === 3)!;
  let state = { ...second(), dig: { ...second().dig, [cell.id]: 0.8 } };
  const highEdge = { x: cell.x + site.grid.tileSize / 2, z: cell.z };
  assert.notEqual(nearestDigCell(state, highEdge, site)?.id, cell.id);
  assert.notEqual(nearestDigCell(state, cell, site)?.id, cell.id, 'old deep holes wait for the upper layers');
  state = { ...state, dig: { ...state.dig, ...Object.fromEntries(site.cells.map(c => [c.id, 0.8])) } };
  assert.equal(nearestDigCell(state, cell, site)?.id, cell.id);
  state = digAt(digAt(state, cell, site), cell, site);
  assert.equal(state.dig[cell.id], 1);
  const empty = { ...state, dig: { ...state.dig, ...Object.fromEntries(site.cells.map(c => [c.id, 1])) } };
  let position = { x: site.interaction.x, z: site.interaction.z - 2 };
  let previousY = groundHeight(empty, position, site);
  while (position.z < site.interaction.z - 0.02) {
    position = movePlayer(position, { x: 0, z: 1 }, 0.01, 'excavation');
    assert.ok(isWalkable(position, 'excavation'));
    const height = groundHeight(empty, position, site);
    assert.ok(height >= previousY - 1e-8 && height <= 0);
    previousY = height;
  }
  assert.equal(previousY, 0);
});

test('current saves keep normalized work and completed finds; completed deeper sites stay closed', () => {
  const id = ERYOPS_SITE.requiredDiscoveryIds[0];
  const finds = ERYOPS_SITE.cells.filter(c => c.discoveryId === id);
  const other = ERYOPS_SITE.cells.find(c => !c.discoveryId)!;
  const old = { ...second(), dig: { ...second().dig, [other.id]: 0.5, ...Object.fromEntries(finds.map(c => [c.id, 1])) },
    cleaning: { [id]: [0, 1, 2] } };
  assert.deepEqual(parseSave(JSON.stringify(old)), old);
  assert.equal(tileSurface(0.5, ERYOPS_SITE), -0.7);
  assert.equal(digAt(old, other).dig[other.id], 0.5, 'do not deepen an old hole ahead of the unfinished upper layer');
  const upperCleared = { ...old, dig: { ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])), ...old.dig } };
  const resumed = digAt(upperCleared, other);
  assert.equal(resumed.dig[other.id], 0.75);
  assert.deepEqual(parseSave(JSON.stringify(resumed)), resumed);
  const closed = { ...second(), dig: { ...second().dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) },
    collected: [...SITE.requiredDiscoveryIds, ...ERYOPS_SITE.requiredDiscoveryIds], closedSites: [SITE.id, ERYOPS_SITE.id] };
  assert.deepEqual(parseSave(JSON.stringify(closed)), closed);
  assert.equal(stepCompletion(closed, ERYOPS_SITE.interaction, 0.05, null, true).state, closed);
  assert.equal(siteAvailability(closed, 2), 'complete');
});

test('one unfinished upper tile blocks every lower tile, across reload and automatic shovel swings', () => {
  const lower = ERYOPS_SITE.cells.find(c => c.row === 3 && c.column === 3)!;
  const last = ERYOPS_SITE.cells[0];
  let state: JourneyState = { ...second(), dig: { ...second().dig,
    ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])), [last.id]: 0.25 } };
  assert.equal(activeDigLayer(state), 0);
  assert.equal(nearestDigCell(state, lower), undefined);
  assert.equal(digAt(state, lower), state);
  assert.equal(stepDigging(state, lower, 0.05, null, true).swing, null);
  state = parseSave(JSON.stringify(state))!;
  assert.equal(digAt(state, lower), state);
  state = digAt(state, last);
  assert.equal(state.dig[last.id], 0.5);
  assert.equal(activeDigLayer(state), 1);
  assert.equal(nearestDigCell(state, lower)?.id, lower.id);
  state = digAt(state, lower);
  assert.equal(state.dig[lower.id], 0.75);
  assert.deepEqual(parseSave(JSON.stringify(state)), state);
});
