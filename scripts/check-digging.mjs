// Focused render/animation QA. Disposable browser context; no production hooks.
// node scripts/check-digging.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SITE } from '../src/content/journey.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.addInitScript(() => {
    localStorage.setItem('museum-for-luka-v2', JSON.stringify({ version: 3, room: 'excavation', dig: {}, cleaning: {}, collected: [] }));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  });
  await page.goto(process.argv[3]);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0], scene = engine.scenes[0];
    window.qaScene = scene; window.qaEngine = engine;
    window.qaLoop = engine.activeRenderLoops[0];
    window.qaHold = 'raised'; window.qaFrozen = false;
    window.qaFrames = [];
    scene.onAfterRenderObservable.add(() => {
      const tile = scene.getMeshByName('soil-tile-courtyard-r7-c3');
      const shovel = scene.getTransformNodeByName('dig-shovel');
      const rig = scene.getTransformNodeByName('dig-rig');
      const sample = { height: tile.scaling.y, enabled: tile.isEnabled(), material: tile.material.name,
        shovel: rig.isEnabled(), lift: shovel.position.y,
        lean: scene.getTransformNodeByName('player-torso').rotation.x,
        bladeY: scene.getMeshByName('shovel-blade').getBoundingInfo().boundingBox.minimumWorld.y,
        player: scene.getTransformNodeByName('player').position.asArray(),
        feet: scene.meshes.filter(m => m.name === 'shoe').map(m => m.absolutePosition.y) };
      window.qaFrames.push(sample);
      if ((window.qaHold === 'raised' && sample.shovel && sample.lift > 0.429)
        || (window.qaHold === 'first-hit' && sample.height < 1 && sample.enabled)
        || (window.qaHold === 'second-hit' && !sample.enabled)) {
        engine.stopRenderLoop(); window.qaFrozen = true;
      }
    });
    delete document.hidden;
  });
  for (const pose of ['raised', 'first-hit', 'second-hit']) {
    if (pose !== 'raised') await page.evaluate(pose => {
      window.qaHold = pose; window.qaFrozen = false; window.qaEngine.runRenderLoop(window.qaLoop);
    }, pose);
    await page.waitForFunction(() => window.qaFrozen);
    await page.screenshot({ path: `docs/qa/polish-${pose}.png` });
  }
  const frames = await page.evaluate(() => window.qaFrames);
  const first = frames.findIndex(f => f.height < 1);
  const second = frames.findIndex(f => !f.enabled);
  assert.ok(first > 0 && second > first);
  assert.ok(frames.slice(0, first).every(f => f.height === 1));
  assert.ok(frames.slice(first, second).every(f => f.height === 0.9));
  assert.equal(new Set(frames.map(f => f.material)).size, 1, 'same material for both hits');
  assert.ok(frames[first].shovel && frames[second].shovel, 'both changes occur with the shovel visible');
  assert.ok(Math.abs(frames[first].bladeY) < 0.045 && Math.abs(frames[second].bladeY + 0.07) < 0.045, 'blade reaches the pre-hit soil surface');
  assert.ok(frames.some(f => f.lean > 0.14), 'visible hip lean at contact');
  assert.ok(frames.every(f => f.player.every((n, i) => n === frames[0].player[i])), 'digging never slides the character');
  assert.ok(frames.every(f => f.feet.every((y, i) => Math.abs(y - frames[0].feet[i]) < 0.001)), 'feet stay planted during the lean');
  assert.ok(frames.filter(f => f.lift > 0.4).length > 5, 'visible windup frames before contact');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('museum-for-luka-v2')));
  assert.deepEqual(Object.values(save.dig), [1], 'only the struck tile clears');

  const depthSamples = await page.evaluate(async () => {
    const { SITE } = await import('/src/content/journey.ts');
    const { shapes } = await import('/src/presentation/shapes.ts');
    const { buildDiscovery } = await import('/src/presentation/discovery.ts');
    const original = window.qaScene;
    const scene = new original.constructor(window.qaEngine);
    try {
      const site = { ...SITE, grid: { ...SITE.grid, levels: 2, floorY: -1.4 } };
      const materials = [0, 1, 2, 3].map(i => original.getMaterialByName(`dig-soil-${i}`));
      const update = buildDiscovery(shapes(scene, () => {}), original.getMaterialByName('fossil-ivory'), materials, site);
      return [0, 0.25, 0.5, 0.75, 1].map(progress => {
        update({ version: 3, room: 'excavation', dig: { [site.cells[0].id]: progress }, cleaning: {}, collected: [] });
        const tiles = scene.meshes.filter(m => m.name.startsWith(`soil-tile-${site.cells[0].id}`) && m.isEnabled());
        const tile = tiles.sort((a, b) => b.position.y - a.position.y)[0];
        return { material: tile?.material.name, height: tiles.length, enabled: !!tile };
      });
    } finally { scene.dispose(); }
  });
  assert.equal(depthSamples[0].material, depthSamples[1].material);
  assert.equal(depthSamples[1].material, depthSamples[2].material, 'one soil band covers both layers');
  assert.equal(depthSamples[2].material, depthSamples[3].material);
  assert.ok(depthSamples[2].height < depthSamples[1].height);
  assert.equal(depthSamples[4].enabled, false);
  // Full pit bounds and exit stay visible at the existing supported viewports.
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    await page.evaluate(() => window.qaScene.render());
    await page.screenshot({ path: `docs/qa/polish-framing-${width}x${height}.png` });
    const points = await page.evaluate(async () => {
      const { Vector3, Matrix } = await import('/node_modules/@babylonjs/core/Maths/math.vector.js');
      const { SITE } = await import('/src/content/journey.ts');
      const scene = window.qaScene, engine = window.qaEngine, camera = scene.activeCamera;
      const g = SITE.grid, viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
      return [-1, 1].flatMap(x => [-1, 1].map(z => {
        const p = Vector3.Project(new Vector3(g.x + x * g.columns * g.tileSize / 2, 0, g.z + z * g.rows * g.tileSize / 2),
          Matrix.Identity(), scene.getTransformMatrix(), viewport);
        return { x: p.x / engine.getRenderWidth(), y: p.y / engine.getRenderHeight() };
      }));
    });
    assert.ok(points.every(p => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1), `full pit in ${width}x${height}`);
  }
  assert.equal(SITE.grid.levels, 1);
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}, two visible shovel contacts, retained first-hit material, no early disappearance, two-layer rendering fixture, full-pit framing.`);
} finally { await browser.close(); }
