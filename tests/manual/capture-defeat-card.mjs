// One-shot gallery capture for #164 "loss stings": boots the game, stages a real DEFEAT
// (your hull broken vs a hale foe → finish('lose') + defeatLedger), and screenshots the red
// "⚑ Colours Struck" card with the fame + coin loss NAMED. Writes studio/qa/gallery/<tag>.png.
// Usage: node tests/gallery-defeat-card.mjs studio/qa/gallery/<name>.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const out = process.argv[2] || path.join(ROOT, 'studio', 'qa', 'gallery', 'colours-struck-164.png');

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

  // A well-established pirate captain (Infamy-dominant → raiding loss dents Infamy) so the card shows
  // a real, meaty deduction. Set the ledger FIRST and let the once-ever "firstRank" beat fire + settle,
  // so it can't overwrite the defeat card we're capturing.
  await page.evaluate(async () => { window.__tidewake.qaSetLedger({ coins: 640, infamy: 900, standing: 120 }); });
  await new Promise((r) => setTimeout(r, 900)); // let the firstRank "your name travels" beat fire

  await page.evaluate(async () => {
    const tw = window.__tidewake;
    let bi = -1, bd = Infinity; const s = tw.state.pos;
    for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]); if (d < bd) { bd = d; bi = i; } }
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120); tw.step(0.05);
    tw.engageBattle();
    tw.battleForceDefeat();
    tw.battleFire(); // her reply sinks you → the red "Colours Struck" card fires last
  });
  await new Promise((r) => setTimeout(r, 500)); // let the defeat toast fade in
  await page.screenshot({ path: out });
  console.log('gallery frame written:', out);
} finally {
  await browser.close();
  server.close();
}
