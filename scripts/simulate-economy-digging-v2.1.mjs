// Research only: never imports application/persistence code or opens browser saves.
// node scripts/simulate-economy-digging-v2.1.mjs [--out directory] [--config file.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICES, STYLES } from './simulate-economy-v2.mjs';
import { PERMIAN_EXHIBITS, PERMIAN_ROOMS } from '../src/content/permian-museum.ts';
import { VISITORS } from '../src/content/visitors.ts';
import { coinOutcome } from '../src/game/economy.ts';

const round = n => Math.round(n * 100) / 100;
const sum = ns => ns.reduce((a, b) => a + b, 0);
const SIZE = Object.fromEntries(PERMIAN_EXHIBITS.map(e => [e.id, e.size]));
const ROOM = Object.fromEntries(PERMIAN_ROOMS.flatMap((r, i) => r.exhibitIds.map(id => [id, i + 1])));
export const BLOCKS = [
  ['dimetrodon', 'trilobite'], ['eryops', 'walchia'], ['moschops', 'arthropleura'],
  ['estemmenosuchus', 'glossopteris'], ['edaphosaurus', 'captorhinus'], ['gorgonops', 'helicoprion'],
  ['scutosaurus', 'gorgonops-tooth', 'inostrancevia'], ['dicynodon', 'permian-ammonoid'],
];
export const CURVES = {
  gentle: [1, 1.15, 1.3, 1.5, 1.7], moderate: [1, 1.35, 1.7, 2.2, 2.8],
  steep: [1, 1.6, 2.4, 3.5, 5], deep: [1, 1.2, 1.4, 1.65, 1.9, 2.2, 2.5],
  irregular: [1, 1.7, 1.2, 2.4, 1.8],
};
export const ECONOMICS = {
  sites: [0, 20, 30, 40, 50, 60, 75, 90], rooms: [90, 240],
  assistants: { cheap: [60, 100, 160, 240, 360], balanced: [100, 180, 300, 460, 680], expensive: [160, 280, 460, 700, 1000] },
  player: [40, 90, 180], helperUpgrade: [60, 140],
};
export const CAPACITIES = [[6, 6], [10, 12], [14, 18]]; // queue, admitted occupancy
export const TIMING = {
  active: { ...STYLES.active, swing: 1, move: 0.25, clean: 10, assembleLarge: 30, assembleSmall: 12 },
  typical: { ...STYLES.typical, swing: 1.2, move: 0.4, clean: 18, assembleLarge: 60, assembleSmall: 25 },
  distracted: { ...STYLES.distracted, swing: 1.5, move: 0.65, clean: 30, assembleLarge: 120, assembleSmall: 45 },
};
export function power(level, increment = 0.5, scaling = 'additive') {
  if (!Number.isInteger(level) || level < 0 || !Number.isFinite(increment) || increment <= 0 || !['additive', 'multiplicative'].includes(scaling)) throw Error('Invalid power');
  return scaling === 'additive' ? 1 + level * increment : (1 + increment) ** level;
}
export function hits(resistance, multiplier, digPower = 1) {
  if (![resistance, multiplier, digPower].every(n => Number.isFinite(n) && n > 0)) throw Error('Every cell must be diggable');
  return Math.ceil(resistance * multiplier / digPower);
}
export const partIds = id => Array.from({ length: SIZE[id] === 'large' ? 6 : 1 }, (_, i) => `${id}/${i}`);

