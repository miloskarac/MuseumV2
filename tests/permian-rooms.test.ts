import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PERMIAN_EXHIBITS, PERMIAN_ROOMS, permianExhibitDefinition, permianRoomDefinition, permianRoomForExhibit } from '../src/content/permian-museum.ts';
import type { PermianExhibitId, PermianRoomId } from '../src/content/permian-museum.ts';
import { isPermianRoomComplete, permianRoomStatus, validatePermianRoomDependencies,
  isPermianExhibitDisplayed, missingPermianRoomExhibits, isPermianFeaturedExhibitDisplayed } from '../src/game/permian-rooms.ts';
import type { PermianRoomProgress, PermianProgressDefinitions, PermianExhibitProgress } from '../src/game/permian-rooms.ts';
import { EXHIBITS, ALL_PARTS } from '../src/content/exhibit.ts';
import { ALL_DISCOVERIES, SITES } from '../src/content/journey.ts';
import { PURCHASES } from '../src/content/purchases.ts';
import { createLedgerSave } from '../src/game/ticket-ledger.ts';
import { parseLedgerSave } from '../src/persistence/ledger-save.ts';

// Independent approval expectations, not generated from the implementation.
const approved = [
  { id: 'permian-room-1', name: 'Рани перм', large: ['dimetrodon', 'eryops'], small: ['trilobite', 'walchia'], featured: 'eryops', predecessor: null },
  { id: 'permian-room-2', name: 'Пермски дивови', large: ['moschops', 'estemmenosuchus', 'edaphosaurus'], small: ['arthropleura', 'glossopteris', 'captorhinus'], featured: 'moschops', predecessor: 'permian-room-1' },
  { id: 'permian-room-3', name: 'Касни перм', large: ['gorgonops', 'scutosaurus', 'inostrancevia'], small: ['helicoprion', 'gorgonops-tooth', 'dicynodon', 'permian-ammonoid'], featured: 'inostrancevia', predecessor: 'permian-room-2' },
];
const empty: PermianRoomProgress = { unlockedRoomIds: [], ownedStandIds: [], exhibits: [] };
const allIds = PERMIAN_EXHIBITS.map(exhibit => exhibit.id);
const plannedIds = PERMIAN_EXHIBITS.filter(exhibit => exhibit.implementation === 'planned').map(exhibit => exhibit.id);

// Test-only two-part recipes and stand identities. These define no playable
// fossil anatomy, purchases or unlock conditions, including for planned IDs.
const definitions: PermianProgressDefinitions = {
  exhibits: allIds.map(id => ({ id, requiredPartIds: [`test:${id}:a`, `test:${id}:b`] })),
  stands: allIds.map(id => ({ id: `test-stand:${id}`, roomId: permianRoomForExhibit(id)!.id, exhibitId: id })),
};
const displayed = (ids: readonly PermianExhibitId[], unlockedRoomIds: readonly PermianRoomId[] = []): PermianRoomProgress => ({
  unlockedRoomIds, ownedStandIds: ids.map(id => `test-stand:${id}`),
  exhibits: ids.map(id => ({ id, assembledPartIds: [...definitions.exhibits.find(e => e.id === id)!.requiredPartIds],
    displayedOnStandId: `test-stand:${id}` })),
});
const changeExhibit = (progress: PermianRoomProgress, id: PermianExhibitId, patch: Partial<PermianExhibitProgress>): PermianRoomProgress =>
  ({ ...progress, exhibits: progress.exhibits.map(e => e.id === id ? { ...e, ...patch } : e) });

test('Permian plan has exactly three unique rooms and 17 unique, singly assigned exhibits', () => {
  assert.equal(PERMIAN_ROOMS.length, 3);
  assert.equal(new Set(PERMIAN_ROOMS.map(room => room.id)).size, 3);
  assert.equal(allIds.length, 17); assert.equal(new Set(allIds).size, 17);
  const assigned = PERMIAN_ROOMS.flatMap(room => room.exhibitIds);
  assert.equal(assigned.length, 17); assert.equal(new Set(assigned).size, 17);
  assert.deepEqual([...assigned].sort(), [...allIds].sort());
  assert.deepEqual(assigned, approved.flatMap(room => [...room.large, ...room.small]));
});

