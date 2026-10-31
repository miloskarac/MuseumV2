// Isolated Edge profile; run with an existing Playwright installation and Vite URL.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { GROUPS } from '../src/content/exhibit.ts';
import { SITE } from '../src/content/journey.ts';
import { freshJourney } from '../src/game/journey.ts';
import { SAVE_KEY, parseSave } from '../src/persistence/save.ts';
import { EXHIBIT_MARKER } from '../src/game/navigation.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  for (const [name, placed] of [['empty', []], ['partial', ['skull']], ['complete', GROUPS.map(g => g.id)]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(e.message));
    const fixture = { ...freshJourney(), dig: Object.fromEntries(SITE.cells.map(c => [c.id, 1])),
      collected: [...SITE.requiredDiscoveryIds], placed, closedSites: [SITE.id] };
    assert.ok(parseSave(JSON.stringify(fixture)), 'valid QA save');
    await page.addInitScript(([key, state]) => {
      if (!sessionStorage.seeded) {
        localStorage.setItem(key, JSON.stringify(state)); sessionStorage.seeded = '1';
      }
    }, [SAVE_KEY, fixture]);
    await page.goto(process.argv[3]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `docs/qa/exhibit-marker-${process.argv[4] ?? 'after'}-${name}.png` });
    if (process.argv[4] !== 'before') {
      const marker = page.locator('#exhibit-button');
      const inspect = () => page.evaluate(async () => {
        const source = await (await fetch('/src/presentation/world.ts')).text();
        const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
        window.qaScene = () => Engine.Instances[0].scenes[0];
        return window.qaScene().getMeshByName('exhibit-ring').material.diffuseColor.toHexString();
      });
      assert.equal(await page.locator('.plaque').count(), 0, 'floating card removed');
      assert.equal(await marker.getAttribute('data-state'), name);
      const color = { empty: '#328ED1', partial: '#E4B52B', complete: '#449B80' }[name];
      assert.equal(await inspect(), color);
      await page.reload(); await page.waitForTimeout(500);
      assert.equal(await inspect(), color, 'floor color survives reload');
      await marker.click();
      assert.equal(await page.locator('#story-view').isVisible(), name === 'complete');
      assert.equal(await page.locator('#assembly-canvas').isVisible(), true);
      await page.locator('#activity-close').click();
      for (const [width, height] of [[390, 844], [1280, 720]]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
        const b = await marker.boundingBox();
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height);
        await page.screenshot({ path: `docs/qa/exhibit-marker-after-${name}-${width}.png` });
        // Keyboard activation remains available without visible text over the stand.
        await marker.focus(); await page.keyboard.press('Enter');
        assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
        await page.locator('#activity-close').click();
      }
      if (name === 'empty') {
        const position = () => page.evaluate(() => {
          const p = window.qaScene().getTransformNodeByName('player').position;
          return { x: p.x, z: p.z };
        });
        const approach = async (target, opens = false) => {
          for (let i = 0; i < 100; i++) {
            if (opens && await page.locator('dialog').evaluate(el => el.open)) return;
            const p = await position(), dx = target.x - p.x, dz = target.z - p.z;
            if (!opens && Math.hypot(dx, dz) < 0.2) return;
            const h = dx * 0.8 + dz * 0.6, v = dx * -0.6 + dz * 0.8;
            const keys = [];
            if (Math.abs(h) > Math.max(0.06, Math.abs(v) * 0.414)) keys.push(h > 0 ? 'KeyD' : 'KeyA');
            if (Math.abs(v) > Math.max(0.06, Math.abs(h) * 0.414)) keys.push(v > 0 ? 'KeyW' : 'KeyS');
            for (const key of keys) await page.keyboard.down(key);
            await page.waitForTimeout(80);
            for (const key of keys) await page.keyboard.up(key);
          }
          throw Error(`Could not approach ${JSON.stringify(target)}`);
        };
        await approach({ x: 4, z: -3.5 });
        await approach(EXHIBIT_MARKER, true);
        assert.equal(await page.locator('#story-view').isVisible(), false);
        await page.locator('#activity-close').click();
        await page.waitForTimeout(500);
        assert.equal(await page.locator('dialog').evaluate(el => el.open), false, 'closing on ring does not reopen');
        await approach({ x: EXHIBIT_MARKER.x, z: -4.2 });
        await approach(EXHIBIT_MARKER, true);
        for (const [index, group] of GROUPS.entries()) {
          await page.locator(`[data-group="${group.id}"]`).click();
          await page.locator(`[data-target="${group.id}"]`).click();
          assert.equal(await marker.getAttribute('data-state'), index === GROUPS.length - 1 ? 'complete' : 'partial');
          assert.equal(await inspect(), index === GROUPS.length - 1 ? '#449B80' : '#E4B52B');
        }
        assert.equal(await page.locator('#story-view').isVisible(), true);
        await page.locator('#activity-close').click();
        await approach({ x: EXHIBIT_MARKER.x, z: -4.2 });
        await approach(EXHIBIT_MARKER);
        assert.equal(await page.locator('dialog').evaluate(el => el.open), false, 'completed circle does not open story automatically');
        await page.locator('#about-fossil').click();
        assert.equal(await page.locator('#story-view').isVisible(), true, 'explicit about button opens story');
        await page.locator('#activity-close').click();
        await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
        assert.equal(await marker.getAttribute('data-state'), 'empty');
        assert.equal(await inspect(), '#328ED1', 'reset clears marker color');
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: exhibit colors, reload, click/keyboard/walk interaction, close/re-enter, six placements, reset and responsive screenshots; Edge ${browser.version()}`);
} finally { await browser.close(); }
