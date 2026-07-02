// One-shot gallery capture for the #170 "buy a cannon" beat (epic #168 "The Rise"). Boots the game
// headless, buys the full extra battery at the workshop (the cannons appear on the deck), frames the
// ship from an over-the-quarter angle, and screenshots the live frame to
// studio/qa/gallery/buy-a-cannon-170.png. Not a gate — a visual DoD artefact (the SEE payoff).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8802;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary' };
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
  await new Promise((r) => setTimeout(r, 2200)); // let the intro "casting off" landfall gesture finish so the deck renders
  const g = await page.evaluate(() => {
    const tw = window.__tidewake;
    tw.qaSetLedger({ coins: 5000, infamy: 0, standing: 0 });
    let last;
    do { last = tw.buyCannon(); } while (last.ok && tw.gunUpgrade.canBuy);
    tw.qaTopDown(26, 16); // over-the-quarter, above and astern — the deck + the newly-bolted bronze guns in frame
    tw.step(0.05);
    return tw.gunUpgrade;
  });
  await new Promise((r) => setTimeout(r, 400)); // let the toast fade settle (tw.step ≠ wall-clock)
  const out = path.join(ROOT, 'studio', 'qa', 'gallery', 'buy-a-cannon-170.png');
  await page.screenshot({ path: out });
  console.log('captured', out, JSON.stringify(g));
} finally {
  await browser.close();
  server.close();
}