// Deterministic spatial material distribution; no random global state.
export function makeSites({ curve = 'moderate', resistant = 0.15, placement = 'spread', siteDefinitions } = {}) {
  const depths = curve === 'deep' ? [1, 2, 3, 4, 5, 5, 6, 7] : [1, 2, 3, 3, 4, 4, 5, 5];
  if (!CURVES[curve] || !Number.isFinite(resistant) || resistant < 0 || resistant > 0.7 || !['spread', 'deep', 'clustered'].includes(placement)) throw Error('Invalid site configuration');
  return BLOCKS.map((ids, si) => {
    // A supplied site's layers/material pattern override the preset independently.
    const spec = siteDefinitions?.[si];
    const multipliers = spec?.multipliers ?? CURVES[curve].slice(0, depths[si]);
    const count = spec?.cellsPerLayer ?? 64;
    if (!Number.isInteger(count) || count < 16 || !multipliers.length) throw Error('Invalid site layers');
    const cells = multipliers.flatMap((multiplier, layer) => Array.from({ length: count }, (_, column) => {
      const q = ((column * 37 + layer * 19 + si * 11) % 100) / 100;
      const hard = curve === 'irregular' && layer % 2 ? Math.min(0.7, resistant + 0.25) : resistant;
      const resistance = spec?.materials?.[layer]?.[column % spec.materials[layer].length] ?? (q < hard ? 3 : q < hard + 0.3 ? 2 : 1);
      hits(resistance, multiplier);
      return { id: `s${si}/l${layer}/c${column}`, layer, multiplier, resistance, items: [] };
    }));
    const parts = ids.flatMap(partIds);
    const start = placement === 'deep' ? (multipliers.length - 1) * count : placement === 'clustered' ? Math.floor(cells.length * 0.7) : Math.floor(cells.length * 0.2);
    parts.forEach((id, i) => {
      const index = placement === 'clustered' ? Math.min(cells.length - 1, start + i * 2)
        : Math.min(cells.length - 1, start + Math.floor((cells.length - start - 1) * (i + 1) / parts.length));
      cells[index].items.push(id);
    });
    return { id: `site-${si + 1}`, room: ROOM[ids[0]], exhibits: ids, multipliers, cells };
  });
}
export function workTable(sites, digPower = 1, swing = 1.2, move = 0.4) {
  return sites.map(site => {
    const layers = site.multipliers.map((multiplier, layer) => {
      const cells = site.cells.filter(c => c.layer === layer), required = cells.map(c => hits(c.resistance, multiplier, digPower));
      return { layer: layer + 1, multiplier, cells: cells.length, hits: sum(required), maxHits: Math.max(...required),
        resistanceWork: round(sum(cells.map(c => c.resistance * multiplier))),
        seconds: round(sum(required) * swing + cells.length * move), repetitiveCells: required.filter(n => n >= 6).length };
    });
    return { site: site.id, layers, hits: sum(layers.map(l => l.hits)), seconds: round(sum(layers.map(l => l.seconds))) };
  });
}

export function validDisplays(records, stands, rooms) {
  return [...new Set(records.filter(r => SIZE[r.id] && stands.includes(r.id) && rooms.includes(ROOM[r.id])
    && r.stand === r.id && r.placed === true && partIds(r.id).every(p => r.restored?.includes(p) && r.assembled?.includes(p))).map(r => r.id))];
}
export function offers({ records, stands, rooms }, reachable) {
  const displayed = validDisplays(records, stands, rooms);
  if (stands.length >= displayed.length + 1) return [];
  return PERMIAN_EXHIBITS.map(e => e.id).filter(id => !stands.includes(id) && rooms.includes(ROOM[id])
    && reachable.includes(id) && (displayed.length > 0 || id === 'dimetrodon'));
}
export function roomEligible(room, state) {
  if (room < 2 || room > 3 || state.rooms.includes(room) || !state.rooms.includes(room - 1)) return false;
  const displayed = validDisplays(state.records, state.stands, state.rooms);
  return PERMIAN_ROOMS[room - 2].exhibitIds.every(id => displayed.includes(id));
}

