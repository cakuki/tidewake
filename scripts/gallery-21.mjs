// One-shot gallery capture for #21 "cleaner persistent HUD" — the corner status read-out, grouped into
// two legible clusters (SAILING / CAPTAIN), shown on desktop AND phone-portrait so you SEE that a glance
// tells you who you are + what you have on either screen. Writes studio/qa/gallery/cleaner-status-hud-21.png.
// Not a gate — a QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8802;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'cleaner-status-hud-21.png');

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
  async function hudShot(w, h) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
    await page.evaluate(() => {
      const tw = window.__tidewake;
      // A rich RISE ledger so every read-out is non-trivially painted; a towering infamy earns the crown.
      tw.qaSetLedger({ coins: 12480, infamy: 5200, standing: 340 });
      for (let i = 0; i < 20; i++) tw.step(1 / 60); // let the ledger, needle + legend badge settle
    });
    await new Promise((r) => setTimeout(r, 250));
    const rect = await page.evaluate(() => {
      const el = document.getElementById('hud');
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left - 6), y: Math.max(0, r.top - 6), width: r.width + 12, height: r.height + 12 };
    });
    const b64 = await page.screenshot({ type: 'png', encoding: 'base64', clip: rect });
    await page.close();
    return 'data:image/png;base64,' + b64;
  }

  const desk = await hudShot(1280, 800);
  const phone = await hudShot(400, 860);

  const compose = await browser.newPage();
  await compose.setViewport({ width: 1120, height: 620, deviceScaleFactor: 1 });
  await compose.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0b1622;font-family:'Trebuchet MS',system-ui,sans-serif}
    .title{color:#e9f2ff;font-weight:800;font-size:17px;padding:16px 18px 2px}
    .subt{color:#9fbdd8;font-size:13px;font-style:italic;padding:0 18px 12px}
    .wrap{display:flex;gap:22px;padding:6px 18px 18px;align-items:flex-start}
    .col{background:linear-gradient(180deg,#12283e,#0a1420);border:1px solid rgba(120,190,255,.28);border-radius:12px;padding:16px}
    .col img{display:block;height:300px;width:auto;image-rendering:auto}
    .cap{margin-top:11px;color:#bfe0ff;font-weight:800;font-size:15px}
    .sub{color:#a9c2dc;font-size:12.5px;font-style:italic;margin-top:2px}
  </style></head><body>
    <div class="title">⚓ #21 — Cleaner persistent HUD: read your status at a glance</div>
    <div class="subt">Two legible clusters — SAILING (how you're moving) above, CAPTAIN (who you are · what you have) below — grouped, aligned, hairline-split.</div>
    <div class="wrap">
      <div class="col"><img src="${desk}"><div class="cap">Desktop</div><div class="sub">coins · rank/title · ⚔ Infamy ⚖ Standing · the reputation needle · the legend crown</div></div>
      <div class="col"><img src="${phone}"><div class="cap">Phone portrait</div><div class="sub">same clusters, fits the small screen — no overflow, still reads at a glance (#146)</div></div>
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
