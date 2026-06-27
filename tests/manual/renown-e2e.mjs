// Manual end-to-end check for the Captain's Ledger (issue #39).
// Boots the game headless, autopilots to the nearest port, then asserts:
//   - a profitable sale raises tw.state.renown
//   - the HUD ledger (#renown / #rank) reflects the climb
//   - renown survives a page reload (save v3 persistence)
// Usage: node tests/manual/renown-e2e.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8802;
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

const server = await startServer();
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let failed = false;
const fail = (m) => { failed = true; console.error('  ✗', m); };
const pass = (m) => console.log('  ✓', m);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  const out = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage();
    const ports = tw.ports;            // [{ name, pos:[x,z] }]
    let target = ports[0], bestD = Infinity;
    for (const p of ports) {
      const d = Math.hypot(p.pos[0], p.pos[1]);
      if (d < bestD) { bestD = d; target = p; }
    }
    // autopilot toward the nearest port until docked
    let steps = 0;
    tw.press('w');
    while (!tw.docked && steps < 4000) {
      const s = tw.state;                 // pos:[x,y,z]
      const dx = target.pos[0] - s.pos[0];
      const dz = target.pos[1] - s.pos[2];
      const want = Math.atan2(dx, dz);
      let err = want - s.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a');
      else if (err < -0.05) tw.press('d');
      tw.step(0.2);
      steps++;
    }
    tw.release('w'); tw.release('a'); tw.release('d');

    const market = tw.economy.market;
    const firstGood = market && market[0] ? market[0].name : null;

    const renownBefore = tw.state.renown;
    const rankBefore = document.getElementById('rank').textContent;
    // Buy then sell the same good — the sale's proceeds write to the ledger.
    tw.economy.buy(firstGood, 1);
    tw.economy.sell(firstGood, 1);
    tw.step(0.1); // let the HUD repaint the ledger
    const renownAfter = tw.state.renown;
    const renownHud = Number(document.getElementById('renown').textContent);
    const rankAfter = document.getElementById('rank').textContent;

    tw.save(); // flush to localStorage before reload
    return { steps, docked: tw.docked, target: target.name, firstGood, renownBefore, renownAfter, renownHud, rankBefore, rankAfter };
  });

  // Reload the page; localStorage should restore the ledger.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const persisted = await page.evaluate(() => ({
    renown: window.__tidewake.state.renown,
    hud: Number(document.getElementById('renown').textContent),
  }));

  console.log(JSON.stringify({ ...out, persisted }, null, 2));

  if (out.docked === out.target && out.docked) pass(`docked at ${out.docked} after ${out.steps} steps`); else fail(`did not dock (docked=${out.docked})`);
  if (out.renownAfter > out.renownBefore) pass(`renown rose on sale: ${out.renownBefore} -> ${out.renownAfter}`); else fail(`renown did not rise (${out.renownBefore} -> ${out.renownAfter})`);
  if (out.renownHud === out.renownAfter) pass(`HUD ledger shows renown ${out.renownHud} (rank "${out.rankAfter}")`); else fail(`HUD renown=${out.renownHud} !== state ${out.renownAfter}`);
  if (persisted.renown === out.renownAfter && persisted.renown > 0) pass(`renown persisted across reload: ${persisted.renown}`); else fail(`renown not persisted (after=${out.renownAfter}, reloaded=${persisted.renown})`);
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);

} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}

console.log(failed ? '\n✗ RENOWN E2E FAILED' : '\n✓ RENOWN E2E PASSED');
process.exitCode = failed ? 1 : 0;