test('each room has the approved ordered membership, size subsets, required set and Cyrillic name', () => {
  assert.equal(PERMIAN_EXHIBITS.filter(exhibit => exhibit.size === 'large').length, 8);
  assert.equal(PERMIAN_EXHIBITS.filter(exhibit => exhibit.size === 'small').length, 9);
  for (const expected of approved) {
    const room = permianRoomDefinition(expected.id)!;
    assert.equal(room.displayName, expected.name);
    assert.deepEqual(room.exhibitIds, [...expected.large, ...expected.small]);
    assert.deepEqual(room.requiredExhibitIds, room.exhibitIds);
    assert.deepEqual(room.largeExhibitIds, expected.large);
    assert.deepEqual(room.smallExhibitIds, expected.small);
  }
});

test('featured exhibits match the approval and belong to their own room', () => {
  for (const expected of approved) {
    const room = permianRoomDefinition(expected.id)!;
    assert.equal(room.featuredExhibitId, expected.featured);
    assert.ok(room.exhibitIds.includes(room.featuredExhibitId));
  }
});

test('room predecessor chain is valid, acyclic and initially opens only room 1', () => {
  assert.deepEqual(validatePermianRoomDependencies(PERMIAN_ROOMS), []);
  for (const expected of approved) {
    const room = permianRoomDefinition(expected.id)!;
    assert.equal(room.predecessorRoomId, expected.predecessor);
    assert.equal(room.initiallyAvailable, expected.id === 'permian-room-1');
    const seen = new Set<string>();
    let current = room;
    while (current) {
      assert.ok(!seen.has(current.id), 'predecessor cycle'); seen.add(current.id);
      if (current.predecessorRoomId === null) break;
      const predecessor = permianRoomDefinition(current.predecessorRoomId);
      assert.ok(predecessor, 'dangling predecessor'); current = predecessor;
    }
  }
});

test('dependency validator rejects self, two-room, three-room and disconnected predecessor cycles', () => {
  for (const [index, predecessor] of [[0, 'permian-room-1'], [0, 'permian-room-2'],
    [0, 'permian-room-3'], [1, 'permian-room-3']] as const) {
    const rooms = structuredClone(PERMIAN_ROOMS).map((room, i) => i === index ? { ...room, predecessorRoomId: predecessor } : room);
    assert.equal(validatePermianRoomDependencies(rooms).filter(issue => issue.code === 'predecessor-cycle').length, 1);
  }
});

test('dependency validator rejects missing/duplicate identities and contradictory initial roots', () => {
  assert.ok(validatePermianRoomDependencies([...PERMIAN_ROOMS, PERMIAN_ROOMS[0]]).some(issue => issue.code === 'duplicate-room'));
  assert.ok(validatePermianRoomDependencies(PERMIAN_ROOMS.slice(1)).some(issue => issue.code === 'unknown-predecessor'));
  const lockedRoot = PERMIAN_ROOMS.map((room, i) => i === 0 ? { ...room, initiallyAvailable: false } : room);
  assert.ok(validatePermianRoomDependencies(lockedRoot).some(issue => issue.code === 'locked-root'));
  const initialChild = PERMIAN_ROOMS.map((room, i) => i === 1 ? { ...room, initiallyAvailable: true } : room);
  assert.ok(validatePermianRoomDependencies(initialChild).some(issue => issue.code === 'initial-room-has-predecessor'));
});

test('required displays cannot depend on direct or indirect successor room ownership', () => {
  for (const exhibit of ['moschops', 'inostrancevia'] as const) {
    const rooms = PERMIAN_ROOMS.map((room, i) => i === 0 ? { ...room, requiredExhibitIds: [...room.requiredExhibitIds, exhibit] } : room);
    assert.deepEqual(validatePermianRoomDependencies(rooms), [
      { code: 'successor-exhibit', roomId: 'permian-room-1', dependencyId: exhibit },
    ]);
  }
  // Depending on a prior room's display does not create a successor dependency.
  const prior = PERMIAN_ROOMS.map((room, i) => i === 2 ? { ...room, requiredExhibitIds: [...room.requiredExhibitIds, 'dimetrodon' as const] } : room);
  assert.deepEqual(validatePermianRoomDependencies(prior), []);
});

