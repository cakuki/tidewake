// One-shot gallery capture (#88): a moody squall at golden hour vs the clear default.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
await page.evaluate(async () => {
  const tw = window.__tidewake;
  tw.newVoyage(); tw.step(0.1);
  tw.press('up'); for (let i = 0; i < 40; i++) tw.step(0.1); tw.release('up'); // make some way for a wake
  tw.setOption('daynight', true); tw.setDayPhase(0.70);   // golden hour for drama
  tw.setOption('weather', true); tw.setWeatherPhase(0.50); // full squall
  for (let i = 0; i < 30; i++) tw.step(0.1);
});
await new Promise((r) => setTimeout(r, 800));
const out = path.join(ROOT, 'studio', 'qa', 'gallery', 'weather-squall-88.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log('wrote', out);
await browser.close(); server.close();
