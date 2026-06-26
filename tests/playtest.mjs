// Automated headless play-test. Gates every release: boots the game in a real
// (headless) browser, asserts it renders, sails, and logs no errors.
// Usage: node tests/playtest.mjs  [--keep-screenshot path.png]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

const screenshotArg = process.argv.indexOf('--keep-screenshot');
const screenshotPath = screenshotArg !== -1 ? process.argv[screenshotArg + 1] : path.join(ROOT, 'docs', 'playtest.png');

function fail(msg) { console.error('✗ PLAYTEST FAILED:', msg); process.exitCode = 1; }

const server = await startServer();
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 1) game boots
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  // 2) it sails: throttle up and confirm speed climbs and position changes
  const result = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const start = tw.state;
    tw.press('w');
    tw.step(3);            // deterministic 3s of simulation, frame-rate independent
    const moving = tw.state;
    tw.release('w');
    return {
      version: tw.version,
      fps: tw.fps,
      startSpeed: start.speed,
      movingSpeed: moving.speed,
      distance: Math.hypot(moving.pos[0] - start.pos[0], moving.pos[2] - start.pos[2]),
    };
  });

  // 3) screenshot artifact
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath });

  // assertions
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  if (!(result.movingSpeed > 1)) fail(`ship did not accelerate (speed=${result.movingSpeed})`);
  if (!(result.distance > 5)) fail(`ship did not move (distance=${result.distance})`);

  console.log(JSON.stringify({ ok: process.exitCode !== 1, ...result, errors }, null, 2));
  if (process.exitCode !== 1) console.log('✓ PLAYTEST PASSED');
} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}
