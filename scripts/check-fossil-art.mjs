// Disposable Edge profile. Capture all six finds at the real cleaning/pit camera scale.
// node scripts/check-fossil-art.mjs <playwright index.mjs> <URL> <before|after>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { DISCOVERIES, SITE, CLEANING_AREAS } from '../src/content/journey.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
import { freshJourney } from '../src/game/journey.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const prefix = `docs/qa/fossil-art-${process.argv[4]}`;
async function seed(state) {
  await page.goto('about:blank');
  await page.addInitScript(([key, state]) => {
    if (location.protocol.startsWith('http')) localStorage.setItem(key, JSON.stringify(state));
  }, [SAVE_KEY, state]);
  await page.goto(process.argv[3]);
  await page.locator('#bag-button').waitFor();
  await page.waitForTimeout(350);
}
try {
  await page.goto(process.argv[3]);
  const dig = Object.fromEntries(SITE.cells.map(c => [c.id, 1]));
  for (const find of DISCOVERIES) {
    await seed({ ...freshJourney(), room: 'excavation', dig,
      collected: DISCOVERIES.filter(d => d.id !== find.id).map(d => d.id),
      cleaning: { [find.id]: [...CLEANING_AREAS] } });
    await page.screenshot({ path: `${prefix}-pit-${find.groupId}.png` });
    await page.locator('#clean-button').click();
    await page.screenshot({ path: `${prefix}-clean-${find.groupId}.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({ path: `${prefix}-clean-${find.groupId}-1280.png` });
    const tray = await page.locator('#cleaning-canvas').boundingBox();
    assert.ok(tray.x >= 0 && tray.y >= 0 && tray.x + tray.width <= 1280 && tray.y + tray.height <= 720);
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator('#cleaning-progress').evaluate(e => e.value), 1);
    await page.locator('#collect-fossil').click();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    assert.equal(saved.collected.length, 6);
    assert.equal(new Set(saved.collected).size, 6);
  }
  await seed({ ...freshJourney(), dig, collected: DISCOVERIES.map(d => d.id),
    closedSites: [SITE.id], placed: DISCOVERIES.map(d => d.groupId) });
  await page.screenshot({ path: `${prefix}-museum.png` });
  assert.deepEqual(errors, []);
  console.log(`PASS: six distinct find fixtures, cleaning/collection, museum; Edge ${browser.version()}, 1440x1000.`);
} finally { await browser.close(); }
