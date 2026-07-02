// One-shot gallery capture for #172 "The world fears you" — a before/after of THE RISE: a green captain
// in a sloop draws no fear (a merchant sloop sails calm alongside), but a feared Corsair in a frigate
// parts the sea — the same merchant sloop turns tail and RUNS. Same camera framing both shots, so you
// SEE that the notoriety + hull you banked changed the sea's manners. Writes
// studio/qa/gallery/world-fears-you-172.png. Not a gate — a QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8802;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'world-fears-you-172.png');

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
const FRAME = { dist: 62, height: 34, az: Math.PI, look: 4 }; // astern + lifted: the fleeing sloop reads ahead of the bow
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  async function shot(feared) {
    await page.evaluate((f) => {
      const tw = window.__tidewake;
      tw.newVoyage();
      tw.setColours('black');
      if (f) {
        tw.qaSetLedger({ coins: 0, infamy: 1500, standing: 0 }); // a feared Corsair
        tw.qaSetPlayerClass('frigate');                          // …in a big hull
      } else {
        tw.qaSetLedger({ coins: 0, infamy: 0, standing: 0 });    // a green nobody
        tw.qaSetPlayerClass('sloop');                            // …in the boat you start in
      }
      // Point the bow at +Z and drop a lone MERCHANT sloop just ahead off the starboard bow.
      tw.qaTeleport(0, 0);
      tw.qaSetNpcClass(0, 'sloop', 'merchant');
      tw.qaPlaceShip(0, 55, 240);
      for (let i = 0; i < 60; i++) tw.step(1 / 60); // a beat: under dread she turns and runs; else she sails calm
    }, feared);
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate((fr) => window.__tidewake.qaFrameShip(fr), FRAME);
    await new Promise((r) => setTimeout(r, 150));
    const b64 = await page.screenshot({ type: 'png', encoding: 'base64', clip: { x: 130, y: 120, width: 640, height: 660 } });
    return 'data:image/png;base64,' + b64;
  }

  const calmImg = await shot(false);
  const fearedImg = await shot(true);

  const compose = await browser.newPage();
  await compose.setViewport({ width: 1300, height: 800, deviceScaleFactor: 1 });
  await compose.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0b1622;font-family:'Trebuchet MS',system-ui,sans-serif}
    .wrap{display:flex;gap:14px;padding:16px}
    .col{flex:1;background:linear-gradient(180deg,#12283e,#0a1420);border:1px solid rgba(120,190,255,.28);border-radius:12px;overflow:hidden}
    .col img{display:block;width:100%;height:auto}
    .cap{padding:9px 12px;color:#bfe0ff;font-weight:800;font-size:19px;letter-spacing:.01em}
    .sub{padding:0 12px 11px;color:#a9c2dc;font-size:13px;font-style:italic}
    .title{color:#e9f2ff;font-weight:800;font-size:16px;padding:14px 16px 0}
  </style></head><body>
    <div class="title">🏴 #172 — The world fears you: your notoriety changes the sea's manners (same camera framing)</div>
    <div class="wrap">
      <div class="col"><img src="${calmImg}"><div class="cap">A green captain in a sloop</div><div class="sub">no name yet — the merchant sloop sails on, unbothered</div></div>
      <div class="col"><img src="${fearedImg}"><div class="cap">A feared Corsair in a frigate → she RUNS</div><div class="sub">notoriety + a bigger hull → the sloop hauls her wind and flees on sight</div></div>
    </div>
  </body></html>`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await compose.screenshot({ path: OUT, type: 'png' });
  console.log('wrote', OUT);
} finally {
  await browser.close();
  server.close();
}