// Museum-only clock and travel retirement retained from production. Proposed
// queue/occupancy caps are independent; cap checks precede payment.
export class RoomVisitors {
  constructor({ tour = 28, capacities = CAPACITIES, legacy = false } = {}) {
    if (!Number.isFinite(tour) || tour <= 0 || capacities.length !== 3
      || capacities.some(pair => pair.length !== 2 || pair.some(n => !Number.isInteger(n) || n <= 0))) throw Error('Invalid visitor configuration');
    Object.assign(this, { tour, capacities, legacy, queue: [], paid: [], arrival: 0, service: 0, shift: 0,
      sold: 0, income: 0, pending: 0, maxQueue: 0, maxOccupancy: 0, blockedSeconds: 0, museumSeconds: 0 });
  }
  travel() { this.paid = []; this.queue.fill(0); this.arrival = this.service = this.shift = 0; }
  collect() { const n = this.pending; this.pending = 0; return n; }
  step(dt, price, count, room, attended, running = true) {
    if (!running) return;
    const [queueCap, occupancyCap] = this.legacy ? [3, 6] : this.capacities[room - 1];
    this.museumSeconds += dt;
    this.queue = this.queue.map(t => Math.max(0, t - dt)); this.shift = Math.max(0, this.shift - dt);
    this.paid = this.paid.map(t => t - dt);
    const exited = this.paid.findIndex(t => t <= 0);
    if (exited >= 0) { this.paid.splice(exited, 1); return; }
    const full = !this.legacy && this.paid.length >= occupancyCap;
    if (full && attended && this.queue.length) this.blockedSeconds += dt;
    this.service = price > 0 && attended && !full && this.queue.length && this.queue[0] <= 1e-9 && this.shift <= 1e-9 ? this.service + dt : 0;
    if (this.service + 1e-9 >= VISITORS.serviceSeconds) {
      this.service = 0; this.queue.shift(); this.paid.push(this.tour); this.shift = 0.9 / VISITORS.speed;
      this.sold++; this.income += price; this.pending += price;
      this.maxOccupancy = Math.max(this.maxOccupancy, this.paid.length); return;
    }
    if (!price || this.queue.length >= queueCap || this.legacy && this.queue.length + this.paid.length >= occupancyCap) { this.arrival = 0; return; }
    this.arrival += dt;
    if (this.arrival + 1e-9 >= VISITORS.arrivalSeconds[Math.min(2, Math.max(0, count - 1))]) {
      this.arrival = 0; this.queue.push(2); this.maxQueue = Math.max(this.maxQueue, this.queue.length);
    }
  }
}

// Canonical item custody and exclusive cell reservations prevent two workers
// claiming the same part. A full chest retains the completed task until deposit.
export class DigWorld {
  constructor(definitions, chestCapacity = 12) {
    if (!Number.isInteger(chestCapacity) || chestCapacity < 1) throw Error('Invalid chest capacity');
    this.capacity = chestCapacity; this.time = 0; this.playerHits = 0; this.helperHits = 0; this.helperCells = 0; this.playerCells = 0;
    this.blockedWorkerSeconds = 0; this.backgroundCells = 0; this.collected = 0; this.soil = 0;
    this.sites = definitions.map(s => ({ ...structuredClone(s), activated: false, activatedAt: null, recoveryAt: null, clearedAt: null,
      cells: s.cells.map(c => ({ ...structuredClone(c), done: false, worker: null })),
      custody: Object.fromEntries(s.cells.flatMap(c => c.items.map(id => [id, 'buried']))) }));
    this.workers = [{ id: 'player', site: null, power: 1, swing: 1.2, move: 0.4, task: null }];
  }
  activate(index) { const s = this.sites[index]; if (!s.activated) { s.activated = true; s.activatedAt = this.time; } }
  addHelper(digPower = 1) { this.workers.push({ id: `helper-${this.workers.length}`, site: null, power: digPower, swing: 1.5, move: 0.6, task: null }); }
  assign(worker, index) {
    if (worker.site === index) return;
    if (worker.task) { // Reassignment is used only after the previous site is recovered; partial work is retained.
      const c = this.sites[worker.site].cells[worker.task.cell]; c.worker = null; c.remaining = worker.task.remaining; c.taskPower = worker.task.power;
    }
    worker.task = null; worker.site = index;
  }
  chest(index) { return Object.values(this.sites[index].custody).filter(v => v === 'chest').length; }
  collect(index) {
    const s = this.sites[index]; let count = 0;
    for (const id of Object.keys(s.custody)) if (s.custody[id] === 'chest') { s.custody[id] = 'carried'; count++; }
    this.collected += count; return count;
  }
  deposit() { for (const s of this.sites) for (const id of Object.keys(s.custody)) if (s.custody[id] === 'carried') s.custody[id] = 'museum'; }
  has(id, locations = ['museum']) { const s = this.sites.find(s => s.exhibits.includes(id)); return partIds(id).every(p => locations.includes(s.custody[p])); }
  step(dt, { running = true, playerSite = null, helperEfficiency = 1, soilSeed = null } = {}) {
    if (!running) return;
    if (playerSite === null) this.assign(this.workers[0], null);
    this.time += dt;
    for (const w of this.workers) {
      const player = w.id === 'player', si = player ? playerSite : w.site;
      if (si === null || !this.sites[si].activated) continue;
      if (player) this.assign(w, si);
      const s = this.sites[si];
      if (s.clearedAt !== null) continue;
      if (!w.task) {
        const layer = s.cells.find(c => !c.done)?.layer;
        const ci = s.cells.findIndex(c => !c.done && c.worker === null && c.layer === layer);
        if (ci < 0) continue;
        const c = s.cells[ci], required = hits(c.resistance, c.multiplier, w.power);
        c.worker = w.id;
        // Store remaining normalized cell work on release; a new worker scales it by its own power.
        const fraction = c.remaining === undefined ? 1 : c.remaining / (hits(c.resistance, c.multiplier, c.taskPower));
        w.task = { cell: ci, remaining: required * fraction, power: w.power, move: w.move };
      }
      const t = w.task, c = s.cells[t.cell];
      if (t.move > 1e-9) { t.move = Math.max(0, t.move - dt); continue; }
      if (t.remaining > 1e-9) {
        const work = Math.min(t.remaining, dt / w.swing * (player ? 1 : helperEfficiency));
        t.remaining -= work;
        if (player) this.playerHits += work; else this.helperHits += work;
      }
      if (t.remaining > 1e-9) continue;
      // Deposit a reveal burst incrementally. A burst larger than the entire
      // chest must still be recoverable; retain the remaining items on the task.
      const remaining = c.items.filter(id => s.custody[id] === 'buried');
      const slots = player ? remaining.length : this.capacity - this.chest(si);
      for (const id of remaining.slice(0, slots)) s.custody[id] = player ? 'carried' : 'chest';
      if (remaining.length > slots) { this.blockedWorkerSeconds += dt; continue; }
      c.done = true; c.worker = null; delete c.remaining; delete c.taskPower; w.task = null;
      if (player) this.playerCells++; else { this.helperCells++; if (playerSite === null) this.backgroundCells++; }
      if (soilSeed !== null) this.soil += coinOutcome(soilSeed, c.id);
      if (s.recoveryAt === null && Object.values(s.custody).every(v => v !== 'buried')) s.recoveryAt = this.time;
      if (s.cells.every(c => c.done)) s.clearedAt = this.time;
    }
  }
}

