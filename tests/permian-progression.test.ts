import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMIAN_EXHIBIT_ORDER, PERMIAN_PROGRESSION, PERMIAN_STAND_PLANS, PERMIAN_SITE_PLANS,
  PERMIAN_PROGRESSION_GRAPH, siteForPermianExhibit } from '../src/content/permian-progression.ts';
import type { PermianProgressionGraph, PermianSiteId } from '../src/content/permian-progression.ts';
import { PERMIAN_ROOMS } from '../src/content/permian-museum.ts';
import type { PermianExhibitId, PermianRoomId } from '../src/content/permian-museum.ts';
import { PERMIAN_DIFFICULTY_PLANS, permianLayerCandidate, validPermianDifficulty } from '../src/content/permian-difficulty.ts';
import { nextPermianExhibit, eligiblePermianStand, permianSiteStatus, permianStandStatus, permianProgressionRoomStatus } from '../src/game/permian-progression.ts';
import type { PermianProgressionState } from '../src/game/permian-progression.ts';
import { validatePermianProgressionGraph } from '../src/game/permian-progression-validation.ts';
import { isPermianExhibitDisplayed, permianRoomStatus } from '../src/game/permian-rooms.ts';
import type { PermianProgressDefinitions } from '../src/game/permian-rooms.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { SITES, SITE_PLOTS } from '../src/content/journey.ts';
import { MAP_SITES } from '../src/content/world-map.ts';
import { PURCHASES } from '../src/content/purchases.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { ownedPermianRoomIds } from '../src/game/room-ownership.ts';

type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
// Independent approval fixture. Site 7/8 deliberately differ from the old simulation.
const approved = [
  ['dimetrodon', 'large', 1, 'courtyard-dig'], ['trilobite', 'small', 1, 'courtyard-dig'],
  ['eryops', 'large', 1, 'eryops-dig'], ['walchia', 'small', 1, 'eryops-dig'],
  ['moschops', 'large', 2, 'moschops-dig'], ['arthropleura', 'small', 2, 'moschops-dig'],
  ['estemmenosuchus', 'large', 2, 'estemmenosuchus-dig'], ['glossopteris', 'small', 2, 'estemmenosuchus-dig'],
  ['edaphosaurus', 'large', 2, 'edaphosaurus-dig'], ['captorhinus', 'small', 2, 'edaphosaurus-dig'],
  ['gorgonops', 'large', 3, 'gorgonops-dig'], ['helicoprion', 'small', 3, 'gorgonops-dig'],
  ['scutosaurus', 'large', 3, 'scutosaurus-dig'], ['gorgonops-tooth', 'small', 3, 'scutosaurus-dig'],
  ['inostrancevia', 'large', 3, 'inostrancevia-dig'], ['dicynodon', 'small', 3, 'inostrancevia-dig'],
  ['permian-ammonoid', 'small', 3, 'inostrancevia-dig'],
] as const;
// Actual recipes for the three live exhibits; explicitly synthetic tokens for the other 14.
const definitions: PermianProgressDefinitions = {
  exhibits: approved.map(([id]) => ({ id, requiredPartIds: EXHIBITS.find(e => e.id === id)?.parts ?? [`synthetic:${id}:restored`] })),
  stands: PERMIAN_STAND_PLANS.map(({ id, exhibitId, roomId }) => ({ id, exhibitId, roomId })),
};
const fresh = (): Mutable<PermianProgressionState> => ({ ownedRoomIds: ['permian-room-1'], ownedStandIds: [], purchasedSiteIds: [], exhibits: [] });
const record = (id: PermianExhibitId) => ({ id, assembledPartIds: [...definitions.exhibits.find(e => e.id === id)!.requiredPartIds], displayedOnStandId: `stand-${id}` });
function prefix(count: number): Mutable<PermianProgressionState> {
  const state = fresh();
  for (const [id, , room, site] of approved.slice(0, count)) {
    const roomId = `permian-room-${room}` as PermianRoomId;
    if (!state.ownedRoomIds.includes(roomId)) state.ownedRoomIds.push(roomId);
    state.ownedStandIds.push(`stand-${id}`); state.exhibits.push(record(id));
    if (site !== 'courtyard-dig' && !state.purchasedSiteIds.includes(site)) state.purchasedSiteIds.push(site);
  }
  return state;
}
const cloneGraph = (): Mutable<PermianProgressionGraph> => structuredClone(PERMIAN_PROGRESSION_GRAPH) as Mutable<PermianProgressionGraph>;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}

