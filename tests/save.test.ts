import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISCOVERY, DISCOVERIES, ELIGIBLE_AREAS, SITE, LEGACY_SITE } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { CHECKPOINT_MS, SAVE_KEY, createSaveWriter, loadSave, parseSave } from '../src/persistence/save.ts';
import type { SaveStatus } from '../src/persistence/save.ts';
const findCell = LEGACY_SITE.cells.find(cell => cell.discoveryId === DISCOVERY.id)!;
const exposed = () => Object.fromEntries(SITE.cells.filter(c => c.discoveryId === DISCOVERY.id).map(c => [c.id, 1]));

function fixture() {
  const values = new Map<string, string>();
  let failRead = false, failWrite = false, failRemove = false;
  const storage = {
    getItem(key: string) { if (failRead) throw Error('read'); return values.get(key) ?? null; },
    setItem(key: string, value: string) { if (failWrite) throw Error('write'); values.set(key, value); },
    removeItem(key: string) { if (failRemove) throw Error('remove'); values.delete(key); },
  };
  const jobs: { callback: () => void; ms: number; cancelled: boolean }[] = [];
  const scheduler = {
    set(callback: () => void, ms: number) { const job = { callback, ms, cancelled: false }; jobs.push(job); return job; },
    clear(handle: unknown) { (handle as typeof jobs[number]).cancelled = true; },
  };
  const statuses: SaveStatus[] = [];
  const writer = createSaveWriter(storage, status => statuses.push(status), scheduler);
  return { values, storage, jobs, statuses, writer, fail: (r = false, w = false, d = false) => { failRead = r; failWrite = w; failRemove = d; } };
}
test('valid saves restore exact partial digging and spatial cleaning; missing is fresh', () => {
  const f = fixture();
  assert.deepEqual(loadSave(f.storage), { kind: 'ready', state: freshJourney(), restored: false });
  const state = { ...freshJourney(), room: 'excavation', dig: exposed(), cleaning: { [DISCOVERY.id]: ELIGIBLE_AREAS.slice(0, 8) } };
  f.values.set(SAVE_KEY, JSON.stringify(state));
  assert.deepEqual(loadSave(f.storage), { kind: 'ready', state, restored: true });
});
test('corrupt, unsupported and inconsistent saves are rejected without changing raw storage', () => {
  const base = freshJourney();
  const ready = { ...base, dig: exposed() };
  const cases = ['bad json', 'null', '[]', JSON.stringify({ ...base, version: 99 }),
    ...[
      { ...base, room: 'unknown' }, { ...base, extra: true }, { ...base, dig: { missing: 0.5 } },
      { ...base, dig: { [SITE.cells[0].id]: -1 } }, { ...base, dig: { [SITE.cells[0].id]: 1.1 } },
      { ...base, dig: null }, { ...base, cleaning: [] }, { ...base, collected: ['unknown'] },
      { ...base, collected: [DISCOVERY.id] }, { ...ready, collected: [DISCOVERY.id, DISCOVERY.id] },
      { ...base, cleaning: { [DISCOVERY.id]: [ELIGIBLE_AREAS[0]] } },
      { ...ready, cleaning: { [DISCOVERY.id]: [-1] } },
      { ...ready, cleaning: { [DISCOVERY.id]: [ELIGIBLE_AREAS[0], ELIGIBLE_AREAS[0]] } },
      { ...ready, cleaning: { [DISCOVERY.id]: [336] } },
      { ...ready, collected: [DISCOVERY.id], cleaning: { [DISCOVERY.id]: [] } },
    ].map(value => JSON.stringify(value))];
  for (const raw of cases) {
    const f = fixture(); f.values.set(SAVE_KEY, raw);
    assert.equal(parseSave(raw), null, raw);
    assert.equal(loadSave(f.storage).kind, 'invalid');
    f.writer.schedule(base); f.writer.flush();
    assert.equal(f.values.get(SAVE_KEY), raw);
  }
});
test('failed reads stay blocked; retry can restore storage without reset', () => {
  const f = fixture(); f.values.set(SAVE_KEY, JSON.stringify(freshJourney())); f.fail(true);
  assert.equal(loadSave(f.storage).kind, 'unavailable');
  f.writer.schedule(freshJourney()); assert.equal(f.jobs.length, 0);
  f.fail(); assert.equal(loadSave(f.storage).kind, 'ready');
});

