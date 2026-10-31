import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PURCHASES } from '../src/content/purchases.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { SITE, ERYOPS_SITE, SITES } from '../src/content/journey.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney, digAt } from '../src/game/journey.ts';
import { createMuseumSave, migrateMuseumSave, advanceMuseum, buyPurchase, purchaseStatus,
  placeOwnedGroup, displayedExhibits, standAvailable, museumJourney } from '../src/game/purchases.ts';
import type { MuseumSave } from '../src/game/purchases.ts';
import { museumLayout, safeMuseumPosition } from '../src/game/museum-layout.ts';
import { ARRIVAL, START, PORTAL, EXHIBIT, isWalkable, movePlayer } from '../src/game/navigation.ts';
import { parseMuseumSave, loadMuseumSave, PURCHASE_QA_KEY } from '../src/persistence/museum-save.ts';
import { parseGameSave } from '../src/persistence/game-save.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { createCommitter } from '../src/app/commit.ts';

const reload = (save: MuseumSave) => { assert.deepEqual(parseMuseumSave(JSON.stringify(save), 991), save); return save; };
function recovered(seed = 42): MuseumSave {
  return advanceMuseum(createMuseumSave(seed), { ...freshJourney(), activeSiteId: ERYOPS_SITE.id,
    dig: Object.fromEntries(SITES.flatMap(site => site.cells.map(cell => [cell.id, 1]))),
    collected: SITES.flatMap(site => [...site.requiredDiscoveryIds]), closedSites: SITES.map(site => site.id) }) as MuseumSave;
}
function display(save: MuseumSave, id: typeof EXHIBITS[number]['id']) {
  for (const group of EXHIBITS.find(exhibit => exhibit.id === id)!.parts) {
    save = advanceMuseum(save, placeOwnedGroup(save, id, group, group)) as MuseumSave;
  }
  return save;
}

test('either first stand order is affordable with zero digging income; duplicates and invalid offers do nothing', () => {
  for (const order of [['stand-dimetrodon', 'stand-trilobite'], ['stand-trilobite', 'stand-dimetrodon']]) {
    let save = createMuseumSave(42);
    assert.equal(save.economy.coins, 20); assert.deepEqual(save.museum.owned, []);
    assert.equal(purchaseStatus(save, 'west-wing'), 'displayFirst');
    for (const id of order) {
      save = reload(buyPurchase(save, id));
      assert.equal(buyPurchase(save, id), save);
    }
    assert.equal(save.economy.coins, 0); assert.equal(save.museum.owned.length, 2);
    assert.equal(buyPurchase(save, 'stand-fake'), save);
    assert.equal(buyPurchase({ ...save, room: 'outdoors' }, 'west-wing').economy.coins, 0);
  }
});

test('stand ownership gates the shared placement path; partial displays do not unlock expansion', () => {
  let save = recovered();
  const before = museumJourney(save);
  assert.deepEqual(placeOwnedGroup(save, 'dimetrodon', 'skull', 'skull'), before);
  save = buyPurchase(save, 'stand-dimetrodon');
  assert.deepEqual(placeOwnedGroup(save, 'trilobite', 'skull', 'skull'), museumJourney(save));
  assert.deepEqual(placeOwnedGroup(save, 'dimetrodon', 'skull', 'tail'), museumJourney(save));
  save = advanceMuseum(save, placeOwnedGroup(save, 'dimetrodon', 'skull', 'skull')) as MuseumSave;
  reload(save); assert.deepEqual(displayedExhibits(save), []);
  assert.equal(purchaseStatus(save, 'west-wing'), 'displayFirst');
  const complete = display(save, 'dimetrodon'); reload(complete);
  assert.deepEqual(displayedExhibits(complete), ['dimetrodon']);
  assert.deepEqual(display(display(complete, 'dimetrodon'), 'dimetrodon'), complete);
});

test('digging after spending preserves ownership and the lifetime income minus spending invariant', () => {
  let save = buyPurchase(createMuseumSave(42), 'stand-dimetrodon');
  save = advanceMuseum(save, { ...museumJourney(save), room: 'excavation' }) as MuseumSave;
  const manifest = save.economy.sites[SITE.id];
  const key = Object.keys(manifest.outcomes).find(id => manifest.outcomes[id] === 1)!;
  const cell = SITE.cells.find(cell => key.includes(`/${cell.id}/`))!;
  for (let hit = 0; hit < 2; hit++) save = reload(advanceMuseum(save, digAt(museumJourney(save), cell)) as MuseumSave);
  assert.equal(save.economy.coins, 9); assert.equal(save.museum.owned[0].id, 'stand-dimetrodon');
  assert.equal(save.museum.owned[0].paid, 12); assert.equal(save.economy.sites[SITE.id].claimed.length, 1);
});

