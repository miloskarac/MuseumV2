// Disposable Edge contexts and synthetic site-recovery slices only.
// Historical Phase 7.7B schema-25 roster. Current four-exhibit acceptance is
// check-walchia.mjs + check-77-hotfix.mjs; this retains pre-Walchia assertions.
// Args: existing Playwright index.mjs, Vite URL, optional production preview URL.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { parseMvpSave } from '../src/persistence/mvp-save.ts';
import { buyPurchase } from '../src/game/purchases.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import { mvpRecoveredFirst, mvpRecoverEryops } from '../tests/helpers/mvp-fixture.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { CASHIER_STATION, CASH_PILE } from '../src/content/visitors.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const shot = name => page.screenshot({ path: `docs/qa/mvp-${name}.png` });
const ticks = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, n);
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  assert.equal((await saved()).version, 25);
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
  throw Error(`Cannot reach ${JSON.stringify(target)}`);
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
  assert.equal(await page.locator('[data-purchase="stand-dimetrodon"]').isVisible(), true);
  await page.locator('#open-map').click(); assert.equal(await page.locator('[data-site-buy="eryops-dig"]').isDisabled(), true);
  assert.match(await page.locator('[data-map-site="eryops-dig"]').innerText(), /постоље за ериопса/);
  await page.locator('#activity-close').click(); await capture('fresh');
  await page.locator('[data-purchase="stand-dimetrodon"]').click(); await failWrites(true); await page.locator('#buy-purchase').click();
  await page.locator('#retry-save').waitFor({ state: 'visible' }); assert.equal((await saved()).economy.coins, 20);
  await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).economy.coins, 8); await page.reload(); await ready();
  assert.equal(await page.locator('.purchase-marker:visible').count(), 0);
  await page.locator('#open-map').click(); await page.locator('[data-travel="courtyard-dig"]').click();
  await shot('free-site-camp');
  // Recovering an entire pit is synthetic; actual excavation/cleaning retain unit coverage.
  await seed(buyPurchase(mvpRecoveredFirst(), 'stand-dimetrodon'));
  await walkTo({ x: 4, z: 1.6 }); await walkTo({ x: 4, z: -2.45 });
  await walkTo({ x: 2, z: -2.45 }); await walkTo({ x: -1.2, z: -2.45 }, 0.85); await assemble('dimetrodon');
  assert.equal(await page.locator('#ticket-price').innerText(), '4'); assert.equal((await saved()).economy.coins, 8);
  assert.match(await page.locator('#ticket-increase').textContent(), /\+4$/);
  assert.equal(await page.locator('[data-purchase="stand-trilobite"]').isVisible(), true);
  assert.equal(await page.locator('[data-purchase="stand-eryops"]').isVisible(), false); await capture('dimetrodon');
  await buy('stand-trilobite'); assert.equal((await saved()).economy.coins, 0);
  await assemble('trilobite'); assert.equal(await page.locator('#ticket-price').innerText(), '6');
  assert.match(await page.locator('#ticket-increase').textContent(), /\+2$/);
  await page.locator('#open-map').click(); assert.equal(await page.locator('[data-site-buy="eryops-dig"]').isDisabled(), true);
  await page.locator('#activity-close').click(); await capture('trilobite');
  await walkTo({ x: 2, z: -2.45 }); await walkTo({ x: 4, z: -2.45 }); await walkTo({ x: 4, z: 1.6 });
  await walkTo({ x: CASHIER_STATION.x, z: 1.6 }); await walkTo(CASHIER_STATION);
  for (let i = 0; i < 12 && (await saved()).pendingTicketRevenue < 36; i++) await ticks(200);
  assert.ok((await saved()).pendingTicketRevenue >= 36);
  await walkTo({ x: CASHIER_STATION.x, z: 0.3 });
  const cash = await saved(); await walkTo({ x: CASH_PILE.x, z: 0.3 });
  await walkTo({ x: CASH_PILE.x, z: CASH_PILE.z + 0.85 }); await ticks(1);
  assert.equal((await saved()).economy.coins, cash.economy.coins + cash.pendingTicketRevenue);
  await buy('stand-eryops'); assert.equal((await saved()).museum.owned.find(o => o.id === 'stand-eryops').paid, 16);
  await page.locator('#open-map').click(); const siteButton = page.locator('[data-site-buy="eryops-dig"]');
  assert.equal(await siteButton.isEnabled(), true); assert.match(await siteButton.innerText(), /20/);
  const beforeSite = await saved(); await failWrites(true); await siteButton.click();
  await page.locator('#retry-save').waitFor({ state: 'visible' }); assert.deepEqual((await saved()).world.owned, []);
  await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).economy.coins, beforeSite.economy.coins - 20);
  await page.reload(); await ready(); assert.deepEqual((await saved()).world.owned, [{ id: 'eryops-dig', source: 'purchase', paid: 20 }]);
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click(); await shot('eryops-site-camp');
  await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click();
  await seed(mvpRecoverEryops(await saved())); await assemble('eryops');
  assert.equal(await page.locator('#ticket-price').innerText(), '10'); assert.equal(await page.locator('.purchase-marker:visible').count(), 0);
  assert.match(await page.locator('#ticket-increase').textContent(), /\+4$/);
  assert.equal(await page.locator('[data-purchase="stand-walchia"]').count(), 0); await capture('three-displays');
  const complete = await saved(); assert.ok(parseMvpSave(JSON.stringify(complete), 42));
  await page.reload(); await ready(); assert.equal(await page.locator('#ticket-price').innerText(), '10');
  assert.deepEqual((await saved()).museum, complete.museum); assert.deepEqual((await saved()).placed, complete.placed);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  await ticks(1);
  assert.equal((await saved()).economy.coins, 20); assert.equal(await page.locator('.purchase-marker:visible').count(), 1);
  // Synthetic obsolete development save: 8 coins, old paid Eryops, only 2
  // available soil coins. Preserve it until the explicit reset confirmation.
  const legacy = buyPurchase(createCreditSave(11), 'stand-eryops');
  await seed(legacy);
  assert.equal(await page.locator('#activity-title').innerText(), 'Нови редослед у музеју');
  const migrated = await saved();
  assert.deepEqual(migrated.museum, legacy.museum); assert.deepEqual(migrated.economy, legacy.economy);
  await capture('legacy-recovery');
  await page.locator('#recovery-reset').click();
  assert.equal(await page.locator('#activity-title').innerText(), 'Обрисати напредак?');
  await page.locator('#activity-close').click();
  assert.equal(await page.locator('#activity-title').innerText(), 'Нови редослед у музеју');
  assert.deepEqual(await saved(), migrated);
  await page.locator('#activity-close').click(); await ticks(1);
  assert.equal(await page.locator('.purchase-marker:visible').count(), 1);
  assert.equal(await page.locator('[data-purchase="stand-dimetrodon"]').isVisible(), true);
  await page.locator('#open-map').click(); assert.equal(await page.locator('[data-site-buy="eryops-dig"]').isDisabled(), true);
  await page.locator('#activity-close').click();
  await page.reload(); await ready();
  assert.equal(await page.locator('#activity-title').innerText(), 'Нови редослед у музеју');
  await page.locator('#recovery-reset').click();
  await page.evaluate(() => { window.qaRemove = Storage.prototype.removeItem; Storage.prototype.removeItem = () => { throw Error('QA reset denied'); }; });
  await page.locator('#confirm-reset').click();
  assert.deepEqual(await saved(), migrated); assert.match(await page.locator('#dialog-error').innerText(), /Брисање није успело/);
  await page.locator('#activity-close').click(); await page.locator('#activity-close').click();
  assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
  assert.deepEqual(await saved(), migrated);
  await page.evaluate(() => { Storage.prototype.removeItem = window.qaRemove; });
  await page.locator('#reset-button').click();
  await page.locator('#confirm-reset').evaluate(b => { b.click(); b.click(); }); await ticks(1);
  const fresh = await saved(); assert.equal(fresh.economy.coins, 20); assert.deepEqual(fresh.museum.owned, []); assert.deepEqual(fresh.placed, []);
  assert.equal(await page.locator('.purchase-marker:visible').count(), 1);
  await page.reload(); await ready(); assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
  console.log('PASS: legacy recovery keep/cancel/reload/failed-reset/confirmed-reset.');
  assert.deepEqual(errors, []);
  if (process.argv[4]) {
    const prod = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }), p = await prod.newPage();
    await p.goto(process.argv[4]); await p.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '20');
    assert.equal(await p.locator('.development-speed').count(), 0); assert.equal(await p.locator('.purchase-marker:visible').count(), 1);
    await p.locator('[data-purchase="stand-dimetrodon"]').tap(); await p.locator('#buy-purchase').tap();
    await p.reload(); await p.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '8');
    assert.equal(await p.evaluate(key => JSON.parse(localStorage.getItem(key)).version, SAVE_KEY), 25);
    await p.screenshot({ path: 'docs/qa/mvp-production-touch-390.png' }); await prod.close();
  }
  console.log(`PASS: schema-25 fresh progression, 12/8/16 and site 20, ticket 4/6/10, write retry, keyboard assembly/desk, real ticket income, collection, travel, reload/reset; desktop/mobile; ${process.argv[4] ? 'production touch purchase included; ' : ''}Edge ${browser.version()}. Pit recovery was synthetic.`);
} catch (e) { await shot('failure'); throw e; }
finally { await browser.close(); }
