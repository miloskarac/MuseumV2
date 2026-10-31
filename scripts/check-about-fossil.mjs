// Disposable profile; real keyboard navigation with deterministic browser frames.
// node scripts/check-about-fossil.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ALL_PARTS, exhibitDefinition } from '../src/content/exhibit.ts';
import { SITES } from '../src/content/journey.ts';
import { EXHIBIT_SPOTS } from '../src/game/navigation.ts';
import { freshJourney } from '../src/game/journey.ts';
import { parseSave } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const fixture = { ...freshJourney(), dig: Object.fromEntries(SITES.flatMap(site => site.cells.map(cell => [cell.id, 1]))),
  collected: ALL_PARTS.map(part => part.discoveryId), placed: ALL_PARTS.map(part => part.id), closedSites: SITES.map(site => site.id) };
assert.ok(parseSave(JSON.stringify(fixture)));
const tick = (count = 1) => page.evaluate(count => { for (let i = 0; i < count; i++) window.qaTick(); }, count);
const isOpen = () => page.locator('dialog').evaluate(element => element.open);
async function seed(state = fixture) {
  await page.evaluate(state => localStorage.setItem('museum-for-luka-v2', JSON.stringify(state)), state);
  await page.reload(); await page.locator('#room-name').waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0]; window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop();
    engine.getDeltaTime = () => 20;
    window.qaPosition = () => engine.scenes[0].getTransformNodeByName('player').position.asArray();
    delete document.hidden;
  });
}
async function walk(target, expectAssembly = false) {
  for (let i = 0; i < 400; i++) {
    if (expectAssembly && await isOpen()) return;
    assert.equal(await isOpen(), false, 'walking past completed exhibits never opens a window');
    const [x, , z] = await page.evaluate(() => window.qaPosition()), dx = target.x - x, dz = target.z - z;
    if (Math.hypot(dx, dz) < 0.16) return;
    const h = dx * 0.8 + dz * 0.6, v = dx * -0.6 + dz * 0.8, keys = [];
    if (Math.abs(h) > Math.max(0.035, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.035, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key);
    await tick(2);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Could not reach ${JSON.stringify(target)} from ${JSON.stringify(await page.evaluate(() => window.qaPosition()))}`);
}
async function approach(spot, expectAssembly = false) {
  if (spot.id === 'trilobite') {
    await walk({ x: 4, z: 2.9 }); await walk({ x: spot.x, z: 2.9 });
  } else {
    await walk({ x: 4, z: -4.8 });
    // Short waypoints keep keyboard diagonals clear of the bench on the long route.
    if (spot.id === 'eryops') for (const x of [2, 0, -2, -4, -6, -8, -10, -11]) await walk({ x, z: -5.1 });
    else await walk({ x: spot.x, z: -4.8 });
  }
  await walk(spot, expectAssembly); await tick(2);
}
try {
  await page.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  await page.goto(process.argv[3]);
  for (const spot of EXHIBIT_SPOTS) {
    await seed(); assert.equal(await page.locator('#about-fossil').isVisible(), false);
    await approach(spot); await tick(40);
    assert.equal(await isOpen(), false);
    assert.equal(await page.locator('#about-fossil').textContent(), 'О фосилу');
    assert.equal(await page.locator('#about-fossil').isVisible(), true);
    await page.screenshot({ path: `docs/qa/about-fossil-${spot.id}.png` });
    await page.locator('#about-fossil').click();
    assert.equal(await page.locator('#activity-title').textContent(), exhibitDefinition(spot.id).text.storyTitle);
    assert.equal(await page.locator('#about-fossil').isVisible(), false);
    await page.locator('#activity-close').click(); await tick(40);
    assert.equal(await isOpen(), false);
    assert.equal(await page.locator('#about-fossil').isVisible(), true);
    await page.locator('#about-fossil').focus(); await page.keyboard.press('Enter');
    assert.equal(await isOpen(), true);
    await page.keyboard.press('Escape'); await tick(2);
    await page.locator('#bag-button').click(); await tick(2);
    assert.equal(await page.locator('#about-fossil').isVisible(), false);
    await page.locator('#activity-close').click(); await tick(2);
    await walk({ x: spot.x, z: spot.z - 1.7 });
    assert.equal(await page.locator('#about-fossil').isVisible(), false, 'leaving hides the button');
    await walk(spot); await tick(2);
    assert.equal(await isOpen(), false);
    assert.equal(await page.locator('#about-fossil').isVisible(), true);
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150); await tick();
      const b = await page.locator('#about-fossil').boundingBox();
      const reset = await page.locator('#reset-button').boundingBox();
      assert.ok(b.x >= 0 && b.x + b.width <= width && b.y >= 0 && b.y + b.height <= height);
      assert.ok(b.y + b.height <= reset.y, 'about button stays clear of reset');
      if (spot.id === 'dimetrodon') await page.screenshot({ path: `docs/qa/about-fossil-${width}x${height}.png` });
    }
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('museum-for-luka-v2'))), fixture);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await seed({ ...fixture, placed: fixture.placed.filter(id => id !== 'tail') });
  await approach(EXHIBIT_SPOTS[0], true);
  assert.equal(await page.locator('#assembly-view').isVisible(), true);
  assert.equal(await page.locator('#story-view').isVisible(), false);
  assert.equal(await page.locator('#about-fossil').isVisible(), false);
  await page.locator('[data-group="tail"]').click(); await page.locator('[data-target="tail"]').click();
  assert.equal(await page.locator('#story-view').isVisible(), true, 'final placement still celebrates completion');
  await page.locator('#activity-close').click(); await tick(2);
  assert.equal(await page.locator('#about-fossil').isVisible(), true);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click(); await tick();
  assert.equal(await page.locator('#about-fossil').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; all three circles, optional story, mouse/keyboard, close/reopen, leave/re-enter, bag, reload, assembly/completion, reset and responsive bounds.`);
} finally { await browser.close(); }
