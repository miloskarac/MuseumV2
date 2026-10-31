// Isolated completion edge cases and per-frame animation evidence.
// node scripts/check-completion.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { DISCOVERIES, SITE, SITE_FRONT } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const empty = { ...freshJourney(), room: 'excavation', dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: DISCOVERIES.map(d => d.id) };
await page.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const resume = () => page.evaluate(() => { delete document.hidden; });
async function inspect() {
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaEngine = Engine.Instances[0];
    window.qaFrames = [];
    window.qaEngine.onEndFrameObservable.add(() => {
      const scene = window.qaEngine.scenes[0];
      const p = scene.getTransformNodeByName('player').position;
      const tiles = scene.meshes.filter(m => m.name.startsWith('soil-tile-'));
      const rail = scene.getMeshByName('completed-rail-courtyard-dig');
      const state = JSON.parse(localStorage.getItem('museum-for-luka-v2'));
      window.qaFrames.push({ time: performance.now(), x: p.x, z: p.z, room: state.room, closed: state.closedSites.length,
        remaining: tiles.filter(m => m.isEnabled()).length,
        popping: tiles.filter(m => m.isEnabled() && m.scaling.x !== 1).length, rail: rail?.isEnabled() ?? false });
    });
  });
}
async function seed(state) {
  await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, state]);
  await page.reload(); await inspect();
}
async function done() {
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).closedSites.length === 1, SAVE_KEY, { timeout: 15000 });
  assert.deepEqual((await saved()).closedSites, [SITE.id]);
  assert.deepEqual((await saved()).collected, DISCOVERIES.map(d => d.id));
}
try {
  await page.goto(process.argv[3]);
  const partial = { ...empty, dig: { ...empty.dig, [SITE.cells[0].id]: 0, [SITE.cells[1].id]: 0.5, [SITE.cells[2].id]: 0 } };
  await seed(partial); await resume();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/qa/phase3-completion-pop.png' });
  await done();
  const frames = await page.evaluate(() => window.qaFrames);
  const pitFrames = frames.filter(f => f.room === 'excavation');
  assert.ok(pitFrames.some(f => f.popping === 1), 'visible pop frames exist');
  assert.ok(pitFrames.every(f => f.popping <= 1), 'only one tile animates at a time');
  const removals = pitFrames.filter((f, i) => i && f.remaining < pitFrames[i - 1].remaining);
  assert.equal(removals.length, 3);
  assert.ok(pitFrames.every((f, i) => !i || pitFrames[i - 1].remaining - f.remaining <= 1));
  assert.ok(removals.every((f, i) => !i || f.time - removals[i - 1].time >= 270), 'removals are visibly separated');
  assert.ok(frames.some(f => f.room === 'outdoors' && !f.closed && !f.rail));
  assert.ok(frames.filter(f => f.closed).every(f => Math.hypot(f.x - SITE_FRONT.x, f.z - SITE_FRONT.z) < 0.001 && f.rail), 'closure only at the front');
  await page.screenshot({ path: 'docs/qa/phase3-completion-front-closed.png' });

  await seed(partial); await resume();
  await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)).dig[id] === 1, [SAVE_KEY, SITE.cells[0].id]);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
  const interrupted = await saved();
  await page.waitForTimeout(700); assert.deepEqual(await saved(), interrupted);
  await page.reload(); await inspect();
  assert.deepEqual(await saved(), interrupted, 'partial cleanup restores without changing cleared cells');
  await resume(); await done();

  await seed({ ...empty, room: 'outdoors' });
  assert.deepEqual((await saved()).closedSites, []);
  await page.screenshot({ path: 'docs/qa/phase3-completion-before-closure.png' });
  await page.reload(); await inspect();
  assert.deepEqual((await saved()).closedSites, [], 'exit reload must not close at the entrance');
  await resume(); await done();
  await page.reload(); await inspect();
  assert.deepEqual((await saved()).closedSites, [SITE.id], 'closed save remains closed');

  // Already empty but not yet cleaned must wait. Walk into the empty pit, then
  // finish the real brushing UI and observe the automatic walk back to the ladder.
  await seed({ ...empty, collected: [] }); await resume();
  await page.waitForTimeout(1500);
  assert.equal((await saved()).room, 'excavation'); assert.deepEqual((await saved()).closedSites, []);
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyS');
  await page.waitForTimeout(800); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS');
  await page.locator('#clean-button').click();
  for (const discovery of DISCOVERIES) {
  assert.ok(discovery.id);
  const box = await page.locator('#cleaning-canvas').boundingBox();
  for (const y of [0.04, 0.22, 0.42, 0.62, 0.82, 0.96]) {
    await page.mouse.move(box.x + box.width * 0.025, box.y + box.height * y); await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.975, box.y + box.height * y, { steps: 8 }); await page.mouse.up();
  }
  await page.locator('#collect-fossil').click();
  }
  await done();
  const exitFrames = await page.evaluate(() => window.qaFrames.filter(f => f.room === 'excavation'));
  assert.ok(exitFrames.some(f => f.z < SITE.interaction.z - 1), 'character started inside the pit');
  assert.ok(exitFrames.some((f, i) => i && f.z > exitFrames[i - 1].z + 0.01), 'automatic return visibly walks toward the ladder');
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; sequential visible pops, paused/reloaded cleanup, empty-site cleaning gate, automatic ladder walk, exit reload, closure only at front, durable unique completion.`);
} finally { await browser.close(); }
