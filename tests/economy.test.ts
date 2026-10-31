import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY } from '../src/content/economy.ts';
import { SITE, ERYOPS_SITE, SITES, ALL_DISCOVERIES, CLEANING_AREAS } from '../src/content/journey.ts';
import { ALL_PARTS } from '../src/content/exhibit.ts';
import { freshJourney, digAt, stepDigging } from '../src/game/journey.ts';
import type { JourneyState } from '../src/game/journey.ts';
import { completionPhase, stepCompletion } from '../src/game/site-completion.ts';
import { advanceSimulation } from '../src/game/simulation-speed.ts';
import { createGameSave, advanceEconomy, journeyOf, soilKey, soilUnits, coinOutcome } from '../src/game/economy.ts';
import { parseGameSave, loadGameSave } from '../src/persistence/game-save.ts';
import { parseSave, SAVE_KEY } from '../src/persistence/save.ts';
import { createCommitter } from '../src/app/commit.ts';

const reload = (save: ReturnType<typeof createGameSave>) => {
  const result = parseGameSave(JSON.stringify(save), 9876); assert.deepEqual(result, save); return result!;
};
const firstDone = (): JourneyState => ({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
  collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] });

test('6.1 configuration, frozen manifests and stable identity across sites/layers', () => {
  assert.equal(ECONOMY.startingCoins, 20); assert.equal(ECONOMY.dropChance, 0.125); assert.equal(ECONOMY.dropCoins, 1);
  assert.equal(SITE.requires, null);
  assert.ok(ECONOMY.startingCoins >= 12 + 8, 'proposed starter stand budget works even with zero drops; purchases are not implemented');
  const save = createGameSave(freshJourney(), 42), outcomes = save.economy.sites[SITE.id].outcomes;
  assert.equal(save.version, 13); assert.equal(save.economy.coins, 20);
  assert.equal(Object.keys(outcomes).length, 64);
  assert.ok(Object.values(outcomes).includes(0)); assert.ok(Object.values(outcomes).includes(1));
  assert.deepEqual(createGameSave(freshJourney(), 42), save);
  assert.equal(new Set(SITES.flatMap(s => soilUnits(s).map(u => u.id))).size, 192);
  reload(save);
});

test('ordinary digging pays only a final layer hit, never duplicates or invalid-position hits', () => {
  let save = createGameSave({ ...freshJourney(), room: 'excavation' }, 42);
  const cell = SITE.cells.find(c => save.economy.sites[SITE.id].outcomes[soilKey(SITE, c.id, 0)] === 1)!;
  const first = digAt(journeyOf(save), cell);
  save = reload(advanceEconomy(save, first)); assert.equal(save.economy.coins, 20); assert.equal(save.dig[cell.id], 0.5);
  const second = digAt(journeyOf(save), cell);
  save = reload(advanceEconomy(save, second)); assert.equal(save.economy.coins, 21);
  const before = structuredClone(save);
  save = advanceEconomy(save, second); assert.deepEqual(save, before, 'repeated clear cannot pay twice');
  save = advanceEconomy(save, digAt(journeyOf(save), { x: 100, z: 100 })); assert.deepEqual(save, before);
  const blocked = digAt({ ...journeyOf(save), room: 'museum' }, cell);
  assert.deepEqual(blocked.dig, save.dig);
});

test('zero-reward cells still clear and the first hit never produces income', () => {
  let save = createGameSave({ ...freshJourney(), room: 'excavation' }, 42);
  const cell = SITE.cells.find(c => save.economy.sites[SITE.id].outcomes[soilKey(SITE, c.id, 0)] === 0)!;
  for (let hit = 0; hit < 2; hit++) save = reload(advanceEconomy(save, digAt(journeyOf(save), cell)));
  assert.equal(save.dig[cell.id], 1); assert.equal(save.economy.coins, 20);
});

