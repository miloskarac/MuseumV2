// Focused early-stand browser regression. Uses an existing Playwright installation.
// node scripts/check-phase6-batch1.mjs <Playwright index.mjs> <Vite URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createGameSave } from '../src/game/economy.ts';
import { createCashSave, collectTicketRevenue } from '../src/game/cash.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
import { parseCashSave } from '../src/persistence/cash-save.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITE } from '../src/content/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { arriveVisitor, payVisitor, finishVisit } from '../src/game/visitors.ts';
import { CASHIER_STATION } from '../src/content/visitors.ts';
const journey = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
  collected: ['trilobite-slab'], placed: ['trilobite-whole'] };
const old = createGameSave(journey, 42);
let fixture = { ...createCashSave(42), ...journey, version: 21,
  custody: parseCashSave(JSON.stringify(old), 42).custody, economy: { ...old.economy, coins: 12 },
  museum: { version: 1, owned: [{ id: 'stand-trilobite', source: 'purchase', paid: 8 }] } };
for (let i = 0; i < 20; i++) {
  fixture = arriveVisitor(fixture); const id = fixture.visitors.nextId - 1;
  fixture = finishVisit(payVisitor(fixture, id, CASHIER_STATION, true), id);
}
fixture = collectTicketRevenue(fixture);
assert.ok(parseCashSave(JSON.stringify(fixture), 42));
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  await page.goto(process.argv[3]); await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '20');
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SAVE_KEY, fixture]);
  await page.reload(); await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '52');
  assert.equal(await page.locator('[data-purchase="west-wing"]').isVisible(), false);
  for (const [id, cost] of [['stand-eryops', 12], ['stand-dimetrodon', 12]]) {
    const before = await saved();
    await page.locator(`[data-purchase="${id}"]`).click();
    assert.equal(await page.locator('#buy-purchase').isEnabled(), true);
    await page.locator('#buy-purchase').evaluate(b => { b.click(); b.click(); });
    assert.equal((await saved()).economy.coins, before.economy.coins - cost);
    assert.equal((await saved()).museum.owned.filter(p => p.id === id).length, 1);
    await page.reload(); await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
    assert.ok(parseCreditSave(JSON.stringify(await saved()), 42));
  }
  const complete = await saved(); assert.deepEqual(complete.closedSites, []); assert.deepEqual(complete.world.owned, []);
  await page.screenshot({ path: `docs/qa/${process.argv[4] || 'batch1'}-early-stands.png` });
  await page.locator('#open-map').click();
  assert.equal(await page.locator('[data-site-buy="eryops-dig"]').isDisabled(), true);
  await page.screenshot({ path: `docs/qa/${process.argv[4] || 'batch1'}-site-still-locked.png` });
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; all stands before site-two access/first-site closure, unchanged prices, duplicate-click guards, reload, independent site lock; 1280x720.`);
} finally { await browser.close(); }
