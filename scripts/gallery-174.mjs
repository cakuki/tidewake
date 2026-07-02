// One-shot gallery capture for #174 "Governor-pole symmetry" — the FINALE of THE RISE. The pirate road
// grows your SHIP; the governor road grows your PORT. Same home port, same camera: a humble CLAIMED BERTH
// (tier 1 — one warehouse, one boat) beside a THRIVING JEWEL OF THE LANES (tier 4 — warehouses crowd the
// shore, boats + masts crowd the quay), after you pour your takings into it. You spend, the world visibly
// levels up. Writes studio/qa/gallery/port-growth-174.png. Not a gate — a QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8804;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'port-growth-174.png');

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
  await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  // Claim the nearest port as home, invest it up to `targetLevel`, then frame the port from seaward with the
  // town DOM hidden so the 3D quay reads clean. Same camera both shots so the growth is unmistakable.
  async function shot(targetLevel) {
    const meta = await page.evaluate(async (target) => {
      const tw = window.__tidewake;
      tw.newVoyage(); tw.step(0.1);
      // Drop onto the nearest port → landfall into TOWN (state.port set, so claim/invest work).
      let best = null, bd = Infinity;
      for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - tw.state.pos[0], p.pos[1] - tw.state.pos[2]); if (d < bd) { bd = d; best = p; } }
      tw.qaTeleport(best.pos[0], best.pos[1]);
      for (let i = 0; i < 120 && !tw.town.open; i++) tw.step(0.1);
      // Standing over the claim gate (40) but under the governorship gate (400) so the tier-4 shot shows
      // the GROWN PORT itself, not the "A Governor is Named" crown overlay.
      tw.qaSetLedger({ coins: 20000, infamy: 0, standing: 80 });
      tw.claimHarbour();                                   // tier 1 — the claimed berth
      let guard = 0;
      while (tw.portGrowth.level < target && tw.harbourCanInvest.ok && guard++ < 10) tw.investHarbour();
      const place = (tw.portPlacements || []).find((p) => p.name === best.name) || { x: best.pos[0], z: best.pos[1], angle: 0 };
      return { name: best.name, x: place.x, z: place.z, angle: place.angle, level: tw.portGrowth.level, shown: tw.portGrowth.shown };
    }, targetLevel);
    // Hide the town DOM overlay + at-sea UI so only the 3D quay shows, and frame the port from seaward.
    await page.evaluate((m) => {
      const tw = window.__tidewake;
      // Hide EVERY UI overlay (town panel, market, HUD, the governorship crown in #legend, toasts…) so
      // only the 3D quay shows — the canvas lives in #app; every other body child is UI.
      for (const el of Array.from(document.body.children)) { if (el.id !== 'app' && el.id !== 'juice-flash') el.style.display = 'none'; }
      document.body.classList.remove('town');
      // Camera on the seaward side (az = jetty bearing) looking landward at the port — the growth cluster fills the frame.
      tw._qaCam = { at: { x: m.x, y: 6, z: m.z }, az: m.angle, dist: 108, height: 46 };
    }, meta);
    await new Promise((r) => setTimeout(r, 500)); // let a few frames render the framed quay
    const b64 = await page.screenshot({ type: 'png', encoding: 'base64', clip: { x: 90, y: 110, width: 720, height: 660 } });
    await page.evaluate(() => { window.__tidewake._qaCam = null; });
    return { img: 'data:image/png;base64,' + b64, meta };
  }

  // Warm up the swiftshader WebGL pipeline — the FIRST screenshot after boot can come back blank.
  await page.evaluate(() => { window.__tidewake._qaCam = { at: { x: 0, y: 6, z: 0 }, az: 0, dist: 100, height: 40 }; });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ type: 'png' }); // discarded
  await page.evaluate(() => { window.__tidewake._qaCam = null; });

  const humble = await shot(1);   // Claimed berth (tier 1)
  const grown = await shot(4);    // Jewel of the lanes (tier 4)

  const h = humble.meta, g = grown.meta;
  const compose = await browser.newPage();
  await compose.setViewport({ width: 1320, height: 800, deviceScaleFactor: 1 });
  await compose.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0b1622;font-family:'Trebuchet MS',system-ui,sans-serif}
    .wrap{display:flex;gap:14px;padding:16px}
    .col{flex:1;background:linear-gradient(180deg,#1d2a1a,#0c1409);border:1px solid rgba(150,210,120,.30);border-radius:12px;overflow:hidden}
    .col img{display:block;width:100%;height:auto}
    .cap{padding:9px 12px;color:#d8f0b8;font-weight:800;font-size:19px}
    .sub{padding:0 12px 11px;color:#bcd3a4;font-size:13px;font-style:italic}
    .title{color:#eef7e2;font-weight:800;font-size:16px;padding:14px 16px 0}
  </style></head><body>
    <div class="title">⚖ #174 — Governor-pole symmetry: invest your spoils and your home port VISIBLY GROWS (same camera)</div>
    <div class="wrap">
      <div class="col"><img src="${humble.img}"><div class="cap">A claimed berth — ${h.name} (tier ${h.level})</div><div class="sub">${h.shown.building} warehouse · ${h.shown.boat} boat at anchor — where every governor begins</div></div>
      <div class="col"><img src="${grown.img}"><div class="cap">A jewel of the lanes (tier ${g.level})</div><div class="sub">${g.shown.building} warehouses · ${g.shown.boat} boats &amp; masts crowd the quay — spoils poured in, the port levels up</div></div>
    </div>
  </body></html>`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await compose.screenshot({ path: OUT, type: 'png' });
  console.log('wrote', OUT, '· humble:', h.name, `tier ${h.level}`, JSON.stringify(h.shown), '· grown: tier', g.level, JSON.stringify(g.shown));
} finally {
  await browser.close();
  server.close();
}
