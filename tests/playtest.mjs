// Automated headless play-test. Gates every release: boots the game in a real
// (headless) browser, asserts it renders, sails, and logs no errors.
// Usage: node tests/playtest.mjs  [--keep-screenshot path.png]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BUDGET, checkBudget } from '../src/perf.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
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

const screenshotArg = process.argv.indexOf('--keep-screenshot');
const screenshotPath = screenshotArg !== -1 ? process.argv[screenshotArg + 1] : path.join(ROOT, 'docs', 'playtest.png');

function fail(msg) { console.error('✗ PLAYTEST FAILED:', msg); process.exitCode = 1; }

const server = await startServer();
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 1) game boots
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });

  // 2) it sails: throttle up and confirm speed climbs and position changes
  const result = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const start = tw.state;
    tw.press('w');
    tw.step(3);            // deterministic 3s of simulation, frame-rate independent
    const moving = tw.state;
    tw.release('w');
    // Minimap (#16): canvas exists, has a non-zero size, and is live — it just rendered
    // a stack of frames during the step (swiftshader can't read 2D pixels back, so we
    // assert liveness via the radar's own frame counter rather than getImageData).
    const mm = document.getElementById('minimap');
    const minimap = {
      exists: !!mm,
      w: mm ? mm.width : 0,
      h: mm ? mm.height : 0,
      frames: window.__minimapFrames || 0,
    };
    return {
      version: tw.version,
      fps: tw.fps,
      // Perf budget gate (#52): deterministic renderer counters, read after a stack of
      // frames has rendered. GPU-independent, so they're trustworthy under swiftshader.
      perf: tw.perf,
      startSpeed: start.speed,
      movingSpeed: moving.speed,
      distance: Math.hypot(moving.pos[0] - start.pos[0], moving.pos[2] - start.pos[2]),
      minimap,
    };
  });

  // 2b) Insult Broadside (#33/#48): sail to the nearest NPC, hail it, and out-jeer
  // it to a win — exercising the duel SFX path (challenge/cut/win stingers fire
  // silently headless but must not throw). Best-effort engage; the hard gate is the
  // zero-console-errors assertion below.
  const duel = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; // [x, y, z]
      let best = null, bd = Infinity;
      for (const n of tw.npcs) {           // n.pos = [x, z]
        const dx = n.pos[0] - s[0], dz = n.pos[1] - s[2];
        const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = n; }
      }
      return { best, bd };
    }
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { best, bd } = nearest();
      if (!best) break;
      if (bd <= 180) { engaged = tw.challenge(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    let rounds = 0, result = null;
    if (engaged) {
      for (let r = 0; r < 40 && tw.duel.active; r++) {
        const d = tw.duel;
        let idx = d.options.findIndex((o) => o.category === d.enemyWeakTo); // the cutting line
        if (idx < 0) idx = 0;
        tw.duelChoose(idx);
        rounds++;
        result = tw.duel.result;
      }
    }
    return { engaged, rounds, result };
  });
  if (duel.engaged && duel.result !== 'win') fail(`duel engaged but did not resolve to a win (result=${duel.result}, rounds=${duel.rounds})`);

  // 2b2) Cannon Broadside (#59): the OTHER way to settle a fight. Sail to the nearest
  // NPC, run out the guns (openFire), and spam full broadsides — the player holds the
  // initiative so a broadside-spam is a guaranteed win — driving the cannon resolution +
  // its SFX path (silent headless, must not throw). Hull bars + Infamy reward exercised.
  const cannon = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; // [x, y, z]
      let best = null, bd = Infinity;
      for (const n of tw.npcs) {           // n.pos = [x, z]
        const dx = n.pos[0] - s[0], dz = n.pos[1] - s[2];
        const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = n; }
      }
      return { best, bd };
    }
    const infamyBefore = tw.state.infamy;
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { best, bd } = nearest();
      if (!best) break;
      if (bd <= 180) { engaged = tw.openFire(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    let rounds = 0, result = null, hullSeen = null;
    if (engaged) {
      hullSeen = tw.cannons.playerHull; // bars are live
      for (let r = 0; r < 20 && tw.cannons.active; r++) {
        tw.cannonFire(0); // 0 == full broadside (the reliable-win aim)
        rounds++;
        result = tw.cannons.result;
      }
    }
    return { engaged, rounds, result, hullSeen, infamyGain: tw.state.infamy - infamyBefore };
  });
  if (cannon.engaged && cannon.result !== 'win') fail(`cannons engaged but did not resolve to a win (result=${cannon.result}, rounds=${cannon.rounds})`);
  if (cannon.engaged && !(cannon.infamyGain > 0)) fail(`cannon win did not award infamy (gain=${cannon.infamyGain})`);

  // 2c) Route-planning map (#54): open the big chart, confirm the overlay is visible,
  // the chart drew (liveness counter) and the open-state is exposed, then close it.
  const bigmap = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const overlay = document.getElementById('bigmap-overlay');
    const canvas = document.getElementById('bigmap');
    tw.mapToggle();                                   // open
    tw.step(0.5);                                     // let it draw a few frames
    const openState = {
      exposed: tw.bigmap.open === true,
      visible: !!overlay && overlay.classList.contains('show'),
      canvas: !!canvas && canvas.width > 0,
      frames: window.__bigmapFrames || 0,
    };
    tw.mapToggle();                                   // close
    tw.step(0.1);
    const closedHidden = !!overlay && !overlay.classList.contains('show') && tw.bigmap.open === false;
    return { ...openState, closedHidden };
  });
  if (!bigmap.exposed) fail('big map open-state not exposed (tw.bigmap.open)');
  if (!bigmap.visible) fail('big map overlay (#bigmap-overlay) did not become visible on toggle');
  if (!bigmap.canvas) fail('big map canvas (#bigmap) missing or zero size');
  if (!(bigmap.frames > 0)) fail('big map never rendered a frame while open');
  if (!bigmap.closedHidden) fail('big map did not hide on the second toggle');

  // 2d) Invisible onboarding (#60): a brand-new captain gets a seeded goal, then first-win
  // beats that fire ONCE EVER and persist. Start a clean voyage, assert the goal shows,
  // autopilot to the nearest port (first dock), do a trade (first coin), then reload and
  // confirm the flags persisted so a returning captain is never re-taught.
  const onboarding = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    tw.newVoyage();
    tw.step(0.1);
    const fresh = { goalVisible: tw.onboarding.goalVisible, flags: { ...tw.onboarding.flags } };

    // Sail to the nearest port and dock.
    function nearestPort() {
      const s = tw.state.pos; // [x, y, z]
      let best = null, bd = Infinity;
      for (const p of tw.ports) {            // p.pos = [x, z]
        const d = Math.hypot(p.pos[0] - s[0], p.pos[1] - s[2]);
        if (d < bd) { bd = d; best = p; }
      }
      return { best, bd };
    }
    tw.press('w');
    let docked = false;
    for (let i = 0; i < 4000 && !docked; i++) {
      const { best } = nearestPort();
      if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      docked = !!tw.docked;
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    const afterDock = { docked: tw.docked, firstDock: tw.onboarding.flags.firstDock, goalVisible: tw.onboarding.goalVisible };

    // Make a trade for coin: buy a unit then sell it back (any sale grows standing → first coin).
    let traded = false;
    if (tw.docked && tw.economy && tw.economy.market) {
      const good = tw.economy.market[0].id;
      tw.economy.buy(good, 1);
      const r = tw.economy.sell(good, 1);
      traded = !!(r && r.ok);
    }
    tw.step(0.2); // let the loop observe the standing bump and fire the beat
    const afterTrade = { traded, firstTrade: tw.onboarding.flags.firstTrade };

    tw.save();
    return { fresh, afterDock, afterTrade };
  });
  if (!onboarding.fresh.goalVisible) fail('onboarding: seeded goal not shown to a brand-new captain');
  if (onboarding.fresh.flags.firstDock || onboarding.fresh.flags.firstTrade) fail('onboarding: a fresh voyage should have no beats fired');
  if (!onboarding.afterDock.docked) fail('onboarding: ship never reached a port to dock');
  if (!onboarding.afterDock.firstDock) fail('onboarding: first-dock beat did not fire on first port');
  if (onboarding.afterDock.goalVisible) fail('onboarding: seeded goal should clear after the first dock');
  if (!onboarding.afterTrade.traded) fail('onboarding: trade did not complete');
  if (!onboarding.afterTrade.firstTrade) fail('onboarding: first-trade beat did not fire after earning coin');

  // Reload: the flags must persist so a returning captain is never re-taught or re-applauded.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const persisted = await page.evaluate(() => {
    const tw = window.__tidewake;
    return { flags: { ...tw.onboarding.flags }, goalVisible: tw.onboarding.goalVisible };
  });
  if (!persisted.flags.firstDock || !persisted.flags.firstTrade) fail(`onboarding: beats did not persist across reload (${JSON.stringify(persisted.flags)})`);
  if (persisted.goalVisible) fail('onboarding: a returning captain should not see the seeded goal');

  // 3) screenshot artifact
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath });

  // assertions
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  if (!(result.movingSpeed > 1)) fail(`ship did not accelerate (speed=${result.movingSpeed})`);
  if (!(result.distance > 5)) fail(`ship did not move (distance=${result.distance})`);
  if (!result.minimap.exists) fail('minimap canvas (#minimap) missing');
  if (!(result.minimap.w > 0 && result.minimap.h > 0)) fail(`minimap has zero size (${result.minimap.w}x${result.minimap.h})`);
  if (!(result.minimap.frames > 0)) fail('minimap never rendered a frame');

  // Perf budget gate (#52): assert the deterministic scene cost stays within the documented
  // ceilings (src/perf.js). These counters are GPU-independent, so this is a reliable CI gate
  // — a future change that blows up draw calls / triangles fails here before it ships. We do
  // NOT gate on fps (swiftshader is far too slow for a meaningful floor); see result.perf.fps.
  const perf = result.perf || {};
  const budget = checkBudget(perf, BUDGET);
  if (!(perf.drawCalls > 0)) fail(`perf counters unpopulated (drawCalls=${perf.drawCalls}); cannot gate budget`);
  for (const v of budget.violations) fail(`perf budget exceeded: ${v.metric}=${v.value} > ${v.ceiling}`);

  console.log(`perf: ${perf.drawCalls}/${BUDGET.drawCalls} draw calls · ${perf.triangles}/${BUDGET.triangles} triangles · ${perf.fps} fps (headless)`);
  console.log(JSON.stringify({ ok: process.exitCode !== 1, ...result, budget: { BUDGET, ...budget }, duel, cannon, onboarding, persisted, errors }, null, 2));
  if (process.exitCode !== 1) console.log('✓ PLAYTEST PASSED');
} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}
