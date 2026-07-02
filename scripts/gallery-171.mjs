// One-shot gallery capture for #171 "Buy a bigger ship" — a before/after scale comparison: the
// starting SLOOP beside the bought FRIGATE, framed identically, so you SEE the hull dwarf the one you
// started in. Writes studio/qa/gallery/buy-a-bigger-ship-171.png. Not a gate — a QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8801;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'buy-a-bigger-ship-171.png');

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
const FRAME = { dist: 34, height: 15, az: 0.9, look: 6 }; // identical wide framing for both shots
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  async function shipShot(frigate) {
    await page.evaluate((buy) => {
      const tw = window.__tidewake;
      tw.newVoyage();
      tw.qaSetLedger({ coins: 5000, infamy: 0, standing: 0 });
      if (buy) { tw.buyShipClass(); tw.buyShipClass(); } // sloop → brig → frigate
    }, frigate);
    // let a few frames settle so the rescale + a clean sea render
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__tidewake.step(1 / 60); });
    await new Promise((r) => setTimeout(r, 350));
    await page.evaluate((f) => window.__tidewake.qaFrameShip(f), FRAME);
    await new Promise((r) => setTimeout(r, 120));
    const b64 = await page.screenshot({ type: 'png', encoding: 'base64', clip: { x: 150, y: 120, width: 600, height: 660 } });
    return 'data:image/png;base64,' + b64;
  }

  const sloopImg = await shipShot(false);
  const frigateImg = await shipShot(true);

  // Compose the labeled before/after board in the same browser, then screenshot it.
  const compose = await browser.newPage();
  await compose.setViewport({ width: 1240, height: 760, deviceScaleFactor: 1 });
  await compose.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0b1622;font-family:'Trebuchet MS',system-ui,sans-serif}
    .wrap{display:flex;gap:14px;padding:16px}
    .col{flex:1;background:linear-gradient(180deg,#12283e,#0a1420);border:1px solid rgba(120,190,255,.28);border-radius:12px;overflow:hidden}
    .col img{display:block;width:100%;height:auto}
    .cap{padding:9px 12px;color:#bfe0ff;font-weight:800;font-size:19px;letter-spacing:.01em}
    .sub{padding:0 12px 11px;color:#a9c2dc;font-size:13px;font-style:italic}
    .title{color:#e9f2ff;font-weight:800;font-size:16px;padding:14px 16px 0}
  </style></head><body>
    <div class="title">⚓ #171 — Buy a bigger ship: the hull VISIBLY grows (same camera framing)</div>
    <div class="wrap">
      <div class="col"><img src="${sloopImg}"><div class="cap">The sloop you start in</div><div class="sub">4 guns · light timbers</div></div>
      <div class="col"><img src="${frigateImg}"><div class="cap">The frigate you buy → dwarfs her</div><div class="sub">heavier broadside · tougher hull · ~1.7× the size</div></div>
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
