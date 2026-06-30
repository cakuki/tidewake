import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle, quarterViewPos, engageLine, fleeLine, broadsideAim,
} from '../../src/systems/battle.js';
import { CHALLENGE_RANGE } from '../../src/duel.js';
import { MAX_HULL } from '../../src/cannons.js';

const half = () => 0.5; // deterministic rng

// A fake npcs handle: one ship at a controllable distance from the origin.
function fakeNpcs(ships) {
  return { snapshot: () => ships };
}

test('quarterViewPos: heading 0 pulls the camera astern, to starboard, and lifts it', () => {
  const [x, y, z] = quarterViewPos([0, 0], 0, { back: 95, side: 60, height: 52 });
  // forward = +z at heading 0 → astern is -z; starboard is +x; height lifts y.
  assert.ok(z < 0, 'camera sits astern (−z)');
  assert.ok(x > 0, 'camera sits to starboard (+x)');
  assert.equal(y, 52, 'camera lifted to the height');
});

test('quarterViewPos: the offset rotates with the heading (always behind-and-to-the-quarter)', () => {
  // At heading π (facing −z), astern is +z and starboard flips to −x.
  const [x, , z] = quarterViewPos([0, 0], Math.PI, { back: 95, side: 60, height: 52 });
  assert.ok(z > 0, 'astern flips to +z when facing −z');
  assert.ok(x < 0, 'starboard flips to −x when facing −z');
});

test('quarterViewPos: distance from the ship is stable regardless of heading', () => {
  const d0 = Math.hypot(...quarterViewPos([0, 0], 0).filter((_, i) => i !== 1));
  const d1 = Math.hypot(...quarterViewPos([0, 0], 1.3).filter((_, i) => i !== 1));
  assert.ok(Math.abs(d0 - d1) < 1e-9, 'horizontal stand-off is heading-independent');
});

test('engage: squares up to a foe in range, becomes active, names the foe', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0], kind: 'merchant' }]),
    getShipPos: () => [0, 0],
    rng: half,
  });
  assert.equal(battle.state.active, false);
  assert.equal(battle.inRange(), true);
  assert.equal(battle.engage(), true);
  assert.equal(battle.state.active, true);
  assert.ok(battle.state.foeName.length > 0, 'a characterful foe name is set');
  assert.equal(battle.snapshot().active, true);
});

test('engage: no-op when no ship is within range', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [CHALLENGE_RANGE + 50, 0] }]),
    getShipPos: () => [0, 0],
    rng: half,
  });
  assert.equal(battle.inRange(), false);
  assert.equal(battle.engage(), false);
  assert.equal(battle.state.active, false);
});

test('engage: idempotent no-op while already engaged', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    rng: half,
  });
  assert.equal(battle.engage(), true);
  assert.equal(battle.engage(), false, 'a second engage while active does nothing');
});

test('flee: always ends an active stance and clears the foe', () => {
  let fled = null;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    onFlee: ({ foeName }) => { fled = foeName; },
    rng: half,
  });
  battle.engage();
  const foe = battle.state.foeName;
  assert.equal(battle.flee(), true);
  assert.equal(battle.state.active, false);
  assert.equal(battle.state.foeName, '');
  assert.equal(fled, foe, 'onFlee announces which foe you broke off from');
});

test('flee: no-op when not engaged', () => {
  const battle = createBattle({ npcs: fakeNpcs([]), getShipPos: () => [0, 0] });
  assert.equal(battle.flee(), false);
});

test('end: drops the stance with no flee flourish (cannonade-resolved / new voyage)', () => {
  let fled = false;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    onFlee: () => { fled = true; },
    rng: half,
  });
  battle.engage();
  battle.end();
  assert.equal(battle.state.active, false);
  assert.equal(fled, false, 'end() must not fire the flee flourish');
});

test('onEnter fires with the foe name on a real engagement', () => {
  let entered = null;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [5, 5] }]),
    getShipPos: () => [0, 0],
    onEnter: (info) => { entered = info; },
    rng: half,
  });
  battle.engage();
  assert.ok(entered && entered.foeName, 'onEnter receives the foe name');
  assert.equal(entered.foeIndex, 0);
});

test('a throwing onEnter/onFlee subscriber never corrupts the stance', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [5, 5] }]),
    getShipPos: () => [0, 0],
    onEnter: () => { throw new Error('boom'); },
    onFlee: () => { throw new Error('boom'); },
    rng: half,
  });
  assert.equal(battle.engage(), true);
  assert.equal(battle.state.active, true);
  assert.equal(battle.flee(), true);
  assert.equal(battle.state.active, false);
});