test('expansion and Eryops prerequisites, insufficiency and all purchases survive reload', () => {
  let seed = 0, save = recovered(seed);
  while (save.economy.coins < 50) save = recovered(++seed);
  const original = save.economy.coins;
  assert.equal(purchaseStatus(save, 'stand-eryops'), 'wingFirst');
  save = reload(display(buyPurchase(save, 'stand-trilobite'), 'trilobite'));
  assert.equal(purchaseStatus({ ...save, economy: { ...save.economy, coins: 17 } }, 'west-wing'), 'insufficient');
  const poor = { ...save, economy: { ...save.economy, coins: 17 } };
  assert.equal(buyPurchase(poor, 'west-wing'), poor);
  save = reload(buyPurchase(save, 'west-wing'));
  assert.equal(purchaseStatus({ ...save, closedSites: [] }, 'stand-eryops'), 'siteFirst');
  save = reload(buyPurchase(save, 'stand-eryops'));
  save = reload(buyPurchase(save, 'stand-dimetrodon'));
  save = reload(display(save, 'eryops'));
  assert.equal(save.economy.coins, original - 50);
  assert.equal(standAvailable(save, 'eryops'), true);
  assert.deepEqual(displayedExhibits(save), ['trilobite', 'eryops']);
  assert.equal(parseGameSave(JSON.stringify(save), 0), null, 'old game cannot accidentally load QA schema');
});

test('old V2 saves retain all stands, space, progress and coins without a debit or refund', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = [];
    if (version >= 6) old.placed = [];
    if (version >= 8) old.activeSiteId = SITE.id;
    const save = parseMuseumSave(JSON.stringify(old), 42)!;
    assert.ok(save, `schema ${version}`); reload(save);
    assert.equal(save.economy.coins, 20); assert.equal(save.museum.owned.length, 4);
    assert.ok(save.museum.owned.every(item => item.source === 'legacy' && item.paid === 0));
    assert.equal(museumLayout(save).floor.width, 25);
  }
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: ['skull', 'trilobite-whole'] }, 42);
  const save = parseMuseumSave(JSON.stringify(old), 100)!;
  assert.deepEqual(museumJourney(save), museumJourney(old));
  assert.deepEqual(save.economy, old.economy); reload(save);
  assert.deepEqual(parseMuseumSave(JSON.stringify(save), 999), save, 'migration cannot regrant or charge');
});

test('schema 14 rejects fake receipts, contradictory ownership and unearned placement', () => {
  const fresh = createMuseumSave(42);
  const paid = buyPurchase(fresh, 'stand-trilobite');
  const invalid: unknown[] = [
    { ...paid, museum: { ...paid.museum, owned: [...paid.museum.owned, ...paid.museum.owned] } },
    { ...paid, museum: { version: 1, owned: [{ id: 'unknown', source: 'purchase', paid: 8 }] } },
    { ...paid, museum: { version: 1, owned: [{ id: 'stand-trilobite', source: 'purchase', paid: 1 }] } },
    { ...fresh, museum: { version: 1, owned: [{ id: 'stand-trilobite', source: 'legacy', paid: 0 }] } },
    { ...paid, museum: undefined }, { ...paid, version: 15 },
  ];
  for (const coins of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, 20]) invalid.push({ ...paid, economy: { ...paid.economy, coins } });
  const full = recovered();
  invalid.push({ ...full, placed: ['skull'] });
  invalid.push({ ...full, economy: { ...full.economy, coins: full.economy.coins - 18 },
    museum: { version: 1, owned: [{ id: 'west-wing', source: 'purchase', paid: 18 }] } });
  invalid.push({ ...full, economy: { ...full.economy, coins: full.economy.coins - 12 },
    museum: { version: 1, owned: [{ id: 'stand-eryops', source: 'purchase', paid: 12 }] } });
  for (const value of invalid) assert.equal(parseMuseumSave(JSON.stringify(value), 42), null);
});

test('QA loader handles fresh, failed and invalid reads without touching the normal save key', () => {
  assert.notEqual(PURCHASE_QA_KEY, SAVE_KEY);
  const data = new Map([[SAVE_KEY, 'normal-game'], [PURCHASE_QA_KEY, '{broken']]);
  const port = { getItem: () => data.get(PURCHASE_QA_KEY) ?? null,
    setItem: (_key: string, value: string) => { data.set(PURCHASE_QA_KEY, value); }, removeItem: () => { data.delete(PURCHASE_QA_KEY); } };
  assert.deepEqual(loadMuseumSave(port, 42), { kind: 'invalid' });
  assert.equal(data.get(PURCHASE_QA_KEY), '{broken'); assert.equal(data.get(SAVE_KEY), 'normal-game');
  data.delete(PURCHASE_QA_KEY);
  const result = loadMuseumSave(port, 42); assert.equal(result.kind, 'ready');
  if (result.kind === 'ready') assert.equal(result.save.museum.owned.length, 0);
  assert.deepEqual(loadMuseumSave({ ...port, getItem() { throw Error('denied'); } }, 42), { kind: 'unavailable' });
});