for (const [i, [id, size, room, site]] of approved.entries()) test(`approved position ${i + 1}: ${id}, room ${room}, ${site}`, () => {
  assert.equal(PERMIAN_EXHIBIT_ORDER[i], id);
  assert.deepEqual(PERMIAN_PROGRESSION[i], { position: i + 1, exhibitId: id, standId: `stand-${id}` });
  const stand = PERMIAN_STAND_PLANS[i];
  assert.equal(stand.roomId, `permian-room-${room}`);
  assert.deepEqual(stand.requiredDisplayIds, i ? [approved[i - 1][0]] : []);
  assert.equal(PERMIAN_PROGRESSION_GRAPH.exhibits.find(e => e.id === id)!.size, size);
  assert.equal(siteForPermianExhibit(id)?.id, site);
  const state = prefix(i);
  assert.equal(nextPermianExhibit(state, definitions), id);
  if (!state.ownedRoomIds.includes(stand.roomId)) {
    assert.equal(eligiblePermianStand(state, definitions), undefined);
    assert.equal(permianProgressionRoomStatus(stand.roomId, state, definitions), 'eligible-for-purchase');
    state.ownedRoomIds.push(stand.roomId); // Synthetic purchase, not a production command.
  }
  assert.equal(eligiblePermianStand(state, definitions)?.id, stand.id);
  assert.equal(PERMIAN_STAND_PLANS.filter(s => permianStandStatus(s.id, state, definitions) === 'eligible-for-purchase').length, 1);
  state.ownedStandIds.push(stand.id);
  assert.equal(eligiblePermianStand(state, definitions), undefined, 'an owned empty stand cannot expose its successor');
});

test('exact eight sites, correct triggers and provisional prices preserve both existing site IDs', () => {
  assert.deepEqual(PERMIAN_SITE_PLANS.map(s => [s.id, s.triggerStandId, s.candidatePrice]), [
    ['courtyard-dig', 'stand-dimetrodon', 0], ['eryops-dig', 'stand-eryops', 20],
    ['moschops-dig', 'stand-moschops', 30], ['estemmenosuchus-dig', 'stand-estemmenosuchus', 40],
    ['edaphosaurus-dig', 'stand-edaphosaurus', 50], ['gorgonops-dig', 'stand-gorgonops', 60],
    ['scutosaurus-dig', 'stand-scutosaurus', 75], ['inostrancevia-dig', 'stand-inostrancevia', 90],
  ]);
  assert.deepEqual(PERMIAN_SITE_PLANS.slice(0, 2).map(s => s.id), SITES.map(s => s.id));
  assert.equal(PERMIAN_SITE_PLANS.flatMap(s => s.exhibitIds).length, 17);
  assert.equal(new Set(PERMIAN_SITE_PLANS.flatMap(s => s.exhibitIds)).size, 17);
  assert.deepEqual(PERMIAN_ROOMS.map(r => r.featuredExhibitId), ['eryops', 'moschops', 'inostrancevia']);
});

test('initial state has exactly one stand offer and free initial site without stand ownership', () => {
  const state = fresh(), before = structuredClone(state);
  assert.equal(eligiblePermianStand(state, definitions)?.id, 'stand-dimetrodon');
  assert.equal(permianSiteStatus('courtyard-dig', state, definitions), 'available');
  assert.ok(PERMIAN_SITE_PLANS.slice(1).every(s => permianSiteStatus(s.id, state, definitions) === 'locked'));
  assert.equal(permianStandStatus('stand-dimetrodon', state, definitions), 'eligible-for-purchase');
  assert.deepEqual(state, before, 'an offer/rejection cannot grant ownership or make partial mutations');
});

