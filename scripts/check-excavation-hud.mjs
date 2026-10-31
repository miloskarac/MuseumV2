// node scripts/check-excavation-hud.mjs <playwright index.mjs> <Vite URL> [before|after]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SITE } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const stage = process.argv[4] ?? 'after', errors = [];
page.on('pageerror', e => errors.push(e.message));
async function seed(state) {
  await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, state]);
  await page.reload(); await page.locator('#room-name').waitFor(); await page.waitForTimeout(250);
}
try {
  await page.goto(process.argv[3]);
  const state = { ...freshJourney(), room: 'excavation' };
  await seed(state);
  assert.equal(await page.locator('.dig-panel').isVisible(), stage === 'before');
  assert.equal(await page.locator('#clean-button').isVisible(), false);
  await page.screenshot({ path: `docs/qa/excavation-hud-${stage}.png` });
  await seed({ ...state, dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])) });
  assert.equal(await page.locator('#clean-button').isVisible(), true);
  await page.locator('#clean-button').click();
  assert.equal(await page.locator('#cleaning-view').isVisible(), true);
  await page.locator('#activity-close').click();
  assert.equal(await page.locator('#clean-button').isVisible(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `docs/qa/excavation-hud-${stage}-clean.png` });
  await page.locator('#clean-button').click();
  assert.equal(await page.locator('#cleaning-view').isVisible(), true);
  await seed({ ...state, room: 'outdoors' });
  assert.equal(await page.locator('.dig-panel').isVisible(), true, 'outdoor site information remains');
  assert.equal(await page.locator('#clean-button').isVisible(), false);
  await seed({ ...state, room: 'museum' });
  assert.equal(await page.locator('.dig-panel').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}, ${stage} excavation HUD; cleaning opens/reopens on desktop/mobile, outdoor information preserved.`);
} finally { await browser.close(); }
