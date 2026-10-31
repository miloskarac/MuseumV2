// Optional QA helper: use an existing Playwright installation without a game dependency.
// node scripts/check-browser.mjs <playwright index.mjs path> <Vite URL> [screenshot prefix]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SITE, SITE_PLOTS } from '../src/content/journey.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const screenshotPrefix = process.argv[4] ?? 'docs/qa/phase1';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) console.log(response.status(), response.url()); });
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(process.argv[3]);
  await page.waitForTimeout(1800);
  // Inspect the existing engine; no test globals or teleport hooks in the app.
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const url = source.match(/import \{ Engine \} from "([^"]+)"/)[1];
    const { Engine } = await import(url);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
  const position = () => page.evaluate(() => {
    const p = window.qaScene().getTransformNodeByName('player').position;
    return { x: p.x, z: p.z };
  });
  const cameraView = () => page.evaluate(() => {
    const c = window.qaScene().activeCamera;
    return [c.position.asArray(), c.getTarget().asArray(), c.orthoLeft, c.orthoRight, c.orthoTop, c.orthoBottom];
  });
  const museumCamera = await cameraView();
  const walk = async (keys, milliseconds) => {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(milliseconds);
    for (const key of keys) await page.keyboard.up(key);
  };
  await page.screenshot({ path: `${screenshotPrefix}-after.png` });
  const start = await position();
  await walk(['ArrowRight'], 300);
  let next = await position();
  assert.ok(next.x > start.x && next.z > start.z, 'right moves screen-right');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const stopped = await position();
  await page.waitForTimeout(250);
  assert.deepEqual(await position(), stopped, 'blur clears held movement');
  await page.keyboard.up('KeyW');
  // Follow a clear route using real keyboard input, recalculating screen-relative intent.
  const approach = async (target, untilRoom) => {
    for (let i = 0; i < 140; i++) {
      if (untilRoom && await page.locator('#room-name').innerText() === untilRoom) return;
      const p = await position();
      const dx = target.x - p.x, dz = target.z - p.z;
      if (Math.hypot(dx, dz) < 0.18) return;
      // Short back-path waypoints correct eight-direction drift before the wall.
      const steerX = p.z > 4.7 && target.z > 4.7 ? Math.sign(dx) * Math.min(0.5, Math.abs(dx)) : dx;
      const h = steerX * 0.8 + dz * 0.6, v = steerX * -0.6 + dz * 0.8;
      const keys = [];
      if (Math.abs(h) > Math.max(0.06, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
      if (Math.abs(v) > Math.max(0.06, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
      await walk(keys, 80);
    }
    throw new Error(`Could not reach ${JSON.stringify(target)} from ${JSON.stringify(await position())}; modal=${await page.locator('dialog').evaluate(el => el.open)}`);
  };
  await approach({ x: 5.4, z: 0 });
  await approach({ x: 5.4, z: 3.7 }, 'Налазишта');
  assert.equal(await page.locator('#room-name').innerText(), 'Налазишта');
  await page.waitForTimeout(250);
  assert.deepEqual(await position(), { x: 5.4, z: 1.6 }, 'arrival outside trigger, held input cleared');
  assert.deepEqual(await cameraView(), museumCamera, 'both rooms use the same camera and framing');
  await page.screenshot({ path: `${screenshotPrefix}-outdoors.png` });
  for (const p of [{ x: 2.8, z: 2.5 }, { x: -2.4, z: 2.5 }, { x: -2.4, z: -1.5 }, SITE_PLOTS[1].entrance]) await approach(p);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#room-name').innerText(), 'Налазишта', 'locked site cannot be entered');
  assert.match(await page.locator('#dig-hint').innerText(), /није део ове пустоловине/);
  for (const p of [{ x: -2.4, z: -1.5 }, { x: -4.5, z: -1.5 }]) await approach(p);
  await approach(SITE_PLOTS[0].entrance, 'Налазиште');
  assert.deepEqual(await position(), { x: SITE.interaction.x, z: SITE.interaction.z });
  assert.deepEqual(await cameraView(), museumCamera, 'site camera unchanged');
  const pitGeometry = await page.evaluate(() => {
    const scene = window.qaScene();
    const bed = scene.getMeshByName('pit-earth-bottom');
    const floorOverHole = scene.meshes.filter(mesh => mesh.name.startsWith('floor')).some(mesh => {
      const bounds = mesh.getBoundingInfo().boundingBox;
      return bounds.minimumWorld.x < 1.24 && bounds.maximumWorld.x > -3.84
        && bounds.minimumWorld.z < 2.79 && bounds.maximumWorld.z > -2.29;
    });
    return { bedTop: bed.getBoundingInfo().boundingBox.maximumWorld.y, floorOverHole };
  });
  assert.ok(pitGeometry.bedTop < -0.6, 'soil bed sits below the walking surface');
  assert.equal(pitGeometry.floorOverHole, false, 'floor does not cover the recessed excavation');
  await page.screenshot({ path: `${screenshotPrefix}-excavation.png` });
  // Cross untouched soil with held movement. At the far wall, keep holding:
  // blocked movement intent must not silently become a digging command.
  const soilBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('museum-for-luka-v2')).dig);
  await page.evaluate(() => {
    window.qaWalkHeights = [];
    window.qaWalkObserver = window.qaScene().onAfterRenderObservable.add(() => {
      const p = window.qaScene().getTransformNodeByName('player').position;
      window.qaWalkHeights.push(p.y);
    });
  });
  await walk(['KeyA', 'KeyS'], 3400);
  const crossed = await position();
  assert.ok(crossed.z < -3.4 && crossed.z > -3.7, 'walked across all eight soil rows and stopped at the wall');
  const walkHeights = await page.evaluate(() => {
    window.qaScene().onAfterRenderObservable.remove(window.qaWalkObserver); return window.qaWalkHeights;
  });
  assert.ok(walkHeights.every(y => y >= 0.039), 'feet remain above untouched soil');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('museum-for-luka-v2')).dig), soilBefore, 'walking and holding into a wall never excavate');
  await page.screenshot({ path: `${screenshotPrefix}-on-soil.png` });
  await approach({ x: SITE.interaction.x, z: SITE.interaction.z - 1.15 });
  await approach(SITE.interaction);
  for (const target of [{ x: 4, z: 5.1 }, { x: 4, z: -4.7 }, { x: -6.3, z: -4.7 }, { x: -6.3, z: 5.1 }, { x: 4, z: 5.1 }]) {
    await approach(target);
  }
  // The outer wall still blocks crossing away from the ladder.
  await approach({ x: 4, z: -4.7 });
  await approach({ x: -1.3, z: -4.7 });
  await walk(['KeyW', 'KeyD'], 400);
  const atPit = await position();
  assert.ok(atPit.z <= -4.24 && atPit.z > -4.5, 'pit wall blocks the player');
  await approach({ x: -1.3, z: -4.7 });
  await approach({ x: 4, z: -4.7 });
  await approach({ x: 5.4, z: 1.6 });
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const bounds = await page.locator('.portal-label').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, `excavation portal visible at ${width}x${height}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${screenshotPrefix}-excavation-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await approach({ x: 5.4, z: 3.7 }, 'Налазишта');
  for (const p of [{ x: -2.4, z: -1.5 }, { x: -2.4, z: 2.5 }, { x: 2.8, z: 2.5 }]) await approach(p);
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(250);
    for (const selector of ['.portal-label', ...SITE_PLOTS.map(plot => `#label-${plot.id}`)]) {
      const b = await page.locator(selector).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${selector} in outdoor viewport`);
    }
    await page.screenshot({ path: `${screenshotPrefix}-outdoors-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await approach({ x: 5.4, z: 3.7 }, 'Музеј');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#room-name').innerText(), 'Музеј');
  assert.deepEqual(await position(), { x: 5.4, z: 1.6 }, 'return does not bounce');
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const selector of ['.portal-label', '#exhibit-button']) {
      const bounds = await page.locator(selector).boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, `${selector} visible at ${width}x${height}`);
    }
    await page.screenshot({ path: `${screenshotPrefix}-${width}x${height}.png` });
  }
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(`PASS: Edge ${browser.version()}; movement, blur, pit circuit/collision/depth, matched cameras, round trip, safe arrivals, responsive labels in both rooms, no console errors. Screenshots: ${screenshotPrefix}-*.png`);
} catch (error) {
  await page.screenshot({ path: `${screenshotPrefix}-failure.png` });
  throw error;
} finally {
  await browser.close();
}
