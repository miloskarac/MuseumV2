// Research only. No production mutations, browser storage or save parsing.
// node scripts/simulate-economy-v2.mjs [--out <directory>] [--config <json file>]
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VISITORS } from '../src/content/visitors.ts';
import { VISITORS as HISTORICAL_VISITORS } from '../src/persistence/contracts/progression-v22.ts';
import { PERMIAN_EXHIBITS } from '../src/content/permian-museum.ts';
import { coinOutcome } from '../src/game/economy.ts';

export const PRICES = {
  30: { large: [12, 16, 20, 26, 34, 45, 58, 75], small: [8, 10, 14, 18, 23, 30, 39, 50, 65] },
  ...Object.fromEntries([25, 35].map(g => [g, {
    large: Array.from({ length: 8 }, (_, i) => Math.round(12 * (1 + g / 100) ** i)),
    small: Array.from({ length: 9 }, (_, i) => Math.round(8 * (1 + g / 100) ** i)),
  }])),
};
export const STYLES = {
  active: { large: 180, small: 90, travel: 30, assembly: 30, explore: 12, desk: 20, every: 1, collectEvery: 1, gap: 15 },
  typical: { large: 300, small: 150, travel: 45, assembly: 60, explore: 25, desk: 12, every: 2, collectEvery: 1, gap: 45 },
  distracted: { large: 480, small: 240, travel: 60, assembly: 120, explore: 60, desk: 6, every: 3, collectEvery: 2, gap: 120 },
};
export const CONFIGS = {
  fast: { sites: [12, 18, 24, 30, 36, 42, 48, 54, 60], rooms: [50, 120] },
  balanced: { sites: [20, 30, 40, 50, 60, 75, 90, 105, 120], rooms: [90, 240] },
  slow: { sites: [30, 45, 60, 75, 90, 110, 135, 160, 185], rooms: [160, 400] },
};
export const VISITOR_VARIANTS = {
  baseline: { capacity: HISTORICAL_VISITORS.capacity, queue: HISTORICAL_VISITORS.queueCapacity, arrivals: [...VISITORS.arrivalSeconds] },
  smaller: { capacity: 4, queue: 2, arrivals: [15, 12, 10] },
  larger: { capacity: 10, queue: 5, arrivals: [12, 10, 8] },
  totalOnly: { capacity: 10, queue: 3, arrivals: [12, 10, 8] },
  queueOnly: { capacity: 6, queue: 5, arrivals: [12, 10, 8] },
  faster: { capacity: 6, queue: 3, arrivals: [8, 6, 5] },
  slower: { capacity: 6, queue: 3, arrivals: [16, 14, 12] },
};
export const SITE_BLOCKS = {
  6: [0, 2, 4, 7, 10, 14], 8: [0, 2, 4, 6, 8, 10, 12, 15], 10: [0, 2, 3, 4, 6, 8, 10, 12, 14, 16],
};
const ORDER = ['dimetrodon', 'trilobite', 'eryops', 'walchia',
  'moschops', 'arthropleura', 'estemmenosuchus', 'glossopteris', 'edaphosaurus', 'captorhinus',
  'gorgonops', 'helicoprion', 'scutosaurus', 'gorgonops-tooth', 'inostrancevia', 'dicynodon', 'permian-ammonoid'];
const SIZE = Object.fromEntries(PERMIAN_EXHIBITS.map(e => [e.id, e.size]));
const DT = 0.05;
const round = n => Math.round(n * 100) / 100;
export function displayPrice(displays, base = 0) {
  const valid = displays.filter(d => d.complete && d.ownedStand && d.displayed && d.ownedRoom && SIZE[d.id]);
  return valid.length ? base + [...new Set(valid.map(d => d.id))].reduce((n, id) => n + (SIZE[id] === 'large' ? 4 : 2), 0) : 0;
}

