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
import { threatLabelFor } from '../src/systems/threat-label.js'; // #165: assert the live label matches the pure class→label read
import { shipStats } from '../src/ship-classes.js'; // #166: canonical class matchups for the legible-odds fairness gate
import { regionDanger, regionalSpec, DEEP_R } from '../src/systems/danger.js'; // #167: the FIXED regional-danger rule the fleet spawns against
import { spoils } from '../src/cannons.js'; // #167: prove the sinking reward scales by foe tier
import { battleLayer, nextTransition, DRIVE_SCALE, MENACE_SCALE, EDGE_SCALE } from '../src/systems/battle-score.js'; // #158: per-phase battle layers + bar-clock crossfade scheduling
import { SAVE_VERSION } from '../src/save.js'; // #167 owner-decision: regional danger is positional — NO save bump (stays v17)
import { dreadPressure, fleesOnSight, strikesEarly } from '../src/systems/dread.js'; // #172: the world FEARS you — the pure gap→flee/early-strike model
import { offersSurrender } from '../src/systems/board.js'; // #172: prove the dread early-strike feeds the EXISTING white-flag path
import { fearTier, pickFearfulHail } from '../src/systems/fearful-hail.js'; // #175: dread's HEAR half — the pure notoriety→fearful-hail line picker
import { coastProximity, gullCoastGain } from '../src/audio.js'; // #68: the coast comes alive — gull-cry intensity vs distance-to-coast (audio-led, AudioContext-free curve)
import { BOOT_TIPS, pickTip } from '../src/boot-tips.js'; // #15: the wry boot-tip pool + its anti-repeat picker — a laugh before you sail

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

  // 1a-boot-tip) A LAUGH BEFORE YOU SAIL (#15): the loading overlay speaks the game's voice — a wry,
  // original one-liner drawn from a pool with a never-twice-in-a-row guarantee. Prove: (A) a tip
  // actually rendered into the #boot overlay this cast-off; (B) it is a real member of the pool; and
  // (C) the anti-repeat picker never yields the last-shown index yet still reaches every other line
  // (the fun beat's determinism proven headless, off the same pure picker the boot uses).
  const bootTipShown = await page.evaluate(() => window.__tidewake.bootTip);
  if (!bootTipShown || typeof bootTipShown !== 'string' || bootTipShown.trim().length === 0) {
    fail(`boot tip (#15): no tip rendered on the loading overlay (got ${JSON.stringify(bootTipShown)})`);
  } else if (!BOOT_TIPS.includes(bootTipShown)) {
    fail(`boot tip (#15): rendered tip is not from the pool — "${bootTipShown}"`);
  } else {
    // Anti-repeat: from every possible last-shown index, sweep the random range and confirm the
    // picker never repeats it and reaches all other lines (matches the unit-test invariant).
    let antiOk = true, reachOk = true;
    for (let last = 0; last < BOOT_TIPS.length && antiOk && reachOk; last++) {
      const reached = new Set();
      for (let s = 0; s <= 400; s++) {
        const idx = pickTip(last, s / 400);
        if (idx === last) antiOk = false;
        reached.add(idx);
      }
      if (reached.size !== BOOT_TIPS.length - 1) reachOk = false;
    }
    if (!antiOk) fail('boot tip (#15): anti-repeat broken — picker returned the last-shown index');
    else if (!reachOk) fail('boot tip (#15): picker cannot reach every non-last line');
    else if (process.exitCode !== 1) console.log(`  ✓ boot tip (#15): a wry line greets the cast-off — "${bootTipShown}" — drawn from ${BOOT_TIPS.length} original in-voice tips with a never-twice-in-a-row guarantee (a laugh before you sail)`);
  }

  // 1b-challenge) CHALLENGE ON DEMAND (#167, epic #162 slice 5 — the PAYOFF of the whole difficulty lane):
  // the owner's #5 note — "a player who WANTS a hard fight can seek one out and get it." Danger is now
  // FIXED BY REGION (owner decision: NO rubber-band): the safe home coast breeds gentle prey; the deep
  // breeds frigates and — out past the points — the withheld WARSHIP man-o'-war. Point the bow at deadly
  // water and the stakes rise; a kill out there pays real fame (reward scales by tier). Read the PRISTINE
  // spawned fleet (before any battle step drifts/sinks a hull) and prove, all deterministic + headless
  // off the FIXED pure rule (regionDanger) + the live fleet + the reward model: (A) the danger region
  // spawns a STRICTLY higher-tier ship than the safe coast; (B) the withheld warship man-o'-war (tier 5)
  // is present + reachable out in the tier-5 deep; (C) a tier-N victory reward scales with tier; (D) no
  // rubber-band — the rule reads POSITION only; (E) the save schema is unchanged (stays v17).
  const challenge = await page.evaluate(() => {
    const tw = window.__tidewake;
    return {
      count: tw.npcs.length,
      fleet: tw.npcs.map((n, i) => ({
        i,
        cls: n.shipClass ? n.shipClass.cls : null,
        role: n.shipClass ? n.shipClass.role : null,
        tier: n.shipClass ? n.shipClass.tier : 0,
        x: n.pos[0], z: n.pos[1],
      })),
    };
  });
  {
    const classed = challenge.fleet.filter((f) => f.tier > 0);
    if (classed.length < 2) fail(`challenge on demand (#167): fewer than 2 classed hulls to compare regions (${classed.length})`);
    // Tag each hull with the FIXED region danger of WHERE it spawned (the same pure rule the spawner used).
    const tagged = classed.map((f) => ({ ...f, region: regionDanger(f.x, f.z), r: Math.hypot(f.x, f.z) }));
    // (A) THE FIXED RULE — pure + deterministic: the deep spawns STRICTLY higher-tier ships than the safe
    // coast. Proven directly off the spawner's own rule (regionalSpec) so it can NEVER drift, coast→deep.
    const half = () => 0.5;
    const coastSpec = regionalSpec(0, 320, half, { apex: true });          // the gentle home coast
    const deepSpec = regionalSpec(0, DEEP_R + 200, half, { apex: true });  // the deadly deep
    const coastRuleTier = shipStats(coastSpec.cls, coastSpec.role).tier;
    const deepRuleTier = shipStats(deepSpec.cls, deepSpec.role).tier;
    if (!(deepRuleTier > coastRuleTier)) fail(`challenge on demand (#167): the FIXED rule does not out-class the deep vs the coast (deep tier ${deepRuleTier} !> coast tier ${coastRuleTier}) — danger is not seekable via place`);
    // (B) the withheld WARSHIP man-o'-war is present + reachable out in the tier-5 deep:
    const manowar = tagged.find((f) => f.cls === 'manowar' && f.role === 'warship' && f.tier === 5);
    if (!manowar) fail('challenge on demand (#167): no warship man-o\'-war (tier 5) afloat — the seekable terror never spawned');
    else if (!(manowar.region === 5 && manowar.r >= DEEP_R)) fail(`challenge on demand (#167): the man-o'-war is not out in the deep (region ${manowar.region}, r ${manowar.r.toFixed(0)} < ${DEEP_R}) — she must be reachable by SAILING to danger`);
    // (B2) the LIVE fleet bears out the gradient: the man-o'-war sits in a STRICTLY more dangerous region
    // (and out-tiers) the tamest hull afloat — danger genuinely varies by WHERE a ship is in the world.
    const coast = tagged.reduce((a, b) => (b.region < a.region ? b : a));
    if (manowar && !(manowar.region > coast.region && manowar.tier > coast.tier)) {
      fail(`challenge on demand (#167): the man-o'-war did not out-rank the tamest hull by region+tier (mow region ${manowar.region}/tier ${manowar.tier} vs tame region ${coast.region}/tier ${coast.tier})`);
    }
    // (C) reward SCALES BY TIER — a man-o'-war kill pays strictly more coin + Infamy than a sloop's:
    const hull = { playerHull: 100, enemyMaxHull: 100 };
    let prevC = -1, prevI = -1, monotone = true;
    for (let t = 1; t <= 5; t++) { const s = spoils({ ...hull, tier: t }); if (!(s.coins > prevC && s.infamy > prevI)) monotone = false; prevC = s.coins; prevI = s.infamy; }
    const prey = spoils({ ...hull, tier: 1 }), terror = spoils({ ...hull, tier: 5 });
    if (!monotone) fail('challenge on demand (#167): the sinking reward does not climb monotonically with foe tier');
    if (!(terror.coins > prey.coins && terror.infamy > prey.infamy)) fail(`challenge on demand (#167): a man-o'-war kill did not out-pay a sloop's (t5 ${terror.coins}c/${terror.infamy}inf vs t1 ${prey.coins}c/${prey.infamy}inf)`);
    // (D) no rubber-band: the rule reads POSITION only (a fixed point always reads the same danger):
    if (!(regionDanger(0, 320) < regionDanger(0, DEEP_R + 100))) fail('challenge on demand (#167): regionDanger is not fixed-by-region (coast !< deep) — danger looks rubber-banded');
    // (E) Regional danger adds NO field of its own — it's positional/deterministic (owner decision). The
    // schema is v18 as of THE RISE's gun upgrade (#170, the lane's one bump); #167 contributes nothing to it.
    if (SAVE_VERSION !== 18) fail(`save schema pin: expected v18 (THE RISE gun upgrade #170), got v${SAVE_VERSION} — regional danger (#167) still adds no persisted field`);
    if (process.exitCode !== 1) console.log(`  ✓ challenge on demand (#167): the FIXED rule out-classes the deep (tier ${deepRuleTier}) vs the coast (tier ${coastRuleTier}); the warship man-o'-war (tier 5) roams the deep (r ${manowar ? manowar.r.toFixed(0) : '?'} ≥ ${DEEP_R}) above the tamest hull (region ${coast.region}/tier ${coast.tier}) — reachable by sailing to danger; reward scales (t1 ${prey.coins}c → t5 ${terror.coins}c); fixed-by-region, no rubber-band, save v${SAVE_VERSION}`);
  }

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

  // 2a-classes) SHIP CLASSES (#163, epic #162 FOUNDATION): the sea stops being uniform. NPC ships now
  // spawn across a MIX of classes (sloop→brig→frigate→man-o'-war × merchant/warship) that differ VISIBLY
  // (mesh scale / silhouette) AND MECHANICALLY (hull + gunnery feed the EXISTING battle math). Two proofs,
  // both deterministic + headless: (A) the fleet carries ≥2 distinct classes whose hull, gunnery AND size
  // genuinely differ — variety you can SEE, not a cosmetic tint; (B) qaClassCombat() resolves the SAME
  // clean broadside against the SAME target with a frigate's guns vs a sloop's, and the frigate bites
  // harder — class genuinely SCALES the fight (a frigate threatens where a sloop barely scratches).
  const classes = await page.evaluate(() => {
    const tw = window.__tidewake;
    const fleet = tw.npcs.map((n) => n.shipClass).filter(Boolean);
    return { count: tw.npcs.length, fleet, combat: tw.qaClassCombat() };
  });
  {
    if (!(classes.fleet.length >= 2)) fail(`ship classes (#163): fewer than 2 NPCs carry a class (${classes.fleet.length}/${classes.count}) — the sea has no variety`);
    const cls = new Set(classes.fleet.map((f) => f.cls));
    if (!(cls.size >= 2)) fail(`ship classes (#163): the fleet is a UNIFORM sea (all '${[...cls]}') — classes must vary`);
    const spread = (key) => { const v = classes.fleet.map((f) => f[key]); return Math.max(...v) - Math.min(...v); };
    if (!(spread('hull') > 0)) fail('ship classes (#163): every hull is equally tough — class does not vary hull');
    if (!(spread('sizeScale') > 0)) fail('ship classes (#163): every hull is the same SIZE — you cannot SEE a man-o\'-war dwarf a sloop');
    if (!(spread('gunnery') > 0)) fail('ship classes (#163): every hull carries the same guns — class does not vary armament');
    const c = classes.combat;
    if (!(c.frigateReply > c.sloopReply)) fail(`ship classes (#163): a frigate's broadside did not out-bite a sloop's (${c.frigateReply} !> ${c.sloopReply}) — class does not SCALE combat`);
    if (!(c.manowarReply > c.frigateReply)) fail(`ship classes (#163): a man-o'-war's broadside did not out-bite a frigate's (${c.manowarReply} !> ${c.frigateReply})`);
    if (!(c.manowarHull > c.sloopHull)) fail(`ship classes (#163): a man-o'-war is not tougher than a sloop (${c.manowarHull} !> ${c.sloopHull})`);
    if (process.exitCode !== 1) console.log(`  ✓ ship classes (#163): the fleet spans ${cls.size} classes [${[...cls].join(', ')}] with distinct hull/guns/size; a frigate's broadside (${c.frigateReply}) out-bites a sloop's (${c.sloopReply}) — variety you SEE and FEEL`);
  }

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

  // 2b3-iso) Hard battle isolation (#161 slice 1): the deliberate stance must CLEANLY ISOLATE the
  // fight — no #125 rescue offer, no open-sea f/g hail may intrude while engaged (the owner's
  // playtest bug: the fight felt janky/broken because ambient prompts hijacked it). Deterministic
  // engage via qaTeleport (the sail-to-a-foe path above skips when no NPC drifts into range), then
  // stage a founderer alongside + fire the ambient verbs via REAL key events: every one is a no-op.
  const iso = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const suppressedAtSea = tw.interactionsSuppressed;       // false while sailing
    const ambientLiveAtSea = tw.canAmbientSpawn;             // a founderer CAN meet you at sea
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);                       // drop just off her — inside engage range
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false };
    const suppressedInBattle = tw.interactionsSuppressed;    // must flip TRUE in the stance
    const ambientGatedInBattle = !tw.canAmbientSpawn;        // the #125 spawn gate must be SHUT
    // Stage a founderer alongside mid-fight (or reuse one already up from the natural cadence — an
    // even more realistic "she was foundering when I squared up" case). Either way we then prove her
    // rescue choice can't be taken while engaged.
    const staged = tw.encounter.active || tw.encounterSpawn();
    const encUpMid = tw.encounter.active;
    const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('1');                                                // RESCUE choice — must NOT resolve
    const rescueNoOp = tw.encounter.active === true && tw.encounter.choice == null;
    key('f'); key('g');                                      // open-sea hail + open-fire — must NOT fire
    tw.step(0.05);
    const noStrayDuel = !tw.duel.active;
    const noStrayCannonade = !tw.cannons.active;
    const stillEngaged = tw.battle.active;
    tw.encounterChoose('rescue');                            // clear the forced founderer for later steps
    tw.fleeBattle();                                         // break off — isolation must LIFT
    tw.step(0.05);
    const suppressedAfterFlee = tw.interactionsSuppressed;
    const ambientLiveAfterFlee = tw.canAmbientSpawn;
    return { engaged, suppressedAtSea, ambientLiveAtSea, suppressedInBattle, ambientGatedInBattle,
      staged, encUpMid, rescueNoOp, noStrayDuel, noStrayCannonade, stillEngaged,
      suppressedAfterFlee, ambientLiveAfterFlee };
  });
  if (!iso.engaged) fail('battle isolation (#161 slice 1): could not engage a foe to test isolation (no NPC found even after qaTeleport)');
  if (iso.suppressedAtSea) fail('battle isolation (#161): interactions were suppressed WHILE SAILING (isolation must be battle-only)');
  if (!iso.ambientLiveAtSea) fail('battle isolation (#161): a founderer could NOT meet us at sea (the ambient world was wrongly gated)');
  if (!iso.suppressedInBattle) fail('battle isolation (#161): interactionsSuppressed was FALSE in the deliberate stance');
  if (!iso.ambientGatedInBattle) fail('battle isolation (#161): an ambient founderer could still spawn mid-fight (canAmbientSpawn stayed true)');
  if (!iso.encUpMid) fail('battle isolation (#161): could not stage a founderer alongside for the no-op check');
  if (!iso.rescueNoOp) fail('battle isolation (#161): the #125 RESCUE choice (key 1) RESOLVED mid-fight — the rescue prompt leaked into battle');
  if (!iso.noStrayDuel) fail('battle isolation (#161): an open-sea hail (key f) opened a duel mid-fight');
  if (!iso.noStrayCannonade) fail('battle isolation (#161): an open-sea open-fire (key g) started a cannonade mid-fight');
  if (!iso.stillEngaged) fail('battle isolation (#161): the ambient verbs knocked us out of BATTLE stance');
  if (iso.suppressedAfterFlee) fail('battle isolation (#161): interactions stayed suppressed after fleeing (isolation never lifted)');
  if (!iso.ambientLiveAfterFlee) fail('battle isolation (#161): the ambient world did not come back after fleeing');
  if (process.exitCode !== 1) console.log('  ✓ battle isolation (#161 slice 1): rescue + f/g hail are no-ops in the deliberate stance; the fight is cleanly isolated');

  // 2b3-loss) LOSS STINGS (#164): the owner's #1 note — "games are too easy; a player must be able to
  // LOSE, and a loss should COST points + fame." Two things must hold: (1) you can ACTUALLY lose (your
  // hull breaks under fire → the engagement is lost), and (2) losing STINGS via defeatLedger — a
  // tier-scaled, CONTEXT-BASED, FLOORED deduction off your already-persisted coin + fame, surfaced on a
  // red "Colours Struck" card that NAMES the cost. Drive a real defeat headlessly (battleForceDefeat sets
  // your hull to 1 vs a hale foe, so her reply sinks you through the genuine finish('lose') path) under
  // BOTH poles — a raiding loss (Infamy-dominant) must dent Infamy; a governor-road loss (Standing-
  // dominant) must dent Standing — then prove the floor never drives a broke captain negative.
  const loss = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function engageNearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi === -1) return false;
      const fp = tw.npcs[bi].pos;
      tw.qaTeleport(fp[0], fp[1] - 120);
      tw.step(0.05);
      return tw.engageBattle();
    }

    // RAID context: a pirate-leaning captain loses → Infamy + coin dented, Standing untouched.
    if (!engageNearest()) return { engaged: false };
    tw.qaSetLedger({ coins: 1000, infamy: 1000, standing: 200 });
    const before1 = tw.state;
    tw.battleForceDefeat();
    const fired1 = tw.battleFire();
    const after1 = tw.state;
    const card1 = tw.defeatCard;

    // GOVERNOR context: a governor-leaning captain loses → Standing dented, Infamy untouched.
    if (!engageNearest()) return { engaged: false };
    tw.qaSetLedger({ coins: 1000, infamy: 200, standing: 1000 });
    const before2 = tw.state;
    tw.battleForceDefeat();
    const fired2 = tw.battleFire();
    const after2 = tw.state;
    const card2 = tw.defeatCard;

    // FLOOR: a near-broke, near-nameless captain loses to the same foe → nothing goes negative.
    if (!engageNearest()) return { engaged: false };
    tw.qaSetLedger({ coins: 2, infamy: 3, standing: 0 });
    tw.battleForceDefeat();
    const fired3 = tw.battleFire();
    const after3 = tw.state;

    const P = (f) => (f && f.penalty) || {};
    return {
      engaged: true,
      r1: fired1 && fired1.result, r2: fired2 && fired2.result, r3: fired3 && fired3.result,
      pole1: P(fired1).pole, pole2: P(fired2).pole,
      fameLoss1: P(fired1).fameLoss, coinLoss1: P(fired1).coinLoss,
      infBefore1: before1.infamy, infAfter1: after1.infamy,
      coinBefore1: before1.coins, coinAfter1: after1.coins,
      stBefore1: before1.standing, stAfter1: after1.standing,
      stBefore2: before2.standing, stAfter2: after2.standing,
      infBefore2: before2.infamy, infAfter2: after2.infamy,
      card1, card2,
      floorCoins: after3.coins, floorInfamy: after3.infamy, floorStanding: after3.standing,
    };
  });
  if (!loss.engaged) fail('loss stings (#164): could not engage a foe to test a defeat (no NPC found even after qaTeleport)');
  // (1) You can ACTUALLY lose:
  if (loss.r1 !== 'lose') fail(`loss stings (#164): a killing blow did not resolve to a LOSS (result=${loss.r1}) — defeat is unreachable`);
  if (loss.r2 !== 'lose' || loss.r3 !== 'lose') fail(`loss stings (#164): a staged defeat failed to resolve to 'lose' (r2=${loss.r2}, r3=${loss.r3})`);
  // (2a) A RAIDING loss dents INFAMY + coin, and leaves Standing alone (context-based):
  if (loss.pole1 !== 'infamy') fail(`loss stings (#164): a raiding loss dented the wrong pole (pole=${loss.pole1}, expected infamy)`);
  if (!(loss.fameLoss1 > 0) || !(loss.coinLoss1 > 0)) fail(`loss stings (#164): the defeat did not deduct fame + coin (fame=${loss.fameLoss1}, coin=${loss.coinLoss1})`);
  if (loss.infAfter1 !== loss.infBefore1 - loss.fameLoss1) fail(`loss stings (#164): Infamy did not drop by the ledgered amount (${loss.infBefore1}→${loss.infAfter1}, loss=${loss.fameLoss1})`);
  if (!(loss.coinAfter1 < loss.coinBefore1)) fail(`loss stings (#164): coin did not drop on a defeat (${loss.coinBefore1}→${loss.coinAfter1})`);
  if (loss.stAfter1 !== loss.stBefore1) fail(`loss stings (#164): a RAIDING loss wrongly touched Standing (${loss.stBefore1}→${loss.stAfter1})`);
  // (2b) A GOVERNOR-road loss dents STANDING instead, leaving Infamy alone:
  if (loss.pole2 !== 'standing') fail(`loss stings (#164): a governor-road loss dented the wrong pole (pole=${loss.pole2}, expected standing)`);
  if (!(loss.stAfter2 < loss.stBefore2)) fail(`loss stings (#164): Standing did not drop on a governor-road defeat (${loss.stBefore2}→${loss.stAfter2})`);
  if (loss.infAfter2 !== loss.infBefore2) fail(`loss stings (#164): a GOVERNOR-road loss wrongly touched Infamy (${loss.infBefore2}→${loss.infAfter2})`);
  // (3) The red "Colours Struck" defeat card NAMES the cost (SEE the fame + coin drop):
  if (!loss.card1 || loss.card1.pole !== 'infamy' || loss.card1.fameLoss !== loss.fameLoss1 || loss.card1.coinLoss !== loss.coinLoss1) {
    fail(`loss stings (#164): the raid defeat card did not name the cost (card=${JSON.stringify(loss.card1)})`);
  }
  if (!loss.card2 || loss.card2.pole !== 'standing') fail(`loss stings (#164): the governor defeat card did not name a Standing cost (card=${JSON.stringify(loss.card2)})`);
  // (4) The sting FLOORS at 0 — no death-spiral, no negative pole:
  if (loss.floorCoins < 0 || loss.floorInfamy < 0 || loss.floorStanding < 0) {
    fail(`loss stings (#164): a broke captain's ledger went NEGATIVE (coins=${loss.floorCoins}, infamy=${loss.floorInfamy}, standing=${loss.floorStanding})`);
  }
  if (process.exitCode !== 1) console.log('  ✓ loss stings (#164): you CAN lose (hull breaks → engagement lost) AND it STINGS — a raiding loss dents Infamy+coin, a governor-road loss dents Standing, the red "Colours Struck" card names the cost, floored at 0 (no death-spiral)');

  // rank) RANK-UP MILESTONE (#169, epic #168 "The Rise"): the felt "you rose" beat. Crossing a
  // renown.js rung must fire ONE title card naming the new rank with pole-appropriate tone (dread on
  // the pirate road, respect on the governor road) + a triumphant sting. Prove it end-to-end,
  // headlessly: (1) a forward crossing fires exactly one card with the correct pirate title; (2) a
  // non-crossing rep change within the same rung is SILENT; (3) a rung dropped (as after a defeat)
  // then re-climbed does NOT re-announce (the "highest rung seen" guard); (4) a genuinely NEW,
  // higher rung on the OTHER pole fires once with the correct governor title. Driven off the ledger
  // via qaSetLedger + a deterministic step, read off the tw.rankUp card + its monotonic fire-count.
  const rank = await page.evaluate(async () => {
    const tw = window.__tidewake;
    // Establish a clean, known baseline at the bottom rung (other blocks moved the ledger).
    tw.qaSetLedger({ coins: 0, infamy: 0, standing: 0 });
    tw.qaResetRankBaseline();
    tw.step(0.05);                 // re-seed the baseline silently at rung 0
    const base = tw.rankUp;        // whatever card (if any) predates this block
    const baseCount = base ? base.count : 0;

    // (1) forward crossing, pirate-led → Corsair (rung 5), "feared" tone
    tw.qaSetLedger({ infamy: 1001, standing: 0 }); // total 1001 → rung 5 (Sea Captain threshold 1000)
    tw.step(0.05);
    const cross1 = tw.rankUp;

    // (2) non-crossing rep change, still rung 5 → no new card
    tw.qaSetLedger({ infamy: 1200, standing: 0 });
    tw.step(0.05);
    const noCross = tw.rankUp;

    // (3) drop a rung (a defeat) then re-climb the SAME rung → must not re-announce
    tw.qaSetLedger({ infamy: 600, standing: 0 }); // total 600 → rung 4
    tw.step(0.05);
    tw.qaSetLedger({ infamy: 1001, standing: 0 }); // back to rung 5
    tw.step(0.05);
    const reCross = tw.rankUp;

    // (4) a genuinely higher rung on the governor pole → Magistrate (rung 6), "respect" tone
    tw.qaSetLedger({ infamy: 0, standing: 1601 }); // total 1601 → rung 6 (Dread Captain threshold 1600)
    tw.step(0.05);
    const cross2 = tw.rankUp;

    return { baseCount, cross1, noCross, reCross, cross2 };
  });
  // (1) the crossing fired exactly once, naming the pirate rung with dread tone:
  if (!rank.cross1) fail('rank-up (#169): crossing into a new rung fired NO card');
  if (rank.cross1.count !== rank.baseCount + 1) fail(`rank-up (#169): a single crossing did not fire exactly once (count ${rank.baseCount}→${rank.cross1.count})`);
  if (rank.cross1.pole !== 'pirate') fail(`rank-up (#169): an infamy-led crossing wore the wrong pole (${rank.cross1.pole}, expected pirate)`);
  if (rank.cross1.title !== 'Corsair') fail(`rank-up (#169): the card named the wrong pirate title (${rank.cross1.title}, expected Corsair)`);
  if (!/feared/i.test(rank.cross1.headline)) fail(`rank-up (#169): the pirate card did not read as dread ("${rank.cross1.headline}")`);
  // (2) a non-crossing rep change stayed silent:
  if (rank.noCross.count !== rank.cross1.count) fail(`rank-up (#169): a non-crossing rep change wrongly re-announced (count ${rank.cross1.count}→${rank.noCross.count})`);
  // (3) dropping a rung then re-climbing did NOT re-fire (the highest-seen guard):
  if (rank.reCross.count !== rank.cross1.count) fail(`rank-up (#169): re-crossing a rung already seen wrongly re-announced (count ${rank.cross1.count}→${rank.reCross.count})`);
  // (4) a genuinely higher rung on the OTHER pole fired once, with the civic title + respect tone:
  if (rank.cross2.count !== rank.cross1.count + 1) fail(`rank-up (#169): a new higher rung did not fire exactly once (count ${rank.cross1.count}→${rank.cross2.count})`);
  if (rank.cross2.pole !== 'governor') fail(`rank-up (#169): a standing-led crossing wore the wrong pole (${rank.cross2.pole}, expected governor)`);
  if (rank.cross2.title !== 'Magistrate') fail(`rank-up (#169): the card named the wrong civic title (${rank.cross2.title}, expected Magistrate)`);
  if (process.exitCode !== 1) console.log('  ✓ rank-up milestone (#169): crossing a rung fires ONE title card with the right pole tone (feared Corsair / respected Magistrate); a non-crossing rep change is silent; a rung dropped then re-climbed does NOT re-announce (save-free "highest rung seen" guard)');

  // 2b3-ui) NON-OCCLUDING battle UI (#161 slice 2): the marquee complaint — "the popup covers my
  // ship and I cannot see my ship in action." The fight prompts (#battle/#cannons/#duel) are now
  // DOCKED to a lower band instead of a dead-centre modal, so the battle camera's centre-framed hull
  // + the action stay VISIBLE. Engage deterministically (qaTeleport), confirm the #battle panel is
  // SHOWN, then assert it (and every other shown battle strip) clears the CENTRAL SAFE-ZONE — read
  // off the tw.battleUICentreClear() hook, which runs the live DOM rects through the pure
  // src/ui/safe-zone.js predicate. Asserted on BOTH desktop AND a phone-portrait viewport (the #146
  // responsive guard) so the occlusion the owner reported can never silently regress.
  const battleUI = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);       // drop just off her — inside engage range
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false };
    tw.step(0.1);                            // let the hud-battle system paint the panel → .show
    const $b = document.getElementById('battle');
    const shown = !!$b && $b.classList.contains('show');
    const desk = tw.battleUICentreClear();
    return { engaged, shown, deskClear: desk.clear,
      shownPanels: desk.panels.filter((p) => p.shown).map((p) => p.id),
      offenders: desk.panels.filter((p) => p.shown && !p.clear).map((p) => p.id) };
  });
  if (!battleUI.engaged) {
    console.warn('  (#161 slice 2 non-occluding UI: no foe to engage — skipped)');
  } else {
    if (!battleUI.shown) fail('non-occluding battle UI (#161 slice 2): the #battle panel never showed — cannot verify occlusion');
    if (!(battleUI.shownPanels.length > 0)) fail('non-occluding battle UI (#161 slice 2): no battle UI was shown to test');
    if (!battleUI.deskClear) fail(`non-occluding battle UI (#161 slice 2): battle prompt(s) OVERLAP the central safe-zone on desktop — the ship is occluded (offenders: ${battleUI.offenders.join(',')})`);
    // The non-occlusion must ALSO hold on a phone-portrait viewport (#146 responsive guard).
    await page.setViewport({ width: 400, height: 860 });
    const phone = await page.evaluate(() => { const tw = window.__tidewake; tw.step(0.05); const r = tw.battleUICentreClear(); return { clear: r.clear, offenders: r.panels.filter((p) => p.shown && !p.clear).map((p) => p.id) }; });
    if (!phone.clear) fail(`non-occluding battle UI (#161 slice 2): battle prompt(s) occlude the ship on a phone-portrait viewport (offenders: ${phone.offenders.join(',')})`);
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => { window.__tidewake.fleeBattle(); window.__tidewake.step(0.05); });
    if (process.exitCode !== 1) console.log(`  ✓ non-occluding battle UI (#161 slice 2): fight prompts docked clear of the centre (shown: ${battleUI.shownPanels.join(',')}) — the ship stays visible on desktop + phone`);
  }

  // 2b3-hud) CLEANER PERSISTENT STATUS HUD (#21): THE RISE (#168) piled coins, rank/title, the ⚔/⚖
  // reputation ledger and the legend crown onto the corner HUD until it read as one scattered run of
  // text. It now groups into two legible clusters (SAILING + CAPTAIN, mirroring the pure
  // src/ui/hud-status.js model). The FUN beat to prove: a glance tells you who you are + what you have.
  // Assert on DESKTOP + a phone-portrait viewport that the read-out (a) splits into both groups, (b)
  // keeps every RISE field (coins, ⚔ Infamy, ⚖ Standing, rank/title, the needle + the crown element),
  // (c) FITS the viewport (no overflow/clipping — the #146 guard), and (d) stays anchored in the
  // top-left corner clear of the mid-screen framed hull (the corner's non-occlusion contract — the
  // #161-s2 centre safe-zone governs the battle MODALS, still asserted by battleUICentreClear above; a
  // readable corner HUD can't clear that wide band on a phone). Then engage a fight and assert the
  // corner cluster does NOT overlap the battle-transient stack (this slice must not disturb it).
  {
    // Seed a full RISE ledger so rank/title + both poles are non-trivially painted (worst case for width).
    await page.evaluate(() => { const tw = window.__tidewake; tw.qaSetLedger({ coins: 12345, infamy: 480, standing: 260 }); tw.step(0.05); });
    const deskHud = await page.evaluate(() => window.__tidewake.hudStatusLegible());
    if (!deskHud.grouped) fail(`cleaner status HUD (#21): the corner HUD did not split into both legible groups on desktop (groups: ${JSON.stringify(deskHud.groups)})`);
    if (!deskHud.fieldsPresent) fail(`cleaner status HUD (#21): a RISE read-out was DROPPED in the consolidation — missing: ${deskHud.missing.join(',')}`);
    if (!deskHud.fits) fail(`cleaner status HUD (#21): the corner HUD overflows the desktop viewport (hud ${JSON.stringify(deskHud.hud)} vs ${JSON.stringify(deskHud.viewport)})`);
    if (!deskHud.clear) fail(`cleaner status HUD (#21): the corner HUD dropped out of the top-left corner into the ship-framing band on desktop (hud ${JSON.stringify(deskHud.hud)})`);
    // Phone portrait (#146): the whole cluster must still fit + group + stay clear on a small screen.
    await page.setViewport({ width: 400, height: 860 });
    const phoneHud = await page.evaluate(() => { window.__tidewake.step(0.05); return window.__tidewake.hudStatusLegible(); });
    if (!phoneHud.grouped) fail('cleaner status HUD (#21): the corner HUD lost its grouping on a phone-portrait viewport');
    if (!phoneHud.fieldsPresent) fail(`cleaner status HUD (#21): a RISE read-out is missing on phone — missing: ${phoneHud.missing.join(',')}`);
    if (!phoneHud.fits) fail(`cleaner status HUD (#21): the corner HUD overflows / clips on a phone-portrait viewport (hud ${JSON.stringify(phoneHud.hud)} vs ${JSON.stringify(phoneHud.viewport)}) — the #146 guard`);
    if (!phoneHud.clear) fail(`cleaner status HUD (#21): the corner HUD dropped into the ship-framing band on a phone-portrait viewport (hud ${JSON.stringify(phoneHud.hud)})`);
    await page.setViewport({ width: 1280, height: 800 });
    // No-overlap with the battle-transient stack: engage the nearest foe, confirm a battle panel is
    // shown, then assert the corner HUD doesn't cover any of it (it lives top-left; the fight docks low).
    const hudBattle = await page.evaluate(() => {
      const tw = window.__tidewake;
      let bi = -1, bd = Infinity; const s = tw.state.pos;
      for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]); if (d < bd) { bd = d; bi = i; } }
      if (bi === -1) return { engaged: false };
      const fp = tw.npcs[bi].pos; tw.qaTeleport(fp[0], fp[1] - 120); tw.step(0.05);
      if (!tw.engageBattle()) return { engaged: false };
      tw.step(0.1);
      const r = tw.hudStatusLegible();
      return { engaged: true, battleShown: r.battleShown, overlap: r.battleOverlap };
    });
    if (hudBattle.engaged) {
      if (!(hudBattle.battleShown.length > 0)) fail('cleaner status HUD (#21): no battle-transient panel showed — cannot verify the corner HUD stays clear of it');
      if (hudBattle.overlap.length) fail(`cleaner status HUD (#21): the corner HUD OVERLAPS the battle-transient UI (offenders: ${hudBattle.overlap.join(',')}) — it must not disturb the docked fight stack`);
      await page.evaluate(() => { window.__tidewake.fleeBattle(); window.__tidewake.step(0.05); });
    }
    if (process.exitCode !== 1) console.log(`  ✓ cleaner status HUD (#21): grouped into SAILING + CAPTAIN, every RISE field kept (coins/⚔/⚖/rank/needle/crown), fits desktop + phone-portrait, anchored top-left clear of the framed hull${hudBattle.engaged ? `, no overlap with the fight stack (${hudBattle.battleShown.join(',')})` : ''} — status reads at a glance`);
  }

  // 2b3-lock) TARGET LOCK (#161 slice 3): the owner's complaint — "while moving other ships are all
  // around: I don't know which one I am fighting with!" The engaged foe now carries a world-anchored
  // target RING (a projected DOM billboard, 0 draws) and the non-combatant traffic RECEDES (material
  // opacity) — so the foe reads instantly. Engage deterministically (qaTeleport), let the camera swing
  // settle, then assert the foe is marked + the only un-dimmed hull, and that it ALL clears on flee.
  const lock = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);          // drop just off her — inside engage range, foe ahead
    tw.step(0.05);
    // Turn to FACE her so the quarter-view camera (astern of the player, looking at the player) frames
    // the foe ahead — the deterministic stand-in for the sail-up approach the other battle steps use.
    for (let i = 0; i < 60; i++) {
      const s = tw.state, foe = tw.npcs[bi].pos;
      const bearing = Math.atan2(foe[0] - s.pos[0], foe[1] - s.pos[2]);
      const err = norm(bearing - s.heading);
      tw.release('a'); tw.release('d');
      if (Math.abs(err) < 0.03) break;
      if (err > 0) tw.press('a'); else tw.press('d');
      tw.step(0.1);
    }
    tw.release('a'); tw.release('d');
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false };
    for (let i = 0; i < 16; i++) tw.step(0.05);  // let the quarter-view camera swing settle so she frames
    const on = tw.targetLock();
    const foeIdx = tw.battle.foeIndex;
    const fled = tw.fleeBattle();
    tw.step(0.05);
    const off = tw.targetLock();
    return { engaged, on, off, fled, foeIdx, npcCount: tw.npcs.length };
  });
  if (!lock.engaged) {
    console.warn('  (#161 slice 3 target-lock: no foe to engage — skipped)');
  } else {
    if (!lock.on.active) fail('target lock (#161 slice 3): the lock did not activate on engage');
    if (lock.on.foeIndex !== lock.foeIdx) fail(`target lock (#161 slice 3): locked the wrong hull (lock=${lock.on.foeIndex}, foe=${lock.foeIdx})`);
    if (!lock.on.markerShown) fail('target lock (#161 slice 3): the engaged foe carries NO target marker — you cannot tell who you are fighting');
    if (!(lock.on.foeOpacity === 1)) fail(`target lock (#161 slice 3): the foe was dimmed (opacity=${lock.on.foeOpacity}) — she must stay full so she reads`);
    if (lock.npcCount > 1 && !(lock.on.dimmed.length >= 1)) fail('target lock (#161 slice 3): non-combatant traffic was NOT de-emphasised — the sea did not recede');
    if (lock.on.dimmed.includes(lock.on.foeIndex)) fail('target lock (#161 slice 3): the FOE was dimmed along with the traffic — she must stand out');
    // Clears on flee: the ring gone, every hull back to full — the world returns.
    if (lock.off.active) fail('target lock (#161 slice 3): the lock did not clear on flee');
    if (lock.off.markerShown) fail('target lock (#161 slice 3): the target marker lingered after fleeing');
    if (lock.off.dimmed.length !== 0) fail('target lock (#161 slice 3): traffic stayed dimmed after the fight ended — the sea never came back');
    if (process.exitCode !== 1) console.log(`  ✓ target lock (#161 slice 3): the engaged foe is ring-marked + the only un-dimmed hull (${lock.on.dimmed.length} receded); clears on flee`);
  }

  // 2b3-labels) OVER-SHIP THREAT LABELS (#165, epic #162 slice 3): the owner's #7 note — "over-the-ship
  // displays telling/hinting what ships are, so a player can CHOOSE fights and read danger at a glance."
  // Every classed hull now floats a class + threat label ("Merchant Sloop ·" → "Warship Man-o'-War
  // ☠☠☠☠"), reusing the SAME billboard as the #161-s3 target ring (one module, two consumers — 0 draws).
  // Proofs, all deterministic + headless: (A) each shown label's text + glyph MATCH the ship's class/tier
  // (tied to the pure threatLabelFor); (B) the deadliest hull reads STRICTLY more dangerous (more skulls)
  // than the tamest; (C) declutter — a hull sent over the horizon is culled, and a phone caps the count
  // BELOW desktop (#146 guard); (D) coexistence — the engaged foe carries the ring AND a threat label on
  // the SAME anchor, while the traffic's labels recede so the duel reads clean.
  const skulls = (g) => (String(g || '').match(/☠/g) || []).length;
  const tlab = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    tw.qaTeleport(0, -40);
    for (let k = 0; k < 22; k++) tw.step(0.05);   // ease off the dock so the chase cam settles ahead
    const fleet = tw.npcs.map((n, i) => ({ i, tier: n.shipClass ? n.shipClass.tier : 0, label: n.shipClass ? n.shipClass.label : null }));
    const withClass = fleet.filter((f) => f.tier > 0).sort((a, b) => a.tier - b.tier);
    if (withClass.length < 2) return { ok: false, reason: `need >=2 classed hulls (have ${withClass.length})` };
    const low = withClass[0].i;                          // the tamest (a sloopish prize)
    const high = withClass[withClass.length - 1].i;      // the deadliest afloat in this fleet
    const spare = withClass.length >= 3 ? withClass[1].i : -1; // a spare hull to send over the horizon
    // Pose the two we read just ahead of the bow (inside the natural over-the-bow chase frame), and the
    // spare WAY off so it must declutter (culled beyond FAR).
    const P = tw.state.pos, px = P[0], pz = P[2], h = tw.state.heading; // state.pos is [x,y,z]
    const fwd = [Math.sin(h), Math.cos(h)], right = [Math.cos(h), -Math.sin(h)];
    const put = (idx, ahead, side) => { if (idx >= 0) tw.qaPlaceShip(idx, px + fwd[0] * ahead + right[0] * side, pz + fwd[1] * ahead + right[1] * side); };
    put(low, 130, -70);
    put(high, 150, 70);
    if (spare >= 0) put(spare, 3200, 0);                 // over the horizon → decluttered
    tw.step(0.03);
    const desk = tw.qaSyncThreatLabels();                // desktop viewport read
    const byIdx = (i) => desk.labels.find((l) => l.index === i) || null;
    return {
      ok: true, low, high, spare,
      lowTier: fleet[low].tier, lowClassLabel: fleet[low].label,
      highTier: fleet[high].tier, highClassLabel: fleet[high].label,
      deskMax: desk.maxLabels,
      lowLabel: byIdx(low), highLabel: byIdx(high),
      spareLabel: spare >= 0 ? byIdx(spare) : null,
    };
  });
  if (!tlab.ok) fail(`over-ship threat labels (#165): ${tlab.reason}`);
  else {
    // (A) each shown label MATCHES its class/tier (tied to the pure class→label read):
    if (!tlab.lowLabel || !tlab.lowLabel.shown) fail('over-ship threat labels (#165): the near tame hull shows NO label — you cannot read her');
    if (!tlab.highLabel || !tlab.highLabel.shown) fail('over-ship threat labels (#165): the near deadly hull shows NO label — you cannot read her');
    const expLow = threatLabelFor({ label: tlab.lowClassLabel, tier: tlab.lowTier });
    const expHigh = threatLabelFor({ label: tlab.highClassLabel, tier: tlab.highTier });
    if (tlab.lowLabel.text !== expLow.text) fail(`over-ship threat labels (#165): the tame hull's label "${tlab.lowLabel.text}" ≠ her class read "${expLow.text}"`);
    if (tlab.highLabel.text !== expHigh.text) fail(`over-ship threat labels (#165): the deadly hull's label "${tlab.highLabel.text}" ≠ her class read "${expHigh.text}"`);
    // (B) the deadlier hull reads STRICTLY more dangerous — more skulls (a man-o'-war ≫ a sloop):
    if (!(tlab.highTier > tlab.lowTier)) fail(`over-ship threat labels (#165): the fleet lost tier spread (low=${tlab.lowTier}, high=${tlab.highTier}) — cannot prove threat ordering`);
    if (!(skulls(tlab.highLabel.glyphs) > skulls(tlab.lowLabel.glyphs))) fail(`over-ship threat labels (#165): the deadly hull did not read more dangerous than the tame one (${tlab.highLabel.glyphs} vs ${tlab.lowLabel.glyphs})`);
    // (C-i) declutter: the hull sent over the horizon is CULLED (no smothering the far sea):
    if (tlab.spare >= 0 && tlab.spareLabel && tlab.spareLabel.shown) fail('over-ship threat labels (#165): a hull far over the horizon still rendered a label — the far sea is not decluttered');
    // (C-ii) mobile guard (#146): a phone caps the label COUNT below desktop:
    await page.setViewport({ width: 400, height: 860 });
    const phoneMax = await page.evaluate(() => window.__tidewake.qaSyncThreatLabels().maxLabels);
    await page.setViewport({ width: 1280, height: 800 });
    if (!(phoneMax < tlab.deskMax)) fail(`over-ship threat labels (#165): a phone did not cap labels below desktop (phone=${phoneMax}, desk=${tlab.deskMax}) — a small screen could be smothered`);
    if (process.exitCode !== 1) console.log(`  ✓ over-ship threat labels (#165): "${tlab.lowLabel.text}" (prey) vs "${tlab.highLabel.text}" (deadly) — text+glyph match class/tier, threat reads STRICTLY higher, far hull culled, phone caps ${phoneMax}<${tlab.deskMax}`);
  }

  // 2b3-labels-coexist) THREAT LABEL ↔ TARGET RING coexistence (#165 × #161 s3): the two consumers of the
  // over-ship billboard must share one anchor cleanly. Engage a foe deterministically, then assert she
  // carries BOTH the target RING (markerShown) AND a threat LABEL on the SAME screen column, while the
  // non-combatant traffic's labels RECEDE (declutter) so the duel reads clean.
  const coexist = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    tw.newVoyage(); tw.step(0.1);
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false };
    for (let i = 0; i < 16; i++) tw.step(0.05);          // let the quarter-view camera swing settle
    const ring = tw.qaSyncTargetMarker();                // ring aligned to the current camera
    const labels = tw.qaSyncThreatLabels();              // labels aligned to the SAME camera frame
    const foeIdx = tw.battle.foeIndex;
    const foeLabel = labels.labels.find((l) => l.index === foeIdx) || null;
    const trafficShown = labels.labels.filter((l) => l.index !== foeIdx && l.shown).length;
    tw.fleeBattle(); tw.step(0.05);
    return { engaged, foeIdx, ringShown: ring.markerShown, ringScreen: ring.screen,
      foeLabelShown: !!(foeLabel && foeLabel.shown), foeLabelScreen: foeLabel ? foeLabel.screen : null,
      foeLabelText: foeLabel ? foeLabel.text : '', trafficShown, npcCount: tw.npcs.length };
  });
  if (!coexist.engaged) {
    console.warn('  (#165 coexistence: no foe to engage — skipped, like the other battle steps)');
  } else {
    if (!coexist.ringShown) fail('over-ship threat labels (#165): the engaged foe carries no target ring — cannot verify ring+label coexistence');
    if (!coexist.foeLabelShown) fail('over-ship threat labels (#165): the engaged foe carries no threat label alongside her ring');
    if (coexist.ringScreen && coexist.foeLabelScreen && Math.abs(coexist.ringScreen[0] - coexist.foeLabelScreen[0]) > 2) {
      fail(`over-ship threat labels (#165): the foe's ring + label are NOT on the same anchor (Δx=${Math.abs(coexist.ringScreen[0] - coexist.foeLabelScreen[0]).toFixed(1)}px)`);
    }
    if (coexist.npcCount > 1 && coexist.trafficShown !== 0) fail(`over-ship threat labels (#165): non-combatant labels did not recede in a fight (${coexist.trafficShown} still shown) — the duel is cluttered`);
    if (process.exitCode !== 1) console.log(`  ✓ threat label ↔ target ring coexist (#165 × #161 s3): the foe shows ring + "${coexist.foeLabelText}" on one anchor; traffic labels recede — the duel reads clean`);
  }

  // 2b3-odds) LEGIBLE ODDS (#166, epic #162 slice 4): the owner's fair-fight contract, made READABLE —
  // "SKILL sets the odds, LUCK swings the margin." Prove, all deterministic + headless: (A) the odds
  // verdict reflects the DETERMINISTIC class matchup — outclassing a merchant sloop reads FAVOURED, a
  // man-o'-war vs your sloop reads DIRE; (B) the shown margin band IS the ±20% luck bound (0.8/1.2/±20%),
  // not a hidden roll; (C) luck can NEVER flip a strongly-favoured verdict (the band sits wholly on the
  // favoured side); (D) the read is actually DOCKED + shown in the aim-indicator slot during a real fight.
  {
    const sloopPrey = shipStats('sloop', 'merchant');   // easy prey — feeble guns, thin hull
    const manowar = shipStats('manowar', 'warship');    // the terror — heavy guns, full hull
    const mySloop = shipStats('sloop', 'warship');      // you, in a small toothy sloop
    const ROUND = { hullMult: 1, returnMult: 1, aimForgive: 0 };
    // (A)+(B)+(C): probe the canonical matchups head-on through the LIVE game's odds model (the SAME
    // combatOdds the DOM readout uses), so the gate proves the read the player sees is fair + legible.
    const oc = await page.evaluate((args) => {
      const tw = window.__tidewake;
      const fav = tw.odds({ playerHull: 100, enemyHull: args.prey.hull, gunnery: args.prey.gunnery, ammo: args.round });
      const dire = tw.odds({ playerHull: args.me.hull, enemyHull: args.war.hull, gunnery: args.war.gunnery, ammo: args.round });
      return { fav, dire };
    }, { prey: sloopPrey, war: manowar, me: mySloop, round: ROUND });
    // (A) the matchup reads right:
    if (!oc.fav.favoured || oc.fav.tier !== 'dominant') fail(`legible odds (#166): outclassing a merchant sloop did not read favoured (tier=${oc.fav.tier}, favoured=${oc.fav.favoured})`);
    if (oc.dire.favoured || oc.dire.tier !== 'dire') fail(`legible odds (#166): a man-o'-war vs your sloop did not read dire (tier=${oc.dire.tier}, favoured=${oc.dire.favoured})`);
    // (B) the shown margin band == the ACTUAL ±20% luck bound (not a hidden dice roll):
    if (!(oc.fav.luckLo === 0.8 && oc.fav.luckHi === 1.2 && oc.fav.marginPct === 20)) fail(`legible odds (#166): the shown margin band is not the ±20% luck bound (lo=${oc.fav.luckLo}, hi=${oc.fav.luckHi}, ±${oc.fav.marginPct}%)`);
    // (C) luck can't flip a strongly-favoured verdict — the whole band sits on the favoured side of centre:
    if (!oc.fav.stronglyFavoured) fail('legible odds (#166): a merchant-sloop matchup did not read strongly-favoured — luck could wrongly flip it');
    if (!(oc.fav.bar.lo > 0.5)) fail(`legible odds (#166): the favoured band straddled the even line (bar.lo=${oc.fav.bar.lo.toFixed(3)}) — luck could flip a won fight`);
    if (!oc.dire.hopeless || !(oc.dire.bar.hi <= 0.5)) fail(`legible odds (#166): the dire band did not sit wholly on her side (bar.hi=${oc.dire.bar.hi.toFixed(3)}) — luck could wrongly save it`);
    // (D) the read is actually docked + SHOWN in the aim-indicator slot during a live fight:
    const live = await page.evaluate(async () => {
      const tw = window.__tidewake;
      function nearest() { const s = tw.state.pos; let bi = -1, bd = Infinity;
        for (let i = 0; i < tw.npcs.length; i++) { const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]); if (d < bd) { bd = d; bi = i; } }
        return bi; }
      tw.newVoyage(); tw.step(0.1);
      const bi = nearest(); if (bi === -1) return { engaged: false };
      const fp = tw.npcs[bi].pos; tw.qaTeleport(fp[0], fp[1] - 120); tw.step(0.05);
      const engaged = tw.engageBattle(); if (!engaged) return { engaged: false };
      for (let i = 0; i < 16; i++) tw.step(0.05);   // let the quarter-view camera settle so the line projects on screen
      const o = tw.odds();
      tw.fleeBattle(); tw.step(0.05);
      const afterFlee = tw.odds();
      return { engaged, verdict: o.live.verdict, tier: o.live.tier, shown: o.live.shown, active: o.live.active,
        marginPct: o.live.marginPct, clearedAfterFlee: !afterFlee.live.active };
    });
    if (!live.engaged) {
      console.warn('  (#166 legible odds: no foe to engage for the live-dock check — pure matchup proofs A–C still ran)');
    } else {
      if (!live.active || !live.verdict) fail('legible odds (#166): no live odds verdict during a real fight — the fair-fight read is missing');
      if (!live.shown) fail('legible odds (#166): the odds read is not SHOWN in the aim-indicator slot during a fight');
      if (live.marginPct !== 20) fail(`legible odds (#166): the live margin band is not ±20% (got ±${live.marginPct}%)`);
      if (!live.clearedAfterFlee) fail('legible odds (#166): the odds read did not clear when the fight ended');
    }
    if (process.exitCode !== 1) console.log(`  ✓ legible odds (#166): sloop prey reads "${oc.fav.verdict}" (band right of even), man-o'-war reads "${oc.dire.verdict}" (band left); margin band == ±20% luck; luck can't flip a strong verdict${live.engaged ? `; live read "${live.verdict}" docked in the aim slot` : ''}`);
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

  // 2b4b) RENDERED CANNONBALLS (#161 slice 4): the owner's marquee complaint — "we should see the cannon
  // balls, the angles should matter." The broadside was pure MATH (a camera kick + the word "ABEAM"); now
  // a fired volley SPAWNS a visible spread of round-shot arcing from the guns, a muzzle puff, and a spark
  // ON the foe for a clean beam hit vs a SPLASH in open water for a wide shot — pooled/instanced (2 draws,
  // 0 growth), driven off the SAME resolved shot (broadsideAim.inArc + resolveBroadside.enemyHit). Engage
  // deterministically, fire ONE WIDE shot (bow-on, out of arc → a splash) and ONE CLEAN shot (abeam, in
  // arc → a spark), and assert: a volley spawns iron + a muzzle bark, and hit ≠ miss (spark vs splash).
  const cballs = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity; // state.pos is [x,y,z]
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);            // drop just off her — inside engage range
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false };
    const foeIdx = tw.battle.foeIndex;             // LATCHED for the fight — position the ship against it
    const before = tw.battleProjectiles().spawned; // {balls,muzzles,hits,splashes} — monotone tallies
    // Convention (battle.js broadsideAim): forward=(sin h, cos h), right=(cos h, −sin h). We place the
    // ship, then fire the SAME frame (no step, so the latched foe stays put + the AI can't re-beam).
    // (1) A WIDE shot: put the foe DEAD AHEAD (bow-on → out of the broadside arc) → a MISS → a SPLASH.
    const F = tw.npcs[foeIdx].pos, h = tw.state.heading;
    tw.qaTeleport(F[0] - Math.sin(h) * 120, F[1] - Math.cos(h) * 120);
    const wideAim = tw.battleAim();                // expect inArc:false (foe off the bow, not the beam)
    tw.battleFire();
    const afterWideFire = tw.battleProjectiles().spawned;
    for (let i = 0; i < 12; i++) tw.step(0.12);    // let the iron fly its arc and splash in open water
    const afterWideLand = tw.battleProjectiles().spawned;
    // (2) A CLEAN shot: put the foe ABEAM (starboard → in the arc) → a HIT → a SPARK. Wait out the reload.
    for (let i = 0; i < 16 && !tw.battle.loaded && tw.battle.active; i++) tw.step(0.2);
    const F2 = tw.npcs[foeIdx].pos, h2 = tw.state.heading;
    tw.qaTeleport(F2[0] - Math.cos(h2) * 120, F2[1] + Math.sin(h2) * 120);
    const cleanAim = tw.battleAim();               // expect inArc:true (foe dead abeam)
    const firedClean = tw.battle.active && tw.battle.loaded;
    if (firedClean) tw.battleFire();
    for (let i = 0; i < 12; i++) tw.step(0.12);    // let the clean volley land its spark
    const afterClean = tw.battleProjectiles().spawned;
    if (tw.battle.active) tw.fleeBattle();
    return { engaged, before, wideInArc: wideAim.inArc, afterWideFire, afterWideLand,
      firedClean, cleanInArc: cleanAim.inArc, afterClean };
  });
  if (!cballs.engaged) {
    console.warn('  (#161 slice 4 rendered cannonballs: no foe to engage — skipped, like the other battle steps)');
  } else {
    if (cballs.wideInArc) fail('rendered cannonballs (#161 slice 4): the bow-on "wide" shot was in-arc — the miss geometry failed, cannot verify miss≠hit');
    if (!(cballs.afterWideFire.balls > cballs.before.balls)) fail(`rendered cannonballs (#161 slice 4): firing a broadside spawned NO cannonballs (balls ${cballs.before.balls}→${cballs.afterWideFire.balls}) — the shot is still invisible`);
    if (!(cballs.afterWideFire.muzzles > cballs.before.muzzles)) fail('rendered cannonballs (#161 slice 4): firing spawned no muzzle puff at the guns');
    if (!(cballs.afterWideLand.splashes > cballs.before.splashes)) fail(`rendered cannonballs (#161 slice 4): a WIDE shot produced no splash (splashes ${cballs.before.splashes}→${cballs.afterWideLand.splashes}) — a miss must splash in open water`);
    if (cballs.afterWideLand.hits > cballs.before.hits) fail(`rendered cannonballs (#161 slice 4): a WIDE (out-of-arc) shot wrongly sparked a HIT (hits ${cballs.before.hits}→${cballs.afterWideLand.hits}) — a miss must NOT read as a hit`);
    if (!cballs.firedClean) {
      fail('rendered cannonballs (#161 slice 4): could not fire the clean abeam shot (never reloaded) — cannot verify the hit spark');
    } else {
      if (!cballs.cleanInArc) fail('rendered cannonballs (#161 slice 4): the abeam "clean" shot was out-of-arc — the hit geometry failed');
      if (!(cballs.afterClean.hits > cballs.afterWideLand.hits)) fail(`rendered cannonballs (#161 slice 4): a CLEAN in-arc shot produced no hit spark (hits ${cballs.afterWideLand.hits}→${cballs.afterClean.hits}) — a hit must read differently from a miss`);
      if (process.exitCode !== 1) console.log(`  ✓ rendered cannonballs (#161 slice 4): a broadside spawns iron + a muzzle bark; a wide shot SPLASHES (${cballs.afterWideLand.splashes}) while a clean beam shot SPARKS (${cballs.afterClean.hits}) — hit ≠ miss, off the resolved shot`);
    }
  }

  // 2b4c) COMBAT GAME-FEEL "JUICE" PASS (#80): make the (now-visible) hit LAND. A clean broadside that
  // BITES her rocks the view (a camera kick on the SAME shake stack the recoil uses — one effect,
  // generalised) AND owes a brief HIT-STOP (a few-frame sim freeze); the freeze is bounded + drains on
  // real time so it decays cleanly to zero and can NEVER stall the loop; and the whole pass is fully
  // suppressed (no shake, no freeze, no residual offset) when the "Combat feel" toggle is off. The
  // impact→intensity SCALING is unit-tested (tests/unit/juice.test.mjs); here we prove the wiring:
  // event→shake/hit-stop, decay-to-zero, and toggle-off suppression, end to end in the real game.
  const juicePass = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    // Bring a foe abeam and fire a CLEAN shot (the same geometry the cannonballs test uses).
    function fireClean() {
      const foeIdx = tw.battle.foeIndex;
      const F = tw.npcs[foeIdx].pos, h = tw.state.heading;
      tw.qaTeleport(F[0] - Math.cos(h) * 120, F[1] + Math.sin(h) * 120); // foe dead abeam to starboard
      const aim = tw.battleAim();
      if (!(tw.battle.active && tw.battle.loaded && aim.inArc)) return false;
      tw.battleFire();
      return true;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);
    tw.step(0.05);
    if (!tw.engageBattle()) return { engaged: false };

    // (1) EVENT → HIT-STOP + SHAKE: a clean landed broadside owes a freeze and rocks the view.
    for (let i = 0; i < 16 && !tw.battle.loaded && tw.battle.active; i++) tw.step(0.2);
    const firedClean = fireClean();
    const afterFire = tw.juice; // read BEFORE any consume/step — the freeze is still owed
    // (2) DECAY-TO-ZERO + BOUNDED: drain the freeze the way loop() does (on real dt); it must reach 0
    //     in a bounded number of frames (it can NEVER stall the loop), each frozen frame returning 0.
    let drainFrames = 0, sawFrozen = false, everScaleAfter = 1;
    while (tw.juice.hitStop > 0) {
      const scale = tw.juiceConsumeHitStop(1 / 60);
      if (scale === 0) sawFrozen = true;
      if (++drainFrames > 30) break; // guard: a runaway freeze would trip this (a stall)
    }
    everScaleAfter = tw.juiceConsumeHitStop(1 / 60); // once drained, the sim runs at full speed
    const afterDrain = tw.juice;

    // (3) TOGGLE OFF → FULL SUPPRESSION, NO RESIDUAL: turning "Combat feel" off clears live effects,
    //     and a fresh clean broadside produces no freeze and no camera offset (fully playable).
    const offSnap = tw.juiceSetEnabled(false); // clears any live shake/flash/freeze immediately
    for (let i = 0; i < 16 && !tw.battle.loaded && tw.battle.active; i++) tw.step(0.2);
    const firedWhileOff = fireClean();
    tw.step(1 / 60);
    const afterFireOff = tw.juice;
    const offScale = tw.juiceConsumeHitStop(1 / 60); // no freeze owed while off → full speed
    tw.juiceSetEnabled(true); // restore the default
    if (tw.battle.active) tw.fleeBattle();
    return {
      engaged: true, firedClean, afterFire, sawFrozen, drainFrames, everScaleAfter, afterDrain,
      offEnabled: offSnap.enabled, offResidualOffset: offSnap.offsetMag, offResidualStop: offSnap.hitStop,
      firedWhileOff, afterFireOff, offScale,
    };
  });
  if (!juicePass.engaged || !juicePass.firedClean) {
    console.warn('  (#80 combat game-feel juice pass: no foe to engage / never reloaded — skipped, like the other battle steps)');
  } else {
    // (1) the clean hit LANDED: it owed a real, BOUNDED hit-stop.
    if (!(juicePass.afterFire.hitStop > 0)) fail(`combat juice (#80): a clean landed broadside owed NO hit-stop (hitStop=${juicePass.afterFire.hitStop}) — the hit does not FEEL like it lands`);
    if (!(juicePass.afterFire.hitStop <= 0.1)) fail(`combat juice (#80): the hit-stop is NOT bounded (hitStop=${juicePass.afterFire.hitStop} > 0.1s) — a freeze this long risks a stall`);
    if (!(juicePass.afterFire.offsetMag > 0)) fail(`combat juice (#80): a clean hit did not rock the view (offsetMag=${juicePass.afterFire.offsetMag}) — no camera kick on impact`);
    // (2) the freeze DECAYS to zero, was actually felt (a frozen frame), and never ran away (no stall).
    if (!juicePass.sawFrozen) fail('combat juice (#80): the hit-stop never froze a frame (consumeHitStop never returned 0) — no felt freeze');
    if (!(juicePass.drainFrames <= 8)) fail(`combat juice (#80): the hit-stop took ${juicePass.drainFrames} frames to drain (>8) — an unbounded freeze can STALL the loop`);
    if (!(juicePass.afterDrain.hitStop === 0)) fail(`combat juice (#80): the hit-stop did not decay to zero (residual hitStop=${juicePass.afterDrain.hitStop})`);
    if (!(juicePass.everScaleAfter === 1)) fail(`combat juice (#80): the sim did not resume full speed after the freeze (scale=${juicePass.everScaleAfter}) — the world clock could desync`);
    // (3) TOGGLE OFF fully suppresses — no residual, and a fresh hit produces nothing.
    if (juicePass.offEnabled !== false) fail('combat juice (#80): the runtime toggle did not turn the juice off');
    if (!(juicePass.offResidualOffset === 0)) fail(`combat juice (#80): toggling off left a RESIDUAL camera offset (${juicePass.offResidualOffset}) — motion must fully cease`);
    if (!(juicePass.offResidualStop === 0)) fail(`combat juice (#80): toggling off left a residual freeze (${juicePass.offResidualStop})`);
    if (juicePass.firedWhileOff && !(juicePass.afterFireOff.hitStop === 0 && juicePass.afterFireOff.offsetMag === 0)) fail(`combat juice (#80): firing with the toggle OFF still produced motion (hitStop=${juicePass.afterFireOff.hitStop}, offsetMag=${juicePass.afterFireOff.offsetMag}) — juice-off must be fully still`);
    if (!(juicePass.offScale === 1)) fail(`combat juice (#80): the sim was frozen while the juice toggle is OFF (scale=${juicePass.offScale}) — juice-off must be fully playable`);
    if (process.exitCode !== 1) console.log(`  ✓ combat game-feel juice (#80): a clean hit LANDS — a ${juicePass.afterFire.hitStop.toFixed(3)}s hit-stop + a camera kick (offsetMag ${juicePass.afterFire.offsetMag.toFixed(2)}), decays to zero in ${juicePass.drainFrames} frames (bounded, no stall), and toggles fully OFF (no residual motion)`);
  }

  // 2b4d) #80 CLIMAX — the NOTORIOUS KILL lands (deferred #80 event): sinking a WANTED bounty vessel
  // (#173) punctuates harder than an ordinary kill — the full (capped) hit-stop AND a bounded beat of
  // SLOW-MO (time-dilation) before the world snaps back. The slow-mo drains on real time exactly like
  // the base hit-stop, so it is bounded, always auto-resumes, and can NEVER stall the sim. We drive the
  // REAL wiring: engage → mark her the wanted vessel → land a clean killing shot → assert the climax.
  const climaxKill = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    function fireClean() {
      const foeIdx = tw.battle.foeIndex;
      const F = tw.npcs[foeIdx].pos, h = tw.state.heading;
      tw.qaTeleport(F[0] - Math.cos(h) * 120, F[1] + Math.sin(h) * 120); // foe dead abeam to starboard
      const aim = tw.battleAim();
      if (!(tw.battle.active && tw.battle.loaded && aim.inArc)) return false;
      tw.battleFire();
      return true;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);
    tw.step(0.05);
    if (!tw.engageBattle()) return { engaged: false };
    // Mark her the WANTED vessel (the real #173 objective), then stage & land a clean killing shot.
    const marked = tw.qaMarkFoeAsBounty();
    const isBounty = !!(marked && marked.kind === 'bounty');
    for (let i = 0; i < 16 && !tw.battle.loaded && tw.battle.active; i++) tw.step(0.2);
    tw.battleForceSink();
    const firedKill = fireClean();
    const result = tw.battle.result;
    const afterKill = tw.juice; // read BEFORE any consume — the freeze + slow-mo are still owed
    // Drain the whole climax the way loop() does (on real dt): freeze first (scale 0), then slow-mo
    // (0 < scale < 1), then full speed — bounded, always resuming (it can NEVER stall the loop).
    let frames = 0, sawFrozen = false, sawSlowMo = false;
    while (tw.juice.hitStop > 0 || tw.juice.timeDilation > 0) {
      const scale = tw.juiceConsumeHitStop(1 / 60);
      if (scale === 0) sawFrozen = true;
      else if (scale > 0 && scale < 1) sawSlowMo = true;
      if (++frames > 120) break; // guard: a runaway climax would trip this (a stall)
    }
    const resumed = tw.juiceConsumeHitStop(1 / 60);
    const afterDrain = tw.juice;
    // Toggle OFF → the climax is fully suppressed (no freeze, no slow-mo, no camera motion).
    tw.juiceSetEnabled(false);
    const offSnap = tw.juiceBountyKill(); // fire the notorious-kill beat with the juice OFF
    tw.juiceSetEnabled(true);
    if (tw.battle.active) tw.fleeBattle();
    return {
      engaged: true, isBounty, firedKill, result, afterKill, sawFrozen, sawSlowMo, frames,
      resumed, afterDrain, offTimeDil: offSnap.timeDilation, offStop: offSnap.hitStop, offOffset: offSnap.offsetMag,
    };
  });
  if (!climaxKill.engaged || !climaxKill.firedKill) {
    console.warn('  (#80 climax notorious-kill: no foe to engage / never reloaded — skipped, like the other battle steps)');
  } else {
    if (!climaxKill.isBounty) fail('#80 climax: could not mark the engaged foe as a wanted bounty vessel');
    if (climaxKill.result !== 'win') fail(`#80 climax: the killing shot did not sink the wanted vessel (result=${climaxKill.result})`);
    // (1) the NOTORIOUS kill lands the full freeze AND owes a beat of slow-mo (an ordinary kill does not).
    if (!(climaxKill.afterKill.hitStop > 0)) fail(`#80 climax: a bounty kill owed NO hit-stop (${climaxKill.afterKill.hitStop}) — the notorious kill does not LAND`);
    if (!(climaxKill.afterKill.timeDilation > 0)) fail(`#80 climax: a bounty kill owed NO slow-mo/time-dilation (${climaxKill.afterKill.timeDilation}) — the kill does not FEEL notorious`);
    // (2) freeze → slow-mo → full speed: bounded, actually felt, and never runs away (no stall).
    if (!climaxKill.sawFrozen) fail('#80 climax: the bounty kill never froze a frame (no hit-stop felt)');
    if (!climaxKill.sawSlowMo) fail('#80 climax: the bounty kill never dropped into slow-mo (no time-dilation felt)');
    if (!(climaxKill.frames <= 60)) fail(`#80 climax: the climax took ${climaxKill.frames} frames to drain (>60) — an unbounded slow-mo can STALL the loop`);
    if (!(climaxKill.afterDrain.hitStop === 0 && climaxKill.afterDrain.timeDilation === 0)) fail(`#80 climax: the climax did not decay to zero (hitStop=${climaxKill.afterDrain.hitStop}, timeDilation=${climaxKill.afterDrain.timeDilation})`);
    if (!(climaxKill.resumed === 1)) fail(`#80 climax: the sim did not resume full speed after the slow-mo (scale=${climaxKill.resumed}) — the world clock could desync`);
    // (3) TOGGLE OFF fully suppresses the notorious-kill beat.
    if (!(climaxKill.offTimeDil === 0 && climaxKill.offStop === 0 && climaxKill.offOffset === 0)) fail(`#80 climax: a bounty kill with the toggle OFF still produced juice (timeDil=${climaxKill.offTimeDil}, stop=${climaxKill.offStop}, offset=${climaxKill.offOffset})`);
    if (process.exitCode !== 1) console.log(`  ✓ #80 climax — a NOTORIOUS kill LANDS: full freeze + a bounded beat of slow-mo (${climaxKill.afterKill.timeDilation.toFixed(2)}s), decays to zero in ${climaxKill.frames} frames (no stall), and fully OFF under the toggle`);
  }

  // 2b5-aim) AIM-ANGLE FEEDBACK (#161 slice 5): the owner's note — "the angles should matter." They DO
  // in the maths (broadsideAim); this slice makes the firing solution VISIBLE — an aim LINE from your
  // ship to the foe that colours + TIGHTENS as she comes abeam, so you can SEE "I'm on target" before
  // SPACE. Read-only off broadsideAim. Engage, prove the beam is DRAWN, then position the foe BOW-ON
  // (off-target, wide cone) vs ABEAM (on-target, tight cone) and assert the readout + the cone tightening.
  const aimfb = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity; // state.pos is [x,y,z]
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);            // drop just off her — inside engage range
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false };
    const foeIdx = tw.battle.foeIndex;             // LATCHED for the fight — position the ship against it
    for (let i = 0; i < 16; i++) tw.step(0.05);    // let the quarter-view camera swing settle so she frames
    const drawn = tw.aimIndicator();               // the beam should be DRAWN + active with a foe in frame
    // Convention (battle.js broadsideAim): forward=(sin h, cos h), right=(cos h, −sin h). Same-frame reads
    // (no step) so the latched foe stays put and the AI can't re-beam between placement and the readout.
    // (1) BOW-ON: put the foe DEAD AHEAD → out of the broadside arc → OFF TARGET, widest cone.
    const F = tw.npcs[foeIdx].pos, h = tw.state.heading;
    tw.qaTeleport(F[0] - Math.sin(h) * 120, F[1] - Math.cos(h) * 120);
    const bowOn = tw.aimIndicator();
    // (2) ABEAM: put the foe dead off the starboard beam → in the arc → ON TARGET, tightest cone.
    const F2 = tw.npcs[foeIdx].pos, h2 = tw.state.heading;
    tw.qaTeleport(F2[0] - Math.cos(h2) * 120, F2[1] + Math.sin(h2) * 120);
    const abeam = tw.aimIndicator();
    const fled = tw.fleeBattle();
    tw.step(0.05);
    const afterFlee = tw.aimIndicator();
    return { engaged, drawn, bowOn, abeam, fled, afterFlee };
  });
  if (!aimfb.engaged) {
    console.warn('  (#161 slice 5 aim-angle feedback: no foe to engage — skipped, like the other battle steps)');
  } else {
    if (!aimfb.drawn.active) fail('aim-angle feedback (#161 slice 5): the aim readout did not activate on engage');
    if (!aimfb.drawn.beamShown) fail('aim-angle feedback (#161 slice 5): the aim LINE is not drawn while engaged — the player cannot SEE their firing solution');
    // The core "can I see when I'm on target?" proof: bow-on reads OFF, abeam reads ON — hit ≠ miss geometry.
    if (aimfb.bowOn.onTarget) fail('aim-angle feedback (#161 slice 5): a BOW-ON foe wrongly read ON TARGET — the angle does not visibly matter');
    if (aimfb.bowOn.level !== 'off-target') fail(`aim-angle feedback (#161 slice 5): a bow-on foe did not read off-target (level=${aimfb.bowOn.level})`);
    if (!aimfb.abeam.onTarget) fail('aim-angle feedback (#161 slice 5): an ABEAM foe did NOT read ON TARGET — you cannot see when you are lined up');
    if (aimfb.abeam.level !== 'on-target') fail(`aim-angle feedback (#161 slice 5): an abeam foe did not read on-target (level=${aimfb.abeam.level})`);
    // The felt "tightens as you come abeam" beat, verified geometrically: the on-target cone is tighter.
    if (!(aimfb.abeam.spreadDeg < aimfb.bowOn.spreadDeg)) fail(`aim-angle feedback (#161 slice 5): coming abeam did not TIGHTEN the aim cone (abeam ${aimfb.abeam.spreadDeg} !< bow-on ${aimfb.bowOn.spreadDeg})`);
    if (aimfb.afterFlee.beamShown) fail('aim-angle feedback (#161 slice 5): the aim line lingered after fleeing — it must clear with the fight');
    if (process.exitCode !== 1) console.log(`  ✓ aim-angle feedback (#161 slice 5): the aim line is drawn + reads ON TARGET abeam (cone ${aimfb.abeam.spreadDeg.toFixed(0)}°) vs OFF bow-on (cone ${aimfb.bowOn.spreadDeg.toFixed(0)}°); clears on flee`);
  }

  // 2b6-hover) HOVER-TO-INTERACT (#161 slice 6, the FINAL lane slice): the owner's note — "interacting
  // with other ships should be hovering on the ship in the view, not like a HUD element." Now you POINT at
  // a ship (raycast the hull under the cursor) and it lights up with what you can DO to it — a projected
  // ring + a "Give battle / Hail / Board" label — and a CLICK routes to the SAME verb handler the keyboard
  // uses (engage / hail / board), no new mechanics. Two proofs: (A) OPEN SEA — a raycast under a screen
  // point RESOLVES to that ship + the disposition-correct action, the affordance shows, and clicking an
  // outlaw ENGAGES her; (B) BATTLE — the boardable foe reads 'board' and a click ROUTES to the boarding
  // handler (hands off to the captain's duel). Camera aimed via qaLookAtShip so the ray lands headlessly.
  const hover = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity; // state.pos is [x,y,z]
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    // (A) OPEN SEA — prefer an OUTLAW (a fair mark → 'target', a cleanly reversible click via fleeBattle);
    // fall back to the nearest hull (a merchant → 'hail', resolution-only, no click) if no outlaw is afloat.
    let seaIdx = tw.npcs.findIndex((n) => n.kind === 'pirate');
    if (seaIdx === -1) seaIdx = nearest();
    if (seaIdx === -1) return { ok: false };
    const outlaw = tw.npcs[seaIdx].kind === 'pirate';
    const fp = tw.npcs[seaIdx].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);          // drop inside CHALLENGE_RANGE (200) of her
    tw.step(0.05);
    tw.qaLookAtShip(seaIdx);                     // aim the real camera at her (NO step after → the ray lands)
    const seaScr = tw.qaShipScreen(seaIdx);
    const seaPick = tw.qaPickAt(seaScr.x, seaScr.y);   // raycast under the screen point → which ship + action
    const seaHover = tw.qaHoverAt(seaScr.x, seaScr.y); // the live over-ship affordance (ring + label)
    const expectedSea = outlaw ? 'target' : 'hail';
    let seaClickRouted = null;
    if (outlaw) {
      const c = tw.qaClickAt(seaScr.x, seaScr.y);      // CLICK an outlaw → engage THAT ship (battle.engage(idx))
      seaClickRouted = c.acted && tw.battle.active && tw.battle.foeIndex === seaIdx;
      if (tw.battle.active) tw.fleeBattle();            // reset for the battle leg
      tw.step(0.05);
    }

    // (B) BATTLE — engage a foe, batter her to boardable, point at her → 'board', CLICK routes to boarding.
    const bi = nearest();
    if (bi === -1) return { ok: true, seaOnly: true, seaIdx, seaScr, seaPick, seaHover, expectedSea, outlaw, seaClickRouted };
    const bfp = tw.npcs[bi].pos;
    tw.qaTeleport(bfp[0], bfp[1] - 120);
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { ok: true, seaOnly: true, seaIdx, seaScr, seaPick, seaHover, expectedSea, outlaw, seaClickRouted };
    const foeIdx = tw.battle.foeIndex;
    tw.battleWeaken(0.25);                       // beat her hull into the boardable window (≤30%)
    tw.step(0.05);
    const canBoard = tw.battle.canBoard;
    tw.qaLookAtShip(foeIdx);                      // aim at the foe (no step after)
    const foeScr = tw.qaShipScreen(foeIdx);
    const foePick = tw.qaPickAt(foeScr.x, foeScr.y);
    const foeHover = tw.qaHoverAt(foeScr.x, foeScr.y);
    const foeClick = tw.qaClickAt(foeScr.x, foeScr.y);  // CLICK → boardBattleJuiced() → hands to the duel
    const boardedRouted = foeClick.acted && foeClick.action === 'board' && !tw.battle.active && tw.duel.active;
    tw.newVoyage(); tw.step(0.05);               // clean slate for the following battle steps
    return { ok: true, seaIdx, seaScr, seaPick, seaHover, expectedSea, outlaw, seaClickRouted,
      engaged, foeIdx, canBoard, foeScr, foePick, foeHover, foeClick, boardedRouted };
  });
  if (!hover.ok) {
    console.warn('  (#161 slice 6 hover-to-interact: no NPC afloat to point at — skipped, like the other battle steps)');
  } else {
    // (A) open-sea resolution + affordance
    if (!hover.seaScr.onScreen) fail('hover-to-interact (#161 slice 6): the aimed ship did not project on-screen — cannot verify the raycast');
    if (hover.seaPick.index !== hover.seaIdx) fail(`hover-to-interact (#161 slice 6): a raycast under the ship's screen point resolved to the wrong hull (got ${hover.seaPick.index}, expected ${hover.seaIdx}) — the sea is not pickable`);
    if (hover.seaPick.action !== hover.expectedSea) fail(`hover-to-interact (#161 slice 6): the pointed-at ship offered the wrong action (got ${hover.seaPick.action}, expected ${hover.expectedSea})`);
    if (!hover.seaHover.shown) fail('hover-to-interact (#161 slice 6): the hover affordance did not SHOW over the pointed-at ship — nothing lights up');
    if (!(hover.seaHover.label && hover.seaHover.label.length > 0)) fail('hover-to-interact (#161 slice 6): the affordance carried NO action label — the player cannot see what a click will do');
    if (hover.outlaw && !hover.seaClickRouted) fail('hover-to-interact (#161 slice 6): clicking an outlaw did NOT engage THAT ship (the click did not route to battle.engage(index))');
    // (B) battle board resolution + routing
    if (!hover.seaOnly) {
      if (!hover.canBoard) fail('hover-to-interact (#161 slice 6): could not batter the foe to the boardable window — cannot verify the board affordance');
      if (hover.foePick.index !== hover.foeIdx) fail(`hover-to-interact (#161 slice 6): a raycast under the FOE\'s screen point resolved to the wrong hull (got ${hover.foePick.index}, foe ${hover.foeIdx})`);
      if (hover.foePick.action !== 'board') fail(`hover-to-interact (#161 slice 6): the boardable foe did not offer 'board' (got ${hover.foePick.action})`);
      if (!hover.foeHover.shown) fail('hover-to-interact (#161 slice 6): the board affordance did not show over the foe');
      if (!hover.boardedRouted) fail('hover-to-interact (#161 slice 6): CLICKING the boardable foe did not route to the boarding handler (battle→duel hand-off)');
      if (process.exitCode !== 1) console.log(`  ✓ hover-to-interact (#161 slice 6): pointing at a ship resolves the hull + the right action (sea='${hover.expectedSea}', foe='board') and a CLICK routes to the existing verb (engage/board) — the sea is directly manipulable`);
    } else if (process.exitCode !== 1) {
      console.log(`  ✓ hover-to-interact (#161 slice 6): pointing at a ship resolves the hull + the right action ('${hover.expectedSea}') with the affordance shown (battle leg skipped — no second foe)`);
    }
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

  // 2b7) Buy a cannon at the Gunner's Workshop (#170, epic #168 "The Rise") — the owner's canonical fun
  // beat, and the lane's ONE save bump (v17→v18). Prove all three payoffs: buying deducts coin + adds a
  // cannon you SEE on the deck (the revealed gun mesh) + a heavier broadside you FEEL (more hull bite),
  // and it PERSISTS across a reload (v18 round-trip). Deterministic — driven through the QA hooks.
  const gun = await page.evaluate(() => {
    const tw = window.__tidewake;
    // Start from a clean, well-funded slate so the purchase math is legible.
    tw.qaSetLedger({ coins: 5000, infamy: 0, standing: 0 });
    const g0 = tw.gunUpgrade;
    const bite = tw.qaBroadsideBite();               // FEEL: base battery vs a full one, same clean shot
    const buy1 = tw.buyCannon();                     // spend coin → +1 cannon
    const g1 = tw.gunUpgrade;
    const coinsAfter = tw.state.coins;
    const buy2 = tw.buyCannon();
    const g2 = tw.gunUpgrade;
    // Walk to the cap and confirm it refuses beyond it (smallest always-shippable increment).
    let guard = tw.buyCannon(); let g = tw.gunUpgrade;
    while (g.canBuy) { guard = tw.buyCannon(); g = tw.gunUpgrade; }
    const overCap = tw.buyCannon();                  // one past the cap → refused
    return {
      startExtra: g0.extra, startShown: g0.deckGunsShown, startTotal: g0.total,
      bite,
      buy1ok: buy1.ok, buy1cost: buy1.cost, coinsAfter, startCoins: 5000,
      afterExtra: g1.extra, afterShown: g1.deckGunsShown, afterTotal: g1.total, afterMult: g1.broadsideMult, startMult: g0.broadsideMult,
      after2Extra: g2.extra, after2Shown: g2.deckGunsShown,
      cappedExtra: g.extra, cappedShown: g.deckGunsShown, max: g.max,
      overCapOk: overCap.ok, overCapReason: overCap.reason,
      shipClass: g0.shipClass,
    };
  });
  // SEE / HEAR / FEEL + the cap, all in one deterministic pass.
  if (gun.startExtra !== 0 || gun.startShown !== 0) fail(`buy a cannon (#170): a fresh voyage should start with the bare battery (extra=${gun.startExtra}, shown=${gun.startShown})`);
  if (!gun.buy1ok) fail('buy a cannon (#170): buying the first cannon failed with a full purse');
  if (gun.coinsAfter !== gun.startCoins - gun.buy1cost) fail(`buy a cannon (#170): coin not deducted correctly (started ${gun.startCoins}, cost ${gun.buy1cost}, now ${gun.coinsAfter})`);
  if (gun.afterExtra !== 1) fail(`buy a cannon (#170): owned-cannons did not increment (extra=${gun.afterExtra})`);
  if (gun.afterShown !== 1) fail(`buy a cannon (#170): the new cannon did NOT appear on the deck — SEE beat missing (shown=${gun.afterShown})`);
  if (gun.afterTotal !== gun.startTotal + 1) fail(`buy a cannon (#170): total guns did not climb (was ${gun.startTotal}, now ${gun.afterTotal})`);
  if (!(gun.afterMult > gun.startMult)) fail(`buy a cannon (#170): broadside multiplier did not rise — FEEL beat missing (${gun.startMult} → ${gun.afterMult})`);
  if (!(gun.bite.full > gun.bite.base)) fail(`buy a cannon (#170): more guns must bite harder (base ${gun.bite.base} vs full ${gun.bite.full}) — the broadside must land heavier`);
  if (gun.after2Shown !== 2) fail(`buy a cannon (#170): a second bought cannon did not show on deck (shown=${gun.after2Shown})`);
  if (gun.cappedExtra !== gun.max || gun.cappedShown !== gun.max) fail(`buy a cannon (#170): the deck-gun count did not track owned cannons up to the cap (extra=${gun.cappedExtra}, shown=${gun.cappedShown}, max=${gun.max})`);
  if (gun.overCapOk || gun.overCapReason !== 'maxed') fail(`buy a cannon (#170): buying past the cap should be refused as 'maxed' (ok=${gun.overCapOk}, reason=${gun.overCapReason})`);
  if (gun.shipClass !== 'sloop') fail(`buy a cannon (#170): the reserved owned ship-class (#171) should default to the sloop (got ${gun.shipClass})`);

  // PERSISTS across a reload — the v18 round-trip. The full battery (at the cap) must survive.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const gunPersist = await page.evaluate(() => {
    const tw = window.__tidewake;
    return { extra: tw.gunUpgrade.extra, shown: tw.gunUpgrade.deckGunsShown, total: tw.gunUpgrade.total, shipClass: tw.gunUpgrade.shipClass, saveVersion: tw.version };
  });
  if (gunPersist.extra !== gun.max) fail(`buy a cannon (#170): the bought cannons did NOT survive a reload (extra=${gunPersist.extra}, expected ${gun.max}) — the v18 save must round-trip`);
  if (gunPersist.shown !== gun.max) fail(`buy a cannon (#170): the deck guns were not re-mounted on a restored voyage (shown=${gunPersist.shown}) — a returning captain must SEE the guns they own`);
  if (gunPersist.shipClass !== 'sloop') fail(`buy a cannon (#170): the reserved ship-class did not round-trip (got ${gunPersist.shipClass})`);
  if (process.exitCode !== 1) console.log(`  ✓ buy a cannon (#170, THE RISE): purchase deducts coin (−${gun.buy1cost}c) + increments owned cannons + SHOWS the gun on deck (0→${gun.cappedShown}) + heavier broadside (bite ${gun.bite.base}→${gun.bite.full}, ×${gun.startMult}→×${gun.afterMult}); capped at ${gun.max}; SURVIVES a reload (v18 round-trip, ship-class reserved for #171)`);
  // Reset to a clean voyage so the later sections + the screenshot start from a known slate.
  await page.evaluate(() => window.__tidewake.newVoyage());

  // 2b7b) Buy a BIGGER SHIP at the Shipwright (#171, epic #168 "The Rise") — the biggest power fantasy,
  // riding #170's v18 save (NO further bump). Prove all payoffs in one deterministic pass: buying steps
  // the class UP + deducts coin, VISIBLY grows the hull mesh (a bigger classScale/meshScale = SEE), lifts
  // the class combat mults so a bigger hull hits harder AND soaks more (FEEL, proven through the real
  // broadside math), and it PERSISTS across a reload (the reserved v18 shipClass field round-trips).
  const shipBuy = await page.evaluate(() => {
    const tw = window.__tidewake;
    tw.qaSetLedger({ coins: 5000, infamy: 0, standing: 0 }); // a full purse so the whole ladder is reachable
    const s0 = tw.shipUpgrade;
    const sloopCombat = tw.qaPlayerClassCombat("sloop");
    const buy1 = tw.buyShipClass();          // sloop → brig
    const s1 = tw.shipUpgrade;
    const coinsAfter1 = tw.state.coins;
    const buy2 = tw.buyShipClass();          // brig → frigate
    const s2 = tw.shipUpgrade;
    const frigateCombat = tw.qaPlayerClassCombat("frigate");
    const overCap = tw.buyShipClass();       // frigate is this slice's top → refused as 'maxed'
    return {
      startClass: s0.shipClass, startScale: s0.classScale, startMesh: s0.meshScale,
      startBroadside: s0.broadsideMult, startArmor: s0.armor,
      buy1ok: buy1.ok, buy1cost: buy1.cost, startCoins: 5000, coinsAfter1,
      class1: s1.shipClass, scale1: s1.classScale, mesh1: s1.meshScale, broadside1: s1.broadsideMult, armor1: s1.armor,
      buy2ok: buy2.ok, class2: s2.shipClass, scale2: s2.classScale, mesh2: s2.meshScale, broadside2: s2.broadsideMult, armor2: s2.armor,
      overCapOk: overCap.ok, overCapReason: overCap.reason,
      sloopCombat, frigateCombat,
    };
  });
  if (shipBuy.startClass !== 'sloop') fail(`buy a bigger ship (#171): a fresh voyage should start on the sloop (got ${shipBuy.startClass})`);
  if (shipBuy.startScale !== 1) fail(`buy a bigger ship (#171): the sloop must be the ×1.0 baseline scale (got ${shipBuy.startScale})`);
  if (!shipBuy.buy1ok) fail('buy a bigger ship (#171): buying the brig failed with a full purse');
  if (shipBuy.class1 !== 'brig') fail(`buy a bigger ship (#171): the class did not step up to brig (got ${shipBuy.class1})`);
  if (shipBuy.coinsAfter1 !== shipBuy.startCoins - shipBuy.buy1cost) fail(`buy a bigger ship (#171): coin not deducted correctly (started ${shipBuy.startCoins}, cost ${shipBuy.buy1cost}, now ${shipBuy.coinsAfter1})`);
  if (!(shipBuy.scale1 > shipBuy.startScale)) fail(`buy a bigger ship (#171): the hull did not VISIBLY grow — SEE beat missing (classScale ${shipBuy.startScale} → ${shipBuy.scale1})`);
  if (!(shipBuy.mesh1 > shipBuy.startMesh)) fail(`buy a bigger ship (#171): the live mesh scale did not grow (${shipBuy.startMesh} → ${shipBuy.mesh1})`);
  if (!(shipBuy.broadside1 > shipBuy.startBroadside)) fail(`buy a bigger ship (#171): the class broadside multiplier did not rise — FEEL beat missing (${shipBuy.startBroadside} → ${shipBuy.broadside1})`);
  if (!(shipBuy.armor1 > shipBuy.startArmor)) fail(`buy a bigger ship (#171): the class armour did not rise — FEEL beat missing (${shipBuy.startArmor} → ${shipBuy.armor1})`);
  if (!shipBuy.buy2ok || shipBuy.class2 !== 'frigate') fail(`buy a bigger ship (#171): the class did not step up to frigate (ok=${shipBuy.buy2ok}, class=${shipBuy.class2})`);
  if (!(shipBuy.scale2 > shipBuy.scale1)) fail(`buy a bigger ship (#171): the frigate did not dwarf the brig (classScale ${shipBuy.scale1} → ${shipBuy.scale2})`);
  if (shipBuy.overCapOk || shipBuy.overCapReason !== 'maxed') fail(`buy a bigger ship (#171): buying past the frigate should be refused as 'maxed' (ok=${shipBuy.overCapOk}, reason=${shipBuy.overCapReason})`);
  // Combat REFLECTS the class: a frigate lands a heavier broadside AND takes less of her reply than a sloop.
  if (!(shipBuy.frigateCombat.enemyHit > shipBuy.sloopCombat.enemyHit)) fail(`buy a bigger ship (#171): a frigate must bite harder in combat (sloop ${shipBuy.sloopCombat.enemyHit} vs frigate ${shipBuy.frigateCombat.enemyHit})`);
  if (!(shipBuy.frigateCombat.playerHit < shipBuy.sloopCombat.playerHit)) fail(`buy a bigger ship (#171): a frigate must take LESS fire than a sloop (sloop ${shipBuy.sloopCombat.playerHit} vs frigate ${shipBuy.frigateCombat.playerHit})`);

  // PERSISTS across a reload — the reserved v18 shipClass field round-trips (NO new bump).
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const shipPersist = await page.evaluate(() => {
    const tw = window.__tidewake;
    const s = tw.shipUpgrade;
    return { shipClass: s.shipClass, classScale: s.classScale, meshScale: s.meshScale, saveVersion: tw.version };
  });
  if (shipPersist.shipClass !== 'frigate') fail(`buy a bigger ship (#171): the bought class did NOT survive a reload (got ${shipPersist.shipClass}) — the v18 shipClass field must round-trip`);
  if (!(shipPersist.classScale > 1)) fail(`buy a bigger ship (#171): the bigger hull was not re-grown on a restored voyage (classScale=${shipPersist.classScale}) — a returning captain must SEE the ship they own`);
  if (process.exitCode !== 1) console.log(`  ✓ buy a bigger ship (#171, THE RISE): steps class sloop→brig→frigate, deducts coin (−${shipBuy.buy1cost}c) + VISIBLY grows the hull (scale ×${shipBuy.startScale}→×${shipBuy.scale2.toFixed(2)}) + hits harder & soaks more (bite ${shipBuy.sloopCombat.enemyHit}→${shipBuy.frigateCombat.enemyHit}, fire taken ${shipBuy.sloopCombat.playerHit}→${shipBuy.frigateCombat.playerHit}); capped at frigate; SURVIVES a reload (v18 shipClass round-trip, NO new bump)`);
  await page.evaluate(() => window.__tidewake.newVoyage());

  // 2b7b-ballad) THE BALLAD SINGS YOUR RISE (#90, epic #168 follow-up) — the fun beat: your climb reads
  // back as a STORY, not just numbers. The RISE events already narrated as HUD beats now also drop a deed
  // into the live voyage log, so the end-of-voyage Ballad weaves them into its verses (and thus the #149
  // share-card, which composes the same lines). Prove each live RISE event contributes its deed + verse,
  // and that the surrounding composition (opening / superlative / closing tally / footer) still holds.
  // Text-only, driven through the QA hooks — 0 draw calls. NO save bump (deeds fail open; stays v18).
  const riseBallad = await page.evaluate(() => {
    const tw = window.__tidewake;
    tw.newVoyage();                       // a blank page — the Ballad starts unwritten
    tw.qaResetRankBaseline();             // rank-up summit back to rung 0 so a fresh climb re-fires
    tw.qaSetLedger({ coins: 5000, infamy: 0, standing: 0 });
    tw.step(1 / 60);                       // one frame seeds the rank baseline silently (no deed)
    // (1) Fit a cannon → a `gun` deed sings the new broadside total.
    tw.buyCannon();
    const gunDeed = tw.voyageLog.find((e) => e.type === 'gun') || null;
    // (2) Trade up a hull → a `ship` deed names from→to ("the sloop for a brig").
    tw.buyShipClass();
    const shipDeed = tw.voyageLog.find((e) => e.type === 'ship') || null;
    // (3) Cross a renown rung → a `rank` deed names the new title. Infamy 300 → a pirate rung (not the top).
    tw.setInfamy(300);
    tw.step(1 / 60);                       // the rankup system detects the crossing → logs the deed
    const rankDeed = tw.voyageLog.find((e) => e.type === 'rank') || null;
    const text = tw.ballad;               // the composed Ballad the panel + share-card both render
    return {
      gunDeed, shipDeed, rankDeed, text,
      // composition still intact around the new verses:
      hasOpening: /Gather round/.test(text),
      hasClosing: /worth the telling/.test(text),
      hasFooter: /sung at the rail/.test(text),
      deedCount: tw.voyageLog.length,
    };
  });
  if (!riseBallad.gunDeed) fail('ballad-rise (#90): fitting a cannon did not drop a `gun` deed into the voyage log (#170 wiring)');
  else if (!riseBallad.text.includes(`${riseBallad.gunDeed.guns} guns`)) fail(`ballad-rise (#90): the Ballad does not sing the new gun total (${riseBallad.gunDeed.guns} guns)`);
  if (!riseBallad.shipDeed) fail('ballad-rise (#90): buying a bigger ship did not drop a `ship` deed into the voyage log (#171 wiring)');
  else {
    if (riseBallad.shipDeed.from !== 'sloop' || riseBallad.shipDeed.to !== 'brig') fail(`ballad-rise (#90): the ship deed did not record the trade sloop→brig (from=${riseBallad.shipDeed.from}, to=${riseBallad.shipDeed.to})`);
    if (!riseBallad.text.includes('sloop') || !riseBallad.text.includes('brig')) fail('ballad-rise (#90): the Ballad does not name both hulls of the trade (sloop→brig)');
  }
  if (!riseBallad.rankDeed) fail('ballad-rise (#90): crossing a renown rung did not drop a `rank` deed into the voyage log (#169 wiring)');
  else if (!riseBallad.text.includes(riseBallad.rankDeed.title)) fail(`ballad-rise (#90): the Ballad does not name the new rank title "${riseBallad.rankDeed.title}"`);
  if (!riseBallad.hasOpening || !riseBallad.hasClosing || !riseBallad.hasFooter) fail(`ballad-rise (#90): the RISE deeds broke the surrounding composition (opening=${riseBallad.hasOpening}, closing=${riseBallad.hasClosing}, footer=${riseBallad.hasFooter})`);
  if (process.exitCode !== 1) console.log(`  ✓ the Ballad sings your RISE (#90): live rank-up→"${riseBallad.rankDeed?.title}", gun→"${riseBallad.gunDeed?.guns} guns", ship→"${riseBallad.shipDeed?.from}→${riseBallad.shipDeed?.to}" all woven into the composed Ballad (${riseBallad.deedCount} deeds; opening+superlative+closing intact); text-only, NO save bump`);
  await page.evaluate(() => window.__tidewake.newVoyage());

  // 2b7c) Governor-pole symmetry — invest spoils to grow your HOME PORT VISIBLY (#174, epic #168 "The Rise",
  // the FINALE). The mirror of buying a bigger ship: pour coin into your home port and SEE it PROSPER — new
  // warehouses, more boats at anchor, more masts at the quay — in tiers off the persisted harbour.level (NO
  // save change, stays v18). Prove all three beats in one deterministic pass: (1) INVEST→TIER-UP (each paid
  // investment climbs the level → the growth tier); (2) PORT-VIEW-REFLECTS-TIER (the world's shown dressing
  // grows and equals what the tier should reveal); (3) GATED-BY-SPEND (an empty purse refuses the invest and
  // the port does NOT grow). Then a reload proves it's DERIVED from persisted state (no bump). Docked via a
  // teleport onto the home port, driven through the QA hooks.
  const portGrow = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    // Drop onto the nearest port → landfall into TOWN, so state.port is set (claim/invest need a docked port).
    let best = null, bd = Infinity;
    for (const p of tw.ports) { const d = Math.hypot(p.pos[0] - tw.state.pos[0], p.pos[1] - tw.state.pos[2]); if (d < bd) { bd = d; best = p; } }
    tw.qaTeleport(best.pos[0], best.pos[1]);
    let inTown = false; for (let i = 0; i < 120 && !inTown; i++) { tw.step(0.1); inTown = tw.town.open === true; }
    const port = tw.town.port;
    // A well-funded, well-regarded captain: standing over the claim gate, a deep purse for the whole ladder.
    tw.qaSetLedger({ coins: 5000, infamy: 0, standing: 500 });
    const g0 = tw.portGrowth;                 // before any claim → tier 0, nothing shown
    const claim = tw.claimHarbour();          // claim this port as home → tier 1
    const g1 = tw.portGrowth;
    // GATED-BY-SPEND: empty the purse, try to grow → refused, the port must NOT tier up.
    tw.qaSetLedger({ coins: 0 });
    const brokeInvest = tw.investHarbour();
    const gBroke = tw.portGrowth;
    // Fund it and climb the whole ladder to the top tier, snapshotting the shown dressing at each step.
    tw.qaSetLedger({ coins: 5000 });
    const steps = [];
    let guard = 0;
    while (tw.harbourCanInvest.ok && guard++ < 10) {
      const r = tw.investHarbour();
      const g = tw.portGrowth;
      steps.push({ ok: r.ok, spent: r.spent, level: g.level, tier: g.tier, shown: g.shown, want: g.want });
    }
    const maxed = tw.investHarbour();         // one past the top → refused as 'maxed'
    const gTop = tw.portGrowth;
    return {
      port, inTown,
      g0: { tier: g0.tier, shownTotal: g0.shown.total, visible: g0.shown.visible },
      claimOk: claim.ok, g1: { tier: g1.tier, shown: g1.shown, want: g1.want },
      brokeOk: brokeInvest.ok, brokeReason: brokeInvest.reason, gBrokeTier: gBroke.tier,
      steps,
      maxedOk: maxed.ok, maxedReason: maxed.reason,
      gTop: { tier: gTop.tier, level: gTop.level, shown: gTop.shown, want: gTop.want },
    };
  });
  if (!portGrow.inTown) fail('grow your port (#174): could not dock at a home port to claim/invest');
  if (portGrow.g0.tier !== 0 || portGrow.g0.shownTotal !== 0) fail(`grow your port (#174): an unclaimed port must show NO growth (tier=${portGrow.g0.tier}, shown=${portGrow.g0.shownTotal})`);
  if (!portGrow.claimOk || portGrow.g1.tier !== 1) fail(`grow your port (#174): claiming a home port did not open growth at tier 1 (ok=${portGrow.claimOk}, tier=${portGrow.g1.tier})`);
  if (!(portGrow.g1.shown.total > 0)) fail('grow your port (#174): a claimed berth shows NOTHING on the quay — the SEE beat is missing');
  if (portGrow.g1.shown.building !== portGrow.g1.want.building || portGrow.g1.shown.boat !== portGrow.g1.want.boat) fail(`grow your port (#174): the port view does not reflect the claimed tier (shown ${JSON.stringify(portGrow.g1.shown)} vs want ${JSON.stringify(portGrow.g1.want)})`);
  // GATED-BY-SPEND: an empty purse must refuse the grow and the port must not tier up.
  if (portGrow.brokeOk || portGrow.brokeReason !== 'no-coins') fail(`grow your port (#174): investing with an empty purse should be refused as 'no-coins' (ok=${portGrow.brokeOk}, reason=${portGrow.brokeReason})`);
  if (portGrow.gBrokeTier !== portGrow.g1.tier) fail(`grow your port (#174): a refused (unpaid) invest must NOT grow the port (tier ${portGrow.g1.tier} → ${portGrow.gBrokeTier})`);
  // INVEST→TIER-UP + PORT-VIEW-REFLECTS-TIER: each paid step climbs the tier AND reveals strictly more dressing.
  if (!(portGrow.steps.length >= 1)) fail('grow your port (#174): no investment step ran');
  let prevTier = portGrow.g1.tier, prevTotal = portGrow.g1.shown.total;
  for (const s of portGrow.steps) {
    if (!s.ok || !(s.spent > 0)) fail(`grow your port (#174): a funded invest must spend coin and succeed (ok=${s.ok}, spent=${s.spent})`);
    if (s.tier !== prevTier + 1) fail(`grow your port (#174): each investment must climb the growth tier by one (${prevTier} → ${s.tier})`);
    if (!(s.shown.total > prevTotal)) fail(`grow your port (#174): the port view did not visibly grow at tier ${s.tier} (shown total ${prevTotal} → ${s.shown.total})`);
    if (s.shown.building !== s.want.building || s.shown.boat !== s.want.boat) fail(`grow your port (#174): shown dressing must equal the tier's reveal (tier ${s.tier}: shown ${JSON.stringify(s.shown)} vs want ${JSON.stringify(s.want)})`);
    prevTier = s.tier; prevTotal = s.shown.total;
  }
  if (portGrow.maxedOk || portGrow.maxedReason !== 'maxed') fail(`grow your port (#174): investing past the top tier should be refused as 'maxed' (ok=${portGrow.maxedOk}, reason=${portGrow.maxedReason})`);
  if (!(portGrow.gTop.tier === portGrow.gTop.level && portGrow.gTop.tier >= 4)) fail(`grow your port (#174): the port did not reach its top growth tier (tier=${portGrow.gTop.tier}, level=${portGrow.gTop.level})`);

  // DERIVED FROM PERSISTED STATE — a reload re-grows the port from harbour.level with NO save bump (v18).
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('window.__tidewake && window.__tidewake.ready === true', { timeout: 30000 });
  const portPersist = await page.evaluate(() => {
    const tw = window.__tidewake;
    const g = tw.portGrowth;
    return { tier: g.tier, level: g.level, shown: g.shown, want: g.want };
  });
  if (SAVE_VERSION !== 18) fail(`grow your port (#174): the save schema must stay v18 (derived from persisted harbour.level, NO bump) — got v${SAVE_VERSION}`);
  if (portPersist.tier !== portGrow.gTop.tier) fail(`grow your port (#174): the grown port did NOT survive a reload (tier=${portPersist.tier}, expected ${portGrow.gTop.tier}) — it must derive from the persisted harbour.level`);
  if (portPersist.shown.building !== portPersist.want.building || portPersist.shown.boat !== portPersist.want.boat) fail(`grow your port (#174): a returning captain must SEE the port they raised (shown ${JSON.stringify(portPersist.shown)} vs want ${JSON.stringify(portPersist.want)})`);
  if (process.exitCode !== 1) console.log(`  ✓ grow your port (#174, THE RISE FINALE): claim→tier 1 then invest climbs the home port tier 1→${portGrow.gTop.tier}, VISIBLY growing the quay (dressing ${portGrow.g1.shown.total}→${portGrow.gTop.shown.total} pieces: ${portGrow.gTop.shown.building} warehouses + ${portGrow.gTop.shown.boat} boats/masts); an empty purse is refused ('no-coins', no growth); capped at the top tier; SURVIVES a reload DERIVED from persisted harbour.level (NO save bump, stays v18)`);
  await page.evaluate(() => window.__tidewake.newVoyage());

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
    // #80 CLIMAX — she strikes her colours → the camera eases to a HUSH (a smooth settle, camera-only).
    // Read it the instant the flag goes up: a settle is live and rocks the view, but owes NO sim freeze
    // or slow-mo (it is renderer-only — the sim runs full through it).
    const settleLive = tw.juice.settle;
    tw.step(1 / 60);
    const settleOffset = tw.juice.offsetMag;
    const settleFrozensim = tw.juiceConsumeHitStop(1 / 60); // must be 1 — a settle never holds the sim
    // …and it DECAYS to nothing over its window (it's a transient breath, not a stuck camera).
    for (let i = 0; i < 90; i++) tw.step(1 / 60);
    const settleGone = !tw.juice.settle;
    const settleResidual = tw.juice.offsetMag;
    // Toggle OFF → the settle is fully suppressed (no camera motion).
    tw.juiceSetEnabled(false);
    const offSettle = tw.juiceCameraSettle();
    tw.juiceSetEnabled(true);
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
      settleLive, settleOffset, settleFrozensim, settleGone, settleResidual,
      offSettleActive: offSettle.settle, offSettleOffset: offSettle.offsetMag,
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
    // #80 CLIMAX — the surrender camera SETTLE (a hush): fired on the strike, camera-only, decays away.
    if (!surrender.settleLive) fail('#80 climax: "she strikes her colours" did not ease the camera to a settle (no hush)');
    if (!(surrender.settleOffset > 0)) fail(`#80 climax: the surrender settle did not move the camera (offsetMag=${surrender.settleOffset})`);
    if (surrender.settleFrozensim !== 1) fail(`#80 climax: the surrender settle FROZE the sim (scale=${surrender.settleFrozensim}) — a settle must be camera-only`);
    if (!surrender.settleGone) fail('#80 climax: the surrender settle did not decay away (a stuck camera)');
    if (!(surrender.settleResidual === 0)) fail(`#80 climax: the surrender settle left a residual camera offset (${surrender.settleResidual})`);
    if (surrender.offSettleActive) fail('#80 climax: a surrender settle fired with the juice toggle OFF (must be suppressed)');
    if (!(surrender.offSettleOffset === 0)) fail(`#80 climax: a settle with the toggle OFF still moved the camera (${surrender.offSettleOffset})`);
    if (process.exitCode !== 1) console.log('  ✓ #80 climax — a surrender eases the camera to a HUSH (camera-only, decays to zero, off under the toggle)');
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

  // 2b10) THE BOSUN'S FIRST DUEL (#157): a cold save's FIRST engagement is the scaffolded SOFT debut —
  // a forgiving, already-battered foe (winnable) plus the bosun calling each phase's verb aloud (legible).
  // It fires ONCE: a save flag (v17) retires it, so a returning captain is never re-scaffolded. Drives the
  // integration off the QA hooks: cold engage → softened + cued; beaten to the board window → the board
  // cue; sink her → the flag is spent; a fresh fight is now an ordinary, full-strength foe.
  const debutRun = await page.evaluate(async () => {
    const tw = window.__tidewake;
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    function closeAndEngage() {
      const bi = nearest();
      if (bi === -1) return false;
      const fp = tw.npcs[bi].pos;
      tw.qaTeleport(fp[0], fp[1] - 120);   // drop just off her, inside engage range
      tw.step(0.1);
      const ok = tw.engageBattle();
      tw.step(0.1);
      return ok;
    }
    tw.newVoyage(); tw.step(0.1);           // cold start — a brand-new captain, the debut re-armed
    if (!closeAndEngage()) return { skipped: true };
    // The debut is live: she squares up softened + already battered, and the bosun opens with the FIRE call.
    const softened = tw.battle.debut === true;
    const battered = tw.battle.enemyHull < tw.battle.maxHull;
    const cueManeuver = tw.debutCue;         // {verb:'fire', line} — the opening call
    // Beat her into the boarding window → the bosun calls the BOARD verb.
    tw.battleWeaken(0.2); tw.step(0.1);
    const canBoardNow = tw.battle.canBoard === true;
    const cueBoard = tw.debutCue;            // {verb:'board', line}
    // Sink her (the sink check precedes any surrender), spending the one-shot debut.
    tw.battleWeaken(0); tw.battleFire(); tw.step(0.1);
    const doneAfter = tw.debutDone === true;  // the flag is now spent
    // A fresh fight is now an ordinary, full-strength foe — the debut never repeats.
    let softened2 = null;
    if (closeAndEngage()) { softened2 = tw.battle.debut; tw.fleeBattle(); }
    return {
      skipped: false, softened, battered,
      cueManeuverVerb: cueManeuver && cueManeuver.verb, cueBoardVerb: cueBoard && cueBoard.verb,
      canBoardNow, doneAfter, softened2,
    };
  });
  if (debutRun.skipped) {
    fail('#157 debut: no NPC available to drive the cold-start first-fight walk');
  } else {
    if (!debutRun.softened) fail('#157 debut: a cold save\'s first engagement was NOT flagged the scaffolded debut');
    if (!debutRun.battered) fail('#157 debut: the debut foe squared up at FULL hull — she should start softened/battered');
    if (debutRun.cueManeuverVerb !== 'fire') fail(`#157 debut: the bosun\'s opening call did not name FIRE (got ${debutRun.cueManeuverVerb})`);
    if (!debutRun.canBoardNow) fail('#157 debut: beating her down did not open the boarding window');
    if (debutRun.cueBoardVerb !== 'board') fail(`#157 debut: the bosun did not call the BOARD verb at the boarding window (got ${debutRun.cueBoardVerb})`);
    if (!debutRun.doneAfter) fail('#157 debut: resolving the first fight did NOT spend the one-shot debut flag');
    if (debutRun.softened2 === true) fail('#157 debut: a SECOND fight was still softened — the debut must fire only once');
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

  // 2h2b2) Per-town DOCKED CUE — each harbour greets you with its OWN musical character (#129, the #69
  // follow-up). The fun beat: you sail into a port and it rings its own flourish — voiced in the town's
  // key/mode with a per-town motif shape and timbre — distinct from every other harbour, so arriving
  // feels like arriving SOMEWHERE. Proven AudioContext-free off the pure cue + the live landfall arm:
  //   (1) distinct ports → DISTINCT docked cues, deterministically (a town always greets you the same);
  //   (2) the cue is voiced in the town's own key/mode (its chord, an octave up — bright/bell-like);
  //   (3) making landfall ARMS the docked port's OWN cue (the harbour greets you as THIS place).
  const townCue = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const names = tw.ports.map((p) => p.name);
    // Determinism + distinctness of the pure per-town cue.
    const stable = names.every((n) => JSON.stringify(tw.townDockedCueFor(n)) === JSON.stringify(tw.townDockedCueFor(n)));
    const cues = names.map((n) => tw.townDockedCueFor(n));
    const distinct = new Set(cues.map((c) => `${c.notes.join(',')}|${c.shape}|${c.type}`)).size;
    // The cue rings in the town's own key: every note is a town-chord degree lifted an octave.
    const inKey = names.every((n) => {
      const up = tw.townMusicFor(n).chordMidi.map((m) => m + 12);
      return tw.townDockedCueFor(n).notes.every((x) => up.includes(x));
    });
    // Make landfall at a real port → the flourish armed must be THAT port's own docked cue.
    const port = tw.ports[0];
    tw.qaTeleport(port.pos[0], port.pos[1]); tw.step(0.1);
    let inTown = false; for (let i = 0; i < 120 && !inTown; i++) { tw.step(0.1); inTown = tw.town.open === true; }
    const docked = tw.docked;
    const armed = tw.townMusic.dockedCue;
    const expected = tw.townDockedCueFor(docked || port.name);
    tw.newVoyage(); tw.step(0.1);
    return {
      names, stable, distinct, inKey, inTown, docked,
      armedPort: armed && armed.port, armedNotes: armed && armed.notes, armedShape: armed && armed.shape,
      expectedNotes: expected && expected.notes, expectedShape: expected && expected.shape,
    };
  });
  if (townCue.names.length < 2) fail(`docked cue (#129): fewer than 2 ports to compare (${townCue.names.length})`);
  if (!townCue.stable) fail('docked cue (#129): townDockedCueFor is not deterministic — a town must always greet you the same way');
  if (townCue.distinct !== townCue.names.length) fail(`docked cue (#129): harbours share a flourish (${townCue.distinct}/${townCue.names.length} distinct) — each port must sound like itself`);
  if (!townCue.inKey) fail('docked cue (#129): a docked cue is not voiced in its town\'s own key/mode (notes are not off the town chord)');
  if (!townCue.inTown) fail('docked cue (#129): could not make landfall to arm a docked cue');
  if (townCue.armedPort !== townCue.docked) fail(`docked cue (#129): landfall armed the wrong port's cue (armed "${townCue.armedPort}" at "${townCue.docked}")`);
  if (JSON.stringify(townCue.armedNotes) !== JSON.stringify(townCue.expectedNotes) || townCue.armedShape !== townCue.expectedShape) fail(`docked cue (#129): the armed landfall flourish is not the docked port's own (armed ${townCue.armedShape}:${JSON.stringify(townCue.armedNotes)} vs ${townCue.expectedShape}:${JSON.stringify(townCue.expectedNotes)})`);
  if (process.exitCode !== 1) console.log(`  ✓ per-town docked cue (#129): ${townCue.distinct} harbours each greet you with their OWN flourish (key/mode/motif/timbre); landfall at "${townCue.docked}" rang its cue [${townCue.armedShape}: ${townCue.armedNotes.join(',')}] — a port sounds like somewhere with character, AudioContext-free`);

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

  // 2j-w) Optional weather (#88): OFF by default (clear look, ZERO weather draws). Flipping the
  // toggle ON and jumping to a squall must SHIFT the sky/sea toward grey + dim the sun AND draw the
  // cheap visuals (clouds + rain); the seeded cycle must progress deterministically through its
  // states; it must COMPOSE on top of day-night (a squall greys the golden-hour look further) without
  // breaking it; and flipping OFF must restore the clear default EXACTLY with zero weather draws.
  const weather = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const offDefault = { ...tw.weather };                   // the clear default (toggle OFF)
    // Deterministic state progression (the seeded cycle passes clear→clouds→squall→clearing).
    tw.setOption('weather', true);
    const progression = ['clear', 'clouds', 'squall', 'clearing'].map((_, i) => {
      tw.setWeatherPhase([0.0, 0.30, 0.50, 0.72][i]); tw.step(0.05); return tw.weather.key;
    });
    // Determinism: re-jumping to the same phase yields the same state, twice.
    tw.setWeatherPhase(0.50); tw.step(0.05); const squallA = { ...tw.weather };
    tw.setWeatherPhase(0.10); tw.step(0.05);
    tw.setWeatherPhase(0.50); tw.step(0.05); const squallB = { ...tw.weather };
    // COMPOSE with day-night: golden hour alone, then a squall laid over it.
    tw.setOption('weather', false); tw.setOption('daynight', true); tw.setDayPhase(0.70); tw.step(0.2);
    const goldenClear = { ...tw.weather };                  // day-night only (weather off)
    tw.setOption('weather', true); tw.setWeatherPhase(0.50); tw.step(0.2);
    const goldenSquall = { ...tw.weather };                 // squall composed over golden hour
    const daynightStillOn = tw.daynight.enabled;
    // Flip BOTH off → back to the clear default, byte-for-byte, zero weather draws.
    tw.setOption('daynight', false); tw.setOption('weather', false); tw.step(0.1);
    const restored = { ...tw.weather };
    return { offDefault, progression, squallA, squallB, goldenClear, goldenSquall, daynightStillOn, restored };
  });
  if (!('enabled' in weather.offDefault)) fail('weather: QA surface (tw.weather) missing');
  if (weather.offDefault.enabled) fail('weather: should be OFF by default (clear stays default)');
  if (!(weather.offDefault.draws === 0)) fail(`weather: OFF/clear must draw ZERO weather objects (draws=${weather.offDefault.draws})`);
  if (JSON.stringify(weather.progression) !== JSON.stringify(['clear', 'clouds', 'squall', 'clearing'])) fail(`weather: cycle did not progress deterministically through its states (got ${JSON.stringify(weather.progression)})`);
  if (!(weather.squallA.key === 'squall' && weather.squallA.darken > 0.35)) fail('weather: the squall did not become the heaviest, greyest state');
  if (!(weather.squallA.darken === weather.squallB.darken && weather.squallA.key === weather.squallB.key)) fail('weather: the seeded cycle is not deterministic (same phase gave different weather)');
  if (!(weather.squallA.draws >= 1)) fail(`weather: the squall drew NO visuals (clouds/rain) (draws=${weather.squallA.draws})`);
  if (!(weather.squallA.haze !== weather.offDefault.haze)) fail('weather: the squall did not grey the sky/sea haze');
  if (!(weather.squallA.sunIntensity < weather.offDefault.sunIntensity)) fail('weather: the squall did not dim the light');
  // Composition: the squall greys the golden-hour look further, and day-night stays alive under it.
  if (!weather.daynightStillOn) fail('weather: composing a squall broke the day-night cycle');
  if (!(weather.goldenSquall.haze !== weather.goldenClear.haze)) fail('weather: a squall did not compose on top of day-night (golden hour unchanged)');
  // OFF restores the clear default exactly, with zero weather draws.
  if (weather.restored.enabled) fail('weather: cycle did not disable when toggled off');
  if (!(weather.restored.haze === weather.offDefault.haze)) fail(`weather: OFF did not restore the clear haze exactly (${weather.restored.haze} != ${weather.offDefault.haze})`);
  if (!(weather.restored.sunIntensity === weather.offDefault.sunIntensity)) fail('weather: OFF did not restore the clear sun intensity exactly');
  if (!(weather.restored.draws === 0)) fail(`weather: OFF still drew weather objects — not a true no-op (draws=${weather.restored.draws})`);

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

  // 2j-6) PER-PHASE BATTLE MUSICAL SIGNATURES (#158): the raid's Three-Act structure, now AUDIBLE. Each
  // act (⚔ Maneuver / 🪝 Boarding / 🗣 Duel — the shipped #135 raidPhaseModel) wears a DISTINCT musical
  // LAYER (a different mode/register, not merely louder) that cross-fades in on the phase transition via
  // the bar-clock — so you HEAR which act of the fight you're in before you read the HUD. AudioContext-
  // free here (no gesture → the music engine never starts): the battle-layer CAST is set from the live
  // raid act every frame regardless, so it asserts headless via tw.battleScore. We prove: (A) at sea
  // there is NO battle layer (the honest bed alone); (B) squaring up to a foe arms the MANEUVER layer —
  // its own driving mode, distinct from the at-sea rest; (C) breaking off fades the battle layer away;
  // (D) the three acts map to pairwise-DISTINCT layers (the shipped param sets); (E) a phase transition
  // is bar-quantised — the crossfade is HELD off the beat and only fires ON the downbeat.
  const bscore = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);            // clean slate: at sea, no raid
    const atSea = { ...tw.battleScore, scale: [...tw.battleScore.scale] };
    function nearest() {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const bi = nearest();
    if (bi === -1) return { engaged: false, atSea };
    const fp = tw.npcs[bi].pos;
    tw.qaTeleport(fp[0], fp[1] - 120);        // drop just off her — inside engage range
    tw.step(0.05);
    const engaged = tw.engageBattle();
    if (!engaged) return { engaged: false, atSea };
    tw.step(0.1);                             // the music system folds the raid act into the layer cast
    const maneuver = { ...tw.battleScore, scale: [...tw.battleScore.scale] };
    tw.fleeBattle(); tw.step(0.1);            // break off — the battle layer must fade away
    const afterFlee = { ...tw.battleScore, scale: [...tw.battleScore.scale] };
    return { engaged: true, atSea, maneuver, afterFlee };
  });
  // (A) at sea: no battle layer, the honest bed alone
  if (bscore.atSea.act !== null || bscore.atSea.drive !== 0) fail(`battle signatures (#158): a captain at sea already carries a battle layer (${JSON.stringify(bscore.atSea)})`);
  if (!bscore.engaged) {
    console.warn('  (#158 per-phase battle signatures: no foe to engage — live layer check skipped; pure phase→layer + crossfade scheduling still asserted)');
  } else {
    // (B) squaring up arms the MANEUVER layer — its own driving mode, distinct from the at-sea rest
    if (bscore.maneuver.act !== 'maneuver') fail(`battle signatures (#158): squaring up did not arm the opening MANEUVER layer (act=${bscore.maneuver.act})`);
    if (!(bscore.maneuver.drive > 0)) fail(`battle signatures (#158): the maneuver layer is silent (drive=${bscore.maneuver.drive}) — the fight is not scored`);
    if (JSON.stringify(bscore.maneuver.scale) !== JSON.stringify(DRIVE_SCALE)) fail(`battle signatures (#158): the maneuver layer is not the driving mixolydian roll (${JSON.stringify(bscore.maneuver.scale)})`);
    if (JSON.stringify(bscore.maneuver.scale) === JSON.stringify(bscore.atSea.scale)) fail('battle signatures (#158): the maneuver layer sounds the SAME as the at-sea bed — the fight is not audibly distinct');
    // (C) breaking off fades the battle layer away
    if (bscore.afterFlee.act !== null || bscore.afterFlee.drive !== 0) fail(`battle signatures (#158): the battle layer lingered after fleeing (${JSON.stringify(bscore.afterFlee)})`);
  }
  // (D) the three acts map to pairwise-DISTINCT layers (the shipped param sets the live system uses)
  const layMan = battleLayer('maneuver'), layBrd = battleLayer('boarding'), layDuel = battleLayer('duel');
  const sig = (l) => JSON.stringify(l.scale) + '|' + l.drive + '|' + l.octave;
  if (new Set([sig(layMan), sig(layBrd), sig(layDuel)]).size !== 3) fail('battle signatures (#158): the three acts do not carry distinct layers (a phase is only louder, not recoloured)');
  if (JSON.stringify(layMan.scale) !== JSON.stringify(DRIVE_SCALE) || JSON.stringify(layBrd.scale) !== JSON.stringify(MENACE_SCALE) || JSON.stringify(layDuel.scale) !== JSON.stringify(EDGE_SCALE)) fail('battle signatures (#158): an act layer drifted from its shipped mode');
  // (E) a phase transition is bar-quantised: HELD off the beat, FIRES on the downbeat (the score is the timer)
  const held = nextTransition({ committed: 'maneuver', target: 'boarding', step: 3, stepsPerBar: 8 });
  const fired = nextTransition({ committed: 'maneuver', target: 'boarding', step: 8, stepsPerBar: 8 });
  if (held.fire !== false || fired.fire !== true || fired.act !== 'boarding') fail(`battle signatures (#158): the phase crossfade is not bar-quantised (held=${JSON.stringify(held)}, fired=${JSON.stringify(fired)})`);
  if (process.exitCode !== 1) console.log(`  ✓ per-phase battle signatures (#158): the fight is SCORED — at sea no battle layer; squaring up arms the driving MANEUVER layer (distinct from the bed); the three acts carry distinct modes [⚔ mixolydian · 🪝 freygish · 🗣 lydian+8ve]; the swap is bar-quantised (held off-beat, fires on the downbeat)`);

  // 2j-7) ROTATING SEA THEMES (#94 phase 2): the open sea EVOLVES over a long voyage. The once-static
  // bed now rotates through a small set of DISTINCT sea themes — a mode + transposition RECOLOUR of the
  // SAME procedural bed (no percussive bed, no loadTrack, the #132/#158 discipline) — cross-faded in ON
  // a bar downbeat every ROTATE_BARS, seeded and deterministic. AudioContext-free here (no gesture → the
  // music engine never starts): the live TARGET theme is set from the sea-clock every frame regardless,
  // so it asserts headless via tw.seaTheme. We prove: (A) a fresh sail opens on the HOME theme (the
  // untouched Ionian hornpipe); (B) the set is a handful of pairwise-DISTINCT airs; (C) selection is
  // deterministic and rotates on the bar-clock; (D) sailing a while SWAPS the live theme to a new,
  // distinct air; (E) the rotation YIELDS to town + battle (frozen while they own the mix) and RESUMES
  // cleanly under sail — so the sea evolves, but town (#129) and battle (#158) music always take over.
  const sea = await page.evaluate(async () => {
    const tw = window.__tidewake;
    const T = 'town', B = 'battle', S = 'sailing';
    tw.newVoyage(); tw.step(0.1);
    const fresh = { ...tw.seaTheme, scale: [...tw.seaTheme.scale] };
    // Pure lookups (headless, cheap): determinism + rotation on the bar-clock.
    const at0 = tw.seaThemeAt(0);
    const atRot = tw.seaThemeAt(tw.rotateBars);
    const det = JSON.stringify(tw.seaThemeAt(tw.rotateBars)) === JSON.stringify(tw.seaThemeAt(tw.rotateBars));
    const themes = tw.seaThemes.map((t) => JSON.stringify(t.scale) + '@' + t.rootOffset);
    // (D) sail past a rotation boundary (barSec ≈ 2.22s) → the live theme swaps to a new air.
    tw.step((tw.rotateBars + 2) * 2.3);
    const sailed = { ...tw.seaTheme, scale: [...tw.seaTheme.scale] };
    const expected = tw.seaThemeAt(sailed.bars);
    // (E) town OWNS the mix → the rotation freezes ashore, resumes under sail.
    tw.enterMode(T); const townBars0 = tw.seaTheme.bars; tw.step(6); const townBars1 = tw.seaTheme.bars;
    tw.enterMode(S); tw.step(3); const afterTownBars = tw.seaTheme.bars;
    // (E) battle OWNS the mix → same freeze/resume. Square up to a REAL foe so mode=BATTLE persists
    // (a bare enterMode('battle') with no active fight is reverted to SAILING by the mode system).
    const nearest = () => {
      const s = tw.state.pos; let bi = -1, bd = Infinity;
      for (let i = 0; i < tw.npcs.length; i++) {
        const d = Math.hypot(tw.npcs[i].pos[0] - s[0], tw.npcs[i].pos[1] - s[2]);
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    };
    let engaged = false, batBars0 = null, batBars1 = null, afterBatBars = null;
    const bi = nearest();
    if (bi !== -1) {
      const fp = tw.npcs[bi].pos;
      tw.qaTeleport(fp[0], fp[1] - 120); tw.step(0.05);
      engaged = tw.engageBattle();
      if (engaged) {
        tw.step(0.2);
        batBars0 = tw.seaTheme.bars; tw.step(6); batBars1 = tw.seaTheme.bars;
        tw.fleeBattle(); tw.step(3); afterBatBars = tw.seaTheme.bars;
      }
    }
    return { fresh, at0, atRot, det, themes, sailed, expected, townBars0, townBars1, afterTownBars, engaged, batBars0, batBars1, afterBatBars, rotateBars: tw.rotateBars };
  });
  // (A) a fresh sail opens on the home theme — the untouched Ionian hornpipe at the shipped key
  if (sea.fresh.name !== 'home' || sea.fresh.rootOffset !== 0) fail(`sea themes (#94 ph2): a fresh sail did not open on the home theme (${JSON.stringify(sea.fresh)})`);
  if (sea.fresh.scale[3] !== 5 || sea.fresh.scale[1] !== 2) fail(`sea themes (#94 ph2): the home theme is not the honest D-major Ionian (${JSON.stringify(sea.fresh.scale)})`);
  // (B) a handful of pairwise-distinct airs
  if (sea.themes.length < 3) fail('sea themes (#94 ph2): need a SET of themes, not one');
  if (new Set(sea.themes).size !== sea.themes.length) fail('sea themes (#94 ph2): two themes share a (scale, transposition) — not distinct');
  // (C) deterministic + rotates on the bar-clock
  if (!sea.det) fail('sea themes (#94 ph2): selection is not deterministic — same bar gave different themes');
  if (sea.at0.name !== 'home') fail('sea themes (#94 ph2): bar 0 is not the home theme');
  if (sea.atRot.name === sea.at0.name) fail('sea themes (#94 ph2): the theme did not rotate after ROTATE_BARS — the sea would sound static');
  // (D) sailing a while swaps the live theme to a new, distinct air (the fun beat, live)
  if (!(sea.sailed.bars >= sea.rotateBars)) fail(`sea themes (#94 ph2): sea-time did not accrue under sail (bars=${sea.sailed.bars})`);
  if (sea.sailed.name === 'home') fail('sea themes (#94 ph2): sailing a long stretch did not shift the sea to a new theme — the open water still loops');
  if (sea.sailed.name !== sea.expected.name) fail(`sea themes (#94 ph2): the live theme drifted from the deterministic schedule (live=${sea.sailed.name}, expected=${sea.expected.name})`);
  // (E) yields to town + battle (frozen), resumes under sail
  if (sea.townBars1 !== sea.townBars0) fail(`sea themes (#94 ph2): the rotation did not FREEZE ashore (town) — bars advanced ${sea.townBars0}→${sea.townBars1}`);
  if (sea.afterTownBars <= sea.townBars1) fail('sea themes (#94 ph2): the rotation did not RESUME after leaving town');
  if (!sea.engaged) {
    console.warn('  (#94 ph2 sea themes: no foe to engage — live battle-yield check skipped; town-yield + pure yield still asserted)');
  } else {
    if (sea.batBars1 !== sea.batBars0) fail(`sea themes (#94 ph2): the rotation did not FREEZE in battle — bars advanced ${sea.batBars0}→${sea.batBars1}`);
    if (sea.afterBatBars <= sea.batBars1) fail('sea themes (#94 ph2): the rotation did not RESUME after the fight');
  }
  if (process.exitCode !== 1) console.log(`  ✓ rotating sea themes (#94 ph2): the open sea EVOLVES — opens on the home Ionian hornpipe, then rotates through ${sea.themes.length} distinct airs on the bar-clock (deterministic); a long stretch shifts to a new air (${sea.sailed.name}); the rotation yields to town + battle and resumes under sail`);

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

  // 2o¾) Coastal seagulls (#68 — the coast comes ALIVE): the gull SFX already exists; #68 drives its
  // gain/rate off the distance to the nearest island shoreline (the SAME distance the #97 flock roosts
  // over), so cries SWELL as you near a port and fall SILENT at open sea. Audio is inert headless, so
  // we assert the pure curve (audio.js) applied to the LIVE coast distance the game reports (fauna),
  // plus the visible tie-in: the flock roosts over the coast near land. Deterministic, distance-driven.
  const gulls = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.2);
    const isle = tw.islands && tw.islands[0];
    // NEAR THE COAST: drop the ship right onto an island → shoreline distance ~0, flock roosts over it.
    if (isle) { tw.qaTeleport(isle.x, isle.z); tw.step(0.5); }
    const near = { coastDist: tw.fauna.coastDist, nearLand: tw.fauna.nearLand, visible: tw.fauna.visible };
    // OPEN SEA: teleport far from every island → shoreline distance huge; the flock keeps you company
    // but the cries go silent. Step so the coast read settles.
    tw.qaTeleport(80000, 80000); tw.step(0.5);
    const sea = { coastDist: tw.fauna.coastDist, nearLand: tw.fauna.nearLand };
    tw.newVoyage(); tw.step(0.1);
    return { hasIsle: !!isle, near, sea };
  });
  if (!gulls.hasIsle) fail('coastal gulls (#68): no island in the world to test coast proximity against');
  // The distance→intensity curve the gull audio actually runs on, applied to the live reported distance.
  const nearGain = gullCoastGain(coastProximity(gulls.near.coastDist));
  const seaGain = gullCoastGain(coastProximity(gulls.sea.coastDist));
  if (!(nearGain > 0.6)) fail(`coastal gulls (#68): cries do not swell near the coast (gain=${nearGain.toFixed(3)} at coastDist=${gulls.near.coastDist?.toFixed(0)})`);
  if (!(seaGain < 0.05)) fail(`coastal gulls (#68): gulls are not silent at open sea (gain=${seaGain.toFixed(3)} at coastDist=${gulls.sea.coastDist?.toFixed(0)})`);
  if (!(nearGain > seaGain + 0.5)) fail(`coastal gulls (#68): no audible swell coast→sea (near ${nearGain.toFixed(3)} vs sea ${seaGain.toFixed(3)})`);
  // Visible tie-in to the #97 flock: near the coast the gulls actually wheel over the shore (roosting).
  if (!gulls.near.nearLand) fail('coastal gulls (#68): the flock did not roost over the coast near land (no visual tie-in)');
  if (!gulls.near.visible) fail('coastal gulls (#68): the flock was not drawn over the coast');
  if (gulls.sea.nearLand) fail('coastal gulls (#68): the flock is still roosting on land out at open sea');
  if (process.exitCode !== 1) console.log(`  ✓ coastal gulls (#68): the coast comes ALIVE — cries swell to gain ${nearGain.toFixed(2)} at the shore (coastDist ${gulls.near.coastDist.toFixed(0)}) beside the roosting flock, and fall to ${seaGain.toFixed(2)} (silent) out at open sea (coastDist ${gulls.sea.coastDist.toFixed(0)}); distance-driven, ambient, save-invariant`);

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

  // 2o'') OCEAN SAIL-OVER CURIOS (#70 slice 1 — the sea-delight beat): the empty sea now rewards
  // attention. Every so often a small curio drifts in ahead of the bow (a corked BOTTLE or a sea
  // TURTLE) and sailing over it plays a soft cue + raises a wry line that never repeats back-to-back.
  // Two proofs. (A) LIVE: sailing under way, a curio actually spawns + gets drawn (≤1 extra draw), and
  // an encounter fires (cue + line) — proven off the QA snapshot. (B) DETERMINISTIC PROBE: a self-
  // contained probe drives the real system to assert spawn determinism, draw-when-near, cull-to-0-draws
  // when off-stage, the cue fires, and the witty-line picker NEVER repeats a line twice in a row (yet
  // varies) — the anti-repeat charm guarantee. Ambient open-sea only; no save change.
  const curiosLive = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    tw.qaTeleport(0, 0);
    tw.press('w'); // make way — curios only drift in under sail
    let sawActive = false, sawDrawn = false, spawns = 0, encounters = 0;
    // Sail on for a good while; the seeded cadence drifts a curio in, and the ship sails over it.
    for (let k = 0; k < 900; k++) {
      tw.step(0.1);
      const c = tw.curios;
      if (c.active) sawActive = true;
      if (c.drawn) sawDrawn = true;
      spawns = c.spawns; encounters = c.encounters;
      if (encounters > 0 && sawDrawn) break;
    }
    tw.release('w');
    const snap = tw.curios;
    return { sawActive, sawDrawn, spawns, encounters, lastCue: snap.lastCue, lastLine: snap.lastLine };
  });
  if (!(curiosLive.spawns > 0)) fail('curios (#70): no curio ever drifted in while sailing (a spawn should fire on the seeded cadence)');
  if (!curiosLive.sawActive) fail('curios (#70): a curio spawned but was never live in the snapshot');
  if (!curiosLive.sawDrawn) fail('curios (#70): the curio mesh was never drawn while sailing past it');

  // (B) The deterministic probe — spawn determinism, draw/cull, cue, and anti-repeat, all provable
  // regardless of whether the ship happened to sail over one during the live loop above.
  const curios = await page.evaluate(() => window.__tidewake.qaCurioProbe());
  if (!curios.spawnDeterministic) fail('curios (#70): the spawn is NOT deterministic (same seed → different curio) — the headless cadence is not reproducible');
  if (!curios.drawnWhenNear) fail('curios (#70): the curio did not draw when the ship was right beside it');
  if (!(curios.drawnCount <= 1)) fail(`curios (#70): more than one curio mesh drew at once (${curios.drawnCount}) — must be ≤1 extra draw`);
  if (!curios.culledWhenFar) fail('curios (#70): the curio was NOT distance-culled to 0 draws when the focus moved off-stage');
  if (!curios.cueFired) fail('curios (#70): sailing over a curio did not fire its cue');
  if (!curios.antiRepeat) fail(`curios (#70): the witty line repeated twice in a row — anti-repeat broken (lines=${JSON.stringify(curios.lines)})`);
  if (!(curios.distinct >= 2)) fail(`curios (#70): the witty-line pool never varied (distinct=${curios.distinct}) — it should draw several different lines`);
  // Post-RISE: the NEW spar kind (and every kind) must fire its own cue + never repeat its line back-to-back.
  if (!(curios.types || []).includes('spar')) fail('curios (#70 post-RISE): the new drifting-spar kind is missing from CURIO_TYPES');
  const spar = (curios.perKind && curios.perKind.spar) || null;
  if (!spar) fail('curios (#70 post-RISE): the probe reported no per-kind result for the spar');
  else {
    if (!spar.cueFired) fail('curios (#70 post-RISE): sailing over a drifting spar did not fire its cue');
    if (!spar.antiRepeat) fail(`curios (#70 post-RISE): the spar witty line repeated twice in a row (lines=${JSON.stringify(spar.lines)})`);
    if (!(spar.distinct >= 2)) fail(`curios (#70 post-RISE): the spar witty-line pool never varied (distinct=${spar.distinct})`);
  }
  if (process.exitCode !== 1) console.log(`  ✓ ocean sail-over curios (#70): a ${curiosLive.lastCue || 'curio'} drifted in + drew while sailing (spawns ${curiosLive.spawns}); probe: deterministic spawn, ≤1 draw, culled off-stage, cue fires, ${curios.distinct} distinct witty lines with no back-to-back repeat; new spar kind fires its cue with ${spar ? spar.distinct : '?'} distinct anti-repeat lines`);

  // 2z-dread) THE WORLD FEARS YOU (#172, epic #168 "The Rise" slice 4): now that you can grow notorious
  // (#169 ranks) and BIG (#171 class), the world NOTICES. A much-outclassed, much-feared captain makes
  // WEAK prey blink — turn and RUN before you engage, or strike her colours EARLY once the fight starts —
  // scaled by the GAP (your notoriety + class vs hers). A peer holds; the apex man-o'-war still fights
  // (protects #167). Four proofs: (A) PURE gap→flee/early-strike + composition; (B) LIVE flee-on-sight —
  // a weak sloop bolts from a notorious frigate captain while an apex holds; (C) LIVE in-engagement —
  // dread is active vs weak prey (foeDread>0) and absent vs the apex (≤0); (D) LIVE compose — a dread
  // early-strike opens the EXISTING surrender flag and ACCEPT ends the fight cleanly (no soft-lock).
  {
    // (A) PURE — the dread model itself (deterministic/headless)
    const NOTORIOUS = 1500, FRIGATE = 3;
    const prey = { foeTier: 1, foeRole: 'merchant' };  // a darting merchant sloop
    const peer = { foeTier: 4, foeRole: 'warship' };   // a warship frigate — a fair fight
    const apex = { foeTier: 5, foeRole: 'warship' };   // a warship man-o'-war — the deep terror (#167)
    if (!fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...prey })) fail('dread (#172): a feared frigate captain did not scatter a merchant sloop (flee-on-sight)');
    if (fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...peer })) fail('dread (#172): a PEER (warship frigate) flinched — an even fight must STAND');
    if (fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...apex })) fail('dread (#172): the APEX man-o\'-war fled — it must still FIGHT (protects #167)');
    if (fleesOnSight({ playerInfamy: 0, playerTier: 1, ...prey })) fail('dread (#172): a green captain scared weak prey — an unknown name must scatter no one');
    const prPrey = dreadPressure({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...prey });
    const prPeer = dreadPressure({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...peer });
    if (!strikesEarly({ moraleFrac: 0.4, hullFrac: 0.55, pressure: prPrey })) fail('dread (#172): a dreaded, rattled prey did not strike her colours EARLY');
    if (strikesEarly({ moraleFrac: 0.1, hullFrac: 0.4, pressure: prPeer })) fail('dread (#172): a PEER struck early — the duel must be decided by skill, not dread');
    // composition: the dread early-strike feeds the EXISTING offersSurrender path; refuse/board don't double-fire
    if (!offersSurrender({ yielded: strikesEarly({ moraleFrac: 0.4, hullFrac: 0.55, pressure: prPrey }), boarded: false, quarterRefused: false })) fail('dread (#172): a dread early-strike did not open the existing surrender flag (composition broken)');
    if (offersSurrender({ yielded: true, boarded: false, quarterRefused: true })) fail('dread (#172): a refused-quarter foe re-offered surrender (double-trigger)');
    if (offersSurrender({ yielded: true, boarded: true, quarterRefused: false })) fail('dread (#172): a boarded foe re-offered surrender (double-trigger with the board path)');

    // (B–D) LIVE. NPCs are a SHARED fleet (newVoyage resets the player, not the fleet), and slot 1 is an
    // outlaw whose sighting rings the #116 rival cue — so we work at a REMOTE empty patch, reclass only
    // MERCHANT-kind slots (0, 2 — no false rival sting), and CAPTURE both class + position of every hull
    // we touch to RESTORE the sea pristine for the downstream tests (#116 rival, #161 aim-line, #165 labels).
    const RX = 30000, RZ = 30000; // an empty patch far from the whole fleet (spawns cluster near origin)
    // This block runs sim steps that advance the SHARED fleet wander + moves the player, so snapshot the
    // WHOLE world (every ship's pos + the two classes we reclass + the player pos) and restore it exactly,
    // making the block a true no-op — downstream tests sail the same trajectory as if it never ran.
    const orig = await page.evaluate((slots) => {
      const tw = window.__tidewake;
      const p = tw.state.pos; // [x,y,z]
      return {
        player: [p[0], p[2]],
        positions: tw.npcs.map((n) => (n.pos ? [n.pos[0], n.pos[1]] : null)),
        classes: slots.map((i) => { const n = tw.npcs[i]; return { i, cls: n?.shipClass?.cls, role: n?.shipClass?.role }; }),
      };
    }, [0, 2]);

    // (B) flee-on-sight — a weak sloop bolts; an apex holds. Honest black colours + infamy 150 sits BELOW
    // the #79 colours-flee threshold (menace 200), so this is DREAD (per-hull), not the old blanket flee.
    const flee = await page.evaluate(async (P) => {
      const tw = window.__tidewake;
      tw.newVoyage();
      tw.setColours('black');           // honest colours — no disguise hiding your dread
      tw.setInfamy(150);                // feared, but under the #79 menace threshold (200)
      tw.qaSetPlayerClass('frigate');   // a big hull — the size half of the gap
      if (tw.npcs.length < 3) return { skipped: true };
      tw.qaTeleport(P.RX, P.RZ);
      // pose a weak merchant sloop and an apex warship man-o'-war both just off the bow (within sight)
      tw.qaSetNpcClass(0, 'sloop', 'merchant');
      tw.qaSetNpcClass(2, 'manowar', 'warship');
      tw.qaPlaceShip(0, P.RX + 120, P.RZ + 120);
      tw.qaPlaceShip(2, P.RX - 120, P.RZ + 120);
      for (let i = 0; i < 20; i++) tw.step(1 / 60); // a beat for the helm to react
      const snap = tw.npcs;
      return { skipped: false, preyFleeing: !!snap[0].fleeing, apexFleeing: !!snap[2].fleeing };
    }, { RX, RZ });
    if (!flee.skipped) {
      if (!flee.preyFleeing) fail('dread (#172) LIVE: a weak merchant sloop did NOT flee a notorious frigate captain on sight');
      if (flee.apexFleeing) fail('dread (#172) LIVE: the apex man-o\'-war fled — it must hold and fight');
    }

    // (C+D) in-engagement — dread active vs weak prey (foeDread>0) / absent vs apex (≤0), and the dread
    // early-strike opens the EXISTING surrender flag which ACCEPT resolves cleanly (no soft-lock).
    const compose = await page.evaluate(async (P) => {
      const tw = window.__tidewake;
      function engageAt(cls, role) {
        tw.newVoyage();
        tw.setColours('black');
        tw.setInfamy(1500);              // deeply notorious
        tw.qaSetPlayerClass('frigate');
        tw.qaSetNpcClass(0, cls, role);  // merchant-kind slot → no rival sting
        tw.qaTeleport(P.RX, P.RZ);
        tw.qaPlaceShip(0, P.RX + 30, P.RZ + 30); // right alongside → nearest in engage range
        tw.step(1 / 60);
        const ok = tw.engageBattle();
        return ok ? tw.battle : null;
      }
      // weak prey: dread should be ACTIVE in the engagement
      const preyB = engageAt('sloop', 'merchant');
      const preyDread = preyB ? preyB.foeDread : null;
      // break her nerve+hull into the strike window, fire → she strikes → ACCEPT ends it (no soft-lock)
      let struck = false, endedClean = false, offerAfterAccept = null;
      if (preyB && preyB.active) {
        tw.battleBreakFoe();
        tw.battleFire();
        struck = !!tw.battle.surrenderPending;
        const cap = tw.acceptSurrender();
        endedClean = !tw.battle.active;      // engagement resolved — helm returns to sailing
        offerAfterAccept = tw.surrenderOffer; // must be null now (no lingering soft-lock)
        void cap;
      }
      // apex: dread must be ABSENT (she fights on)
      const apexB = engageAt('manowar', 'warship');
      const apexDread = apexB ? apexB.foeDread : null;
      if (apexB && apexB.active) tw.fleeBattle();
      return { preyEngaged: !!(preyB && preyB.active), preyDread, struck, endedClean, offerAfterAccept,
               apexEngaged: !!(apexB && apexB.active), apexDread };
    }, { RX, RZ });
    if (compose.preyEngaged) {
      if (!(compose.preyDread > 0)) fail(`dread (#172) LIVE: engaging weak prey as a notorious frigate showed no dread (foeDread=${compose.preyDread})`);
      if (!compose.struck) fail('dread (#172) LIVE: a broken, dreaded prey did not strike her colours (surrender flag never opened)');
      if (!compose.endedClean) fail('dread (#172) LIVE: accepting a dread surrender did NOT end the engagement (soft-lock)');
      if (compose.offerAfterAccept) fail('dread (#172) LIVE: a surrender offer lingered after ACCEPT (soft-lock / double-state)');
    }
    if (compose.apexEngaged && !(compose.apexDread <= 0)) fail(`dread (#172) LIVE: the apex man-o'-war showed dread pressure (foeDread=${compose.apexDread}) — a peer/apex must fight on`);
    // Restore the sea PRISTINE — every ship's position + the two reclassed hulls + the player pos + a clean
    // ledger/colours, and NO trailing step (so the shared fleet wander isn't advanced past pristine). My
    // block is now a true no-op for the downstream tests (#116 rival, #161 aim-line/isolation, #165 labels).
    await page.evaluate((o) => {
      const tw = window.__tidewake;
      o.classes.forEach((c) => { if (c && c.cls) tw.qaSetNpcClass(c.i, c.cls, c.role); });
      o.positions.forEach((p, i) => { if (p) tw.qaPlaceShip(i, p[0], p[1]); });
      tw.newVoyage(); tw.setInfamy(0); tw.setColours('black');
      if (o.player) tw.qaTeleport(o.player[0], o.player[1]);
    }, orig);
    if (process.exitCode !== 1) console.log(`  ✓ the world fears you (#172): weak prey flees a notorious/big captain on sight + strikes early (foeDread ${compose.preyDread?.toFixed?.(2)}); a peer/apex holds and fights (apex foeDread ${compose.apexDread?.toFixed?.(2)}); the dread strike reuses the surrender flag and ACCEPT ends it cleanly`);
  }

  // 2z-hail) DREAD'S HEAR HALF — A FEARFUL HAIL NAMES YOU (#175, post-RISE polish; completes #172). #172
  // shipped dread's SEE + FEEL (a weak foe FLEES / STRIKES early) but left the HEAR half silent. Now when a
  // dreaded foe reacts, the world NAMES you: a fearful hail sized to your notoriety, drawn anti-repeat from
  // the pure pool, on the EXISTING hail banner + reputation-sting bus. Proofs: (A) PURE tier + pole + anti-
  // repeat; (B) LIVE flee → a cry that MATCHES your title/tier, drawn anti-repeat across two bolts; (C) LIVE
  // an apex reaction is SILENT (no cry); (D) LIVE a dread early-strike cries your name while a PEER's vanilla
  // strike is silent. Text + audio = 0 draws. Reuses #172's dread gate — no new mechanic, no save bump.
  {
    // (A) PURE — the line picker itself (deterministic/headless)
    if (fearTier(1600) !== 2) fail('fearful hail (#175): a Terror (infamy 1600) did not read the terror tier');
    if (!(fearTier(150) < fearTier(1600))) fail('fearful hail (#175): the fear tier does not climb with notoriety');
    const pTerror = pickFearfulHail({ infamy: 1600, standing: 0, rng: () => 0 });
    if (pTerror.pole !== 'pirate') fail('fearful hail (#175): a notorious captain drew a non-pirate pole');
    if (pTerror.text.includes('{title}')) fail('fearful hail (#175): the {title} token was not substituted');
    if (!pTerror.text.includes(pTerror.title)) fail('fearful hail (#175): the hail does not NAME you');
    const pGov = pickFearfulHail({ infamy: 40, standing: 2000, rng: () => 0 });
    if (pGov.pole !== 'governor') fail('fearful hail (#175): a standing-led captain did not read the governor pole');
    // anti-repeat: sweep rng across the pool so a naive picker would repeat; the guard must never return `avoid`
    let av = -1;
    for (let n = 0; n < 9; n++) {
      const p = pickFearfulHail({ infamy: 1600, standing: 0, rng: () => (n % 3) / 3, avoid: av });
      if (n > 0 && p.index === av) fail(`fearful hail (#175): the anti-repeat picker repeated line ${av} at n=${n}`);
      av = p.index;
    }

    // (B–D) LIVE. Same remote-patch discipline as #172: a SHARED fleet, so work far from origin, reclass only
    // MERCHANT-kind slots (0, 2 — no false #116 rival sting), and RESTORE the sea pristine afterwards.
    const HX = 32000, HZ = 32000; // an empty patch far from the fleet AND from the #172 block's patch
    const origH = await page.evaluate((slots) => {
      const tw = window.__tidewake;
      const p = tw.state.pos;
      return {
        player: [p[0], p[2]],
        positions: tw.npcs.map((n) => (n.pos ? [n.pos[0], n.pos[1]] : null)),
        classes: slots.map((i) => { const n = tw.npcs[i]; return { i, cls: n?.shipClass?.cls, role: n?.shipClass?.role }; }),
      };
    }, [0, 2]);

    // Honest black colours + infamy 150 sits BELOW the #79 colours-flee menace (200), so a bolt here is
    // the #172 DREAD flee (class-aware) — exactly the reaction the HEAR half answers, not the old blanket
    // menace-flee. A big frigate over a weak sloop is the class half of the gap.
    const FLEE_INF = 150;
    const hail = await page.evaluate(async (P) => {
      const tw = window.__tidewake;
      if (tw.npcs.length < 3) return { skipped: true };
      tw.newVoyage(); tw.setColours('black'); tw.setInfamy(P.INF); tw.setStanding(0); tw.qaSetPlayerClass('frigate');
      tw.qaTeleport(P.HX, P.HZ);
      tw.qaClearFearfulHail();

      // (B) a weak merchant sloop sights you and BOLTS → her crew cries your name.
      tw.qaSetNpcClass(0, 'sloop', 'merchant');
      tw.qaPlaceShip(0, P.HX + 120, P.HZ + 120);
      for (let i = 0; i < 20; i++) tw.step(1 / 60);
      const cry1 = tw.fearfulHail;
      const title = tw.state.title;
      // (B-anti-repeat) a SECOND weak sloop bolts → a second cry, never the same line running.
      tw.qaSetNpcClass(2, 'sloop', 'merchant');
      tw.qaPlaceShip(2, P.HX - 120, P.HZ + 120);
      for (let i = 0; i < 20; i++) tw.step(1 / 60);
      const cry2 = tw.fearfulHail;

      // (C) an APEX reaction is SILENT: reclass both nearby hulls to a warship man-o'-war (she holds), clear,
      // and step — nothing dread-flees, so no cry.
      tw.qaClearFearfulHail();
      tw.qaSetNpcClass(0, 'manowar', 'warship');
      tw.qaSetNpcClass(2, 'manowar', 'warship');
      tw.qaPlaceShip(0, P.HX + 120, P.HZ + 120);
      tw.qaPlaceShip(2, P.HX + 160, P.HZ + 120);
      for (let i = 0; i < 20; i++) tw.step(1 / 60);
      const apexCry = tw.fearfulHail;

      return { skipped: false, cry1, cry2, title, apexCry };
    }, { HX, HZ, INF: FLEE_INF });

    if (!hail.skipped) {
      if (!hail.cry1) fail('fearful hail (#175): a weak merchant bolting from a feared captain cried NOTHING — the HEAR half is silent');
      if (hail.cry1.kind !== 'flee') fail(`fearful hail (#175): the flee cry was mis-tagged (kind=${hail.cry1.kind})`);
      if (!hail.cry1.text.includes(hail.title)) fail(`fearful hail (#175): the flee cry did not NAME you ("${hail.cry1.text}" ∌ "${hail.title}")`);
      if (hail.cry1.tier !== fearTier(FLEE_INF)) fail(`fearful hail (#175): the flee cry's tier (${hail.cry1.tier}) ≠ your notoriety tier (${fearTier(FLEE_INF)})`);
      if (!hail.cry2) fail('fearful hail (#175): a second bolting merchant cried nothing');
      if (hail.cry2.text === hail.cry1.text) fail('fearful hail (#175): two consecutive cries repeated the SAME line (anti-repeat broken)');
      if (hail.apexCry) fail(`fearful hail (#175): an APEX (non-dread) reaction cried "${hail.apexCry.text}" — a peer/apex must stay SILENT`);
    }

    // (D) a dread EARLY-STRIKE cries your name; a PEER's vanilla strike is silent. A Terror in a SLOOP
    // (a gentle broadside — sink-safe) keeps notoriety-driven dread high (pressure ~0.32 vs a sloop
    // merchant) while never drowning a battered prey before she can strike; her hull is set below the
    // early-strike ceiling (≤0.6) and her nerve broken, so the volley trips a genuine dread early-strike.
    const STRIKE_INF = 1600;
    const strike = await page.evaluate(async (P) => {
      const tw = window.__tidewake;
      function engageAt(cls, role) {
        tw.newVoyage(); tw.setColours('black'); tw.setInfamy(P.INF); tw.setStanding(0); tw.qaSetPlayerClass('sloop');
        tw.qaSetNpcClass(0, cls, role);
        tw.qaSetNpcClass(2, 'manowar', 'warship');       // keep the spare from bolting into our patch
        tw.qaPlaceShip(2, P.HX + 6000, P.HZ);            // …and shove her clear of sight
        tw.qaTeleport(P.HX, P.HZ);
        tw.qaPlaceShip(0, P.HX + 30, P.HZ + 30);         // right alongside → nearest in engage range
        tw.step(1 / 60);
        const ok = tw.engageBattle();
        tw.qaClearFearfulHail();                          // clear any flee cry from the approach — isolate the STRIKE
        return ok ? tw.battle : null;
      }
      // dreaded prey (a bigger-hulled brig merchant → generous sink margin): a dread early-strike CRIES your name
      const preyB = engageAt('brig', 'merchant');
      let preyStrikeCry = null, struck = false;
      if (preyB && preyB.active) {
        tw.battleBreakFoe();          // break her nerve (morale → the yield band)
        tw.battleWeaken(0.55);        // …and wound her hull below the early-strike ceiling (0.6), well clear of sinking
        tw.battleFire();
        struck = !!tw.battle.surrenderPending;
        preyStrikeCry = tw.fearfulHail;
        tw.acceptSurrender();
      }
      // a PEER (warship frigate) strikes by VANILLA morale — no dread → SILENT
      const peerB = engageAt('frigate', 'warship');
      let peerStruck = false, peerCry = null;
      if (peerB && peerB.active) {
        tw.battleBreakFoe(); tw.battleWeaken(0.55); tw.battleFire();
        peerStruck = !!tw.battle.surrenderPending;
        peerCry = tw.fearfulHail;
        if (tw.battle.active) tw.fleeBattle();
      }
      return { preyEngaged: !!(preyB && preyB.active), struck, preyStrikeCry,
               peerEngaged: !!(peerB && peerB.active), peerStruck, peerCry };
    }, { HX, HZ, INF: STRIKE_INF });

    if (strike.preyEngaged) {
      if (!strike.struck) fail('fearful hail (#175): a broken, dreaded prey never struck (surrender flag never opened)');
      if (!strike.preyStrikeCry) fail('fearful hail (#175): a dread EARLY-STRIKE cried nothing — the HEAR half is silent on the strike path');
      else {
        if (strike.preyStrikeCry.kind !== 'strike') fail(`fearful hail (#175): the strike cry was mis-tagged (kind=${strike.preyStrikeCry.kind})`);
        if (!strike.preyStrikeCry.text.includes(strike.preyStrikeCry.title)) fail(`fearful hail (#175): the strike cry did not NAME you ("${strike.preyStrikeCry.text}")`);
        if (strike.preyStrikeCry.tier !== fearTier(STRIKE_INF)) fail(`fearful hail (#175): the strike cry's tier (${strike.preyStrikeCry.tier}) ≠ your notoriety tier (${fearTier(STRIKE_INF)})`);
      }
    }
    if (strike.peerEngaged && strike.peerStruck && strike.peerCry) fail(`fearful hail (#175): a PEER's vanilla strike cried "${strike.peerCry.text}" — only DREAD names you`);

    // Restore the sea PRISTINE (classes + positions + player + a clean ledger/colours), no trailing step.
    await page.evaluate((o) => {
      const tw = window.__tidewake;
      o.classes.forEach((c) => { if (c && c.cls) tw.qaSetNpcClass(c.i, c.cls, c.role); });
      o.positions.forEach((p, i) => { if (p) tw.qaPlaceShip(i, p[0], p[1]); });
      tw.newVoyage(); tw.setInfamy(0); tw.setStanding(0); tw.setColours('black'); tw.qaClearFearfulHail();
      if (o.player) tw.qaTeleport(o.player[0], o.player[1]);
    }, origH);

    if (process.exitCode !== 1) console.log(`  ✓ fearful hail (#175): a bolting merchant cries your NAME ("${hail.cry1 ? hail.cry1.text : 'n/a'}", tier ${hail.cry1 ? hail.cry1.tier : '?'}), a second bolt draws a DIFFERENT line (anti-repeat), an apex reaction is SILENT; a dread early-strike names you while a peer's vanilla strike is silent — reuses the hail banner + rep-sting bus, 0 draws, no save bump`);
  }

  // 2b8) THE BOUNTY BOARD (#173, epic #168 "THE RISE" slice 5) — the "one more voyage" hook. A port
  // board posts a NAMED wanted vessel with a tier-scaled purse; accepting sets her as the active
  // objective (a chart marker to hunt her down) and DEFEATING the named target claims the purse ONCE
  // into your coin (which funds the workshop/shipwright). It rides the EXISTING objective slot as a NEW
  // KIND — no save bump (stays v18). Prove, all deterministic + headless: (A) accept → the bounty is the
  // active objective with a finite marker heading + a real purse; (B) DEFEATING a WRONG (ordinary) foe
  // does NOT claim it — the bounty stays active, no purse paid; (C) DEFEATING the named target claims the
  // tier-scaled purse EXACTLY ONCE, and the reward lands in COIN (+ fame in renown); (D) claim-once — the
  // pin clears so it can never re-pay.
  {
    const bounty = await page.evaluate(async () => {
      const tw = window.__tidewake;
      const out = {};
      // (A) accept → marker. A fresh voyage starts undocked; the QA hook synthesizes a deterministic
      // posting so the accept→hunt→claim loop is drivable without first steering into a port.
      tw.newVoyage(); tw.step(1 / 60);
      tw.qaSetLedger({ coins: 0, infamy: 0, standing: 0 });
      tw.acceptBounty();
      const obj = tw.objective;
      out.accepted = !!(obj && obj.kind === 'bounty' && obj.status === 'active');
      out.targetName = obj && obj.target && obj.target.name;
      out.markerFinite = !!(obj && obj.target && Number.isFinite(obj.target.x) && Number.isFinite(obj.target.z));
      out.purse = (obj && obj.payoff && obj.payoff.coins) || 0;
      out.fame = (obj && obj.payoff && obj.payoff.fame) || 0;
      const mx = obj.target.x, mz = obj.target.z;

      // (B) WRONG target → no claim. Fight an ordinary foe FAR from the marked lane (so she is NOT
      // dressed as the wanted vessel), sink/capture her, and the bounty must remain active + unpaid.
      const fx = mx + 3000, fz = mz + 3000; // well outside the hunt radius
      tw.qaTeleport(fx, fz); tw.qaPlaceShip(0, fx + 30, fz + 30); tw.step(1 / 60);
      const wrongEngaged = tw.engageBattle();
      out.wrongFoeName = tw.battle.foeName;
      out.wrongIsOrdinary = tw.battle.foeName !== out.targetName;
      const coinsBeforeWrong = tw.state.coins;
      if (wrongEngaged) {
        tw.battleBreakFoe(); tw.battleFire();
        if (tw.battle.surrenderPending) tw.acceptSurrender();
        else if (tw.battle.active) tw.fleeBattle();
      }
      out.wrongResolved = !tw.battle.active;
      out.bountyStillActiveAfterWrong = !!(tw.objective && tw.objective.kind === 'bounty');
      out.wrongPurseBled = tw.state.coins - coinsBeforeWrong; // capture spoils only, NOT the bounty purse

      // (C) DEFEAT the named target → claim once, into coin. Force-dress the engaged foe as the wanted
      // vessel (a QA force, like battleBreakFoe), then break + take her surrender → the board pays out.
      tw.qaTeleport(fx, fz); tw.qaPlaceShip(0, fx + 30, fz + 30); tw.step(1 / 60);
      const dressed = tw.engageBountyFoe();
      out.dressedEngaged = !!dressed;
      out.dressedName = tw.battle.foeName;
      out.dressedIsTarget = tw.battle.foeName === out.targetName;
      const coinsBeforeClaim = tw.state.coins;
      const infamyBeforeClaim = tw.state.infamy;
      if (dressed) {
        tw.battleBreakFoe(); tw.battleFire();
        out.struck = !!tw.battle.surrenderPending;
        if (tw.battle.surrenderPending) tw.acceptSurrender();
      }
      out.coinDelta = tw.state.coins - coinsBeforeClaim;
      out.infamyDelta = tw.state.infamy - infamyBeforeClaim;
      out.claimedCleared = !tw.objective; // the pin cleared on claim (claim-once)

      // (D) claim-once — no active bounty now, so a further defeat can't re-pay the purse.
      out.reEngageAfterClaim = tw.engageBountyFoe(); // null: nothing left to hunt

      tw.newVoyage(); tw.step(0.1); // restore a clean slate for the downstream sections
      return out;
    });
    // (A)
    if (!bounty.accepted) fail('bounty board (#173): accepting a posted bounty did not set the active bounty objective');
    if (!bounty.targetName) fail('bounty board (#173): the accepted bounty has no named wanted vessel');
    if (!bounty.markerFinite) fail('bounty board (#173): the bounty target carries no finite marker heading — the chart cannot pin the hunt');
    if (!(bounty.purse > 0)) fail(`bounty board (#173): the bounty posted no real purse (coins=${bounty.purse})`);
    // (B)
    if (bounty.wrongEngaged === false) console.warn('  (#173: no ordinary foe to engage for the wrong-target check — skipped)');
    if (!bounty.wrongIsOrdinary) fail(`bounty board (#173): an ordinary foe shared the wanted vessel's name (${bounty.wrongFoeName}) — the name pools must be disjoint`);
    if (!bounty.bountyStillActiveAfterWrong) fail('bounty board (#173): defeating a WRONG foe wrongly cleared the bounty — only the named target may claim it');
    if (bounty.wrongPurseBled >= bounty.purse) fail(`bounty board (#173): a wrong-target defeat paid out the bounty purse (Δ${bounty.wrongPurseBled} ≥ purse ${bounty.purse}) — no-claim broken`);
    // (C)
    if (!bounty.dressedEngaged) fail('bounty board (#173): could not engage the wanted vessel for the claim check');
    if (!bounty.dressedIsTarget) fail(`bounty board (#173): the foe at the marker was not the named target (foe=${bounty.dressedName}, wanted=${bounty.targetName})`);
    if (!bounty.struck) fail('bounty board (#173): the wanted vessel never struck her colours — could not reach the defeat→claim');
    if (!bounty.claimedCleared) fail('bounty board (#173): claiming the bounty did not clear the pin (claim-once guard missing)');
    if (!(bounty.coinDelta >= bounty.purse)) fail(`bounty board (#173): the tier-scaled purse did not land in COIN on defeat (Δ${bounty.coinDelta}c < purse ${bounty.purse}c)`);
    if (!(bounty.infamyDelta >= bounty.fame)) fail(`bounty board (#173): the bounty fame did not land in renown (Δ${bounty.infamyDelta} < fame ${bounty.fame})`);
    // (D)
    if (bounty.reEngageAfterClaim) fail('bounty board (#173): a bounty could be re-hunted after being claimed — the purse could double-pay');
    if (process.exitCode !== 1) console.log(`  ✓ bounty board (#173, THE RISE): accept posts "${bounty.targetName}" as a marked hunt (${bounty.purse}c purse); a WRONG foe (${bounty.wrongFoeName}) does NOT claim it (bounty stays active); running down the named target claims the purse ONCE into coin (+${bounty.coinDelta}c, +${bounty.infamyDelta} renown) and clears the pin — the earn→spend loop closes, no save bump (v${SAVE_VERSION})`);
  }

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

  // 2p′) Loose town props (#101 phase 3): every port is dressed with glowing LANTERNS + market STALLS
  // so a quay feels LIVED-IN, placed DETERMINISTICALLY per-town, drawn only in the town view and CULLED
  // to zero at open sea. Prove: props placed, per-town layout is stable across a reload, far sea = 0 cost,
  // near a port the loose dressing draws.
  const townProps = await page.evaluate(async () => {
    const tw = window.__tidewake;
    tw.newVoyage(); tw.step(0.1);
    const all = tw.townProps;
    // Sail far from every port → all clusters culled (0 cost at open sea).
    tw.qaTeleport(8000, 8000); tw.step(0.1);
    const farAway = tw.townProps.visible;
    // Drop just off the first port (within cull, outside the dock radius) → its loose dressing draws.
    const p = tw.ports[0].pos;
    tw.qaTeleport(p[0] + 150, p[1]); tw.step(0.1);
    const nearPort = tw.townProps.visible;
    // Determinism: a fresh voyage lays out the SAME count of loose props (seeded per-town).
    tw.newVoyage(); tw.step(0.1);
    const reloadCount = tw.townProps.count;
    return { count: all.count, clusters: all.clusters, kinds: all.kinds, farAway, nearPort, reloadCount };
  });
  if (!(townProps.count > 0)) fail(`town props (#101): no loose dressing placed (count=${townProps.count})`);
  if (!(townProps.clusters > 0)) fail(`town props (#101): no port clusters built (clusters=${townProps.clusters})`);
  if (!(Array.isArray(townProps.kinds) && townProps.kinds.includes('lantern') && townProps.kinds.includes('stall'))) fail(`town props (#101): missing lantern/stall kinds (${JSON.stringify(townProps.kinds)})`);
  if (townProps.farAway !== 0) fail(`town props (#101): loose props not culled at sea (visible=${townProps.farAway}) — the open sea must cost nothing`);
  if (!(townProps.nearPort > 0)) fail(`town props (#101): the quay is bare near a port (visible=${townProps.nearPort}) — the port must feel lived-in`);
  if (townProps.reloadCount !== townProps.count) fail(`town props (#101): the per-town layout is not deterministic (${townProps.count} → ${townProps.reloadCount} after reload)`);
  if (process.exitCode !== 1) console.log(`  ✓ loose town props (#101 phase 3): ${townProps.count} lanterns+stalls across ${townProps.clusters} ports feel lived-in near a quay (${townProps.nearPort} drawn), cost ZERO at open sea, deterministic per-town across a reload`);

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
  console.log(JSON.stringify({ ok: process.exitCode !== 1, ...result, budget: { BUDGET, ...budget }, duel, cannon, onboarding, persisted, pwa, settings, settingsPersist, collision, settle, mode, harbour, bump, daynight, weather, grade, needle, landfall, ballad, falseColours, marque, fauna, gulls, dolphins, curios, curiosLive, props, townProps, islandStyle, leak, broadside, cballs, juicePass, ammoCycle, boarding, gun, gunPersist, errors }, null, 2));
  if (process.exitCode !== 1) console.log('✓ PLAYTEST PASSED');
} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser.close();
  server.close();
}
