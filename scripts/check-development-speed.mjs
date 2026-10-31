// node scripts/check-development-speed.mjs <playwright index.mjs> <dev URL> [production URL]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { freshJourney } from '../src/game/journey.ts';
import { SITE } from '../src/content/journey.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const fresh = { ...freshJourney(), room: 'excavation' };
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('museum-for-luka-v2')));
async function seed(state = fresh) {
  await page.evaluate(state => localStorage.setItem('museum-for-luka-v2', JSON.stringify(state)), state);
  await page.reload();
  await page.locator('.development-speed').waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0];
    window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop();
    engine.getDeltaTime = () => 10;
    window.qaPosition = () => engine.scenes[0].getTransformNodeByName('player').position.asArray();
    delete document.hidden;
  });
}
const ticks = count => page.evaluate(count => { for (let i = 0; i < count; i++) window.qaTick(); }, count);
try {
  await page.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  await page.goto(process.argv[3]);
  const distances = [], contactFrames = [];
  for (const speed of [1, 2, 5, 10]) {
    await seed();
    assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
    await page.locator(`[data-speed="${speed}"]`).click();
    assert.equal(await page.locator('.development-speed [aria-pressed="true"]').textContent(), `×${speed}`);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'CANVAS');
    const start = await page.evaluate(() => window.qaPosition());
    await page.keyboard.down('KeyA'); await page.keyboard.down('KeyS');
    await ticks(10);
    await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS');
    const end = await page.evaluate(() => window.qaPosition());
    distances.push(Math.hypot(end[0] - start[0], end[2] - start[2]));
    await seed(); await page.locator(`[data-speed="${speed}"]`).click();
    contactFrames.push(await page.evaluate(() => {
      for (let i = 1; i <= 100; i++) {
        window.qaTick();
        if (Object.keys(JSON.parse(localStorage.getItem('museum-for-luka-v2')).dig).length) return i;
      }
      throw Error('No shovel contact');
    }));
    assert.deepEqual(Object.values((await saved()).dig), [0.5]);
    await page.locator('.bag-button').click();
    const paused = await saved(); await ticks(30); assert.deepEqual(await saved(), paused);
  }
  [1, 2, 5, 10].forEach((speed, i) => {
    assert.ok(Math.abs(distances[i] / distances[0] - speed) < 0.001, `movement at ×${speed}`);
    assert.ok(Math.abs(contactFrames[i] * 0.01 * speed - 0.72) < 0.101, `contact at ×${speed}`);
  });
  await seed(); await page.locator('[data-speed="10"]').click();
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  const paused = await saved(); await ticks(100); assert.deepEqual(await saved(), paused);
  await page.evaluate(() => { delete document.hidden; });
  await ticks(1); assert.deepEqual(await saved(), paused, 'resume does not catch up hidden time');
  const partial = { ...fresh, collected: [...SITE.requiredDiscoveryIds],
    dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, cell.discoveryId ? 1 : 0])) };
  await seed(partial); await page.locator('[data-speed="10"]').click();
  await ticks(400);
  const completed = await saved();
  assert.deepEqual(completed.closedSites, [SITE.id]); assert.equal(completed.room, 'outdoors');
  assert.deepEqual(completed.collected, partial.collected);
  await ticks(40); assert.deepEqual(await saved(), completed);
  await seed(completed); assert.deepEqual(await saved(), completed);
  assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true');
  await seed(); await ticks(30);
  await page.locator('[data-speed="10"]').click();
  await ticks(4); assert.deepEqual((await saved()).dig, {});
  await ticks(1); assert.deepEqual(Object.values((await saved()).dig), [0.5], 'speed change preserves the current swing');
  const firstHit = await saved(); await seed(firstHit); assert.deepEqual(await saved(), firstHit);
  await page.locator('[data-speed="10"]').click();
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  assert.equal(await page.locator('[data-speed="1"]').getAttribute('aria-pressed'), 'true', 'reset restores normal speed');
  await seed(); await page.locator('[data-speed="5"]').click();
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    await ticks(1);
    const bounds = await page.locator('.development-speed').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `docs/qa/development-speed-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.development-speed').evaluate(element => { element.hidden = true; });
  await page.waitForTimeout(200);
  await ticks(1);
  await page.screenshot({ path: 'docs/qa/development-speed-before.png' });
  if (process.argv[4]) {
    await page.goto(process.argv[4]);
    await page.locator('#room-name').waitFor();
    assert.equal(await page.locator('.development-speed').count(), 0, 'production has no speed control');
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; speed ratios ${distances.map(d => (d / distances[0]).toFixed(2))}; first contacts at frames ${contactFrames}; modal/hidden pause, cleanup/reload, responsive controls${process.argv[4] ? ', production exclusion' : ''}.`);
} finally { await browser.close(); }
