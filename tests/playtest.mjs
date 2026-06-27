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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

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

  // 2e) Installable PWA (#63): the linked manifest actually resolves in the browser and
  // carries the install essentials, the iOS apple-touch icon loads, and the touch-control
  // cluster exists in the DOM (it's shown via body.touch on coarse-pointer devices). This
  // guards the "Add to Home Screen" promise without needing a real device.
  const pwa = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const href = link ? link.href : null;
    let manifest = null, manifestOk = false;
    if (href) {
      try { const r = await fetch(href); manifestOk = r.ok; manifest = await r.json(); } catch {}
    }
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    let appleOk = false;
    if (apple) { try { appleOk = (await fetch(apple.href)).ok; } catch {} }
    const tc = document.getElementById('touch-controls');
    return {
      manifestLinked: !!link,
      manifestOk,
      hasName: !!(manifest && manifest.name),
      standalone: !!(manifest && manifest.display === 'standalone'),
      icon512: !!(manifest && manifest.icons && manifest.icons.some((i) => i.sizes === '512x512')),
      appleOk,
      touchControls: { steer: !!tc?.querySelector('[data-hold="a"]'), throttle: !!tc?.querySelector('[data-hold="w"]'), fire: !!tc?.querySelector('[data-tap="g"]'), duel: !!tc?.querySelector('[data-tap="f"]') },
    };
  });
  if (!pwa.manifestLinked) fail('PWA: no <link rel="manifest"> in index.html');
  if (!pwa.manifestOk) fail('PWA: manifest did not load (200) in the browser');
  if (!pwa.hasName) fail('PWA: manifest missing a name');
  if (!pwa.standalone) fail('PWA: manifest display is not "standalone"');
  if (!pwa.icon512) fail('PWA: manifest has no 512x512 icon');
  if (!pwa.appleOk) fail('PWA: apple-touch-icon did not load (200)');
  for (const [verb, present] of Object.entries(pwa.touchControls)) {
    if (!present) fail(`touch controls: ${verb} button missing from #touch-controls`);
  }

  // 2f) Settings / options panel (#73): the panel opens, hosts the feature toggles, flipping a
  // toggle drives the wired behaviour, and a STORED toggle persists across a reload (defaults
  // keep the current look). Drives it through the QA hook (tw.options / tw.setOption / open).
  const settings = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const $panel = document.getElementById('settings-panel');
    const $perf = document.getElementById('perf');
    const before = { ...tw.options };
    // Open the panel and confirm it renders a row per toggle.
    tw.openSettings();
    const opened = {
      isOpen: tw.settingsOpen === true,
      visible: !!$panel && $panel.classList.contains('show'),
      rows: $panel ? $panel.querySelectorAll('.set-row').length : 0,
      hasSound: 'sound' in tw.options,
      hasPerf: 'perf' in tw.options,
    };
    // Flip the STORED perf toggle ON → the perf read-out should show; flip the LIVE sound toggle.
    tw.setOption('perf', true);
    const perfOn = { value: tw.options.perf === true, overlay: !!$perf && $perf.classList.contains('show') };
    tw.setOption('sound', false);
    const soundOff = tw.options.sound === false;
    tw.closeSettings();
    const closed = tw.settingsOpen === false && !!$panel && !$panel.classList.contains('show');
    return { before, opened, perfOn, soundOff, closed };
  });
  if (!settings.opened.isOpen) fail('settings: panel did not report open via tw.settingsOpen');
  if (!settings.opened.visible) fail('settings: #settings-panel did not become visible on open');
  if (!(settings.opened.rows >= 2)) fail(`settings: expected >=2 toggle rows, got ${settings.opened.rows}`);
  if (!settings.opened.hasSound) fail('settings: sound toggle missing from tw.options');
  if (!settings.opened.hasPerf) fail('settings: perf toggle missing from tw.options');
  if (!settings.perfOn.value) fail('settings: perf toggle did not flip to true');
  if (!settings.perfOn.overlay) fail('settings: perf overlay (#perf) did not show when toggled on');
  if (!settings.soundOff) fail('settings: sound toggle did not flip to false');
  if (!settings.closed) fail('settings: panel did not close on closeSettings()');

  // Reload: the STORED perf toggle must persist (localStorage), proving toggle state restores on
  // load. Then restore the defaults (perf off, sound on) so the gallery shot stays clean, and
  // open the panel so the screenshot artifact showcases it.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const settingsPersist = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const restored = tw.options.perf === true; // the flipped-on stored toggle survived the reload
    tw.setOption('perf', false);  // back to the hidden default for a clean shot
    tw.setOption('sound', true);  // unmute back to default
    tw.openSettings();            // showcase the panel in docs/playtest.png
    return { restored, perf: tw.options.perf, sound: tw.options.sound, open: tw.settingsOpen };
  });
  if (!settingsPersist.restored) fail('settings: stored perf toggle did not persist across reload');

  // 2g) Island collision (#76 a1): islands STOP you, arcade-soft. Start a clean voyage at the
  // origin, pick the nearest island, autopilot the ship straight at its centre at full throttle,
  // and assert it (1) actually reaches the coast and (2) is NEVER allowed deep inside the solid
  // footprint — the hull can no longer sail clean through land. Deterministic via tw.step().
  const collision = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    tw.newVoyage();          // respawn dead in the water at the origin
    tw.step(0.1);
    // Nearest island to the origin.
    let isle = null, bd = Infinity;
    for (const c of tw.islands) {
      const d = Math.hypot(c.x, c.z);
      if (d < bd) { bd = d; isle = c; }
    }
    if (!isle) return { hasIsland: false };
    tw.press('w');
    let minDist = Infinity;
    for (let i = 0; i < 2500; i++) {
      const s = tw.state;
      const desired = Math.atan2(isle.x - s.pos[0], isle.z - s.pos[2]); // aim at the island centre
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      const d = Math.hypot(tw.state.pos[0] - isle.x, tw.state.pos[2] - isle.z);
      if (d < minDist) minDist = d;
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    const finalDist = Math.hypot(tw.state.pos[0] - isle.x, tw.state.pos[2] - isle.z);
    tw.newVoyage();          // leave a clean slate for the screenshot
    tw.step(0.1);
    return { hasIsland: true, r: isle.r, minDist, finalDist };
  });
  if (!collision.hasIsland) fail('collision: no islands exposed via tw.islands');
  else {
    // (1) it sailed right up to the coast — otherwise the test proves nothing.
    if (!(collision.minDist <= collision.r + 25)) fail(`collision: ship never reached the coast (minDist=${collision.minDist.toFixed(1)}, r=${collision.r})`);
    // (2) it was NEVER allowed deep inside the island — no tunnelling/phasing through land.
    if (!(collision.minDist >= collision.r * 0.85)) fail(`collision: ship punched into the island (minDist=${collision.minDist.toFixed(1)} < ${(collision.r * 0.85).toFixed(1)})`);
    if (!(collision.finalDist >= collision.r * 0.85)) fail(`collision: ship ended up inside the island (finalDist=${collision.finalDist.toFixed(1)})`);
  }

  // 2h) Arcade slow-to-stop for harbour & combat (#76 c): the ship must EASE to a near-stop
  // instead of teleport-freezing. Two checks, both deterministic via tw.step():
  //   • HARBOUR — sail in under power, then ease off the helm and confirm the hull coasts down
  //     to a near-stop as it nears the berth (tw.state.settling flips true; speed drops hard).
  //   • FIGHT  — open fire on a nearby ship while still holding the throttle; the helm is
  //     ignored and the ship settles to a near-stop on its own, then control returns on the win.
  const settle = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

    // --- HARBOUR coast-in ---
    tw.newVoyage(); tw.step(0.1);
    function nearestPort() {
      const s = tw.state.pos;
      let best = null, bd = Infinity;
      for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - s[0], p.pos[1] - s[2]); if (d < bd) { bd = d; best = p; } }
      return { best, bd };
    }
    tw.press('w');
    let reached = false, speedApproaching = 0, minSpeed = Infinity, settlingSeen = false;
    for (let i = 0; i < 5000; i++) {
      const { best, bd } = nearestPort();
      if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      // Once we're nearly there, ease OFF the helm and let the berth assist coast us in.
      if (bd < 200 && !reached) { reached = true; speedApproaching = tw.state.speed; tw.release('w'); }
      if (reached) {
        if (tw.state.settling) settlingSeen = true;
        minSpeed = Math.min(minSpeed, tw.state.speed);
        if (tw.docked && tw.state.speed < 3) break;
      }
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    const harbour = { reached, docked: tw.docked, speedApproaching, minSpeed, settlingSeen, finalSpeed: tw.state.speed };

    // --- FIGHT square-up ---
    tw.newVoyage(); tw.step(0.1);
    function nearestNpc() {
      const s = tw.state.pos;
      let best = null, bd = Infinity;
      for (const n of tw.npcs) { const d = Math.hypot(n.pos[0] - s[0], n.pos[1] - s[2]); if (d < bd) { bd = d; best = n; } }
      return { best, bd };
    }
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 3000 && !engaged; i++) {
      const { best, bd } = nearestNpc();
      if (!best) break;
      // Only open fire while genuinely UNDER WAY (speed > 10), so the ease-to-a-stop has
      // something to bite on — an NPC can spawn within range of the origin, dead in the water.
      if (bd <= 150 && tw.state.speed > 10) { engaged = tw.openFire(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    const speedAtEngage = tw.state.speed;
    // Keep the throttle HELD — fighting must ignore it and ease the ship down anyway.
    let settlingDuringFight = false, fightMinSpeed = Infinity;
    if (engaged) {
      for (let i = 0; i < 80; i++) { tw.step(0.1); if (tw.state.settling) settlingDuringFight = true; fightMinSpeed = Math.min(fightMinSpeed, tw.state.speed); }
    }
    const settledSpeed = tw.state.speed;
    // End the fight (broadside-spam is a guaranteed win), then confirm control returns.
    for (let r = 0; r < 20 && tw.cannons.active; r++) tw.cannonFire(0);
    tw.release('w'); tw.release('a'); tw.release('d');
    const fight = { engaged, speedAtEngage, settlingDuringFight, fightMinSpeed, settledSpeed, fightEnded: !tw.cannons.active };

    tw.newVoyage(); tw.step(0.1); // clean slate for the screenshot
    return { harbour, fight };
  });
  // HARBOUR assertions: the hull reached & docked, the berth assist engaged, and it coasted down.
  if (!settle.harbour.reached) fail('slow-to-stop: ship never approached a port to coast in');
  if (!settle.harbour.docked) fail('slow-to-stop: ship never docked while coasting into the berth');
  if (!settle.harbour.settlingSeen) fail('slow-to-stop: the harbour settle flag never went true near the berth');
  if (!(settle.harbour.speedApproaching > 8)) fail(`slow-to-stop: ship was not moving on approach (speed=${settle.harbour.speedApproaching})`);
  if (!(settle.harbour.minSpeed < settle.harbour.speedApproaching * 0.5)) fail(`slow-to-stop: speed did not ease down coasting in (min=${settle.harbour.minSpeed?.toFixed(1)} vs approach=${settle.harbour.speedApproaching?.toFixed(1)})`);
  if (!(settle.harbour.finalSpeed < 5)) fail(`slow-to-stop: ship did not settle at the berth (finalSpeed=${settle.harbour.finalSpeed?.toFixed(1)})`);
  // FIGHT assertions: a fight forced a near-stop with the throttle still held, then control returned.
  if (settle.fight.engaged) {
    if (!settle.fight.settlingDuringFight) fail('slow-to-stop: settle flag never went true during the fight');
    if (!(settle.fight.settledSpeed < 3)) fail(`slow-to-stop: ship did not ease to a near-stop in the fight (settledSpeed=${settle.fight.settledSpeed?.toFixed(1)})`);
    if (!(settle.fight.settledSpeed < settle.fight.speedAtEngage)) fail(`slow-to-stop: fight did not slow the ship (engage=${settle.fight.speedAtEngage?.toFixed(1)} → settled=${settle.fight.settledSpeed?.toFixed(1)})`);
    if (!settle.fight.fightEnded) fail('slow-to-stop: fight did not resolve so control could return');
  }

  // 2i) Ship-vs-ship collision (#76 b): the player BUMPS other vessels, never sailing clean
  // through them. Pursue the nearest NPC at full throttle and assert (1) the hulls actually MET
  // (closest approach reached the combined boundary) and (2) the player was NEVER let deep inside
  // the other hull — arcade-soft bump, not phasing. Deterministic via tw.step(); a small drift
  // tolerance covers the NPC moving between the player's resolve and the snapshot read.
  const bump = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const bound = tw.collisionRadii.bound;
    tw.newVoyage(); tw.step(0.1);
    function nearestNpc() {
      const s = tw.state.pos;
      let best = null, bd = Infinity;
      for (const n of tw.npcs) { const d = Math.hypot(n.pos[0] - s[0], n.pos[1] - s[2]); if (d < bd) { bd = d; best = n; } }
      return { best, bd };
    }
    tw.press('w');
    let minDist = Infinity, contact = false;
    for (let i = 0; i < 4000; i++) {
      const { best, bd } = nearestNpc();
      if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]); // steer at the vessel
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      const { bd: nd } = nearestNpc();
      if (nd < minDist) minDist = nd;
      if (nd <= bound + 4) contact = true;
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    tw.newVoyage(); tw.step(0.1); // clean slate for the screenshot
    return { bound, minDist, contact };
  });
  if (!(bump.contact)) fail(`ship-vs-ship: the player never reached another vessel (minDist=${bump.minDist?.toFixed(1)}, bound=${bump.bound})`);
  // The hulls met but were NEVER allowed to interpenetrate beyond a small NPC-drift tolerance.
  if (!(bump.minDist >= bump.bound - 3)) fail(`ship-vs-ship: the player phased into another hull (minDist=${bump.minDist?.toFixed(1)} < ${bump.bound - 3})`);

  // 2j) Optional day-night cycle (#58): OFF by default (the sunny look). Flipping the toggle ON
  // and jumping the clock to golden hour must SHIFT the sun + sky/sea tint; flipping it OFF must
  // restore the sunny default EXACTLY (byte-for-byte haze). Driven via the QA hook.
  const daynight = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const offDefault = { ...tw.daynight };                 // the permanent sunny look (toggle OFF)
    const enabledOnFlip = tw.setOption('daynight', true).daynight === true;
    tw.setDayPhase(0.70);                                  // jump to golden afternoon
    tw.step(0.5);
    const golden = { ...tw.daynight };
    tw.setOption('daynight', false);                       // flip OFF
    tw.step(0.1);
    const restored = { ...tw.daynight };
    return { offDefault, enabledOnFlip, golden, restored };
  });
  if (!('enabled' in daynight.offDefault)) fail('day-night: QA surface (tw.daynight) missing');
  if (daynight.offDefault.enabled) fail('day-night: cycle should be OFF by default (sunny stays default)');
  if (!daynight.enabledOnFlip) fail('day-night: toggle did not register / flip on via tw.setOption');
  if (!daynight.golden.enabled) fail('day-night: cycle did not enable when toggled on');
  if (!(daynight.golden.haze !== daynight.offDefault.haze)) fail('day-night: sky/sea haze did not shift at golden hour');
  if (!(daynight.golden.sunIntensity !== daynight.offDefault.sunIntensity || daynight.golden.sun[1] !== daynight.offDefault.sun[1])) fail('day-night: the sun did not move at golden hour');
  if (daynight.restored.enabled) fail('day-night: cycle did not disable when toggled off');
  if (!(daynight.restored.haze === daynight.offDefault.haze)) fail(`day-night: OFF did not restore the sunny haze exactly (${daynight.restored.haze} != ${daynight.offDefault.haze})`);
  if (!(daynight.restored.sunIntensity === daynight.offDefault.sunIntensity)) fail('day-night: OFF did not restore the sunny sun intensity exactly');

  // 2k) Island names + landfall flavour (#19): every island carries a characterful name, and
  // the FIRST time you sail close to one, a one-time toast hails it by name with a comedic line.
  // Sail straight at the nearest isle and assert (1) it has a name, (2) the approach beat fired
  // (it joins tw.islandsIntroduced) BEFORE running aground, and (3) the shared toast shows that
  // name. Deterministic via tw.step().
  const landfall = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const $toast = document.getElementById('toast');
    tw.newVoyage(); tw.step(0.1);
    // every island is named + has flavour
    const allNamed = tw.islands.length > 0 && tw.islands.every((i) => i.name && i.name.length > 0);
    // nearest island to the origin
    let isle = null, bd = Infinity;
    for (const c of tw.islands) { const d = Math.hypot(c.x, c.z); if (d < bd) { bd = d; isle = c; } }
    if (!isle) return { hasIsland: false, allNamed };
    tw.press('w');
    let firedName = null, toastWhenFired = '';
    // Step a single sim sub-step at a time so we read the toast on the EXACT landfall frame —
    // islandNamer.update runs last in the frame, so its banner wins over any same-frame bump.
    for (let i = 0; i < 9000; i++) {
      const s = tw.state;
      const desired = Math.atan2(isle.x - s.pos[0], isle.z - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      const beforeCount = tw.islandsIntroduced.length;
      tw.step(1 / 60);
      if (tw.islandsIntroduced.length > beforeCount) {
        // an island was just introduced this frame — capture the toast immediately
        const t2 = $toast ? $toast.textContent : '';
        if (tw.islandsIntroduced.includes(isle.index)) {
          firedName = isle.name;
          toastWhenFired = t2;
          break; // captured at the moment of landfall, before any aground quip overwrites it
        }
      }
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    const nearest = tw.nearestIsland;
    tw.newVoyage(); tw.step(0.1); // clean slate for the screenshot
    return {
      hasIsland: true, allNamed, isleName: isle.name, isleIndex: isle.index,
      firedName, toastWhenFired, introduced: tw.islandsIntroduced,
      nearestHasName: !!(nearest && nearest.name),
    };
  });
  if (!landfall.allNamed) fail('island names: not every island carries a name via tw.islands');
  if (landfall.hasIsland) {
    if (landfall.firedName === null) fail(`island names: the landfall beat never fired sailing at "${landfall.isleName}"`);
    if (!landfall.toastWhenFired.includes(landfall.isleName)) fail(`island names: the toast did not show the island name (toast="${landfall.toastWhenFired}", name="${landfall.isleName}")`);
    if (!landfall.nearestHasName) fail('island names: tw.nearestIsland missing a name');
  }

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
  console.log(JSON.stringify({ ok: process.exitCode !== 1, ...result, budget: { BUDGET, ...budget }, duel, cannon, onboarding, persisted, pwa, settings, settingsPersist, collision, settle, bump, daynight, landfall, errors }, null, 2));
  if (process.exitCode !== 1) console.log('✓ PLAYTEST PASSED');
} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}
