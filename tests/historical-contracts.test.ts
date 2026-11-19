import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseLedgerSave, loadLedgerSave } from '../src/persistence/ledger-save.ts';
import * as historical from '../src/persistence/contracts/journey-v12.ts';
import * as progression from '../src/persistence/contracts/progression-v22.ts';
import * as live from '../src/content/journey.ts';
import { findIsExposed } from '../src/game/burial.ts';
import { createGameSave } from '../src/game/economy.ts';
import { helperLayer } from '../src/game/helpers.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
const inputs = { ...fixtures };
for (let version = 1; version <= 12; version++) {
  const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
  if (version >= 4) old.closedSites = []; if (version >= 6) old.placed = [];
  if (version >= 8) old.activeSiteId = 'courtyard-dig';
  inputs[`schema-${version}`] = old;
}
for (let version = 13; version <= 21; version++) {
  const old = { ...fixtures.fresh21, version };
  for (const [minimum, field] of [[14, 'museum'], [15, 'world'], [16, 'visitors'], [17, 'helpers'],
    [18, 'custody'], [19, 'upgrades'], [20, 'payments'], [21, 'pendingTicketRevenue']] as const)
    if (version < minimum) delete old[field];
  inputs[`schema-${version}`] = old;
}
inputs.bothClosed13 = createGameSave({ ...historical.freshJourney(),
  dig: Object.fromEntries(live.SITES.flatMap(site => site.cells.map(cell => [cell.id, 1]))),
  collected: live.SITES.flatMap(site => [...site.requiredDiscoveryIds]),
  closedSites: live.SITES.map(site => site.id), placed: historical.ALL_PARTS.map(part => part.id),
}, 42);
// A real partially worked task exercises frozen work units, not just ownership.
const taskSave = parseLedgerSave(JSON.stringify(fixtures.managed21), 42)!;
assert.ok(taskSave);
for (const custody of Object.values(taskSave.custody)) if (custody.location === 'delivery')
  taskSave.custody['eryops-spine-find'] = { siteId: custody.siteId, location: 'storage' };
const cell = live.ERYOPS_SITE.cells.find(cell => helperLayer(taskSave, live.ERYOPS_SITE.id, cell.id));
assert.ok(cell);
const layer = helperLayer(taskSave, live.ERYOPS_SITE.id, cell.id)!;
taskSave.helpers.nextTask = 2;
taskSave.helpers.owned[0] = { ...taskSave.helpers.owned[0], phase: 'paused', task: {
  id: 1, siteId: live.ERYOPS_SITE.id, cellId: cell.id, layer: layer.layer, start: layer.start, required: layer.required, work: layer.required / 2,
} };
inputs.partialTask22 = taskSave;
for (const [name, input] of Object.entries(inputs)) {
  const migrated = parseLedgerSave(JSON.stringify(input), 42); assert.ok(migrated, name);
  inputs[`${name}-as22`] = migrated;
}
// Every accepted baseline is compared in full, including claims/exclusions,
// locked paid tours, partial deposits, custody and loader-only recovery.
const cases = Object.entries(inputs).map(([name, input]) => {
  const raw = JSON.stringify(input), expected = parseLedgerSave(raw, 42); assert.ok(expected, name);
  const loaded = loadLedgerSave({ getItem: () => raw, setItem: () => assert.fail(), removeItem: () => assert.fail() }, 42);
  return { name, input, expected, loaded };
});
const invalid: Record<string, (save: any) => void> = {
  extraCoin: s => s.economy.coins++, negativeCoins: s => s.economy.coins = -1,
  pendingInflation: s => s.pendingTicketRevenue++, ledgerInflation: s => s.visitors.sales.counts['2']++,
  futureReceipt: s => s.museum.owned.push({ id: 'future-room', source: 'legacy', paid: 0 }),
  changedPaidAmount: s => s.museum.owned[0].paid++, duplicateReceipt: s => s.museum.owned.push(s.museum.owned[0]),
  futureDeposit: s => s.payments.partial['future-stand'] = 1, overpaidDeposit: s => s.payments.partial['west-wing'] = 18,
  futureCollected: s => s.collected.push('future-discovery'), unearnedClosure: s => s.closedSites.push('eryops-dig'),
  unknownSoil: s => s.economy.sites['future-site'] = s.economy.sites['courtyard-dig'],
  changedLayout: s => s.economy.sites['courtyard-dig'].layout = 99,
  rerolledSoil: s => s.economy.sites['courtyard-dig'].outcomes['courtyard-dig/v1/courtyard-r0-c0/0'] += 7,
  duplicateClaim: s => { const m = s.economy.sites['courtyard-dig']; m.claimed.push(m.claimed[0]); },
};
for (const [name, corrupt] of Object.entries(invalid)) {
  const input = structuredClone(inputs['deposits21-as22']); corrupt(input);
  assert.equal(parseLedgerSave(JSON.stringify(input), 42), null, name);
  cases.push({ name: `invalid-${name}`, input, expected: null, loaded: undefined });
}