// Bounded aggregate visitor model: same arrival/service/cap rules, with explicit
// travel/tour duration assumptions in place of unbuilt 17-exhibit navigation.
export class Visitors {
  constructor(config = VISITOR_VARIANTS.baseline, tour = 28) {
    this.config = config; this.tour = tour; this.queue = []; this.paid = [];
    this.arrival = 0; this.service = 0; this.shift = 0; this.sold = 0; this.income = 0;
    this.pending = 0; this.maxPeople = 0; this.maxQueue = 0;
  }
  travel() { this.paid = []; this.queue.fill(0); this.arrival = this.service = this.shift = 0; }
  step(price, count, attended) {
    this.queue = this.queue.map(t => Math.max(0, t - DT)); this.shift = Math.max(0, this.shift - DT);
    this.paid = this.paid.map(t => t - DT);
    const finished = this.paid.findIndex(t => t <= 0);
    if (finished >= 0) { this.paid.splice(finished, 1); return 0; }
    this.service = attended && this.queue.length && this.queue[0] <= 1e-9 && this.shift <= 1e-9 ? this.service + DT : 0;
    if (price && this.service + 1e-9 >= VISITORS.serviceSeconds) {
      this.queue.shift(); this.paid.push(this.tour); this.shift = 0.9 / VISITORS.speed;
      this.service = 0; this.sold++; this.income += price; this.pending += price; return price;
    }
    if (!price || this.queue.length >= this.config.queue || this.queue.length + this.paid.length >= this.config.capacity) {
      this.arrival = 0; return 0;
    }
    this.arrival += DT;
    if (this.arrival + 1e-9 >= this.config.arrivals[Math.min(2, Math.max(0, count - 1))]) {
      this.arrival = 0; this.queue.push(2); // Assumed door-to-queue travel seconds.
      this.maxQueue = Math.max(this.maxQueue, this.queue.length);
      this.maxPeople = Math.max(this.maxPeople, this.queue.length + this.paid.length);
    }
    return 0;
  }
  collect() { const value = this.pending; this.pending = 0; return value; }
}