export function standOrder(kind = 'site') {
  if (!['site', 'small', 'large', 'reverse'].includes(kind)) throw Error('Invalid stand order');
  return PERMIAN_ROOMS.flatMap(r => {
    const ids = BLOCKS.flat().filter(id => r.exhibitIds.includes(id));
    if (kind === 'small' || kind === 'large') ids.sort((a, b) => Number(SIZE[b] === kind) - Number(SIZE[a] === kind));
    if (kind === 'reverse') ids.reverse();
    if (ids.includes('dimetrodon')) { ids.splice(ids.indexOf('dimetrodon'), 1); ids.unshift('dimetrodon'); }
    return ids;
  });
}

export function simulate(options = {}) {
  const o = { style: 'typical', curve: 'moderate', assistants: 0, playerLevels: 0, helperLevels: 0,
    playerIncrement: 0.5, helperIncrement: 0.5, scaling: 'additive', assistantPrices: 'balanced', upgradeCostScale: 1,
    timing: 'normal', chestCapacity: 12, travelScale: 1, order: 'site', roomCosts: ECONOMICS.rooms,
    siteCosts: ECONOMICS.sites, tour: 28, capacities: CAPACITIES, legacyVisitors: false, dt: 0.05,
    resistant: 0.15, placement: 'spread', soilSeed: null, diminishing: false, ...options };
  if (!TIMING[o.style] || !ECONOMICS.assistants[o.assistantPrices] || !Number.isInteger(o.assistants) || o.assistants < 0 || o.assistants > 5
    || !Number.isInteger(o.playerLevels) || o.playerLevels < 0 || o.playerLevels > 3 || !Number.isInteger(o.helperLevels) || o.helperLevels < 0 || o.helperLevels > 2
    || ![0.05, 0.25].includes(o.dt) || !['normal', 'early', 'late'].includes(o.timing)
    || ![o.upgradeCostScale, o.travelScale].every(n => Number.isFinite(n) && n > 0)
    || o.roomCosts.length !== 2 || o.siteCosts.length !== 8 || [...o.roomCosts, ...o.siteCosts].some(n => !Number.isSafeInteger(n) || n < 0) || o.siteCosts[0] !== 0) throw Error('Invalid scenario');
  power(o.playerLevels, o.playerIncrement, o.scaling); power(o.helperLevels, o.helperIncrement, o.scaling);
  const timing = TIMING[o.style], world = new DigWorld(makeSites(o), o.chestCapacity);
  const visitors = new RoomVisitors({ tour: o.tour, capacities: o.capacities, legacy: o.legacyVisitors });
  const state = { records: [], stands: [], rooms: [1] }, sitesOwned = new Set([0]);
  const transactions = [], displays = [], rooms = [], modes = {}, spending = { stand: 0, site: 0, room: 0, assistant: 0, playerUpgrade: 0, helperUpgrade: 0 };
  let seconds = 0, coins = 20, wait = 0, bouts = 0, trips = 0, playerLevel = 0, helperLevels = [], lastRoomTime = 0;
  let displayIds = [], fare = 0;
  const displayed = () => displayIds;
  const price = () => fare;
  const elapsed = (duration, mode, playerSite = null) => {
    const ticks = Math.ceil((duration - 1e-9) / o.dt), fare = price(), count = displayed().length;
    modes[mode] = (modes[mode] ?? 0) + ticks * o.dt;
    for (let i = 0; i < ticks; i++) {
      const beforeSoil = world.soil;
      world.step(o.dt, { playerSite, helperEfficiency: o.diminishing ? 1 / (1 + 0.15 * Math.max(0, world.workers.length - 2)) : 1, soilSeed: o.soilSeed });
      coins += world.soil - beforeSoil;
      if (mode === 'museum' || mode === 'desk') visitors.step(o.dt, fare, count, state.rooms.length, mode === 'desk');
    }
    seconds += ticks * o.dt;
    if (seconds > 24 * 3600) throw Error('Scenario exceeded 24 active hours');
  };
  const desk = () => { elapsed(timing.desk, 'desk'); if (++bouts % timing.collectEvery === 0) coins += visitors.collect(); };
  const buy = (kind, id, cost) => {
    const before = coins, pendingBefore = visitors.pending, start = seconds, sold = visitors.sold, visits = bouts;
    if (coins < cost && !price()) throw Error(`Bootstrap deadlock: ${id}`);
    while (coins < cost) { desk(); if (coins < cost) elapsed(timing.gap, 'museum'); }
    const delay = seconds - start; wait += delay; coins -= cost; spending[kind] += cost;
    transactions.push({ kind, id, cost, minute: round(seconds / 60), before, pendingBefore, after: coins,
      waitSeconds: round(delay), tickets: visitors.sold - sold, bouts: bouts - visits, fare: price(), displays: displayed().length });
    elapsed(3, 'purchase');
  };
  const upgrade = () => {
    const count = displayed().length, schedule = o.timing === 'early' ? [1, 2, 4, 6, 8] : o.timing === 'late' ? [6, 8, 10, 12, 14] : [2, 5, 8, 11, 14];
    while (playerLevel < o.playerLevels && count >= [2, 6, 11][playerLevel]) {
      buy('playerUpgrade', `player-${playerLevel + 1}`, Math.round(ECONOMICS.player[playerLevel] * o.upgradeCostScale));
      world.workers[0].power = power(++playerLevel, o.playerIncrement, o.scaling);
    }
    while (world.workers.length - 1 < o.assistants && count >= schedule[world.workers.length - 1]) {
      const index = world.workers.length - 1;
      buy('assistant', `helper-${index + 1}`, ECONOMICS.assistants[o.assistantPrices][index]);
      world.addHelper(); helperLevels.push(0);
    }
    helperLevels.forEach((level, index) => {
      while (level < o.helperLevels && count >= [6, 11][level]) {
        buy('helperUpgrade', `helper-${index + 1}-level-${level + 1}`, Math.round(ECONOMICS.helperUpgrade[level] * o.upgradeCostScale));
        world.workers[index + 1].power = power(++level, o.helperIncrement, o.scaling);
        helperLevels[index] = level;
      }
    });
  };
  const visit = si => {
    visitors.travel(); elapsed(timing.travel * o.travelScale / 2, 'travel'); trips++;
    world.activate(si);
    for (const w of world.workers.slice(1)) world.assign(w, si);
    world.collect(si); // Manual chest interaction, explicit time.
    elapsed(3, 'chest');
  };
  for (const id of standOrder(o.order)) {
    const room = ROOM[id], si = BLOCKS.findIndex(ids => ids.includes(id));
    if (!state.rooms.includes(room)) {
      if (!roomEligible(room, state)) throw Error('Successor room deadlock');
      buy('room', `room-${room}`, o.roomCosts[room - 2]); state.rooms.push(room);
    }
    if (!sitesOwned.has(si)) { buy('site', `site-${si + 1}`, o.siteCosts[si]); sitesOwned.add(si); }
    const reachable = BLOCKS.flatMap((ids, i) => sitesOwned.has(i) ? ids : []);
    if (!offers(state, reachable).includes(id)) throw Error(`Invalid stand purchase: ${id}`);
    buy('stand', id, PRICES[30][SIZE[id]][state.stands.filter(e => SIZE[e] === SIZE[id]).length]); state.stands.push(id);
    upgrade();
    if (!world.has(id)) {
      visit(si);
      const player = world.workers[0]; player.swing = timing.swing; player.move = timing.move;
      while (!world.has(id, ['carried', 'museum'])) {
        elapsed(o.dt, 'dig', si);
        // Poll only at one-second boundaries; collection is never automatic transport.
        if (Math.round(seconds / o.dt) % Math.round(1 / o.dt) === 0 && world.chest(si)) {
          world.collect(si); elapsed(3, 'chest');
        }
      }
      world.collect(si); elapsed(timing.travel * o.travelScale / 2, 'travel'); world.deposit();
    }
    elapsed(partIds(id).length * timing.clean, 'cleaning');
    elapsed(SIZE[id] === 'large' ? timing.assembleLarge : timing.assembleSmall, 'assembly');
    state.records.push({ id, stand: id, placed: true, restored: partIds(id), assembled: partIds(id) });
    displayIds = validDisplays(state.records, state.stands, state.rooms);
    fare = sum(displayIds.map(e => SIZE[e] === 'large' ? 4 : 2));
    displays.push({ id, minute: round(seconds / 60), fare: price(), coins, pending: visitors.pending });
    elapsed(timing.explore, 'museum');
    if (displayed().length % timing.every === 0) desk();
    if (PERMIAN_ROOMS[room - 1].exhibitIds.every(e => displayed().includes(e))) {
      rooms.push({ room, minute: round(seconds / 60), durationMinutes: round((seconds - lastRoomTime) / 60), coins, pending: visitors.pending, fare: price() });
      lastRoomTime = seconds;
    }
  }
  const spent = sum(Object.values(spending));
  if (coins + visitors.pending + spent !== 20 + visitors.income + world.soil) throw Error('Money conservation');
  if (!world.sites.every(s => Object.values(s.custody).every(v => v === 'museum'))) throw Error('Untransported fossil');
  return { options: o, minutes: round(seconds / 60), waitMinutes: round(wait / 60), coins, pending: visitors.pending, soil: world.soil,
    tickets: visitors.sold, income: visitors.income, coinsPerMinute: round(visitors.income * 60 / seconds),
    spending, transactions, displays, rooms, trips, modes: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, round(v / 60)])),
    playerHits: round(world.playerHits), helperHits: round(world.helperHits), helperCellShare: round(world.helperCells / (world.helperCells + world.playerCells)),
    backgroundCells: world.backgroundCells, blockedWorkerSeconds: round(world.blockedWorkerSeconds),
    maxQueue: visitors.maxQueue, maxOccupancy: visitors.maxOccupancy, occupancyBlockedSeconds: round(visitors.blockedSeconds),
    sites: world.sites.map(s => ({ id: s.id, layers: s.multipliers.length, activatedMinute: round(s.activatedAt / 60),
      recoveryMinutes: round((s.recoveryAt - s.activatedAt) / 60), fullClearMinutes: s.clearedAt === null ? null : round((s.clearedAt - s.activatedAt) / 60),
      recoveredItems: Object.keys(s.custody).length, remainingCells: s.cells.filter(c => !c.done).length })) };
}

