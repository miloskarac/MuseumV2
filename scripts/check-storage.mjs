// node scripts/check-storage.mjs <Playwright index.mjs> <Vite URL>
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
import { buyHelper, assignHelper, startHelperTask } from '../src/game/helpers.ts';
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
const shot = name => page.screenshot({ path: `docs/qa/storage-${name}.png` });
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
  for (let i = 0; i < 14; i++) { save = arriveVisitor(save); const id = save.visitors.nextId - 1; save = finishVisit(payVisitor(save, id, CASHIER_STATION, true), id); }
  save = travelTo(save, { kind: 'site-camp', siteId: ERYOPS_SITE.id }); return travelTo(save, { kind: 'site-pit', siteId: ERYOPS_SITE.id });
}
const findId = ERYOPS_SITE.requiredDiscoveryIds[0];
const findCells = ERYOPS_SITE.cells.filter(c => c.discoveryId === findId), target = findCells.at(-1);
function prepared() {
  let s = assignHelper(buyHelper(fixture()), ERYOPS_SITE.id);
  s = advanceMuseum(s, { ...museumJourney(s), dig: { ...s.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])),
    ...Object.fromEntries(findCells.slice(0, -1).map(c => [c.id, 1])) } });
  return startHelperTask(s, target.id);
}
async function stroke(x1, y1, x2 = x1, y2 = y1) {
  const box = await page.locator('#cleaning-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1); await page.mouse.down();
  await page.mouse.move(box.x + box.width * x2, box.y + box.height * y2, { steps: 8 }); await page.mouse.up();
}
async function waitDelivery() {
  for (let i = 0; i < 350; i++) { await ticks(1); if ((await saved()).custody[findId]?.location === 'delivery') return; }
  throw Error('Helper did not expose the prepared find');
}
try {
  await page.goto(process.argv[3]); await ready(); await ticks(1);
  assert.equal((await saved()).version, 19); assert.equal(await page.locator('#open-helper').count(), 1);
  await seed(prepared()); await walkTo({ x: 1.5, z: 5 }); await shot('pit-before-delivery');
  await waitDelivery(); const carrying = await saved(); assert.equal(carrying.collected.includes(findId), false);
  assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
  assert.equal(await page.locator('#clean-button').isVisible(), false);
  await ticks(3); await shot('carrying');
  assert.equal(await page.evaluate(() => window.qaScene().getTransformNodeByName('helper-fossil-parcel').isEnabled()), true);
  // Blocking and hidden states freeze the carrying route without losing custody.
  await page.locator('#bag-button').click(); const frozen = await helperPosition(); await ticks(400);
  assert.equal((await saved()).custody[findId].location, 'delivery'); assert.deepEqual(await helperPosition(), frozen);
  await page.locator('#activity-close').click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await ticks(400); assert.deepEqual(await helperPosition(), frozen); await page.evaluate(() => { delete document.hidden; });
  // Persisted delivery is already an entitlement: failed deposit cannot erase it.
  await failWrites(true); await ticks(400); assert.equal((await saved()).custody[findId].location, 'delivery');
  assert.equal(await page.locator('#retry-save').isVisible(), true); await shot('delivery-failure');
  await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).custody[findId].location, 'storage'); assert.equal((await saved()).economy.coins, carrying.economy.coins);
  await walkTo(storageApproach(await saved())); await page.locator('#open-storage').click(); await shot('box');
  await page.locator(`[data-stored-find="${findId}"]`).click(); await stroke(0.25, 0.4, 0.5, 0.4);
  const partial = await page.locator('#cleaning-progress').evaluate(p => p.value); assert.ok(partial > 0 && partial < 1); await shot('cleaning-partial');
  assert.equal(await page.locator('#collect-fossil').isDisabled(), true);
  await page.locator('#activity-close').click(); assert.equal(await page.locator('#storage-view').isVisible(), true);
  const mask = (await saved()).cleaning[findId]; await page.locator('#activity-close').click();
  await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click(); await page.reload(); await ready();
  assert.deepEqual((await saved()).cleaning[findId], mask); assert.equal((await saved()).custody[findId].location, 'storage');
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click(); await ticks(1);
  // Camp box permits recovery without returning to the pit.
  await walkTo(storageApproach(await saved())); await page.locator('#open-storage').click();
  await page.locator(`[data-stored-find="${findId}"]`).click(); assert.equal(await page.locator('#cleaning-progress').evaluate(p => p.value), partial);
  for (let row = 0; row < 14; row++) await stroke(0.01, (row + 0.5) / 14, 0.99, (row + 0.5) / 14);
  assert.equal(await page.locator('#cleaning-progress').evaluate(p => p.value), 1);
  await page.waitForTimeout(1100); const beforeCollect = await saved(); await failWrites(true); await page.locator('#collect-fossil').click();
  assert.deepEqual(await saved(), beforeCollect); assert.equal(await page.locator('#activity-retry-save').isVisible(), true);
  await failWrites(false); await page.locator('#activity-retry-save').evaluate(b => { b.click(); b.click(); });
  const collected = await saved(); assert.equal(collected.collected.filter(id => id === findId).length, 1); assert.equal(collected.custody[findId], undefined);
  assert.equal(collected.economy.coins, beforeCollect.economy.coins); assert.equal(collected.closedSites.includes(ERYOPS_SITE.id), false);
  assert.ok(parseUpgradeSave(JSON.stringify(collected), 42));
  // Voluntary travel and reassignment interrupt a live delivery, not just a reload fixture.
  await seed(prepared()); await walkTo({ x: 1.5, z: 5 }); await waitDelivery();
  await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click();
  assert.equal((await saved()).custody[findId].location, 'storage'); assert.equal((await saved()).custody[findId].siteId, ERYOPS_SITE.id);
  await seed(prepared()); await walkTo({ x: 1.5, z: 5 }); await waitDelivery();
  await page.locator('#open-helper').click(); await page.locator('[data-helper-site="courtyard-dig"]').click();
  assert.equal((await saved()).custody[findId].location, 'storage'); assert.equal((await saved()).helpers.owned[0].siteId, SITE.id);
  // Reload while carrying deposits in the original box, even after reassignment.
  await seed(carrying); assert.equal((await saved()).custody[findId].location, 'storage');
  await walkTo({ x: 1.5, z: 5 }); await page.locator('#open-helper').click(); await page.locator('[data-helper-site="courtyard-dig"]').click();
  assert.equal((await saved()).custody[findId].siteId, ERYOPS_SITE.id); await page.locator('#activity-close').click();
  await page.locator('#open-map').click(); await page.locator('[data-travel="courtyard-dig"]').click(); await ticks(1);
  assert.deepEqual(storedFinds(await saved()), []); assert.equal((await saved()).custody[findId].siteId, ERYOPS_SITE.id);
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click(); await ticks(1);
  await walkTo(storageApproach(await saved()));
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`camp-${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#open-storage').click(); await shot(`box-${width}`); await page.locator('#activity-close').click();
  }
  // The helper QA slot migrates independently; resets never affect the normal game.
  const normal = await saved(); await page.evaluate(key => localStorage.setItem(key, 'purchase-qa-sentinel'), PURCHASE_QA_KEY);
  await page.goto(new URL('?helpers=1', process.argv[3]).href); await ready(); await ticks(1);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).version, HELPER_QA_KEY), 19);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
  assert.deepEqual(await saved(), normal); assert.equal(await page.evaluate(key => localStorage.getItem(key), PURCHASE_QA_KEY), 'purchase-qa-sentinel');
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; normal schema 19, helper exposure/carry/deposit, modal/hidden pause, failed deposit/collection retry, partial cleaning/travel/reload, camp collection, original-site custody, independent QA reset; 1440x1000, 1280x720, 390x844.`);
} catch (error) { console.log('Errors:', errors); await shot('failure'); console.log('State:', await saved().catch(() => null)); throw error; }
finally { await browser.close(); }