test('required displays need an unambiguous declared room rather than silently ignoring missing membership', () => {
  const missing = PERMIAN_ROOMS.map((room, i) => i === 0 ? { ...room, exhibitIds: room.exhibitIds.filter(id => id !== 'walchia') } : room);
  assert.deepEqual(validatePermianRoomDependencies(missing), [{ code: 'unassigned-exhibit', roomId: 'permian-room-1', dependencyId: 'walchia' }]);
  const duplicate = PERMIAN_ROOMS.map((room, i) => i === 1 ? { ...room, exhibitIds: [...room.exhibitIds, 'walchia' as const] } : room);
  assert.deepEqual(validatePermianRoomDependencies(duplicate), [{ code: 'ambiguous-exhibit', roomId: 'permian-room-1', dependencyId: 'walchia' }]);
});

test('dependency validation is pure and independent of room array order', () => {
  const rooms = PERMIAN_ROOMS.map(room => Object.freeze({ ...room,
    exhibitIds: Object.freeze([...room.exhibitIds]), requiredExhibitIds: Object.freeze([...room.requiredExhibitIds]),
  }));
  const before = JSON.stringify(rooms);
  assert.deepEqual(validatePermianRoomDependencies(Object.freeze(rooms)), []);
  assert.deepEqual(validatePermianRoomDependencies([...rooms].reverse()), []);
  assert.equal(JSON.stringify(rooms), before);
});

test('four Room 1 exhibits are implemented and the remaining thirteen are planned', () => {
  assert.deepEqual(PERMIAN_EXHIBITS.filter(exhibit => exhibit.implementation === 'implemented').map(e => e.id),
    ['dimetrodon', 'eryops', 'trilobite', 'walchia']);
  assert.equal(plannedIds.length, 13);
  assert.ok(plannedIds.every(id => !EXHIBITS.some(active => active.id === id)));
  for (const exhibit of PERMIAN_EXHIBITS) {
    assert.equal(permianExhibitDefinition(exhibit.id), exhibit);
    assert.ok(permianRoomForExhibit(exhibit.id)?.exhibitIds.includes(exhibit.id));
    assert.deepEqual(Object.keys(exhibit).sort(), ['id', 'implementation', 'size']);
  }
});

test('unknown definitions and queries fail safely rather than indicating completion', () => {
  assert.equal(permianRoomDefinition('missing'), undefined);
  assert.equal(permianExhibitDefinition('missing'), undefined);
  assert.equal(permianRoomForExhibit('missing' as PermianExhibitId), undefined);
  assert.equal(permianRoomStatus('missing', empty, definitions), undefined);
  assert.equal(missingPermianRoomExhibits('missing', empty, definitions), undefined);
  assert.equal(isPermianRoomComplete('missing', empty, definitions), false);
  assert.equal(isPermianFeaturedExhibitDisplayed('missing', empty, definitions), false);
  assert.equal(isPermianExhibitDisplayed('missing', displayed(allIds), definitions), false);
});

test('initial availability remains separate from eligibility, stands and complete displays', () => {
  assert.deepEqual(PERMIAN_ROOMS.map(room => permianRoomStatus(room.id, empty, definitions)), ['initially-available', 'locked', 'locked']);
  const existingOnly = displayed(['dimetrodon', 'eryops', 'trilobite']);
  assert.equal(isPermianRoomComplete('permian-room-1', existingOnly, definitions), false);
  assert.deepEqual(missingPermianRoomExhibits('permian-room-1', existingOnly, definitions), ['walchia']);
  assert.equal(permianRoomStatus('permian-room-2', existingOnly, definitions), 'locked');
});

test('every required exhibit must be validly displayed; omitting any one blocks room completion and successor eligibility', () => {
  for (const room of PERMIAN_ROOMS) {
    for (const omitted of room.requiredExhibitIds) {
      const progress = displayed(room.requiredExhibitIds.filter(id => id !== omitted), [room.id]);
      assert.equal(isPermianRoomComplete(room.id, progress, definitions), false);
      assert.deepEqual(missingPermianRoomExhibits(room.id, progress, definitions), [omitted]);
      const next = PERMIAN_ROOMS.find(next => next.predecessorRoomId === room.id);
      if (next) assert.equal(permianRoomStatus(next.id, progress, definitions), 'locked');
    }
    const progress = displayed(room.requiredExhibitIds, [room.id]);
    assert.ok(room.requiredExhibitIds.every(id => isPermianExhibitDisplayed(id, progress, definitions)));
    assert.deepEqual(missingPermianRoomExhibits(room.id, progress, definitions), []);
    assert.equal(isPermianRoomComplete(room.id, progress, definitions), true);
    assert.equal(permianRoomStatus(room.id, progress, definitions), 'completed');
  }
});

