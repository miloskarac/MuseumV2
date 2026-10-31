import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITES, SITE, LEGACY_SHARED_SITE, LEGACY_ERYOPS_SITE, LEGACY_FOOTPRINT_SITES } from '../src/content/journey.ts';
import { ALL_PARTS, FIRST_PARTS } from '../src/content/exhibit.ts';
import { freshJourney, digAt, isUncovered, pendingDiscovery, brush, collectFossil } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { parseSave } from '../src/persistence/save.ts';
import { findBurial } from '../src/game/burial.ts';

const firstComplete = () => ({ dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
  collected: FIRST_PARTS.map(p => p.discoveryId), closedSites: [SITE.id] });
const reload = (state: JourneyState) => {
  const loaded = parseSave(JSON.stringify(state)); assert.deepEqual(loaded, state); return loaded!;
};

test('every find occupies a complete multi-tile rectangle; tails are long and ribs and slabs are broad', () => {
  for (const site of SITES) {
    for (const id of site.requiredDiscoveryIds) {
      const cells = site.cells.filter(c => c.discoveryId === id);
      const columns = new Set(cells.map(c => c.column)), rows = new Set(cells.map(c => c.row));
      assert.ok(cells.length >= 2, id);
      assert.equal(cells.length, columns.size * rows.size, `${id}: no holes or overlaps`);
      assert.equal(columns.size, Math.max(...columns) - Math.min(...columns) + 1);
      assert.equal(rows.size, Math.max(...rows) - Math.min(...rows) + 1);
      if (id.includes('tail')) assert.deepEqual([columns.size, rows.size].sort(), [1, 4]);
      if (id.includes('ribs') || id === 'trilobite-slab') { assert.equal(columns.size, 2); assert.equal(rows.size, 2); }
    }
  }
});

test('long bones face both directions and retain their original excavation area', () => {
  for (const [siteIndex, site] of SITES.entries()) for (const id of site.requiredDiscoveryIds) {
    const cells = site.cells.filter(c => c.discoveryId === id);
    assert.equal(cells.length, LEGACY_FOOTPRINT_SITES[siteIndex].cells.filter(c => c.discoveryId === id).length);
    if (id === 'dimetrodon-tail' || id === 'eryops-spine-find') assert.equal(new Set(cells.map(c => c.column)).size, 1);
    if (id === 'eryops-tail-find') assert.equal(new Set(cells.map(c => c.row)).size, 1);
  }
});

test('each find waits for its final covering tile, retaining partial work through reload and rejecting premature cleaning', () => {
  for (const site of SITES) for (const id of site.requiredDiscoveryIds) {
    let state: JourneyState = { ...freshJourney(), ...(site === SITE ? {} : firstComplete()),
      room: 'excavation', activeSiteId: site.id };
    state.dig = { ...state.dig, ...Object.fromEntries(site.cells.map(c => [c.id, (site.grid.levels - 1) / site.grid.levels])) };
    const cells = findBurial(site, id).coverage.filter(c => c.lastLayer === site.grid.levels - 1).map(c => c.cell).reverse();
    for (const [i, cell] of cells.entries()) {
      for (let hit = (site.grid.levels - 1) * 2 + 1; hit <= site.grid.levels * 2; hit++) {
        assert.equal(isUncovered(state, id), false);
        assert.equal(pendingDiscovery(state), undefined);
        assert.equal(brush(state, { x: 0, y: 0.5 }, { x: 1, y: 0.5 }, id), state);
        assert.equal(collectFossil(state, id), state);
        state = reload(digAt(state, cell));
        assert.equal(state.dig[cell.id], hit / (site.grid.levels * 2));
      }
      assert.equal(isUncovered(state, id), i === cells.length - 1);
    }
    assert.equal(pendingDiscovery(state)?.id, id);
    for (const y of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) state = brush(state, { x: 0, y }, { x: 1, y }, id);
    state = reload(collectFossil(state, id));
    assert.equal(collectFossil(state, id), state);
  }
});