export function simulate(options = {}) {
  const { style = 'typical', pricing = 'balanced', growth = 30, visitors = 'baseline', siteCount = 8,
    fixedSiteBudget = false, base = 0, soilSeed = null, optional = false, tour = 28, smallFirst = false,
    collectEvery = STYLES[style].collectEvery, roomCosts = null } = options;
  const timing = STYLES[style], costs = CONFIGS[pricing], visitor = new Visitors(VISITOR_VARIANTS[visitors], tour);
  if (!timing || !costs || !PRICES[growth] || !SITE_BLOCKS[siteCount] || !Number.isInteger(collectEvery) || collectEvery < 1) throw Error('Invalid scenario');
  const expansionCosts = roomCosts ?? costs.rooms;
  if (expansionCosts.length !== 2 || expansionCosts.some(n => !Number.isSafeInteger(n) || n < 0)) throw Error('Invalid room costs');
  const order = [...ORDER]; if (smallFirst) [order[0], order[1]] = [order[1], order[0]];
  let sitePrices = costs.sites.slice(0, siteCount - 1);
  if (fixedSiteBudget) {
    const budget = costs.sites.slice(0, 7).reduce((a, b) => a + b, 0), total = sitePrices.reduce((a, b) => a + b, 0);
    sitePrices = sitePrices.map(p => Math.round(p * budget / total));
    sitePrices[sitePrices.length - 1] += budget - sitePrices.reduce((a, b) => a + b, 0);
  }
  const displays = [], transactions = [], rooms = [], displayEvents = [], salesByPrice = {};
  const spending = { stand: 0, site: 0, room: 0, optional: 0 };
  const standIndex = { large: 0, small: 0 };
  let coins = 20, seconds = 0, deskSeconds = 0, extraWait = 0, visits = 0, soil = 0, previousRoomTime = 0;
  function elapsed(duration, mode = 'paused') {
    const steps = Math.round(duration / DT); seconds += steps * DT;
    if (mode === 'paused') return;
    if (mode === 'desk') deskSeconds += steps * DT;
    for (let i = 0; i < steps; i++) {
      const income = visitor.step(displayPrice(displays, base), displays.length, mode === 'desk');
      if (income) salesByPrice[income] = (salesByPrice[income] ?? 0) + 1;
    }
  }
  function desk() {
    visits++; elapsed(timing.desk, 'desk');
    if (visits % collectEvery === 0) coins += visitor.collect();
  }
  function buy(kind, id, cost) {
    const before = coins, pendingBefore = visitor.pending, start = seconds, soldBefore = visitor.sold, visitsBefore = visits;
    const price = displayPrice(displays, base);
    if (coins < cost && !price) throw Error(`Deadlock before first display: ${id}`);
    let cycles = 0;
    while (coins < cost) {
      if (++cycles > 200) throw Error(`Unfundable ${id}`);
      desk(); if (coins < cost) elapsed(timing.gap, 'museum');
    }
    const waited = seconds - start; extraWait += waited;
    coins -= cost; spending[kind] += cost;
    transactions.push({ kind, id, cost, price, before, pendingBefore, after: coins, pendingAfter: visitor.pending,
      minute: round(seconds / 60), waitSeconds: round(waited), ticketsDuringWait: visitor.sold - soldBefore,
      extraDeskVisits: visits - visitsBefore, priceCoversFullCost: price >= cost && price > 0 });
    elapsed(3); // Purchase/menu interaction: no visitor progress.
  }
  for (let index = 0; index < order.length; index++) {
    const id = order[index], size = SIZE[id];
    if (index === 4 || index === 10) buy('room', `room-${index === 4 ? 2 : 3}`, expansionCosts[index === 4 ? 0 : 1]);
    const block = SITE_BLOCKS[siteCount].indexOf(index);
    if (block > 0) buy('site', `abstract-access-${block + 1}`, sitePrices[block - 1]);
    if (index === 4 && optional) for (const [name, cost] of [['boots', 16], ['shovel', 24], ['helper', 60], ['helper-tools', 30]]) buy('optional', name, cost);
    visitor.travel(); elapsed(timing[size] + timing.travel); // No arrivals or sales while away.
    if (soilSeed !== null) {
      const reward = Array.from({ length: size === 'large' ? 16 : 8 }, (_, unit) => coinOutcome(soilSeed, `simulation/${id}/${unit}`)).reduce((a, b) => a + b, 0);
      soil += reward; coins += reward;
    }
    buy('stand', id, PRICES[growth][size][standIndex[size]++]);
    elapsed(timing.assembly);
    displays.push({ id, complete: true, ownedStand: true, displayed: true, ownedRoom: true });
    elapsed(timing.explore, 'museum');
    if ((index + 1) % timing.every === 0) desk();
    displayEvents.push({ count: index + 1, id, price: displayPrice(displays, base), minute: round(seconds / 60), coins, pending: visitor.pending });
    if ([3, 9, 16].includes(index)) {
      rooms.push({ room: rooms.length + 1, minute: round(seconds / 60), durationMinutes: round((seconds - previousRoomTime) / 60),
        coins, pending: visitor.pending, income: visitor.income, price: displayPrice(displays, base) });
      previousRoomTime = seconds;
    }
  }
  const spent = Object.values(spending).reduce((a, b) => a + b, 0);
  if (coins + visitor.pending + spent !== 20 + soil + visitor.income) throw Error('Conservation failure');
  return { options: { style, pricing, growth, visitors, siteCount, fixedSiteBudget, base, soilSeed, optional, tour, smallFirst, collectEvery, roomCosts },
    minutes: round(seconds / 60), extraWaitMinutes: round(extraWait / 60), maxWaitSeconds: Math.max(...transactions.map(t => t.waitSeconds)),
    deskMinutes: round(deskSeconds / 60), deskVisits: visits, tickets: visitor.sold, income: visitor.income,
    incomePerActiveMinute: round(visitor.income * 60 / seconds), incomePerDeskMinute: round(visitor.income * 60 / deskSeconds),
    meanTicket: round(visitor.income / visitor.sold), coins, pending: visitor.pending, soil, spending, rooms, transactions, displayEvents, salesByPrice,
    singleTicketPurchases: transactions.filter(t => t.priceCoversFullCost).length, maxQueue: visitor.maxQueue, maxPeople: visitor.maxPeople };
}

