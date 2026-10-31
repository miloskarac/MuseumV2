// Isolated Edge QA. node scripts/check-depth-progression.mjs <playwright index.mjs> <URL> [before]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SITE, ERYOPS_SITE, siteFront } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { screenDirection } from '../src/game/navigation.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const stage = process.argv[4] ?? 'layer-order';
const ready = { ...freshJourney(), activeSiteId: ERYOPS_SITE.id, room: 'excavation',
  collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id],
  dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) };
async function seed(state) {
  await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, state]);
  await page.reload(); await page.locator('#room-name').waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
  await page.waitForTimeout(350);
}
const screenshot = name => page.screenshot({ path: `docs/qa/depth-${stage}-${name}.png` });
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const position = () => page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, y: p.y, z: p.z }; });
async function approach(target) {
  for (let i = 0; i < 180; i++) {
    const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.14) return;
    const right = screenDirection(1, 0, 'excavation'), up = screenDirection(0, 1, 'excavation');
    const h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.06, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.06, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(80);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Could not walk to ${JSON.stringify(target)} from ${JSON.stringify(await position())}`);
}
try {
  await page.goto(process.argv[3]);
  for (const [name, progress] of [['terraces', c => c.row === 7 || c.column < 4 ? 1 : 0.5], ['floor', () => 1]]) {
    await seed({ ...ready, dig: { ...ready.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, progress(c)])) } });
    await screenshot(name);
  }
  if (stage !== 'before') {
    // Both pits share exactly the first site's camera, regardless of depth.
    const camera = () => page.evaluate(() => {
      const c = window.qaScene().activeCamera; return { position: c.position.asArray(), target: c.getTarget().asArray(),
        ortho: [c.orthoLeft, c.orthoRight, c.orthoTop, c.orthoBottom] };
    });
    const secondCamera = await camera();
    await seed({ ...freshJourney(), room: 'excavation' });
    assert.deepEqual(secondCamera, await camera());
    // Verify the real keyboard path uses this room's rotated screen basis.
    const start = await position();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(180); await page.keyboard.up('KeyD');
    const end = await position(), right = screenDirection(1, 0, 'excavation');
    const dx = end.x - start.x, dz = end.z - start.z;
    assert.ok(dx * right.x + dz * right.z > 0.1, 'D moves screen-right');
    assert.ok(Math.abs(dx * -right.z + dz * right.x) < 0.015, 'D does not drift vertically');

    // A remote unfinished upper tile blocks lower digging even when standing
    // directly on the lower surface. The last upper hit unlocks the next layer.
    const lower = ERYOPS_SITE.cells.find(c => c.row === 3 && c.column === 3), lastUpper = ERYOPS_SITE.cells[0];
    const gated = { ...ready, dig: { ...ready.dig,
      ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 0.5])), [lastUpper.id]: 0.25 } };
    await seed(gated);
    await approach({ x: ERYOPS_SITE.interaction.x, z: ERYOPS_SITE.interaction.z - 1.4 });
    await approach(lower); await page.waitForTimeout(2200);
    assert.equal((await saved()).dig[lower.id], 0.5);
    assert.equal(await page.evaluate(() => window.qaScene().getTransformNodeByName('dig-rig').isEnabled()), false);
    await screenshot('lower-layer-locked');
    await approach(lastUpper);
    await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] >= 0.5, [SAVE_KEY, lastUpper.id]);
    await approach(lower);
    await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] > 0.5, [SAVE_KEY, lower.id]);
    await screenshot('next-layer-open');

    // Real controls: descend, excavate all layers of a four-tile tail, reload
    // a partial hit, clean, collect, resume cleanup and exit up the ladder.
    const id = ERYOPS_SITE.requiredDiscoveryIds.at(-1), cells = ERYOPS_SITE.cells.filter(c => c.discoveryId === id);
    const leftovers = ERYOPS_SITE.cells.filter(c => !c.discoveryId && c.row === 0).slice(0, 2);
    const dig = { ...ready.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c =>
      [c.id, c.discoveryId === id ? 0.5 : leftovers.includes(c) ? 0.5 : 1])) };
    await seed({ ...ready, dig, collected: [...ready.collected, ...ERYOPS_SITE.requiredDiscoveryIds.filter(other => other !== id)] });
    await approach({ x: ERYOPS_SITE.interaction.x, z: ERYOPS_SITE.interaction.z - 1.8 });
    await page.waitForTimeout(350);
    assert.ok(Math.abs((await position()).y - (ERYOPS_SITE.grid.floorY + 0.04)) < 0.1, 'player reaches the deeper floor');
    await screenshot('player-on-floor');
    for (const [i, cell] of cells.entries()) {
      await approach(cell);
      if (i === 0) {
        await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] === 0.75, [SAVE_KEY, cell.id]);
        const partial = await saved();
        await seed(partial);
        assert.equal((await saved()).dig[cell.id], 0.75, 'first hit of the lower layer survives reload');
        await approach({ x: ERYOPS_SITE.interaction.x, z: ERYOPS_SITE.interaction.z - 1.4 });
        await approach(cell);
      }
      await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] === 1, [SAVE_KEY, cell.id], { timeout: 12000 });
      if (i < cells.length - 1) assert.equal(await page.locator('#cleaning-view').isVisible(), false);
    }
    await page.locator('#cleaning-view').waitFor({ state: 'visible' });
    for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) {
      const b = await page.locator('#cleaning-canvas').boundingBox();
      await page.mouse.move(b.x + b.width * 0.025, b.y + b.height * y); await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.975, b.y + b.height * y, { steps: 10 }); await page.mouse.up();
    }
    await page.locator('#collect-fossil').click();
    const cleanup = await saved();
    assert.equal(cleanup.collected.filter(found => found === id).length, 1);
    await seed(cleanup);
    await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).closedSites.includes(id), [SAVE_KEY, ERYOPS_SITE.id], { timeout: 30000 });
    const p = await position(), front = siteFront(ERYOPS_SITE);
    assert.ok(Math.hypot(p.x - front.x, p.z - front.z) < 0.02);
    assert.equal((await saved()).collected.filter(found => found === id).length, 1);
    await screenshot('closed');

    // Five-layer rendering fixture, using the same production builders. This
    // does not add or unlock a site and never changes the user's browser save.
    await seed({ ...ready, dig: { ...ready.dig, ...Object.fromEntries(ERYOPS_SITE.cells.map(c => [c.id, 1])) } });
    const fixture = await page.evaluate(async () => {
      const { SITE, DEPTH_COLORS, soilColorIndex, EXCAVATION_DEPTH } = await import('/src/content/journey.ts');
      const { shapes } = await import('/src/presentation/shapes.ts');
      const { buildExcavation } = await import('/src/presentation/excavation.ts');
      const { buildDiscovery } = await import('/src/presentation/discovery.ts');
      const scene = window.qaScene(); scene.getEngine().stopRenderLoop();
      scene.meshes.forEach(m => m.setEnabled(false));
      const material = (name, hex) => {
        const m = scene.getMaterialByName('dig-soil-0').clone(name);
        m.diffuseColor = m.diffuseColor.constructor.FromHexString(hex); return m;
      };
      const palette = Object.fromEntries(Object.entries({ cream: 'plaster', rim: 'pale-limestone', tealDark: 'teal-base',
        brass: 'soft-brass', wood: 'warm-oak', teal: 'painted-teal', grout: 'tile-grout' }).map(([k, n]) => [k, scene.getMaterialByName(n)]));
      const site = { ...SITE, grid: { ...SITE.grid, levels: 5, floorY: -5 * EXCAVATION_DEPTH.layerHeight },
        cells: SITE.cells.map(c => ({ ...c, id: `qa-${c.id}` })) };
      const shape = shapes(scene, () => {});
      const start = scene.meshes.length;
      buildExcavation(shape, material, palette, site);
      const update = buildDiscovery(shape, scene.getMaterialByName('fossil-ivory'),
        DEPTH_COLORS.map((hex, i) => material(`qa-soil-${i}`, hex)), site);
      const all = scene.meshes.slice(start), cell = site.cells.find(c => c.row === 3 && c.column === 3);
      const base = { dig: {}, collected: [] };
      const samples = [];
      for (let hits = 0; hits <= 10; hits++) {
        update({ ...base, dig: { [cell.id]: hits / 10 } });
        const tiles = all.filter(m => m.name.startsWith(`soil-tile-${cell.id}`) && m.isEnabled());
        for (const m of tiles) m.computeWorldMatrix(true);
        const top = tiles.reduce((a, b) => a.getBoundingInfo().boundingBox.maximumWorld.y > b.getBoundingInfo().boundingBox.maximumWorld.y ? a : b, tiles[0]);
        samples.push({ count: tiles.length, color: top?.material.diffuseColor.toHexString().toLowerCase(),
          top: top?.getBoundingInfo().boundingBox.maximumWorld.y });
      }
      const walls = all.filter(m => m.name === 'pit-soil-band').map(m => {
        m.computeWorldMatrix(true); const b = m.getBoundingInfo().boundingBox;
        return { bottom: b.minimumWorld.y, top: b.maximumWorld.y, color: m.material.diffuseColor.toHexString().toLowerCase() };
      });
      update({ ...base, dig: Object.fromEntries(site.cells.map(c => [c.id, c.column < 3 ? 1 : (7 - c.column) / 5])) });
      scene.render();
      return { samples, walls, colors: DEPTH_COLORS, floor: site.grid.floorY,
        rungs: all.filter(m => m.name === 'pit-ladder-rung').length,
        indices: Array.from({ length: 5 }, (_, i) => soilColorIndex(i)) };
    });
    assert.deepEqual(fixture.indices, [0, 0, 1, 1, 2]);
    for (let hits = 0; hits < 10; hits++) {
      const sample = fixture.samples[hits], layer = Math.floor(hits / 2);
      assert.equal(sample.count, 5 - layer);
      assert.equal(sample.color, fixture.colors[Math.floor(layer / 2)]);
      assert.ok(Math.abs(sample.top + (layer + hits % 2 * 0.1) * 0.7) < 1e-6);
    }
    assert.equal(fixture.samples[10].count, 0);
    assert.equal(fixture.walls.length, 9, 'three wall sides leave the front cutaway open');
    for (const wall of fixture.walls) {
      const layer = Math.round(-wall.top / 0.7);
      assert.equal(wall.color, fixture.colors[Math.floor(layer / 2)]);
      assert.ok(Math.abs(wall.top - wall.bottom - Math.min(2, 5 - layer) * 0.7) < 1e-6);
    }
    assert.ok(fixture.rungs > 10);
    await screenshot('five-layer-bands');
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${stage} depth screenshots${stage === 'before' ? '' : ', matching cameras, full-layer digging gate, deeper-pit walking/digging/cleaning, reload, cleanup/closure, five-layer mesh and wall bands'}; Edge ${browser.version()}, 1440x1000.`);
} finally { await browser.close(); }
