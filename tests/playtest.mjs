// Automated headless play-test. Gates every release: boots the game in a real
// (headless) browser, asserts it renders, sails, and logs no errors.
// Usage: node tests/playtest.mjs  [--keep-screenshot path.png]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { BUDGET, checkBudget } from '../src/perf.js';
import { KEYS } from '../src/keymap.js'; // the keymap source-of-truth: the FTUE gate (#156) auto-covers every verb

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
    const wakeBecalmed = tw.wake;   // #150: the gentle lap before we make way
    const creakBecalmed = tw.creak; // #81: the idle timber settle before we make way
    tw.press('w');
    tw.press('d');         // #81: bring the helm over so the hard-turn driver bites too
    tw.step(3);            // deterministic 3s of simulation, frame-rate independent
    const moving = tw.state;
    const wakeMoving = tw.wake;     // #150: the wash should well up with speed
    const creakMoving = tw.creak;   // #81: the hull should creak faster under sail + a hard helm
    tw.release('w');
    tw.release('d');
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
    // Deterministically measure perf from a REAL synchronous frame (#107 flake fix), instead of
    // racing the headless-throttled rAF loop that left the counters at 0 intermittently.
    if (tw.qaRender) tw.qaRender();
    return {
      version: tw.version,
      fps: tw.fps,
      // Perf budget gate (#52): deterministic renderer counters, read after a stack of
      // frames has rendered. GPU-independent, so they're trustworthy under swiftshader.
      perf: tw.perf,
      startSpeed: start.speed,
      movingSpeed: moving.speed,
      distance: Math.hypot(moving.pos[0] - start.pos[0], moving.pos[2] - start.pos[2]),
      wakeBecalmed,
      wakeMoving,
      creakBecalmed,
      creakMoving,
      minimap,
    };
  });

  // 2a′) RIVAL-SAIL-SIGHTED sting (#116 follow-up): the world's "uh-oh, company" beat must ring ONCE
  // when a hostile (outlaw) sail first crosses the sighting horizon, driven purely from NPC state —
  // proving the WebAudio path is guarded (no AudioContext opens in this headless run). Teleport far
  // from the fleet to ARM the latch, then onto an outlaw to trip the sighting; assert the cue's NAME
  // latched (the QA surface records it regardless of the audio engine being up).
  const rival = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const outlaw = tw.npcs.find((n) => n.kind === 'pirate');
    if (!outlaw) return { skipped: true };
    tw.qaTeleport(50000, 50000); // far from the whole fleet → nearest hostile beyond the re-arm band
    tw.step(0.05);               // a frame to ARM the latch
    const armedCue = tw.loopCue; // should NOT be the rival sting yet (nothing sighted out here)
    const o = tw.npcs.find((n) => n.kind === 'pirate') || outlaw; // fresh pos after the step
    tw.qaTeleport(o.pos[0], o.pos[1]); // drop right onto the outlaw → well inside the sighting horizon
    tw.step(0.05);               // a frame to SIGHT it → ring once
    return { skipped: false, armedCue, sightedCue: tw.loopCue };
  });
  if (!rival.skipped) {
    if (rival.armedCue === 'rivalSail') fail('rival sting fired while ARMING far from any sail (false sighting)');
    if (rival.sightedCue !== 'rivalSail') fail(`rival sting did not ring on sighting a hostile sail (loopCue=${rival.sightedCue})`);
  }

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

  // 2b3) Battle Mode shell (#135): the DELIBERATE fight stance. Sail to the nearest NPC, ENGAGE
  // (squaring up flips the world to BATTLE mode before a shot is fired), confirm the world keeps
  // living underneath (NPCs still move during the stance), then FLEE and confirm the helm returns
  // to SAILING. Proves enter→stance→leave on the #95 mode infra with zero console errors.
  const battle = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; // [x, y, z]
      let best = null, bd = Infinity;
      for (const n of tw.npcs) {           // n.pos = [x, z]
        const d = Math.hypot(n.pos[0] - s[0], n.pos[1] - s[2]);
        if (d < bd) { bd = d; best = n; }
      }
      return { best, bd };
    }
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { best, bd } = nearest();
      if (!best) break;
      if (bd <= 150) { engaged = tw.engageBattle(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    tw.step(0.05);                           // let the mode system fold the stance into mode.current
    const enteredMode = tw.mode;             // should be 'battle' the instant we square up
    const activeOnEnter = tw.battle.active;
    // The world keeps living underneath the stance: an NPC should still move while we're paused.
    const npc0 = tw.npcs[0] ? [...tw.npcs[0].pos] : null;
    tw.step(1.0);
    const npc1 = tw.npcs[0] ? [...tw.npcs[0].pos] : null;
    const worldLived = npc0 && npc1 ? Math.hypot(npc1[0] - npc0[0], npc1[1] - npc0[1]) > 0 : true;
    const fled = engaged ? tw.fleeBattle() : false;   // FLEE is always available
    tw.step(0.2);
    return { engaged, enteredMode, activeOnEnter, worldLived, fled, leftMode: tw.mode, activeAfter: tw.battle.active };
  });
  if (battle.engaged) {
    if (battle.enteredMode !== 'battle') fail(`engaging battle did not enter BATTLE mode (mode=${battle.enteredMode})`);
    if (!battle.activeOnEnter) fail('battle.active was false right after engaging');
    if (!battle.worldLived) fail('the world froze during the battle stance (NPC did not move)');
    if (!battle.fled) fail('fleeing an active battle returned false');
    if (battle.leftMode !== 'sailing') fail(`fleeing battle did not return to SAILING (mode=${battle.leftMode})`);
    if (battle.activeAfter) fail('battle.active stayed true after fleeing');
  }

  // 2b4) Real-time broadside (#135 slice 2): re-engage, then STEER to bring the foe abeam and
  // fire the loaded guns in REAL TIME until she sinks. Proves the deliberate stance keeps the helm
  // LIVE (you can maneuver), the broadside arc + reload work on the sim clock, and a positioned
  // volley damages/sinks an NPC — the slice's "position + fire damages/sinks a ship" acceptance.
  const broadside = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos;
      let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return { bi, bd };
    }
    // Sail up to a foe and square up to her.
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { bi, bd } = nearest();
      if (bi === -1) break;
      if (bd <= 150) { engaged = tw.engageBattle(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(tw.npcs[bi].pos[0] - s.pos[0], tw.npcs[bi].pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w');
    if (!engaged) return { engaged };
    const helmLive = !tw.state.paused; // the deliberate stance must NOT pause the helm (slice 2)
    // Maneuver for a beam angle and fire in real time. Steer heading toward (bearing − 90°) so the
    // foe sits dead abeam to starboard; fire whenever loaded AND in the broadside arc.
    let shotsFired = 0, sawAbeam = false, hullDamaged = false, result = null;
    const startHull = tw.battle.enemyHull;
    for (let i = 0; i < 240 && tw.battle.active; i++) {
      const idx = tw.battle.foeIndex;
      const foe = tw.npcs[idx];
      if (foe) {
        const s = tw.state;
        const bearing = Math.atan2(foe.pos[0] - s.pos[0], foe.pos[1] - s.pos[2]);
        const desired = bearing - Math.PI / 2; // foe abeam to starboard
        const err = norm(desired - s.heading);
        tw.release('a'); tw.release('d');
        if (err > 0.04) tw.press('a'); else if (err < -0.04) tw.press('d');
      }
      const a = tw.battleAim();
      if (a.inArc) sawAbeam = true;
      if (tw.battle.loaded && a.inArc) { tw.battleFire(); shotsFired++; }
      tw.step(0.2);
      if (tw.battle.enemyHull < startHull) hullDamaged = true;
      result = tw.battle.result;
    }
    tw.release('a'); tw.release('d');
    return { engaged, helmLive, sawAbeam, shotsFired, hullDamaged, result, active: tw.battle.active };
  });
  if (broadside.engaged) {
    if (!broadside.helmLive) fail('real-time broadside: the helm stayed PAUSED in the deliberate battle stance — cannot maneuver (#135 slice 2)');
    if (!broadside.sawAbeam) fail('real-time broadside: never managed to bring the foe abeam (broadside arc) (#135 slice 2)');
    if (!(broadside.shotsFired > 0)) fail('real-time broadside: fired no volleys despite an abeam foe (#135 slice 2)');
    if (!broadside.hullDamaged) fail('real-time broadside: a positioned broadside dealt no hull damage to the foe (#135 slice 2)');
    if (broadside.active && broadside.result !== 'win') fail(`real-time broadside: engagement neither sank the foe nor resolved (result=${broadside.result}) (#135 slice 2)`);
  }

  // 2b5) Workshop loadouts + mid-combat shot cycle (#135 slice 3): FIT a shot at the town
  // workshop, then prove the ONE cycle key walks the fitted locker mid-fight and the LOADED shot
  // actually shapes the broadside — the slice's "load chain at port, cycle to it mid-fight, see the
  // effect" acceptance, driven headlessly off the QA hooks. Pure-logic safe: no DOM dependency.
  const ammoCycle = await page.evaluate(async () => {
    const tw = window.__tidewake;
    // The workshop (town-side): fit grape on top of the starter locker; round can never be unfit.
    const before = tw.loadout.slice();
    tw.fitAmmoType('grape');           // ensure grape is fitted
    if (!tw.loadout.includes('grape')) tw.fitAmmoType('grape'); // toggled off → fit it back on
    const fitted = tw.loadout.slice();
    const roundLocked = (() => { const a = tw.fitAmmoType('round'); return a.includes('round'); })();
    // Square up to the nearest sail (reuse the slice-2 approach).
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return { bi, bd };
    }
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { bi, bd } = nearest();
      if (bi === -1) break;
      if (bd <= 150) { engaged = tw.engageBattle(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(tw.npcs[bi].pos[0] - s.pos[0], tw.npcs[bi].pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w');
    if (!engaged) return { engaged };
    // The loaded shot on engage is the first fitted (round); cycle through the whole locker and
    // confirm it walks distinct fitted shots and wraps back round.
    const loadedOnEngage = tw.battle.ammo;
    const seen = [loadedOnEngage];
    for (let i = 0; i < tw.loadout.length; i++) seen.push(tw.battleCycleShot());
    const wrapped = seen[seen.length - 1] === loadedOnEngage;
    const distinctSeen = new Set(seen).size >= Math.min(2, tw.loadout.length);
    const ammoHasEffect = tw.battle.ammoProfile && typeof tw.battle.ammoProfile.hullMult === 'number';
    tw.fleeBattle();
    return { engaged, before, fitted, roundLocked, loadedOnEngage, seen, wrapped, distinctSeen, ammoHasEffect };
  });
  if (ammoCycle.engaged) {
    if (!ammoCycle.fitted.includes('grape')) fail('workshop: fitting grape did not add it to the loadout (#135 slice 3)');
    if (!ammoCycle.roundLocked) fail('workshop: round must always stay fitted (#135 slice 3)');
    if (ammoCycle.loadedOnEngage !== ammoCycle.fitted[0]) fail(`shot cycle: engage did not load the first fitted shot (got ${ammoCycle.loadedOnEngage}) (#135 slice 3)`);
    if (!ammoCycle.distinctSeen) fail(`shot cycle: the cycle key did not walk distinct fitted shots (saw ${ammoCycle.seen.join(',')}) (#135 slice 3)`);
    if (!ammoCycle.wrapped) fail(`shot cycle: cycling the full locker did not wrap back to the first shot (saw ${ammoCycle.seen.join(',')}) (#135 slice 3)`);
    if (!ammoCycle.ammoHasEffect) fail('shot cycle: the loaded shot carries no broadside-effect profile (#135 slice 3)');
  } else {
    console.warn('  (#135 slice 3 ammo-cycle: no foe came in range to engage — skipped, like slice 2)');
  }

  // 2b6) Boarding → crew brawl → verbal captain duel (#135 slice 4): once a foe is beaten to ≤30%
  // hull a "Board!" finisher lights — sending the crew over the rail for a comic brawl, then handing
  // off to the verbal captain's duel (#33, the climax). Winning the boarded duel is a CAPTURE (Standing).
  // Driven headlessly: engage, weaken her to the board window, board, then resolve the captain's duel.
  const boarding = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return { bi, bd };
    }
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { bi, bd } = nearest();
      if (bi === -1) break;
      if (bd <= 150) { engaged = tw.engageBattle(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(tw.npcs[bi].pos[0] - s.pos[0], tw.npcs[bi].pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w');
    if (!engaged) return { engaged };
    // Not boardable while she's at full hull.
    const boardableFresh = tw.battle.canBoard;
    // Beat her hull into the board window, then the Board! prompt should light.
    tw.battleWeaken();
    const boardableWeak = tw.battle.canBoard;
    const standingBefore = tw.state.standing;
    // BOARD: resolves the comic crew brawl, then hands off to the verbal captain's duel.
    const brawl = tw.boardBattle();
    const battleEndedOnBoard = !tw.battle.active;     // the broadside gives way to the boarding
    const duelOpened = tw.duel.active;                // the captain's verbal duel is the climax
    const duelIsBoarded = tw.duel.boarded;            // flagged a capture (Standing)
    // Crew casualties → duel confidence (#135, Option 4 slice 3): a boarding that cost you crew opens
    // the duel with YOUR captain shaken too. Read the opening footing BEFORE trading a single jab.
    const duelOpenPlayerMorale = tw.duel.playerMorale;
    const duelConfidenceDent = tw.duel.confidenceDent;
    // Win the captain's duel — pick the sharpest jab each round (QA exposes the weakness).
    let result = null;
    for (let r = 0; r < 40 && tw.duel.active; r++) {
      const d = tw.duel;
      let idx = d.options.findIndex((o) => o.category === d.enemyWeakTo);
      if (idx < 0) idx = 0;
      tw.duelChoose(idx);
      result = tw.duel.result;
    }
    // Sink-or-spare (#135, Option 4 slice 1): winning the boarding duel no longer auto-decides the
    // prize — it holds OPEN a deliberate choice. Confirm the prize is pending, then SPARE her (the
    // governor road) and confirm the ransom coin + Standing land.
    const prizePending = !!tw.prizeChoice;
    const infamyBeforeSpare = tw.state.infamy;
    const spare = tw.choosePrize('spare');
    const prizeClearedAfter = tw.prizeChoice === null;
    const standingAfter = tw.state.standing;
    return {
      engaged, boardableFresh, boardableWeak,
      brawlLines: brawl && brawl.lines ? brawl.lines.length : 0,
      battleEndedOnBoard, duelOpened, duelIsBoarded, result,
      duelOpenPlayerMorale, duelConfidenceDent,
      prizePending, prizeClearedAfter,
      spareCaptured: !!(spare && spare.captured),
      spareRansom: spare ? spare.addCoins : 0,
      standingGained: standingAfter - standingBefore,
      infamyOnSpare: tw.state.infamy - infamyBeforeSpare,
    };
  });
  if (boarding.engaged) {
    if (boarding.boardableFresh) fail('boarding: a full-hull foe should NOT be boardable (#135 slice 4)');
    if (!boarding.boardableWeak) fail('boarding: a foe beaten to ≤30% hull did not light the Board! prompt (#135 slice 4)');
    if (!(boarding.brawlLines >= 2)) fail(`boarding: the crew brawl narrated <2 comic lines (got ${boarding.brawlLines}) (#135 slice 4)`);
    if (!boarding.battleEndedOnBoard) fail('boarding: the broadside stance did not end when the crew boarded (#135 slice 4)');
    if (!boarding.duelOpened) fail('boarding: boarding did not hand off to the verbal captain duel (#33) (#135 slice 4)');
    if (!boarding.duelIsBoarded) fail('boarding: the captain duel was not flagged as boarded (capture framing) (#135 slice 4)');
    if (boarding.result !== 'win') fail(`boarding: the captain duel did not resolve to a win (result=${boarding.result}) (#135 slice 4)`);
    // Crew casualties → duel confidence (#135, Option 4 slice 3): the act-2→act-3 coupling must SURFACE —
    // the confidence dent is a sane number and YOUR captain's opening morale must reflect it exactly.
    if (!(boarding.duelConfidenceDent >= 0 && boarding.duelConfidenceDent <= 22))
      fail(`confidence coupling: opening dent out of band (got ${boarding.duelConfidenceDent}) (#135 Option 4 slice 3)`);
    if (boarding.duelOpenPlayerMorale !== 100 - boarding.duelConfidenceDent)
      fail(`confidence coupling: your captain's opening morale must reflect the casualty dent (morale=${boarding.duelOpenPlayerMorale}, dent=${boarding.duelConfidenceDent}) (#135 Option 4 slice 3)`);
    // Sink-or-spare (#135, Option 4 slice 1): the won boarding duel must OPEN a deliberate prize choice,
    // and SPARE must pay the governor pole (ransom coin + Standing) without adding infamy.
    if (!boarding.prizePending) fail('sink-or-spare: winning the boarding duel did not open a prize choice (#135 Option 4 slice 1)');
    if (!boarding.spareCaptured) fail('sink-or-spare: SPARE did not frame the ship as captured (#135 Option 4 slice 1)');
    if (!boarding.prizeClearedAfter) fail('sink-or-spare: the prize choice did not clear after resolving (#135 Option 4 slice 1)');
    if (!(boarding.spareRansom > 0)) fail(`sink-or-spare: SPARE paid no ransom coin (got ${boarding.spareRansom}) (#135 Option 4 slice 1)`);
    if (boarding.infamyOnSpare !== 0) fail(`sink-or-spare: SPARE should add no infamy (added ${boarding.infamyOnSpare}) (#135 Option 4 slice 1)`);
    if (!(boarding.standingGained > 0)) fail(`sink-or-spare: SPARE paid no Standing (gained ${boarding.standingGained}) (#135 Option 4 slice 1)`);
  } else {
    console.warn('  (#135 slice 4 boarding: no foe came in range to engage — skipped, like slice 2/3)');
  }

  // 2b6b) Dedicated BATTLE arena foe (#135, Option-4 final slice): squaring up now gives you a foe that
  // ACTIVELY SAILS TO FIGHT instead of drifting on her open-sea waypoint. Driven headlessly: engage,
  // then hold the helm still and STEP — the foe must run her dedicated duel brain (a valid helm stance),
  // actively maneuver (change heading + move), and hold a fighting stand-off rather than wandering off.
  const arenaFoe = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return { bi, bd };
    }
    // Deterministic engage: teleport the hull just off the nearest sail (well inside CHALLENGE_RANGE)
    // then square up — so this arena-foe check actually RUNS headlessly (the sail-to-a-foe sections
    // above skip when no NPC drifts into range). qaTeleport is the same QA hook the gallery shots use.
    const { bi } = nearest();
    let engaged = false;
    if (bi !== -1) {
      const fp = tw.npcs[bi].pos;
      tw.qaTeleport(fp[0], fp[1] - 120); // drop in ~120u off her — inside engage range
      tw.step(0.05);
      engaged = tw.engageBattle();
    }
    if (!engaged) return { engaged };
    const idx = tw.battle.foeIndex;
    const startPos = [...tw.npcs[idx].pos];
    const startHeading = tw.npcs[idx].heading;
    const dist = () => { const s = tw.state.pos; const p = tw.npcs[idx].pos; return Math.hypot(p[0] - s[0], p[1] - s[2]); };
    // Hold the helm still and let her maneuver for ~7s of sim time.
    const states = new Set();
    let headingMoved = false, hadFoePos = true;
    for (let i = 0; i < 70; i++) {
      tw.step(0.1);
      const h = tw.battle.foeHelm;
      if (h) states.add(h);
      if (Math.abs(norm(tw.npcs[idx].heading - startHeading)) > 0.05) headingMoved = true;
      if (!Array.isArray(tw.battle.foePos)) hadFoePos = false;
    }
    const endPos = [...tw.npcs[idx].pos];
    const moved = Math.hypot(endPos[0] - startPos[0], endPos[1] - startPos[1]) > 1;
    const holdDist = dist(); // a fighting stand-off — she neither rams nor drifts over the horizon
    const helmDrives = states.size > 0 && [...states].every((s) => ['close', 'open', 'beam', 'flee'].includes(s));
    tw.fleeBattle();
    return { engaged, moved, headingMoved, helmDrives, hadFoePos, holdDist, states: [...states] };
  });
  if (arenaFoe.engaged) {
    if (!arenaFoe.helmDrives) fail(`arena foe: her dedicated duel helm did not drive her (states=${arenaFoe.states.join(',')}) (#135 Option-4 final slice)`);
    if (!arenaFoe.hadFoePos) fail('arena foe: battle snapshot exposed no foePos for the QA hook (#135 Option-4 final slice)');
    if (!arenaFoe.moved) fail('arena foe: she did not actively sail while engaged — drifted inert (#135 Option-4 final slice)');
    if (!arenaFoe.headingMoved) fail('arena foe: she never came about to maneuver for position (#135 Option-4 final slice)');
    if (!(arenaFoe.holdDist < 400)) fail(`arena foe: she drifted off instead of holding the fight (dist=${Math.round(arenaFoe.holdDist)}) (#135 Option-4 final slice)`);
  } else {
    console.warn('  (#135 Option-4 arena foe: no foe came in range to engage — skipped, like slice 2)');
  }

  // 2b7) Early surrender / strike-colours short-circuit (#135, Option 4): when your gunnery breaks a
  // foe's nerve+hull hard enough she STRIKES HER COLOURS mid-maneuver — before you ever board — and
  // OFFERS to yield. The offer is HELD OPEN (you can't board or fire past it); accepting is a quick
  // capture (ransom + Standing) WITHOUT the board→brawl→duel. Driven headlessly: engage, break the foe
  // to the strike threshold, fire to open the white flag, assert the invariants, then ACCEPT her.
  const surrender = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return { bi, bd };
    }
    tw.press('w');
    let engaged = false;
    for (let i = 0; i < 1500 && !engaged; i++) {
      const { bi, bd } = nearest();
      if (bi === -1) break;
      if (bd <= 150) { engaged = tw.engageBattle(); if (engaged) break; }
      const s = tw.state;
      const desired = Math.atan2(tw.npcs[bi].pos[0] - s.pos[0], tw.npcs[bi].pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w');
    if (!engaged) return { engaged };
    // No white flag from a fresh, unbroken foe.
    const offerFresh = !!tw.surrenderOffer;
    // Break her nerve+hull to the strike threshold, then fire — she should strike her colours.
    tw.battleBreakFoe();
    tw.battleFire();
    const offerOpen = !!tw.surrenderOffer;
    const pendingFlag = tw.battle.surrenderPending;
    const cannotBoardUnderFlag = tw.battle.canBoard;   // must be false — answer the flag first
    const cannotFireUnderFlag = tw.battleFire();        // must be null — no firing past a white flag
    const standingBefore = tw.state.standing;
    const infamyBefore = tw.state.infamy;
    // ACCEPT her surrender — the quick capture (ransom + Standing), no board→brawl→duel.
    const accepted = tw.acceptSurrender();
    return {
      engaged, offerFresh, offerOpen, pendingFlag, cannotBoardUnderFlag,
      cannotFireUnderFlag, capturedResult: accepted && accepted.result,
      offerClearedAfter: tw.surrenderOffer === null,
      battleEnded: !tw.battle.active,
      standingGained: tw.state.standing - standingBefore,
      infamyGained: tw.state.infamy - infamyBefore,
    };
  });
  if (surrender.engaged) {
    if (surrender.offerFresh) fail('early-surrender: a fresh full-hull foe offered to yield (#135 Option 4)');
    if (!surrender.offerOpen) fail('early-surrender: breaking her nerve+hull did not raise a strike-colours offer (#135 Option 4)');
    if (!surrender.pendingFlag) fail('early-surrender: the surrender offer was not held open (surrenderPending) (#135 Option 4)');
    if (surrender.cannotBoardUnderFlag) fail('early-surrender: boarding should be blocked while a white flag is up (#135 Option 4)');
    if (surrender.cannotFireUnderFlag !== null) fail('early-surrender: firing should be a no-op while a white flag is up (#135 Option 4)');
    if (surrender.capturedResult !== 'capture') fail(`early-surrender: ACCEPT did not resolve to a capture (got ${surrender.capturedResult}) (#135 Option 4)`);
    if (!surrender.offerClearedAfter) fail('early-surrender: the offer did not clear after accepting (#135 Option 4)');
    if (!surrender.battleEnded) fail('early-surrender: accepting the surrender did not end the engagement (#135 Option 4)');
    if (!(surrender.standingGained > 0)) fail(`early-surrender: ACCEPT paid no Standing (gained ${surrender.standingGained}) (#135 Option 4)`);
  } else {
    console.warn('  (#135 Option 4 early-surrender: no foe came in range to engage — skipped, like slice 2/3/4)');
  }

  // 2b8) Battle-verb availability EARCONS (#154, the audio half of #153): when an in-battle verb-window
  // opens, a short DISTINCT earcon rings on the SAME illegal→legal edge the visual prompt lights — so
  // the captain learns WHICH verb + WHEN by ear. Driven headlessly + AudioContext-free: engage → the
  // guns-bear earcon; beat her into the boarding window → the boardable earcon; then a fresh engage,
  // break + fire her colours down → the surrender-offer earcon. Reads the tw.battleEarcon QA surface,
  // which records the last armed earcon regardless of the (never-opened) WebAudio path.
  const earcons = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return { bi, bd };
    }
    function engageNearest() {
      const { bi } = nearest();
      if (bi === -1) return false;
      const fp = tw.npcs[bi].pos;
      tw.qaTeleport(fp[0], fp[1] - 120); // drop in ~120u off her — inside engage range (arena-foe trick)
      tw.step(0.05);
      return tw.engageBattle();
    }
    // Run 1: guns bear, then the boarding window opens.
    const engaged = engageNearest();
    if (!engaged) return { engaged };
    tw.step(0.1);
    const fireCue = tw.battleEarcon;          // maneuvering broadside → fireReady
    tw.battleWeaken();                          // beat her hull into the board window
    tw.step(0.1);
    const boardCue = tw.battleEarcon;         // she's boardable → boardable
    tw.fleeBattle();
    tw.step(0.1);
    // Run 2: a fresh foe strikes her colours mid-maneuver.
    const engaged2 = engageNearest();
    tw.step(0.1);                               // let the fresh fire-window arm first
    tw.battleBreakFoe();
    tw.battleFire();                            // firing on a broken foe raises the white flag
    tw.step(0.1);
    const surrenderCue = engaged2 ? tw.battleEarcon : null; // colours struck → surrenderOffer
    tw.fleeBattle();
    return { engaged, fireCue, boardCue, engaged2, surrenderCue };
  });
  if (earcons.engaged) {
    if (earcons.fireCue !== 'fireReady') fail(`battle earcons: the guns-bear window did not ring fireReady (got ${earcons.fireCue}) (#154)`);
    if (earcons.boardCue !== 'boardable') fail(`battle earcons: the boarding window did not ring boardable (got ${earcons.boardCue}) (#154)`);
    if (earcons.engaged2 && earcons.surrenderCue !== 'surrenderOffer') fail(`battle earcons: striking her colours did not ring surrenderOffer (got ${earcons.surrenderCue}) (#154)`);
  } else {
    console.warn('  (#154 battle earcons: no foe to engage — skipped)');
  }

  // 2b9) COLD-START FTUE DISCOVERABILITY (#156): a fresh captain must be able to DISCOVER every core
  // verb the instant it becomes legal — a visible key-prompt (#153) and/or its availability earcon (#154).
  // This drives a cleared-save captain through the core arc (sight a sail → give battle → fire → board →
  // strike her colours) and asserts each keymap verb (src/keymap.js) is SIGNIFIED at its legal edge, read
  // off the tw.signifiers QA surface (the SAME pure model the strip paints, fresh-captain/unlearned). It's
  // written against the keymap so a NEW verb is auto-covered: every KEYS id must be walked (KEYS ⊆ covered)
  // AND signified when legal — a reachable-but-un-taught verb FAILS LOUDLY. This locks the onboarding so a
  // future change can't silently make a verb undiscoverable again (the #135 defect #153/#154 fixed).
  const ftue = await page.evaluate(async (KEY_IDS) => {
    const tw = window.__tidewake;
    tw.newVoyage();              // cold start — a brand-new captain, save cleared
    tw.step(0.1);
    const covered = new Set();   // keymap ids we drove to a legal edge + checked
    const misses = [];           // [{verb, phase, signifiers}] — a reachable verb with NO signifier
    const want = (verb, phase) => {
      covered.add(verb);
      const s = tw.signifiers;
      if (!s.includes(verb)) misses.push({ verb, phase, signifiers: s.slice() });
    };
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    function closeOnNearest() {   // deterministic: drop just off the nearest sail, inside CHALLENGE_RANGE
      const bi = nearest();
      if (bi === -1) return false;
      const fp = tw.npcs[bi].pos;
      tw.qaTeleport(fp[0], fp[1] - 120);
      tw.step(0.1);
      return true;
    }
    // 1) AT SEA — a hailable ship lights E give battle (the persistent #challenge-prompt).
    if (!closeOnNearest()) return { skipped: true };
    want('engage', 'at-sea foe in hail range');
    // 2) SQUARE UP — the maneuver broadside: E break off + SPACE fire (+ X cycle once the locker holds 2+).
    tw.fitAmmoType('grape');                 // fit a 2nd shot so the cycle verb is legal + expected here
    if (tw.loadout.length < 2) tw.fitAmmoType('chain');
    tw.engageBattle();
    tw.step(0.1);
    want('flee', 'live fight');
    want('fire', 'maneuver — guns bear');
    want('cycle', 'maneuver — 2+ fitted shots');
    // 3) BOARD — beat her into the ≤30% hull window; F board her lights.
    tw.battleWeaken();
    tw.step(0.1);
    want('board', 'foe beaten to the boarding window');
    // 4) STRIKE HER COLOURS — break her nerve+hull and fire; the 1 accept / 2 press decision lights.
    tw.fleeBattle();
    let incomplete = null;
    if (closeOnNearest()) {
      tw.engageBattle();
      tw.step(0.1);
      tw.battleBreakFoe();
      tw.battleFire();
      tw.step(0.1);
      want('accept', 'foe strikes her colours');
      want('press', 'foe strikes her colours');
      tw.fleeBattle();
    } else {
      incomplete = 'no fresh foe for the surrender edge';
    }
    return { skipped: false, covered: [...covered], misses, keyIds: KEY_IDS, incomplete };
  }, Object.keys(KEYS));
  if (ftue.skipped) {
    fail('FTUE #156: no NPC available to drive the cold-start discoverability walk');
  } else {
    // Every core verb that became legal must have been SIGNIFIED at that moment — else it's undiscoverable.
    for (const m of ftue.misses) fail(`FTUE #156: verb "${m.verb}" was LEGAL but UN-SIGNIFIED at [${m.phase}] — signifiers were {${m.signifiers.join(', ') || 'none'}}`);
    // Auto-coverage lock against the keymap: a NEW keymap verb with no FTUE drive fails loudly, so a
    // reachable verb can never silently ship without a discoverability check.
    const uncovered = ftue.keyIds.filter((id) => !ftue.covered.includes(id));
    if (uncovered.length) fail(`FTUE #156: keymap verb(s) never checked for discoverability: ${uncovered.join(', ')} — add an FTUE drive (they may be shipping un-taught)`);
    if (ftue.incomplete) console.warn(`  (FTUE #156: ${ftue.incomplete} — surrender edge skipped)`);
  }

  // 2b9′) PERSISTENT signifiers for the non-battle core verbs (#156): the sail/steer helm hints must sit
  // on-screen from boot, and a harboured captain's ONLY way back to sea — the "⚓ Set Sail" plank — must be
  // present in the town view. These verbs have no keymap prompt; their teachers are the standing #help bar
  // and the town panel, so the FTUE gate locks them here too.
  const ftuePersist = await page.evaluate(async () => {
    const tw = window.__tidewake;
    // sail/steer — the standing help bar teaches throttle (W/S) + steering (A/D) the whole voyage.
    const help = (document.getElementById('help')?.textContent || '');
    const teachesThrottle = /W\/S/.test(help);
    const teachesSteer = /A\/D/.test(help);
    // town/harbour + set-sail — sail into a port, then the town view must offer the Set Sail plank.
    tw.newVoyage(); tw.step(0.1);
    let best = null, bd = Infinity;
    for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - tw.state.pos[0], p.pos[1] - tw.state.pos[2]); if (d < bd) { bd = d; best = p; } }
    let inTown = false, hasSetSail = false;
    if (best) {
      tw.qaTeleport(best.pos[0], best.pos[1]);   // drop onto the harbour → landfall into TOWN
      // Wait for the town VIEW to finish its landfall gesture and paint (mode flips to town a beat
      // before tw.town.open, which is when the panel — incl. the Set Sail plank — is actually rendered).
      for (let i = 0; i < 120 && !inTown; i++) { tw.step(0.1); inTown = tw.town.open === true; }
      hasSetSail = !!document.getElementById('town-leave');
    }
    tw.leaveHarbour?.(); tw.newVoyage(); tw.step(0.1); // clean slate for the screenshot
    return { teachesThrottle, teachesSteer, hadPort: !!best, inTown, hasSetSail };
  });
  if (!ftuePersist.teachesThrottle) fail('FTUE #156: the help bar does not teach the throttle (W/S) — sail verb un-signified');
  if (!ftuePersist.teachesSteer) fail('FTUE #156: the help bar does not teach steering (A/D) — steer verb un-signified');
  if (ftuePersist.hadPort) {
    if (!ftuePersist.inTown) fail('FTUE #156: sailing onto a harbour did not make landfall into TOWN (cannot check Set Sail)');
    else if (!ftuePersist.hasSetSail) fail('FTUE #156: the town view has no "Set Sail" plank (#town-leave) — the set-sail verb is undiscoverable');
  }

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
      // #93: steering is now the rotatable ship's-wheel (#ship-wheel), not the old ◀▶ buttons.
      touchControls: { steer: !!tc?.querySelector('#ship-wheel'), throttle: !!tc?.querySelector('[data-hold="w"]'), fire: !!tc?.querySelector('[data-tap="g"]'), duel: !!tc?.querySelector('[data-tap="f"]') },
    };
  });
  if (!pwa.manifestLinked) fail('PWA: no <link rel="manifest"> in index.html');
  if (!pwa.manifestOk) fail('PWA: manifest did not load (200) in the browser');
  if (!pwa.hasName) fail('PWA: manifest missing a name');
  if (!pwa.standalone) fail('PWA: manifest display is not "standalone"');
  if (!pwa.icon512) fail('PWA: manifest has no 512x512 icon');
  if (!pwa.appleOk) fail('PWA: apple-touch-icon did not load (200)');
  for (const [verb, present] of Object.entries(pwa.touchControls)) {
    if (!present) fail(`touch controls: ${verb} control missing from #touch-controls`);
  }

  // 2e′) Ship's-wheel touch steering (#93): rotating the on-screen helm must turn the ship,
  // feeding the SAME eased rudder the keyboard does. Drive the wheel headlessly (no real touch):
  // turn it to full lock, sail, and assert the heading swings; centre it and assert the rudder
  // eases back toward amidships. Proves the analog wheel→steer→rudder→heading path end-to-end.
  const wheelNav = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage();
    tw.centreWheel();
    tw.press('w'); tw.step(2);            // gather way so the rudder has authority
    const h0 = tw.state.heading;
    const steerStarboard = tw.steerWheel(2.2);   // hard clockwise = hard a-starboard
    tw.step(2.5);
    const turned = tw.state.heading;
    const rudderHeld = tw.state.rudder;
    tw.centreWheel();                      // lift off → self-centring helm
    tw.step(2.5);
    const rudderAfter = tw.state.rudder;
    tw.release('w');
    return {
      steerStarboard, turnedBy: turned - h0, rudderHeld, rudderAfter,
      axisAfterCentre: tw.wheel.steer,
    };
  });
  if (!(Math.abs(wheelNav.turnedBy) > 0.15)) fail(`ship's-wheel: a full-lock helm did not turn the ship (Δheading=${wheelNav.turnedBy})`);
  if (!(Math.abs(wheelNav.rudderHeld) > 0.4)) fail(`ship's-wheel: holding the wheel over did not build rudder (rudder=${wheelNav.rudderHeld})`);
  if (!(Math.abs(wheelNav.rudderAfter) < Math.abs(wheelNav.rudderHeld))) fail(`ship's-wheel: releasing the wheel did not ease the rudder back (held=${wheelNav.rudderHeld}, after=${wheelNav.rudderAfter})`);
  if (wheelNav.axisAfterCentre !== 0) fail(`ship's-wheel: centring the helm did not zero the steer axis (got ${wheelNav.axisAfterCentre})`);

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
    // Nearest PORTLESS island to the origin — ramming a port-island now makes landfall into
    // TOWN mode (#67) and stops the hull at the harbour, so it can't reach a port-island's coast.
    const nearAPort = (c) => tw.ports.some((p) => Math.hypot(p.pos[0] - c.x, p.pos[1] - c.z) < c.r + 120);
    let isle = null, bd = Infinity;
    for (const c of tw.islands) {
      if (nearAPort(c)) continue;
      const d = Math.hypot(c.x, c.z);
      if (d < bd) { bd = d; isle = c; }
    }
    if (!isle) return { hasIsland: false };
    // Islands TLC (#71) made footprints VARIED squashed ellipses, so the solid shoreline along the
    // approach bearing isn't simply `r` — grab this isle's squash (sx,sz) so the assertion can
    // expect the true ellipse coast, not a circle. (semi-axes match physics.js: r*HITBOX*scale + shipR.)
    const style = (tw.islandStyles || []).find((s) => s.index === isle.index) || { sx: 1, sz: 1 };
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
    return { hasIsland: true, r: isle.r, sx: style.sx, sz: style.sz, isleX: isle.x, isleZ: isle.z, minDist, finalDist };
  });
  if (!collision.hasIsland) fail('collision: no islands exposed via tw.islands');
  else {
    // The solid coast along the approach bearing for the (possibly squashed) ellipse footprint —
    // semi-axes r*HITBOX*scale + SHIP_RADIUS (physics.js: HITBOX=1.18, shipR=7).
    const HITBOX = 1.18, shipR = 7;
    const d0 = Math.hypot(collision.isleX, collision.isleZ) || 1;
    const ux = collision.isleX / d0, uz = collision.isleZ / d0;     // approach bearing (origin→centre)
    const ax = collision.r * HITBOX * collision.sx + shipR;
    const az = collision.r * HITBOX * collision.sz + shipR;
    const shore = 1 / Math.sqrt((ux * ux) / (ax * ax) + (uz * uz) / (az * az));
    // (1) it sailed right up to the coast — otherwise the test proves nothing.
    if (!(collision.minDist <= shore + 25)) fail(`collision: ship never reached the coast (minDist=${collision.minDist.toFixed(1)}, shore≈${shore.toFixed(1)})`);
    // (2) it was NEVER allowed deep inside the island — no tunnelling/phasing through land.
    if (!(collision.minDist >= shore * 0.85)) fail(`collision: ship punched into the island (minDist=${collision.minDist.toFixed(1)} < ${(shore * 0.85).toFixed(1)})`);
    if (!(collision.finalDist >= shore * 0.85)) fail(`collision: ship ended up inside the island (finalDist=${collision.finalDist.toFixed(1)})`);
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
    // Cross-mode "world keeps living" invariant (#107 slice 2): snapshot the fleet so we can
    // prove the snap-freeze regression (#95) can't return via BATTLE either — the player's helm
    // freezes but at least one other vessel sails on while we're paused mid-fight.
    const npcBeforeFight = tw.npcs.map((n) => n.pos.slice());
    let settlingDuringFight = false, fightMinSpeed = Infinity;
    if (engaged) {
      for (let i = 0; i < 80; i++) { tw.step(0.1); if (tw.state.settling) settlingDuringFight = true; fightMinSpeed = Math.min(fightMinSpeed, tw.state.speed); }
    }
    const settledSpeed = tw.state.speed;
    const npcAfterFight = tw.npcs.map((n) => n.pos.slice());
    let worldMovedInFight = false;
    for (let i = 0; i < Math.min(npcBeforeFight.length, npcAfterFight.length); i++) {
      if (Math.hypot(npcAfterFight[i][0] - npcBeforeFight[i][0], npcAfterFight[i][1] - npcBeforeFight[i][1]) > 1) worldMovedInFight = true;
    }
    // End the fight (broadside-spam is a guaranteed win), then confirm control returns.
    for (let r = 0; r < 20 && tw.cannons.active; r++) tw.cannonFire(0);
    tw.release('w'); tw.release('a'); tw.release('d');
    const fight = { engaged, speedAtEngage, settlingDuringFight, fightMinSpeed, settledSpeed, worldMovedInFight, fightEnded: !tw.cannons.active };

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
    // Cross-mode "world keeps living" invariant (#107): the helm froze (settledSpeed<3) yet the
    // world sailed on — the snap-freeze regression (#95) can't return via BATTLE either.
    if (!settle.fight.worldMovedInFight) fail('mode: the world snap-froze — no vessel moved while the player was paused in BATTLE (#95/#107)');
    if (!settle.fight.fightEnded) fail('slow-to-stop: fight did not resolve so control could return');
  }

  // 2h) Mode system (#95): the explicit world-state machine. Boots in SAILING; entering TOWN
  // pauses the player's helm (the ship eases to a near-stop with the throttle still HELD) while
  // other vessels keep sailing — the world doesn't snap-freeze around you — and leaving returns
  // to SAILING. (A live fight drives BATTLE automatically, exercised by the fight section above.)
  const mode = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const boot = tw.mode;
    tw.press('w'); tw.step(3);                 // build some way before making port
    const speedBeforeTown = tw.state.speed;
    const npcBefore = tw.npcs.map((n) => n.pos.slice());
    const entered = tw.enterMode('town');      // deliberately enter TOWN with the throttle HELD
    const inTown = tw.mode;
    let settled = false;
    for (let i = 0; i < 60; i++) { tw.step(0.1); if (tw.state.settling) settled = true; }
    const speedInTown = tw.state.speed;
    const npcAfter = tw.npcs.map((n) => n.pos.slice());
    let worldMoved = false;                     // did at least one vessel sail on while paused?
    for (let i = 0; i < Math.min(npcBefore.length, npcAfter.length); i++) {
      if (Math.hypot(npcAfter[i][0] - npcBefore[i][0], npcAfter[i][1] - npcBefore[i][1]) > 1) worldMoved = true;
    }
    tw.release('w');
    const left = tw.leaveMode();
    const afterLeave = tw.mode;
    tw.newVoyage(); tw.step(0.1);
    return { boot, entered, inTown, speedBeforeTown, speedInTown, settled, worldMoved, left, afterLeave };
  });
  if (mode.boot !== 'sailing') fail(`mode: game did not boot in SAILING (got ${mode.boot})`);
  if (!mode.entered || mode.inTown !== 'town') fail(`mode: enterMode('town') did not switch the world-state (mode=${mode.inTown})`);
  if (!mode.settled) fail('mode: the player helm did not ease to settle when paused in town');
  if (!(mode.speedInTown < mode.speedBeforeTown)) fail(`mode: ship did not slow on entering town (before=${mode.speedBeforeTown?.toFixed(1)} → in-town=${mode.speedInTown?.toFixed(1)})`);
  if (!mode.worldMoved) fail('mode: the world snap-froze — no vessel moved while the player was paused in town (#95)');
  if (!mode.left || mode.afterLeave !== 'sailing') fail(`mode: leaveMode() did not return to SAILING (got ${mode.afterLeave})`);

  // 2h2) Auto-harbour into TOWN mode (#67 + #96): sailing into a port's dock radius makes
  // LANDFALL — the world settles into TOWN mode, the town view opens on the docked port, a real
  // market trade lands on the purse, and the explicit Leave Harbour control returns to SAILING
  // and carries the hull back OUT (helm re-armed + bow nudged seaward — never trapped at the
  // berth, the owner-flagged risk). Also asserts body.town hides the at-sea controls (#66).
  const harbour = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const $town = document.getElementById('town');
    tw.newVoyage(); tw.step(0.1);
    function nearestPort() {
      const s = tw.state.pos; let best = null, bd = Infinity;
      for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - s[0], p.pos[1] - s[2]); if (d < bd) { bd = d; best = p; } }
      return { best, bd };
    }
    // Sail at the nearest port until landfall flips the mode to TOWN.
    tw.press('w');
    let entered = false;
    for (let i = 0; i < 6000 && !entered; i++) {
      const { best } = nearestPort(); if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      entered = tw.mode === 'town';
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    for (let i = 0; i < 20; i++) tw.step(0.1); // let the helm settle + the town view paint
    const onLanding = {
      mode: tw.mode, townOpen: tw.town.open, port: tw.town.port, docked: tw.docked,
      townShown: !!$town && $town.classList.contains('show'),
      bodyTown: document.body.classList.contains('town'),
    };
    // The one meaningful market interaction, wired to the economy: buy 1 (purse moves), sell back.
    let traded = false, coinsMoved = false;
    if (tw.economy && tw.economy.market) {
      const coins0 = tw.economy.coins;
      const good = tw.economy.market[0].id;
      const b = tw.economy.buy(good, 1);
      coinsMoved = tw.economy.coins !== coins0;
      const s = tw.economy.sell(good, 1);
      traded = !!(b && b.ok && s && s.ok);
    }
    // "While you were ashore…" digest (#105): the landfall snapshot must be live while ashore.
    const snapWhileAshore = tw.ashore && tw.ashore.snapshot ? { coins: tw.ashore.snapshot.coins } : null;
    // Leave Harbour: the single explicit, reversible exit — back to SAILING, bow nudged seaward.
    const left = tw.leaveHarbour();
    // On Set Sail the digest is composed from the visit's REAL deltas (we traded above) and the
    // landfall snapshot is consumed (back to null at sea). Capture both for the gate below.
    const dg = tw.ashore && tw.ashore.digest;
    const digest = dg ? { title: dg.title, lineCount: dg.lines.length, body: dg.lines.join(' · ') } : null;
    const snapAfterLeave = tw.ashore ? tw.ashore.snapshot : 'missing';
    const afterLeave = { mode: tw.mode, left };
    // Make sail: the harbour assist stands down so the nudge carries us clear of the dock radius.
    let clearedHarbour = false;
    for (let i = 0; i < 600; i++) { tw.step(0.1); if (!tw.docked) { clearedHarbour = true; break; } }
    const sailedOut = { clearedHarbour, mode: tw.mode, townOpen: tw.town.open, bodyTown: document.body.classList.contains('town') };
    tw.newVoyage(); tw.step(0.1);
    return { entered, onLanding, traded, coinsMoved, afterLeave, sailedOut, snapWhileAshore, digest, snapAfterLeave };
  });
  if (!harbour.entered || harbour.onLanding.mode !== 'town') fail(`auto-harbour: sailing into a port did not make landfall into TOWN (mode=${harbour.onLanding.mode})`);
  if (!harbour.onLanding.townOpen) fail('auto-harbour: the town view did not open on landfall');
  if (!harbour.onLanding.townShown) fail('auto-harbour: #town panel did not become visible on landfall');
  if (!harbour.onLanding.bodyTown) fail('auto-harbour: body.town not set — at-sea controls not hidden in town (#66)');
  if (!harbour.onLanding.port) fail('auto-harbour: the town view has no docked port');
  if (!harbour.traded) fail('auto-harbour: a market trade did not complete in the town');
  if (!harbour.coinsMoved) fail('auto-harbour: buying in the town market did not move the purse');
  if (!harbour.afterLeave.left || harbour.afterLeave.mode !== 'sailing') fail(`auto-harbour: Leave Harbour did not return to SAILING (mode=${harbour.afterLeave.mode})`);
  if (!harbour.sailedOut.clearedHarbour) fail('auto-harbour: the seaward nudge never carried the ship clear of the dock radius (trap risk #67)');
  if (harbour.sailedOut.townOpen) fail('auto-harbour: the town view stayed open after leaving');
  if (harbour.sailedOut.bodyTown) fail('auto-harbour: body.town lingered after leaving (controls stayed hidden)');
  // "While you were ashore…" digest (#105): the landfall snapshot is live in town, and Set Sail
  // composes an in-character digest from the visit's REAL deltas (we traded above), then clears the
  // snapshot. The digest must speak (a titled, non-empty recap) and mention the deltas it surfaced.
  if (!harbour.snapWhileAshore) fail('ashore-digest: no landfall snapshot was captured on entering TOWN (#105)');
  if (!harbour.digest) fail('ashore-digest: Set Sail did not compose a "while you were ashore" digest (#105)');
  if (!/ashore/i.test(harbour.digest.title) || harbour.digest.lineCount < 1) fail(`ashore-digest: digest empty/mistitled (${JSON.stringify(harbour.digest)})`);
  if (harbour.snapAfterLeave !== null) fail(`ashore-digest: the landfall snapshot was not consumed on Set Sail (got ${JSON.stringify(harbour.snapAfterLeave)})`);

  // 2h2b) The port remembers you (#104): a port keeps a persistent per-town memory of your prior
  // dealings and reflects it back on return. Drive two landfalls at the SAME port (teleport-driven
  // arrival edges, deterministic), growing the captain's standing in between, and assert: the first
  // visit banks the memory (visits=1) with NO remembered-return greeting (a stranger's welcome); the
  // SECOND visit recalls it (visits=2, a non-empty greeting naming the port) and the town panel's
  // harbourmaster line shows that remembered-return greeting (the owner-facing reactive verb).
  const memory = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const port = tw.ports[0];
    const [px, pz] = port.pos;
    // A point well clear of every dock radius, to "sail out" between visits (re-arms the arrival edge).
    let far = [0, 0];
    { let bx = 0, bz = 0, bd = -1; for (let r = 0; r < 8; r++) { const ax = Math.cos(r) * 4000, az = Math.sin(r) * 4000; let d = Infinity; for (const p of tw.ports) d = Math.min(d, Math.hypot(p.pos[0] - ax, p.pos[1] - az)); if (d > bd) { bd = d; bx = ax; bz = az; } } far = [bx, bz]; }
    async function arriveAt(x, z) {
      tw.qaTeleport(x, z); tw.step(0.1);
      for (let i = 0; i < 80 && !(tw.mode === 'town' && tw.town.open); i++) tw.step(0.1); // let the landfall gesture finish
    }
    function leave() {
      tw.leaveHarbour();
      tw.qaTeleport(far[0], far[1]);
      for (let i = 0; i < 40 && tw.docked; i++) tw.step(0.1); // clear the dock radius → re-arm arrival
    }
    // First landfall — a stranger.
    await arriveAt(px, pz);
    const firstVisits = (tw.portMemory[port.name] || {}).visits || 0;
    const firstRecall = tw.portRecall ? tw.portRecall.line : null;
    const $masterEl = document.querySelector('#town .town-master');
    const firstMaster = $masterEl ? $masterEl.textContent : '';
    // Sail out, grow a respectable name, and return — the port should now KNOW you.
    leave();
    tw.setStanding(1200); // climb several rungs so the return is visibly reactive
    await arriveAt(px, pz);
    const secondVisits = (tw.portMemory[port.name] || {}).visits || 0;
    const recall = tw.portRecall;
    const $master2 = document.querySelector('#town .town-master');
    const secondMaster = $master2 ? $master2.textContent : '';
    const masterIsRecall = !!$master2 && $master2.classList.contains('town-master-recall');
    // Persistence: the memory survives a save round-trip (drive save.js through the live hook).
    tw.save();
    const persistedVisits = (tw.portMemory[port.name] || {}).visits || 0;
    tw.newVoyage(); tw.step(0.1);
    return {
      portName: port.name, firstVisits, firstRecall, firstMaster,
      secondVisits, recallPort: recall && recall.port, recallLine: recall && recall.line,
      secondMaster, masterIsRecall, persistedVisits,
    };
  });
  if (memory.firstVisits !== 1) fail(`port-memory: first landfall did not bank a visit (visits=${memory.firstVisits}) (#104)`);
  if (memory.firstRecall) fail(`port-memory: a first visit must NOT recall a memory (got "${memory.firstRecall}") (#104)`);
  if (memory.secondVisits !== 2) fail(`port-memory: a return visit did not increment the visit count (visits=${memory.secondVisits}) (#104)`);
  if (!memory.recallLine || memory.recallPort !== memory.portName) fail(`port-memory: a return visit did not produce a remembered-return greeting for the port (#104)`);
  if (!memory.recallLine.includes(memory.portName)) fail(`port-memory: the remembered-return greeting did not name the port (#104)`);
  if (memory.secondMaster !== memory.recallLine) fail('port-memory: the town harbourmaster line did not show the remembered-return greeting on return (#104)');
  if (memory.secondMaster === memory.firstMaster) fail('port-memory: the town greeting did not visibly change between the first and return visit (#104)');
  if (!memory.masterIsRecall) fail('port-memory: the town greeting was not flagged as a remembered-return (visual cue missing) (#104)');
  if (memory.persistedVisits !== 2) fail('port-memory: the per-port memory did not survive a save round-trip (#104)');

  // 2h2c) Rumours that pay off (#111/#112/#115): the reactive town→rumour→sail→reward loop. Make
  // landfall, LISTEN in the tavern, CHASE a trade tip (it becomes a typed objective with the named
  // port's coords — a marker heading), then sail to that port and assert ARRIVING pays off (coins
  // bounty + the pin clears + a Ballad verse sings the chased rumour). Proves the loop is real
  // state end-to-end, not silent + invisible.
  const chase = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    tw.newVoyage(); tw.step(0.1);
    function nearestPort() {
      const s = tw.state.pos; let best = null, bd = Infinity;
      for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - s[0], p.pos[1] - s[2]); if (d < bd) { bd = d; best = p; } }
      return { best, bd };
    }
    // Sail into the nearest port until landfall opens the tavern.
    tw.press('w');
    let entered = false;
    for (let i = 0; i < 6000 && !entered; i++) {
      const { best } = nearestPort(); if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      entered = tw.mode === 'town';
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    for (let i = 0; i < 20; i++) tw.step(0.1);
    const fromPort = tw.town.port;
    // Listen + chase a trade tip (re-listen if the first word carried no chase-able target).
    let heard = 0, target = null;
    for (let n = 0; n < 6 && !target; n++) { heard = tw.tavernListen().length; target = tw.chaseRumour(); }
    const cueListen = tw.loopCue; // the room leaked you word → a soft cup-an-ear cue armed (#116)
    const obj = tw.objective;
    const pinned = !!(obj && obj.target && Number.isFinite(obj.target.x) && Number.isFinite(obj.target.z));
    const chasingDifferentPort = !!(target && target.name && target.name !== fromPort);
    // Leave harbour, then make for the chased port (teleport just onto its dock point so arrival
    // fires deterministically) and step so onArrive resolves the objective + pays off.
    tw.leaveHarbour();
    const tgt = target && tw.ports.find((p) => p.name === target.name);
    const coins0 = tw.state.coins;
    let coinsGain = 0, cleared = false, hasVerse = false, payoffPort = null;
    let cueApproach = null, cuePayoff = null, cuePayoffUnder = null;
    if (tgt) {
      // Cross INWARD through the approach radius toward the pin: sit well outside (settle prevDist),
      // then jump inside it — the "drawing near" horizon nod should ring once on the crossing (#116).
      tw.qaTeleport(tgt.pos[0] + 300, tgt.pos[1]); tw.step(0.1);
      tw.qaTeleport(tgt.pos[0] + 150, tgt.pos[1]); tw.step(0.1);
      cueApproach = tw.loopCue;
      // Then make the port: the tip pays off → the bright PAYOFF flourish lands (#116).
      tw.qaTeleport(tgt.pos[0], tgt.pos[1]);
      for (let i = 0; i < 60; i++) { tw.step(0.1); if (!tw.objective) { cleared = true; break; } }
      coinsGain = tw.state.coins - coins0;
      payoffPort = tw.docked;
      cuePayoff = tw.loopCue;
      cuePayoffUnder = tw.loopUnderCue; // a paying tip rings the coin chime UNDER the payoff (#116 f/u)
      hasVerse = tw.voyageLog.some((e) => e.type === 'rumour' && e.name === target.name);
    }
    tw.newVoyage(); tw.step(0.1);
    const afterNewVoyage = tw.objective;
    return { entered, heard, target, pinned, chasingDifferentPort, coinsGain, cleared, hasVerse, payoffPort, afterNewVoyage, cueListen, cueApproach, cuePayoff, cuePayoffUnder };
  });
  if (!chase.entered) fail('rumour-chase: never made landfall to reach the tavern');
  if (!(chase.heard >= 1)) fail('rumour-chase: the tavern surfaced no word to chase (#103)');
  if (!chase.target || chase.target.kind !== 'port') fail('rumour-chase: no chase-able trade tip with a typed port target (#115)');
  if (!chase.chasingDifferentPort) fail('rumour-chase: the chased tip did not name a real OTHER port to sail to (#111)');
  if (!chase.pinned) fail('rumour-chase: the active objective carries no target coords — nothing for the marker to pin (#111)');
  if (!(chase.coinsGain > 0)) fail(`rumour-chase: arriving at the chased port did not pay off (coinsGain=${chase.coinsGain}) (#112)`);
  if (!chase.cleared) fail('rumour-chase: the objective did not clear on arrival — the pin would linger (#112)');
  if (chase.payoffPort !== chase.target.name) fail(`rumour-chase: payoff did not fire at the chased port (docked=${chase.payoffPort}) (#112)`);
  if (!chase.hasVerse) fail('rumour-chase: the chased rumour did not sing into the Ballad/voyage log (#78/#112)');
  if (chase.afterNewVoyage) fail('rumour-chase: a fresh voyage did not clear the chased objective (#111/#112)');
  // Diegetic feedback (#116): the reactive loop now SINGS its beats — listen → approach → payoff.
  // Listening colours the cue by the kind of word the room leaked (#116 f/u): rep keeps the base
  // 'listen', a trade tip rings 'listenTrade', etc. — so accept any cue in the LISTEN family.
  const LISTEN_FAMILY = ['listen', 'listenTrade', 'listenSea', 'listenDeed'];
  if (!LISTEN_FAMILY.includes(chase.cueListen)) fail(`rumour-chase: listening for word armed no diegetic cue (got ${chase.cueListen}) (#116)`);
  if (chase.cueApproach !== 'approach') fail(`rumour-chase: crossing the approach radius rang no "drawing near" cue (got ${chase.cueApproach}) (#116)`);
  if (chase.cuePayoff !== 'payoff') fail(`rumour-chase: the rumour paying off rang no PAYOFF cue (got ${chase.cuePayoff}) (#116)`);
  // The paying tip layers a coin chime UNDER the payoff (coinsGain>0 was asserted above) (#116 f/u).
  if (chase.cuePayoffUnder !== 'coin') fail(`rumour-chase: a paying payoff rang no coin chime under it (got ${chase.cuePayoffUnder}) (#116)`);

  // 2h2c2) Contested rumour (#133, DL #5): a rumour you chase is ALSO chased by a rival captain on a
  // seeded soft clock. Arrive in time → win it as normal + a "you beat them to it" beat; dawdle and
  // the rival CLAIMS it first → you arrive to find it gone (a wry line, NO reward). Drive BOTH paths
  // deterministically via the QA spawn/resolve hooks, and prove the claim PERSISTS across a reload
  // (no resetting the race clock by reloading). Both outcomes must sing distinct verses into the Ballad.
  const contestedWin = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const other = tw.ports[1] || tw.ports[0];
    const target = { kind: 'port', name: other.name };
    // --- WIN the race: chase contested, arrive before the rival's clock runs out ---
    tw.newVoyage(); tw.step(0.1);
    const wonObj = tw.chaseContested(target);
    const contestedSpawn = !!(wonObj && wonObj.contest && wonObj.contest.rival && wonObj.contest.budget > 0);
    const rival = wonObj && wonObj.contest && wonObj.contest.rival;
    const coins0 = tw.state.coins;
    tw.qaTeleport(other.pos[0], other.pos[1]);
    let wonCleared = false;
    for (let i = 0; i < 60; i++) { tw.step(0.1); if (!tw.objective) { wonCleared = true; break; } }
    const wonGain = tw.state.coins - coins0;
    const wonVerse = tw.voyageLog.some((e) => e.type === 'rumour' && e.name === other.name && e.rival && e.won === true);
    // Recurring antagonist: the SAME contested rumour always names the SAME rival.
    tw.newVoyage(); tw.step(0.1);
    const again = tw.chaseContested(target);
    const sameRival = !!(again && again.contest && again.contest.rival === rival);
    // --- LOSE setup: chase contested, run the rival's clock out (resolve hook), and SAVE ---
    tw.newVoyage(); tw.step(0.1);
    tw.chaseContested(target);
    const claimedHook = tw.rivalClaim();
    const claimedState = !!(tw.objective && tw.objective.contest && tw.objective.contest.claimed);
    tw.save();
    return { targetName: other.name, contestedSpawn, rival, wonCleared, wonGain, wonVerse, sameRival, claimedHook, claimedState };
  });
  if (!contestedWin.contestedSpawn) fail('contested-rumour: chaseContested did not spawn a contested objective with a named rival + soft clock (#133)');
  if (!contestedWin.wonCleared) fail('contested-rumour: the won objective did not clear on arrival (#133)');
  if (!(contestedWin.wonGain > 0)) fail(`contested-rumour: winning the race paid no reward (gain=${contestedWin.wonGain}) (#133)`);
  if (!contestedWin.wonVerse) fail('contested-rumour: a won race did not sing a "beat them to it" verse into the Ballad (#78/#133)');
  if (!contestedWin.sameRival) fail('contested-rumour: the same contested rumour named a different rival — not a recurring antagonist (#133)');
  if (!contestedWin.claimedHook || !contestedWin.claimedState) fail('contested-rumour: the rival-claim resolve hook did not claim the prize (#133)');

  // Reload: the rival's CLAIM must persist — you can't reset the race clock by reloading. Then sail
  // in too late and confirm the lose-race path (no reward, the pin clears, a distinct "beaten" verse).
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const contestedLose = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const persistedClaim = !!(tw.objective && tw.objective.contest && tw.objective.contest.claimed);
    const targetName = tw.objective && tw.objective.target && tw.objective.target.name;
    const tgt = tw.ports.find((p) => p.name === targetName);
    const coins0 = tw.state.coins;
    let lostCleared = false;
    if (tgt) {
      tw.qaTeleport(tgt.pos[0], tgt.pos[1]);
      for (let i = 0; i < 60; i++) { tw.step(0.1); if (!tw.objective) { lostCleared = true; break; } }
    }
    const lostGain = tw.state.coins - coins0;
    const cueLoss = tw.loopCue; // arriving to a rival's wake → the sour LOSS stab, not the bright payoff (#116)
    const lostVerse = tw.voyageLog.some((e) => e.type === 'rumour' && e.name === targetName && e.rival && e.won === false);
    tw.newVoyage(); tw.step(0.1);
    return { persistedClaim, targetName, lostCleared, lostGain, lostVerse, cueLoss };
  });
  if (!contestedLose.persistedClaim) fail('contested-rumour: the rival claim did not survive a reload — the clock could be reset by reloading (#133)');
  if (!contestedLose.lostCleared) fail('contested-rumour: the lost objective did not clear on arrival (#133)');
  if (!(contestedLose.lostGain === 0)) fail(`contested-rumour: arriving after the rival claimed it still paid out (gain=${contestedLose.lostGain}) — the prize should be gone (#133)`);
  if (!contestedLose.lostVerse) fail('contested-rumour: a lost race did not sing a distinct "beaten to it" verse into the Ballad (#78/#133)');
  if (contestedLose.cueLoss !== 'loss') fail(`contested-rumour: arriving to the rival's wake rang the wrong cue (got ${contestedLose.cueLoss}, want the sour LOSS stab) (#116)`);

  // 2h2d) Your Harbour (#118, DL #4) — the GOVERNOR pole's first reactive verb: CLAIM a home port,
  // then INVEST coin to GROW it. Make landfall, assert the claim is GATED on Standing (locked when
  // poor, open when respected), claim the docked port (earns Standing + a homecoming greeting in the
  // town panel), then invest coin to grow it a level (spends coin, earns Standing, sings a Ballad
  // verse) and persists. Proves the lawful pole now has a real, visible, persisted verb end-to-end.
  const home = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const port = tw.ports[0];
    const [px, pz] = port.pos;
    async function arrive(x, z) {
      tw.qaTeleport(x, z); tw.step(0.1);
      for (let i = 0; i < 80 && !(tw.mode === 'town' && tw.town.open); i++) tw.step(0.1);
    }
    await arrive(px, pz);
    // Gate: a poor captain cannot claim a home port.
    tw.setStanding(0);
    const lockedGate = tw.harbourCanClaim;
    // Earn a respected name, then claim the docked port.
    tw.setStanding(200);
    const openGate = tw.harbourCanClaim;
    const standingBeforeClaim = tw.state.standing;
    const claimRes = tw.claimHarbour();
    const afterClaim = tw.harbour;
    const standingAfterClaim = tw.state.standing;
    const atHome = tw.town.atHome;
    const greetEl = document.querySelector('#town .town-harbour-greet');
    const greetText = greetEl ? greetEl.textContent : '';
    // Invest coin to grow the harbour one level.
    tw.setCoins(5000);
    const investGate = tw.harbourCanInvest;
    const coins0 = tw.state.coins;
    const standing0 = tw.state.standing;
    const investRes = tw.investHarbour();
    const afterInvest = tw.harbour;
    const coinsSpent = coins0 - tw.state.coins;
    const standingGain = tw.state.standing - standing0;
    const hasVerse = tw.voyageLog.some((e) => e.type === 'harbour');
    const investEl = document.querySelector('#town .town-invest');
    // Persist, then prove a fresh voyage clears it (the claim is per-save state).
    tw.save();
    const persisted = tw.harbour;
    tw.newVoyage(); tw.step(0.1);
    const afterNewVoyage = tw.harbour;
    return {
      portName: port.name, lockedGate, openGate, standingBeforeClaim, claimRes, afterClaim,
      standingAfterClaim, atHome, greetText, investGate, investRes, afterInvest, coinsSpent,
      standingGain, hasVerse, investShown: !!investEl, persisted, afterNewVoyage,
    };
  });
  if (home.lockedGate.ok || home.lockedGate.reason !== 'low-standing') fail(`your-harbour: a poor captain was allowed to claim (gate=${JSON.stringify(home.lockedGate)}) (#118)`);
  if (!home.openGate.ok) fail(`your-harbour: a respected captain could not claim a home port (gate=${JSON.stringify(home.openGate)}) (#118)`);
  if (!home.claimRes.ok) fail(`your-harbour: claiming the home port failed (${JSON.stringify(home.claimRes)}) (#118)`);
  if (!home.afterClaim || home.afterClaim.name !== home.portName || home.afterClaim.level !== 1) fail(`your-harbour: the claim did not record a level-1 home harbour (${JSON.stringify(home.afterClaim)}) (#118)`);
  if (!(home.standingAfterClaim > home.standingBeforeClaim)) fail(`your-harbour: claiming did not earn Standing (${home.standingBeforeClaim}→${home.standingAfterClaim}) (#118)`);
  if (!home.atHome) fail('your-harbour: the town did not recognise the docked port as your home (#118)');
  if (!home.greetText || !home.greetText.includes(home.portName)) fail(`your-harbour: no homecoming greeting naming the port in the town panel ("${home.greetText}") (#118)`);
  if (!home.investGate.ok) fail(`your-harbour: could not invest to grow the home harbour (gate=${JSON.stringify(home.investGate)}) (#118)`);
  if (!home.investRes.ok || home.afterInvest.level !== 2) fail(`your-harbour: investing did not grow the harbour a level (${JSON.stringify(home.investRes)}) (#118)`);
  if (!(home.coinsSpent === home.investRes.spent && home.coinsSpent > 0)) fail(`your-harbour: investing did not spend coin (spent=${home.coinsSpent} vs ${home.investRes.spent}) (#118)`);
  if (!(home.standingGain > 0)) fail(`your-harbour: investing did not earn Standing (gain=${home.standingGain}) (#118)`);
  if (!home.hasVerse) fail('your-harbour: claiming/growing the home port did not sing into the Ballad/voyage log (#78/#118)');
  if (!home.investShown) fail('your-harbour: the town panel showed no invest affordance for your home port (#118)');
  if (!home.persisted || home.persisted.level !== 2) fail('your-harbour: the home harbour did not survive a save (#118)');
  if (home.afterNewVoyage) fail('your-harbour: a fresh voyage did not clear the claimed home harbour (#118)');

  // 2h2e) Governorship endgame (#119, DL #4) — the lawful arc's NAMED capstone, the mirror of the
  // pirate legend-crown (#46). Claim a home port, GROW it to its top tier, and climb Standing past
  // the governor gate; the per-frame check (on the #130 registry) must then crown you "Governor of
  // [home isle]": the crown overlay shows, a Ballad verse is sung, your home quay acknowledges its
  // governor, and the title is locked into the save (survives a round-trip, clears on a new voyage).
  const gov = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const port = tw.ports[0];
    const [px, pz] = port.pos;
    tw.qaTeleport(px, pz); tw.step(0.1);
    for (let i = 0; i < 80 && !(tw.mode === 'town' && tw.town.open); i++) tw.step(0.1);
    // Claim, then fund + grow the harbour all the way to its top tier.
    tw.setStanding(200); tw.claimHarbour();
    tw.setCoins(100000);
    let grows = 0;
    for (let i = 0; i < 10 && tw.harbourCanInvest.ok; i++) { tw.investHarbour(); grows++; }
    const topHarbour = tw.harbour;
    // Not yet a governor: at the top tier but Standing below the gate.
    tw.setStanding(50);
    tw.step(0.2);
    const beforeGate = tw.governorship;          // null — the gate isn't met
    const earnableBefore = tw.governorshipEarnable;
    // Climb Standing past the governor gate; the per-frame check crowns you.
    tw.setStanding(1200);
    for (let i = 0; i < 20 && !tw.governorship; i++) tw.step(0.1);
    const crowned = tw.governorship;             // "Governor of <port>"
    const snap = tw.state.governorship;          // the QA snapshot flag
    const overlayShown = document.getElementById('legend')?.classList.contains('show');
    const overlayText = document.getElementById('legend')?.textContent || '';
    const verse = tw.voyageLog.find((e) => e.type === 'governorship') || null;
    const badge = document.getElementById('legend-badge')?.textContent || '';
    const greetEl = document.querySelector('#town .town-harbour-gov');
    const ackText = greetEl ? greetEl.textContent : '';
    // Persist + reload-shape: save, confirm it survives, and a fresh voyage clears it.
    tw.save();
    const persisted = tw.governorship;
    // Re-fire guard: stepping again must NOT re-crown (no duplicate verse).
    tw.step(0.3);
    const verseCount = tw.voyageLog.filter((e) => e.type === 'governorship').length;
    tw.newVoyage(); tw.step(0.1);
    const afterNewVoyage = tw.governorship;
    return {
      portName: port.name, grows, topLevel: topHarbour ? topHarbour.level : 0,
      beforeGate, earnableBefore, crowned, snap, overlayShown, overlayText, verse, badge,
      ackText, persisted, verseCount, afterNewVoyage,
    };
  });
  if (gov.topLevel < 4) fail(`governorship: the home harbour did not grow to its top tier (level=${gov.topLevel}, grows=${gov.grows}) (#119)`);
  if (gov.beforeGate || gov.earnableBefore) fail(`governorship: crowned before the Standing gate was met (title=${gov.beforeGate}) (#119)`);
  if (!gov.crowned || !gov.crowned.includes(gov.portName)) fail(`governorship: the isle did not crown you its governor by name (title=${gov.crowned}) (#119)`);
  if (!gov.snap) fail('governorship: the QA state snapshot did not flag the earned crown (#119)');
  if (!gov.overlayShown) fail('governorship: the crown overlay did not show on earning the governorship (#119)');
  if (!/GOVERNOR/i.test(gov.overlayText) || !gov.overlayText.includes(gov.portName)) fail(`governorship: the overlay did not proclaim the named governorship ("${gov.overlayText.slice(0, 80)}") (#119)`);
  if (!gov.verse || !gov.verse.title.includes(gov.portName)) fail(`governorship: the crown did not sing into the Ballad/voyage log (${JSON.stringify(gov.verse)}) (#78/#119)`);
  if (!gov.badge.includes(gov.portName)) fail(`governorship: the persistent HUD badge does not show the governorship ("${gov.badge}") (#119)`);
  if (!gov.ackText || !gov.ackText.includes(gov.portName)) fail(`governorship: the home quay did not acknowledge its governor on landfall ("${gov.ackText}") (#119)`);
  if (!gov.persisted) fail('governorship: the crown did not survive a save (#119)');
  if (gov.verseCount !== 1) fail(`governorship: the crown re-fired (verseCount=${gov.verseCount}) — it must crown ONCE (#119)`);
  if (gov.afterNewVoyage) fail('governorship: a fresh voyage did not clear the earned governorship (#119)');

  // 2h2t) Your Harbour, threatened (#134, DL #5) — the home port's STAKE. Claim a home port, lean the
  // needle hard toward a pole, make LANDFALL there, and assert a threat is drawn (Infamy→blockade,
  // Standing→raid), warned via a banner/panel; then resolve it BOTH ways: pay tribute (coin spent,
  // threat lifts) and stand firm (the seeded dice — a forced win repels for Standing, a forced loss
  // sacks the harbour a level). Proves the trigger fires off the needle + home state, the panel + the
  // two non-battle resolutions work, and a gathering threat survives a save. No battle #100 implied.
  const threat = await page.evaluate(async () => {
    const tw = window.__tidewake;
    async function landAtHome() {
      tw.newVoyage(); tw.step(0.1);
      const port = tw.ports[0];
      const [px, pz] = port.pos;
      tw.qaTeleport(px, pz); tw.step(0.1);
      for (let i = 0; i < 80 && !(tw.mode === 'town' && tw.town.open); i++) tw.step(0.1);
      tw.setStanding(200); tw.claimHarbour();   // claim the docked port as home
      tw.setCoins(10000);                       // a full purse so the tribute plank shows when threatened
      return port.name;
    }
    // (a) A balanced captain draws NO threat even at home.
    const portName = await landAtHome();
    tw.setInfamy(300); tw.setStanding(300);     // dead-centre needle
    const balanced = tw.harbourThreatEarnable;
    // (b) A hard INFAMY lean → a navy BLOCKADE, drawn on a genuine LANDFALL, warned in the town panel.
    tw.setInfamy(4000); tw.setStanding(0);
    tw.leaveMode(); tw.skipLandfall(); tw.step(0.1);            // back to sea
    tw.qaTeleport(60000, 60000);                                // sail well clear of the harbour mouth so
    for (let i = 0; i < 20; i++) tw.step(0.2);                  // the auto-harbour re-arms (leftHarbour drops)
    tw.qaTeleport(...tw.ports[0].pos); tw.step(0.1);            // ...then come HOME again
    for (let i = 0; i < 80 && !(tw.mode === 'town' && tw.town.open); i++) tw.step(0.1);
    const drawn = tw.harbourThreat;
    const panelShown = tw.town.threatened;
    const blurbEl = document.querySelector('#town .town-threat-blurb');
    const blurbText = blurbEl ? blurbEl.textContent : '';
    const tributeBtn = !!document.querySelector('#town .town-tribute');
    const standBtn = !!document.querySelector('#town .town-standfirm');
    // (c) Pay tribute: coin spent, threat lifts.
    const coinsBefore = tw.state.coins;
    const payRes = tw.payHarbourTribute();
    const coinsSpent = coinsBefore - tw.state.coins;
    const afterPay = tw.harbourThreat;
    // (d) A hard STANDING lean → a pirate RAID.
    tw.setInfamy(0); tw.setStanding(4000);
    const raid = tw.forceHarbourThreat();
    // The dice are seeded; the home port must persist across a losing roll mid-search, so re-claim it
    // if a prior loss overran it (we're still docked at the home port). A strong governor lean draws a
    // fresh raid each attempt; we capture the level right before the deciding roll.
    function ensureThreatenedHome() {
      if (!tw.harbour) { tw.setStanding(300); tw.claimHarbour(); }
      tw.setInfamy(0); tw.setStanding(4000);
      return tw.forceHarbourThreat();
    }
    // (e) Stand firm + WIN (force it): repel for Standing, harbour intact.
    let won = null, standAfterWin = null, harbourAfterWin = null, lvlBeforeWin = 0;
    for (let i = 0; i < 60; i++) {
      if (!ensureThreatenedHome()) continue;
      const lvl = tw.harbour.level, sBefore = tw.state.standing;
      const r = tw.standHarbourFirm();
      if (r.won) { won = r; standAfterWin = tw.state.standing - sBefore; harbourAfterWin = tw.harbour; lvlBeforeWin = lvl; break; }
    }
    // (f) Stand firm + LOSE (force it): the harbour is sacked a level (or a berth is lost outright).
    let lost = null, harbourAfterLoss = null, lvlBeforeLoss = 0;
    for (let i = 0; i < 60; i++) {
      if (!ensureThreatenedHome()) continue;
      const lvl = tw.harbour.level;
      const r = tw.standHarbourFirm();
      if (!r.won) { lost = r; harbourAfterLoss = tw.harbour; lvlBeforeLoss = lvl; break; }
    }
    // (g) A gathering threat survives a save (re-establish a home first — the loss test may have
    // overrun it).
    if (!tw.harbour) { tw.setStanding(300); tw.claimHarbour(); }
    tw.setInfamy(0); tw.setStanding(4000); const survived0 = tw.forceHarbourThreat();
    tw.save(); const persisted = tw.harbourThreat;
    tw.newVoyage();
    for (let i = 0; i < 8; i++) tw.step(0.1);   // ease the reputation-reactive world grade (#126) to neutral
    const afterNewVoyage = tw.harbourThreat;
    // This section leaned the ledger HARD at sea, so the reputation grade (#126) restored the scene to
    // ITS captured sunny baseline — a hair off the day-night system's boot baseline (a pre-existing,
    // imperceptible capture mismatch). Bounce day-night ON→OFF to re-assert that boot baseline byte-for-
    // byte, handing the next tests a pristine scene (test isolation; the mismatch is filed as a follow-up).
    tw.setOption('daynight', true); tw.setOption('daynight', false); tw.step(0.1);
    return {
      portName, balanced, drawn, panelShown, blurbText, tributeBtn, standBtn,
      coinsSpent, payRes, afterPay, raid, lvlBeforeWin, won, standAfterWin, harbourAfterWin,
      lvlBeforeLoss, lost, harbourAfterLoss, survived0, persisted, afterNewVoyage,
    };
  });
  if (threat.balanced) fail(`harbour-threat: a balanced captain drew a threat at home (should be safe at centre) (${JSON.stringify(threat.balanced)}) (#134)`);
  if (!threat.drawn || threat.drawn.kind !== 'blockade') fail(`harbour-threat: a hard-Infamy captain coming home did not draw a navy blockade (${JSON.stringify(threat.drawn)}) (#134)`);
  if (threat.drawn.port !== threat.portName) fail(`harbour-threat: the threat is not against the home port (${JSON.stringify(threat.drawn)}) (#134)`);
  if (!threat.panelShown) fail('harbour-threat: the town did not show the threat panel at the threatened home port (#134)');
  if (!threat.blurbText || !threat.blurbText.includes(threat.portName)) fail(`harbour-threat: no in-town threat framing naming the home port ("${threat.blurbText}") (#134)`);
  if (!threat.tributeBtn || !threat.standBtn) fail(`harbour-threat: the two resolution planks did not render (tribute=${threat.tributeBtn}, standFirm=${threat.standBtn}) (#134)`);
  if (!threat.payRes.ok || !(threat.coinsSpent > 0) || threat.coinsSpent !== threat.payRes.spent) fail(`harbour-threat: paying tribute did not spend the demanded coin (spent=${threat.coinsSpent} vs ${threat.payRes.spent}) (#134)`);
  if (threat.afterPay) fail(`harbour-threat: paying tribute did not lift the threat (${JSON.stringify(threat.afterPay)}) (#134)`);
  if (!threat.raid || threat.raid.kind !== 'raid') fail(`harbour-threat: a hard-Standing captain did not draw a pirate raid (${JSON.stringify(threat.raid)}) (#134)`);
  if (!threat.won || !threat.won.won) fail('harbour-threat: standing firm never produced a win across many seeded rolls (#134)');
  if (!(threat.standAfterWin > 0)) fail(`harbour-threat: repelling a threat did not earn Standing (gain=${threat.standAfterWin}) (#134)`);
  if (!threat.harbourAfterWin || threat.harbourAfterWin.level !== threat.lvlBeforeWin) fail(`harbour-threat: a WON defence changed the harbour level (${threat.lvlBeforeWin}→${threat.harbourAfterWin?.level}) (#134)`);
  if (!threat.lost || threat.lost.won) fail('harbour-threat: standing firm never produced a loss across many seeded rolls (#134)');
  if (!(threat.harbourAfterLoss == null || threat.harbourAfterLoss.level < threat.lvlBeforeLoss)) fail(`harbour-threat: a LOST defence did not sack the harbour a level (${threat.lvlBeforeLoss}→${threat.harbourAfterLoss?.level}) (#134)`);
  if (!threat.survived0 || !threat.persisted || threat.persisted.kind !== threat.survived0.kind) fail(`harbour-threat: a gathering threat did not survive a save (${JSON.stringify(threat.persisted)}) (#134)`);
  if (threat.afterNewVoyage) fail('harbour-threat: a fresh voyage did not clear the gathering threat (#134)');

  // 2h3) Landfall gesture (#102): making port is a crafted, EASED moment, not a snap. Drive the
  // mode transition headlessly and assert the gesture (a) starts under sail (blend 0), (b) eases
  // blend UP over the sim's dt without jumping straight to 1 (deterministic, not wall-clock), (c)
  // only opens the town view once fully ASHORE, (d) is SKIPPABLE to the end, and (e) the reverse
  // eases back down and closes the town. Proves the "transition IS the drama" plays out headless.
  const land = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const atSea = { ...tw.landfall };
    tw.enterMode('town');                 // begin the making-port gesture
    const onStart = { ...tw.landfall };
    tw.step(0.1);                          // one small slice of time in
    const midway = { ...tw.landfall };
    tw.step(0.15);                         // a touch more — blend must keep rising, monotonically
    const later = { ...tw.landfall };
    const eased = later.blend > midway.blend && midway.blend > 0 && midway.blend < 1;
    const townHeldClosed = midway.blend < 1 && !tw.town.open; // town waits until ashore
    const skipped = tw.skipLandfall();    // jump the rest of the gesture
    tw.step(0.1);
    const ashore = { ...tw.landfall, townOpen: tw.town.open };
    tw.leaveMode();                        // Set Sail: the mirror gesture
    tw.step(0.1);                          // a frame for the view to close + the reverse to ease
    const onLeave = { ...tw.landfall, townOpen: tw.town.open };
    tw.skipLandfall(); tw.step(0.1);
    const backAtSea = { ...tw.landfall };
    tw.newVoyage(); tw.step(0.1);
    return { atSea, onStart, midway, later, eased, townHeldClosed, skipped, ashore, onLeave, backAtSea };
  });
  if (land.atSea.phase !== 'idle' || land.atSea.blend !== 0) fail(`landfall: did not boot under sail (phase=${land.atSea.phase} blend=${land.atSea.blend})`);
  if (land.onStart.phase !== 'landing' || !land.onStart.active) fail(`landfall: entering town did not begin the gesture (phase=${land.onStart.phase})`);
  if (!land.eased) fail(`landfall: blend did not EASE up deterministically (mid=${land.midway.blend?.toFixed(3)} → later=${land.later.blend?.toFixed(3)}) — it snapped or stalled`);
  if (!land.townHeldClosed) fail('landfall: the town view opened mid-gesture (should wait until ashore)');
  if (!land.skipped) fail('landfall: the gesture was not skippable');
  if (land.ashore.phase !== 'ashore' || land.ashore.blend !== 1 || !land.ashore.townOpen) fail(`landfall: skip did not land fully ashore with the town open (phase=${land.ashore.phase} blend=${land.ashore.blend} town=${land.ashore.townOpen})`);
  if (land.onLeave.phase !== 'leaving' || land.onLeave.townOpen) fail(`landfall: Set Sail did not begin the reverse + close the town (phase=${land.onLeave.phase} town=${land.onLeave.townOpen})`);
  if (!(land.onLeave.blend < land.ashore.blend)) fail(`landfall: the reverse did not ease back down (blend=${land.onLeave.blend?.toFixed(3)})`);
  if (land.backAtSea.phase !== 'idle' || land.backAtSea.blend !== 0) fail(`landfall: did not settle back under sail (phase=${land.backAtSea.phase} blend=${land.backAtSea.blend})`);
  // Glassy "moored" swell settle (#102 ph2): full open-water swell under sail, eased to a calm
  // glassy value once ashore, restored to full life back at sea. (The "made port" stinger is armed
  // on this same TOWN transition; it fires silently headless and must not throw — the zero-console-
  // errors gate below proves it.)
  if (!(Math.abs(land.atSea.swellScale - 1) < 1e-9)) fail(`landfall: swell not at full life under sail (swellScale=${land.atSea.swellScale})`);
  if (!(land.ashore.swellScale < 0.5)) fail(`landfall: the swell did not settle glassy-calm ashore (swellScale=${land.ashore.swellScale})`);
  if (!(Math.abs(land.backAtSea.swellScale - 1) < 1e-9)) fail(`landfall: the swell did not return to full life back at sea (swellScale=${land.backAtSea.swellScale})`);

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

  // 2j-2) Reputation-reactive world grade (#126, DL #4): the WORLD reflects who you're becoming.
  // A fresh captain sees the sunny default. Drive the ledger infamous → the cast turns colder and
  // lower-key (darker haze, dimmer sun); drive it lawful → warmer and brighter (warmer haze, lifted
  // sun). Return to neutral and the sunny default must restore EXACTLY — proving it composes over
  // day-night (#58) and leaves no residue. Driven deterministically via the QA ledger hooks.
  const grade = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);            // clean slate: neutral, the sunny default
    const neutral = { ...tw.grade };
    tw.setInfamy(2000); tw.setStanding(0);   // a feared pirate
    tw.step(0.1);
    const infamous = { ...tw.grade };
    tw.setInfamy(0); tw.setStanding(2000);   // a respected governor
    tw.step(0.1);
    const lawful = { ...tw.grade };
    tw.newVoyage(); tw.step(0.1);            // back to a neutral ledger
    const restored = { ...tw.grade };
    return { neutral, infamous, lawful, restored };
  });
  const lum = (h) => (((h >> 16) & 0xff) + ((h >> 8) & 0xff) + (h & 0xff)) / 3; // overall key
  const warmth = (h) => ((h >> 16) & 0xff) - (h & 0xff);                        // R - B: >0 warmer
  if (grade.neutral.lean !== 0 || grade.neutral.tinted) fail('rep-grade: a fresh captain is not the sunny neutral default');
  if (grade.infamous.pole !== 'pirate' || !(grade.infamous.lean > 0)) fail(`rep-grade: infamy did not lean pirate (${JSON.stringify(grade.infamous)})`);
  if (grade.lawful.pole !== 'governor' || !(grade.lawful.lean < 0)) fail(`rep-grade: standing did not lean governor (${JSON.stringify(grade.lawful)})`);
  if (!grade.infamous.tinted || !grade.lawful.tinted) fail('rep-grade: a committed captain left no tint on the scene');
  if (!(lum(grade.infamous.haze) < lum(grade.neutral.haze))) fail(`rep-grade: infamous cast is not lower-key/stormier (${grade.infamous.haze} vs ${grade.neutral.haze})`);
  if (!(grade.infamous.sunIntensity < grade.neutral.sunIntensity)) fail('rep-grade: infamous did not lower the sun key (stormy/ominous)');
  if (!(warmth(grade.lawful.haze) > warmth(grade.neutral.haze))) fail(`rep-grade: lawful cast is not warmer (${grade.lawful.haze} vs ${grade.neutral.haze})`);
  if (!(grade.lawful.sunIntensity > grade.neutral.sunIntensity)) fail('rep-grade: lawful did not lift the sun key (golden/prosperous)');
  if (grade.restored.lean !== 0 || grade.restored.tinted) fail('rep-grade: neutral did not clear the tint');
  if (!(grade.restored.haze === grade.neutral.haze)) fail(`rep-grade: neutral did not restore the sunny default exactly (${grade.restored.haze} != ${grade.neutral.haze})`);
  if (!(grade.restored.sunIntensity === grade.neutral.sunIntensity)) fail('rep-grade: neutral did not restore the sunny sun key exactly');

  // 2j-3) Reputation needle (#132, DL #5): the pole made PERSONAL & audible. A fresh captain's needle
  // rests dead-centre; a kill-sized infamy gain swings it toward the pirate pole AND registers a felt
  // shift (a cue key + a personal in-character line); a big standing gain swings it back toward the
  // governor pole. Driven deterministically via the QA ledger hooks; audio is guarded (silent here).
  const needle = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(3);              // clean slate — let the pointer settle dead-centre
    const fresh = { pos: tw.needle.pos, target: tw.needle.target, pole: tw.needle.pole };
    tw.setInfamy(2000); tw.setStanding(0);  // a kill-sized infamy gain → swing toward the pirate pole
    tw.step(2);                             // let the pointer swing
    const pirate = { ...tw.needle };
    tw.setStanding(6000);                    // a big standing gain → swing back toward the governor pole
    tw.step(2);
    const gov = { ...tw.needle };
    return { fresh, pirate, gov };
  });
  if (needle.fresh.target !== 0 || Math.abs(needle.fresh.pos) > 0.001) fail(`rep-needle: a fresh captain's needle is not centred (${JSON.stringify(needle.fresh)})`);
  if (!(needle.pirate.target > 0.5) || !(needle.pirate.pos > 0.3) || needle.pirate.pole !== 'pirate') fail(`rep-needle: an infamy gain did not swing the needle toward the pirate pole (${JSON.stringify(needle.pirate)})`);
  if (!needle.pirate.last || needle.pirate.last.pole !== 'pirate' || !(needle.pirate.last.delta > 0)) fail(`rep-needle: an infamy gain registered no felt shift (${JSON.stringify(needle.pirate.last)})`);
  if (needle.pirate.last.cue !== 'rep-pirate' || !needle.pirate.last.line) fail(`rep-needle: the shift carried no audio cue / personal line (${JSON.stringify(needle.pirate.last)})`);
  if (!(needle.gov.target < 0) || needle.gov.pole !== 'governor') fail(`rep-needle: a standing gain did not swing the needle back toward the governor pole (${JSON.stringify(needle.gov)})`);
  if (!needle.gov.last || needle.gov.last.pole !== 'governor' || needle.gov.last.cue !== 'rep-governor') fail(`rep-needle: the governor shift did not register a cue (${JSON.stringify(needle.gov.last)})`);

  // 2j-4) Your ship wears your legend (#132 Slice A, DL #5): the SAME needle, now on the player's OWN
  // ship. A fresh captain sails the untouched honest sloop (white colour-multiplier, no glow). Drive
  // the ledger infamous → the canvas + timber grime and darken (lower-luminance colour) and roughen;
  // drive it lawful → the sails brighten (warmer colour) and a soft trim glow lights up. Return to a
  // neutral ledger and the untouched ship must restore EXACTLY. Uniform writes only — asserts via the
  // ACTUAL applied materials, deterministically through the QA ledger hooks.
  const aura = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);            // clean slate: neutral, the honest sloop
    const neutral = { ...tw.aura, sail: { ...tw.aura.sail }, hull: { ...tw.aura.hull } };
    tw.setInfamy(2000); tw.setStanding(0);   // a feared pirate
    tw.step(0.1);
    const infamous = { ...tw.aura, sail: { ...tw.aura.sail }, hull: { ...tw.aura.hull } };
    tw.setInfamy(0); tw.setStanding(2000);   // a respected governor
    tw.step(0.1);
    const lawful = { ...tw.aura, sail: { ...tw.aura.sail }, hull: { ...tw.aura.hull } };
    tw.newVoyage(); tw.step(0.1);            // back to a neutral ledger
    const restored = { ...tw.aura, sail: { ...tw.aura.sail }, hull: { ...tw.aura.hull } };
    return { neutral, infamous, lawful, restored };
  });
  const aLum = (h) => (((h >> 16) & 0xff) + ((h >> 8) & 0xff) + (h & 0xff)) / 3;
  const aWarm = (h) => ((h >> 16) & 0xff) - (h & 0xff);
  if (!aura.neutral.applied) fail('ship-aura: the hero ship exposed no sail/hull material to cast (#132 Slice A)');
  if (aura.neutral.lean !== 0 || aura.neutral.pole !== 'neutral') fail(`ship-aura: a fresh captain is not the neutral honest sloop (${JSON.stringify(aura.neutral)})`);
  if (aura.neutral.sail.color !== 0xffffff || aura.neutral.hull.color !== 0xffffff) fail(`ship-aura: neutral ship is not the untouched white-multiplier identity (${JSON.stringify(aura.neutral)})`);
  if (aura.neutral.sail.emissiveIntensity !== 0) fail('ship-aura: the neutral ship should not glow');
  if (aura.infamous.pole !== 'pirate' || !(aura.infamous.lean > 0)) fail(`ship-aura: infamy did not cast pirate (${JSON.stringify(aura.infamous)})`);
  if (!(aLum(aura.infamous.sail.color) < aLum(aura.neutral.sail.color))) fail('ship-aura: an infamous canvas did not grime/darken');
  if (!(aLum(aura.infamous.hull.color) < aLum(aura.neutral.hull.color))) fail('ship-aura: an infamous hull did not weather/darken');
  if (!(aura.infamous.sail.roughness >= aura.neutral.sail.roughness)) fail('ship-aura: an infamous canvas un-roughened (grime reads via darkening + matte)');
  if (aura.infamous.sail.emissiveIntensity !== 0) fail('ship-aura: a feared ship must not glow');
  if (aura.lawful.pole !== 'governor' || !(aura.lawful.lean < 0)) fail(`ship-aura: standing did not cast governor (${JSON.stringify(aura.lawful)})`);
  if (!(aWarm(aura.lawful.sail.color) > aWarm(aura.neutral.sail.color))) fail('ship-aura: a lawful canvas did not warm/brighten');
  if (!(aura.lawful.sail.emissiveIntensity > 0)) fail('ship-aura: a respected ship did not light its trim glow');
  if (!(aura.lawful.sail.roughness < aura.neutral.sail.roughness)) fail('ship-aura: a lawful canvas did not sheen (smoother/cared-for)');
  if (aura.restored.sail.color !== aura.neutral.sail.color || aura.restored.sail.emissiveIntensity !== aura.neutral.sail.emissiveIntensity) fail(`ship-aura: a neutral ledger did not restore the untouched ship exactly (${JSON.stringify(aura.restored)})`);

  // 2j-5) The harmonic reputation needle (#132 Slice B, DL #5): the SAME signed lean, now AUDIBLE. The
  // procedural bed's lead recolours its MODE off repLean — a fresh captain hears the honest D-major
  // Ionian (blend 0); an infamous ledger leans the lead into a freygish "bite" (flat-2 → scale[1]===1);
  // a lawful ledger brightens it to a warm Lydian voicing (raised-4 → scale[3]===6); a neutral ledger
  // restores Ionian exactly. AudioContext-free here (no gesture → the music engine never starts): the
  // recolour CAST is set from the lean every frame regardless, so it asserts headless via tw.harmony.
  const harmony = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);            // clean slate: neutral, the honest hornpipe
    const neutral = { ...tw.harmony, scale: [...tw.harmony.scale] };
    tw.setInfamy(2000); tw.setStanding(0);   // a feared pirate
    tw.step(0.1);
    const infamous = { ...tw.harmony, scale: [...tw.harmony.scale] };
    tw.setInfamy(0); tw.setStanding(2000);   // a respected governor
    tw.step(0.1);
    const lawful = { ...tw.harmony, scale: [...tw.harmony.scale] };
    tw.newVoyage(); tw.step(0.1);            // back to a neutral ledger
    const restored = { ...tw.harmony, scale: [...tw.harmony.scale] };
    return { neutral, infamous, lawful, restored };
  });
  if (harmony.neutral.pole !== 'neutral' || harmony.neutral.blend !== 0) fail(`harmony: a fresh captain is not the neutral Ionian bed (${JSON.stringify(harmony.neutral)})`);
  if (harmony.neutral.scale[3] !== 5 || harmony.neutral.scale[1] !== 2) fail(`harmony: the neutral bed is not the honest D-major Ionian (${JSON.stringify(harmony.neutral.scale)})`);
  if (harmony.infamous.pole !== 'pirate' || !(harmony.infamous.blend > 0)) fail(`harmony: an infamous ledger did not recolour the lead toward the bite (${JSON.stringify(harmony.infamous)})`);
  if (harmony.infamous.scale[1] !== 1 || harmony.infamous.scale[5] !== 8) fail(`harmony: the infamous voicing is not freygish/phrygian-dominant (flat-2 + flat-6) (${JSON.stringify(harmony.infamous.scale)})`);
  if (harmony.lawful.pole !== 'governor' || !(harmony.lawful.blend > 0)) fail(`harmony: a lawful ledger did not brighten the lead (${JSON.stringify(harmony.lawful)})`);
  if (harmony.lawful.scale[3] !== 6) fail(`harmony: the lawful voicing is not the warm raised-4th Lydian (${JSON.stringify(harmony.lawful.scale)})`);
  if (harmony.restored.pole !== 'neutral' || harmony.restored.blend !== 0 || harmony.restored.scale[3] !== 5) fail(`harmony: a neutral ledger did not restore the honest Ionian bed exactly (${JSON.stringify(harmony.restored)})`);

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

  // 2l) The Ballad of Your Voyage (#78): the anecdote factory. A brand-new captain's ballad
  // reads "yet unwritten"; after a real deed (sink a nearby ship), the log accrues a cannon
  // entry, the composed ballad names the foe, the panel opens via the QA hook, and the deed
  // PERSISTS across a reload. Drives it through tw.voyageLog / tw.ballad / openBallad.
  const ballad = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    tw.newVoyage(); tw.step(0.1);
    const fresh = { log: tw.voyageLog.length, text: tw.ballad };
    // Sail to the nearest NPC and sink her with cannons (a guaranteed broadside-spam win).
    function nearest() {
      const s = tw.state.pos;
      let best = null, bd = Infinity;
      for (const n of tw.npcs) { const dx = n.pos[0] - s[0], dz = n.pos[1] - s[2]; const d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = n; } }
      return { best, bd };
    }
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
    let foeName = null;
    if (engaged) {
      foeName = tw.cannons.foeName;
      for (let r = 0; r < 20 && tw.cannons.active; r++) tw.cannonFire(0);
    }
    tw.step(0.2);
    const afterFight = { engaged, foeName, log: tw.voyageLog.length, hasCannonDeed: tw.voyageLog.some((e) => e.type === 'cannon'), text: tw.ballad };
    // The panel opens + shows the ballad text via the QA hook.
    const opened = tw.openBallad();
    const panel = document.getElementById('ballad-panel');
    const panelShown = !!panel && panel.classList.contains('show') && (panel.textContent || '').includes('Ballad');
    tw.closeBallad();
    tw.save();
    return { fresh, afterFight, opened, panelShown };
  });
  if (!(ballad.fresh.log === 0)) fail(`ballad: a brand-new voyage should have an empty log (got ${ballad.fresh.log})`);
  if (!ballad.fresh.text.includes('yet unwritten')) fail('ballad: a fresh voyage should read "yet unwritten"');
  if (ballad.afterFight.engaged) {
    if (!ballad.afterFight.hasCannonDeed) fail('ballad: a won cannon fight did not record a deed in the voyage log');
    if (ballad.afterFight.foeName && !ballad.afterFight.text.includes(ballad.afterFight.foeName)) fail(`ballad: the composed ballad does not name the sunk foe "${ballad.afterFight.foeName}"`);
    if (!ballad.opened) fail('ballad: panel did not report open via tw.openBallad()');
    if (!ballad.panelShown) fail('ballad: #ballad-panel did not become visible / show the ballad text');
  }
  // Reload: the recorded deed must persist so the Ballad survives a reload.
  if (ballad.afterFight.engaged) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
    const persistedBallad = await page.evaluate(() => ({ log: window.__tidewake.voyageLog.length, hasCannonDeed: window.__tidewake.voyageLog.some((e) => e.type === 'cannon') }));
    if (!persistedBallad.hasCannonDeed) fail(`ballad: the recorded deed did not persist across a reload (log=${persistedBallad.log})`);
  }

  // 2m) False Colours (#79): flag deception as a verb. Two halves, both deterministic:
  //   • NPC REACTION to the colours SHOWN — a feared captain under true black colours makes
  //     vessels FLEE; under false merchant colours the disguise works and they stay calm.
  //   • The TREACHERY payoff — creep up under false colours, open fire, and the win pays a
  //     bonus to Infamy and records a perfidy verse for the Ballad (#78). The pure flee/bonus
  //     math is unit-tested; here we drive the live wiring through the QA hook.
  const falseColours = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearest() {
      const s = tw.state.pos; // [x, y, z]
      let best = null, bd = Infinity;
      for (const n of tw.npcs) { const dx = n.pos[0] - s[0], dz = n.pos[1] - s[2]; const d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = n; } }
      return { best, bd };
    }
    tw.newVoyage(); tw.step(0.1);
    const fresh = { id: tw.colours.id, deceptive: tw.colours.deceptive };

    // Make the captain feared — but kept BELOW the seen-through floor (#91) so the disguise here
    // stays a reliable free pass; the high-Infamy "rumbled" risk is exercised in section 2n.
    tw.setInfamy(800);
    tw.setColours('black');
    const blackFlee = tw.colours.flee;     // true — the world fears the dread captain
    tw.setColours('merchant');
    const merchantFlee = tw.colours.flee;  // false — the disguise calms them

    // Under TRUE black colours + feared: sail at the nearest NPC and confirm a vessel flees.
    tw.setColours('black');
    tw.press('w');
    let sawFlee = false;
    for (let i = 0; i < 2500 && !sawFlee; i++) {
      const { best } = nearest(); if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      sawFlee = tw.npcs.some((n) => n.fleeing);
    }
    tw.release('w'); tw.release('a'); tw.release('d');

    // Under FALSE merchant colours: creep up (they stay calm), get in range, then open fire.
    tw.setColours('merchant');
    tw.step(0.3); // let the NPC AI refresh — clears any stale flee flags from the black phase
    const infamyBefore = tw.state.infamy;
    tw.press('w');
    let engaged = false, foeName = null, treacheryAtEngage = false, fledWhileDisguised = false;
    for (let i = 0; i < 2500 && !engaged; i++) {
      const { best, bd } = nearest(); if (!best) break;
      if (tw.npcs.some((n) => n.fleeing)) fledWhileDisguised = true;
      if (bd <= 180) { engaged = tw.openFire(); if (engaged) { treacheryAtEngage = tw.cannons.treachery; foeName = tw.cannons.foeName; } break; }
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    let result = null;
    if (engaged) for (let r = 0; r < 20 && tw.cannons.active; r++) { tw.cannonFire(0); result = tw.cannons.result; }
    tw.step(0.2);
    const infamyGain = tw.state.infamy - infamyBefore;
    const hasTreacheryDeed = tw.voyageLog.some((e) => e.type === 'cannon' && e.treachery === true);
    const balladHasTreachery = /merchant colours|treachery/i.test(tw.ballad);

    tw.newVoyage(); tw.step(0.1);
    tw.setColours('merchant'); // leave the disguise up so the gallery shot shows the chip
    return { fresh, blackFlee, merchantFlee, sawFlee, engaged, fledWhileDisguised, treacheryAtEngage, foeName, result, infamyGain, hasTreacheryDeed, balladHasTreachery };
  });
  if (falseColours.fresh.id !== 'black') fail(`false colours: a fresh voyage should fly black (got ${falseColours.fresh.id})`);
  if (falseColours.fresh.deceptive) fail('false colours: true black colours should not be a disguise');
  if (!falseColours.blackFlee) fail('false colours: a feared captain under true black colours should make NPCs flee');
  if (falseColours.merchantFlee) fail('false colours: false merchant colours should NOT make NPCs flee (the disguise works)');
  if (!falseColours.sawFlee) fail('false colours: no NPC fled the dread captain flying true black colours');
  if (falseColours.engaged) {
    if (falseColours.fledWhileDisguised) fail('false colours: an NPC fled while we approached under a disguise (the disguise failed)');
    if (!falseColours.treacheryAtEngage) fail('false colours: opening fire under false colours was not flagged as treachery');
    if (falseColours.result !== 'win') fail(`false colours: the treacherous attack did not resolve to a win (result=${falseColours.result})`);
    if (!(falseColours.infamyGain > 0)) fail(`false colours: the treacherous win awarded no infamy (gain=${falseColours.infamyGain})`);
    if (!falseColours.hasTreacheryDeed) fail('false colours: the treacherous strike did not record a treachery deed in the voyage log');
    if (!falseColours.balladHasTreachery) fail('false colours: the ballad did not sing the false-colours verse');
  }

  // 2n) Letters of Marque (#91): the LAWFUL pole + the seen-through risk — the opposing mirror
  // of #79. Two halves, both deterministic:
  //   • LAWFUL PRIVATEERING — under your TRUE colours, hunt a PIRATE vessel and the win pays
  //     STANDING (the governor pole), not just Infamy. (Innocent merchants are spared — fined,
  //     not rewarded; that's covered by the unit tests.)
  //   • SEEN-THROUGH — at high Infamy a false-colours approach is rumbled on a seeded roll: the
  //     vessel reads your true renown and flees, so the bluff is a real risk at the top.
  const marque = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    function nearestOfKind(kind) {
      const s = tw.state.pos; // [x, y, z]
      let best = null, bd = Infinity;
      for (const n of tw.npcs) {
        if (kind && n.kind !== kind) continue;
        const dx = n.pos[0] - s[0], dz = n.pos[1] - s[2]; const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = n; }
      }
      return { best, bd };
    }

    // --- LAWFUL pirate-hunt under TRUE colours ---
    tw.newVoyage(); tw.step(0.1);
    tw.setColours('black');        // honest colours = lawful service
    tw.setInfamy(0);               // low infamy so the pirate doesn't flee — we can run her down
    const fleetKinds = tw.npcs.map((n) => n.kind);
    const standingBefore = tw.state.standing;
    tw.press('w');
    let engaged = false, targetKind = null;
    for (let i = 0; i < 3000 && !engaged; i++) {
      const { best, bd } = nearestOfKind('pirate'); if (!best) break;
      if (bd <= 180) { engaged = tw.openFire(); if (engaged) { targetKind = tw.cannons.targetKind; } break; }
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    let result = null;
    if (engaged) for (let r = 0; r < 20 && tw.cannons.active; r++) { tw.cannonFire(0); result = tw.cannons.result; }
    tw.step(0.2);
    const standingGain = tw.state.standing - standingBefore;
    const hasLawfulDeed = tw.voyageLog.some((e) => e.type === 'cannon' && e.lawful === true);
    const balladHasLawful = /pirate|outlaw|lawful|privateer/i.test(tw.ballad);
    const lawful = { engaged, targetKind, result, standingGain, hasLawfulDeed, balladHasLawful };

    // --- SEEN-THROUGH at high Infamy under FALSE colours ---
    tw.newVoyage(); tw.step(0.1);
    tw.setInfamy(5000);            // notorious — the disguise is now risky
    tw.setColours('merchant');
    const chanceHigh = tw.colours.seenThroughChance; // rises with infamy, capped < 1
    tw.press('w');
    let sawSeenThrough = false, fled = false;
    for (let i = 0; i < 2500 && !sawSeenThrough; i++) {
      const { best, bd } = nearestOfKind(null); if (!best) break;
      const s = tw.state;
      const desired = Math.atan2(best.pos[0] - s.pos[0], best.pos[1] - s.pos[2]);
      const err = norm(desired - s.heading);
      tw.release('a'); tw.release('d');
      if (err > 0.05) tw.press('a'); else if (err < -0.05) tw.press('d');
      tw.step(0.1);
      if (tw.colours.seenThrough) sawSeenThrough = true;
      if (tw.npcs.some((n) => n.fleeing)) fled = true;
    }
    tw.release('w'); tw.release('a'); tw.release('d');
    const seen = { chanceHigh, sawSeenThrough, fled };

    tw.newVoyage(); tw.step(0.1);
    return { fleetKinds, lawful, seen };
  });
  // The fleet carries both a pirate to hunt and a merchant to spare (the lawful path is meaningful).
  if (!marque.fleetKinds.includes('pirate')) fail('letters of marque: no pirate vessel in the fleet to hunt lawfully');
  if (marque.lawful.engaged) {
    if (marque.lawful.targetKind !== 'pirate') fail(`letters of marque: lawful test did not engage a pirate (kind=${marque.lawful.targetKind})`);
    if (marque.lawful.result !== 'win') fail(`letters of marque: the lawful pirate-hunt did not resolve to a win (result=${marque.lawful.result})`);
    if (!(marque.lawful.standingGain > 0)) fail(`letters of marque: hunting a pirate under true colours awarded no Standing (gain=${marque.lawful.standingGain})`);
    if (!marque.lawful.hasLawfulDeed) fail('letters of marque: the lawful pirate-hunt did not record a lawful deed in the voyage log');
    if (!marque.lawful.balladHasLawful) fail('letters of marque: the ballad did not sing the lawful privateer verse');
  } else {
    fail('letters of marque: never engaged a pirate to prove the lawful Standing path');
  }
  // Seen-through: the chance must be a real, sub-certain risk at high infamy, and it must fire.
  if (!(marque.seen.chanceHigh > 0)) fail(`seen-through: a notorious captain's disguise should be at risk (chance=${marque.seen.chanceHigh})`);
  if (!(marque.seen.chanceHigh < 1)) fail(`seen-through: the bluff should never be a dead certainty (chance=${marque.seen.chanceHigh})`);
  if (!marque.seen.sawSeenThrough) fail('seen-through: a notorious captain under false colours was never rumbled on approach');
  if (!marque.seen.fled) fail('seen-through: a rumbled disguise did not make the vessel react to true renown (flee)');

  // 2o) Living sea fauna (#97): a small instanced gull flock keeps the ship company — the sky
  // is alive. Assert the flock exists + is drawn at the start, then sail for a few seconds and
  // confirm the flock CENTRE tracks the player (the reactive verb: the world wheels with you).
  // It's one InstancedMesh, so the global perf-budget gate below proves it stays nearly free.
  const fauna = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.2);
    const start = tw.fauna;
    const shipStart = tw.state.pos.slice();
    tw.press('w'); tw.step(4); tw.release('w');   // sail a while
    const moved = tw.fauna;
    const shipEnd = tw.state.pos.slice();
    tw.newVoyage(); tw.step(0.1);
    return {
      count: start.count,
      visibleAtStart: start.visible,
      hasCenter: Array.isArray(start.center) && start.center.length === 2,
      centerShift: Math.hypot(moved.center[0] - start.center[0], moved.center[1] - start.center[1]),
      shipShift: Math.hypot(shipEnd[0] - shipStart[0], shipEnd[2] - shipStart[2]),
    };
  });
  if (!(fauna.count > 0)) fail(`fauna: no gulls in the flock (count=${fauna.count})`);
  if (!fauna.visibleAtStart) fail('fauna: the flock was not drawn at the start (should be wheeling over the ship)');
  if (!fauna.hasCenter) fail('fauna: flock centre not exposed via tw.fauna.center');
  // The flock follows the player: as the ship sails away, the flock centre eases after it.
  if (!(fauna.shipShift > 20)) fail(`fauna: ship did not actually sail (shift=${fauna.shipShift?.toFixed(1)})`);
  if (!(fauna.centerShift > 5)) fail(`fauna: the flock did not track the player as they sailed (centreShift=${fauna.centerShift?.toFixed(1)})`);

  // 2o') Living sea fauna phase 2 — jumping dolphins (#110): a small instanced pod that
  // occasionally surfaces and ARCS alongside the moving ship, then slips back under. Sail under
  // way and confirm a breach fires on the seeded schedule, a dolphin actually rises above water
  // (surfaces mid-arc), and the pod is drawn only while active (0 draws between appearances). It's
  // one InstancedMesh, so the global perf-budget gate below proves the pod stays nearly free.
  const dolphins = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.2);
    tw.press('w'); tw.step(2);                  // get under way (speed ≥ the sail threshold)
    const podSize = tw.fauna.dolphins;
    let maxProgress = 0, sawSurfaced = false, sawDrawn = false, sawHiddenAfter = false;
    let breaches = 0;
    for (let i = 0; i < 320; i++) {             // up to ~32s of stepped sailing
      tw.step(0.1);
      const p = tw.fauna.pod;
      breaches = p.breaches;
      if (p.active) { maxProgress = Math.max(maxProgress, p.progress); }
      if (p.surfaced) sawSurfaced = true;
      if (p.drawn) sawDrawn = true;
      if (breaches > 0 && !p.active) sawHiddenAfter = true; // despawned cleanly after a breach
      if (breaches > 0 && sawSurfaced && sawHiddenAfter) break;
    }
    tw.release('w');
    tw.newVoyage(); tw.step(0.1);
    return { podSize, breaches, maxProgress, sawSurfaced, sawDrawn, sawHiddenAfter };
  });
  if (!(dolphins.podSize > 0)) fail(`dolphins: empty pod (size=${dolphins.podSize})`);
  if (!(dolphins.breaches > 0)) fail('dolphins: no pod surfaced while sailing (a breach should fire on schedule)');
  if (!dolphins.sawSurfaced) fail('dolphins: no dolphin ever rose above the waterline (no breach arc)');
  if (!dolphins.sawDrawn) fail('dolphins: the pod mesh was never drawn during a breach');
  if (!dolphins.sawHiddenAfter) fail('dolphins: the pod did not despawn cleanly after its breach (0 draws between)');

  // 2p) CC0 Pirate Kit port dressing (#101): each port is dressed with instanced barrels,
  // crates & palms, and far clusters are distance-culled. Prove props were placed, that
  // teleporting just off a port draws its cluster, and that the far open sea culls to zero.
  const props = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const all = tw.props;
    // Sail far from every port → all clusters culled.
    tw.qaTeleport(8000, 8000); tw.step(0.1);
    const farAway = tw.props.visible;
    // Drop just off the first port (within cull, outside the dock radius) → its cluster draws.
    const p = tw.ports[0].pos;
    tw.qaTeleport(p[0] + 150, p[1]); tw.step(0.1);
    const nearPort = tw.props.visible;
    tw.newVoyage(); tw.step(0.1);
    return { count: all.count, clusters: all.clusters, farAway, nearPort };
  });
  if (!(props.count > 0)) fail(`props: no port dressing placed (count=${props.count})`);
  if (!(props.clusters > 0)) fail(`props: no port clusters built (clusters=${props.clusters})`);
  if (props.farAway !== 0) fail(`props: far clusters not culled (visible=${props.farAway} at open sea)`);
  if (!(props.nearPort > 0)) fail(`props: dressing not drawn near a port (visible=${props.nearPort})`);

  // 2q) Islands TLC (#71): every isle now has a deterministic FACE — a hue-jittered sand tone, a
  // varied silhouette (squash + tall/peak) and an instanced dressing scatter (rocks/palms/etc).
  // Assert the archipelago is varied + dressed, then RELOAD and confirm the look is byte-stable
  // (an isle is the same place every voyage — it must pair with the named-island lore #19).
  const islandStyle = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const styles = tw.islandStyles;
    const sig = (s) => `${s.index}|${s.sand.h.toFixed(4)}:${s.sand.l.toFixed(4)}|${s.sx}:${s.sz}:${s.tall}:${s.peak}|r${s.props.rock || 0}p${s.props.palm || 0}d${s.props.driftwood || 0}t${s.props.tuft || 0}`;
    return {
      count: styles.length,
      allDressed: styles.length > 0 && styles.every((s) => (s.props.rock || 0) > 0 && (s.props.palm || 0) > 0),
      distinctTones: new Set(styles.map((s) => `${s.sand.h.toFixed(3)}:${s.sand.l.toFixed(3)}`)).size,
      distinctShapes: new Set(styles.map((s) => `${s.sx}:${s.sz}:${s.tall}`)).size,
      signature: styles.map(sig).join(';'),
    };
  });
  if (!(islandStyle.count > 0)) fail('islands TLC: no per-isle styles exposed via tw.islandStyles (#71)');
  if (!islandStyle.allDressed) fail('islands TLC: not every isle carries dressing (rocks + palms) (#71)');
  if (!(islandStyle.distinctTones >= Math.min(5, islandStyle.count))) fail(`islands TLC: sand tones not varied enough (${islandStyle.distinctTones} distinct of ${islandStyle.count}) (#71)`);
  if (!(islandStyle.distinctShapes >= Math.min(5, islandStyle.count))) fail(`islands TLC: silhouettes not varied enough (${islandStyle.distinctShapes} distinct of ${islandStyle.count}) (#71)`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const islandStylePersist = await page.evaluate(() => {
    const tw = window.__tidewake;
    const sig = (s) => `${s.index}|${s.sand.h.toFixed(4)}:${s.sand.l.toFixed(4)}|${s.sx}:${s.sz}:${s.tall}:${s.peak}|r${s.props.rock || 0}p${s.props.palm || 0}d${s.props.driftwood || 0}t${s.props.tuft || 0}`;
    return tw.islandStyles.map(sig).join(';');
  });
  if (islandStylePersist !== islandStyle.signature) fail('islands TLC: an isle\'s look changed across a reload — it must be deterministic/stable (#71)');

  // 2r) Emergent at-sea encounter (#125, DL#4): a foundering ship, RESCUE vs PLUNDER. The whole
  // moral beat must be REAL state end-to-end: a deterministic spawn raises a founderer + presents
  // the choice; choosing RESCUE pays the GOVERNOR pole (Standing) and PLUNDER pays the PIRATE pole
  // (Infamy + coin); each despawns cleanly and sings its own Ballad verse. Driven through the QA
  // spawn hook (deterministic + headless-safe) so it never depends on sailing a fixed distance.
  const encounter = await page.evaluate(async () => {
    const tw = window.__tidewake;
    // RESCUE → Standing, no coin/infamy, a grateful Ballad verse naming the ship.
    tw.newVoyage(); tw.step(0.1);
    const spawned = tw.encounterSpawn();
    const live = tw.encounter;
    const standingBefore = tw.state.standing, coinsBeforeR = tw.state.coins, infamyBeforeR = tw.state.infamy;
    const rescueShip = live.name;
    const rescue = tw.encounterChoose('rescue');
    tw.step(0.1);
    const afterRescue = {
      active: tw.encounter.active,
      standingGain: tw.state.standing - standingBefore,
      coinDelta: tw.state.coins - coinsBeforeR,
      infamyDelta: tw.state.infamy - infamyBeforeR,
      balladHasShip: rescueShip && tw.ballad.includes(rescueShip),
    };
    // PLUNDER → coin + Infamy, no Standing, a colder verse.
    tw.newVoyage(); tw.step(0.1);
    tw.encounterSpawn();
    const plunderLive = tw.encounter;
    const coinsBeforeP = tw.state.coins, infamyBeforeP = tw.state.infamy, standingBeforeP = tw.state.standing;
    const plunderShip = plunderLive.name;
    const plunder = tw.encounterChoose('plunder');
    tw.step(0.1);
    const afterPlunder = {
      active: tw.encounter.active,
      coinGain: tw.state.coins - coinsBeforeP,
      infamyGain: tw.state.infamy - infamyBeforeP,
      standingDelta: tw.state.standing - standingBeforeP,
      balladHasShip: plunderShip && tw.ballad.includes(plunderShip),
    };
    // The reward + deed must survive a save round-trip (the Ballad verse persists).
    tw.save();
    tw.newVoyage(); tw.step(0.1);
    return {
      spawned, liveActive: live.active, liveInRange: live.inRange, liveName: live.name,
      rescue, afterRescue, plunder, afterPlunder,
    };
  });
  if (!encounter.spawned || !encounter.liveActive) fail('encounter: the QA spawn hook did not raise a founderer (#125)');
  if (!encounter.liveName) fail('encounter: a spawned founderer had no name (#125)');
  if (!encounter.liveInRange) fail('encounter: a fresh founderer should spawn within the choice range (#125)');
  // RESCUE → governor pole only.
  if (!encounter.rescue || encounter.rescue.pole !== 'governor') fail(`encounter: rescue did not resolve to the governor pole (${JSON.stringify(encounter.rescue)}) (#125)`);
  if (!(encounter.afterRescue.standingGain > 0)) fail(`encounter: rescue did not award Standing (gain=${encounter.afterRescue.standingGain}) (#125)`);
  if (encounter.afterRescue.coinDelta !== 0 || encounter.afterRescue.infamyDelta !== 0) fail(`encounter: rescue should not pay coin/infamy (coin=${encounter.afterRescue.coinDelta}, infamy=${encounter.afterRescue.infamyDelta}) (#125)`);
  if (encounter.afterRescue.active) fail('encounter: the founderer did not despawn after the rescue choice (#125)');
  if (!encounter.afterRescue.balladHasShip) fail('encounter: the rescue did not sing into the Ballad by name (#125/#78)');
  // PLUNDER → pirate pole only.
  if (!encounter.plunder || encounter.plunder.pole !== 'pirate') fail(`encounter: plunder did not resolve to the pirate pole (${JSON.stringify(encounter.plunder)}) (#125)`);
  if (!(encounter.afterPlunder.coinGain > 0)) fail(`encounter: plunder did not award coin (gain=${encounter.afterPlunder.coinGain}) (#125)`);
  if (!(encounter.afterPlunder.infamyGain > 0)) fail(`encounter: plunder did not award Infamy (gain=${encounter.afterPlunder.infamyGain}) (#125)`);
  if (encounter.afterPlunder.standingDelta !== 0) fail(`encounter: plunder should not pay Standing (gain=${encounter.afterPlunder.standingDelta}) (#125)`);
  if (encounter.afterPlunder.active) fail('encounter: the founderer did not despawn after the plunder choice (#125)');
  if (!encounter.afterPlunder.balladHasShip) fail('encounter: the plunder did not sing into the Ballad by name (#125/#78)');

  // 2s) Resource-conservation invariant + transition-frame perf (#121, DL#4 hardening). The leak
  // class that draw/tri budgets and the settled-frame gate (#108) cannot see: a mesh/material/
  // geometry that is BUILT on a mode transition but never DISPOSED on the way back, growing
  // unbounded across repeated transitions. This drives an N×N cycle over every LEGAL mode edge
  // (SAILING↔TOWN↔BATTLE) plus the full landfall enter/leave gesture, and asserts the renderer's
  // own tracked GEOMETRY + TEXTURE counts (renderer.info.memory) return to their settled baseline
  // — no growth — and that the worst TRANSITION-frame perf sample (the enter/leave instant, where
  // a future mesh-heavy battle #100 would build while another mode tears down) stays in budget.
  // Today the modes build no per-mode meshes, so this is GREEN: it is the oracle standing in front
  // of the parked slice-4 disposal (#106), so mesh-heavy battle is safe to land behind a teeth-
  // bearing gate. enter/leave drive mode.subscribe — the exact seam #100 will hook build/teardown
  // into — so the day a transition leaks a geometry, THIS catches it before it ships.
  const leak = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const STEP = 1 / 60;
    // Run the full landfall gesture to completion (deterministic dt, never wall-clock). The ship
    // sits still (throttle released) so it can't sail into a port and auto-trigger a fresh edge.
    const runGesture = (untilTownReady) => {
      for (let i = 0; i < 120; i++) {
        if (untilTownReady ? tw.landfall.townReady : !tw.landfall.active) break;
        tw.step(STEP);
      }
    };
    const settleToSailing = () => { tw.leaveMode(); runGesture(false); };
    // One pass over every legal edge, rendering each enter/leave INSTANT (where a build/teardown
    // lands) and tracking the worst transition-frame perf seen. Battle is toggled WITHOUT a sim
    // step so the "auto-leave when not fighting" wiring in update() can't race the toggle.
    let worst = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
    const sample = (p) => { if (p.drawCalls > worst.drawCalls) worst = { drawCalls: p.drawCalls, triangles: p.triangles, geometries: p.geometries, textures: p.textures }; };
    function cyclePass() {
      tw.enterMode('town'); sample(tw.qaRender()); // SAILING→TOWN: landfall begins
      runGesture(true); sample(tw.qaRender());      // …ashore
      tw.leaveMode(); sample(tw.qaRender());         // TOWN→SAILING: set sail
      runGesture(false);
      tw.enterMode('battle'); sample(tw.qaRender()); // SAILING→BATTLE
      tw.leaveMode(); sample(tw.qaRender());          // BATTLE→SAILING
      tw.enterMode('town'); sample(tw.qaRender());    // SAILING→TOWN
      tw.enterMode('battle'); sample(tw.qaRender());  // TOWN→BATTLE: a fight erupts ashore
      tw.leaveMode(); sample(tw.qaRender());           // BATTLE→SAILING
      runGesture(false);
    }
    tw.newVoyage(); tw.step(0.1);
    // Warm up: one full pass + settle flushes any ONE-TIME lazy GPU allocation, so the baseline is
    // the true steady state (a leak is unbounded GROWTH across cycles, not first-touch init).
    cyclePass(); settleToSailing();
    const base = tw.qaRender();
    const baseline = { geometries: base.geometries, textures: base.textures };
    const N = 8;
    for (let n = 0; n < N; n++) cyclePass();
    settleToSailing();
    const fin = tw.qaRender();
    const final = { geometries: fin.geometries, textures: fin.textures };
    tw.newVoyage(); tw.step(0.1); // clean slate for the screenshot
    return {
      N, baseline, final, worstTransition: worst,
      geomGrowth: final.geometries - baseline.geometries,
      texGrowth: final.textures - baseline.textures,
    };
  });
  if (!(leak.baseline.geometries > 0)) fail(`leak-invariant: baseline geometry count unpopulated (${leak.baseline.geometries}) — cannot gate (#121)`);
  if (leak.geomGrowth > 0) fail(`leak-invariant: geometry count GREW across ${leak.N} mode-transition cycles (baseline=${leak.baseline.geometries} → final=${leak.final.geometries}, +${leak.geomGrowth}) — a resource leak across mode transitions (#121)`);
  if (leak.texGrowth > 0) fail(`leak-invariant: texture count GREW across ${leak.N} mode-transition cycles (baseline=${leak.baseline.textures} → final=${leak.final.textures}, +${leak.texGrowth}) — a resource leak (#121)`);
  if (!(leak.worstTransition.drawCalls > 0)) fail('leak-invariant: no transition-frame perf sample was captured (#121)');
  const transitionBudget = checkBudget(leak.worstTransition, BUDGET);
  for (const v of transitionBudget.violations) fail(`leak-invariant: a mode-transition frame blew the perf budget: ${v.metric}=${v.value} > ${v.ceiling} (#121)`);

  // 2j) Mobile-viewport port view (#146, owner 2026-06-30): the town/port view must NOT clip on
  // phone-sized screens. Owner flagged that port views had sizing issues and asked us to simulate
  // mobile viewports in the gate — this is that standing guard. At several phone resolutions we make
  // landfall, fill the port with content (listen for word so the tavern expands), then assert: the
  // panel box stays within the viewport, the scrollable body exists and can reach its end, and the
  // "Set Sail" plank is on-screen and within the panel (a pinned footer, never lost off the bottom).
  const mobileViewports = [
    { w: 390, h: 844, name: 'iPhone 13/14 portrait' },
    { w: 360, h: 640, name: 'small Android portrait' },
    { w: 844, h: 390, name: 'landscape phone' },
  ];
  for (const vp of mobileViewports) {
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    const m = await page.evaluate(async () => {
      const tw = window.__tidewake;
      tw.newVoyage(); tw.step(0.1);
      const port = tw.ports[0];
      const [px, pz] = port.pos;           // port.pos = [x, z]
      tw.qaTeleport(px, pz); tw.step(0.1); // arrive → auto-harbour into TOWN (#67)
      for (let i = 0; i < 120 && !(tw.mode === 'town' && tw.town && tw.town.open); i++) tw.step(0.1);
      // Fill the quayside so the panel is content-heavy and the scroll path is genuinely exercised.
      try { tw.town.listen(); } catch { /* listen is a flourish; never fail the layout gate on it */ }
      tw.step(0.1);
      const panel = document.getElementById('town');
      if (!panel) return { townOpen: false };
      const scroll = panel.querySelector('.town-scroll');
      const leave = panel.querySelector('#town-leave');
      const vpH = window.innerHeight, vpW = window.innerWidth;
      const pr = panel.getBoundingClientRect();
      // Drive the body to its end — the deepest content (e.g. last market row) must be reachable.
      let reachedBottom = true, scrollable = false;
      if (scroll) {
        scrollable = scroll.scrollHeight > scroll.clientHeight + 1;
        scroll.scrollTop = scroll.scrollHeight;
        reachedBottom = Math.abs(scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop) <= 2;
      }
      const lr = leave ? leave.getBoundingClientRect() : null;
      return {
        townOpen: !!(tw.mode === 'town' && tw.town && tw.town.open),
        hasScroll: !!scroll,
        // The panel box stays inside the viewport (allowing 1px sub-pixel slack).
        panelInViewport: pr.top >= -1 && pr.bottom <= vpH + 1 && pr.left >= -1 && pr.right <= vpW + 1,
        // The Set Sail plank is on-screen, has real size, and never escapes the panel box.
        leaveOnScreen: !!lr && lr.top >= -1 && lr.bottom <= vpH + 1 && lr.width > 1 && lr.height > 1,
        leaveWithinPanel: !!lr && lr.bottom <= pr.bottom + 1 && lr.top >= pr.top - 1,
        reachedBottom, scrollable,
      };
    });
    const tag = `mobile port view (${vp.w}x${vp.h}, ${vp.name})`;
    if (!m.townOpen) fail(`${tag}: town view did not open on landfall`);
    if (!m.hasScroll) fail(`${tag}: no .town-scroll body — the port content can clip off-screen (#146)`);
    if (!m.panelInViewport) fail(`${tag}: #town panel box overflows the viewport (clipping #146)`);
    if (!m.leaveOnScreen) fail(`${tag}: the "Set Sail" plank is not fully on screen (unreachable #146)`);
    if (!m.leaveWithinPanel) fail(`${tag}: the "Set Sail" plank escaped the panel box (#146)`);
    if (!m.reachedBottom) fail(`${tag}: could not scroll the port body to its end — content unreachable (#146)`);
  }
  // Restore the desktop viewport + a clean voyage for the screenshot artifact below.
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.evaluate(() => { const tw = window.__tidewake; tw.newVoyage(); tw.step(0.1); });

  // 3) screenshot artifact
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath });

  // assertions
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  if (!(result.movingSpeed > 1)) fail(`ship did not accelerate (speed=${result.movingSpeed})`);
  if (!(result.distance > 5)) fail(`ship did not move (distance=${result.distance})`);
  // Continuous WAKE/HELM water-bed (#150): becalmed is a gentle lap (audible, never silent), and the
  // wash wells UP as the ship makes way — sailing sounds like moving water. Drive read AudioContext-free.
  if (!(result.wakeBecalmed > 0)) fail(`wake water-bed silent when becalmed (drive=${result.wakeBecalmed}) (#150)`);
  if (!(result.wakeMoving > result.wakeBecalmed)) fail(`wake water-bed did not swell with speed (becalmed=${result.wakeBecalmed}, moving=${result.wakeMoving}) (#150)`);
  // Procedural HULL-CREAK voice (#81): the hull always creaks a little (an idle timber settle), and the
  // creak RATE quickens as she works — under sail with a hard helm over. Rate read AudioContext-free.
  if (!(result.creakBecalmed > 0)) fail(`hull-creak silent at anchor (rate=${result.creakBecalmed}) (#81)`);
  if (!(result.creakMoving > result.creakBecalmed)) fail(`hull-creak did not quicken under sail + hard helm (becalmed=${result.creakBecalmed}, moving=${result.creakMoving}) (#81)`);
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
  console.log(`leak-invariant (#121): ${leak.N}× mode cycles · geom ${leak.baseline.geometries}→${leak.final.geometries} (+${leak.geomGrowth}) · tex ${leak.baseline.textures}→${leak.final.textures} (+${leak.texGrowth}) · worst transition ${leak.worstTransition.drawCalls} draws/${leak.worstTransition.triangles} tris`);
  console.log(JSON.stringify({ ok: process.exitCode !== 1, ...result, budget: { BUDGET, ...budget }, duel, cannon, onboarding, persisted, pwa, settings, settingsPersist, collision, settle, mode, harbour, bump, daynight, grade, needle, landfall, ballad, falseColours, marque, fauna, dolphins, props, islandStyle, leak, broadside, ammoCycle, boarding, errors }, null, 2));
  if (process.exitCode !== 1) console.log('✓ PLAYTEST PASSED');
} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}
