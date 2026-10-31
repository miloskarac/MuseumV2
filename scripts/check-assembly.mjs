// Focused museum assembly QA in a disposable profile; no gameplay test hooks.
// node scripts/check-assembly.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { GROUPS } from '../src/content/exhibit.ts';
import { SITE } from '../src/content/journey.ts';
import { EXHIBIT } from '../src/game/navigation.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const fixture = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
  collected: GROUPS.map(g => g.discoveryId), closedSites: [SITE.id] };
async function setup(state) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.addInitScript(([key, state]) => {
    if (!sessionStorage.qaAssemblySeeded) { localStorage.setItem(key, JSON.stringify(state)); sessionStorage.qaAssemblySeeded = '1'; }
  }, [SAVE_KEY, state]);
  await page.goto(process.argv[3]);
  await page.locator('#exhibit-button').click();
  await page.waitForTimeout(700);
  return page;
}
async function inspect(page, expected) {
  const result = await page.evaluate(async ({ offset }) => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const world = Engine.Instances[0].scenes[0], preview = Engine.Instances[1].scenes[0];
    const groups = [...new Set(world.meshes.map(m => m.metadata?.fossilGroup).filter(Boolean))];
    const visible = groups.filter(id => world.meshes.filter(m => m.metadata?.fossilGroup === id).every(m => m.isEnabled()));
    const solid = groups.filter(id => preview.meshes.filter(m => m.metadata?.fossilGroup === id).every(m => m.material.alpha === 1));
    // After settling, every mesh must occupy the same exhibit-relative bounds
    // and orientation in both scenes, including after reload.
    let maxError = 0;
    for (const id of groups) {
      const a = world.meshes.filter(m => m.metadata?.fossilGroup === id);
      const b = preview.meshes.filter(m => m.metadata?.fossilGroup === id);
      if (a.length !== b.length) throw Error(`Different ${id} mesh counts`);
      for (let i = 0; i < a.length; i++) {
        a[i].computeWorldMatrix(true); b[i].computeWorldMatrix(true);
        for (const edge of ['minimumWorld', 'maximumWorld']) {
          const pa = a[i].getBoundingInfo().boundingBox[edge], pb = b[i].getBoundingInfo().boundingBox[edge];
          maxError = Math.max(maxError, Math.abs(pa.x - offset.x - pb.x), Math.abs(pa.y - pb.y), Math.abs(pa.z - offset.z - pb.z));
        }
      }
    }
    return { visible, solid, maxError, engines: Engine.Instances.length };
  }, { offset: EXHIBIT });
  assert.deepEqual(result.visible.sort(), [...expected].sort());
  assert.deepEqual(result.solid.sort(), [...expected].sort());
  assert.ok(result.maxError < 0.001, `preview/museum alignment error ${result.maxError}`);
  assert.equal(result.engines, 2, 'one reusable preview engine');
}
try {
  const page = await setup(fixture);
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  await inspect(page, []);
  await page.screenshot({ path: 'docs/qa/assembly-v1-empty.png' });
  await page.locator('[data-group="skull"]').click();
  await page.locator('[data-target="tail"]').click();
  assert.deepEqual((await saved()).placed, []);
  const placed = [];
  for (const group of GROUPS) {
    await page.locator(`[data-group="${group.id}"]`).click();
    await page.locator(`[data-target="${group.id}"]`).click();
    placed.push(group.id);
    assert.deepEqual((await saved()).placed, placed);
    await page.waitForTimeout(700);
    await inspect(page, placed);
    await page.screenshot({ path: `docs/qa/assembly-v1-${placed.length}-${group.id}.png` });
    // Disabled/programmatic duplicates cannot grant placement twice.
    await page.locator(`[data-target="${group.id}"]`).evaluate(button => button.click());
    assert.deepEqual((await saved()).placed, placed);
    await page.locator('#activity-close').click();
    await page.reload();
    assert.deepEqual((await saved()).placed, placed);
    await page.locator('#exhibit-button').click();
    await page.waitForTimeout(700);
    await inspect(page, placed);
  }
  await page.locator('#story-view').waitFor({ state: 'visible' });
  await page.locator('#activity-close').click();
  await page.screenshot({ path: 'docs/qa/assembly-v1-museum-complete.png' });
  await page.close();
  const responsive = await setup(fixture);
  for (const [width, height] of [[1280, 720], [768, 1024], [390, 844]]) {
    await responsive.setViewportSize({ width, height });
    await responsive.waitForTimeout(250);
    for (const selector of ['#assembly-canvas', '[data-target="skull"]', '[data-target="spine-sail"]', '[data-group="skull"]', '#activity-close']) {
      const b = await responsive.locator(selector).boundingBox();
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, `${selector} fits ${width}x${height}`);
    }
    await responsive.screenshot({ path: `docs/qa/assembly-v1-${width}x${height}.png` });
  }
  // Actual drag at phone width: narrow adjacent target zones remain forgiving.
  const from = await responsive.locator('[data-group="ribs"]').boundingBox();
  const to = await responsive.locator('[data-target="ribs"]').boundingBox();
  await responsive.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await responsive.mouse.down();
  await responsive.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await responsive.mouse.up();
  assert.deepEqual(await responsive.evaluate(key => JSON.parse(localStorage.getItem(key)).placed, SAVE_KEY), ['ribs']);
  await responsive.close();
  const partial = await setup({ ...fixture, collected: [GROUPS[0].discoveryId], closedSites: [] });
  assert.equal(await partial.locator('[data-group]:visible').count(), 1, 'only recovered parts are offered');
  await partial.locator('[data-target="tail"]').click();
  assert.deepEqual(await partial.evaluate(key => JSON.parse(localStorage.getItem(key)).placed, SAVE_KEY), []);
  await partial.locator('[data-group="skull"]').click();
  await partial.locator('[data-target="skull"]').click();
  await partial.locator('#activity-close').click();
  await partial.reload();
  await partial.locator('#exhibit-button').click();
  await partial.waitForTimeout(700);
  await inspect(partial, ['skull']);
  assert.equal(await partial.locator('[data-group]:visible').count(), 0, 'closing during placement cannot restore a spent part');
  await partial.close();
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(`PASS: six sequential placements and reloads, shared model alignment, partial inventory, duplicate/wrong target protection, responsive drag; Edge ${browser.version()}.`);
} finally { await browser.close(); }