test('Room 2 and Room 3 eligibility require all four and six valid predecessor displays, without automatic ownership', () => {
  let progress = displayed(PERMIAN_ROOMS[0].requiredExhibitIds);
  assert.deepEqual(PERMIAN_ROOMS.map(r => permianRoomStatus(r.id, progress, definitions)), ['completed', 'eligible-for-purchase', 'locked']);
  assert.deepEqual(progress.unlockedRoomIds, []);
  progress = { ...progress, unlockedRoomIds: ['permian-room-2'] };
  assert.equal(permianRoomStatus('permian-room-2', progress, definitions), 'unlocked');
  progress = displayed([...PERMIAN_ROOMS[0].requiredExhibitIds, ...PERMIAN_ROOMS[1].requiredExhibitIds], ['permian-room-2']);
  assert.deepEqual(PERMIAN_ROOMS.map(r => permianRoomStatus(r.id, progress, definitions)), ['completed', 'completed', 'eligible-for-purchase']);
  progress = { ...progress, unlockedRoomIds: ['permian-room-2', 'permian-room-3'] };
  assert.equal(permianRoomStatus('permian-room-3', progress, definitions), 'unlocked');
  assert.equal(permianRoomStatus('permian-room-3', displayed(allIds, progress.unlockedRoomIds), definitions), 'completed');
});

test('fully assembled displays and owned stands in locked rooms cannot substitute for room ownership', () => {
  const progress = displayed(allIds);
  for (const room of PERMIAN_ROOMS.slice(1)) {
    assert.equal(isPermianRoomComplete(room.id, progress, definitions), false);
    assert.equal(isPermianFeaturedExhibitDisplayed(room.id, progress, definitions), false);
    assert.deepEqual(missingPermianRoomExhibits(room.id, progress, definitions), room.requiredExhibitIds);
  }
  assert.equal(permianRoomStatus('permian-room-2', progress, definitions), 'eligible-for-purchase');
  assert.equal(permianRoomStatus('permian-room-3', progress, definitions), 'locked');
  // Supplied ownership is still a fact, not retroactively revoked by this query.
  assert.equal(permianRoomStatus('permian-room-3', { ...empty, unlockedRoomIds: ['permian-room-3'] }, definitions), 'unlocked');
});

test('each predecessor stand is required for eligibility, without revoking an already owned successor', () => {
  for (const room of PERMIAN_ROOMS.slice(0, 2)) {
    const successor = PERMIAN_ROOMS.find(next => next.predecessorRoomId === room.id)!;
    const full = displayed(room.requiredExhibitIds, [room.id]);
    assert.equal(permianRoomStatus(successor.id, full, definitions), 'eligible-for-purchase');
    for (const exhibit of room.requiredExhibitIds) {
      const missingStand = { ...full, ownedStandIds: full.ownedStandIds.filter(id => id !== `test-stand:${exhibit}`) };
      assert.equal(isPermianRoomComplete(room.id, missingStand, definitions), false);
      assert.deepEqual(missingPermianRoomExhibits(room.id, missingStand, definitions), [exhibit]);
      assert.equal(permianRoomStatus(successor.id, missingStand, definitions), 'locked');
      assert.equal(permianRoomStatus(successor.id, { ...missingStand, unlockedRoomIds: [room.id, successor.id] }, definitions), 'unlocked');
    }
  }
});