export function productivity({ assistants = 0, level = 0, increment = 0.5, scaling = 'additive', player = false, chestCapacity = 99, collectEvery = 60, diminishing = false } = {}) {
  const site = makeSites().slice(6, 7), w = new DigWorld(site, chestCapacity);
  w.activate(0); for (let i = 0; i < assistants; i++) { w.addHelper(power(level, increment, scaling)); w.assign(w.workers.at(-1), 0); }
  let seconds = 0, trips = 0;
  while (!w.sites[0].cells.every(c => c.done)) {
    w.step(0.25, { playerSite: player ? 0 : null, helperEfficiency: diminishing ? 1 / (1 + 0.15 * Math.max(0, assistants - 1)) : 1 }); seconds += 0.25;
    if (seconds % collectEvery === 0 && w.chest(0)) { w.collect(0); w.deposit(); trips++; }
    if (seconds > 36000) throw Error('Unproductive microbenchmark');
  }
  w.collect(0); w.deposit();
  return { assistants, level, increment, scaling, player, chestCapacity, collectEvery, diminishing, seconds, trips,
    blockedWorkerSeconds: round(w.blockedWorkerSeconds), playerHits: round(w.playerHits), helperHits: round(w.helperHits) };
}
export function visitorWindow(room, tour = 28, legacy = false, attended = true) {
  const v = new RoomVisitors({ tour, legacy });
  const price = [12, 30, 50][room - 1];
  for (let i = 0; i < 12000; i++) v.step(0.05, price, [4, 10, 17][room - 1], room, attended);
  return { room, tour, legacy, attended, tickets: v.sold, income: v.income, coinsPerMinute: v.income / 10,
    maxQueue: v.maxQueue, maxOccupancy: v.maxOccupancy, blockedSeconds: round(v.blockedSeconds) };
}
export function runResearch() {
  const scenarios = [], add = (name, options) => scenarios.push({ name, ...simulate(options) });
  for (const style of Object.keys(TIMING)) for (let assistants = 0; assistants <= 5; assistants++) add(`${style}-${assistants}`, { style, assistants });
  for (const curve of Object.keys(CURVES)) for (const assistants of [0, 3, 5]) add(`curve-${curve}-${assistants}`, { curve, assistants });
  for (const playerIncrement of [0.25, 0.5, 0.75]) for (const scaling of ['additive', 'multiplicative']) add(`player-${playerIncrement}-${scaling}`, { playerLevels: 3, playerIncrement, scaling });
  for (const assistants of [1, 3, 5]) for (const helperLevels of [1, 2]) for (const helperIncrement of [0.25, 0.5, 0.75]) add(`helper-${assistants}-${helperLevels}-${helperIncrement}`, { assistants, helperLevels, helperIncrement });
  for (const assistants of [1, 3, 5]) add(`combined-${assistants}`, { assistants, helperLevels: 2, playerLevels: 3 });
  for (const assistantPrices of Object.keys(ECONOMICS.assistants)) for (const timing of ['early', 'late']) add(`cost-${assistantPrices}-${timing}`, { assistants: 5, assistantPrices, timing });
  for (const upgradeCostScale of [0.6, 1.6]) add(`upgrade-cost-${upgradeCostScale}`, { assistants: 3, helperLevels: 2, playerLevels: 3, upgradeCostScale });
  for (const order of ['small', 'large', 'reverse']) add(`order-${order}`, { order, assistants: 3 });
  for (const roomCosts of [[50, 120], [160, 400]]) add(`room-${roomCosts[0]}`, { roomCosts });
  for (const siteCosts of [[0, 12, 18, 24, 30, 36, 42, 48], [0, 30, 45, 60, 75, 90, 110, 135]]) add(`sites-${siteCosts[1]}`, { siteCosts });
  for (const chestCapacity of [1, 4, 24]) for (const travelScale of [1, 2]) add(`transport-${chestCapacity}-${travelScale}`, { assistants: 5, helperLevels: 2, chestCapacity, travelScale });
  for (const resistant of [0, 0.4]) add(`soil-${resistant}`, { resistant });
  for (const placement of ['deep', 'clustered']) add(`placement-${placement}`, { assistants: 3, placement });
  for (const soilSeed of [0, 1, 42]) add(`soil-reward-${soilSeed}`, { soilSeed, assistants: 3 });
  for (const tour of [14, 56, 120]) add(`tour-${tour}`, { tour, assistants: 3 });
  add('legacy-cap', { assistants: 3, legacyVisitors: true });
  add('fixed-small-cap', { assistants: 3, capacities: [[6, 6], [6, 6], [6, 6]] });
  add('diminishing', { assistants: 5, helperLevels: 2, diminishing: true });
  add('multiplicative-helpers', { assistants: 5, helperLevels: 2, scaling: 'multiplicative' });
  add('candidate-three', { curve: 'gentle', assistants: 3, playerLevels: 3, helperLevels: 1 });
  add('candidate-five', { curve: 'gentle', assistants: 5, playerLevels: 3, helperLevels: 1 });
  for (const style of ['active', 'distracted']) add(`combined-${style}`, { style, assistants: 5, playerLevels: 3, helperLevels: 2 });
  for (const assistantPrices of ['cheap', 'expensive']) add(`cost-${assistantPrices}-normal`, { assistants: 5, assistantPrices });
  for (const assistants of [0, 5]) add(`coarse-step-${assistants}`, { assistants, dt: 0.25 });
  const throughput = [];
  for (let assistants = 1; assistants <= 5; assistants++) for (const level of [0, 1, 2]) throughput.push(productivity({ assistants, level }));
  for (const increment of [0.25, 0.75]) for (const scaling of ['additive', 'multiplicative']) throughput.push(productivity({ assistants: 5, level: 2, increment, scaling }));
  throughput.push(productivity({ player: true }), productivity({ assistants: 5, level: 2, player: true }), productivity({ assistants: 5, level: 2, diminishing: true }));
  for (const chestCapacity of [1, 4, 12]) for (const collectEvery of [60, 180]) throughput.push(productivity({ assistants: 5, level: 2, chestCapacity, collectEvery }));
  return { modelVersion: '2.1', assumptions: { economics: ECONOMICS, timings: TIMING, capacities: CAPACITIES,
    materials: [1, 2, 3], resistantShare: 0.15, mediumShare: 0.3, cellsPerLayer: 64, curves: CURVES,
    helperSwing: 1.5, helperMove: 0.6, collectionSeconds: 3, bagCapacity: 'unlimited', partsLarge: 6, partsSmall: 1,
    historicalCredit: 0, baselineSoilRewards: 0, visitorArrivals: VISITORS.arrivalSeconds, baselineTourSeconds: 28 },
    work: Object.fromEntries(Object.keys(CURVES).map(curve => [curve, workTable(makeSites({ curve }))])),
    powerWork: [0.25, 0.5, 0.75].flatMap(increment => ['additive', 'multiplicative'].flatMap(scaling => [0, 1, 2, 3].map(level => ({ increment, scaling, level,
      power: power(level, increment, scaling), sites: workTable(makeSites(), power(level, increment, scaling)) })))),
    scenarios, throughput, visitorWindows: [1, 2, 3].flatMap(room => [28, 120].flatMap(tour => [false, true].map(legacy => visitorWindow(room, tour, legacy)))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const out = resolve(arg('--out') ?? 'docs/phase7'), config = arg('--config'); mkdirSync(out, { recursive: true });
  const result = config ? simulate(JSON.parse(readFileSync(config, 'utf8'))) : runResearch();
  writeFileSync(join(out, '7-economy-digging-v2.1-results.json'), JSON.stringify(result, null, 2) + '\n');
  if (!config) {
    const rows = result.scenarios.flatMap(r => r.transactions.map(t => ({ scenario: r.name, ...t }))), keys = Object.keys(rows[0]);
    writeFileSync(join(out, '7-economy-digging-v2.1-purchases.csv'), [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k])).join(','))].join('\n') + '\n');
    console.log(JSON.stringify({ scenarios: result.scenarios.length, productivity: result.throughput.length, visitorWindows: result.visitorWindows.length,
      main: result.scenarios.slice(0, 18).map(({ name, minutes, waitMinutes, coins, pending, playerHits, helperCellShare }) => ({ name, minutes, waitMinutes, coins, pending, playerHits, helperCellShare })) }, null, 2));
  } else console.log(JSON.stringify(result, null, 2));
}