// Exhaust all legal early room-1 whole-purchase orders. Free-site content is
// explicitly assumed to support Dimetrodon and trilobite, not other fossils.
export function earlyOrders({ available = ['dimetrodon', 'eryops', 'trilobite', 'walchia'],
  free = ['dimetrodon', 'trilobite'] } = {}) {
  const ids = ['dimetrodon', 'eryops', 'trilobite', 'walchia'], paths = [], states = new Set();
  function walk(owned, coins, path, l, s) {
    states.add([...owned].sort().join(','));
    const legal = available.filter(id => !owned.includes(id) && coins >= PRICES[30][SIZE[id]][SIZE[id] === 'large' ? l : s]);
    if (!legal.length) { paths.push({ path, coins, viable: free.some(id => owned.includes(id)) }); return; }
    for (const id of legal) walk([...owned, id], coins - PRICES[30][SIZE[id]][SIZE[id] === 'large' ? l : s], [...path, id], l + (SIZE[id] === 'large'), s + (SIZE[id] === 'small'));
  }
  walk([], 20, [], 0, 0);
  // Contribution experiment locks each type's global price on first coin. This
  // quoting rule is an assumption, since the proposed purchase API is undefined.
  const seen = new Set(), queue = [{ paid: [0, 0, 0, 0], quoted: [0, 0, 0, 0] }];
  let strandedFreePair = 0, strandedEvenAllFree = 0, terminal = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor], { paid, quoted } = state, coins = 20 - paid.reduce((a, b) => a + b, 0);
    const nextPrice = i => PRICES[30][i < 2 ? 'large' : 'small'][quoted.slice(i < 2 ? 0 : 2, i < 2 ? 2 : 4).filter(Boolean).length];
    const canFinish = i => paid[i] + coins >= (quoted[i] || nextPrice(i));
    if (!ids.some((id, i) => available.includes(id) && free.includes(id) && canFinish(i))) strandedFreePair++;
    if (!ids.some((id, i) => available.includes(id) && canFinish(i))) strandedEvenAllFree++;
    if (!coins) { terminal++; continue; }
    for (let i = 0; i < 4; i++) {
      if (!available.includes(ids[i])) continue;
      if (quoted[i] && paid[i] === quoted[i]) continue;
      const next = { paid: [...paid], quoted: [...quoted] };
      if (!next.quoted[i]) next.quoted[i] = nextPrice(i);
      next.paid[i]++;
      const key = next.paid.join(',') + '/' + next.quoted.join(',');
      if (!seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return { wholePurchaseStates: states.size, terminalOrders: paths.length, deadOrders: paths.filter(p => !p.viable), paths,
    contributionStates: queue.length, strandedFreePair, strandedEvenAllFree, terminalContributionStates: terminal,
    example: { paid: [6, 6, 4, 4], quoted: [12, 16, 8, 10], coins: 0 } };
}

export function earningWindow(style, tier, visitors = 'baseline', minutes = 120) {
  const timing = STYLES[style], v = new Visitors(VISITOR_VARIANTS[visitors]);
  let time = 0, bouts = 0, coins = 0, exhibit = 0;
  const [count, price] = tier;
  function run(seconds, mode) { for (let i = 0; i < Math.round(seconds / DT) && time < minutes * 60 - 1e-8; i++) {
    time += DT; if (mode !== 'paused') v.step(price, count, mode === 'desk');
  } }
  while (time < minutes * 60 - 1e-8) {
    v.travel(); run((exhibit % 2 ? timing.small : timing.large) + timing.travel + timing.assembly, 'paused');
    run(timing.explore, 'museum');
    if (++exhibit % timing.every === 0) { run(timing.desk, 'desk'); if (++bouts % timing.collectEvery === 0) coins += v.collect(); }
  }
  return { style, visitors, count, price, minutes, tickets: v.sold, income: v.income, collected: coins, pending: v.pending,
    perMinute: round(v.income / minutes) };
}

export function runResearch() {
  const matrix = [];
  for (const pricing of Object.keys(CONFIGS)) for (const style of Object.keys(STYLES)) for (const growth of [25, 30, 35]) matrix.push(simulate({ pricing, style, growth }));
  const visitorSensitivity = Object.keys(STYLES).flatMap(style => Object.keys(VISITOR_VARIANTS).map(visitors => simulate({ style, visitors })));
  const siteSensitivity = [6, 8, 10].flatMap(siteCount => [false, true].map(fixedSiteBudget => simulate({ siteCount, fixedSiteBudget })));
  const timingSensitivity = Object.keys(STYLES).flatMap(style => [14, 56].map(tour => simulate({ style, tour })));
  const otherSensitivity = Object.keys(STYLES).flatMap(style => [
    simulate({ style, base: 1 }), simulate({ style, smallFirst: true }), simulate({ style, optional: true }), simulate({ style, roomCosts: [90, 300] }),
    ...[0, 1, 42].map(soilSeed => simulate({ style, soilSeed })),
  ]);
  otherSensitivity.push(simulate({ style: 'distracted', collectEvery: 1 }));
  return { modelVersion: 1, assumptions: { step: DT, tour: 28, entryWalk: 2, queueShift: 0.9 / VISITORS.speed,
    styles: STYLES, prices: PRICES, costs: CONFIGS, visitors: VISITOR_VARIANTS, siteBlocks: SITE_BLOCKS,
    productionServiceSeconds: VISITORS.serviceSeconds, mainSoilRewards: 0, historicalCredit: 0 },
    matrix, visitorSensitivity, siteSensitivity, timingSensitivity, otherSensitivity, early: earlyOrders(),
    earlyRestricted: earlyOrders({ available: ['dimetrodon', 'trilobite'] }),
    earningWindows: Object.keys(STYLES).flatMap(style => [[1, 4], [4, 12], [10, 30], [17, 50]].map(tier => earningWindow(style, tier))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]; };
  const out = resolve(arg('--out') ?? 'docs/phase7'); mkdirSync(out, { recursive: true });
  const custom = arg('--config');
  const result = custom ? simulate(JSON.parse(readFileSync(custom, 'utf8'))) : runResearch();
  writeFileSync(join(out, '7-economy-v2-results.json'), JSON.stringify(result, null, 2) + '\n');
  if (!custom) {
    const rows = result.matrix.filter(r => r.options.growth === 30).flatMap(r => r.transactions.map(t => ({ style: r.options.style, pricing: r.options.pricing, ...t })));
    const fields = Object.keys(rows[0]);
    writeFileSync(join(out, '7-economy-v2-purchases.csv'), [fields.join(','), ...rows.map(r => fields.map(k => JSON.stringify(r[k])).join(','))].join('\n') + '\n');
    console.log(JSON.stringify(result.matrix.filter(r => r.options.growth === 30).map(({ options, minutes, extraWaitMinutes, maxWaitSeconds, income, coins, pending, spending }) => ({ ...options, minutes, extraWaitMinutes, maxWaitSeconds, income, coins, pending, spending })), null, 2));
    console.log(JSON.stringify({ early: result.early, scenarios: result.matrix.length + result.visitorSensitivity.length + result.siteSensitivity.length + result.timingSensitivity.length + result.otherSensitivity.length }, null, 2));
  } else console.log(JSON.stringify(result, null, 2));
}