test('entering the second site freezes its independent two-layer manifest before digging', () => {
  const initial = createGameSave(firstDone(), 42);
  assert.equal(initial.economy.sites[ERYOPS_SITE.id], undefined);
  const entered = reload(advanceEconomy(initial, { ...journeyOf(initial), room: 'excavation', activeSiteId: ERYOPS_SITE.id }));
  assert.equal(Object.keys(entered.economy.sites[ERYOPS_SITE.id].outcomes).length, 128);
  assert.equal(entered.economy.coins, 20); assert.equal(entered.economy.sites[SITE.id].excluded.length, 64);
});

test('multi-layer cleanup settles every newly removed layer once, including partial columns', () => {
  const cell = ERYOPS_SITE.cells[0];
  let seed = 0;
  while (!(coinOutcome(seed, soilKey(ERYOPS_SITE, cell.id, 0)) && coinOutcome(seed, soilKey(ERYOPS_SITE, cell.id, 1)))) seed++;
  const journey: JourneyState = { ...firstDone(), room: 'excavation', activeSiteId: ERYOPS_SITE.id,
    collected: ALL_DISCOVERIES.map(d => d.id),
    dig: { ...firstDone().dig, ...Object.fromEntries(ERYOPS_SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])), [cell.id]: 0.25 } };
  let save = createGameSave(journey, seed), pop = null;
  for (let i = 0; i < 7; i++) {
    const step = stepCompletion(journeyOf(save), ERYOPS_SITE.interaction, 0.05, pop, true);
    pop = step.pop; save = advanceEconomy(save, step.state);
  }
  assert.equal(save.dig[cell.id], 1); assert.equal(save.economy.coins, 22); reload(save);
  const rewardIds = [soilKey(ERYOPS_SITE, cell.id, 0), soilKey(ERYOPS_SITE, cell.id, 1)];
  assert.ok(rewardIds.every(id => save.economy.sites[ERYOPS_SITE.id].claimed.includes(id)));
  const duplicate = advanceEconomy(save, journeyOf(save)); assert.deepEqual(duplicate, save);
  assert.deepEqual(save.collected, journey.collected);
});

test('full automatic closure preserves the finite manifest total across interruption and reload', () => {
  const journey: JourneyState = { ...freshJourney(), room: 'excavation', collected: [...SITE.requiredDiscoveryIds],
    dig: Object.fromEntries(SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])) };
  let save = createGameSave(journey, 42), position = { ...SITE.interaction }, pop = null;
  const manifest = save.economy.sites[SITE.id];
  const expected = 20 + Object.entries(manifest.outcomes).filter(([id]) => !manifest.excluded.includes(id)).reduce((s, [, amount]) => s + amount, 0);
  for (let i = 0; i < 1500 && completionPhase(journeyOf(save)) !== 'closed'; i++) {
    const step = stepCompletion(journeyOf(save), position, 0.05, pop, true);
    save = advanceEconomy(save, step.state); position = step.position; pop = step.pop;
    if (i % 17 === 0) save = reload(save);
  }
  assert.deepEqual(save.closedSites, [SITE.id]); assert.equal(save.economy.coins, expected);
  assert.deepEqual(stepCompletion(journeyOf(save), position, 0.05, null, true).state, journeyOf(save));
});

test('all historical V2 schemas migrate once without retroactive coins', () => {
  for (let version = 1; version <= 12; version++) {
    const old: Record<string, unknown> = { version, room: 'museum', dig: {}, cleaning: {}, collected: [] };
    if (version >= 4) old.closedSites = [];
    if (version >= 6) old.placed = [];
    if (version >= 8) old.activeSiteId = SITE.id;
    const raw = JSON.stringify(old), journey = parseSave(raw)!;
    assert.ok(journey, `historical fixture ${version}`);
    const migrated = parseGameSave(raw, 42)!;
    assert.deepEqual(journeyOf(migrated), journey); assert.equal(migrated.economy.coins, 20); reload(migrated);
  }
  const complete = { ...firstDone(), placed: ALL_PARTS.filter(p => SITE.requiredDiscoveryIds.includes(p.discoveryId)).map(p => p.id) };
  const upgraded = parseGameSave(JSON.stringify(complete), 42)!;
  assert.equal(upgraded.economy.coins, 20); assert.equal(upgraded.economy.sites[SITE.id].excluded.length, 64);
  assert.deepEqual(journeyOf(upgraded), complete); reload(upgraded);
});

