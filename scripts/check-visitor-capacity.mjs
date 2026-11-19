// Disposable Edge only. Synthetic recovered fossils; the full/full stress
// slice extends viewing dwell in this browser instance, without changing files.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { parseMvpSave } from '../src/persistence/mvp-save.ts';
import { buyPurchase } from '../src/game/purchases.ts';
import { buySite } from '../src/game/world-map.ts';
import { arriveVisitor } from '../src/game/visitors.ts';
import { visitorCounts } from '../src/game/visitor-capacity.ts';
import { mvpRecoveredFirst, mvpDisplay, mvpSale, mvpRecoverEryops } from '../tests/helpers/mvp-fixture.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { CASHIER_STATION, CASH_PILE } from '../src/content/visitors.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const counts = async () => visitorCounts((await saved()).visitors.visits);
const ticks = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, n);
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
async function seed(save) {
  assert.ok(parseMvpSave(JSON.stringify(save), 42));
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]);
  await page.reload(); await ready(); await ticks(1);
}
async function capture(name) {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1);
    await page.screenshot({ path: `docs/qa/capacity-${name}-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function walkTo(target) {
  await page.locator('.stage > canvas').focus();
  for (let i = 0; i < 200; i++) {
    const p = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.18) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1), h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.04, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.04, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  throw Error('Cannot reach cashier');
}
async function checkPoses() {
  assert.deepEqual(await page.evaluate(async key => {
    const { visitorWalkable } = await import('/src/game/visitor-simulation.ts');
    const { museumLayout } = await import('/src/game/museum-layout.ts');
    const layout = museumLayout(JSON.parse(localStorage.getItem(key)));
    return window.qaScene().transformNodes.filter(n => /^visitor-\d+$/.test(n.name))
      .filter(n => !visitorWalkable({ x: n.position.x, z: n.position.z }, layout)).map(n => n.name);
  }, SAVE_KEY), []);
}
try {
  await page.goto(process.argv[3]); await ready(); await capture('fresh');
  let first = mvpDisplay(buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon'), 'dimetrodon');
  await seed(first); await ticks(1700); assert.deepEqual(await counts(), { waiting: 6, admitted: 0 });
  assert.equal((await saved()).pendingTicketRevenue, 0); await checkPoses(); await capture('six-waiting');
  const fullQueue = await saved(); await ticks(400); assert.deepEqual(await saved(), fullQueue);
  // Production arrival/service intervals stay unchanged. Only this stress
  // slice uses longer viewing so 6 paid visitors and 6 new arrivals coexist.
  let all = mvpDisplay(buyPurchase(first, 'stand-trilobite'), 'trilobite');
  for (let i = 0; i < 6; i++) all = mvpSale(all);
  all = mvpDisplay(mvpRecoverEryops(buySite(buyPurchase(all, 'stand-eryops'), 'eryops-dig')), 'eryops');
  for (let i = 0; i < 6; i++) all = arriveVisitor(all);
  await seed(all);
  await page.evaluate(async () => {
    // Follow Vite's exact import URL, including an HMR timestamp if present.
    const source = await (await fetch('/src/game/visitor-simulation.ts')).text();
    const url = source.match(/from "([^"]*content\/visitors[^\"]*)"/)[1];
    (await import(url)).VISITORS.viewingSeconds = 60;
  });
  await walkTo({ x: CASHIER_STATION.x, z: 1.6 }); await walkTo(CASHIER_STATION);
  // Failed durable first admission: no sale or reservation until explicit retry.
  const before = await saved();
  await page.evaluate(() => { window.qaSet = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw Error('QA quota'); }; });
  await ticks(22); assert.deepEqual(await saved(), before);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaSet; });
  await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); }); await ticks(1);
  assert.equal((await saved()).pendingTicketRevenue, 10);
  for (let i = 0; i < 400 && (await counts()).admitted < 6; i++) await ticks(2);
  assert.equal((await counts()).admitted, 6); assert.equal((await saved()).pendingTicketRevenue, 60);
  await capture('six-admitted');
  for (let i = 0; i < 40 && (await counts()).waiting < 6; i++) { await ticks(40); await checkPoses(); }
  assert.deepEqual(await counts(), { waiting: 6, admitted: 6 });
  assert.match(await page.locator('#cashier-hint').innerText(), /Музеј је пун/);
  assert.match(await page.locator('#visitor-count').innerText(), /6\/6.*6\/6/);
  const full = await saved(); await ticks(20); assert.deepEqual(await saved(), full); await capture('full-queue-and-museum');
  // Follow actual movement to the door; admission stays reserved until exit.
  let exited = null;
  for (let i = 0; i < 3200; i++) {
    const previous = await saved(); await ticks(1); const now = await saved();
    exited = previous.visitors.visits.find(v => v.paid && !now.visitors.visits.some(n => n.id === v.id));
    if (exited) {
      const atDoor = await page.evaluate(id => {
        const p = window.qaScene().getTransformNodeByName(`visitor-${id}`).position;
        return Math.hypot(p.x - 3.8, p.z + 5.3) < 0.02;
      }, exited.id);
      assert.ok(atDoor); assert.equal(visitorCounts(now.visitors.visits).admitted, 5); break;
    }
  }
  assert.ok(exited); const afterExit = await saved();
  await ticks(19); assert.equal((await saved()).pendingTicketRevenue, afterExit.pendingTicketRevenue);
  await ticks(1); assert.equal((await saved()).pendingTicketRevenue, afterExit.pendingTicketRevenue + 10);
  await capture('admitted-after-exit');
  await page.setViewportSize({ width: 390, height: 844 });
  await walkTo({ x: CASHIER_STATION.x, z: 0.3 });
  const cash = await saved(); await walkTo({ x: CASH_PILE.x, z: 0.3 });
  await walkTo({ x: CASH_PILE.x, z: CASH_PILE.z + 0.85 }); await ticks(1);
  assert.equal((await saved()).economy.coins, cash.economy.coins + cash.pendingTicketRevenue);
  assert.equal((await saved()).pendingTicketRevenue, 0);
  const collected = await saved(); await page.reload(); await ready(); await ticks(1);
  assert.equal((await counts()).admitted, 0); assert.equal((await counts()).waiting, visitorCounts(collected.visitors.visits).waiting);
  assert.deepEqual((await saved()).visitors.sales, collected.visitors.sales); assert.equal((await saved()).economy.coins, collected.economy.coins);
  await page.locator('#open-map').tap(); await page.locator('[data-travel="courtyard-dig"]').tap();
  await page.locator('#open-map').tap(); await page.locator('[data-travel="hub"]').tap(); await ticks(1);
  assert.deepEqual((await saved()).visitors.sales, collected.visitors.sales); await checkPoses(); await capture('reload-and-travel');
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
  assert.deepEqual(await counts(), { waiting: 0, admitted: 0 }); assert.equal((await saved()).economy.coins, 20);
  assert.deepEqual(errors, []);
  console.log(`PASS: fresh, six waiting, six admitted, full+partial/full queue, blocked payment, physical exit and timed readmission, retry, proximity collection, reload/travel/reset; Edge ${browser.version()}, 1440x1000 and 390x844. Synthetic fossils and 60-second stress dwell; normal arrival/service timing.`);
} catch (error) {
  await page.screenshot({ path: 'docs/qa/capacity-failure.png' }); throw error;
} finally { await context.close(); await browser.close(); }
