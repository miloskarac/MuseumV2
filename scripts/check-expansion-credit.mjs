// Disposable Edge contexts only. Args: Playwright module, preview URL, dev URL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { parseRoomSave } from '../src/persistence/room-save.ts';
import { parseCreditSave } from '../src/persistence/credit-save.ts';
const fixtures = JSON.parse(readFileSync(new URL('../tests/fixtures/save-compatibility.json', import.meta.url), 'utf8'));
function partial(amount) {
  const s = parseRoomSave(JSON.stringify(fixtures.deposits21), 42); s.economy.coins += 5 - amount;
  if (amount) s.payments.partial['west-wing'] = amount; else delete s.payments.partial['west-wing'];
  assert.ok(parseRoomSave(JSON.stringify(s), 42)); return s;
}
function credit(s, amount) {
  assert.equal(s.version, 24); assert.deepEqual(s.expansionCredit, { version: 1,
    sources: [{ id: 'west-wing', recognized: amount, remaining: amount, consumed: 0 }] });
  assert.deepEqual(s.rooms, { version: 1, owned: [] }); assert.ok(parseCreditSave(JSON.stringify(s), 42));
}
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let passed = 0;
async function seedContext(seed) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(({ key, seed }) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, JSON.stringify(seed)); sessionStorage.setItem('seeded', '1'); }
    const original = Storage.prototype.setItem;
    window.qaFail = false;
    Storage.prototype.setItem = function(k, value) {
      if (k === key && window.qaFail) throw Error('QA credit write failure');
      return original.call(this, k, value);
    };
  }, { key: SAVE_KEY, seed });
  return context;
}
async function ready(page) {
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.version === 24
    && document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—', SAVE_KEY);
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
try {
  for (const amount of [0, 7, 10, 17]) {
    const context = await seedContext(partial(amount));
    try {
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.argv[3]); await ready(page); credit(await saved(page), amount);
      const before = await saved(page);
      assert.equal(await page.locator('[data-purchase="west-wing"]').isVisible(), false);
      assert.equal(await page.locator('[data-purchase="stand-eryops"]').isVisible(), true);
      await page.reload(); await ready(page);
      const after = await saved(page); credit(after, amount);
      assert.deepEqual(after, before, 'retired expansion neither charges nor refunds on reload');
      await page.evaluate(() => { delete document.hidden; });
      await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
      credit(await saved(page), 0); assert.equal((await saved(page)).economy.coins, 20);
      assert.deepEqual(errors, []); passed++;
    } finally { await context.close(); }
  }
  for (const kind of ['inflated', 'consumed', 'duplicate']) {
    const invalid = parseCreditSave(JSON.stringify(partial(7)), 42), source = invalid.expansionCredit.sources[0];
    if (kind === 'inflated') source.recognized = source.remaining = 18;
    if (kind === 'consumed') { source.remaining = 6; source.consumed = 1; }
    if (kind === 'duplicate') invalid.expansionCredit.sources.push({ ...source });
    const context = await seedContext(invalid);
    try {
      const page = await context.newPage(); await page.goto(process.argv[3]);
      await page.locator('#recovery-retry').waitFor({ state: 'visible' });
      assert.deepEqual(await saved(page), invalid); passed++;
    } finally { await context.close(); }
  }
  console.log(`PASS: ${passed}/7 credit browser scenarios; four preserved historical-deposit/reload/reset cases and three corrupt-credit recovery cases; wing purchases retired in Room 1; Edge ${browser.version()}, 1280x720.`);
} finally { await browser.close(); }
