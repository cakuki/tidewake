// One-shot gallery capture for #70 (post-RISE polish) — the NEW drifting-SPAR sea curio. Sailing the
// open sea between fights, a snapped ship's beam wallows past awash: the wreckage of the fights you've
// been winning, the sea now carrying the debris of your growing legend. A soft timber-groan cue plays
// and a wry line raises a smile. Deterministic, distance-culled, one reused low-poly mesh (≤1 draw).
// Writes studio/qa/gallery/drifting-spar-70.png. Not a gate — a QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8807;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'drifting-spar-70.png');

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
  await page.setViewport({ width: 1000, height: 760, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  // Warm up the swiftshader WebGL pipeline — the FIRST screenshot after boot can come back blank.
  await page.evaluate(() => { window.__tidewake._qaCam = { at: { x: 0, y: 6, z: 0 }, az: 0, dist: 90, height: 40 }; });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ type: 'png' }); // discarded
  await page.evaluate(() => { window.__tidewake._qaCam = null; });

  // Make way on the open sea, force the next curio to be the SPAR, and let it drift in ahead of the bow.
  const meta = await page.evaluate(() => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    tw.press('w');
    for (let i = 0; i < 40; i++) tw.step(0.1);   // build genuine sailing speed (spawns only under way)
    tw.qaCurioForce('spar');                       // pin the next kind + arm it now
    for (let i = 0; i < 4; i++) tw.step(0.1);      // drift the spar in + draw it
    const snap = tw.curios;
    tw.release('w');
    return { center: snap.center, type: snap.type, drawn: snap.drawn, active: snap.active, heading: tw.state.heading, line: snap.lastLine };
  });

  // Frame the spar low over the swell, three-quarters on, with open sea + horizon behind it.
  await page.evaluate((m) => {
    const tw = window.__tidewake;
    for (const el of Array.from(document.body.children)) { if (el.id !== 'app' && el.id !== 'juice-flash') el.style.display = 'none'; }
    document.body.classList.remove('town');
    tw._qaCam = { at: { x: m.center[0], y: 0.6, z: m.center[1] }, az: m.heading + 2.3, dist: 15, height: 4.4 };
  }, meta);
  await new Promise((r) => setTimeout(r, 600)); // let a few frames render the framed swell
  const b64 = await page.screenshot({ type: 'png', encoding: 'base64', clip: { x: 80, y: 60, width: 840, height: 620 } });
  await page.evaluate(() => { window.__tidewake._qaCam = null; });

  const compose = await browser.newPage();
  await compose.setViewport({ width: 900, height: 760, deviceScaleFactor: 1 });
  await compose.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0b1622;font-family:'Trebuchet MS',system-ui,sans-serif}
    .card{margin:0;background:linear-gradient(180deg,#132234,#0a1420);border:1px solid rgba(150,190,220,.30);border-radius:12px;overflow:hidden}
    .card img{display:block;width:100%;height:auto}
    .title{color:#eaf3fb;font-weight:800;font-size:16px;padding:14px 16px 2px}
    .cap{padding:8px 16px 2px;color:#cfe4f5;font-weight:800;font-size:19px}
    .sub{padding:0 16px 12px;color:#a9c4da;font-size:14px;font-style:italic}
  </style></head><body>
    <div class="title">🪵 #70 — a new sea curio: a drifting SPAR, the wreckage of the fights you've been winning</div>
    <div class="card"><img src="data:image/png;base64,${b64}">
      <div class="cap">Wreckage adrift — a soft timber-groan, a wry line, the world stays alive between fights</div>
      <div class="sub">"${meta.line || 'a broken beam wallows past awash'}"</div>
    </div>
  </body></html>`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await compose.screenshot({ path: OUT, type: 'png' });
  console.log('wrote', OUT, '· spar:', JSON.stringify(meta));
} finally {
  await browser.close();
  server.close();
}