for (const site of PERMIAN_SITE_PLANS.slice(1)) test(`${site.id}: purchased trigger, owned room and explicit site purchase are distinct`, () => {
  const index = approved.findIndex(([id]) => `stand-${id}` === site.triggerStandId), state = prefix(index);
  if (!state.ownedRoomIds.includes(site.roomId)) state.ownedRoomIds.push(site.roomId);
  assert.equal(permianSiteStatus(site.id, state, definitions), 'locked');
  assert.equal(eligiblePermianStand(state, definitions)?.id, site.triggerStandId);
  state.ownedStandIds.push(site.triggerStandId);
  assert.equal(permianSiteStatus(site.id, state, definitions), 'eligible-for-purchase');
  assert.ok(!state.purchasedSiteIds.includes(site.id));
  state.purchasedSiteIds.push(site.id, site.id); // Duplicate receipt projection cannot require a second purchase.
  assert.equal(permianSiteStatus(site.id, state, definitions), 'available');
  state.exhibits = [];
  assert.equal(permianSiteStatus(site.id, state, definitions), 'available', 'purchased site is retained when displays disappear');
  state.ownedRoomIds = state.ownedRoomIds.filter(id => id !== site.roomId);
  assert.equal(permianSiteStatus(site.id, state, definitions), 'locked', 'contradictory room ownership fails closed');
});

test('full synthetic query walkthrough restores/displays 17 exhibits, purchases two rooms and seven sites once', () => {
  const state = fresh(), sitePurchases: string[] = [], roomPurchases: string[] = [];
  for (const [id, , room, site] of approved) {
    const roomId = `permian-room-${room}` as PermianRoomId;
    if (!state.ownedRoomIds.includes(roomId)) {
      assert.equal(permianProgressionRoomStatus(roomId, state, definitions), 'eligible-for-purchase');
      assert.equal(eligiblePermianStand(state, definitions), undefined);
      state.ownedRoomIds.push(roomId); roomPurchases.push(roomId);
    }
    assert.equal(eligiblePermianStand(state, definitions)?.exhibitId, id);
    state.ownedStandIds.push(`stand-${id}`);
    const status = permianSiteStatus(site, state, definitions);
    if (status === 'eligible-for-purchase') { state.purchasedSiteIds.push(site); sitePurchases.push(site); }
    assert.equal(permianSiteStatus(site, state, definitions), 'available');
    state.exhibits.push({ ...record(id), displayedOnStandId: null });
    assert.equal(nextPermianExhibit(state, definitions), id, 'restoration without display is insufficient');
    state.exhibits.at(-1)!.displayedOnStandId = `stand-${id}`;
    assert.equal(permianStandStatus(`stand-${id}`, state, definitions), 'completed');
  }
  assert.equal(nextPermianExhibit(state, definitions), undefined); assert.equal(eligiblePermianStand(state, definitions), undefined);
  assert.equal(sitePurchases.length, 7); assert.equal(new Set(sitePurchases).size, 7); assert.equal(roomPurchases.length, 2);
  assert.ok(PERMIAN_ROOMS.every(r => permianProgressionRoomStatus(r.id, state, definitions) === 'completed'));
  assert.ok(PERMIAN_SITE_PLANS.every(s => permianSiteStatus(s.id, state, definitions) === 'available'));
});

test('early findings, forged later stand ownership and arbitrary completed-ID hints cannot skip the next display', () => {
  const state = { ...fresh(), completedExhibitIds: [...PERMIAN_EXHIBIT_ORDER] };
  state.exhibits.push(record('trilobite'), record('eryops'));
  state.ownedStandIds.push('stand-trilobite', 'stand-eryops');
  assert.equal(nextPermianExhibit(state, definitions), 'dimetrodon');
  assert.equal(eligiblePermianStand(state, definitions)?.id, 'stand-dimetrodon');
  assert.equal(permianSiteStatus('eryops-dig', state, definitions), 'locked');
  state.ownedStandIds.push('stand-gorgonops');
  assert.equal(permianStandStatus('stand-gorgonops', state, definitions), 'locked');
  assert.equal(permianSiteStatus('gorgonops-dig', state, definitions), 'locked');
});

