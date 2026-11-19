import { PERMIAN_EXHIBITS, PERMIAN_ROOMS } from '../content/permian-museum.ts';
import { PERMIAN_PROGRESSION_GRAPH, PERMIAN_EXHIBIT_ORDER, PERMIAN_SITE_PLANS } from '../content/permian-progression.ts';
import type { PermianProgressionGraph } from '../content/permian-progression.ts';
import { validatePermianRoomDependencies } from './permian-rooms.ts';

export type PermianGraphIssue = { readonly code: string; readonly path: string; readonly message: string };
export type PermianGraphNodeKind = 'room' | 'stand' | 'site' | 'acquire' | 'restore' | 'display' | 'income';
export type PermianGraphNode = { readonly id: string; readonly kind: PermianGraphNodeKind; readonly contentId: string; readonly requires: readonly string[] };
export type PermianBootstrapBudget = { readonly startingCoins: number; readonly firstStandCost: number };
export type PermianGraphValidation = {
  readonly valid: boolean;
  readonly issues: readonly PermianGraphIssue[];
  readonly nodes: readonly PermianGraphNode[];
  // Ordered symbolic witness, not a save, transaction log or authored fossil recipe.
  readonly witness: readonly PermianGraphNode[];
  readonly reachable: Readonly<Record<PermianGraphNodeKind, readonly string[]>>;
  readonly financial: { readonly bootstrapCost: number; readonly remainingAfterFirstStand: number | null;
    readonly firstPayingDisplayReachable: boolean; readonly laterPurchases: 'conditional' | 'unproven' };
};
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));

/** Validate authored typed data, including deliberately invalid test catalogs.
 * Not a raw-JSON parser. Later finite prices/attendance are assumptions, not a
 * simulation. Only the first stand and free first site have a cash proof here.
 */
