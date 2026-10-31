// node scripts/check-visitors.mjs <Playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { PURCHASE_QA_KEY } from '../src/persistence/museum-save.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITES } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { parseUpgradeSave } from '../src/persistence/upgrade-save.ts';
import { arriveVisitor } from '../src/game/visitors.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { CASHIER_STATION, CASH_PILE, VISITOR_DOOR, queuePoint } from '../src/content/visitors.ts';
import { purchaseDefinition } from '../src/content/purchases.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const shot = name => page.screenshot({ path: `docs/qa/${process.argv[4] || 'visitors'}-${name}.png` });
async function labelsClear() {
  const a = await page.locator('.entrance-label').boundingBox(), b = await page.locator('.cashier-label').boundingBox();
  assert.ok(a && b);
  assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
    'entrance and cashier labels must not overlap');
}
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0]; window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
    window.qaScene = () => engine.scenes[0]; delete document.hidden;
  });
  await page.bringToFront(); await page.locator('.stage > canvas').focus();
}
const ticks = count => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, count);
const position = () => page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
const visitorPositions = () => page.evaluate(() => window.qaScene().transformNodes.filter(n => /^visitor-\d+$/.test(n.name)).map(n => ({ id: n.name, p: n.position.asArray() })));
const visibleCoins = () => page.evaluate(() => window.qaScene().meshes.filter(m => m.name === 'ticket-coin' && m.isEnabled()).length);
async function seed(save) {
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]);
  await page.reload(); await ready(); await ticks(1);
}
async function walkTo(target) {
  await page.locator('.stage > canvas').focus();
  for (let i = 0; i < 180; i++) {
    const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.18) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1);
    const h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.04, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.04, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Cannot reach ${JSON.stringify(target)} from ${JSON.stringify(await position())}`);
}
async function station() { await walkTo({ x: CASHIER_STATION.x, z: 1.6 }); await walkTo(CASHIER_STATION); }
async function failWrites(fail) {
  await page.evaluate(fail => {
    window.qaSet ??= Storage.prototype.setItem; window.qaFail = fail;
    Storage.prototype.setItem = function(key, value) { if (window.qaFail) throw Error('QA quota'); return window.qaSet.call(this, key, value); };
  }, fail);
}
function fixture(displays = 1) {
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITES.flatMap(s => s.cells.map(c => [c.id, 1]))),
    collected: SITES.flatMap(s => [...s.requiredDiscoveryIds]), closedSites: SITES.map(s => s.id),
    placed: EXHIBITS.slice(0, displays).flatMap(e => [...e.parts]) }, 42);
  return parseUpgradeSave(JSON.stringify(old), 42);
}
try {
  await page.goto(process.argv[3]); await ready(); await ticks(1000);
  assert.equal((await saved()).version, 19); assert.equal((await saved()).visitors.nextId, 1);
  assert.equal(await page.locator('#ticket-price').innerText(), '0'); assert.equal(await page.locator('.purchase-qa').count(), 0);
  assert.equal(await visibleCoins(), 0);
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`fresh-${width}`);
    await labelsClear();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const b = await page.locator('.cashier-label').boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= width && b.y >= 0 && b.y + b.height <= height);
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await seed(fixture(1));
  await ticks(1000); let full = await saved(); assert.equal(full.visitors.visits.length, 3); assert.equal(full.economy.coins, 20);
  for (const [i, visitor] of (await visitorPositions()).entries()) {
    const target = queuePoint(i); assert.ok(Math.hypot(visitor.p[0] - target.x, visitor.p[2] - target.z) < 0.02);
  }
  await shot('queue'); await ticks(500); assert.deepEqual(await saved(), full);
  // Blocking activities, hidden pages and lost focus preserve queue, movement and income.
  await page.locator('#bag-button').click(); const still = await visitorPositions(); await ticks(500);
  assert.deepEqual(await saved(), full); assert.deepEqual(await visitorPositions(), still); await page.locator('#activity-close').click();
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true })); await ticks(500);
  assert.deepEqual(await saved(), full); await page.evaluate(() => { delete document.hidden; Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }); });
  await ticks(500); assert.deepEqual(await saved(), full); await page.evaluate(() => { delete document.hasFocus; });
  // Restored unpaid people start at safe queue slots; service takes a second.
  await seed(arriveVisitor(arriveVisitor(arriveVisitor(fixture(1))))); await station();
  const before = await saved(); assert.equal(before.economy.coins, 20);
  await failWrites(true); await ticks(30); assert.deepEqual(await saved(), before);
  assert.equal(await visibleCoins(), 0, 'failed payments cannot grow the pile');
  assert.equal(await page.locator('#retry-save').isVisible(), true); await shot('payment-failure');
  const frozen = await visitorPositions(); await ticks(400); assert.deepEqual(await visitorPositions(), frozen);
  await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); }); await ticks(1);
  let paid = await saved(); assert.equal(paid.economy.coins, 22); assert.deepEqual(paid.visitors.sales, [1, 0, 0]); await shot('first-payment');
  assert.equal(await visibleCoins(), 2);
  await page.reload(); await ready(); assert.equal((await saved()).economy.coins, 22);
  await ticks(1); assert.equal(await visibleCoins(), 2, 'saved ticket income restores the pile');
  assert.equal((await saved()).visitors.visits.length, 2); assert.ok((await saved()).visitors.visits.every(v => !v.paid));
  await station(); await ticks(20); paid = await saved(); assert.ok(paid.economy.coins > 22);
  await page.locator('#open-map').click(); await ticks(500); assert.deepEqual(await saved(), paid);
  await page.locator('[data-travel="courtyard-dig"]').click(); await ticks(500);
  assert.equal((await saved()).economy.coins, paid.economy.coins); assert.ok((await saved()).visitors.visits.every(v => !v.paid));
  assert.equal(await page.locator('#cashier-panel').isHidden(), true);
  await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click(); await ticks(1);
  assert.equal(await visibleCoins(), Math.min(CASH_PILE.maxCoins, paid.visitors.sales.reduce((sum, n, i) => sum + n * (i + 2), 0)));
  // A new complete display changes the derived price once; opening its story again does not.
  await seed(fixture(1)); await page.locator('#exhibit-trilobite').click();
  await page.locator('[data-group="trilobite-whole"]').click(); await page.locator('[data-target="trilobite-whole"]').click(); await ticks(1);
  assert.equal(await page.locator('#ticket-price').innerText(), '3'); await page.locator('#activity-close').click(); await ticks(1); await shot('price-increase');
  await page.locator('#exhibit-trilobite').click(); await ticks(300); assert.equal(await page.locator('#ticket-price').innerText(), '3');
  await page.locator('#activity-close').click();
  // A populated full hall, tours and the six-person cap under sustained service.
  await seed(fixture(3)); await station(); await ticks(1500);
  assert.ok((await saved()).visitors.sales[2] >= 5); assert.ok((await saved()).visitors.visits.length <= 6);
  assert.ok(!(await saved()).visitors.visits.some(v => v.id === 1));
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`tour-${width}`);
    await labelsClear();
  }
  assert.ok(parseUpgradeSave(JSON.stringify(await saved()), 42));
  // Render the final bounded pile, and then the compact hall's entrance/queue.
  await ticks(1200); assert.equal(await visibleCoins(), CASH_PILE.maxCoins);
  await page.setViewportSize({ width: 1440, height: 1000 }); await ticks(1); await shot('full-pile');
  const compact = fixture(1);
  compact.museum.owned = compact.museum.owned.filter(p => p.id !== 'west-wing' && p.id !== 'stand-eryops')
    .map(p => ({ id: p.id, source: 'purchase', paid: purchaseDefinition(p.id).cost }));
  compact.economy.coins -= compact.museum.owned.reduce((sum, p) => sum + p.paid, 0);
  assert.ok(parseUpgradeSave(JSON.stringify(compact), 42));
  await seed(compact); await ticks(240); await ticks(1);
  const firstArrival = (await visitorPositions())[0];
  assert.ok(Math.hypot(firstArrival.p[0] - VISITOR_DOOR.x, firstArrival.p[2] - VISITOR_DOOR.z) < 0.3);
  await shot('arrival'); await ticks(750);
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`compact-queue-${width}`);
    await labelsClear();
  }
  await station(); await ticks(100); assert.ok(await visibleCoins() > 0); await shot('compact-serving');
  const other = await context.newPage(); await other.goto(process.argv[3]); await other.locator('.session-blocker').waitFor(); await other.close();
  await page.bringToFront();
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
  assert.equal((await saved()).economy.coins, 20); assert.deepEqual((await saved()).visitors.sales, [0, 0, 0]);
  assert.equal((await saved()).visitors.nextId, 1); assert.deepEqual((await saved()).museum.owned, []);
  assert.equal(await visibleCoins(), 0, 'reset removes the pile');
  const normal = await saved(); await page.goto(new URL('?purchases=1', process.argv[3]).href); await ready();
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, PURCHASE_QA_KEY), 19);
  assert.deepEqual(await saved(), normal); assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; attended tickets, display pricing, arrivals/caps/tours, real keyboard desk access, pause/focus/hidden, failed payment/retry/reload/travel, reset, writer lock and QA isolation; 1440x1000, 1280x720, 390x844.`);
} catch (error) { await shot('failure'); console.log('Current visitors:', (await saved())?.visitors); throw error; }
finally { await browser.close(); }
