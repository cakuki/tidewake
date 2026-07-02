// One-shot gallery capture for the #169 rank-up milestone card. Boots the game headless, drives a
// forward rung crossing (infamy-led → "Corsair"), waits for the toast's CSS fade, and screenshots the
// live frame to studio/qa/gallery/rankup-milestone-169.png. Not a gate — a visual DoD artefact.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const card = await page.evaluate(() => {
    const tw = window.__tidewake;
    tw.qaSetLedger({ coins: 0, infamy: 0, standing: 0 });
    tw.qaResetRankBaseline();
    tw.step(0.05);
    tw.qaSetLedger({ infamy: 1001, standing: 0 }); // → rung 5, pirate: "Corsair"
    tw.step(0.05);
    return tw.rankUp;
  });
  await new Promise((r) => setTimeout(r, 700)); // let the toast's CSS fade settle (tw.step ≠ wall-clock)
  const out = path.join(ROOT, 'studio', 'qa', 'gallery', 'rankup-milestone-169.png');
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(card));
} finally {
  await browser.close();
  server.close();
}
