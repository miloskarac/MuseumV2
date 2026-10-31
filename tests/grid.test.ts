import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCOVERY, FIRST_DISCOVERIES as DISCOVERIES, ELIGIBLE_AREAS, SITE, LEGACY_SITE, SITE_PLOTS, siteDimensions } from '../src/content/journey.ts';
import { digAt, digObstacles, freshJourney, groundHeight, isSiteComplete, isUncovered, nearestDigCell, siteAvailability, stepDigging, tileDepth } from '../src/game/journey.ts';
import type { DigSwing, JourneyState } from '../src/game/journey.ts';
import { isWalkable } from '../src/game/navigation.ts';
import { parseSave } from '../src/persistence/save.ts';
const findCell = LEGACY_SITE.cells.find(cell => cell.discoveryId === DISCOVERY.id)!;
const freshSite = (): JourneyState => ({ ...freshJourney(), room: 'excavation' });

test('first site has 64 larger one-layer tiles, reachable arrival and data-defined later depths', () => {
  assert.equal(SITE.cells.length, 64); assert.equal(new Set(SITE.cells.map(c => c.id)).size, 64);
  assert.ok(SITE.grid.tileSize > 0.85); assert.equal(SITE.grid.levels, 1);
  assert.deepEqual([0, 1, 2, 20].map(n => siteDimensions(n).columns), [8, 8, 8, 8]);
  assert.deepEqual([0, 2, 4, 6].map(n => siteDimensions(n).levels), [1, 3, 5, 7]);
  assert.equal(SITE_PLOTS.filter(p => p.playable).length, 2);
  assert.ok(isWalkable(SITE.interaction, 'excavation', digObstacles(freshSite())));
});

test('two contact hits clear a tile; normal digging stops once recovery enables cleanup', () => {
  let state = freshSite();
  const entry = nearestDigCell(state, SITE.interaction)!;
  assert.equal(entry.row, 7); assert.equal(entry.column, 3);
  assert.equal(isWalkable(entry, 'excavation', digObstacles(state)), true);
  state = digAt(state, SITE.interaction);
  assert.equal(state.dig[entry.id], 0.5);
  assert.equal(isWalkable(entry, 'excavation', digObstacles(state)), true);
  state = digAt(state, SITE.interaction);
  assert.equal(state.dig[entry.id], 1);
  assert.equal(isWalkable(entry, 'excavation', digObstacles(state)), true);
  const towardFind = { x: entry.x, z: entry.z - 0.15 };
  assert.equal(nearestDigCell(state, towardFind)?.id, findCell.id);
  state = digAt(digAt(state, towardFind), towardFind);
  assert.equal(isUncovered(state), false, 'one cleared tile cannot uncover a whole find');
  assert.notEqual(digAt({ ...state, collected: [DISCOVERY.id] }, entry), state, 'one find cannot exhaust the site');
  state = { ...state, dig: { ...state.dig, ...Object.fromEntries(SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])) }, collected: DISCOVERIES.map(d => d.id) };
  assert.equal(isSiteComplete(state), false);
  assert.equal(siteAvailability(state, 2), 'locked');
  assert.equal(digAt(state, { x: 7, z: -5 }), state, 'no automatic distant clearing');
  assert.equal(digAt(state, entry), state, 'cleanup owns the tiles after recovery');
  const empty = { ...state, dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])) };
  assert.equal(isSiteComplete(empty), false, 'empty pit alone does not close the site');
  const completed = { ...empty, closedSites: [SITE.id] };
  assert.equal(isSiteComplete(completed), true);
  assert.equal(siteAvailability(completed, 2), 'open');
  assert.equal(siteAvailability(completed, 3), 'locked');
});

test('shovel clock commits only on contact, cancels safely, and never catches up a hidden tab', () => {
  let state = freshSite(), swing: DigSwing | null = null;
  for (let i = 0; i < 14; i++) {
    const step = stepDigging(state, SITE.interaction, 0.05, swing, true);
    assert.equal(step.state, state); assert.equal(step.hit, false); swing = step.swing;
  }
  const contact = stepDigging(state, SITE.interaction, 0.05, swing, true);
  assert.equal(contact.hit, true); state = contact.state;
  assert.deepEqual(Object.values(state.dig), [0.5]);
  let recovery = contact.swing;
  for (let i = 0; i < 5; i++) {
    const step = stepDigging(state, SITE.interaction, 0.05, recovery, true);
    assert.equal(step.state, state, 'withdrawal cannot deliver a second hit'); recovery = step.swing;
  }
  const loaded = parseSave(JSON.stringify(state))!;
  assert.deepEqual(loaded, state, 'first hit survives reload');
  const paused = stepDigging(state, SITE.interaction, 100, contact.swing, false);
  assert.equal(paused.state, state); assert.equal(paused.swing, null);
  const resumed = stepDigging(state, SITE.interaction, 100, null, true);
  assert.equal(resumed.state, state); assert.equal(resumed.swing!.elapsed, 0.05);
  for (const dt of [-1, NaN, Infinity]) assert.equal(stepDigging(state, SITE.interaction, dt, swing, true).state, state);
  assert.equal(stepDigging(state, { x: 7, z: -5 }, 0.05, swing, true).swing, null);
  assert.equal(stepDigging({ ...state, room: 'museum' }, SITE.interaction, 0.05, swing, true).swing, null);
});