const invalidDisplayCases: Record<string, (state: Mutable<PermianProgressionState>, content: Mutable<PermianProgressDefinitions>) => void> = {
  'missing assembled part': state => { state.exhibits[0].assembledPartIds.pop(); },
  'restored but unplaced': state => { state.exhibits[0].displayedOnStandId = null; },
  'unknown displayed stand': state => { state.exhibits[0].displayedOnStandId = 'unknown'; state.ownedStandIds.push('unknown'); },
  'wrong owned stand': state => { state.exhibits[0].displayedOnStandId = 'stand-trilobite'; state.ownedStandIds.push('stand-trilobite'); },
  'unowned stand': state => { state.ownedStandIds = []; },
  'duplicate progress': state => { state.exhibits.push(structuredClone(state.exhibits[0])); },
  'duplicate recipe': (_state, content) => { content.exhibits.push(structuredClone(content.exhibits[0])); },
  'empty recipe': (_state, content) => { content.exhibits[0].requiredPartIds = []; },
  'duplicate stand definition': (_state, content) => { content.stands.push(structuredClone(content.stands[0])); },
  'mismatched stand exhibit': (_state, content) => { content.stands[0].exhibitId = 'eryops'; },
  'mismatched stand room': (_state, content) => { content.stands[0].roomId = 'permian-room-2'; },
  'missing initial room ownership': state => { state.ownedRoomIds = []; },
};
for (const [name, invalidate] of Object.entries(invalidDisplayCases)) test(`progression rejects ${name}`, () => {
  const state = prefix(1), content = structuredClone(definitions) as Mutable<PermianProgressDefinitions>;
  invalidate(state, content);
  const before = structuredClone([state, content]);
  assert.equal(nextPermianExhibit(state, content), 'dimetrodon');
  assert.notEqual(eligiblePermianStand(state, content)?.id, 'stand-trilobite');
  assert.equal(permianSiteStatus('eryops-dig', state, content), 'locked');
  assert.deepEqual([state, content], before);
});

test('matching restored/displayed parts without purchased acquisition site do not complete a room', () => {
  const state = prefix(4); state.purchasedSiteIds = [];
  assert.equal(nextPermianExhibit(state, definitions), 'eryops');
  assert.equal(permianProgressionRoomStatus('permian-room-2', state, definitions), 'locked');
});

test('missing ancestor room ownership fails closed without revoking valid ownership for removed displays', () => {
  const state = prefix(17);
  state.ownedRoomIds = ['permian-room-1', 'permian-room-3'];
  assert.equal(permianProgressionRoomStatus('permian-room-3', state, definitions), 'locked');
  assert.equal(permianSiteStatus('gorgonops-dig', state, definitions), 'locked');
  assert.equal(permianStandStatus('stand-gorgonops', state, definitions), 'locked');
  state.ownedRoomIds = ['permian-room-2'];
  assert.equal(permianProgressionRoomStatus('permian-room-3', state, definitions), 'locked');
  assert.equal(permianSiteStatus('moschops-dig', state, definitions), 'locked');
  state.ownedRoomIds = ['permian-room-1', 'permian-room-2', 'permian-room-3']; state.exhibits = [];
  assert.equal(permianProgressionRoomStatus('permian-room-3', state, definitions), 'available');
  assert.equal(permianSiteStatus('gorgonops-dig', state, definitions), 'available');
});

