// Disposable Edge context only; no access to the user's browser/profile.
// Args: Playwright index.mjs, dev URL, optional 'before' screenshot-only mode.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { threeRoom1Displays, recoverWalchia } from '../tests/helpers/walchia-fixture.ts';
import { buyPurchase } from '../src/game/purchases.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { CASHIER_STATION, CASH_PILE } from '../src/content/visitors.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { parseRoom1Game } from '../src/persistence/room1-game-save.ts';

const before = process.argv[4] === 'before';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  // Test the shipped artwork, not workstation antivirus-injected script traffic.
  if (request.resourceType() === 'image' && /^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(process.argv[3]).origin)
    errors.push(`External image request: ${new URL(request.url()).origin}`);
});
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const ticks = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, n);
const shot = name => page.screenshot({ path: `docs/qa/hotfix77-${before ? 'before' : 'after'}-${name}.png` });
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0]; window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
    window.qaScene = () => engine.scenes[0]; delete document.hidden;
  });
  await page.bringToFront(); await page.locator('.stage > canvas').focus(); await ticks(1);
}
async function seed(save) {
  assert.ok(parseRoom1Game(JSON.stringify(save), 42));
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]);
  await page.reload(); await ready();
}
async function failWrites(fail) {
  await page.evaluate(fail => {
    window.qaSet ??= Storage.prototype.setItem;
    window.qaFail = fail;
    Storage.prototype.setItem = function(k, v) { if (window.qaFail) throw Error('QA quota'); return window.qaSet.call(this, k, v); };
  }, fail);
}
async function dragPart(to) {
  const part = await page.locator('[data-group="walchia-whole"]').boundingBox();
  await page.mouse.move(part.x + part.width / 2, part.y + part.height / 2);
  await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 10 }); await page.mouse.up();
}
async function walkTo(target, tolerance = 0.15, stopOnFailure = false) {
  await page.locator('.stage > canvas').focus();
  for (let i = 0; i < 200; i++) {
    if (stopOnFailure && await page.locator('#retry-save').isVisible()) return;
    const p = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < tolerance) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1), h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.04, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.04, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  throw Error(`Cannot reach ${JSON.stringify(target)}`);
}
let fixture = buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia');
for (let i = 0; i < 3; i++) {
  fixture = arriveVisitor(fixture); const id = fixture.visitors.nextId - 1;
  fixture = finishVisit(payVisitor(fixture, id, CASHIER_STATION, true), id);
}
try {
  await page.goto(process.argv[3]); await ready(); await seed(fixture);
  await shot('cash-1440');
  for (const [width, height] of [[1440, 1000], [1280, 720], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height }); await ticks(1);
    await page.locator('#exhibit-walchia').click();
    await page.locator('[data-group="walchia-whole"]').click();
    await shot(`placement-${width}`);
    if (!before) {
      const target = await page.locator('[data-target="walchia-whole"]').boundingBox();
      const preview = await page.locator('#assembly-slab-preview').boundingBox();
      assert.ok(Math.abs(target.x + target.width / 2 - preview.x - preview.width / 2) < 2);
      assert.ok(Math.abs(target.y + target.height / 2 - preview.y - preview.height / 2) < 2);
      assert.ok(target.width >= 56 && target.height >= 56);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.locator('#activity-close').click();
    if (!before) {
      for (const method of ['click', 'drag']) {
        await seed(fixture); await page.locator('#exhibit-walchia').click();
        const target = await page.locator('[data-target="walchia-whole"]').boundingBox();
        if (method === 'drag') {
          const heading = await page.locator('#activity-title').boundingBox();
          await dragPart({ x: heading.x + 20, y: heading.y + 10 });
          assert.equal((await saved()).placed.includes('walchia-whole'), false, 'a miss is harmless');
          assert.equal(await page.locator('[data-group="walchia-whole"]').isVisible(), true);
          // Drop 20px beyond the circle edge: existing 28px forgiveness remains.
          await dragPart({ x: target.x + target.width + 20, y: target.y + target.height / 2 });
        } else {
          await page.locator('[data-group="walchia-whole"]').click();
          await page.locator('[data-target="walchia-whole"]').click();
        }
        assert.equal((await saved()).placed.filter(id => id === 'walchia-whole').length, 1);
        assert.equal((await saved()).economy.coins, fixture.economy.coins);
        await page.locator('#activity-close').click();
      }
      await seed(fixture);
    }
  }
  await page.locator('#exhibit-walchia').click();
  await page.locator('[data-group="walchia-whole"]').click();
  // Before capture documents the old layout; programmatic activation avoids the clipped target.
  if (before) await page.locator('[data-target="walchia-whole"]').evaluate(b => b.click());
  else await page.locator('[data-target="walchia-whole"]').tap();
  await shot('story-390');
  await page.setViewportSize({ width: 1440, height: 1000 }); await shot('story-1440');
  if (!before) {
    await page.locator('#story-animal-image').evaluate(img => img.decode());
    assert.match(await page.locator('#story-animal figcaption').innerText(), /реконструкција/);
    assert.equal((await saved()).placed.filter(id => id === 'walchia-whole').length, 1);
    assert.equal((await saved()).economy.coins, fixture.economy.coins);
    await page.locator('#activity-close').click(); await ticks(1);
    assert.equal(await page.locator('#ticket-price').innerText(), '12');
    await seed(fixture);
    assert.equal(await page.locator('#collect-cash').count(), 0);
    const hint = await page.locator('#cash-pickup-hint').boundingBox();
    await page.mouse.click(hint.x + hint.width / 2, hint.y + hint.height / 2); await ticks(1);
    assert.deepEqual(await saved(), fixture, 'clicking at the cash hint cannot collect remotely');
    assert.equal(await page.evaluate(() => window.qaScene().meshes.some(m => m.name.startsWith('ticket-banknote') && m.isPickable)), false);
    const notesBefore = await page.locator('.banknote-stack i:visible').count();
    await walkTo({ x: 6.85, z: 0.3 });
    assert.equal((await saved()).pendingTicketRevenue, fixture.pendingTicketRevenue);
    await walkTo({ x: CASH_PILE.x, z: CASH_PILE.z + 0.85 }); await ticks(1);
    assert.equal((await saved()).pendingTicketRevenue, 0);
    assert.equal((await saved()).economy.coins, fixture.economy.coins + fixture.pendingTicketRevenue);
    assert.ok(await page.locator('.banknote-stack i:visible').count() > notesBefore);
    assert.doesNotMatch(await page.locator('#coin-gain').innerText(), /\d/);
    await shot('collected-1440'); await ticks(60);
    assert.equal((await saved()).economy.coins, fixture.economy.coins + fixture.pendingTicketRevenue);
    await page.reload(); await ready();
    assert.equal((await saved()).pendingTicketRevenue, 0);
    const restoredNotes = await page.locator('.banknote-stack i:visible').count();
    assert.ok(restoredNotes > notesBefore);
    assert.equal(await page.locator('#coin-gain').innerText(), '', 'reload must not replay pickup feedback');
    // Blocked writes freeze the pending pile and wallet; repeated frame updates
    // and double retry cannot create another collection or another feedback event.
    await seed(fixture); await walkTo({ x: CASH_PILE.x, z: 0.3 });
    await failWrites(true); await walkTo({ x: CASH_PILE.x, z: CASH_PILE.z + 0.85 }, 0.15, true);
    await page.locator('#retry-save').waitFor({ state: 'visible' });
    assert.deepEqual(await saved(), fixture);
    assert.equal(await page.locator('.banknote-stack i:visible').count(), notesBefore);
    assert.equal(await page.locator('#coin-gain').innerText(), '');
    await ticks(100); assert.deepEqual(await saved(), fixture);
    await failWrites(false); await page.locator('#retry-save').evaluate(b => { b.click(); b.click(); });
    assert.equal((await saved()).economy.coins, fixture.economy.coins + fixture.pendingTicketRevenue);
    assert.equal((await saved()).pendingTicketRevenue, 0);
    await page.reload(); await ready(); assert.equal((await saved()).pendingTicketRevenue, 0);
    // Paused modal prevents movement or pickup, even with held keys.
    await seed(fixture); await walkTo({ x: CASH_PILE.x, z: 0.3 });
    await page.locator('#bag-button').click();
    await page.keyboard.down('KeyS'); await ticks(60); await page.keyboard.up('KeyS');
    assert.deepEqual(await saved(), fixture);
    await page.locator('#activity-close').click();
    // Placement failure keeps the same material available until durable retry.
    await page.locator('#exhibit-walchia').click();
    await page.locator('[data-group="walchia-whole"]').click(); await failWrites(true);
    await page.locator('[data-target="walchia-whole"]').click();
    assert.deepEqual(await saved(), fixture);
    await failWrites(false); await page.locator('#activity-retry-save').evaluate(b => { b.click(); b.click(); });
    assert.equal((await saved()).placed.filter(id => id === 'walchia-whole').length, 1);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${before ? 'before captures' : 'hotfix checks'}; ${browser.version()}`);
} finally { await context.close(); await browser.close(); }