type DisplayCase = { progress: PermianRoomProgress; definitions: PermianProgressDefinitions };
const invalidDisplayCases: Record<string, (input: DisplayCase) => DisplayCase> = {
  'missing exhibit state': input => ({ ...input, progress: { ...input.progress, exhibits: input.progress.exhibits.filter(e => e.id !== 'eryops') } }),
  'no assembled parts': input => ({ ...input, progress: changeExhibit(input.progress, 'eryops', { assembledPartIds: [] }) }),
  'partially assembled fossil': input => ({ ...input, progress: changeExhibit(input.progress, 'eryops', { assembledPartIds: ['test:eryops:a'] }) }),
  'duplicate parts cannot replace a missing part': input => ({ ...input, progress: changeExhibit(input.progress, 'eryops', { assembledPartIds: ['test:eryops:a', 'test:eryops:a'] }) }),
  'restored but not displayed fossil': input => ({ ...input, progress: changeExhibit(input.progress, 'eryops', { displayedOnStandId: null }) }),
  'unowned stand': input => ({ ...input, progress: { ...input.progress, ownedStandIds: input.progress.ownedStandIds.filter(id => id !== 'test-stand:eryops') } }),
  'missing all stand ownership': input => ({ ...input, progress: { ...input.progress, ownedStandIds: [] } }),
  'wrong owned stand': input => ({ ...input, progress: changeExhibit(input.progress, 'eryops', { displayedOnStandId: 'test-stand:dimetrodon' }) }),
  'stand assigned to another exhibit': input => ({ ...input, definitions: { ...input.definitions,
    stands: input.definitions.stands.map(s => s.exhibitId === 'eryops' ? { ...s, exhibitId: 'walchia' } : s) } }),
  'stand assigned to another available room': input => ({
    progress: { ...input.progress, unlockedRoomIds: ['permian-room-2'] },
    definitions: { ...input.definitions, stands: input.definitions.stands.map(s => s.exhibitId === 'eryops' ? { ...s, roomId: 'permian-room-2' } : s) },
  }),
  'missing stand definition': input => ({ ...input, definitions: { ...input.definitions, stands: input.definitions.stands.filter(s => s.exhibitId !== 'eryops') } }),
  'unknown stand even if marked owned': input => ({ ...input, progress: {
    ...changeExhibit(input.progress, 'eryops', { displayedOnStandId: 'unknown-stand' }), ownedStandIds: [...input.progress.ownedStandIds, 'unknown-stand'],
  } }),
  'missing recipe': input => ({ ...input, definitions: { ...input.definitions, exhibits: input.definitions.exhibits.filter(e => e.id !== 'eryops') } }),
  'empty recipe': input => ({ ...input, definitions: { ...input.definitions, exhibits: input.definitions.exhibits.map(e => e.id === 'eryops' ? { ...e, requiredPartIds: [] } : e) } }),
  'duplicate required parts': input => ({ ...input, definitions: { ...input.definitions, exhibits: input.definitions.exhibits.map(e => e.id === 'eryops' ? { ...e, requiredPartIds: ['test:eryops:a', 'test:eryops:a'] } : e) } }),
  'duplicate exhibit states': input => ({ ...input, progress: { ...input.progress, exhibits: [...input.progress.exhibits, input.progress.exhibits.find(e => e.id === 'eryops')!] } }),
  'duplicate recipe identity': input => ({ ...input, definitions: { ...input.definitions, exhibits: [...input.definitions.exhibits, input.definitions.exhibits.find(e => e.id === 'eryops')!] } }),
  'duplicate stand identity': input => ({ ...input, definitions: { ...input.definitions, stands: [...input.definitions.stands, input.definitions.stands.find(s => s.exhibitId === 'eryops')!] } }),
};
for (const [name, invalidate] of Object.entries(invalidDisplayCases)) test(`display validation rejects ${name}`, () => {
  const { progress, definitions: content } = invalidate({ progress: displayed(PERMIAN_ROOMS[0].requiredExhibitIds), definitions });
  assert.equal(isPermianExhibitDisplayed('eryops', progress, content), false);
  assert.equal(isPermianFeaturedExhibitDisplayed('permian-room-1', progress, content), false);
  assert.equal(isPermianRoomComplete('permian-room-1', progress, content), false);
  const expectedMissing = name === 'missing all stand ownership' ? PERMIAN_ROOMS[0].requiredExhibitIds : ['eryops'];
  assert.deepEqual(missingPermianRoomExhibits('permian-room-1', progress, content), expectedMissing);
  // One case deliberately supplies room 2 ownership to isolate room assignment.
  assert.equal(permianRoomStatus('permian-room-2', { ...progress, unlockedRoomIds: [] }, content), 'locked');
});

