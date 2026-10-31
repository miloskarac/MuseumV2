// Isolated browser checks for shared-pit migration and explicit whole-fossil placement.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { FIRST_PARTS as ALL_PARTS, GROUPS, SLAB_PART } from '../src/content/exhibit.ts';
import { SITE, LEGACY_SLAB_SITE } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const ready = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
  collected: ALL_PARTS.map(p => p.discoveryId), closedSites: [SITE.id] };
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(state) {
  await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, state]);
  await page.reload();
  await page.locator('#room-name').waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
}
const screenshot = name => page.screenshot({ path: `docs/qa/shared-pit-${name}.png` });
async function approach(target) {
  for (let i = 0; i < 180; i++) {
    if (await page.locator('dialog').evaluate(el => el.open)) return;
    const p = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.16) return;
    const h = dx * 0.8 + dz * 0.6, v = dx * -0.6 + dz * 0.8, keys = [];
    if (Math.abs(h) > Math.max(0.06, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.06, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(80);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw Error('Walking route did not reach slab circle');
}
async function dragSlab(outside = false) {
  const from = await page.locator('[data-group="trilobite-whole"]').boundingBox();
  const to = await page.locator('[data-target="trilobite-whole"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, outside ? to.y - 65 : to.y - 20, { steps: 12 });
  await page.mouse.up();
}
try {
  await page.goto(process.argv[3]);
  await seed(freshJourney());
  await page.locator('#exhibit-trilobite').click();
  assert.equal(await page.locator('#activity-title').innerText(), 'Постави фосил');
  assert.equal(await page.locator('.assembly-parts button:visible').count(), 0);
  assert.match(await page.locator('#assembly-feedback').innerText(), /првом налазишту/);
  await page.locator('[data-target="trilobite-whole"]').click();
  assert.deepEqual((await saved()).placed, []);
  await screenshot('empty-slab-placement');

  await seed(ready);
  for (const p of [{ x: 4.5, z: 3 }, { x: 0.55, z: 3 }, { x: 0.55, z: 4.5 }]) await approach(p);
  await page.locator('#assembly-view').waitFor({ state: 'visible' });
  assert.deepEqual((await saved()).placed, [], 'walking onto circle cannot place the slab');
  assert.equal(await page.locator('.assembly-parts button:visible').count(), 1, 'only this stand?s find is shown');
  assert.equal(await page.locator('#assembly-count').innerText(), 'Постављено · 0/1');
  await screenshot('slab-placement');
  await page.locator('#activity-close').click(); await page.waitForTimeout(250);
  assert.equal(await page.locator('dialog').evaluate(el => el.open), false, 'no immediate reopening');
  await page.reload();
  assert.deepEqual((await saved()).placed, []);
  await page.locator('#exhibit-trilobite').click();
  await dragSlab(true); assert.deepEqual((await saved()).placed, [], 'miss is harmless');
  await page.evaluate(() => {
    window.qaSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('QA placement failure', 'QuotaExceededError'); };
  });
  await dragSlab();
  assert.equal(await page.locator('#activity-title').innerText(), 'Постави фосил', 'failed save cannot announce completed placement');
  assert.deepEqual((await saved()).placed, []);
  assert.equal(await page.locator('#activity-retry-save').isVisible(), true);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaSet; });
  await page.locator('#activity-retry-save').click();
  assert.equal(await page.locator('#activity-title').innerText(), 'Упознај трилобита');
  assert.deepEqual((await saved()).placed, [SLAB_PART.id]);
  assert.equal(await page.locator('#exhibit-trilobite').getAttribute('data-state'), 'complete');
  await screenshot('slab-story');
  await page.locator('#activity-close').click();
  await page.reload();
  await page.locator('#exhibit-trilobite').click();
  assert.equal(await page.locator('#story-view').isVisible(), true);
  assert.deepEqual((await saved()).placed, [SLAB_PART.id]);

  for (const [width, height] of [[1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await seed(ready);
    await page.locator('#exhibit-trilobite').click();
    assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
    for (const selector of ['[data-group="trilobite-whole"]', '[data-target="trilobite-whole"]', '#activity-close']) {
      const b = await page.locator(selector).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${selector} visible at ${width}`);
    }
    await screenshot(`slab-placement-${width}`);
    await page.locator('[data-group="trilobite-whole"]').click();
    await page.locator('[data-target="trilobite-whole"]').click();
    assert.deepEqual((await saved()).placed, [SLAB_PART.id]);
    await page.locator('#activity-close').click();
    await page.locator('#exhibit-button').click();
    assert.equal(await page.locator('#assembly-canvas').isVisible(), true);
    assert.equal(await page.locator('#assembly-count').innerText(), 'Постављено · 0/6');
    assert.equal(await page.locator('[data-group="trilobite-whole"]').isVisible(), false);
    await page.locator('#activity-close').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const oldFind = LEGACY_SLAB_SITE.cells.find(c => c.discoveryId === SLAB_PART.discoveryId);
  const old = { ...ready, version: 8, activeSiteId: LEGACY_SLAB_SITE.id, room: 'excavation',
    dig: { ...ready.dig, [oldFind.id]: 1 }, collected: GROUPS.map(g => g.discoveryId),
    placed: GROUPS.map(g => g.id), cleaning: { [SLAB_PART.discoveryId]: [0, 1, 2] } };
  await seed(old);
  assert.equal(await page.locator('#room-name').innerText(), 'Налазиште');
  await page.locator('#clean-button').click();
  assert.equal(await page.locator('#cleaning-progress').evaluate(el => el.value), 3 / 336);
  await screenshot('migrated-cleaning');
  const b = await page.locator('#cleaning-canvas').boundingBox();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5); await page.mouse.down(); await page.mouse.up();
  await page.locator('#activity-close').click();
  assert.equal((await saved()).version, 13); assert.equal((await saved()).activeSiteId, SITE.id);
  assert.deepEqual((await saved()).placed, old.placed);
  assert.ok((await saved()).cleaning[SLAB_PART.discoveryId].length > 3);
  assert.deepEqual((await saved()).closedSites, []);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  assert.deepEqual((await saved()).dig, {});
  assert.equal((await saved()).economy.coins, 20);
  assert.deepEqual(errors, []);
  console.log(`PASS: empty/walk-on/click/drag slab placement, harmless misses, close/reload, failed write/retry, independent exhibit controls, legacy cleaning migration and reset; Edge ${browser.version()}, 1440x1000, 1280x720, 390x844.`);
} catch (error) { await screenshot('failure'); throw error; }
finally { await browser.close(); }
