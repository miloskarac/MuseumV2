// node scripts/check-story-illustrations.mjs <playwright index.mjs> <URL> [before]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ALL_PARTS, EXHIBITS } from '../src/content/exhibit.ts';
import { SITES } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { parseSave } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const before = process.argv[4] === 'before', errors = [];
const fixture = { ...freshJourney(), dig: Object.fromEntries(SITES.flatMap(site => site.cells.map(cell => [cell.id, 1]))),
  collected: ALL_PARTS.map(part => part.discoveryId), placed: ALL_PARTS.map(part => part.id), closedSites: SITES.map(site => site.id) };
assert.ok(parseSave(JSON.stringify(fixture)));
page.on('pageerror', error => errors.push(error.message));
// The game and pictures must work without any external image service.
await page.route('**/*', route => new URL(route.request().url()).origin === new URL(process.argv[3]).origin
  ? route.continue() : route.abort());
try {
  await page.addInitScript(state => {
    if (!sessionStorage.storyPicturesSeeded) {
      localStorage.setItem('museum-for-luka-v2', JSON.stringify(state));
      sessionStorage.storyPicturesSeeded = '1';
    }
  }, fixture);
  await page.goto(process.argv[3]);
  for (const exhibit of before ? EXHIBITS.slice(0, 1) : EXHIBITS) {
    await page.locator(`[data-exhibit="${exhibit.id}"]`).click();
    await page.locator('#story-view').waitFor();
    for (const [width, height] of before ? [[1440, 1000]] : [[1440, 1000], [1280, 720], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.locator('dialog').evaluate(element => { element.scrollTop = 0; });
      await page.waitForTimeout(300);
      if (!before) {
        await page.locator('#story-animal-image').evaluate(image => image.decode());
        assert.ok(await page.locator('#story-animal-image').evaluate(image => image.naturalWidth > 0 && image.alt.length > 0));
        const left = await page.locator(exhibit.mode === 'whole' ? '#whole-view' : '#assembly-view').boundingBox();
        const right = await page.locator('#story-animal').boundingBox();
        assert.ok(width > 700 ? left.x + left.width <= right.x + 1 : left.y + left.height <= right.y + 1);
        assert.equal(await page.locator('dialog').evaluate(element => element.scrollWidth > element.clientWidth), false);
        assert.equal(await page.locator('.story-facts h3').count(), 4);
        assert.equal(await page.locator('.story-image-credit a').count(), 2);
      }
      await page.screenshot({ path: `docs/qa/story-illustration-${before ? 'before' : exhibit.id}-${width}.png` });
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  if (!before) {
    await page.reload(); await page.locator('[data-exhibit="dimetrodon"]').click();
    await page.locator('#story-animal-image').evaluate(image => image.decode());
    await page.keyboard.press('Escape');
    const partial = { ...fixture, placed: fixture.placed.filter(id => id !== 'tail') };
    await page.evaluate(state => localStorage.setItem('museum-for-luka-v2', JSON.stringify(state)), partial);
    await page.reload(); await page.locator('[data-exhibit="dimetrodon"]').click();
    assert.equal(await page.locator('#story-animal').isVisible(), false, 'illustration hidden during assembly');
    assert.equal(await page.locator('#assembly-count').isVisible(), true);
    await page.locator('[data-group="tail"]').click(); await page.locator('[data-target="tail"]').click();
    await page.locator('#story-animal-image').evaluate(image => image.decode());
    assert.equal(await page.locator('#story-animal').isVisible(), true, 'final placement opens illustrated story');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('museum-for-luka-v2')).placed.sort()), [...fixture.placed].sort());
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Edge ${browser.version()}; ${before ? 'before capture' : 'three local illustrations, desktop/mobile layout, reload, final placement and assembly isolation'}.`);
} finally { await browser.close(); }
