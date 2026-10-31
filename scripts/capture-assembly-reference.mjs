import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
try {
  await page.goto(process.argv[3]);
  const info = await page.evaluate(async () => {
    document.body.replaceChildren();
    const video = document.createElement('video');
    video.src = '/docs/references/museum/fossil%20assembly.mp4';
    video.muted = true;
    document.body.append(video);
    await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
    window.referenceVideo = video;
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  });
  console.log(info);
  const times = process.argv[4] ? process.argv[4].split(',').map(Number) : Array.from({ length: 16 }, (_, i) => i * (info.duration - 0.2) / 15);
  await page.evaluate(async times => {
    const video = window.referenceVideo;
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = Math.ceil(times.length / 3) * 255;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [i, time] of times.entries()) {
      if (time !== video.currentTime) { video.currentTime = time; await new Promise(resolve => video.onseeked = resolve); }
      const x = i % 3 * 400, y = Math.floor(i / 3) * 255;
      ctx.drawImage(video, x, y + 25, 400, 225);
      ctx.fillStyle = '#000000'; ctx.font = '18px sans-serif'; ctx.fillText(`${time.toFixed(1)} s`, x + 8, y + 20);
    }
    video.remove(); document.body.append(canvas); document.body.style.margin = '0';
  }, times);
  await page.locator('canvas').screenshot({ path: 'docs/qa/assembly-reference-frames.png' });
} finally { await browser.close(); }
