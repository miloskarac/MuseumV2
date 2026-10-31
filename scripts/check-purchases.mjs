// Disposable Edge profile; uses the existing external Playwright installation.
// node scripts/check-purchases.mjs <playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { PURCHASE_QA_KEY } from '../src/persistence/museum-save.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITES, SITE } from '../src/content/journey.ts';
import { createMuseumSave, advanceMuseum, buyPurchase } from '../src/game/purchases.ts';
import { screenDirection } from '../src/game/navigation.ts';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const normalUrl = process.argv[3], qaUrl = new URL('?purchases=1', normalUrl).href;
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), PURCHASE_QA_KEY);
const screenshot = name => page.screenshot({ path: `docs/qa/purchases-${name}.png` });
async function ready() {
  await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent !== '—' && document.querySelector('.session-blocker')?.hidden);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    window.qaScene = () => Engine.Instances[0].scenes[0];
  });
  await page.waitForTimeout(150);
}
async function seed(save) {
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [PURCHASE_QA_KEY, save]);
  await page.reload(); await ready();
}
const meshCount = name => page.evaluate(name => window.qaScene().meshes.filter(mesh => mesh.name === name).length, name);
const position = () => page.evaluate(() => {
  const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z };
});
async function walkTo(target) {
  for (let i = 0; i < 180; i++) {
    const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < 0.16) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1);
    const h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.06, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.06, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(80);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Cannot walk to ${JSON.stringify(target)} from ${JSON.stringify(await position())}`);
}
async function select(id) { await page.locator(`[data-purchase="${id}"]`).click(); await page.locator('#purchase-view').waitFor(); }
async function buy(id) { await select(id); await page.locator('#buy-purchase').click(); await page.waitForFunction(() => !document.querySelector('dialog').open); }
async function failWrites(fail) {
  await page.evaluate(fail => {
    window.qaSet ??= Storage.prototype.setItem;
    window.qaFail = fail;
    Storage.prototype.setItem = function(key, value) { if (window.qaFail) throw Error('QA quota'); return window.qaSet.call(this, key, value); };
  }, fail);
}
const displayReady = seed => advanceMuseum(createMuseumSave(seed), { ...freshJourney(),
  activeSiteId: SITES[1].id, dig: Object.fromEntries(SITES.flatMap(site => site.cells.map(cell => [cell.id, 1]))),
  collected: SITES.flatMap(site => [...site.requiredDiscoveryIds]), closedSites: SITES.map(site => site.id) });

try {
  // Establish a genuine ordinary game before entering the independent preview.
  await page.goto(normalUrl); await ready();
  const normal = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  assert.equal(JSON.parse(normal).version, 19);
  await page.goto(qaUrl); await ready();
  assert.equal((await saved()).version, 19); assert.equal((await saved()).economy.coins, 20);
  assert.equal(await meshCount('floor-tile'), 192); assert.equal(await meshCount('platform-body'), 0);
  assert.equal(await page.locator('#exhibit-button').isHidden(), true);
  assert.equal(await page.locator('[data-purchase="stand-eryops"]').isHidden(), true);
  for (const [width, height] of [[1440, 1000], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const id of ['stand-dimetrodon', 'stand-trilobite', 'west-wing']) {
      const box = await page.locator(`[data-purchase="${id}"]`).boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      const exit = await page.locator('.portal-label').boundingBox();
      assert.ok(box.x + box.width <= exit.x || box.x >= exit.x + exit.width
        || box.y + box.height <= exit.y || box.y >= exit.y + exit.height, 'purchase label does not cover exit');
    }
    await screenshot(`fresh-${width}`);
    await select('stand-dimetrodon');
    for (const id of ['#buy-purchase', '#activity-close']) {
      const b = await page.locator(id).boundingBox(); assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height);
    }
    await screenshot(`dialog-${width}`); await page.locator('#activity-close').click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await select('west-wing'); assert.equal(await page.locator('#buy-purchase').isDisabled(), true);
  assert.match(await page.locator('#purchase-reason').innerText(), /доврши/); await page.locator('#activity-close').click();
  // Walk onto the vacant large stand; a remote purchase must not trap the player.
  await walkTo({ x: -1.2, z: 0.5 });
  await select('stand-dimetrodon'); await failWrites(true);
  const before = await saved(), standing = await position();
  await page.locator('#buy-purchase').click();
  assert.deepEqual(await saved(), before); assert.equal(await meshCount('platform-body'), 0);
  assert.equal(await page.locator('#coin-count').innerText(), '20');
  assert.equal(await page.locator('#activity-retry-save').isVisible(), true);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(200); await page.keyboard.up('KeyD');
  assert.deepEqual(await position(), standing); await screenshot('failed-purchase');
  await failWrites(false); await page.locator('#activity-retry-save').evaluate(button => { button.click(); button.click(); });
  assert.equal((await saved()).economy.coins, 8); assert.equal((await saved()).museum.owned.length, 1);
  assert.equal(await meshCount('platform-body'), 1);
  assert.ok((await position()).z < -2, 'safe relocation to the purchased stand marker');
  await screenshot('stand-built');
  const purchased = await saved(); await page.reload(); await ready(); assert.deepEqual(await saved(), purchased);
  await buy('stand-trilobite'); assert.equal((await saved()).economy.coins, 0);
  assert.equal(await meshCount('slab-stand'), 1);
  await page.reload(); await ready(); assert.equal((await saved()).economy.coins, 0);

  // A completed first display with too little money explains the missing coins.
  let poor = advanceMuseum(createMuseumSave(42), { ...freshJourney(),
    dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id] });
  poor = buyPurchase(buyPurchase(poor, 'stand-dimetrodon'), 'stand-trilobite');
  await seed({ ...poor, placed: ['trilobite-whole'] });
  await select('west-wing'); assert.equal(await page.locator('#buy-purchase').isDisabled(), true);
  assert.match(await page.locator('#purchase-reason').innerText(), /Недостају/);
  await screenshot('insufficient'); await page.locator('#activity-close').click();

  // Reload before a failed purchase retry restores both old balance and ownership.
  await seed(createMuseumSave(9)); await select('stand-trilobite'); await failWrites(true);
  await page.locator('#buy-purchase').click(); await page.reload(); await ready();
  assert.equal((await saved()).economy.coins, 20); assert.deepEqual((await saved()).museum.owned, []);

  // Use legitimately settled soil rewards to fund the bounded wing/stand fixture.
  let random = 0, full = displayReady(random); while (full.economy.coins < 50) full = displayReady(++random);
  full = buyPurchase(full, 'stand-trilobite'); await seed(full);
  await page.locator('#exhibit-trilobite').click();
  await page.locator('[data-group="trilobite-whole"]').click(); await page.locator('[data-target="trilobite-whole"]').click();
  await page.locator('#story-view').waitFor(); await page.locator('#activity-close').click();
  const preExpansion = await saved();
  await select('west-wing'); await failWrites(true); await page.locator('#buy-purchase').click();
  assert.equal(await meshCount('floor-tile'), 192); assert.deepEqual(await saved(), preExpansion);
  await failWrites(false); await page.locator('#activity-retry-save').click();
  assert.equal(await meshCount('floor-tile'), 300);
  assert.equal((await saved()).economy.coins, preExpansion.economy.coins - 18);
  assert.equal(await page.locator('[data-purchase="stand-eryops"]').isVisible(), true);
  await screenshot('expanded'); await page.reload(); await ready(); assert.equal(await meshCount('floor-tile'), 300);
  await walkTo({ x: 3.5, z: -2.5 }); await walkTo({ x: -11, z: -2.5 });
  assert.ok((await position()).x < -10, 'old west boundary is gone');
  await buy('stand-eryops'); assert.equal(await meshCount('platform-body'), 1);
  await page.locator('#exhibit-eryops').click();
  const oldPlaced = (await saved()).placed;
  await page.locator('[data-group="eryops-skull"]').click(); await page.locator('[data-target="eryops-tail"]').click();
  assert.deepEqual((await saved()).placed, oldPlaced);
  await page.locator('[data-target="eryops-skull"]').click();
  assert.ok((await saved()).placed.includes('eryops-skull'));
  await page.locator('#activity-close').click(); await screenshot('expanded-partial');
  const partial = await saved(); await page.reload(); await ready(); assert.deepEqual(await saved(), partial);
  await select('stand-dimetrodon');
  await page.locator('#activity-close').click();
  // Old saves preserve all existing space and partial assembly without payment.
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(cell => [cell.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: ['skull', 'trilobite-whole'] }, 22);
  await seed(old); const migrated = await saved();
  assert.equal(migrated.economy.coins, old.economy.coins); assert.deepEqual(migrated.placed, old.placed);
  assert.equal(migrated.museum.owned.length, 4); assert.equal(await meshCount('platform-body'), 2);
  assert.equal(await page.locator('.purchase-marker:visible').count(), 0); await screenshot('migrated');
  await page.reload(); await ready(); assert.deepEqual(await saved(), migrated);
  // Reset of the QA game must neither reset nor migrate ordinary play.
  await page.locator('#reset-button').click(); await page.locator('#activity-close').click(); assert.deepEqual(await saved(), migrated);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  assert.equal((await saved()).economy.coins, 20); assert.deepEqual((await saved()).museum.owned, []);
  assert.equal(await meshCount('floor-tile'), 192); await page.reload(); await ready();
  assert.deepEqual((await saved()).museum.owned, []);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY), normal);
  const other = await context.newPage(); await other.goto(normalUrl);
  await other.waitForFunction(() => document.querySelector('.session-blocker')?.hidden);
  assert.equal(await other.locator('.purchase-qa').count(), 0, 'normal mode does not show the QA badge');
  assert.equal(await other.locator('#coin-count').innerText(), '20'); await other.close();
  const competing = await context.newPage(); await competing.goto(qaUrl);
  await competing.locator('.session-blocker').waitFor(); assert.equal(await competing.locator('#coin-count').innerText(), '—');
  await competing.close();
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; purchases, price/prerequisite guards, failure/retry/reload, collision-safe construction, wing traversal, owned assembly, migration, reset, independent normal/QA saves and lock; 1440x1000, 1280x720, 390x844.`);
} catch (error) {
  await screenshot('failure'); console.log('QA failure save:', await saved().catch(() => null)); throw error;
} finally { await browser.close(); }
