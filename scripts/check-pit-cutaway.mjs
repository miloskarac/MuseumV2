// Render fixtures use the production world/builders in a disposable browser.
// node scripts/check-pit-cutaway.mjs <playwright index.mjs> <URL> [before|after]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { cameraOffset } from '../src/content/view.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const stage = process.argv[4] ?? 'after', errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.argv[3]);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    Engine.Instances[0].dispose();
    document.querySelector('#app').innerHTML = '<canvas id="cutaway-qa"></canvas>';
    document.querySelector('#app').style.display = 'block';
    const { createWorld } = await import('/src/presentation/world.ts');
    const { SITE, ERYOPS_SITE } = await import('/src/content/journey.ts');
    const { freshJourney } = await import('/src/game/journey.ts');
    const world = createWorld(document.querySelector('#cutaway-qa'));
    window.qaWorld = world;
    window.qaBuild = (levels, empty = false) => {
      const site = levels === 1 ? SITE : ERYOPS_SITE;
      // A future-depth fixture only: never written to localStorage or game content.
      site.grid.levels = levels; site.grid.floorY = -0.7 * levels;
      const state = { ...freshJourney(), room: 'excavation', activeSiteId: site.id,
        dig: Object.fromEntries(site.cells.map(c => [c.id, empty || c.row < 2 && c.column >= 2 && c.column <= 4 ? 1 : 0])) };
      world.changeRoom('excavation', state); world.updateJourney(state);
      const front = site.grid.z - site.grid.rows * site.grid.tileSize / 2;
      world.placePlayer({ x: site.grid.x - 0.2, z: front + 0.38 }, { x: 0, z: 1 }, false, 0);
      world.render();
      return { front, floor: site.grid.floorY };
    };
  });
  for (const levels of [1, 2, 3, 5]) {
    await page.evaluate(levels => window.qaBuild(levels), levels);
    await page.waitForTimeout(100); await page.evaluate(() => window.qaWorld.render());
    await page.screenshot({ path: `docs/qa/pit-cutaway-${stage}-${levels}-layers.png` });
    if (!stage.endsWith('before')) {
      const result = await page.evaluate(async levels => {
        const { Vector3 } = await import('/node_modules/@babylonjs/core/Maths/math.vector.js');
        const { Ray } = await import('/node_modules/@babylonjs/core/Culling/ray.js');
        const scene = window.qaWorld.engine.scenes[0];
        const player = scene.getTransformNodeByName('player'), camera = scene.activeCamera;
        const towardsCamera = camera.position.subtract(camera.getTarget()).normalize();
        const occluders = scene.meshes.filter(m => ['pit-soil-band', 'pit-coping', 'floor-site-earth', 'floor-site-foundation', 'floor-grass-side'].includes(m.name));
        const blocked = [0.12, 0.82, 1.34].flatMap(y => {
          const point = player.position.add(new Vector3(0, y, 0));
          const ray = new Ray(point.add(towardsCamera.scale(50)), towardsCamera.scale(-1), 49.99);
          return occluders.filter(m => { m.computeWorldMatrix(true); return ray.intersectsMesh(m).hit; }).map(m => m.name);
        });
        const seams = scene.meshes.filter(m => m.name === 'soil-front-seam' && m.isEnabled());
        const soil = scene.meshes.filter(m => m.name.startsWith('soil-tile-') && m.isEnabled());
        const bandCount = scene.meshes.filter(m => m.name === 'pit-soil-band').length;
        return { blocked, bandCount, seams: seams.length, expectedSeams: (8 - 3) * levels,
          playerY: player.position.y, soilCount: soil.length, camera: camera.position.asArray() };
      }, levels);
      assert.deepEqual(result.blocked, [], `head, torso and feet visible through front cutaway at ${levels} layers`);
      assert.equal(result.bandCount, 3 * Math.ceil(levels / 2));
      assert.equal(result.seams, result.expectedSeams);
      assert.equal(result.soilCount, (64 - 6) * levels, 'cutaway does not remove diggable dirt');
      assert.ok(Math.abs(result.playerY - (-0.7 * levels + 0.04)) < 1e-6);
      const view = cameraOffset('excavation');
      assert.deepEqual(result.camera, [view.x, view.y, view.z]);
    }
  }
  await page.evaluate(() => window.qaBuild(2, true));
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
    await page.evaluate(() => window.qaWorld.render());
    await page.screenshot({ path: `docs/qa/pit-cutaway-${stage}-floor-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; ${stage} cutaway at 1/2/3/5 layers and empty floor, desktop/mobile${stage === 'after' ? ', head/torso/feet visibility, layer seams, unchanged soil and camera' : ''}.`);
} finally { await browser.close(); }