test('schema 4 retains partial cleaning and closure; legacy invalid masks remain protected', () => {
  const { placed: _, activeSiteId: _site, ...old } = freshJourney();
  const previous = { ...old, version: 4, dig: { [findCell.id]: 1 }, cleaning: { [DISCOVERY.id]: ELIGIBLE_AREAS.slice(0, 7) } };
  assert.deepEqual(parseSave(JSON.stringify(previous))!.cleaning[DISCOVERY.id], previous.cleaning[DISCOVERY.id]);
  assert.equal(parseSave(JSON.stringify(previous))!.version, 12);
  assert.equal(parseSave(JSON.stringify({ ...previous, cleaning: { [DISCOVERY.id]: [0] } })), null);
  const closed = { ...previous, dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), cleaning: {}, collected: [DISCOVERY.id], closedSites: [SITE.id] };
  assert.deepEqual(parseSave(JSON.stringify(closed)), { ...closed, closedSites: [], version: 12, activeSiteId: SITE.id, placed: [], collected: DISCOVERIES.map(d => d.id) });
});
test('checkpoint is bounded under continuous changes and writes the latest immutable snapshot', () => {
  const f = fixture(); f.writer.enable();
  const state = freshJourney(); f.writer.schedule(state);
  state.room = 'excavation';
  f.jobs[0].callback();
  assert.equal(JSON.parse(f.values.get(SAVE_KEY)!).room, 'museum');
  for (let i = 0; i < 20; i++) f.writer.schedule({ ...state, dig: { [SITE.cells[0].id]: i / 20 } });
  assert.equal(f.jobs.length, 2); assert.equal(f.jobs[1].ms, CHECKPOINT_MS);
  f.jobs[1].callback();
  assert.equal(JSON.parse(f.values.get(SAVE_KEY)!).dig[SITE.cells[0].id], 0.95);
});
test('failed writes retain the latest live snapshot and never report saved until retry succeeds', () => {
  const f = fixture(); f.writer.enable(); f.fail(false, true);
  f.writer.schedule(freshJourney()); assert.equal(f.writer.flush(), false);
  assert.equal(f.statuses.at(-1), 'failed'); assert.equal(f.values.has(SAVE_KEY), false);
  f.writer.schedule({ ...freshJourney(), room: 'excavation' });
  assert.equal(f.statuses.at(-1), 'failed');
  f.fail(); assert.equal(f.writer.flush(), true);
  assert.equal(f.statuses.at(-1), 'saved'); assert.equal(JSON.parse(f.values.get(SAVE_KEY)!).room, 'excavation');
});
test('confirmed reset clears only V2 and invalidates queued writes, even if cancelled callbacks run', () => {
  const f = fixture(); f.writer.enable(); f.values.set('v1-save', 'keep');
  f.writer.schedule({ ...freshJourney(), dig: { [SITE.cells[0].id]: 0.8 } });
  const oldCallback = f.jobs[0].callback;
  assert.equal(f.writer.reset(), true);
  oldCallback(); f.writer.flush();
  assert.equal(f.values.has(SAVE_KEY), false); assert.equal(f.values.get('v1-save'), 'keep');
  f.writer.schedule(freshJourney()); oldCallback();
  assert.equal(f.values.has(SAVE_KEY), false);
  f.jobs.at(-1)!.callback(); assert.deepEqual(JSON.parse(f.values.get(SAVE_KEY)!), freshJourney());
});
test('failed reset preserves existing storage; disposal prevents stale writes', () => {
  const f = fixture(); const raw = JSON.stringify(freshJourney()); f.values.set(SAVE_KEY, raw);
  f.writer.enable(); f.writer.schedule({ ...freshJourney(), room: 'excavation' });
  f.fail(false, false, true);
  assert.equal(f.writer.reset(), false); assert.equal(f.values.get(SAVE_KEY), raw);
  f.writer.dispose(); f.jobs[0].callback(); f.writer.schedule(freshJourney()); f.writer.flush();
  assert.equal(f.values.get(SAVE_KEY), raw);
});