test('migration preserves partial earth and ready cleaning without paying for already cleared layers', () => {
  const old: JourneyState = { ...firstDone(), room: 'excavation', activeSiteId: ERYOPS_SITE.id,
    dig: { ...firstDone().dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, c.discoveryId === 'eryops-skull-find' ? 1 : 0.75])) },
    cleaning: { 'eryops-skull-find': [...CLEANING_AREAS] } };
  const save = parseGameSave(JSON.stringify(old), 42)!;
  assert.ok(save); assert.deepEqual(journeyOf(save), old); assert.equal(save.economy.coins, 20);
  assert.ok(save.economy.sites[ERYOPS_SITE.id].excluded.length > 64); reload(save);
});

test('current save validation rejects malformed money, manifests, claims and missing economy', () => {
  const save = createGameSave(freshJourney(), 42);
  const invalid = [];
  for (const amount of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 21]) invalid.push({ ...save, economy: { ...save.economy, coins: amount } });
  invalid.push({ ...save, economy: undefined }, { ...save, economy: { ...save.economy, sites: {} } }, { ...save, version: 99 });
  for (const mutate of [
    m => m.claimed.push(Object.keys(m.outcomes)[0]),
    m => m.claimed.push('invalid', 'invalid'),
    m => { m.outcomes[Object.keys(m.outcomes)[0]] = 3; },
    m => { m.excluded.push(Object.keys(m.outcomes)[0]); },
    m => { delete m.outcomes[Object.keys(m.outcomes)[0]]; },
    m => { m.levels = 2; },
  ]) { const bad = structuredClone(save); mutate(bad.economy.sites[SITE.id]); invalid.push(bad); }
  for (const bad of invalid) assert.equal(parseGameSave(JSON.stringify(bad), 42), null);
  const key = Object.keys(save.economy.sites[SITE.id].outcomes).find(k => save.economy.sites[SITE.id].outcomes[k] === 1)!;
  const unit = soilUnits(SITE).find(u => u.id === key)!;
  assert.equal(parseGameSave(JSON.stringify({ ...save, dig: { [unit.cellId]: 1 } }), 42), null, 'cleared reward must have its claim and coins');
});

test('load errors preserve corrupt raw data; migration outcomes are persisted before future reload', () => {
  const values = new Map([[SAVE_KEY, JSON.stringify(firstDone())]]);
  const port = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const result = loadGameSave(port, 42); assert.equal(result.kind, 'ready');
  if (result.kind !== 'ready') return;
  port.setItem(SAVE_KEY, JSON.stringify(result.save));
  assert.deepEqual(loadGameSave(port, 9876), { ...result, restored: true });
  values.set(SAVE_KEY, 'corrupt'); assert.deepEqual(loadGameSave(port, 1), { kind: 'invalid' }); assert.equal(values.get(SAVE_KEY), 'corrupt');
  assert.deepEqual(loadGameSave({ ...port, getItem() { throw Error('read'); } }, 1), { kind: 'unavailable' });
});

function commitFixture() {
  const values = new Map<string, string>(), jobs: { run: () => void; cancelled: boolean }[] = [];
  let fail = false, failRemove = false;
  const status: string[] = [];
  const port = { getItem: (k: string) => values.get(k) ?? null,
    setItem(k: string,v: string) { if (fail) throw Error('quota'); values.set(k,v); },
    removeItem(k: string) { if (failRemove) throw Error('remove'); values.delete(k); } };
  const committer = createCommitter<ReturnType<typeof createGameSave>>(port, s => status.push(s), {
    set(run) { const job = { run, cancelled: false }; jobs.push(job); return job; },
    clear(job) { (job as typeof jobs[number]).cancelled = true; },
  });
  committer.enable();
  return { values, jobs, status, committer, fail: (write: boolean, remove = false) => { fail = write; failRemove = remove; } };
}

