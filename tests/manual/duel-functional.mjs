// Functional QA for Insult Broadside (#33): boot the real game headless, sail up to
// an NPC, hail it, win the duel via the exposed API, and assert a reward landed and
// the duel cleanly ended. Run: node tests/manual/duel-functional.mjs
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
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

let failed = false;
const ok = (c, m) => { if (!c) { failed = true; console.error('  ✗', m); } else console.log('  ✓', m); };

const server = await startServer();
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  const res = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage();
    // Teleport-by-sailing: aim the bow at the nearest NPC and sail in until we're in
    // hail range. We can't set pos directly, so steer + throttle through tw.step.
    function nearest() {
      const s = tw.state.pos; const ns = tw.npcs;
      let best = null, bd = Infinity;
      for (const n of ns) { const d = Math.hypot(n.pos[0] - s[0], n.pos[1] - s[2]); if (d < bd) { bd = d; best = { n, d }; } }
      return best;
    }
    let approached = 0;
    for (let i = 0; i < 400; i++) {
      const tgt = nearest();
      if (tgt.d <= 180) { approached = tgt.d; break; }
      // desired heading toward target: atan2(dx, dz)
      const s = tw.state.pos;
      const want = Math.atan2(tgt.n.pos[0] - s[0], tgt.n.pos[1] - s[2]);
      let diff = want - tw.state.heading;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      tw.release('a'); tw.release('d');
      // sailing.js: heading += (a?1:0) - (d?1:0); so 'a' increases heading.
      if (diff > 0.05) tw.press('a'); else if (diff < -0.05) tw.press('d');
      tw.press('w');
      tw.step(0.5);
    }
    tw.release('w'); tw.release('a'); tw.release('d');

    const challenged = tw.challenge();
    const startCoins = tw.state.coins ?? 0, startRenown = tw.state.renown ?? 0;
    const d0 = tw.duel;
    // Win by always picking the option matching the (QA-exposed) enemy weakness.
    let guard = 0;
    while (tw.duel.active && guard++ < 60) {
      const d = tw.duel;
      let pick = d.options.findIndex((o) => o.category === d.enemyWeakTo);
      if (pick < 0) pick = 0;
      tw.duelChoose(pick);
    }
    const after = tw.duel;
    return {
      approached, challenged,
      duelStartedActive: d0.active,
      enemyMoraleStart: d0.enemyMorale,
      result: after.result,
      endedActive: after.active,
      coinsGained: (tw.state.coins ?? 0) - startCoins,
      renownGained: (tw.state.renown ?? 0) - startRenown,
    };
  });

  console.log(JSON.stringify(res, null, 2));
  ok(res.challenged === true, 'challenge() opened a duel after sailing into range');
  ok(res.duelStartedActive === true, 'tw.duel.active was true at the start of the duel');
  ok(res.result === 'win', 'player won the duel by playing the enemy weakness');
  ok(res.endedActive === false, 'duel cleanly ended (back to sailing)');
  ok(res.coinsGained > 0, `coins reward applied (+${res.coinsGained})`);
  ok(res.renownGained > 0, `renown reward applied (+${res.renownGained})`);
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join('; ') : ''}`);
} catch (e) {
  failed = true; console.error('✗ EXCEPTION', e.message || e);
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? '✗ DUEL FUNCTIONAL CHECK FAILED' : '✓ DUEL FUNCTIONAL CHECK PASSED');
process.exitCode = failed ? 1 : 0;