for (const [previousCount, boundary, room] of [[3, 4, 'permian-room-2'], [9, 10, 'permian-room-3']] as const)
  test(`${room} needs every predecessor display, then ownership before its stand`, () => {
    assert.equal(permianProgressionRoomStatus(room, prefix(previousCount), definitions), 'locked');
    const state = prefix(boundary);
    assert.equal(permianProgressionRoomStatus(room, state, definitions), 'eligible-for-purchase');
    assert.equal(eligiblePermianStand(state, definitions), undefined);
    state.ownedRoomIds.push(room);
    assert.equal(eligiblePermianStand(state, definitions)?.exhibitId, approved[boundary][0]);
  });

test('unknown IDs, missing target recipes and bad target stand definitions fail safely', () => {
  assert.equal(siteForPermianExhibit('unknown'), undefined);
  const state = fresh();
  assert.equal(permianSiteStatus('unknown', state, definitions), undefined);
  assert.equal(permianStandStatus('unknown', state, definitions), undefined);
  assert.equal(permianProgressionRoomStatus('unknown', state, definitions), undefined);
  assert.equal(eligiblePermianStand(state, { ...definitions, exhibits: [] }), undefined);
  assert.equal(eligiblePermianStand(state, { ...definitions, stands: [] }), undefined);
});

test('symbolic graph has an acyclic deterministic witness for all acquisition/restoration/display stages', () => {
  const result = validatePermianProgressionGraph();
  assert.deepEqual(result.issues, []); assert.equal(result.valid, true); assert.equal(result.nodes.length, 80);
  assert.equal(result.witness.length, 80);
  assert.deepEqual(result.reachable.display, approved.map(([id]) => id));
  for (const stage of ['stand', 'acquire', 'restore', 'display'] as const) assert.equal(result.reachable[stage].length, 17);
  assert.equal(result.reachable.site.length, 8); assert.equal(result.reachable.room.length, 3);
  const reached = new Set<string>();
  for (const step of result.witness) { assert.ok(step.requires.every(id => reached.has(id)), step.id); reached.add(step.id); }
  assert.deepEqual(result.financial, { bootstrapCost: 12, remainingAfterFirstStand: 8, firstPayingDisplayReachable: true, laterPurchases: 'conditional' });
  assert.deepEqual(validatePermianProgressionGraph(), result);
});

