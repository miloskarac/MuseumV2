// Visual bag QA in an isolated Edge profile using an existing Playwright install.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { GROUPS } from '../src/content/exhibit.ts';
import { SITE } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY, parseSave } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const before = process.argv[4] === 'before';
const errors = [];
const fixture = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
  collected: GROUPS.map(g => g.discoveryId), closedSites: [SITE.id] };
assert.ok(parseSave(JSON.stringify(fixture)));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([key, state]) => {
    if (!sessionStorage.bagSeeded) { localStorage.setItem(key, JSON.stringify(state)); sessionStorage.bagSeeded = '1'; }
  }, [SAVE_KEY, fixture]);
  await page.goto(process.argv[3]);
  await page.locator('#bag-button').click();
  await page.screenshot({ path: `docs/qa/bag-${before ? 'before' : 'after'}.png` });
  if (!before) {
    assert.equal(await page.locator('#bag-list li svg').count(), 6);
    assert.deepEqual(await page.locator('#bag-list li > span').allTextContents(), GROUPS.map(g => g.label));
    const pictures = await page.locator('#bag-list svg').evaluateAll(nodes => nodes.map(n => n.outerHTML));
    await page.locator('#activity-close').click();
    await page.locator('#exhibit-button').click();
    assert.deepEqual(await page.locator('.assembly-parts svg').evaluateAll(nodes => nodes.map(n => n.outerHTML)), pictures, 'bag reuses assembly illustrations');
    await page.locator('[data-group="skull"]').click(); await page.locator('[data-target="skull"]').click();
    await page.locator('#activity-close').click();
    await page.locator('#bag-button').click();
    assert.equal(await page.locator('#bag-list li').count(), 5);
    assert.equal(await page.locator('[data-bag-group="skull"]').count(), 0, 'placed bone leaves bag');
    await page.reload(); await page.locator('#bag-button').click();
    assert.equal(await page.locator('#bag-list li svg').count(), 5, 'inventory survives reload');
    await page.locator('#activity-close').click();
    // Partial recovery: only collected, unplaced parts are visible.
    const partial = { ...fixture, collected: GROUPS.slice(0, 2).map(g => g.discoveryId), closedSites: [], placed: ['skull'] };
    assert.ok(parseSave(JSON.stringify(partial)));
    await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, partial]);
    await page.reload(); await page.locator('#bag-button').click();
    assert.deepEqual(await page.locator('#bag-list li').evaluateAll(nodes => nodes.map(n => n.dataset.bagGroup)), ['spine-sail']);
    await page.locator('#activity-close').click();
    await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, fixture]);
    await page.reload(); await page.locator('#bag-button').click();
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
      for (const tile of await page.locator('#bag-list li').all()) {
        const b = await tile.boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= width && b.y >= 0 && b.y + b.height <= height);
      }
      await page.screenshot({ path: `docs/qa/bag-after-${width}.png` });
    }
    await page.keyboard.press('Escape');
    await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
    await page.locator('#bag-button').click();
    assert.equal(await page.locator('#bag-list li').count(), 0);
    assert.ok((await page.locator('#activity-hint').innerText()).length, 'empty bag still explains what to do');
    await page.screenshot({ path: 'docs/qa/bag-after-empty.png' });
    await page.locator('#activity-close').click();
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${before ? 'before capture' : 'shared pictures, collected/unplaced inventory, placement, reload, empty bag, responsive layout and close'}; Edge ${browser.version()}`);
} finally { await browser.close(); }