test('line pickers return on-tone strings from their pools', () => {
  assert.equal(typeof engageLine(half), 'string');
  assert.equal(typeof fleeLine(half), 'string');
  assert.ok(engageLine(() => 0).length > 0);
  assert.ok(fleeLine(() => 0.999).length > 0);
});

// ---- Real-time broadside (#135 slice 2) ------------------------------------

test('broadsideAim: a foe directly abeam to starboard is a clean shot (quality ~1)', () => {
  // heading 0 → forward +z, starboard +x. A foe at +x sits dead abeam to starboard.
  const a = broadsideAim([0, 0], 0, [50, 0]);
  assert.ok(a.quality > 0.99, `quality ${a.quality} should be ~1`);
  assert.equal(a.side, 'starboard');
  assert.equal(a.inArc, true);
});

test('broadsideAim: a foe to port reports the port side, still a clean shot', () => {
  const a = broadsideAim([0, 0], 0, [-50, 0]);
  assert.ok(a.quality > 0.99);
  assert.equal(a.side, 'port');
  assert.equal(a.inArc, true);
});

test('broadsideAim: a foe dead ahead is out of the broadside arc (quality ~0)', () => {
  const a = broadsideAim([0, 0], 0, [0, 50]); // straight off the bow (+z)
  assert.ok(a.quality < 0.01, `quality ${a.quality} should be ~0`);
  assert.equal(a.inArc, false);
});

test('engage: loads the guns and seeds full hulls for the real-time broadside', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    rng: half,
  });
  battle.engage();
  const s = battle.snapshot();
  assert.equal(s.playerHull, MAX_HULL);
  assert.equal(s.enemyHull, MAX_HULL);
  assert.equal(s.loaded, true, 'you square up with the guns loaded and ready');
  assert.equal(s.reload, 0);
});

test('fire: a clean beam broadside damages the foe and sets the reload timer', () => {
  // Foe abeam to starboard (heading 0, foe at +x).
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [60, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    reloadSeconds: 2,
    rng: half,
  });
  battle.engage();
  const r = battle.fire();
  assert.ok(r && r.enemyHit > 0, 'a beam broadside bites');
  assert.ok(battle.snapshot().enemyHull < MAX_HULL, 'the foe took hull damage');
  assert.ok(battle.snapshot().reload > 0, 'the guns are now reloading');
  assert.equal(battle.fire(), null, 'cannot fire again while reloading');
});

test('tick: advancing time reloads the guns so you can fire again', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [60, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    reloadSeconds: 2,
    rng: half,
  });
  battle.engage();
  battle.fire();
  assert.equal(battle.snapshot().loaded, false);
  battle.tick(2.5); // wait out the reload
  assert.equal(battle.snapshot().loaded, true, 'the guns are loaded again');
  assert.ok(battle.fire(), 'and can fire once more');
});

test('fire: repeated clean broadsides sink the foe and resolve the engagement to a win', () => {
  let resolved = null, rewarded = null;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [60, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    reloadSeconds: 1,
    applyReward: (r) => { rewarded = r; },
    onResolve: (info) => { resolved = info; },
    rng: half,
  });
  battle.engage();
  for (let i = 0; i < 20 && battle.state.active; i++) { battle.fire(); battle.tick(1); }
  assert.equal(battle.state.active, false, 'the engagement ended');
  assert.ok(resolved, 'onResolve fired');
  assert.equal(resolved.result, 'win');
  assert.ok(rewarded && rewarded.infamy > 0, 'sinking pays Infamy');
});

test('fire: a wide shot (foe off the bow) does no hull damage but burns the load', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [0, 60] }]), // dead ahead at heading 0 → out of arc
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    reloadSeconds: 2,
    rng: half,
  });
  battle.engage();
  const r = battle.fire();
  assert.equal(r.enemyHit, 0, 'firing wide scratches nothing');
  assert.equal(battle.snapshot().enemyHull, MAX_HULL);
  assert.ok(battle.snapshot().reload > 0, 'but the volley is spent — you must reload');
});

test('fire: no-op when not engaged', () => {
  const battle = createBattle({ npcs: fakeNpcs([]), getShipPos: () => [0, 0] });
  assert.equal(battle.fire(), null);
});

// ---- Workshop loadouts + mid-combat shot cycle (#135 slice 3) ---------------

test('engage: loads the first fitted shot from the workshop loadout', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    getLoadout: () => ['chain', 'grape'],
    rng: half,
  });
  battle.engage();
  assert.equal(battle.snapshot().ammo, 'chain', 'you square up with the first fitted shot loaded');
});

