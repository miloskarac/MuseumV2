// Disposable Edge context only. Never attaches to a player profile.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITES } from '../src/content/journey.ts';
import { EXHIBITS } from '../src/content/exhibit.ts';
import { room1Recovered, room1Display } from '../tests/helpers/room1-fixture.ts';
import { buyPurchase } from '../src/game/purchases.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const before = process.argv.includes('--before');
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0]; window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
    window.qaScene = () => engine.scenes[0];
  });
}
async function seed(save) {
  assert.ok(parseCreditSave(JSON.stringify(save), 42));
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]);
  await page.reload(); await ready();
}
const shot = name => page.screenshot({ path: `docs/qa/room1-${before ? 'before' : 'after'}-${name}.png` });
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const ticks = count => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, count);
async function enable() {
  await page.evaluate(() => { delete document.hidden; });
  await page.bringToFront(); await page.locator('.stage > canvas').focus();
}
async function walkTo(target, tolerance = 0.18) {
  await enable();
  for (let i = 0; i < 300; i++) {
    const p = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < tolerance) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1);
    const h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.04, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.04, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  await shot('walk-failure');
  const state = await page.evaluate(() => ({ position: window.qaScene().getTransformNodeByName('player').position.asArray(),
    activity: document.querySelector('dialog')?.open, focus: document.hasFocus(), hidden: document.hidden }));
  throw Error(`Cannot walk to ${JSON.stringify(target)}: ${JSON.stringify(state)}`);
}
function fixture(ids) {
  return parseCreditSave(JSON.stringify(createGameSave({ ...freshJourney(),
    dig: Object.fromEntries(SITES.flatMap(s => s.cells.map(c => [c.id, 1]))),
    collected: SITES.flatMap(s => [...s.requiredDiscoveryIds]), closedSites: SITES.map(s => s.id),
    placed: EXHIBITS.filter(e => ids.includes(e.id)).flatMap(e => [...e.parts]) }, 42)), 42);
}
try {
  await page.goto(process.argv[3]); await ready();
  for (const [name, save] of [['fresh', createCreditSave(42)], ['dimetrodon', fixture(['dimetrodon'])],
    ['trilobite', fixture(['trilobite'])], ['eryops', fixture(['eryops'])], ['all', fixture(EXHIBITS.map(e => e.id))]]) {
    await seed(save);
    for (const [width, height] of [[1440, 1000], [390, 844]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
      await page.evaluate(() => window.qaTick()); await shot(`${name}-${width}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  if (!before) {
    await seed(createCreditSave(42)); await enable();
    assert.equal(await page.locator('[data-purchase="west-wing"]').isVisible(), false);
    assert.equal(await page.locator('[data-purchase="stand-walchia"]').count(), 0);
    await page.locator('[data-purchase="stand-eryops"]').click();
    await page.evaluate(() => { window.qaSet = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw Error('QA quota'); }; });
    await page.locator('#buy-purchase').click();
    assert.equal((await saved()).economy.coins, 20);
    await page.locator('#retry-save').waitFor({ state: 'visible' });
    await page.evaluate(() => { Storage.prototype.setItem = window.qaSet; });
    await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
    assert.equal((await saved()).economy.coins, 8);
    assert.deepEqual((await saved()).museum.owned, [{ id: 'stand-eryops', source: 'purchase', paid: 12 }]);
    await page.reload(); await ready(); assert.equal((await saved()).economy.coins, 8);
    // Click assembly uses the same existing groups and stand entitlement.
    await seed(room1Recovered()); await enable();
    await page.locator('[data-purchase="stand-eryops"]').click(); await page.locator('#buy-purchase').click();
    await walkTo({ x: 4, z: 1.6 }); await walkTo({ x: 4, z: -2.45 });
    for (const x of [2, 0, -2, -4, -6, -8]) await walkTo({ x, z: -2.45 });
    await walkTo({ x: -11, z: -2.45 }, 0.85);
    await page.locator('[data-group="eryops-skull"]').waitFor({ state: 'visible' });
    for (const group of EXHIBITS.find(e => e.id === 'eryops').parts) {
      await page.locator(`[data-group="${group}"]`).click(); await page.locator(`[data-target="${group}"]`).click();
    }
    await page.locator('#activity-close').click(); await ticks(1);
    assert.equal(await page.locator('#ticket-price').innerText(), '3');
    const assembled = await saved(); assert.ok(parseCreditSave(JSON.stringify(assembled), 42));
    assert.equal(assembled.museum.owned.some(o => o.id === 'west-wing'), false);
    await shot('eryops-no-wing-assembled');
    await page.reload(); await ready(); assert.equal(await page.locator('#ticket-price').innerText(), '3');
    // Scene rebuild on travel preserves the exact fossil/ownership/accounting data.
    await enable(); await page.locator('#open-map').click(); await page.locator('[data-travel="courtyard-dig"]').click();
    await page.locator('#open-map').click(); await page.locator('[data-travel="hub"]').click(); await ticks(1);
    assert.deepEqual((await saved()).placed, assembled.placed); assert.deepEqual((await saved()).museum, assembled.museum);
    // Full Room 1 without any historical wing entitlement, including visitors.
    let all = room1Display(buyPurchase(assembled, 'stand-dimetrodon'), 'dimetrodon');
    await seed(all); await enable();
    await walkTo({ x: CASHIER_STATION.x, z: 1.6 }); await walkTo(CASHIER_STATION);
    for (let i = 0; i < 6; i++) await ticks(200);
    assert.ok((await saved()).pendingTicketRevenue > 0);
    const poses = await page.evaluate(() => window.qaScene().transformNodes.filter(n => /^visitor-\d+$/.test(n.name)).map(n => n.position.asArray()));
    assert.ok(poses.length > 0); await shot('no-wing-visitors-1440');
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150); await ticks(1); await shot(`no-wing-visitors-${width}`);
      const a = await page.locator('.entrance-label').boundingBox(), b = await page.locator('.cashier-label').boundingBox();
      assert.ok(a && b && (a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y));
    }
    await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
    assert.equal((await saved()).economy.coins, 20); assert.deepEqual((await saved()).museum.owned, []);
    assert.equal((await saved()).expansionCredit.sources[0].recognized, 0);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Room 1 ${before ? 'before captures' : 'captures, no-wing purchase failure/retry/reload, keyboard access, Eryops assembly, travel rebuild, ticket visitors and reset'}; five visual states at 1440x1000 and 390x844${before ? '' : ', visitors also at 1280x720'}; Edge ${browser.version()}.`);
} finally { await browser.close(); }