const invalidGraphs: Record<string, { edit: (graph: Mutable<PermianProgressionGraph>) => void; code: string }> = {
  'duplicate exhibit ID': { edit: g => { g.exhibits.push(g.exhibits[0]); }, code: 'duplicate-exhibit' },
  'unknown exhibit': { edit: g => { g.exhibits[0].id = 'unknown' as PermianExhibitId; }, code: 'exhibit-catalog' },
  'wrong exhibit size': { edit: g => { g.exhibits[0].size = 'small'; }, code: 'exhibit-definition' },
  'missing room assignment': { edit: g => { g.rooms[0].exhibitIds.shift(); }, code: 'room-assignment' },
  'multiple room assignments': { edit: g => { g.rooms[1].exhibitIds.push('dimetrodon'); }, code: 'room-assignment' },
  'missing site assignment': { edit: g => { g.sites[0].exhibitIds.shift(); }, code: 'site-assignment' },
  'multiple site assignments': { edit: g => { g.sites[1].exhibitIds.push('dimetrodon'); }, code: 'site-assignment' },
  'wrong approved site 7/8 mapping': { edit: g => { g.sites[6].exhibitIds.push('inostrancevia'); g.sites[7].exhibitIds.shift(); }, code: 'site-assignment-contract' },
  'missing stand': { edit: g => { g.stands.shift(); }, code: 'stand-assignment' },
  'duplicate stand ID': { edit: g => { g.stands.push(g.stands[0]); }, code: 'duplicate-stand' },
  'unknown stand exhibit': { edit: g => { g.stands[0].exhibitId = 'unknown' as PermianExhibitId; }, code: 'stand-definition' },
  'unknown sequence stand': { edit: g => { g.sequence[0].standId = 'unknown' as typeof g.sequence[0]['standId']; }, code: 'unknown-stand-reference' },
  'unknown site trigger': { edit: g => { g.sites[1].triggerStandId = 'unknown' as typeof g.sites[1]['triggerStandId']; }, code: 'unknown-stand-reference' },
  'duplicate site ID': { edit: g => { g.sites[1].id = g.sites[0].id; }, code: 'duplicate-site' },
  'unknown stable site ID': { edit: g => { g.sites[2].id = 'future-site-03' as PermianSiteId; }, code: 'site-catalog' },
  'empty site': { edit: g => { g.sites[0].exhibitIds = []; }, code: 'empty-site' },
  'duplicate fossil in a site': { edit: g => { g.sites[0].exhibitIds.push('dimetrodon'); }, code: 'site-assignment-contract' },
  'duplicate progression position': { edit: g => { g.sequence[1].position = 1; }, code: 'duplicate-position' },
  'noninteger progression position': { edit: g => { g.sequence[1].position = 1.5; }, code: 'progression-order' },
  'out-of-order sequence': { edit: g => { [g.sequence[0].position, g.sequence[1].position] = [2, 1]; }, code: 'progression-order' },
  'missing sequence entry': { edit: g => { g.sequence.pop(); }, code: 'sequence-length' },
  'duplicate sequence exhibit': { edit: g => { g.sequence[1].exhibitId = 'dimetrodon'; }, code: 'duplicate-sequence-exhibit' },
  'stand self-display cycle': { edit: g => { g.stands[0].requiredDisplayIds = ['dimetrodon']; }, code: 'dependency-cycle' },
  'two-stand cycle': { edit: g => { g.stands[0].requiredDisplayIds = ['trilobite']; }, code: 'dependency-cycle' },
  'removed stand prerequisite': { edit: g => { g.stands[1].requiredDisplayIds = []; }, code: 'stand-order' },
  'site self-cycle': { edit: g => { g.sites[1].requiredSiteIds = ['eryops-dig']; }, code: 'dependency-cycle' },
  'two-site cycle': { edit: g => { g.sites[1].requiredSiteIds = ['moschops-dig']; g.sites[2].requiredSiteIds = ['eryops-dig']; }, code: 'dependency-cycle' },
  'site gated by its own future display': { edit: g => { g.sites[1].triggerStandId = 'stand-walchia'; }, code: 'dependency-cycle' },
  'earlier-room fossils gated by a future stand': { edit: g => { g.sites[1].triggerStandId = 'stand-gorgonops'; }, code: 'wrong-room-site-gate' },
  'later-room fossils gated in Room 1': { edit: g => { g.sites[5].triggerStandId = 'stand-dimetrodon'; }, code: 'wrong-room-site-gate' },
  'first site is not initially accessible': { edit: g => { g.sites[0].initiallyAvailable = false; }, code: 'no-bootstrap-income' },
  'first site requires payment': { edit: g => { g.sites[0].candidatePrice = 1; }, code: 'no-bootstrap-income' },
  'another site initially available': { edit: g => { g.sites[1].initiallyAvailable = true; }, code: 'initial-site' },
  'nonfinite site price': { edit: g => { g.sites[1].candidatePrice = Infinity; }, code: 'site-price' },
  'duplicate room ID': { edit: g => { g.rooms.push(g.rooms[0]); }, code: 'duplicate-room' },
  'unknown room predecessor': { edit: g => { g.rooms[1].predecessorRoomId = 'unknown' as PermianRoomId; }, code: 'unknown-predecessor' },
  'room predecessor cycle': { edit: g => { g.rooms[1].predecessorRoomId = 'permian-room-3'; }, code: 'predecessor-cycle' },
  'Room 2 bypasses Room 1': { edit: g => { g.rooms[1].initiallyAvailable = true; g.rooms[1].predecessorRoomId = null; }, code: 'room-order' },
  'Room 3 bypasses Room 2': { edit: g => { g.rooms[2].predecessorRoomId = 'permian-room-1'; }, code: 'room-order' },
  'Room 2 can follow incomplete Room 1': { edit: g => { g.rooms[0].requiredExhibitIds.pop(); }, code: 'room-completion-gate' },
  'Room 3 can follow incomplete Room 2': { edit: g => { g.rooms[1].requiredExhibitIds.pop(); }, code: 'room-completion-gate' },
  'wrong featured metadata': { edit: g => { g.rooms[0].featuredExhibitId = 'dimetrodon'; }, code: 'room-metadata' },
};
for (const [name, { edit, code }] of Object.entries(invalidGraphs)) test(`graph rejects ${name}`, () => {
  const graph = cloneGraph(); edit(graph); const before = structuredClone(graph);
  const result = validatePermianProgressionGraph(graph);
  assert.equal(result.valid, false); assert.equal(result.financial.laterPurchases, 'unproven');
  assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues));
  assert.ok(result.issues.every(issue => issue.path.length && issue.message.length > 12));
  assert.deepEqual(graph, before);
});