test('engage: defaults to round when nothing is wired (slice-2 callers unchanged)', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    rng: half,
  });
  battle.engage();
  assert.equal(battle.snapshot().ammo, 'round');
});

test('cycleShot: one call walks the fitted loadout and wraps; no-op when not engaged', () => {
  let cycled = null;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    getLoadout: () => ['round', 'chain', 'grape'],
    onCycleAmmo: ({ ammo }) => { cycled = ammo; },
    rng: half,
  });
  assert.equal(battle.cycleShot(), 'round', 'no-op (returns current) while not engaged');
  battle.engage();
  assert.equal(battle.cycleShot(), 'chain');
  assert.equal(cycled, 'chain', 'onCycleAmmo announces the newly-loaded shot');
  assert.equal(battle.cycleShot(), 'grape');
  assert.equal(battle.cycleShot(), 'round', 'wraps back to the first fitted shot');
});

test('the loaded shot changes the broadside: chain dents the hull less than round', () => {
  const make = (loadout) => createBattle({
    npcs: fakeNpcs([{ pos: [60, 0] }]), // dead abeam to starboard
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    getLoadout: () => loadout,
    reloadSeconds: 2,
    rng: half,
  });
  const roundB = make(['round']); roundB.engage();
  const chainB = make(['chain']); chainB.engage();
  const rHit = roundB.fire().enemyHit;
  const cHit = chainB.fire().enemyHit;
  assert.ok(cHit < rHit, `chain (${cHit}) should dent less than round (${rHit})`);
});

test('cycleShot does not reset an in-progress reload (you swap the rack, not re-swab the gun)', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [60, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    getLoadout: () => ['round', 'chain'],
    reloadSeconds: 2,
    rng: half,
  });
  battle.engage();
  battle.fire();
  const r = battle.snapshot().reload;
  assert.ok(r > 0);
  battle.cycleShot();
  assert.equal(battle.snapshot().reload, r, 'the reload timer is untouched by a shot swap');
});

// ---- Boarding → crew brawl → captain's-duel hand-off (#135 slice 4) -------------------

test('canBoard: false until the foe is beaten to ≤30% hull, then true', () => {
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    getShipHeading: () => 0,
    rng: half,
  });
  battle.engage();
  assert.equal(battle.canBoard(), false, 'a full-hull foe is not boardable');
  assert.equal(battle.snapshot().canBoard, false);
  battle.state.enemyHull = battle.state.maxHull * 0.30; // beat her down to the line
  assert.equal(battle.canBoard(), true, 'at ≤30% hull she is boardable');
  assert.equal(battle.snapshot().canBoard, true);
});

test('canBoard: false while un-engaged or already boarded', () => {
  const battle = createBattle({ npcs: fakeNpcs([{ pos: [10, 0] }]), getShipPos: () => [0, 0], rng: half });
  assert.equal(battle.canBoard(), false, 'no stance → no boarding');
  battle.engage();
  battle.state.enemyHull = 10;
  battle.board();
  assert.equal(battle.state.boarded, true);
  assert.equal(battle.canBoard(), false, 'cannot board twice in one engagement');
});

test('board: no-op unless she is beaten down (returns null, fires no hand-off)', () => {
  let handed = 0;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    onBoard: () => { handed++; },
    rng: half,
  });
  battle.engage();
  assert.equal(battle.board(), null, 'a full-hull foe cannot be boarded');
  assert.equal(handed, 0, 'no hand-off fires');
});

test('board: resolves a comic brawl and hands the foe off for the captain duel', () => {
  let handed = null;
  const battle = createBattle({
    npcs: fakeNpcs([{ pos: [10, 0] }]),
    getShipPos: () => [0, 0],
    getCrewMorale: () => 100,
    getLoadout: () => ['round', 'grape'],
    onBoard: (info) => { handed = info; },
    rng: half,
  });
  battle.engage();
  battle.state.enemyHull = battle.state.maxHull * 0.2;
  battle.state.enemyMorale = 18;
  const brawl = battle.board();
  assert.ok(brawl, 'board returns the resolved brawl');
  assert.ok(Array.isArray(brawl.lines) && brawl.lines.length >= 2, 'the brawl narrates 2–3 comic lines');
  assert.ok(handed && handed.foeName, 'onBoard hands the foe off (for duel.tryChallenge)');
  assert.equal(handed.brawl, brawl, 'the hand-off carries the brawl result (advantage feeds the duel dent)');
  assert.equal(battle.state.boarded, true, 'the engagement is marked boarded');
});
