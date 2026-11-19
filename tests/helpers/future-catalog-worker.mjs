// Isolated process: mutate live definitions BEFORE importing any save reader.
// This catches accidental import-time snapshots as well as direct dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as exhibits from '../../src/content/exhibit.ts';
import * as journey from '../../src/content/journey.ts';
import { PURCHASES } from '../../src/content/purchases.ts';
import { MAP_SITES } from '../../src/content/world-map.ts';
import { ECONOMY } from '../../src/content/economy.ts';
import { HELPERS } from '../../src/content/helpers.ts';
import { UPGRADES } from '../../src/content/upgrades.ts';
import { VISITORS } from '../../src/content/visitors.ts';

const scenario = process.argv[2];
const includes = name => scenario === name || scenario === 'combined';
if (includes('purchases')) {
  const originalCount = PURCHASES.length;
  for (const offer of PURCHASES) { offer.cost += 100; offer.kind = 'expansion'; }
  PURCHASES.push({ ...PURCHASES[0], id: 'future-stand', cost: 101 },
    { ...PURCHASES[0], id: 'future-room', cost: 201 });
  assert.equal(PURCHASES.length, originalCount + 2);
}
if (includes('exhibits')) {
  for (const exhibit of exhibits.EXHIBITS) exhibit.parts.push('future-part');
  const part = { id: 'future-part', discoveryId: 'future-discovery' };
  for (const parts of [exhibits.GROUPS, exhibits.FIRST_PARTS, exhibits.ALL_PARTS]) parts.push(part);
  exhibits.EXHIBITS.push({ ...exhibits.EXHIBITS[0], id: 'future-exhibit', parts: [part.id] });
  journey.ALL_DISCOVERIES.push({ ...journey.DISCOVERY, id: part.discoveryId });
  journey.DISCOVERY.cleaning.completion = 0.1;
  journey.CLEANING_AREAS.splice(0, journey.CLEANING_AREAS.length, 9999);
  journey.ELIGIBLE_AREAS.splice(0, journey.ELIGIBLE_AREAS.length, 9999);
}
if (includes('sites')) {
  // Include prior layouts too: preserving a schema label alone is insufficient.
  const sites = new Set([journey.LEGACY_SITE, journey.LEGACY_SLAB_SITE,
    journey.LEGACY_SHARED_SITE, journey.LEGACY_ERYOPS_SITE,
    ...journey.LEGACY_FOOTPRINT_SITES, ...journey.SITES]);
  for (const site of sites) {
    site.requiredDiscoveryIds = [...site.requiredDiscoveryIds, 'future-discovery'];
    site.grid = { ...site.grid, levels: 7, rows: 9, columns: 9 };
    site.requires = 'future-site';
    site.cells = site.cells.map(cell => ({ ...cell, id: `changed-${cell.id}`, discoveryId: 'future-discovery' }));
  }
  journey.SITES.push({ ...journey.SITE, id: 'future-site' });
  MAP_SITES.push({ ...MAP_SITES[0], id: 'future-site', cost: 99, playable: true });
  for (const site of MAP_SITES) site.cost += 100;
  assert.equal(journey.SITES.length, 3);
}
if (includes('rewards')) Object.assign(ECONOMY, { startingCoins: 999, dropChance: 1, dropCoins: 7, layoutRevision: 99 });
if (includes('management')) {
  Object.assign(HELPERS, { cost: 600, available: 3, swingSeconds: 0.1, workPerSwing: 4 });
  for (const upgrade of UPGRADES) upgrade.cost += 100;
  UPGRADES.push({ ...UPGRADES[0], id: 'future-upgrade', cost: 100 });
  Object.assign(VISITORS, { capacity: 1, queueCapacity: 0, basePrice: 10, perDisplay: 5 });
}

const { parseLedgerSave, loadLedgerSave } = await import('../../src/persistence/ledger-save.ts');
const { migrateMuseumSave } = await import('../../src/game/purchases.ts');
const cases = JSON.parse(readFileSync(0, 'utf8'));
for (const { name, input, expected, loaded } of cases) {
  const raw = JSON.stringify(input), result = parseLedgerSave(raw, 42);
  assert.deepEqual(result, expected, `${scenario}: ${name}`);
  if (expected) {
    assert.deepEqual(parseLedgerSave(JSON.stringify(result), 42), result, `${name}: repeat migration/round trip`);
    const port = { getItem: () => raw, setItem: () => assert.fail('reader wrote storage'), removeItem: () => assert.fail('reader deleted storage') };
    assert.deepEqual(loadLedgerSave(port, 42), loaded, `${name}: load recovery`);
    if (input.version === 13) assert.deepEqual(migrateMuseumSave(input).museum.owned.map(r => r.id),
      ['stand-dimetrodon', 'stand-trilobite', 'west-wing', 'stand-eryops'], 'direct migration grants only the historical four');
  }
}
console.log(`${scenario}: ${cases.length} unchanged validation/migration results`);
