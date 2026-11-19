import { parseCreditSave } from '../src/persistence/credit-save.ts';
// Temporary Edge profile; never opens Luka's browser or normal saved playthrough.
// node scripts/check-world-map.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { PURCHASE_QA_KEY } from '../src/persistence/museum-save.ts';
import { SITE, ERYOPS_SITE, sitePlot } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { advanceMuseum, museumJourney, buyPurchase, placeOwnedGroup, createMuseumSave } from '../src/game/purchases.ts';
import { createTravelSave, travelTo, buySite } from '../src/game/world-map.ts';
import { screenDirection, PORTAL } from '../src/game/navigation.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), PURCHASE_QA_KEY);
const shot = name => page.screenshot({ path: `docs/qa/${process.argv[4] || "map"}-${name}.png` });
async function ready() {
  await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent !== '—' && document.querySelector('.session-blocker')?.hidden);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaScene = () => Engine.Instances[0].scenes[0];
    window.qaSceneCount = () => Engine.Instances[0].scenes.length;
  });
  await page.waitForTimeout(150);
}
async function seed(save) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [PURCHASE_QA_KEY, save]);
  await page.reload(); await ready();
}
const position = () => page.evaluate(() => {
  const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z };
});
async function walkUntil(target, room, condition) {
  for (let i = 0; i < 180; i++) {
    if (await condition()) return;
    const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
    const right = screenDirection(1, 0, room), up = screenDirection(0, 1, room);
    const h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.03, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.03, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(80);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Cannot reach ${JSON.stringify(target)} from ${JSON.stringify(await position())}`);
}
async function openMap() { await page.locator('#open-map').click(); await page.locator('#map-view').waitFor(); }
async function mapTravel(id) {
  await openMap(); await page.locator(`[data-travel="${id}"]`).click();
  await page.waitForFunction(() => !document.querySelector('dialog').open);
}
async function failWrites(fail) {
  await page.evaluate(fail => {
    window.qaSet ??= Storage.prototype.setItem; window.qaFail = fail;
    Storage.prototype.setItem = function(key, value) { if (window.qaFail) throw Error('QA quota'); return window.qaSet.call(this, key, value); };
  }, fail);
}
function funded() {
  let seed = 0, save;
  do { save = advanceMuseum(createTravelSave(seed++), { ...freshJourney(),
    dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] });
  } while (save.economy.coins < 32);
  save = buyPurchase(save, 'stand-trilobite');
  return advanceMuseum(save, placeOwnedGroup(save, 'trilobite', 'trilobite-whole', 'trilobite-whole'));
}
try {
  await page.goto(process.argv[3]); await ready();
  const normal = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  await page.goto(new URL('?purchases=1', process.argv[3]).href); await ready();
  assert.equal((await saved()).version, 24);
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(200); await shot(`after-${width}`);
    await openMap(); await shot(`cards-${width}`);
    assert.equal(await page.locator('[data-map-site]').count(), 3);
    assert.equal(await page.locator('[data-map-site="future-site-03"] button:visible').count(), 0);
    assert.equal(await page.locator('[data-site-buy="eryops-dig"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.locator('#activity-close').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  // The in-world sign opens the same map and closing it does not loop.
  await walkUntil({ x: 3.8, z: -2.5 }, 'museum', async () => Math.hypot((await position()).x - 3.8, (await position()).z + 2.5) < 0.2);
  await walkUntil({ x: 3.8, z: 2 }, 'museum', async () => (await position()).z > 1.8);
  await walkUntil(PORTAL, 'museum', () => page.locator('#map-view').isVisible());
  await page.locator('#activity-close').click(); await page.waitForTimeout(400);
  assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  await mapTravel(SITE.id);
  assert.equal((await saved()).world.location.kind, 'site-camp');
  assert.equal(await page.evaluate(() => window.qaScene().meshes.filter(m => m.name.startsWith('plot-') && m.name !== 'plot-soil').length), 1);
  await shot('green-camp');
  await page.reload(); await ready(); assert.equal((await saved()).world.location.kind, 'site-camp');
  await walkUntil(sitePlot(SITE).entrance, 'outdoors', async () => (await saved()).room === 'excavation');
  await shot('first-pit');
  const beforeMap = await saved(), point = await position();
  await openMap(); await page.keyboard.down('KeyW'); await page.waitForTimeout(450); await page.keyboard.up('KeyW');
  assert.deepEqual(await saved(), beforeMap); assert.deepEqual(await position(), point);
  await page.locator('[data-travel="hub"]').click(); assert.equal((await saved()).room, 'museum');
  // Paid unlock and travel each fail atomically and retry once.
  await seed(funded()); await openMap(); const before = await saved();
  await failWrites(true); await page.locator('[data-site-buy="eryops-dig"]').click();
  assert.deepEqual(await saved(), before); assert.equal(await page.locator('#activity-retry-save').isVisible(), true); await shot('failed-unlock');
  await failWrites(false); await page.locator('#activity-retry-save').evaluate(b => { b.click(); b.click(); });
  let paid = await saved(); assert.equal(paid.economy.coins, before.economy.coins - 24);
  assert.equal(paid.world.owned.length, 1); assert.equal(paid.world.location.kind, 'hub');
  await shot('opened-site');
  await failWrites(true); await page.locator('[data-travel="eryops-dig"]').click();
  assert.deepEqual(await saved(), paid); assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
  await failWrites(false); await page.locator('#activity-retry-save').click();
  assert.equal((await saved()).world.location.siteId, ERYOPS_SITE.id); await shot('ochre-camp');
  await page.reload(); await ready(); assert.equal((await saved()).room, 'outdoors');
  assert.equal(await page.evaluate(() => window.qaSceneCount()), 1);
  await walkUntil(sitePlot(ERYOPS_SITE).entrance, 'outdoors', async () => (await saved()).room === 'excavation');
  await shot('second-pit');
  // Walking through the pit exit returns to this camp, with no map bypass.
  await walkUntil({ x: 5.4, z: 5 }, 'excavation', async () => (await position()).x > 5.15);
  await walkUntil(PORTAL, 'excavation', async () => (await saved()).room === 'outdoors');
  assert.equal((await saved()).world.location.siteId, ERYOPS_SITE.id);
  await mapTravel(SITE.id); assert.equal((await saved()).room, 'outdoors');
  await shot('closed-camp');
  await walkUntil(sitePlot(SITE).entrance, 'outdoors', async () => Math.hypot((await position()).x - sitePlot(SITE).entrance.x, (await position()).z - sitePlot(SITE).entrance.z) < 0.2);
  assert.equal((await saved()).room, 'outdoors'); await mapTravel('hub');
  // Reload midway through closure; map is disabled until the safe camp checkpoint.
  let closing = travelTo(createTravelSave(42), { kind: 'site-camp', siteId: SITE.id });
  closing = travelTo(closing, { kind: 'site-pit', siteId: SITE.id });
  closing = advanceMuseum(closing, { ...museumJourney(closing), dig: Object.fromEntries(SITE.cells.filter(c => c.discoveryId).map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds] });
  await seed(closing); assert.equal(await page.locator('#open-map').isDisabled(), true);
  await page.reload(); await ready(); assert.equal(await page.locator('#open-map').isDisabled(), true);
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).closedSites.includes('courtyard-dig'), PURCHASE_QA_KEY, { timeout: 60000 });
  assert.equal((await saved()).world.location.kind, 'site-camp');
  assert.equal(await page.locator('#open-map').isEnabled(), true);
  assert.ok(parseCreditSave(JSON.stringify(await saved()), 99)); await shot('cleanup-finished');
  // Existing earned access is free; early saves must buy later.
  const legacy = advanceMuseum(createMuseumSave(11), { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])), collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] });
  await seed(legacy); assert.equal((await saved()).world.owned[0].source, 'legacy'); assert.equal((await saved()).economy.coins, legacy.economy.coins);
  await seed(createMuseumSave(11)); assert.deepEqual((await saved()).world.owned, []);
  await seed({ ...paid, world: { ...paid.world, location: { kind: 'site-pit', siteId: 'removed' } } });
  assert.equal((await saved()).world.location.kind, 'hub'); assert.deepEqual((await saved()).economy, paid.economy);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  assert.equal((await saved()).world.location.kind, 'hub'); assert.deepEqual((await saved()).world.owned, []);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), normal);
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; map cards, sign/menu, camps, pit entrance/exit, paid unlock, failed write/retry, reload, closure, migration, reset, normal-save isolation; 1440x1000, 1280x720, 390x844.`);
} catch (error) { await shot('failure'); console.log('Current QA save:', await saved().catch(() => null)); throw error; }
finally { await browser.close(); }
