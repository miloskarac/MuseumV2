// node scripts/check-ticket-ledger.mjs <Playwright index.mjs> <production preview URL>
// Every context is disposable. Never attaches to an existing browser/profile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { loadCreditSave } from '../src/persistence/credit-save.ts';
import { parseRoomSave } from '../src/persistence/room-save.ts';
import { createCreditSave } from '../src/game/expansion-credit.ts';
import { parseLedgerSave } from '../src/persistence/ledger-save.ts';
import { createRoomSave } from '../src/game/room-ownership.ts';

const fixtures = JSON.parse(readFileSync(new URL('../tests/fixtures/save-compatibility.json', import.meta.url), 'utf8'));
const schema22 = Object.fromEntries(Object.entries(fixtures).map(([name, fixture]) =>
  [`${name}-as22`, parseLedgerSave(JSON.stringify(fixture), 42)]));
const schema23 = Object.fromEntries(Object.entries(fixtures).map(([name, fixture]) =>
  [`${name}-as23`, parseRoomSave(JSON.stringify(fixture), 42)]));
const cases = { ...fixtures, ...schema22, ...schema23, fresh23: createRoomSave(42), fresh24: createCreditSave(42) };
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let passed = 0;
try {
  for (const [name, fixture] of Object.entries(cases)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    try {
      await context.addInitScript(({ key, fixture }) => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(key, JSON.stringify(fixture)); sessionStorage.setItem('seeded', '1');
        }
      }, { key: SAVE_KEY, fixture });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
      await page.goto(process.argv[3]);
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.version === 24, SAVE_KEY);
      // Schema 12 has a newly generated migration seed; compare its entitlements
      // separately. All persisted-economy inputs must restore bit-for-bit.
      const result = loadCreditSave({ getItem: () => JSON.stringify(fixture), setItem() { assert.fail(); }, removeItem() { assert.fail(); } }, 42);
      assert.equal(result.kind, 'ready');
      const actual = await saved(), expected = result.save;
      assert.deepEqual(actual.rooms, { version: 1, owned: [] });
      if (fixture.economy) assert.deepEqual(actual, expected, name);
      else {
        const { economy: actualEconomy, ...actualProgress } = actual;
        const { economy: _expectedEconomy, ...expectedProgress } = expected;
        assert.deepEqual(actualProgress, expectedProgress, name); assert.equal(actualEconomy.coins, 20);
        assert.deepEqual(actualEconomy.sites['courtyard-dig'].claimed, []);
      }
      await page.reload();
      await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
      assert.deepEqual(await saved(), actual, `${name}: repeated reload`); assert.deepEqual(errors, []);
      passed++;
    } finally { await context.close(); }
  }
  const context = await browser.newContext();
  try {
    await context.addInitScript(({ key, fixture }) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      localStorage.setItem(key, JSON.stringify(fixture));
      const original = Storage.prototype.setItem; window.failMigration = true;
      Storage.prototype.setItem = function(k, value) {
        if (k === key && window.failMigration) throw Error('QA migration write failure');
        return original.call(this, k, value);
      };
    }, { key: SAVE_KEY, fixture: schema23['deposits21-as23'] });
    const page = await context.newPage(); await page.goto(process.argv[3]);
    await page.locator('#retry-save').waitFor({ state: 'visible' });
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    assert.deepEqual(await saved(), schema23['deposits21-as23']);
    await page.evaluate(() => { window.failMigration = false; });
    await page.locator('#retry-save').evaluate(button => { button.click(); button.click(); });
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).version === 24, SAVE_KEY);
    const result = await saved();
    assert.deepEqual(result.rooms, { version: 1, owned: [] });
    assert.deepEqual(result.expansionCredit, { version: 1, sources: [{ id: 'west-wing', recognized: 5, remaining: 5, consumed: 0 }] });
    assert.equal(result.economy.coins, 16); assert.equal(result.pendingTicketRevenue, 2);
    assert.deepEqual(result.visitors.sales, { version: 1, counts: { '2': 4 } });
    assert.deepEqual(result.payments, fixtures.deposits21.payments); passed++;
  } finally { await context.close(); }
  const invalidContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const invalid = { ...createCreditSave(42), rooms: { version: 1, owned: [{ id: 'permian-room-2', source: 'purchase', paid: 18 }] } };
    await invalidContext.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw: JSON.stringify(invalid) });
    const page = await invalidContext.newPage(); await page.goto(process.argv[3]);
    await page.locator('#recovery-retry').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY), invalid);
    passed++;
  } finally { await invalidContext.close(); }
  console.log(`PASS: ${passed}/${Object.keys(cases).length + 2} production credit/ownership/ledger browser cases; historical and schema-22/23 migrations, schema-24 reload, failed migration/retry, invalid ownership recovery; Edge ${browser.version()}, 1280x720.`);
} finally { await browser.close(); }
