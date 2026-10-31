// Isolated browser QA; uses an existing Playwright installation, no game dependency.
// node scripts/check-journey.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { DISCOVERY, FIRST_DISCOVERIES as DISCOVERIES, SITE, SITE_FRONT, SITE_PLOTS } from '../src/content/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { cameraOffset } from '../src/content/view.ts';
import { freshJourney } from '../src/game/journey.ts';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
async function inspectScene() {
  await page.locator('#room-name').filter({ hasText: /Музеј|Налазиште|Налазишта|Зелена пољана/ }).waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const url = source.match(/import \{ Engine \} from "([^"]+)"/)[1];
    const { Engine } = await import(url);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
}
const position = () => page.evaluate(() => {
  const p = window.qaScene().getTransformNodeByName('player').position;
  return { x: p.x, z: p.z };
});
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function walk(keys, ms) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of keys) await page.keyboard.up(key);
}
async function approach(target, untilRoom) {
  for (let i = 0; i < 160; i++) {
    if (untilRoom && await page.locator('#room-name').innerText() === untilRoom) return;
    const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.18) return;
    const view = cameraOffset((await saved()).room), length = Math.hypot(view.x, view.z);
    const h = dx * -view.z / length + dz * view.x / length;
    const v = dx * -view.x / length + dz * -view.z / length;
    const keys = [];
    if (Math.abs(h) > Math.max(0.06, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.06, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    await walk(keys, 80);
  }
  throw Error(`Could not reach ${JSON.stringify(target)} from ${JSON.stringify(await position())}`);
}
async function uncover(id) {
  for (const cell of SITE.cells.filter(cell => cell.discoveryId === id)) {
    if ((await saved()).dig[cell.id] === 1) continue;
    await approach(cell);
    await page.waitForFunction(([key, cellId]) => JSON.parse(localStorage.getItem(key)).dig[cellId] === 1,
      [SAVE_KEY, cell.id], { timeout: 10000 });
  }
}
async function reachDig() {
  if ((await position()).x > 2) await approach({ x: 4, z: 5.1 });
  await approach(SITE.interaction);
}
async function enterFirstSite() {
  await approach(SITE_PLOTS[0].entrance, 'Налазиште');
}
async function returnToMuseum() {
  assert.equal(await page.locator('#label-eryops-dig').isHidden(), true);
  await screenshot('outdoors-complete');
  await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click();
}
const entryCell = SITE.cells.find(cell => cell.row === SITE.grid.rows - 1 && cell.column === SITE.grid.columns / 2 - 1);
const findCell = SITE.cells.find(cell => cell.discoveryId === DISCOVERY.id);
async function stroke(x1, y1, x2 = x1, y2 = y1) {
  const box = await page.locator('#cleaning-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * x2, box.y + box.height * y2, { steps: 8 });
  await page.mouse.up();
}
const cleanValue = () => page.locator('#cleaning-progress').evaluate(el => el.value);
async function screenshot(name) { await page.screenshot({ path: `docs/qa/dimetrodon-${name}.png` }); }
try {
  await page.goto(process.argv[3]); await inspectScene();
  await page.waitForTimeout(600); await screenshot('museum');
  for (const id of ['stand-dimetrodon', 'stand-trilobite']) {
    await page.locator(`[data-purchase="${id}"]`).click(); await page.locator('#buy-purchase').click();
  }
  assert.equal((await saved()).economy.coins, 0);
  await page.locator('#open-map').click();
  assert.equal(await page.locator('[data-site-buy="eryops-dig"]').isDisabled(), true);
  await page.locator('[data-travel="courtyard-dig"]').click();
  await screenshot('outdoors');
  assert.equal(await page.locator('#label-eryops-dig').isHidden(), true);
  await enterFirstSite();
  await screenshot('excavation');
  await reachDig();
  await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key) || '{}').dig?.[id] === 0.5, [SAVE_KEY, entryCell.id]);
  const duringDig = (await saved()).dig[entryCell.id];
  assert.ok(duringDig > 0 && duringDig < 1, 'partial digging checkpoint');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenCheckpoint = await saved();
  await page.waitForTimeout(1100);
  assert.deepEqual(await saved(), hiddenCheckpoint, 'hidden page pauses digging and flushes progress');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await approach({ x: 4, z: 5.1 });
  const interrupted = await saved();
  await page.waitForTimeout(1200);
  assert.deepEqual(await saved(), interrupted, 'leaving the circle stops progress');
  await page.reload(); await inspectScene();
  assert.ok(Math.hypot((await position()).x - SITE.interaction.x, (await position()).z - SITE.interaction.z) < 0.01, 'reload at safe site arrival');
  assert.ok((await saved()).dig[entryCell.id] >= interrupted.dig[entryCell.id], 'reload retains partial digging');
  assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  await reachDig();
  await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] === 1, [SAVE_KEY, entryCell.id], { timeout: 15000 });
  await uncover(DISCOVERY.id);
  await page.locator('#cleaning-view').waitFor({ state: 'visible', timeout: 25000 });
  assert.equal((await saved()).dig[findCell.id], 1);
  await screenshot('auto-cleaning');
  const stationary = await position();
  await walk(['KeyW'], 300);
  assert.deepEqual(await position(), stationary, 'movement is paused in cleaning');
  await stroke(0.02, 0.02);
  assert.ok(await cleanValue() > 0, 'off-fossil dirt is brushable');
  assert.equal(await page.locator('#collect-fossil').isDisabled(), true);
  await stroke(0.25, 0.4);
  const partial = await cleanValue();
  assert.ok(partial > 0 && partial < 0.9);
  await stroke(0.25, 0.4);
  assert.equal(await cleanValue(), partial, 'repeated stroke adds nothing');
  await screenshot('cleaning');
  await page.keyboard.down('KeyD');
  await page.locator('#activity-close').click();
  await page.waitForTimeout(100);
  assert.deepEqual(await position(), stationary, 'closing activity clears held movement');
  await page.keyboard.up('KeyD');
  const partialSave = await saved();
  assert.ok(partialSave.cleaning[DISCOVERY.id].length > 0);
  await page.reload(); await inspectScene();
  assert.deepEqual((await saved()).cleaning, partialSave.cleaning, 'exact spatial mask survives reload');
  assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  await page.locator('#clean-button').click();
  assert.equal(await cleanValue(), partial);
  await stroke(0.25, 0.4); assert.equal(await cleanValue(), partial, 'restored area stays clean');
  await page.evaluate(() => {
    window.qaOriginalSet = Storage.prototype.setItem;
    window.qaFailWrites = true;
    Storage.prototype.setItem = function(key, value) {
      if (window.qaFailWrites) throw new DOMException('QA quota', 'QuotaExceededError');
      return window.qaOriginalSet.call(this, key, value);
    };
  });
  for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) await stroke(0.025, y, 0.975, y);
  assert.ok(await cleanValue() > partial, 'brushing progresses until the failed checkpoint pauses mutation');
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 0');
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true, 'failed cleaning remains open for retry');
  assert.equal(await page.locator('#activity-save-status').innerText(), 'Напредак није сачуван. Покушај поново пре затварања.');
  assert.deepEqual((await saved()).collected, [], 'failed write did not claim durable collection');
  await screenshot('save-failure');
  await page.evaluate(() => { window.qaFailWrites = false; });
  await page.locator('#activity-retry-save').click();
  assert.deepEqual((await saved()).collected, []);
  // A slow browser can reach the one-second checkpoint before all six strokes.
  // Finish only after retry releases the intentional save-failure pause.
  for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) await stroke(0.025, y, 0.975, y);
  assert.equal(await cleanValue(), 1); await page.waitForTimeout(1300);
  await page.reload(); await inspectScene();
  await page.locator('#clean-button').click();
  assert.equal(await cleanValue(), 1, 'clean and ready survives reload');
  assert.equal(await page.locator('#collect-fossil').isEnabled(), true);
  await stroke(0.1, 0.5, 0.9, 0.5);
  assert.deepEqual((await saved()).collected, [], 'brushing cannot collect');
  await screenshot('collected');
  const beforeClosing = await saved();
  await page.waitForTimeout(1200);
  assert.deepEqual(await saved(), beforeClosing, 'digging stays paused in completed cleaning popup');
  await page.locator('#collect-fossil').evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => !document.querySelector('dialog').open);
  assert.deepEqual((await saved()).collected, [DISCOVERY.id], 'double click collects once');
  assert.deepEqual((await saved()).cleaning, {});
  assert.deepEqual((await saved()).closedSites, [], 'first find cannot close site');
  await screenshot('first-find');
  await uncover('bone-study-head');
  await page.locator('#cleaning-view').waitFor({ state: 'visible', timeout: 25000 });
  assert.match(await page.locator('.cleaning-details h3').innerText(), /Лобања/);
  for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) await stroke(0.025, y, 0.975, y);
  await screenshot('second-find');
  await page.locator('#collect-fossil').click();
  for (const group of DISCOVERIES.slice(2)) {
    assert.equal((await saved()).closedSites.length, 0);
    await uncover(group.id);
    await page.locator('#cleaning-view').waitFor({ state: 'visible', timeout: 25000 });
    assert.equal(await page.locator('.cleaning-details h3').innerText(), group.name);
    await stroke(0.2, 0.3);
    if (group.groupId === 'ribs') {
      const partialMask = (await page.locator('#cleaning-progress').evaluate(el => el.value));
      await page.locator('#activity-close').click();
      await page.locator('#clean-button').click();
      assert.equal(await cleanValue(), partialMask, 'third find survives activity reopen');
    }
    for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) await stroke(0.025, y, 0.975, y);
    if (group.groupId !== 'trilobite-whole') await page.locator('#collect-fossil').click();
  }
  assert.equal((await saved()).collected.length, 6);
  await screenshot('shared-pit-slab-cleaned');
  // Exhaustion must be durable before its first animated removal.
  await page.evaluate(() => {
    window.qaFailWrites = true;
    window.qaOriginalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (window.qaFailWrites) throw new DOMException('QA quota', 'QuotaExceededError');
      return window.qaOriginalSet.call(this, key, value);
    };
  });
  await page.locator('#collect-fossil').click();
  const failedDig = await page.evaluate(() => window.qaScene().meshes.filter(m => m.name.startsWith('soil-tile-') && m.isEnabled()).length);
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.qaScene().meshes.filter(m => m.name.startsWith('soil-tile-') && m.isEnabled()).length), failedDig, 'cleanup waits for durable collection');
  await page.evaluate(() => { window.qaFailWrites = false; });
  await page.locator('#activity-retry-save').click();
  assert.deepEqual([...(await saved()).collected].sort(), DISCOVERIES.map(d => d.id).sort());
  assert.deepEqual((await saved()).placed, [], 'site completion is independent of assembly');
  const cleanupStart = await position();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1400); await page.keyboard.up('KeyW');
  assert.deepEqual(await position(), cleanupStart, 'movement input cannot interrupt cleanup');
  assert.ok(Object.values((await saved()).dig).filter(n => n === 1).length < 64, 'cleanup is visibly paced');
  await screenshot('cleanup');
  const cleanupCheckpoint = await saved();
  await page.reload(); await inspectScene();
  for (const [id, value] of Object.entries(cleanupCheckpoint.dig)) assert.ok((await saved()).dig[id] >= value, 'cleanup survives reload');
  await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).closedSites.includes(id), [SAVE_KEY, SITE.id], { timeout: 45000 });
  assert.equal(Object.values((await saved()).dig).filter(n => n === 1).length, 64);
  assert.deepEqual(await position(), SITE_FRONT, 'automatic return reaches site front');
  assert.equal((await saved()).room, 'outdoors');
  assert.deepEqual((await saved()).closedSites, [SITE.id]);
  await screenshot('closed');
  await approach(SITE_PLOTS[0].entrance);
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#room-name').innerText(), 'Зелена пољана', 'closed site cannot reopen');
  await page.reload(); await inspectScene();
  assert.deepEqual((await saved()).closedSites, [SITE.id], 'closure survives reload');
  await page.locator('#bag-button').click();
  assert.equal(await page.locator('#bag-list li').count(), 7);
  await page.locator('#activity-close').click();
  await returnToMuseum();
  await page.reload(); await inspectScene();
  assert.equal(await page.locator('#room-name').innerText(), 'Музеј');
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 7');
  await page.locator('#bag-button').click(); await screenshot('bag');
  await page.locator('#activity-close').click();
  const visibleFossil = name => page.evaluate(name => window.qaScene().getMeshByName(name).isEnabled(), name);
  assert.equal(await visibleFossil('skull'), false);
  assert.equal(await visibleFossil('vertebra'), false);
  assert.equal(await page.locator('#exhibit-button').getAttribute('data-state'), 'empty');
  await page.locator('#exhibit-button').click();
  await screenshot('assembly-empty');
  const beforeWrong = await saved();
  await page.locator('[data-group="spine-sail"]').click();
  await page.locator('[data-target="skull"]').click();
  assert.deepEqual(await saved(), beforeWrong, 'wrong click is harmless');
  assert.match(await page.locator('#assembly-feedback').innerText(), /Пробај/);
  // Click-then-click first placement.
  await page.evaluate(() => {
    window.qaOriginalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function() { throw new DOMException('QA placement quota', 'QuotaExceededError'); };
  });
  await page.locator('[data-target="spine-sail"]').click();
  assert.deepEqual((await saved()).placed, [], 'failed placement write leaves durable save unchanged');
  assert.equal(await page.locator('#activity-retry-save').isVisible(), true);
  assert.equal(await visibleFossil('vertebra'), false, 'placement is published only after a successful save');
  await screenshot('assembly-save-failure');
  await page.evaluate(() => { Storage.prototype.setItem = window.qaOriginalSet; });
  await page.locator('#activity-retry-save').click();
  assert.deepEqual((await saved()).placed, ['spine-sail']);
  assert.equal(await visibleFossil('vertebra'), true);
  assert.equal(await visibleFossil('skull'), false);
  await screenshot('assembly-partial');
  await page.locator('#activity-close').click();
  await screenshot('museum-partial');
  await page.reload(); await inspectScene();
  assert.deepEqual((await saved()).placed, ['spine-sail']);
  assert.equal(await visibleFossil('vertebra'), true);
  assert.equal(await visibleFossil('skull'), false);
  assert.equal(await page.locator('.tutorial-arrow').count(), 0);
  assert.equal(await visibleFossil('travel-arrow'), false);
  await page.locator('#exhibit-button').click();
  const nonSkull = ['spine-sail', 'ribs', 'front-legs', 'hind-legs', 'tail'];
  for (const id of nonSkull.slice(1)) {
    await page.locator(`[data-group="${id}"]`).click();
    await page.locator(`[data-target="${id}"]`).click();
  }
  // Drag outside is harmless; 20px outside the correct target still snaps.
  async function dragHead(outside) {
    const from = await page.locator('[data-group="skull"]').boundingBox();
    const to = await page.locator('[data-target="skull"]').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, outside ? to.y - 60 : to.y - 20, { steps: 12 });
    await page.mouse.up();
  }
  await dragHead(true); assert.deepEqual((await saved()).placed, nonSkull);
  await page.locator('#activity-close').click();
  await page.locator('#exhibit-button').click();
  await dragHead(false);
  await page.locator('#story-view').waitFor({ state: 'visible' });
  assert.deepEqual((await saved()).placed, [...nonSkull, 'skull']);
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 1');
  assert.equal(await visibleFossil('skull'), true);
  assert.equal(await page.locator('#activity-title').innerText(), 'Упознај Диметродона');
  await screenshot('story');
  await page.locator('#activity-close').click();
  await page.locator('#exhibit-trilobite').click();
  assert.equal(await page.locator('#assembly-count').innerText(), 'Постављено · 0/1');
  assert.equal(await page.locator('#exhibit-trilobite').getAttribute('data-state'), 'empty');
  await page.screenshot({ path: 'docs/qa/shared-pit-slab-placement.png' });
  await page.locator('[data-group="trilobite-whole"]').click();
  await page.locator('[data-target="trilobite-whole"]').click();
  assert.equal(await page.locator('#activity-title').innerText(), 'Упознај трилобита');
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 0');
  const finalPlacement = await saved();
  await page.reload(); await inspectScene();
  assert.deepEqual(await saved(), finalPlacement, 'reload during card cannot repeat or lose completion');
  assert.equal(await page.locator('.tutorial-arrow').count(), 0);
  assert.equal(await visibleFossil('travel-arrow'), false);
  assert.equal(await page.locator('#exhibit-button').getAttribute('data-state'), 'complete');
  await screenshot('museum-complete');
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#exhibit-button').click();
    assert.equal(await page.locator('.story-facts h3').count(), 4);
    await screenshot(`story-${width}x${height}`);
    await page.locator('#activity-close').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const completed = await saved();
  await page.locator('#reset-button').click(); await page.locator('#activity-close').click();
  assert.deepEqual(await saved(), completed, 'cancel reset leaves save unchanged');
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  await page.waitForTimeout(1200);
  assert.deepEqual((await saved()).dig, {}, 'confirmed reset immediately persists a fresh game');
  assert.equal((await saved()).economy.coins, 20);
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 0');
  await page.reload(); await inspectScene();
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 0', 'reset survives reload');
  console.log('PASS: fresh discovery-to-display journey, seven shared-pit finds, click/drag assembly and explicit slab placement, harmless misses, immediate partial display, durable partial/completed assembly, permanent tutorial cutoff, write failure/retry, reset/cancel.');

  // Independent recovery and storage-error scenarios in this disposable profile.
  for (const raw of ['{broken', JSON.stringify({ ...completed, version: 99 })]) {
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, raw]);
    await page.reload(); await inspectScene();
    await page.locator('#recovery-retry').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), raw);
    await page.locator('#recovery-retry').click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), raw);
    await screenshot('recovery');
    await page.locator('#recovery-reset').click(); await page.locator('#activity-close').click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), raw);
    await page.locator('#recovery-reset').click(); await page.locator('#confirm-reset').click();
    assert.deepEqual((await saved()).dig, {});
    assert.equal((await saved()).economy.coins, 20);
  }
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVE_KEY, completed]);
  await page.reload(); await inspectScene();
  await page.evaluate(() => {
    window.qaRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = () => { throw Error('QA denied reset'); };
  });
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  assert.equal(await page.locator('#dialog-error').innerText(), 'Брисање није успело. Напредак није ресетован. Покушај поново.');
  assert.deepEqual(await saved(), completed);
  await page.locator('#activity-close').click();
  assert.equal(await page.locator('#bag-button').innerText(), 'Торба · 0');
  await page.evaluate(() => { Storage.prototype.removeItem = window.qaRemove; });
  console.log('PASS: corrupt/newer saves remain untouched, recovery retry/cancel/reset, failed reset preserves progress.');

  const unavailable = await browser.newPage();
  await unavailable.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    window.qaRestoreStorage = () => Object.defineProperty(window, 'localStorage', descriptor);
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('QA denied', 'SecurityError'); } });
  });
  await unavailable.goto(process.argv[3]);
  await unavailable.locator('#dialog-error').filter({ hasText: 'Чување тренутно није доступно.' }).waitFor();
  await unavailable.evaluate(() => window.qaRestoreStorage());
  await unavailable.locator('#recovery-retry').click();
  assert.equal(await unavailable.locator('dialog').evaluate(el => el.open), false, 'storage getter failure can recover by retry');
  await unavailable.close(); await page.bringToFront();
  console.log('PASS: denied localStorage getter blocks safely and recovers with retry.');

  // Responsive assembly QA uses its own derived fixture after the real journey.
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVE_KEY, { ...completed, placed: [],
    visitors: { version: 1, nextId: 1, sales: [0, 0, 0], visits: [] } }]);
  await page.reload(); await inspectScene();
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#exhibit-button').click();
    for (const selector of ['[data-group="skull"]', '[data-group="spine-sail"]', '[data-target="skull"]', '[data-target="spine-sail"]', '#activity-close']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${selector} fits ${width}x${height}`);
    }
    await screenshot(`assembly-${width}x${height}`);
    await page.locator('#activity-close').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Seed only for viewport QA; the journey above was completed through real input.
  const uncovered = { ...freshJourney(), room: 'excavation',
    dig: Object.fromEntries(SITE.cells.filter(cell => cell.discoveryId === DISCOVERY.id).map(cell => [cell.id, 1])) };
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVE_KEY, uncovered]);
  await page.reload(); await inspectScene(); await reachDig();
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(250);
    await screenshot(`site-${width}x${height}`);
    await page.locator('#clean-button').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const selector of ['#cleaning-canvas', '#activity-close', '#collect-fossil']) {
      const b = await page.locator(selector).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${selector} visible at ${width}x${height}`);
    }
    await screenshot(`cleaning-${width}x${height}`); await page.locator('#activity-close').click();
  }
  assert.deepEqual(errors, [], 'no console/page errors');
  console.log(`PASS: Edge ${browser.version()}, isolated profile, desktop/portrait screenshots, no browser errors.`);
} catch (error) {
  await screenshot('failure');
  console.log('QA failure position/save:', await position().catch(() => 'scene unavailable'), await saved().catch(() => 'save unavailable'));
  throw error;
} finally { await browser.close(); }