export function validatePermianProgressionGraph(graph: PermianProgressionGraph = PERMIAN_PROGRESSION_GRAPH,
  budget: PermianBootstrapBudget = { startingCoins: 20, firstStandCost: 12 }): PermianGraphValidation {
  const issues: PermianGraphIssue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const unique = (ids: readonly string[], kind: string) => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) issue(`duplicate-${kind}`, `${kind}:${id}`, `Duplicate ${kind} identity '${id}'; keep exactly one definition.`); seen.add(id); }
  };
  unique(graph.exhibits.map(e => e.id), 'exhibit'); unique(graph.rooms.map(r => r.id), 'room');
  unique(graph.stands.map(s => s.id), 'stand'); unique(graph.sites.map(s => s.id), 'site');
  const exhibitIds = graph.exhibits.map(e => e.id), roomIds = graph.rooms.map(r => r.id);
  if (!sameSet(exhibitIds, PERMIAN_EXHIBITS.map(e => e.id))) issue('exhibit-catalog', 'exhibits', 'Expected exactly the 17 approved Permian exhibit IDs.');
  if (!sameSet(roomIds, PERMIAN_ROOMS.map(r => r.id))) issue('room-catalog', 'rooms', 'Expected exactly the three approved Permian rooms.');
  if (!sameSet(graph.sites.map(s => s.id), PERMIAN_SITE_PLANS.map(s => s.id))) issue('site-catalog', 'sites', 'Expected exactly the eight stable approved site IDs.');
  for (const problem of validatePermianRoomDependencies(graph.rooms)) issue(problem.code, `room:${problem.roomId}`,
    `Invalid room dependency (${problem.code})${problem.dependencyId ? ` on '${problem.dependencyId}'` : ''}. Check predecessor and required-display membership.`);

  for (const exhibit of graph.exhibits) {
    const approved = PERMIAN_EXHIBITS.find(e => e.id === exhibit.id);
    if (!approved || approved.size !== exhibit.size) issue('exhibit-definition', `exhibit:${exhibit.id}`, 'Unknown exhibit or size differs from the approved definition.');
    const owners = graph.rooms.filter(r => r.exhibitIds.includes(exhibit.id));
    if (owners.length !== 1) issue('room-assignment', `exhibit:${exhibit.id}`, `Expected one room assignment, found ${owners.length}.`);
    const sites = graph.sites.filter(s => s.exhibitIds.includes(exhibit.id));
    if (sites.length !== 1) issue('site-assignment', `exhibit:${exhibit.id}`, `Expected one excavation site, found ${sites.length}.`);
    const stands = graph.stands.filter(s => s.exhibitId === exhibit.id);
    if (stands.length !== 1) issue('stand-assignment', `exhibit:${exhibit.id}`, `Expected one stand, found ${stands.length}.`);
  }
  for (const room of graph.rooms) {
    const approved = PERMIAN_ROOMS.find(r => r.id === room.id);
    if (!approved) continue;
    if (room.predecessorRoomId !== approved.predecessorRoomId || room.initiallyAvailable !== approved.initiallyAvailable)
      issue('room-order', `room:${room.id}`, `Room must follow '${approved.predecessorRoomId ?? 'initial ownership'}'; only Room 1 starts owned.`);
    if (!sameSet(room.exhibitIds, approved.exhibitIds) || !sameSet(room.requiredExhibitIds, approved.requiredExhibitIds))
      issue('room-completion-gate', `room:${room.id}`, 'Preserve approved membership and require EVERY assigned exhibit before the successor room purchase.');
    if (!sameSet(room.largeExhibitIds, approved.largeExhibitIds) || !sameSet(room.smallExhibitIds, approved.smallExhibitIds) || room.featuredExhibitId !== approved.featuredExhibitId)
      issue('room-metadata', `room:${room.id}`, 'Preserve approved size subsets and featured exhibit; the feature alone cannot complete a room.');
  }

  unique(graph.sequence.map(s => String(s.position)), 'position'); unique(graph.sequence.map(s => s.exhibitId), 'sequence-exhibit');
  const ordered = [...graph.sequence].sort((a, b) => a.position - b.position);
  if (ordered.length !== 17) issue('sequence-length', 'sequence', 'The global sequence must contain exactly 17 entries.');
  for (const [i, entry] of ordered.entries()) {
    if (!Number.isInteger(entry.position) || entry.position !== i + 1 || entry.exhibitId !== PERMIAN_EXHIBIT_ORDER[i])
      issue('progression-order', `sequence:${entry.position}`, `Position ${i + 1} must be '${PERMIAN_EXHIBIT_ORDER[i] ?? 'absent'}', found '${entry.exhibitId}'.`);
    const stand = graph.stands.find(s => s.id === entry.standId);
    if (!stand || stand.exhibitId !== entry.exhibitId) issue('unknown-stand-reference', `sequence:${entry.position}`, `Stand '${entry.standId}' must exist and serve '${entry.exhibitId}'.`);
  }
  for (const stand of graph.stands) {
    const room = graph.rooms.find(r => r.id === stand.roomId), position = PERMIAN_EXHIBIT_ORDER.indexOf(stand.exhibitId);
    if (position < 0 || stand.id !== `stand-${stand.exhibitId}` || !room?.exhibitIds.includes(stand.exhibitId))
      issue('stand-definition', `stand:${stand.id}`, 'Stand must use its stable stand-<exhibit> ID and match a known exhibit in its assigned room.');
    const expected = position > 0 ? [PERMIAN_EXHIBIT_ORDER[position - 1]] : [];
    if (!sameSet(stand.requiredDisplayIds, expected)) issue('stand-order', `stand:${stand.id}`,
      `Expected previous displayed exhibit '${expected[0] ?? 'none (first stand)'}'; found [${stand.requiredDisplayIds.join(', ')}].`);
  }
  for (const site of graph.sites) {
    const approved = PERMIAN_SITE_PLANS.find(s => s.id === site.id), trigger = graph.stands.find(s => s.id === site.triggerStandId);
    if (!site.exhibitIds.length) issue('empty-site', `site:${site.id}`, 'Every site must contain at least one fossil.');
    if (!Number.isSafeInteger(site.candidatePrice) || site.candidatePrice < 0) issue('site-price', `site:${site.id}`, 'Candidate site cost must be a finite nonnegative integer.');
    if (!trigger) issue('unknown-stand-reference', `site:${site.id}`, `Unknown triggering stand '${site.triggerStandId}'.`);
    if (!roomIds.includes(site.roomId) || trigger?.roomId !== site.roomId || site.exhibitIds.some(id => !graph.rooms.find(r => r.id === site.roomId)?.exhibitIds.includes(id)))
      issue('wrong-room-site-gate', `site:${site.id}`, 'All fossils and the trigger stand must belong to this site\'s owned room; no earlier/successor-room gate.');
    if (approved && (!sameSet(site.exhibitIds, approved.exhibitIds) || site.triggerStandId !== approved.triggerStandId || site.roomId !== approved.roomId))
      issue('site-assignment-contract', `site:${site.id}`, `Restore approved fossils [${approved.exhibitIds.join(', ')}] and trigger '${approved.triggerStandId}'.`);
    if (site.initiallyAvailable !== (site.id === 'courtyard-dig') || site.initiallyAvailable && site.candidatePrice !== 0)
      issue('initial-site', `site:${site.id}`, 'Only courtyard-dig is initially available, and it must be free without any purchased stand.');
    if (site.requiredSiteIds.length) issue('unapproved-site-prerequisite', `site:${site.id}`, 'No predecessor-site purchase/closure gates are approved; remove these extra site dependencies.');
  }

  const budgetValid = [budget.startingCoins, budget.firstStandCost].every(n => Number.isSafeInteger(n) && n >= 0);
  const funded = budgetValid && budget.startingCoins >= budget.firstStandCost;
  if (!funded) issue('bootstrap-budget', 'financial:first-stand', 'Starting coins must cover the entire first mandatory stand without ticket revenue, rewards, helpers or credit.');

  const nodes: PermianGraphNode[] = [], keys = new Set<string>();
  const key = (kind: PermianGraphNodeKind, id: string) => `${kind}:${id}`;
  const add = (kind: PermianGraphNodeKind, id: string, requires: string[]) => {
    const nodeId = key(kind, id);
    if (keys.has(nodeId)) return; // Duplicate author identities already reported; do not overwrite an arbitrary node.
    keys.add(nodeId); nodes.push({ id: nodeId, kind, contentId: id, requires: [...new Set(requires)] });
  };
  const first = ordered[0], income = key('income', 'tickets');
  for (const room of graph.rooms) {
    const previous = graph.rooms.find(r => r.id === room.predecessorRoomId);
    add('room', room.id, room.initiallyAvailable ? [] : [key('room', room.predecessorRoomId ?? '<missing-predecessor>'), income,
      ...(previous?.requiredExhibitIds ?? []).map(id => key('display', id))]);
  }
  for (const stand of graph.stands) add('stand', stand.id, [key('room', stand.roomId),
    ...stand.requiredDisplayIds.map(id => key('display', id)), ...(stand.id === first?.standId ? [] : [income])]);
  for (const site of graph.sites) add('site', site.id, [key('room', site.roomId), ...site.requiredSiteIds.map(id => key('site', id)),
    ...(site.initiallyAvailable && site.candidatePrice === 0 ? [] : [key('stand', site.triggerStandId), income])]);
  for (const exhibit of graph.exhibits) {
    const sites = graph.sites.filter(s => s.exhibitIds.includes(exhibit.id)), stand = graph.stands.find(s => s.exhibitId === exhibit.id);
    add('acquire', exhibit.id, sites.length ? sites.map(s => key('site', s.id)) : [key('site', `<unassigned:${exhibit.id}>`)]);
    add('restore', exhibit.id, [key('acquire', exhibit.id)]);
    add('display', exhibit.id, [key('restore', exhibit.id), key('stand', stand?.id ?? `<unassigned:${exhibit.id}>`), key('room', stand?.roomId ?? '<unassigned>')]);
  }
  add('income', 'tickets', [key('display', first?.exhibitId ?? '<missing-first-exhibit>')]);
  for (const node of nodes) for (const dependency of node.requires) if (!keys.has(dependency))
    issue('unknown-dependency', node.id, `Dependency '${dependency}' has no definition.`);

  // DFS records actionable mixed room/stand/site/display cycles, not merely cycles
  // within one catalog. Such mixed cycles are the acquisition self-gate risk.
  const byId = new Map(nodes.map(node => [node.id, node])), done = new Set<string>(), stack: string[] = [], cycleKeys = new Set<string>();
  function visit(id: string) {
    const index = stack.indexOf(id);
    if (index >= 0) {
      const cycle = [...stack.slice(index), id], identity = [...new Set(cycle)].sort().join('|');
      if (!cycleKeys.has(identity)) { cycleKeys.add(identity); issue('dependency-cycle', id, `Circular prerequisite: ${cycle.join(' -> ')}. Remove the future/self requirement.`); }
      return;
    }
    if (done.has(id) || !byId.has(id)) return;
    stack.push(id); byId.get(id)!.requires.forEach(visit); stack.pop(); done.add(id);
  }
  nodes.forEach(node => visit(node.id));

  // Monotone closure yields one deterministic construction witness. Every paid
  // later entitlement requires an already reachable repeatable-income node;
  // it is never granted just because a predecessor eligibility was reached.
  const reached = new Set<string>(), witness: PermianGraphNode[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (reached.has(node.id) || !funded && node.id === key('stand', first?.standId ?? '') || !node.requires.every(id => reached.has(id))) continue;
      reached.add(node.id); witness.push(node); changed = true;
    }
  }
  for (const node of nodes) if (!reached.has(node.id)) issue('unreachable', node.id,
    `Cannot reach '${node.id}'; unmet prerequisites: ${node.requires.filter(id => !reached.has(id)).join(', ') || 'first-stand budget'}.`);
  const reachable: Record<PermianGraphNodeKind, string[]> = { room: [], stand: [], site: [], acquire: [], restore: [], display: [], income: [] };
  witness.forEach(node => reachable[node.kind].push(node.contentId));
  const firstPayingDisplayReachable = reached.has(income);
  if (!firstPayingDisplayReachable) issue('no-bootstrap-income', 'financial:first-display', 'No paying first display can be reached without prior ticket income.');
  return { valid: issues.length === 0, issues, nodes, witness, reachable,
    financial: { bootstrapCost: budget.firstStandCost, remainingAfterFirstStand: funded ? budget.startingCoins - budget.firstStandCost : null,
      firstPayingDisplayReachable, laterPurchases: issues.length === 0 && firstPayingDisplayReachable ? 'conditional' : 'unproven' } };
}