test('a failed purchase preserves balance and geometry until exact-candidate retry; reset cancels pending ownership', () => {
  let stored = '', fail = false, live = createMuseumSave(42), effects = 0;
  const port = { getItem: () => stored || null, setItem(_key: string, value: string) { if (fail) throw Error('quota'); stored = value; }, removeItem() { stored = ''; } };
  const commit = createCommitter<MuseumSave>(port, () => {}); commit.enable();
  commit.commit(live, next => { live = next; });
  const before = stored, candidate = buyPurchase(live, 'stand-dimetrodon');
  fail = true;
  assert.equal(commit.commit(candidate, next => { live = next; effects++; }), 'failed');
  assert.equal(stored, before); assert.equal(museumLayout(live).assembled.length, 0); assert.equal(live.economy.coins, 20);
  assert.equal(commit.canMutate(), false);
  fail = false; assert.equal(commit.flush(), 'saved'); commit.flush();
  assert.equal(effects, 1); assert.equal(live.economy.coins, 8); reload(live);
  assert.equal(museumLayout(live).assembled.length, 1);
  fail = true; commit.commit(buyPurchase(live, 'stand-trilobite'), next => { live = next; effects++; });
  assert.equal(commit.reset(), true); fail = false;
  commit.commit(createMuseumSave(75), next => { live = next; }); commit.flush();
  assert.deepEqual(live.museum.owned, []); assert.equal(effects, 1); reload(live); commit.dispose();
});

test('every museum ownership layout has reachable purchase spots, displays and entrance', () => {
  for (let mask = 0; mask < 16; mask++) {
    const owned = PURCHASES.filter((_, index) => mask & (1 << index));
    if (owned.some(p => p.id === 'stand-eryops') && !owned.some(p => p.id === 'west-wing')) continue;
    const save = { ...createMuseumSave(42), museum: { version: 1 as const,
      owned: owned.map(offer => ({ id: offer.id, source: 'purchase' as const, paid: offer.cost })) } };
    const layout = museumLayout(save), walkable = (p: { x: number; z: number }) => isWalkable(p, 'museum', layout.obstacles, layout.bounds);
    assert.ok(walkable(START)); assert.ok(walkable(ARRIVAL));
    assert.equal(layout.floor.width, layout.expanded ? 25 : 16);
    assert.equal(layout.floor.x - layout.floor.width / 2 + 0.3, layout.bounds.minX);
    const queue = [{ x: 5.5, z: 1.5 }], visited = new Set(['5.5,1.5']);
    for (let i = 0; i < queue.length; i++) for (const [dx, dz] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) {
      const p = { x: queue[i].x + dx, z: queue[i].z + dz }, key = `${p.x},${p.z}`;
      if (walkable(p) && !visited.has(key)) { visited.add(key); queue.push(p); }
    }
    for (const target of [...layout.spots, ...layout.purchases, PORTAL]) {
      assert.ok(walkable(target), `layout ${mask}: target walkable`);
      assert.ok(queue.some(p => Math.hypot(p.x - target.x, p.z - target.z) < 0.2), `layout ${mask}: target reachable`);
    }
  }
});

test('purchasing under the player relocates only when needed and new wing removes the old boundary', () => {
  const fresh = createMuseumSave(42), before = museumLayout(fresh);
  assert.equal(safeMuseumPosition(EXHIBIT, before), EXHIBIT);
  const after = museumLayout(buyPurchase(fresh, 'stand-dimetrodon'));
  const marker = after.spots[0], moved = safeMuseumPosition(EXHIBIT, after, marker);
  assert.deepEqual(moved, marker); assert.ok(isWalkable(moved, 'museum', after.obstacles, after.bounds));
  assert.equal(safeMuseumPosition(START, after), START);
  const full = museumLayout(migrateMuseumSave(createGameSave(freshJourney(), 42)));
  let p = { x: -7, z: -2.5 };
  for (let i = 0; i < 30; i++) p = movePlayer(p, { x: -1, z: 0 }, 0.05, 'museum', full.obstacles, full.bounds);
  assert.ok(p.x < -10); assert.equal(isWalkable(p, 'museum', before.obstacles, before.bounds), false);
});
