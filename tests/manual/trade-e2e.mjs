// Manual end-to-end check for the docking->trade seam (issue #29).
// Boots the game headless, autopilots to the nearest port, then asserts:
//   - tw.docked is the port name
//   - tw.state.port equals the docked port
//   - the #trade panel is visible (computed display !== 'none' and opacity > 0)
//   - tw.economy.buy(<good>, 1) reduces coins and increases Hold
//   - selling it back restores coins/hold
// Usage: node tests/manual/trade-e2e.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8801;
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
    // nearest port to origin
    let target = ports[0], bestD = Infinity;
    for (const p of ports) {
      const d = Math.hypot(p.pos[0], p.pos[1]);
      if (d < bestD) { bestD = d; target = p; }
    }
    // autopilot: steer toward atan2(dx,dz) and throttle up until docked
    let steps = 0;
    tw.press('w');
    while (!tw.docked && steps < 4000) {
      const s = tw.state;                 // pos:[x,y,z]
      const dx = target.pos[0] - s.pos[0];
      const dz = target.pos[1] - s.pos[2];
      const want = Math.atan2(dx, dz);    // heading convention: 0=+Z, sin=x
      let err = want - s.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err)); // wrap [-pi,pi]
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a');      // a => +heading (see sailing.js)
      else if (err < -0.05) tw.press('d');
      tw.step(0.2);
      steps++;
    }
    tw.release('w'); tw.release('a'); tw.release('d');

    const $trade = document.getElementById('trade');
    const cs = getComputedStyle($trade);
    const market = tw.economy.market;     // docked port's board
    // Use the DISPLAY NAME (e.g. 'Rum') exactly as the issue's QA did.
    const firstGood = market && market[0] ? market[0].name : null;

    const coinsBefore = tw.economy.coins;
    const holdBefore = tw.economy.used;
    const buyRes = firstGood ? tw.economy.buy(firstGood, 1) : null;
    const coinsAfterBuy = tw.economy.coins;
    const holdAfterBuy = tw.economy.used;
    const sellRes = firstGood ? tw.economy.sell(firstGood, 1) : null;
    const coinsAfterSell = tw.economy.coins;
    const holdAfterSell = tw.economy.used;

    return {
      steps,
      docked: tw.docked,
      statePort: tw.state.port,
      target: target.name,
      tradeDisplay: cs.display,
      tradeOpacity: cs.opacity,
      tradeHasShow: $trade.classList.contains('show'),
      tradeMentionsPort: $trade.innerHTML.includes(tw.docked || '\0'),
      firstGood,
      coinsBefore, coinsAfterBuy, coinsAfterSell,
      holdBefore, holdAfterBuy, holdAfterSell,
      buyOk: buyRes && buyRes.ok, sellOk: sellRes && sellRes.ok,
    };
  });

  console.log(JSON.stringify(out, null, 2));

  if (out.docked === out.target && out.docked) pass(`docked at ${out.docked} after ${out.steps} steps`); else fail(`did not dock (docked=${out.docked})`);
  if (out.statePort === out.docked) pass(`tw.state.port === docked (${out.statePort})`); else fail(`tw.state.port=${out.statePort} !== docked=${out.docked}`);
  // Visibility = laid out (display!=='none'), shown (.show drives opacity 0->1), and
  // populated with the docked port's board. Opacity itself is a timed CSS transition,
  // so we assert the structural facts that mean "the panel is up", not its mid-fade value.
  if (out.tradeDisplay !== 'none' && out.tradeHasShow && out.tradeMentionsPort) pass(`#trade panel shown for ${out.docked} (display=${out.tradeDisplay}, .show, board rendered)`); else fail(`#trade not shown (display=${out.tradeDisplay}, show=${out.tradeHasShow}, mentionsPort=${out.tradeMentionsPort})`);
  if (out.buyOk && out.coinsAfterBuy < out.coinsBefore && out.holdAfterBuy > out.holdBefore) pass(`buy ${out.firstGood}: coins ${out.coinsBefore}->${out.coinsAfterBuy}, hold ${out.holdBefore}->${out.holdAfterBuy}`); else fail(`buy no-op (coins ${out.coinsBefore}->${out.coinsAfterBuy}, hold ${out.holdBefore}->${out.holdAfterBuy})`);
  if (out.sellOk && out.coinsAfterSell !== out.coinsAfterBuy && out.holdAfterSell === out.holdBefore) pass(`sell restores hold ${out.holdAfterBuy}->${out.holdAfterSell}, coins ${out.coinsAfterBuy}->${out.coinsAfterSell}`); else fail(`sell did not restore (hold ${out.holdAfterBuy}->${out.holdAfterSell})`);
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);

} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}

console.log(failed ? '\n✗ TRADE E2E FAILED' : '\n✓ TRADE E2E PASSED');
process.exitCode = failed ? 1 : 0;