for (const version of [10, 11]) test(`schema ${version} preserves every uncovered, cleaning, collected and placed find without replay or lost earth progress`, () => {
  for (const oldSite of version === 10 ? [LEGACY_SHARED_SITE, LEGACY_ERYOPS_SITE] : LEGACY_FOOTPRINT_SITES) {
    for (const id of oldSite.requiredDiscoveryIds) for (const stage of ['uncovered', 'cleaning', 'collected', 'placed']) {
      const part = ALL_PARTS.find(p => p.discoveryId === id)!;
      const cells = oldSite.cells.filter(c => c.discoveryId === id);
      const base = { ...freshJourney(), ...(oldSite.id === SITE.id ? {} : firstComplete()) };
      const old = { ...base, version, activeSiteId: oldSite.id,
        dig: { ...base.dig, ...Object.fromEntries(cells.map(c => [c.id, 1])), [oldSite.cells[0].id]: 0.5 },
        cleaning: stage === 'cleaning' ? { [id]: [0, 1, 2] } : {},
        collected: [...base.collected, ...(['collected', 'placed'].includes(stage) ? [id] : [])],
        placed: stage === 'placed' ? [part.id] : [] };
      const state = parseSave(JSON.stringify(old))!;
      assert.ok(state); assert.equal(state.version, 12);
      assert.ok(isUncovered(state, id));
      assert.deepEqual(state.cleaning, old.cleaning); assert.deepEqual(state.collected, old.collected);
      assert.deepEqual(state.placed, old.placed); assert.deepEqual(state.closedSites, old.closedSites);
      for (const [key, progress] of Object.entries(old.dig)) assert.ok(state.dig[key] >= progress);
      reload(state);
    }
  }
});

test('schema 11 partial finds keep earth work, reject premature collection and preserve closed sites', () => {
  for (const oldSite of LEGACY_FOOTPRINT_SITES) {
    const base = { ...freshJourney(), ...(oldSite.id === SITE.id ? {} : firstComplete()), version: 11, activeSiteId: oldSite.id };
    for (const id of oldSite.requiredDiscoveryIds) {
      const cells = oldSite.cells.filter(c => c.discoveryId === id);
      const old = { ...base, dig: { ...base.dig, ...Object.fromEntries(cells.map((c, i) => [c.id, i === 0 ? 0.5 : 1])) } };
      const loaded = parseSave(JSON.stringify(old))!;
      assert.ok(loaded); assert.deepEqual(loaded.dig, old.dig); reload(loaded);
      assert.equal(parseSave(JSON.stringify({ ...old, collected: [...old.collected, id] })), null);
      assert.equal(parseSave(JSON.stringify({ ...old, cleaning: { [id]: [1] } })), null);
    }
    const closed = { ...base, dig: { ...base.dig, ...Object.fromEntries(oldSite.cells.map(c => [c.id, 1])) },
      collected: [...base.collected, ...oldSite.requiredDiscoveryIds], closedSites: [...base.closedSites, oldSite.id] };
    assert.deepEqual(parseSave(JSON.stringify(closed)), { ...closed, version: 12 });
  }
});

test('partial old tiles stay partial, invalid legacy entitlements stay rejected, reset starts buried', () => {
  const cell = LEGACY_SHARED_SITE.cells.find(c => c.discoveryId)!;
  const old = { ...freshJourney(), version: 10, dig: { [cell.id]: 0.5 } };
  const state = parseSave(JSON.stringify(old))!;
  assert.deepEqual(state.dig, old.dig); assert.deepEqual(state.collected, []); reload(state);
  assert.equal(parseSave(JSON.stringify({ ...old, collected: [cell.discoveryId] })), null);
  assert.equal(parseSave(JSON.stringify({ ...old, cleaning: { [cell.discoveryId!]: [1] } })), null);
  assert.ok(SITES.every(site => site.requiredDiscoveryIds.every(id => !isUncovered(freshJourney(), id))));
});
