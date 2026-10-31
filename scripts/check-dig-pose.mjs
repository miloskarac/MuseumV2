// Disposable Edge profile. Usage: node scripts/check-dig-pose.mjs <playwright index.mjs> <URL> [before|after]
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { freshJourney } from '../src/game/journey.ts';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const stage = process.argv[4] ?? 'after', errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.addInitScript(state => {
    localStorage.setItem('museum-for-luka-v2', JSON.stringify(state));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  }, { ...freshJourney(), room: 'excavation' });
  await page.goto(process.argv[3]);
  await page.locator('#room-name').waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch('/src/presentation/world.ts')).text();
    const { Engine } = await import(source.match(/import \{ Engine \} from "([^"]+)"/)[1]);
    const engine = Engine.Instances[0], scene = engine.scenes[0];
    engine.stopRenderLoop();
    const { buildDigAnimation } = await import('/src/presentation/dig-animation.ts');
    const { shapes } = await import('/src/presentation/shapes.ts');
    const { SITE } = await import('/src/content/journey.ts');
    const { freshJourney } = await import('/src/game/journey.ts');
    const player = scene.getTransformNodeByName('player'), body = scene.getTransformNodeByName('player-body');
    scene.getTransformNodeByName('dig-rig').dispose();
    const animate = buildDigAnimation(scene, shapes(scene, () => {}), player, body,
      scene.getTransformNodeByName('player-torso'), scene.meshes.filter(m => ['arm', 'hand'].includes(m.name)),
      Object.fromEntries(Object.entries({ wood: 'warm-oak', metal: 'shovel-steel', shirt: 'explorer-jacket', skin: 'skin', soil: 'loose-earth' })
        .map(([key, name]) => [key, scene.getMaterialByName(name)])));
    const cell = SITE.cells.find(c => c.row === 7 && c.column === 3);
    player.position.set(cell.x, 0.04, cell.z + 0.7); body.rotation.y = Math.PI;
    const state = { ...freshJourney(), room: 'excavation' };
    window.qaPose = phase => { animate({ cellId: cell.id, elapsed: phase }, state); scene.render(); };
    window.qaScene = scene;
    window.qaAnimate = animate;
    window.qaPose(0.4);
  });
  await page.screenshot({ path: `docs/qa/shovel-pose-${stage}-gameplay.png` });
  // Close camera keeps the gameplay viewing direction, making the grip readable.
  await page.evaluate(() => {
    const scene = window.qaScene, camera = scene.activeCamera;
    const target = scene.getTransformNodeByName('player').position.clone(); target.y += 0.8;
    camera.position.addInPlace(target.subtract(camera.getTarget())); camera.setTarget(target);
    camera.orthoTop = 1.8; camera.orthoBottom = -1.8; camera.orthoLeft = -2.592; camera.orthoRight = 2.592;
  });
  const images = [];
  for (const phase of [0, 0.2, 0.4, 0.6, 0.72, 0.88]) {
    await page.evaluate(phase => window.qaPose(phase), phase);
    images.push({ phase, src: `data:image/png;base64,${(await page.screenshot({ clip: { x: 420, y: 170, width: 600, height: 650 } })).toString('base64')}` });
  }
  if (stage !== 'before') {
    const failures = await page.evaluate(async () => {
      const { Vector3 } = await import('/node_modules/@babylonjs/core/Maths/math.vector.js');
      const scene = window.qaScene, player = scene.getTransformNodeByName('player');
      const torso = scene.getTransformNodeByName('player-torso'), shovel = scene.getTransformNodeByName('dig-shovel');
      const hands = scene.meshes.filter(m => m.name === 'dig-hand');
      const limbs = scene.meshes.filter(m => ['dig-upper-arm', 'dig-forearm'].includes(m.name));
      const failures = [];
      for (const soilY of [-0.81, -0.11, -0.04, 0.59, 0.66]) {
        window.qaAnimate(null);
        player.position.y = -soilY;
        for (let frame = 0; frame <= 100; frame++) {
          window.qaPose(frame / 100);
          const inverse = torso.computeWorldMatrix(true).clone().invert();
          const samples = hands.map(m => ({ p: m.getAbsolutePosition(), radius: 0.095 }));
          for (let i = 0; i <= 24; i++) samples.push({
            p: Vector3.TransformCoordinates(new Vector3(0, i / 24 * 1.16, 0), shovel.computeWorldMatrix(true)), radius: 0.04 });
          for (const { p, radius } of samples) {
            const local = Vector3.TransformCoordinates(p, inverse);
            const head = (local.x / (0.215 + radius)) ** 2 + ((local.y - 0.69) / (0.23 + radius)) ** 2 + (local.z / (0.215 + radius)) ** 2;
            const brim = Math.hypot(local.x, local.z) < 0.33 + radius && Math.abs(local.y - 0.89) < 0.0375 + radius;
            if (head < 1 || brim) failures.push({ soilY, frame, reason: 'head/hat intersection', local: local.asArray() });
          }
          if (limbs.some(m => Math.abs(m.scaling.y - 0.46) > 0.001)) failures.push({ soilY, frame, reason: 'arm stretched', lengths: limbs.map(m => m.scaling.y) });
        }
      }
      window.qaAnimate(null);
      if (scene.getTransformNodeByName('dig-rig').isEnabled() || torso.rotation.x !== 0
        || scene.meshes.filter(m => ['arm', 'hand'].includes(m.name)).some(m => !m.isEnabled())) failures.push({ reason: 'cancel did not restore idle' });
      return failures.slice(0, 12);
    });
    assert.deepEqual(failures, [], 'full swings across reachable soil heights keep hands/tool clear of head and arms within reach');
  }
  assert.deepEqual(errors, []);
  await page.setContent(`<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(3,400px)">${images.map(({ phase, src }) => `<div><div style="font:20px sans-serif">${phase.toFixed(2)} s</div><img width="400" src="${src}"></div>`).join('')}</body>`);
  await page.screenshot({ path: `docs/qa/shovel-pose-${stage}.png`, fullPage: true });
  console.log(`PASS: Edge ${browser.version()}, ${stage} poses and gameplay captured at 1440 x 1000.`);
} finally { await browser.close(); }
