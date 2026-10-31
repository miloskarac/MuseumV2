// node scripts/check-economy.mjs <Playwright index.mjs> <Vite URL>
// Isolated temporary browser context; never opens Luka's browser profile.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SITE, ERYOPS_SITE } from '../src/content/journey.ts';
import { freshJourney, nearestDigCell } from '../src/game/journey.ts';
import { createGameSave, coinOutcome, soilKey } from '../src/game/economy.ts';
import { SAVE_KEY } from '../src/persistence/save.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const url = process.argv[3];
await context.addInitScript(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function ready() {
  await page.waitForFunction(() => document.querySelector('.session-blocker')?.hidden && document.querySelector('#coin-count')?.textContent !== '—');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0];
    window.qaTick = engine.activeRenderLoops[0]; engine.stopRenderLoop(); engine.getDeltaTime = () => 10;
    window.qaPosition = () => engine.scenes[0].getTransformNodeByName('player').position.asArray();
    delete document.hidden;
  });
  await page.bringToFront(); await page.locator('.stage > canvas').focus();
}
async function seed(state) {
  await page.evaluate(([key,value]) => localStorage.setItem(key,JSON.stringify(value)), [SAVE_KEY,state]);
  await page.reload(); await ready();
}
const ticks = count => page.evaluate(n => { for(let i=0;i<n;i++) window.qaTick(); }, count);
async function failWrites(fail = true) {
  await page.evaluate(fail => {
    window.qaSet ??= Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) { if(window.qaFail) throw new DOMException('QA quota','QuotaExceededError'); return window.qaSet.call(this,key,value); };
    window.qaFail = fail;
  }, fail);
}
try {
  await page.goto(url); await ready();
  assert.equal((await saved()).version, 13); assert.equal(await page.locator('#coin-count').innerText(), '20');
  const fresh = { ...freshJourney(), room: 'excavation' };
  const cell = nearestDigCell(fresh, SITE.interaction);
  let random = 0; while(!coinOutcome(random,soilKey(SITE,cell.id,0))) random++;
  const initial = createGameSave(fresh,random);
  await seed(initial); await ticks(72);
  assert.equal((await saved()).dig[cell.id],0.5); assert.equal((await saved()).economy.coins,20);
  const partial = await saved();
  await failWrites(); await ticks(100);
  assert.deepEqual(await saved(),partial); assert.equal(await page.locator('#coin-count').innerText(),'20');
  assert.equal(await page.locator('#coin-gain').innerText(),'');
  assert.equal(await page.locator('#retry-save').isVisible(),true);
  const stopped = await page.evaluate(() => window.qaPosition());
  await page.keyboard.down('KeyD'); await ticks(300); await page.keyboard.up('KeyD');
  assert.deepEqual(await page.evaluate(() => window.qaPosition()),stopped);
  assert.deepEqual(await saved(),partial);
  await page.screenshot({path:'docs/qa/economy-save-failure.png'});
  await failWrites(false); await page.locator('#retry-save').evaluate(button => {button.click();button.click();});
  const rewarded = await saved();
  assert.equal(rewarded.dig[cell.id],1); assert.equal(rewarded.economy.coins,21);
  assert.equal(rewarded.economy.sites[SITE.id].claimed.length,1);
  assert.equal(await page.locator('#coin-count').innerText(),'21');
  assert.equal(await page.locator('#coin-gain').innerText(),'+1');
  await ticks(1); await page.screenshot({path:'docs/qa/economy-reward.png'});
  await page.reload(); await ready(); assert.deepEqual(await saved(),rewarded);
  await page.locator('#bag-button').click(); await ticks(500); assert.deepEqual(await saved(),rewarded);
  await page.locator('#activity-close').click();
  await page.evaluate(() => Object.defineProperty(document,'hidden',{configurable:true,value:true}));
  await ticks(500); assert.deepEqual(await saved(),rewarded); await page.evaluate(() => {delete document.hidden;});

  // A failed final strike reloaded before retry restores both old soil and coins.
  await seed(partial); await failWrites(); await ticks(72);
  assert.deepEqual(await saved(),partial); await page.reload(); await ready(); assert.deepEqual(await saved(),partial);

  // Migration excludes cleared dirt and retains spatial cleaning/collection.
  const old = { ...fresh, dig:Object.fromEntries(SITE.cells.filter(c=>c.discoveryId).map(c=>[c.id,1])), collected:[...SITE.requiredDiscoveryIds] };
  await seed(old); const migrated=await saved(); assert.equal(migrated.economy.coins,20);
  assert.deepEqual(migrated.collected,old.collected);
  const m=migrated.economy.sites[SITE.id];
  const expected=20+Object.entries(m.outcomes).filter(([key])=>!m.excluded.includes(key)).reduce((sum,[,amount])=>sum+amount,0);
  await page.locator('[data-speed="10"]').click(); await ticks(30);
  const cleanupPartial=await saved(); await page.reload(); await ready();
  assert.deepEqual(await saved(),cleanupPartial);
  await page.locator('[data-speed="10"]').click(); await ticks(500);
  const closed=await saved(); assert.deepEqual(closed.closedSites,[SITE.id]); assert.equal(closed.economy.coins,expected);
  await ticks(100); assert.deepEqual(await saved(),closed);
  await page.reload(); await ready(); assert.deepEqual(await saved(),closed);
  await seed({...closed,room:'museum'});
  for(const [width,height] of [[1440,1000],[1280,720],[390,844]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(150); await ticks(1);
    const bounds=await page.locator('.coin-balance').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`docs/qa/economy-after-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  const beforeReset=await saved();
  await page.locator('#reset-button').click(); await page.locator('#activity-close').click(); assert.deepEqual(await saved(),beforeReset);
  await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
  assert.equal((await saved()).economy.coins,20); assert.deepEqual((await saved()).dig,{});
  const reset=await saved(); await page.reload(); await ready(); assert.deepEqual(await saved(),reset);

  // Second same-origin tab waits without loading/overwriting the first game's seed.
  const other=await context.newPage(); other.on('pageerror',e=>errors.push(e.message));
  await other.goto(url); await other.locator('.session-blocker').waitFor(); await other.waitForTimeout(300);
  assert.equal(await other.locator('#coin-count').innerText(),'—'); assert.deepEqual(await saved(),reset);
  await other.screenshot({path:'docs/qa/economy-second-tab.png'});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await other.waitForFunction(()=>document.querySelector('.session-blocker').hidden);
  assert.equal(await other.locator('#coin-count').innerText(),'20');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  assert.equal(await page.locator('.session-blocker').isVisible(),true);
  await other.close(); await page.waitForFunction(()=>document.querySelector('.session-blocker').hidden);
  // Reacquired sessions load the stored snapshot rather than resuming stale RAM.
  assert.deepEqual(await saved(),reset);
  const external=await context.newPage(); await external.goto(new URL('/index.html',url).href);
  await external.evaluate(key=>localStorage.setItem(key,'{external-change'),SAVE_KEY);
  await page.locator('.session-blocker').waitFor();
  assert.match(await page.locator('.session-blocker').innerText(),/променила/);
  await page.waitForTimeout(1200); assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),'{external-change');
  await external.close();

  const denied=await browser.newContext();
  await denied.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  const deniedPage=await denied.newPage(); await deniedPage.goto(url);
  await deniedPage.locator('.session-blocker').waitFor();
  assert.match(await deniedPage.locator('.session-blocker').innerText(),/прегледач/);
  assert.equal(await deniedPage.evaluate(key=>localStorage.getItem(key),SAVE_KEY),null);
  await denied.close();
  assert.deepEqual(errors,[]);
  console.log(`PASS: Edge ${browser.version()}; economy final hits, stable reload, failure/retry, paused inputs, cleanup/closure, migration/reset, responsive UI, two-tab ownership, page restoration, external conflict and unsupported-lock protection.`);
} finally { await browser.close(); }
