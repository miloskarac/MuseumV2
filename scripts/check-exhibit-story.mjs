// Isolated Edge QA for the completed stand name and educational card.
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
  collected: [...SITE.requiredDiscoveryIds], closedSites: [SITE.id], placed: GROUPS.map(g => g.id) };
assert.ok(parseSave(JSON.stringify(fixture)));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.addInitScript(([key, state]) => {
    if (!sessionStorage.storySeeded) { localStorage.setItem(key, JSON.stringify(state)); sessionStorage.storySeeded = '1'; }
  }, [SAVE_KEY, fixture]);
  await page.goto(process.argv[3]); await page.waitForTimeout(800);
  await page.screenshot({ path: `docs/qa/exhibit-story-${before ? 'before' : 'after'}-museum.png` });
  await page.locator('#exhibit-button').click(); await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/qa/exhibit-story-${before ? 'before' : 'after'}-card.png` });
  if (!before) {
    const labelEnabled = () => page.evaluate(async () => {
      const source = await (await fetch('/src/presentation/world.ts')).text();
      const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
      return Engine.Instances[0].scenes[0].getMeshByName('exhibit-name').isEnabled();
    });
    assert.equal(await labelEnabled(), true);
    assert.equal(await page.locator('.story-facts h3').count(), 4);
    assert.match(await page.locator('#activity-title').innerText(), /Упознај Диметродона/);
    assert.equal(await page.locator('#assembly-canvas').isVisible(), true);
    for (const [width, height] of [[1280, 720], [1440, 1000], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.locator('dialog').evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(250);
      assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
      assert.equal(await page.locator('#assembly-count').isVisible(), false);
      await page.screenshot({ path: `docs/qa/exhibit-story-after-card-${width}.png` });
      await page.locator('#activity-close').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/qa/exhibit-story-after-card-bottom-${width}.png` });
      await page.locator('#activity-close').click();
      await page.locator('#exhibit-button').click();
      assert.equal(await page.locator('dialog').evaluate(el => el.scrollTop), 0, 'story reopens at its heading');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
    await page.reload(); await page.waitForTimeout(400);
    assert.equal(await labelEnabled(), true, 'completed name restored on reload');
    // One missing part keeps the plate blank; final placement reveals the name immediately.
    await page.evaluate(([key, state]) => localStorage.setItem(key, JSON.stringify(state)), [SAVE_KEY, { ...fixture, placed: fixture.placed.slice(0, -1) }]);
    await page.reload(); await page.waitForTimeout(400);
    assert.equal(await labelEnabled(), false, 'partial stand has no name');
    await page.locator('#exhibit-button').click();
    await page.locator('[data-group="tail"]').click(); await page.locator('[data-target="tail"]').click();
    assert.equal(await labelEnabled(), true, 'final placement reveals name');
    assert.equal(await page.locator('#story-view').isVisible(), true);
    await page.locator('#activity-close').click();
    await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
    assert.equal(await labelEnabled(), false, 'reset clears the plate');
    await page.locator('#exhibit-button').click();
    assert.equal(await page.locator('#story-view').isVisible(), false);
    assert.equal(await page.locator('#story-era').isVisible(), false, 'story decoration does not leak into assembly');
    assert.equal(await page.locator('#assembly-count').isVisible(), true);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${before ? 'before screenshots' : 'name completion/reload/reset, story facts, responsive layout, modal close and assembly isolation'}; Edge ${browser.version()}`);
} finally { await browser.close(); }
