import { threeRoom1Displays, recoverWalchia } from '../tests/helpers/walchia-fixture.ts';
// Disposable Edge contexts; completed-room scene setup is synthetic.
// Args: existing Playwright index.mjs, Vite URL, optional production preview URL.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { parseRoom1Game } from '../src/persistence/room1-game-save.ts';
import { buyPurchase, advanceMuseum, placeOwnedGroup } from '../src/game/purchases.ts';
import { screenDirection } from '../src/game/navigation.ts';
import { CASHIER_STATION, CASH_PILE } from '../src/content/visitors.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const shot = name => page.screenshot({ path: `docs/qa/walchia-${name}.png` });
const ticks = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.qaTick(); }, n);
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  assert.equal((await saved()).version, 26);
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0]; window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop(); engine.getDeltaTime = () => 50;
    window.qaScene = () => engine.scenes[0]; delete document.hidden;
  });
  await page.bringToFront(); await page.locator('.stage > canvas').focus();
}
async function seed(save) {
  assert.ok(parseRoom1Game(JSON.stringify(save), 42));
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [SAVE_KEY, save]);
  await page.reload(); await ready(); await ticks(1);
}
async function walkTo(target, tolerance = 0.18) {
  await page.locator('.stage > canvas').focus();
  for (let i = 0; i < 200; i++) {
    const p = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
    const dx = target.x - p.x, dz = target.z - p.z;
    if (Math.hypot(dx, dz) < tolerance) return;
    const right = screenDirection(1, 0), up = screenDirection(0, 1), h = dx * right.x + dz * right.z, v = dx * up.x + dz * up.z, keys = [];
    if (Math.abs(h) > Math.max(0.04, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(v) > Math.max(0.04, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
    for (const key of keys) await page.keyboard.down(key); await ticks(1); for (const key of keys) await page.keyboard.up(key);
  }
  const actual = await page.evaluate(() => { const p = window.qaScene().getTransformNodeByName('player').position; return { x: p.x, z: p.z }; });
  throw Error(`Cannot reach ${JSON.stringify(target)} from ${JSON.stringify(actual)}`);
}
async function capture(name) {
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100); await ticks(1); await shot(`${name}-${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await page.goto(process.argv[3]); await ready();
  const before = buyPurchase(recoverWalchia(threeRoom1Displays()), 'stand-walchia');
  const full = advanceMuseum(before, placeOwnedGroup(before, 'walchia', 'walchia-whole', 'walchia-whole'));
  await seed(full); await capture('display-restored');
  assert.equal(await page.locator('#room-completion').isVisible(), false);
  await walkTo({ x: CASHIER_STATION.x, z: 1.6 }); await walkTo(CASHIER_STATION);
  let viewing = null, previous = [];
  for (let n = 0; n < 70 && !viewing; n++) {
    await ticks(40);
    const poses = await page.evaluate(() => window.qaScene().transformNodes.filter(m => /^visitor-\d+$/.test(m.name))
      .map(m => ({ name: m.name, x: m.position.x, z: m.position.z, facing: m.rotation.y })));
    viewing = poses.find(p => Math.hypot(p.x + 11, p.z - 4.5) < 2.7
      && previous.some(old => old.name === p.name && Math.hypot(old.x - p.x, old.z - p.z) < 0.01)
      && Math.abs(Math.sin(p.facing) * (p.z - 4.5) - Math.cos(p.facing) * (p.x + 11)) < 0.02);
    previous = poses;
  }
  assert.ok(viewing, 'a visitor stops and faces the Walchia stand');
  assert.ok((await saved()).visitors.visits.some(v => v.paid === 12)); await capture('visitor-viewing');
  await walkTo({ x: CASHIER_STATION.x, z: 0.3 });
  const pending = (await saved()).pendingTicketRevenue, coins = (await saved()).economy.coins;
  assert.ok(pending >= 12); await walkTo({ x: CASH_PILE.x, z: 0.3 });
  await walkTo({ x: CASH_PILE.x, z: CASH_PILE.z + 0.85 }); await ticks(1);
  assert.equal((await saved()).economy.coins, coins + pending);
  if (process.argv[4]) {
    const prod = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const p = await prod.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(process.argv[4]); await p.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '20');
    await p.evaluate(([key, value]) => localStorage.setItem(key, value), [SAVE_KEY, JSON.stringify(full)]);
    await p.reload(); await p.waitForFunction(() => document.querySelector('#ticket-price')?.textContent === '12');
    assert.equal(await p.locator('.development-speed').count(), 0);
    assert.equal(await p.locator('#room-completion').isVisible(), false);
    await p.screenshot({ path: 'docs/qa/walchia-production-390.png' });
    await p.locator('#exhibit-walchia').tap();
    await p.locator('#story-animal-image').evaluate(img => img.decode());
    const imageUrl = await p.locator('#story-animal-image').getAttribute('src');
    assert.ok(imageUrl.startsWith('data:image/svg+xml') || new URL(imageUrl, process.argv[4]).origin === new URL(process.argv[4]).origin);
    assert.match(await p.locator('#story-animal figcaption').innerText(), /реконструкција/);
    await p.screenshot({ path: 'docs/qa/hotfix77-production-story-390.png' });
    await p.locator('#activity-close').tap();
    await p.locator('#reset-button').tap(); await p.locator('#confirm-reset').tap();
    await p.locator('[data-purchase="stand-dimetrodon"]').tap(); await p.locator('#buy-purchase').tap();
    assert.equal(await p.locator('#coin-count').innerText(), '8'); await prod.close();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: restored four-display desktop/mobile visuals, actual 12-coin visitor viewing Walchia (${viewing.name}), cash collection, production mobile restore/reset/touch purchase. Scene setup is synthetic.`);
} catch (error) { await shot('scene-failure'); throw error; }
finally { await context.close(); await browser.close(); }