test('configurable multi-layer site takes two hits per depth, with no early clearing', () => {
  const site = { ...SITE, grid: { ...SITE.grid, levels: 3, floorY: -2.1 } };
  let state = freshSite();
  const entry = nearestDigCell(state, SITE.interaction, site)!;
  site.cells = [entry]; // Isolate hit counting; full-pit layer order is tested separately.
  for (let hits = 1; hits <= 6; hits++) {
    state = digAt(state, entry, site);
    assert.equal(state.dig[entry.id], hits / 6);
    assert.deepEqual(tileDepth(state.dig[entry.id], 3), { level: Math.floor(hits / 2), hits: hits % 2, cleared: hits === 6 });
    assert.equal(Object.keys(state.dig).length, 1);
  }
});

test('schema 1 and 2 upgrade exact partial work, masks, collected finds and completed eligibility', () => {
  const legacy = { version: 1, room: 'excavation', dig: { 'courtyard-pocket': 0.4 }, cleaning: {}, collected: [] };
  assert.equal(parseSave(JSON.stringify(legacy))!.dig[findCell.id], 0.4);
  const cleaning = { [DISCOVERY.id]: ELIGIBLE_AREAS.slice(0, 7) };
  const partial = parseSave(JSON.stringify({ ...legacy, dig: { 'courtyard-pocket': 1 }, cleaning }))!;
  assert.equal(partial.version, 12); assert.deepEqual(partial.cleaning[DISCOVERY.id], cleaning[DISCOVERY.id]);
  const completed = parseSave(JSON.stringify({ ...legacy, dig: { 'courtyard-pocket': 1 }, collected: [DISCOVERY.id] }))!;
  assert.equal(isSiteComplete(completed), false);
  const gridSave = { ...legacy, version: 2, dig: { 'courtyard-l0-r5-c2': 1, 'courtyard-l0-r4-c2': 0.8 } };
  const upgraded = parseSave(JSON.stringify(gridSave))!;
  assert.equal(upgraded.dig[findCell.id], 0.8);
  assert.equal(upgraded.dig['courtyard-r7-c3'], 1);
  assert.deepEqual(parseSave(JSON.stringify(upgraded)), upgraded);
  const cleaned = parseSave(JSON.stringify({ ...gridSave, dig: { ...gridSave.dig, 'courtyard-l0-r4-c2': 1 }, cleaning }))!;
  assert.deepEqual(cleaned.cleaning[DISCOVERY.id], cleaning[DISCOVERY.id]);
  const allOld = Object.fromEntries(Array.from({ length: 36 }, (_, i) => [`courtyard-l0-r${Math.floor(i / 6)}-c${i % 6}`, 1]));
  assert.equal(isSiteComplete(parseSave(JSON.stringify({ ...gridSave, dig: allOld, collected: [DISCOVERY.id] }))!), false);
  assert.equal(parseSave(JSON.stringify({ ...gridSave, dig: { 'courtyard-l0-r6-c2': 1 } })), null);
  assert.equal(parseSave(JSON.stringify({ ...gridSave, cleaning })), null, 'old invariants validated before conversion');
});

test('walkable soil supports feet at each depth and the ladder bridges to the rim', () => {
  const state = freshSite(), cell = SITE.cells[27];
  assert.ok(groundHeight(state, cell) === 0);
  const partial = { ...state, dig: { [cell.id]: 0.5 } };
  assert.ok(Math.abs(groundHeight(partial, cell) + 0.07) < 1e-8);
  const empty = { ...state, dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) };
  assert.equal(groundHeight(empty, cell), SITE.grid.floorY);
  assert.equal(groundHeight(empty, SITE.interaction), 0);
  const ladder = { x: SITE.interaction.x, z: SITE.interaction.z - 0.8 };
  assert.ok(groundHeight(empty, ladder) > SITE.grid.floorY && groundHeight(empty, ladder) < 0);
});