test('critical save failure retains one immutable candidate, pauses mutations and publishes only on successful retry', () => {
  const f = commitFixture(); const base = createGameSave({ ...freshJourney(), room: 'excavation' }, 42);
  let live = base, effects = 0;
  f.committer.commit(base, save => { live = save; });
  const cell = SITE.cells.find(c => base.economy.sites[SITE.id].outcomes[soilKey(SITE,c.id,0)])!;
  const next = advanceEconomy(base, digAt(digAt(journeyOf(base), cell), cell));
  f.fail(true);
  assert.equal(f.committer.commit(next, save => { live = save; effects++; }), 'failed');
  assert.equal(live.economy.coins, 20); assert.equal(f.committer.canMutate(), false);
  assert.equal(JSON.parse(f.values.get(SAVE_KEY)!).economy.coins, 20);
  assert.equal(f.committer.commit(next, () => effects++), 'blocked');
  assert.equal(f.committer.checkpoint(base), false);
  next.economy.coins = 999;
  f.fail(false); assert.equal(f.committer.flush(), 'saved');
  assert.equal(live.economy.coins, 21); assert.equal(effects, 1); reload(live);
  assert.equal(f.committer.flush(), 'idle'); assert.equal(effects, 1); f.committer.dispose();
});

test('stale checkpoints cannot overwrite a later commit, reset or blocked session', () => {
  const f = commitFixture(), base = createGameSave(freshJourney(), 42);
  f.committer.checkpoint(base); const stale = f.jobs[0];
  const next = { ...base, room: 'outdoors' as const };
  assert.equal(f.committer.commit(next, () => {}), 'saved'); stale.run();
  assert.equal(JSON.parse(f.values.get(SAVE_KEY)!).room, 'outdoors');
  f.committer.checkpoint(next); const resetStale = f.jobs.at(-1)!;
  assert.equal(f.committer.reset(), true); resetStale.run(); assert.equal(f.values.has(SAVE_KEY), false);
  f.committer.checkpoint(base); const blockedStale = f.jobs.at(-1)!;
  f.committer.block(); blockedStale.run(); assert.equal(f.committer.flush(), 'blocked'); assert.equal(f.values.has(SAVE_KEY), false);
  f.committer.dispose();
});

test('failed checkpoints freeze work, and reset cancels a failed pending reward without later resurrection', () => {
  const f = commitFixture(), base = createGameSave(freshJourney(), 42);
  f.fail(true); f.committer.checkpoint(base); f.jobs[0].run(); assert.equal(f.committer.canMutate(), false);
  f.fail(false); assert.equal(f.committer.flush(), 'saved'); assert.equal(f.committer.canMutate(), true);
  f.fail(true); let effects = 0;
  f.committer.commit({ ...base, room: 'outdoors' }, () => effects++);
  f.fail(true, true); assert.equal(f.committer.reset(), false); assert.equal(effects, 0);
  f.fail(false); assert.equal(f.committer.reset(), true);
  assert.equal(f.committer.flush(), 'idle'); assert.equal(effects, 0); assert.equal(f.values.has(SAVE_KEY), false);
  f.committer.dispose();
});

test('simulation speed and paused time cannot multiply one layer reward', () => {
  function run(speed: 1 | 10) {
    let save = createGameSave({ ...freshJourney(), room: 'excavation' }, 42), swing = null;
    const cell = SITE.cells.find(c => save.economy.sites[SITE.id].outcomes[soilKey(SITE,c.id,0)])!;
    for (let frame = 0; frame < 200 / speed; frame++) advanceSimulation(0.01, speed, seconds => {
      const step = stepDigging(journeyOf(save), cell, seconds, swing, true); swing = step.swing; save = advanceEconomy(save, step.state);
    });
    const before = structuredClone(save);
    for (let frame = 0; frame < 50; frame++) {
      const step = stepDigging(journeyOf(save), cell, 100, swing, false); save = advanceEconomy(save, step.state);
    }
    assert.deepEqual(save, before); return reload(save);
  }
  assert.deepEqual(run(1), run(10));
});
