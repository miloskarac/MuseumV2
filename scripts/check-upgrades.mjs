import { parseCreditSave } from '../src/persistence/credit-save.ts';
// node scripts/check-upgrades.mjs <Playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { HELPER_QA_KEY } from '../src/persistence/helper-save.ts';
import { parseUpgradeSave } from '../src/persistence/upgrade-save.ts';
import { PURCHASE_QA_KEY } from '../src/persistence/museum-save.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
import { travelTo } from '../src/game/world-map.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { buyHelper, assignHelper, startHelperTask, workHelper } from '../src/game/helpers.ts';
import { advanceMuseum, museumJourney } from '../src/game/purchases.ts';
import { storageApproach } from '../src/content/storage.ts';
import { storedFinds } from '../src/game/storage.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const shot = name => page.screenshot({ path: `docs/qa/${process.argv[4] || "upgrades"}-${name}.png` });
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
const helperPosition = () => page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('digging-helper')?.position; return p?.asArray(); });
async function seed(save) { await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]); await page.reload(); await ready(); }
async function walkTo(target) {
  await page.locator('.stage > canvas').focus();
  const initialRoom = (await saved()).room;
  for (let i = 0; i < 180; i++) {
    const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.12) return;
    const room = (await saved()).room;
    if (room !== initialRoom) return;
    const right = screenDirection(1, 0, room), up = screenDirection(0, 1, room);
    const h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.03, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.03, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Cannot reach ${JSON.stringify(target)} from ${JSON.stringify(await position())}`);
}
async function failWrites(fail) { await page.evaluate(fail => {
  window.qaSet ??= Storage.prototype.setItem; window.qaFail = fail;
  Storage.prototype.setItem = function(key, value) { if (window.qaFail) throw Error('QA quota'); return window.qaSet.call(this, key, value); };
}, fail); }
function fixture() {
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: EXHIBITS.slice(0, 2).flatMap(e => [...e.parts]) }, 42);
  let save = parseUpgradeSave(JSON.stringify(old), 42);
  for (let i = 0; i < 50; i++) { save = arriveVisitor(save); const id = save.visitors.nextId - 1; save = finishVisit(payVisitor(save, id, CASHIER_STATION, true), id); }
  return save;
}

import { buyUpgrade } from '../src/game/upgrades.ts';
import { parseStorageSave } from '../src/persistence/storage-save.ts';

const buy = id => page.locator(`[data-upgrade="${id}"]`);
async function openUpgrades() { await page.locator('#open-upgrades').click(); }
async function moveDistance() {
  await page.locator('.stage > canvas').focus(); const before = await position();
  await page.keyboard.down('KeyA'); await ticks(4); await page.keyboard.up('KeyA');
  const after = await position(); return Math.hypot(after.x - before.x, after.z - before.z);
}
try {
  await page.goto(process.argv[3]); await ready(); await ticks(1);
  assert.equal((await saved()).version, 24); await openUpgrades();
  for (const id of ['boots', 'shovel', 'helper-tools']) assert.equal(await buy(id).isDisabled(), true);
  await shot('locked'); await page.locator('#activity-close').click();
  // A genuine schema-18 checkpoint migrates without any free purchase.
  const { upgrades: _upgrades, ...base } = fixture(); const old = { ...base, version: 18 };
  assert.ok(parseStorageSave(JSON.stringify(old), 42)); await seed(old);
  assert.deepEqual((await saved()).upgrades.owned, []); assert.equal((await saved()).economy.coins, old.economy.coins);
  await shot('before'); const normalDistance = await moveDistance();
  await seed(old); await openUpgrades(); const before = await saved(); await failWrites(true);
  await buy('boots').click(); assert.deepEqual(await saved(), before);
  assert.equal(await page.locator('#activity-retry-save').isVisible(), true); await shot('purchase-failure');
  await failWrites(false); await page.locator('#activity-retry-save').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).economy.coins, before.economy.coins - 16);
  assert.equal((await saved()).upgrades.owned.length, 1); assert.equal(await buy('boots').isDisabled(), true);
  await buy('shovel').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).economy.coins, before.economy.coins - 40);
  await page.locator('#activity-close').click(); await page.reload(); await ready();
  assert.equal((await saved()).upgrades.owned.length, 2);
  const fastDistance = await moveDistance(); assert.ok(Math.abs(fastDistance / normalDistance - 1.2) < 1e-6);
  // Retained task percentage survives a real UI purchase and a full restart.
  let taskSave = buyHelper(fixture()); taskSave = assignHelper(taskSave, ERYOPS_SITE.id);
  taskSave = travelTo(travelTo(taskSave, { kind: 'site-camp', siteId: ERYOPS_SITE.id }), { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  taskSave = startHelperTask(taskSave, ERYOPS_SITE.cells[0].id);
  for (let i = 0; i < 72; i++) taskSave = workHelper(taskSave, ERYOPS_SITE.cells[0], 0.05);
  taskSave = travelTo(taskSave, { kind: 'hub' }); await seed(taskSave); await openUpgrades();
  const task = (await saved()).helpers.owned[0].task, money = (await saved()).economy.coins;
  await buy('helper-tools').click(); assert.deepEqual((await saved()).helpers.owned[0].task, task);
  assert.equal((await saved()).economy.coins, money - 30);
  await page.locator('#activity-close').click(); await page.reload(); await ready();
  assert.deepEqual((await saved()).helpers.owned[0].task, task);
  await openUpgrades(); await buy('boots').click(); await buy('shovel').click();
  const owned = await saved(); assert.equal(owned.upgrades.owned.length, 3); assert.ok(parseCreditSave(JSON.stringify(owned), 42));
  // Real movement and shovel ticks in the pit retain upgrade ownership after travel.
  await page.locator('#activity-close').click();
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click(); await ticks(1);
  assert.equal(await page.locator('#open-upgrades').isVisible(), false);
  // Use a selected untouched column for an exact two-contact timing check.
  let shovelSave = travelTo(owned, { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  shovelSave = travelTo(shovelSave, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
  shovelSave = assignHelper(shovelSave, null); await seed(shovelSave);
  const cell = ERYOPS_SITE.cells[0]; await walkTo(cell); await page.locator('.stage > canvas').focus();
  const start = await saved(); await ticks(11); assert.equal((await saved()).dig[cell.id], start.dig[cell.id]);
  await ticks(1); assert.equal((await saved()).dig[cell.id], 0.25);
  await ticks(15); assert.equal((await saved()).dig[cell.id], 0.25);
  await ticks(1); assert.equal((await saved()).dig[cell.id], 0.5);
  await shot('shovel'); assert.deepEqual((await saved()).upgrades, owned.upgrades);
  // Upgraded helper resumes the 60% task, walking before finishing; modal pauses it.
  let helperSave = travelTo(owned, { kind: 'site-camp', siteId: ERYOPS_SITE.id });
  helperSave = travelTo(helperSave, { kind: 'site-pit', siteId: ERYOPS_SITE.id }); await seed(helperSave);
  await walkTo({ x: 1.5, z: 5 }); await page.locator('#open-helper').click();
  const paused = await saved(); await ticks(200); assert.deepEqual((await saved()).helpers.owned[0].task, paused.helpers.owned[0].task);
  await page.locator('#activity-close').click();
  for (let i = 0; i < 350 && (await saved()).dig[cell.id] !== 0.5; i++) await ticks(1);
  assert.equal((await saved()).dig[cell.id], 0.5); assert.deepEqual((await saved()).upgrades, owned.upgrades); await shot('helper');
  // Screenshots of available and owned controls at all supported QA viewports.
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await seed(buyHelper(fixture())); await ticks(1);
    await openUpgrades(); await shot(`offers-${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const id of ['boots', 'shovel', 'helper-tools']) { await buy(id).scrollIntoViewIfNeeded(); await buy(id).click(); }
    await page.locator('#upgrades-view').evaluate(e => e.closest('dialog').scrollTop = 0); await shot(`owned-${width}`);
    await page.locator('#activity-close').click(); await shot(`museum-${width}`);
  }
  // Normal ownership is preserved while each independent QA slot starts/reset at base stats.
  const normal = await saved();
  for (const [query, key] of [['helpers', HELPER_QA_KEY], ['purchases', PURCHASE_QA_KEY]]) {
    await page.goto(new URL(`?${query}=1`, process.argv[3]).href); await ready(); await ticks(1);
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).upgrades.owned, key), []);
    await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
    assert.deepEqual(await saved(), normal);
  }
  await page.goto(process.argv[3]); await ready(); await ticks(1);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
  assert.deepEqual((await saved()).upgrades.owned, []); assert.equal((await saved()).economy.coins, 20);
  await openUpgrades(); assert.equal(await buy('boots').isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; schema 18 migration, schema 19 upgrades, failed purchase/retry, duplicate purchase, +20% walking, 0.8-second shovel, 60% helper retention/resume, modal pause, reload/travel/reset/QA isolation; 1440x1000, 1280x720, 390x844.`);
} catch (error) { console.log('Errors:', errors); await shot('failure'); console.log('State:', await saved().catch(() => null)); throw error; }
finally { await browser.close(); }