test('collected but unplaced fossils and obsolete completed-ID hints cannot establish progress', () => {
  const progress = { ...changeExhibit(displayed(PERMIAN_ROOMS[0].requiredExhibitIds), 'eryops', { assembledPartIds: [], displayedOnStandId: null }),
    collectedPartIds: ['test:eryops:a', 'test:eryops:b'], completedExhibitIds: allIds,
  };
  assert.equal(isPermianExhibitDisplayed('eryops', progress, definitions), false);
  assert.deepEqual(missingPermianRoomExhibits('permian-room-1', progress, definitions), ['eryops']);
  assert.equal(permianRoomStatus('permian-room-2', progress, definitions), 'locked');
});

test('duplicate partial records cannot be merged into a complete fossil', () => {
  const progress = displayed(PERMIAN_ROOMS[0].requiredExhibitIds);
  const first = { ...progress.exhibits.find(e => e.id === 'eryops')!, assembledPartIds: ['test:eryops:a'] };
  const second = { ...first, assembledPartIds: ['test:eryops:b'] };
  assert.equal(isPermianExhibitDisplayed('eryops', { ...progress, exhibits: [...progress.exhibits.filter(e => e.id !== 'eryops'), first, second] }, definitions), false);
});

test('missing exhibit query follows room order, ignores unrelated inputs and returns a fresh result', () => {
  const progress = displayed(['walchia', 'eryops', 'moschops', 'inostrancevia'], ['permian-room-2', 'permian-room-3']);
  const shuffledDefinitions = { exhibits: [...definitions.exhibits].reverse(), stands: [...definitions.stands].reverse() };
  const missing = missingPermianRoomExhibits('permian-room-1', progress, shuffledDefinitions)!;
  assert.deepEqual(missing, ['dimetrodon', 'trilobite']);
  missing.reverse();
  assert.deepEqual(missingPermianRoomExhibits('permian-room-1', progress, definitions), ['dimetrodon', 'trilobite']);
  const complete = displayed(allIds, ['permian-room-2', 'permian-room-3']);
  // Unrelated duplicate records do not affect this room's required exhibits.
  const extra = complete.exhibits.find(e => e.id === 'moschops')!;
  assert.deepEqual(missingPermianRoomExhibits('permian-room-1', { ...complete, exhibits: [...complete.exhibits, extra] }, definitions), []);
});

test('featured display completion is independent and never completes its room, unlocks a successor or grants anything', () => {
  for (const room of PERMIAN_ROOMS) {
    const progress = { ...displayed([room.featuredExhibitId], [room.id]), coins: 23, pendingTicketRevenue: 7 };
    const before = JSON.stringify(progress);
    assert.equal(isPermianFeaturedExhibitDisplayed(room.id, progress, definitions), true);
    assert.equal(isPermianRoomComplete(room.id, progress, definitions), false);
    assert.deepEqual(missingPermianRoomExhibits(room.id, progress, definitions), room.requiredExhibitIds.filter(id => id !== room.featuredExhibitId));
    const next = PERMIAN_ROOMS.find(next => next.predecessorRoomId === room.id);
    if (next) assert.equal(permianRoomStatus(next.id, progress, definitions), 'locked');
    assert.equal(JSON.stringify(progress), before);
  }
});

test('a one-part restored exhibit and duplicate ownership IDs can validly display without extra progress', () => {
  const content = { ...definitions, exhibits: definitions.exhibits.map(e => e.id === 'trilobite' ? { ...e, requiredPartIds: ['test:trilobite:a'] } : e) };
  const progress = { ...changeExhibit(displayed(['trilobite']), 'trilobite', { assembledPartIds: ['test:trilobite:a', 'test:trilobite:a'] }),
    ownedStandIds: ['test-stand:trilobite', 'test-stand:trilobite'] };
  assert.equal(isPermianExhibitDisplayed('trilobite', progress, content), true);
  assert.equal(isPermianRoomComplete('permian-room-1', progress, content), false);
});

