// One-shot gallery capture for #173 "The bounty board" — the "one more voyage" hook of THE RISE. Sail
// into a port, and a quayside board posts a NAMED wanted vessel with a tier-scaled purse: read it →
// accept it → it becomes a marked hunt whose purse funds your next upgrade. Two framed shots of the
// live town panel: the POSTED bounty (take it), and the accepted "on the hunt" state. Writes
// studio/qa/gallery/bounty-board-173.png. Not a gate — a QA/owner visual.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8803;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const OUT = path.join(ROOT, 'studio', 'qa', 'gallery', 'bounty-board-173.png');

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
  await page.setViewport({ width: 900, height: 950, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  // Sail into the nearest port until landfall opens the town (the board lives on the quayside).
  await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage();
    function nearestPort() {
      const s = tw.state.pos; let best = null, bd = Infinity; // s is [x,y,z]
      for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - s[0], p.pos[1] - s[2]); if (d < bd) { bd = d; best = p; } }
      return best;
    }
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    tw.press('w');
    let entered = false;
    for (let i = 0; i < 6000 && !entered; i++) {
      const best = nearestPort(); if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      entered = tw.mode === 'town';
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    for (let i = 0; i < 30 && !(tw.mode === 'town' && tw.town.open); i++) tw.step(0.1);
  });
  await new Promise((r) => setTimeout(r, 400)); // let the town panel paint

  // Read the posted bounty for the caption, then shot the board as posted.
  const posted = await page.evaluate(() => window.__tidewake.bountyBoard);
  async function shotBounty() {
    const el = await page.$('#town .town-bounty');
    if (!el) return null;
    const b64 = await el.screenshot({ type: 'png', encoding: 'base64' });
    return 'data:image/png;base64,' + b64;
  }
  const postedImg = await shotBounty();

  // Accept it → the board flips to "on the hunt" (a marked chase whose purse funds the next upgrade).
  await page.evaluate(() => window.__tidewake.acceptBounty());
  await new Promise((r) => setTimeout(r, 350)); // let the panel repaint on the next frame
  const huntingImg = await shotBounty();

  const name = posted ? posted.name : 'a wanted vessel';
  const purse = posted ? posted.reward.coins : 0;

  const compose = await browser.newPage();
  await compose.setViewport({ width: 1180, height: 560, deviceScaleFactor: 1 });
  await compose.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#0b1622;font-family:'Trebuchet MS',system-ui,sans-serif}
    .wrap{display:flex;gap:14px;padding:16px;align-items:flex-start}
    .col{flex:1;background:linear-gradient(180deg,#241a10,#140d06);border:1px solid rgba(210,90,70,.38);border-radius:12px;overflow:hidden}
    .col img{display:block;width:100%;height:auto}
    .cap{padding:9px 12px;color:#ffb59a;font-weight:800;font-size:18px}
    .sub{padding:0 12px 11px;color:#d8c1a0;font-size:13px;font-style:italic}
    .title{color:#ffe0cc;font-weight:800;font-size:16px;padding:14px 16px 0}
  </style></head><body>
    <div class="title">⚑ #173 — The bounty board: a named target + scaled reward (the "one more voyage" hook)</div>
    <div class="wrap">
      <div class="col"><img src="${postedImg}"><div class="cap">Wanted: ${name} — ${purse} coin</div><div class="sub">a quayside notice posts a named vessel and a tier-scaled purse</div></div>
      <div class="col"><img src="${huntingImg}"><div class="cap">Take the bounty → on the hunt</div><div class="sub">she becomes a marked chase; run her down and the purse funds your next cannon</div></div>
    </div>
  </body></html>`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 200));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await compose.screenshot({ path: OUT, type: 'png' });
  console.log('wrote', OUT, '· posted:', name, purse + 'c');
} finally {
  await browser.close();
  server.close();
}
