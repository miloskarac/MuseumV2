// Isolated Eryops visual checks and second-site-to-museum journey.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ALL_PARTS, FIRST_PARTS, ERYOPS_GROUPS } from '../src/content/exhibit.ts';
import { SITE, ERYOPS_SITE, SITE_PLOTS, siteFront } from '../src/content/journey.ts';
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
  collected: FIRST_PARTS.map(p => p.discoveryId), closedSites: [SITE.id] };
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(state) {
  await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, state]);
  await page.reload();
  await page.locator('#room-name').waitFor();
  await inspectScene();
}
async function inspectScene() {
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
}
const screenshot = name => page.screenshot({ path: `docs/qa/eryops-${name}.png` });
async function approach(target, untilRoom) {
  for (let i = 0; i < 180; i++) {
    if (untilRoom && (await saved())?.room === untilRoom) return;
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
  throw Error(`Walking route did not reach ${JSON.stringify(target)}`);
}
const complete = { ...ready, activeSiteId: ERYOPS_SITE.id,
  dig: { ...ready.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) },
  collected: ALL_PARTS.map(p => p.discoveryId), placed: ALL_PARTS.map(p => p.id), closedSites: [SITE.id, ERYOPS_SITE.id] };
const position = () => page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
async function stroke(y) {
  const b = await page.locator('#cleaning-canvas').boundingBox();
  await page.mouse.move(b.x + b.width * 0.025, b.y + b.height * y); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.975, b.y + b.height * y, { steps: 10 }); await page.mouse.up();
}
try {
  await page.goto(process.argv[3]);
  await seed(complete); await page.waitForTimeout(600); await screenshot('museum-complete');
  await page.locator('#exhibit-eryops').click(); await page.waitForTimeout(500); await screenshot('story');
  await seed({ ...complete, placed: FIRST_PARTS.map(p => p.id) });
  await page.locator('#exhibit-eryops').click(); await page.waitForTimeout(300); await screenshot('assembly');
  assert.equal(await page.locator('.assembly-parts button:visible').count(), 6);
  assert.equal(await page.locator('[data-group="eryops-skull"] .part-number').innerText(), '1');
  await page.locator('[data-group="eryops-skull"]').click();
  await page.locator('[data-target="eryops-tail"]').click();
  assert.deepEqual((await saved()).placed, FIRST_PARTS.map(p => p.id));
  await page.locator('[data-target="eryops-skull"]').click();
  assert.equal(await page.locator('#exhibit-eryops').getAttribute('data-state'), 'partial');
  await page.locator('#activity-close').click(); await screenshot('museum-partial');
  const partial = await saved(); await seed(partial);
  assert.deepEqual(await saved(), partial);
  for (const id of ['exhibit-button', 'exhibit-trilobite', 'exhibit-eryops']) {
    await page.locator(`#${id}`).click(); await page.locator('#activity-close').click();
  }
  await page.locator('#exhibit-eryops').click();
  for (const p of ERYOPS_GROUPS.slice(1)) {
    await page.locator(`[data-group="${p.id}"]`).click(); await page.locator(`[data-target="${p.id}"]`).click();
  }
  assert.equal(await page.locator('#story-view').isVisible(), true);
  assert.equal(await page.locator('.story-facts h3').count(), 4);
  assert.equal(await page.locator('#exhibit-eryops').getAttribute('data-state'), 'complete');
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await screenshot(`story-${width}`);
    await seed({ ...complete, placed: FIRST_PARTS.map(p => p.id) });
    await page.locator('#exhibit-eryops').click(); await page.waitForTimeout(300);
    for (const selector of ['[data-group="eryops-skull"]', '[data-target="eryops-skull"]', '#activity-close']) {
      const b = await page.locator(selector).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, selector);
    }
    await screenshot(`assembly-${width}`);
    await seed(complete); await screenshot(`museum-${width}`);
    const label = await page.locator('.portal-label').boundingBox();
    assert.ok(label.x >= 0 && label.x + label.width <= width, 'exit label fits the viewport');
    await page.locator('#exhibit-eryops').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (!process.argv.includes('--visual')) {
    await seed({ ...ready, version: 9, placed: FIRST_PARTS.map(p => p.id), room: 'outdoors' });
    for (const p of [{ x: -2.4, z: -1.5 }, { x: -2.4, z: -2.7 }, { x: 0, z: -2.7 }]) await approach(p);
    await approach(SITE_PLOTS[1].entrance, 'excavation');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).activeSiteId === 'eryops-dig', SAVE_KEY);
    assert.equal((await saved()).version, 13);
    await screenshot('second-site');
    let previousCell = ERYOPS_SITE.cells.find(c => c.row === 7 && c.column === 3);
    // Stop over the ladder, then move down the recovered column one find at a time.
    await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] === 1, [SAVE_KEY, previousCell.id], { timeout: 20000 });
    for (const part of ERYOPS_GROUPS) {
      await approach({ x: previousCell.x, z: previousCell.z - 0.3 });
      await page.locator('#cleaning-view').waitFor({ state: 'visible', timeout: 25000 });
      assert.equal(await page.locator('.cleaning-details h3').innerText(), part.label);
      if (part.id === 'eryops-skull') { await stroke(0.42); await screenshot('cleaning'); }
      for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) await stroke(y);
      await page.locator('#collect-fossil').click();
      previousCell = ERYOPS_SITE.cells.find(c => c.discoveryId === part.discoveryId);
    }
    await page.waitForTimeout(1200); await screenshot('cleanup');
    const duringCleanup = await saved(); await page.reload();
    await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).closedSites.includes(id), [SAVE_KEY, ERYOPS_SITE.id], { timeout: 45000 });
    await inspectScene();
    assert.deepEqual(await position(), siteFront(ERYOPS_SITE));
    await seed(await saved());
    for (const [id, progress] of Object.entries(duringCleanup.dig)) assert.ok((await saved()).dig[id] >= progress);
    await page.locator('#bag-button').click(); assert.equal(await page.locator('#bag-list svg').count(), 6); await screenshot('bag');
    await page.locator('#activity-close').click();
    for (const p of [{ x: 2.4, z: -2.7 }, { x: 2.4, z: 2.5 }]) await approach(p);
    await approach({ x: 5.4, z: 3.7 }, 'museum');
    assert.equal((await saved()).room, 'museum');
    for (const p of [{ x: 4.5, z: 3 }, { x: -6, z: 3 }, { x: -6, z: -2.45 }, { x: -11, z: -2.45 }]) await approach(p);
    await page.locator('#assembly-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.assembly-parts button:visible').count(), 6);
    assert.deepEqual((await saved()).placed, FIRST_PARTS.map(p => p.id));
    await screenshot('walk-on-assembly');
    await page.locator('#activity-close').click(); await page.waitForTimeout(300);
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Eryops ${process.argv.includes('--visual') ? 'visual/assembly checks' : 'full site and museum journey'}, independent assembly, wrong target, partial reload, exhibit switching and responsive cards; Edge ${browser.version()}.`);
} catch (error) { await screenshot('failure'); console.log('Position/save', await position().catch(() => null), await saved()); throw error; }
finally { await browser.close(); }
