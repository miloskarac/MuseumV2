// Capture the initial scene at the Phase 1 comparison viewport, without moving the player.
// node scripts/capture-lighting.mjs <playwright index.mjs> <URL> <output.png>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(process.argv[3]);
  await page.locator('#room-name').filter({ hasText: 'Музеј' }).waitFor();
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('.error-message').isVisible(), false);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: process.argv[4] });
  console.log(`Edge ${browser.version()}, 1440 × 1000, DPR 1, initial camera/player. No browser errors. Saved ${process.argv[4]}`);
} finally {
  await browser.close();
}
