// Disposable Edge context; never touches the player's browser profile.
// node scripts/check-find-footprints.mjs <playwright index.mjs> <URL> <before|after>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { ALL_PARTS } from '../src/content/exhibit.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { findBurial } from '../src/game/burial.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const stage = process.argv[4] ?? 'after';
let journeys = 0;
async function seed(state) {
  await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, state]);
  await page.reload();
  await page.locator('#room-name').waitFor();
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
}
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function approach(target) {
  for (let i = 0; i < 180; i++) {
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
  const actual = await page.evaluate(() => ({ position: window.qaScene().getTransformNodeByName('player').position.asArray(), focused: document.hasFocus() }));
  throw Error(`Walking did not reach ${JSON.stringify(target)}: ${JSON.stringify(actual)}`);
}
try {
  await page.goto(process.argv[3]);
  for (const site of [SITE, ERYOPS_SITE]) {
    const base = { ...freshJourney(), room: 'excavation', activeSiteId: site.id,
      ...(site === ERYOPS_SITE ? { closedSites: [SITE.id], collected: [...SITE.requiredDiscoveryIds],
        dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) } : {}) };
    await seed({ ...base, dig: { ...base.dig, ...Object.fromEntries(site.cells.map(c => [c.id, 1])) } });
    await page.screenshot({ path: `docs/qa/find-footprints-${stage}-${site.id}.png` });
    if (stage.endsWith('before')) continue;
    if (site.burial) {
      // The real model crosses the layer boundary, not just grid rows.
      const verticalBounds = await page.evaluate(() => {
        const meshes = window.qaScene().meshes.filter(m => m.name.startsWith('find-eryops-spine-find'));
        return [Math.min(...meshes.map(m => m.getBoundingInfo().boundingBox.minimumWorld.y)),
          Math.max(...meshes.map(m => m.getBoundingInfo().boundingBox.maximumWorld.y))];
      });
      assert.ok(verticalBounds[0] < -0.7 && verticalBounds[1] > -0.7 && verticalBounds[1] < 0);
      // Exercise the same renderer with future three-layer data in a disposable scene.
      const threeBounds = await page.evaluate(async site => {
        const { buildDiscovery } = await import('/src/presentation/discovery.ts');
        const { shapes } = await import('/src/presentation/shapes.ts');
        const current = window.qaScene(), preview = new current.constructor(current.getEngine());
        try {
          const deep = { ...site, grid: { ...site.grid, levels: 3, floorY: -2.1 },
            burial: { 'eryops-spine-find': { topLayer: 0, bottomLayer: 2, axis: 'z' } } };
          const bone = current.getMeshByName('find-eryops-spine-find').material;
          const soil = current.meshes.find(m => m.name.startsWith('soil-tile-')).material;
          const update = buildDiscovery(shapes(preview, () => {}), bone, [soil, soil, soil, soil], deep);
          update({ dig: Object.fromEntries(deep.cells.map(c => [c.id, 1])), collected: [] });
          const meshes = preview.meshes.filter(m => m.name.startsWith('find-eryops-spine-find'));
          for (const mesh of meshes) mesh.computeWorldMatrix(true);
          return [Math.min(...meshes.map(m => m.getBoundingInfo().boundingBox.minimumWorld.y)),
            Math.max(...meshes.map(m => m.getBoundingInfo().boundingBox.maximumWorld.y))];
        } finally { preview.dispose(); }
      }, site);
      assert.ok(threeBounds[0] < -1.4 && threeBounds[0] > -2.1 && threeBounds[1] > -0.7 && threeBounds[1] < 0);
    }
    // All silhouettes fit their assigned area, and are physically larger than one tile.
    for (const id of site.requiredDiscoveryIds) {
      const bounds = await page.evaluate(id => {
        const meshes = window.qaScene().meshes.filter(m => m.name === `find-${id}` || m.name.startsWith(`find-${id}-`));
        return meshes.map(m => { const b = m.getBoundingInfo().boundingBox; return [b.minimumWorld.asArray(), b.maximumWorld.asArray()]; });
      }, id);
      const cells = site.cells.filter(c => c.discoveryId === id), half = site.grid.tileSize / 2;
      const minX = Math.min(...bounds.map(b => b[0][0])), maxX = Math.max(...bounds.map(b => b[1][0]));
      const minZ = Math.min(...bounds.map(b => b[0][2])), maxZ = Math.max(...bounds.map(b => b[1][2]));
      assert.ok(Math.max(maxX - minX, maxZ - minZ) > site.grid.tileSize, id);
      assert.ok(minX > Math.min(...cells.map(c => c.x)) - half && maxX < Math.max(...cells.map(c => c.x)) + half, id);
      assert.ok(minZ > Math.min(...cells.map(c => c.z)) - half && maxZ < Math.max(...cells.map(c => c.z)) + half, id);
      if (id.includes('tail') || id === 'eryops-spine-find') {
        const vertical = new Set(cells.map(c => c.column)).size === 1;
        assert.equal(maxZ - minZ > maxX - minX, vertical, `${id}: model follows its footprint direction`);
      }
    }
    const examples = site.requiredDiscoveryIds.filter(id => id.includes('tail') || id === 'eryops-spine-find' || site === SITE && (id.includes('ribs') || id === 'trilobite-slab'));
    const partialCells = examples.flatMap(id => site.cells.filter(c => c.discoveryId === id).slice(0, 2));
    await seed({ ...base, dig: { ...base.dig, ...Object.fromEntries([...partialCells, ...site.cells.filter(c => c.row === 7)].map(c => [c.id, 1])) } });
    assert.equal(await page.locator('#clean-button').isVisible(), false);
    await page.screenshot({ path: `docs/qa/find-footprints-${stage}-partial-${site.id}.png` });
    if (site.burial) {
      await seed({ ...base, dig: { ...base.dig, ...Object.fromEntries(site.cells.map(c => [c.id, 0.5])) } });
      assert.equal(await page.locator('#clean-button').isVisible(), false);
      assert.ok(await page.evaluate(() => window.qaScene().getMeshByName('find-eryops-spine-find').isEnabled()));
      await page.screenshot({ path: `docs/qa/find-footprints-${stage}-upper-layer-${site.id}.png` });
    }
    for (const id of examples) {
      if (process.argv[5] && process.argv[5] !== id) continue;
      const cells = site.cells.filter(c => c.discoveryId === id), last = cells.at(-1);
      const collected = [...(base.collected ?? []), ...site.requiredDiscoveryIds.filter(other => other !== id)];
      const dig = { ...base.dig, ...Object.fromEntries(site.cells.map(c => [c.id, c.id === last.id ? 0 : 1])) };
      if (site.burial?.[id]) for (const { cell, lastLayer } of findBurial(site, id).coverage) {
        if (cell.id !== last.id) dig[cell.id] = (lastLayer + 1) / site.grid.levels;
      }
      await seed({ ...base, dig, collected });
      assert.equal(await page.locator('#clean-button').isVisible(), false);
      assert.ok(await page.evaluate(id => window.qaScene().getMeshByName(`find-${id}`).isEnabled(), id));
      await approach({ x: site.interaction.x, z: site.interaction.z - 1.4 });
      await approach(last);
      await page.locator('#cleaning-view').waitFor({ state: 'visible', timeout: 10000 }).catch(async error => {
        await page.screenshot({ path: `docs/qa/find-depth-failure.png` });
        const state = await saved();
        throw new Error(`${id}: ${cells.map(c => `${c.id}=${state.dig[c.id]}`).join(', ')}; ${error.message}`);
      });
      assert.equal(await page.locator('.cleaning-details h3').innerText(), ALL_PARTS.find(p => p.discoveryId === id).label);
      assert.equal((await saved()).dig[last.id], 1);
      if (site.burial?.[id]) assert.equal((await saved()).dig[cells[0].id], 0.5, 'no need to remove soil beneath the shallow end');
      await page.locator('#activity-close').click();
      await page.reload(); await page.locator('#clean-button').click();
      for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) {
        const b = await page.locator('#cleaning-canvas').boundingBox();
        await page.mouse.move(b.x + b.width * 0.025, b.y + b.height * y); await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.975, b.y + b.height * y, { steps: 10 }); await page.mouse.up();
      }
      await page.locator('#collect-fossil').click();
      assert.equal((await saved()).collected.filter(found => found === id).length, 1);
      journeys++;
      await page.reload(); await page.locator('#room-name').waitFor();
      assert.equal((await saved()).collected.filter(found => found === id).length, 1);
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${stage} pit screenshots, ${!stage.endsWith('before') ? `mesh bounds, orientation and burial depth, partial reveal, ${journeys} final-tile digging/cleaning/reload journeys; ` : ''}Edge ${browser.version()}, 1440x1000.`);
} finally { await browser.close(); }