test('all new queries are pure with deeply frozen caller state and definitions', () => {
  function freeze<T>(value: T): T {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  const progress = freeze(displayed(allIds, ['permian-room-2', 'permian-room-3']));
  const content = freeze(structuredClone(definitions));
  const before = JSON.stringify([progress, content, PERMIAN_ROOMS, PERMIAN_EXHIBITS]);
  for (const room of PERMIAN_ROOMS) {
    isPermianRoomComplete(room.id, progress, content); permianRoomStatus(room.id, progress, content);
    missingPermianRoomExhibits(room.id, progress, content); isPermianFeaturedExhibitDisplayed(room.id, progress, content);
  }
  assert.equal(JSON.stringify([progress, content, PERMIAN_ROOMS, PERMIAN_EXHIBITS]), before);
});

test('historical catalogs retain three exhibits and current offers add Walchia only', () => {
  assert.deepEqual(EXHIBITS.map(({ id, mode, parts }) => ({ id, mode, parts })), [
    { id: 'dimetrodon', mode: 'assembled', parts: ['skull', 'spine-sail', 'ribs', 'front-legs', 'hind-legs', 'tail'] },
    { id: 'trilobite', mode: 'whole', parts: ['trilobite-whole'] },
    { id: 'eryops', mode: 'assembled', parts: ['eryops-skull', 'eryops-spine', 'eryops-ribs', 'eryops-front-legs', 'eryops-hind-legs', 'eryops-tail'] },
  ]);
  assert.equal(ALL_PARTS.length, 13); assert.equal(ALL_DISCOVERIES.length, 13);
  assert.deepEqual(SITES.map(site => site.id), ['courtyard-dig', 'eryops-dig']);
  assert.deepEqual(PURCHASES.map(({ id, cost }) => ({ id, cost })), [
    { id: 'stand-dimetrodon', cost: 12 }, { id: 'stand-trilobite', cost: 8 },
    { id: 'west-wing', cost: 18 }, { id: 'stand-eryops', cost: 16 }, { id: 'stand-walchia', cost: 10 },
  ]);
  assert.ok(PURCHASES.every(offer => offer.exhibit === null || !plannedIds.some(id => id === offer.exhibit)));
  const playableIds = [...ALL_PARTS.map(part => part.id), ...ALL_DISCOVERIES.map(find => find.id),
    ...SITES.flatMap(site => site.requiredDiscoveryIds), ...PURCHASES.map(offer => offer.id)];
  assert.ok(plannedIds.every(id => !playableIds.includes(id)));
});

test('room planning modules integrate only through the bounded MVP adapter', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const consumers = readdirSync(root, { recursive: true }).filter((name): name is string => typeof name === 'string' && name.endsWith('.ts'))
    .filter(name => /(?:from\s+|import\s*\(\s*)['"][^'"]*\/(?:permian-museum|permian-rooms)\.ts['"]/.test(readFileSync(join(root, name), 'utf8')))
    .map(name => name.replaceAll('\\', '/')).sort();
  assert.deepEqual(consumers, ['content/permian-progression.ts', 'game/mvp-progression.ts', 'game/permian-progression-validation.ts', 'game/permian-progression.ts', 'game/permian-rooms.ts']);
});

test('schema 22 fresh save stays identical to the baseline and rejects planned content/room fields', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/save-compatibility.json', import.meta.url), 'utf8'));
  const fresh = createLedgerSave(42), expected = { ...fixtures.fresh21, version: 22,
    visitors: { ...fixtures.fresh21.visitors, sales: { version: 1, counts: {} } } };
  assert.deepEqual(fresh, expected);
  assert.deepEqual(parseLedgerSave(JSON.stringify(fresh), 42), fresh);
  assert.equal(parseLedgerSave(JSON.stringify({ ...fresh, rooms: { owned: ['permian-room-2'] } }), 42), null);
  for (const id of plannedIds) {
    assert.equal(parseLedgerSave(JSON.stringify({ ...fresh, placed: [id] }), 42), null);
    assert.equal(parseLedgerSave(JSON.stringify({ ...fresh, collected: [id] }), 42), null);
    assert.equal(parseLedgerSave(JSON.stringify({ ...fresh, museum: { version: 1, owned: [{ id: `stand-${id}`, source: 'legacy', paid: 0 }] } }), 42), null);
  }
});