for (const scenario of ['purchases', 'exhibits', 'sites', 'rewards', 'management', 'combined'])
  test(`historical contracts ignore live ${scenario} changes made before reader imports`, () => {
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('./helpers/future-catalog-worker.mjs', import.meta.url)), scenario],
      { input: JSON.stringify(cases), encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.match(child.stdout, new RegExp(`${cases.length} unchanged`));
  });

test('schema 22 round trips retain full receipts, zero-paid grants, deposits, tasks and closed soil', () => {
  for (const [name, input] of Object.entries(inputs)) if (input.version === 22)
    assert.deepEqual(parseLedgerSave(JSON.stringify(input), 42), input, name);
  const paid = inputs['managed21-as22'];
  assert.deepEqual(paid.museum.owned.find(r => r.id === 'west-wing'), { id: 'west-wing', source: 'purchase', paid: 18 });
  assert.equal(inputs['deposits21-as22'].payments.partial['west-wing'], 5);
  assert.equal(inputs['legacy12-as22'].museum.owned.length, 4);
  assert.ok(inputs['legacy12-as22'].museum.owned.every(r => r.source === 'legacy' && r.paid === 0));
  assert.deepEqual(inputs['bothClosed13-as22'].closedSites, ['courtyard-dig', 'eryops-dig']);
  assert.ok(parseLedgerSave(JSON.stringify(taskSave), 42)!.helpers.owned[0].task);
});

test('historical definitions are deeply immutable and have no runtime catalog imports', () => {
  function frozen(value: unknown) {
    if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
  }
  for (const module of [historical, progression]) for (const value of Object.values(module)) if (typeof value !== 'function') frozen(value);
  for (const file of ['journey-v12', 'economy-v1', 'progression-v22']) {
    const source = readFileSync(new URL(`../src/persistence/contracts/${file}.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*from\s+['"][^'"]*(?:content|game)\//);
  }
});

test('frozen burial thresholds match every historical layout at the exposure boundary', () => {
  const pairs = [
    [historical.LEGACY_SITE, live.LEGACY_SITE], [historical.LEGACY_SLAB_SITE, live.LEGACY_SLAB_SITE],
    [historical.LEGACY_SHARED_SITE, live.LEGACY_SHARED_SITE], [historical.LEGACY_ERYOPS_SITE, live.LEGACY_ERYOPS_SITE],
    ...historical.LEGACY_FOOTPRINT_SITES.map((s, i) => [s, live.LEGACY_FOOTPRINT_SITES[i]] as const),
    ...historical.SITES.map((s, i) => [s, live.SITES[i]] as const),
  ] as const;
  for (const [old, current] of pairs) {
    assert.deepEqual(old.requiredDiscoveryIds, current.requiredDiscoveryIds);
    assert.deepEqual(old.cells.map(c => c.id), current.cells.map(c => c.id));
    assert.equal(old.grid.levels, current.grid.levels);
    for (const id of old.requiredDiscoveryIds) {
      const dig = Object.fromEntries(old.cells.filter(c => c.discoveryId === id).map(c => [c.id, c.exposure]));
      assert.equal(historical.findIsExposed(dig, old, id), true);
      assert.equal(findIsExposed(dig, current, id), true);
      for (const [cellId, fraction] of Object.entries(dig)) {
        const below = { ...dig, [cellId]: fraction - 1e-8 };
        assert.equal(historical.findIsExposed(below, old, id), false);
        assert.equal(findIsExposed(below, current, id), false);
      }
    }
  }
});