test('bootstrap budget checks require cash without assuming credit, random soil or optional assistance', () => {
  for (const budget of [{ startingCoins: 11, firstStandCost: 12 }, { startingCoins: 20, firstStandCost: 21 },
    { startingCoins: NaN, firstStandCost: 12 }, { startingCoins: 20, firstStandCost: -1 }]) {
    const result = validatePermianProgressionGraph(undefined, budget);
    assert.equal(result.valid, false); assert.equal(result.financial.firstPayingDisplayReachable, false);
    assert.ok(result.issues.some(i => i.code === 'bootstrap-budget'));
  }
  assert.equal(validatePermianProgressionGraph(undefined, { startingCoins: 12, firstStandCost: 12 }).valid, true);
  const graph = cloneGraph(); graph.sites[7].candidatePrice = 999999;
  const result = validatePermianProgressionGraph(graph);
  assert.equal(result.valid, true, 'finite later prices do not prove acceptable waiting time');
  assert.equal(result.financial.laterPurchases, 'conditional');
  assert.ok(result.nodes.every(n => !/helper|upgrade/.test(n.id)));
});

for (const plan of PERMIAN_DIFFICULTY_PLANS) test(`${plan.siteId}: future depth metadata groups consecutive layers in pairs`, () => {
  assert.equal(validPermianDifficulty(plan), true);
  for (let layer = 0; layer < plan.layers; layer++) {
    const data = permianLayerCandidate(plan, layer)!;
    assert.ok([1, 2, 3].includes(data.resistance)); assert.ok(data.multiplier > 0);
    if (layer % 2) assert.deepEqual(data, permianLayerCandidate(plan, layer - 1));
    if (layer > 0 && layer % 2 === 0) {
      assert.notEqual(data.materialId, permianLayerCandidate(plan, layer - 1)!.materialId);
      assert.notEqual(data.multiplier, permianLayerCandidate(plan, layer - 1)!.multiplier);
    }
  }
  assert.equal(permianLayerCandidate(plan, -1), undefined); assert.equal(permianLayerCandidate(plan, plan.layers), undefined);
});

test('independent site coefficients are supported and invalid depth data cannot expose unbreakable materials', () => {
  const original = PERMIAN_DIFFICULTY_PLANS[6], changed = structuredClone(original) as Mutable<typeof original>;
  changed.groups[1].multiplier = 2.2;
  assert.equal(permianLayerCandidate(changed, 2)?.multiplier, 2.2);
  assert.equal(permianLayerCandidate(changed, 3)?.multiplier, 2.2);
  assert.equal(permianLayerCandidate(original, 2)?.multiplier, 1.35);
  for (const bad of [0, -1, Infinity, NaN]) { changed.groups[1].multiplier = bad; assert.equal(validPermianDifficulty(changed), false); }
  for (const layers of [0, 6, 1.5]) assert.equal(validPermianDifficulty({ ...original, layers }), false);
  assert.equal(validPermianDifficulty({ ...original, groups: [] }), false);
  assert.equal(validPermianDifficulty({ ...original, groups: original.groups.map(g => ({ ...g, materialId: 'unknown' as typeof g.materialId })) }), false);
});

