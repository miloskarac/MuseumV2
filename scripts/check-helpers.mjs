// node scripts/check-helpers.mjs <Playwright index.mjs> <Vite URL>
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
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), HELPER_QA_KEY);
const shot = name => page.screenshot({ path: `docs/qa/helpers-${name}.png` });
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
async function seed(save) { await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [HELPER_QA_KEY, save]); await page.reload(); await ready(); }
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
try {
  await page.goto(process.argv[3]); await ready(); await ticks(1);
  const normal = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  assert.equal(await page.locator('#open-helper').count(), 1);
  await page.evaluate(key => localStorage.setItem(key, 'qa-sentinel'), PURCHASE_QA_KEY);
  await page.goto(new URL('?helpers=1', process.argv[3]).href); await ready(); await ticks(1);
  assert.equal((await saved()).version, 19); assert.equal((await saved()).helpers.owned.length, 0);
  await page.locator('#open-helper').click(); assert.equal(await page.locator('#hire-helper').isDisabled(), true);
  await page.locator('#activity-close').click();
  await seed(fixture()); await walkTo({ x: 1.5, z: 5 }); await ticks(1); await shot('pit-before');
  await page.locator('#open-helper').click(); await shot('hire');
  const beforeHire = await saved(); await failWrites(true); await page.locator('#hire-helper').click();
  assert.deepEqual(await saved(), beforeHire); assert.equal(await page.locator('#activity-retry-save').isVisible(), true);
  await failWrites(false); await page.locator('#activity-retry-save').evaluate(b => { b.click(); b.click(); });
  assert.equal((await saved()).economy.coins, beforeHire.economy.coins - 60); assert.equal((await saved()).helpers.owned.length, 1);
  await page.locator('[data-helper-site="eryops-dig"]').click(); await shot('assignment'); await page.locator('#activity-close').click();
  await ticks(1); assert.ok((await saved()).helpers.owned[0].task);
  // Move first, then retain exactly 3.6 seconds (60%) of the six-second task.
  for (let i = 0; i < 180 && !(await page.locator('#helper-progress strong').innerText()).includes('копа'); i++) await ticks(1);
  // Walking label becomes digging on arrival, before the first work increment.
  const currentProgress = Number((await page.locator('#helper-progress span').innerText()).replace('%', ''));
  assert.ok(currentProgress <= 1);
  await ticks(currentProgress ? 71 : 72); await page.locator('#open-map').click(); const paused = await saved();
  const task = paused.helpers.owned[0].task; assert.ok(Math.abs(task.work / task.required - 0.6) < 0.01, JSON.stringify(task));
  const still = await helperPosition(); await ticks(400); assert.deepEqual(await saved(), paused); assert.deepEqual(await helperPosition(), still);
  await page.locator('[data-travel="hub"]').click(); await ticks(200); assert.equal((await saved()).helpers.owned[0].task.work, task.work);
  await page.reload(); await ready(); assert.equal((await saved()).helpers.owned[0].task.work, task.work);
  await page.locator('#open-map').click(); await page.locator('[data-travel="eryops-dig"]').click(); await ticks(1);
  // Use actual camp entrance controls; helper remains paused while in camp.
  await walkTo({ x: 0, z: -1.45 }); await ticks(1); assert.equal((await saved()).room, 'excavation');
  await walkTo({ x: 1.5, z: 5 });
  // Focus/visibility suspension cannot accumulate work or move the actor.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await saved(), hiddenPosition = await helperPosition(); await ticks(400); assert.deepEqual(await saved(), hidden); assert.deepEqual(await helperPosition(), hiddenPosition);
  await page.evaluate(() => { delete document.hidden; Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }); window.dispatchEvent(new Event('blur')); });
  await ticks(400); assert.deepEqual(await saved(), hidden); await page.evaluate(() => { delete document.hasFocus; });
  // Finish retained task through the shared writer, then check real soil changed.
  await failWrites(true); await ticks(180); assert.deepEqual((await saved()).dig, hidden.dig);
  assert.equal(await page.locator('#retry-save').isVisible(), true); const frozen = await helperPosition();
  await ticks(400); assert.deepEqual(await helperPosition(), frozen); await shot('clear-failure');
  await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
  await ticks(180); await page.locator('#open-helper').click(); const cleared = await saved();
  assert.ok(cleared.dig[task.cellId] >= 0.5); assert.deepEqual(cleared.collected, [...SITE.requiredDiscoveryIds]);
  assert.ok(parseUpgradeSave(JSON.stringify(cleared), 42));
  await page.locator('[data-helper-site="courtyard-dig"]').click();
  assert.equal((await saved()).helpers.owned[0].task, null); assert.deepEqual((await saved()).dig, cleared.dig);
  await page.locator('[data-helper-site="eryops-dig"]').click(); await page.locator('#activity-close').click();
  for (let i = 0; i < 240 && !(await page.locator('#helper-progress strong').innerText()).includes('копа'); i++) await ticks(1);
  await ticks(42);
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`working-${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#open-helper').click(); await shot(`controls-${width}`); await page.locator('#activity-close').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const second = await context.newPage(); await second.goto(new URL('?helpers=1', process.argv[3]).href); await second.locator('.session-blocker').waitFor(); await second.close(); await page.bringToFront();
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await ticks(1);
  assert.equal((await saved()).economy.coins, 20); assert.deepEqual((await saved()).helpers.owned, []); assert.deepEqual((await saved()).dig, {});
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), normal);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), PURCHASE_QA_KEY), 'qa-sentinel');
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; isolated helper hire/failed payment/retry, assignment, walking/working, 60% pause/travel/reload, hidden/focus, layer clearing, reassignment/reset, writer exclusion; 1440x1000, 1280x720, 390x844.`);
} catch (error) { await shot('failure'); console.log('Helper:', (await saved())?.helpers); console.log('Errors:', errors); throw error; }
finally { await browser.close(); }
