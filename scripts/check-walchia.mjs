// Disposable Edge contexts and synthetic site-recovery slices only.
// Args: existing Playwright index.mjs, Vite URL.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { parseRoom1Game } from '../src/persistence/room1-game-save.ts';
import { migrateRoom1Game } from '../src/game/room1-economy.ts';
import { ERYOPS_SITE, ROOM1_ERYOPS_SITE } from '../src/content/journey.ts';
import { room1Complete } from '../src/game/mvp-progression.ts';
import { ownedPermianRoomIds } from '../src/game/room-ownership.ts';
import { buyPurchase, advanceMuseum, museumJourney } from '../src/game/purchases.ts';
import { mvpRecoveredFirst } from '../tests/helpers/mvp-fixture.ts';
import { ROOM1_EXHIBITS as EXHIBITS } from '../src/content/exhibit.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { CASHIER_STATION, CASH_PILE } from '../src/content/visitors.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const shot = name => page.screenshot({ path: `docs/qa/walchia-${name}.png` });
const ticks = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, n);
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  assert.equal((await saved()).version, 26);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0]; window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
    window.qaScene = () => engine.scenes[0]; delete document.hidden;
  });
  await page.bringToFront(); await page.locator('.stage > canvas').focus();
}
async function seed(save) {
  assert.ok(parseRoom1Game(JSON.stringify(save), 42));
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]);
  await page.reload(); await ready(); await ticks(1);
}
async function walkTo(target, tolerance = 0.18) {
  await page.locator('.stage > canvas').focus();
  for (let i = 0; i < 200; i++) {
    const p = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < tolerance) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1), h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.04, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.04, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  const actual = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
  throw Error(`Cannot reach ${JSON.stringify(target)} from ${JSON.stringify(actual)}`);
}
async function failWrites(fail) {
  await page.evaluate(fail => {
    window.qaSet ??= Storage.prototype.setItem; window.qaFail = fail;
    Storage.prototype.setItem = function(k, v) { if (window.qaFail) throw Error('QA quota'); return window.qaSet.call(this, k, v); };
  }, fail);
}
async function buy(id) { await page.locator(`[data-purchase="${id}"]`).click(); await page.locator('#buy-purchase').click(); await ticks(1); }
async function assemble(id) {
  if (!await page.locator('dialog').evaluate(d => d.open)) await page.locator(id === 'dimetrodon' ? '#exhibit-button' : `#exhibit-${id}`).click();
  for (const group of EXHIBITS.find(e => e.id === id).parts) {
    await page.locator(`[data-group="${group}"]`).click(); await page.locator(`[data-target="${group}"]`).click();
  }
  await page.locator('#activity-close').click(); await ticks(1);
}
async function capture(name) {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`${name}-${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await page.goto(process.argv[3]); await ready();
  assert.equal((await saved()).economy.coins, 20);
  assert.equal(await page.locator('.purchase-marker:visible').count(), 1);
  await capture('fresh');
  await buy('stand-dimetrodon'); assert.equal((await saved()).economy.coins, 8);
  // Synthetic first-site recovery: all seven fossils, no extra digging coins.
  await seed(migrateRoom1Game(buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon')));
  await walkTo({ x: 4, z: 1.6 }); await walkTo({ x: 4, z: -2.45 });
  await walkTo({ x: 2, z: -2.45 }); await walkTo({ x: -1.2, z: -2.45 }, 0.85);
  await assemble('dimetrodon'); assert.equal(await page.locator('#ticket-price').innerText(), '4');
  await buy('stand-trilobite'); await assemble('trilobite');
  assert.equal(await page.locator('#ticket-price').innerText(), '6');
  await walkTo({ x: 2, z: -2.45 }); await walkTo({ x: 4, z: -2.45 }); await walkTo({ x: 4, z: 1.6 });
  await walkTo({ x: CASHIER_STATION.x, z: 1.6 }); await walkTo(CASHIER_STATION);
  for (let i = 0; i < 20 && (await saved()).pendingTicketRevenue < 48; i++) await ticks(200);
  await walkTo({ x: CASHIER_STATION.x, z: 0.3 });
  const cash = await saved(); assert.ok(cash.pendingTicketRevenue >= 48);
  await walkTo({ x: CASH_PILE.x, z: 0.3 });
  await walkTo({ x: CASH_PILE.x, z: CASH_PILE.z + 0.85 }); await ticks(1);
  assert.equal((await saved()).economy.coins, cash.economy.coins + cash.pendingTicketRevenue);
  await buy('stand-eryops');
  await page.locator('#open-map').click(); await page.locator('[data-site-buy="eryops-dig"]').click();
  await page.locator('#activity-close').click();
  assert.equal((await saved()).world.owned[0].paid, 20);
  // Synthetic Eryops recovery / prior soil work; leave Walchia's two columns
  // at the second-layer boundary. Its last eight strikes and cleaning are UI.
  const base = await saved();
  const setup = advanceMuseum(base, { ...museumJourney(base), activeSiteId: 'eryops-dig',
    dig: { ...base.dig, ...Object.fromEntries(ROOM1_ERYOPS_SITE.cells.map(c => [c.id, c.discoveryId === 'walchia-slab' ? 0.5 : 1])) },
    collected: [...base.collected, ...ERYOPS_SITE.requiredDiscoveryIds] });
  await seed(setup);
  assert.equal(await page.locator('[data-purchase="stand-walchia"]').isVisible(), false);
  await walkTo({ x: 4, z: 1.6 }); await walkTo({ x: 4, z: -2.45 });
  await walkTo({ x: -8.3, z: -2.45 }, 0.85); await assemble('eryops');
  assert.equal(await page.locator('#ticket-price').innerText(), '10');
  assert.equal(await page.locator('[data-purchase="stand-walchia"]').isVisible(), true);
  assert.equal(await page.locator('#room-completion').isVisible(), false); await capture('three-displays');
  // Real touch purchase with failed durable write and double retry.
  await page.setViewportSize({ width: 390, height: 844 }); await ticks(1);
  await page.locator('[data-purchase="stand-walchia"]').tap(); await failWrites(true);
  const beforePurchase = await saved(); await page.locator('#buy-purchase').tap();
  await page.locator('#retry-save').waitFor({ state: 'visible' });
  assert.deepEqual(await saved(), beforePurchase);
  await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).economy.coins, beforePurchase.economy.coins - 10);
  assert.deepEqual((await saved()).museum.owned.find(o => o.id === 'stand-walchia'), { id: 'stand-walchia', source: 'purchase', paid: 10 });
  await page.reload(); await ready(); assert.equal(await page.locator('#ticket-price').innerText(), '10');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click();
  await walkTo({ x: 0, z: -1.85 }, 0.15); await ticks(1);
  assert.equal((await saved()).room, 'excavation');
  const cells = ROOM1_ERYOPS_SITE.cells.filter(c => c.discoveryId === 'walchia-slab');
  for (const c of cells) {
    if (await page.locator('#cleaning-canvas').isVisible()) break;
    await walkTo(c, 0.2); await ticks(130);
  }
  await page.locator('#cleaning-canvas').waitFor({ state: 'visible' });
  assert.ok(cells.every(c => (setup.dig[c.id] === 0.5)));
  const exposed = await saved(); assert.ok(cells.every(c => exposed.dig[c.id] === 1));
  const canvas = page.locator('#cleaning-canvas'), box = await canvas.boundingBox();
  for (let y = 0.04; y < 1; y += 0.1) {
    await page.mouse.move(box.x + box.width * 0.03, box.y + box.height * y); await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.97, box.y + box.height * y, { steps: 16 }); await page.mouse.up();
  }
  assert.equal(await page.locator('#collect-fossil').isEnabled(), true); await shot('cleaning');
  await page.locator('#collect-fossil').click(); await ticks(200);
  assert.equal((await saved()).collected.filter(p => p === 'walchia-slab').length, 1);
  if (await page.locator('dialog').evaluate(d => d.open)) await page.locator('#activity-close').click();
  await ticks(200); await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click();
  await walkTo({ x: 4.4, z: 1.6 }); await walkTo({ x: 4.4, z: 2.9 });
  // Short waypoints keep quantized WASD headings inside the rear aisle.
  for (let x = 3.4; x > -13.15; x -= 1) await walkTo({ x, z: 2.9 });
  await walkTo({ x: -13.15, z: 2.9 }); await walkTo({ x: -13.15, z: 4.5 }, 0.85);
  if (!await page.locator('dialog').evaluate(d => d.open)) await page.locator('#exhibit-walchia').click();
  await page.locator('[data-group="walchia-whole"]').click();
  const beforeDisplay = await saved(); await page.locator('[data-target="walchia-whole"]').click();
  assert.equal(await page.locator('#room-completion').isVisible(), false);
  // The story may be read for longer than the celebration duration.
  await page.waitForTimeout(7300); await page.locator('#activity-close').click(); await ticks(1);
  assert.equal(await page.locator('#room-completion').isVisible(), true);
  const complete = await saved(); assert.ok(room1Complete(complete)); assert.ok(parseRoom1Game(JSON.stringify(complete), 42));
  assert.equal(complete.economy.coins, beforeDisplay.economy.coins);
  assert.equal(await page.locator('#ticket-price').innerText(), '12');
  assert.equal(await page.locator('.purchase-marker:visible').count(), 0);
  assert.deepEqual(ownedPermianRoomIds(complete.rooms), ['permian-room-1']);
  await capture('complete'); await page.locator('#room-completion button').click();
  const visible = await page.evaluate(() => window.qaScene().meshes.filter(m => m.name.startsWith('walchia-slab-fossil-') && m.isEnabled()).length);
  assert.ok(visible > 10);
  await page.reload(); await ready(); await ticks(1);
  assert.equal(await page.locator('#room-completion').isVisible(), false);
  assert.equal(await page.locator('#ticket-price').innerText(), '12');
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click();
  await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click(); await ticks(1);
  assert.equal(await page.locator('#room-completion').isVisible(), false);
  assert.equal((await saved()).placed.filter(p => p === 'walchia-whole').length, 1);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
  assert.deepEqual((await saved()).placed, []); assert.equal((await saved()).economy.coins, 20);
  assert.equal((await saved()).version, 26); assert.equal(await page.locator('#room-completion').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: four-display journey, 4/6/10/12 tickets, cash collection, touch purchase failure/double retry, real Walchia strikes/cleaning/collection/display, deferred celebration, reload/travel/reset, desktop and phone captures. First-site and Eryops recovery/prior soil synthetic.');
} catch (error) { await shot('failure'); throw error; }
finally { await context.close(); await browser.close(); }