test('new queries and validator are pure on frozen inputs and preserve Phase 7.4B completion behavior', () => {
  const state = freeze(prefix(4)), content = freeze(structuredClone(definitions)), graph = freeze(cloneGraph());
  const before = JSON.stringify([state, content, graph]);
  const old = { unlockedRoomIds: state.ownedRoomIds, ownedStandIds: state.ownedStandIds, exhibits: state.exhibits };
  assert.equal(isPermianExhibitDisplayed('walchia', old, content), true);
  assert.equal(permianRoomStatus('permian-room-2', old, content), 'eligible-for-purchase');
  assert.equal(permianProgressionRoomStatus('permian-room-2', state, content), 'eligible-for-purchase');
  nextPermianExhibit(state, content); eligiblePermianStand(state, content); permianSiteStatus('eryops-dig', state, content);
  assert.equal(validatePermianProgressionGraph(graph).valid, true);
  assert.equal(JSON.stringify([state, content, graph]), before);
});

test('MVP prices change only approved stands/sites while future content and depth remain inactive', () => {
  assert.deepEqual(EXHIBITS.map(e => e.id), ['dimetrodon', 'trilobite', 'eryops']);
  assert.deepEqual(SITES.map(s => [s.id, s.grid.columns, s.grid.rows, s.grid.levels]), [['courtyard-dig', 8, 8, 1], ['eryops-dig', 8, 8, 2]]);
  assert.deepEqual(MAP_SITES.map(s => [s.id, s.cost, s.playable]), [['courtyard-dig', 0, true], ['eryops-dig', 20, true], ['future-site-03', 0, false]]);
  assert.deepEqual(SITE_PLOTS.map(s => [s.id, s.playable]), [['courtyard-dig', true], ['eryops-dig', true], ['future-site-03', false]]);
  assert.deepEqual(PURCHASES.map(s => [s.id, s.cost]), [['stand-dimetrodon', 12], ['stand-trilobite', 8], ['west-wing', 18], ['stand-eryops', 16], ['stand-walchia', 10]]);
});

test('schema 24 round-trips unchanged and cannot accept future room/site/stand entitlements', () => {
  const save = createCreditSave(42), raw = JSON.stringify(save);
  assert.equal(save.version, 24); assert.deepEqual(parseCreditSave(raw, 42), save);
  assert.deepEqual(ownedPermianRoomIds(save.rooms), ['permian-room-1']);
  assert.equal(parseCreditSave(JSON.stringify({ ...save, rooms: { version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 90 }] } }), 42), null);
  for (const site of PERMIAN_SITE_PLANS.slice(2)) assert.equal(parseCreditSave(JSON.stringify({ ...save,
    world: { ...save.world, owned: [{ id: site.id, source: 'purchase', paid: site.candidatePrice }] } }), 42), null);
  assert.equal(parseCreditSave(JSON.stringify({ ...save, museum: { ...save.museum, owned: [{ id: 'stand-walchia', source: 'legacy', paid: 0 }] } }), 42), null);
  const state = { ...fresh(), ownedRoomIds: ownedPermianRoomIds(save.rooms) };
  eligiblePermianStand(state, definitions); validatePermianProgressionGraph();
  assert.equal(JSON.stringify(save), raw);
});

test('only the bounded MVP adapter integrates the graph; depth and future content stay isolated', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const consumers = readdirSync(root, { recursive: true }).filter((name): name is string => typeof name === 'string' && name.endsWith('.ts'))
    .filter(name => /(?:from\s+|import\s*\(\s*)['"][^'"]*\/(?:permian-progression|permian-progression-validation|permian-difficulty)\.ts['"]/.test(readFileSync(join(root, name), 'utf8')))
    .map(name => name.replaceAll('\\', '/')).sort();
  assert.deepEqual(consumers, ['content/permian-difficulty.ts', 'game/mvp-progression.ts', 'game/permian-progression-validation.ts', 'game/permian-progression.ts']);
});
