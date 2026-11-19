// Production uses the full economy loop but ignores the development QA save flag.
// node scripts/check-purchases-release.mjs <playwright index.mjs> <preview URL>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { PURCHASE_QA_KEY } from '../src/persistence/museum-save.ts';
import { HELPER_QA_KEY } from '../src/persistence/helper-save.ts';
import { createGameSave } from '../src/game/economy.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SITE } from '../src/content/journey.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(keys => { for (const key of keys) if (!localStorage.getItem(key)) localStorage.setItem(key, 'qa-save-must-stay-untouched'); }, [PURCHASE_QA_KEY, HELPER_QA_KEY]);
  await page.goto(new URL('?purchases=1&helpers=1', process.argv[3]).href);
  await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '20');
  assert.equal(await page.locator('.purchase-qa').count(), 0);
  assert.equal(await page.locator('#open-helper').count(), 1);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), HELPER_QA_KEY), 'qa-save-must-stay-untouched');
  assert.equal(await page.locator('.purchase-marker:visible').count(), 3);
  assert.equal(await page.locator('#open-map').count(), 1);
  assert.equal(await page.locator('.development-speed').count(), 0);
  assert.equal(await page.locator('#exhibit-button').isVisible(), false);
  assert.equal(await page.locator('#exhibit-trilobite').isVisible(), false);
  assert.equal(await page.locator('#exhibit-eryops').isVisible(), false);
  assert.equal(await page.locator('#cashier-panel').isVisible(), true);
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  assert.equal(save.version, 24); assert.equal(save.economy.coins, 20);
  await page.locator('[data-purchase="stand-trilobite"]').click(); await page.locator('#buy-purchase').click();
  assert.equal(await page.locator('#coin-count').innerText(), '12');
  await page.locator('#open-map').click(); await page.locator('[data-travel="courtyard-dig"]').click();
  await page.reload(); await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '12');
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).world.location.kind, SAVE_KEY), 'site-camp');
  const old = createGameSave({ ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
    collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: ['trilobite-whole'] }, 42);
  await page.evaluate(([key, old]) => localStorage.setItem(key, JSON.stringify(old)), [SAVE_KEY, old]); await page.reload();
  await page.waitForFunction(() => document.querySelector('#ticket-price')?.textContent === '2');
  const migrated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  assert.equal(migrated.version, 24); assert.equal(migrated.museum.owned.length, 4);
  assert.equal(migrated.world.owned[0].source, 'legacy'); assert.equal(migrated.economy.coins, old.economy.coins);
  assert.deepEqual(migrated.visitors.sales, { version: 1, counts: {} }); assert.deepEqual(migrated.placed, old.placed);
  assert.deepEqual(migrated.upgrades.owned, []);
  await page.locator('#open-upgrades').click(); await page.locator('[data-upgrade="boots"]').click();
  assert.equal(await page.locator('#coin-count').innerText(), '4');
  await page.reload(); await page.waitForFunction(() => document.querySelector('#coin-count')?.textContent === '4');
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).upgrades.owned, SAVE_KEY), [{ id: 'boots', paid: 16 }]);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), PURCHASE_QA_KEY), 'qa-save-must-stay-untouched');
  assert.deepEqual(errors, []);
  console.log(`PASS: production uses schema-24 paid progression/map/cashier/upgrades, saves purchases/travel, migrates existing entitlements and preserves isolated QA storage; Edge ${browser.version()}.`);
} finally { await browser.close(); }
