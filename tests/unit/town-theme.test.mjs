import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  townMusicIdentity,
  townDockedCue,
  TOWN_ROOTS,
  TOWN_MODES,
  TOWN_TINTS,
  TOWN_CUE_SHAPES,
} from '../../src/town-theme.js';
import { midiToFreq } from '../../src/music.js';

// The three real ports (ports.js PORT_NAMES) — a town must always sound like itself.
const PORTS = ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"];

test('townMusicIdentity: deterministic — same port name → identical identity every call', () => {
  for (const name of PORTS) {
    const a = townMusicIdentity(name);
    const b = townMusicIdentity(name);
    assert.deepEqual(a, b, `${name} must be stable across calls (a town always sounds like itself)`);
  }
});

test('townMusicIdentity: the real ports are musically DISTINCT from one another', () => {
  const sigs = PORTS.map((n) => {
    const id = townMusicIdentity(n);
    return `${id.rootMidi}|${id.mode}|${id.tint}`;
  });
  const unique = new Set(sigs);
  assert.equal(unique.size, PORTS.length, `each town needs its own character, got ${sigs.join(' , ')}`);
});

test('townMusicIdentity: every field is in a valid, sane range', () => {
  for (const name of PORTS) {
    const id = townMusicIdentity(name);
    assert.equal(id.port, name);
    assert.ok(Number.isFinite(id.seed) && id.seed >= 0, 'seed is a finite non-negative hash');
    // root drawn from the palette, in a warm tavern register.
    assert.ok(TOWN_ROOTS.includes(id.root), 'root from the palette');
    assert.ok(id.rootMidi >= 36 && id.rootMidi <= 60, `rootMidi in low register: ${id.rootMidi}`);
    assert.ok(TOWN_MODES.some((m) => m.name === id.mode), 'mode from the palette');
    assert.ok(id.thirdInterval === 3 || id.thirdInterval === 4, 'major or minor third');
    assert.ok(TOWN_TINTS.some((t) => t.name === id.tint), 'tint from the palette');
    assert.ok(id.lowpassHz >= 400 && id.lowpassHz <= 4000, 'lowpass in a woody..bright band');
    assert.ok(id.tremoloHz >= 1.5 && id.tremoloHz <= 4, 'tremolo a cosy wheeze');
    assert.ok(typeof id.leadType === 'string' && id.leadType.length > 0, 'a named lead tint');
  }
});

test('townMusicIdentity: chordMidi is a 4-note triad+octave built off the root + mode third', () => {
  for (const name of PORTS) {
    const id = townMusicIdentity(name);
    assert.equal(id.chordMidi.length, 4, 'root, third, fifth, octave');
    assert.equal(id.chordMidi[0], id.rootMidi, 'first note is the root');
    assert.equal(id.chordMidi[1], id.rootMidi + id.thirdInterval, 'second is the mode third');
    assert.equal(id.chordMidi[2], id.rootMidi + 7, 'third is the perfect fifth');
    assert.equal(id.chordMidi[3], id.rootMidi + 12, 'fourth is the octave');
    // All convert to finite, audible frequencies.
    for (const m of id.chordMidi) assert.ok(Number.isFinite(midiToFreq(m)) && midiToFreq(m) > 0);
  }
});

test('townMusicIdentity: headless-safe — junk / empty input never throws, returns a valid identity', () => {
  for (const junk of ['', undefined, null, 42, {}, '   ']) {
    const id = townMusicIdentity(junk);
    assert.ok(id && Number.isFinite(id.rootMidi), `junk ${String(junk)} → safe identity`);
    assert.equal(id.chordMidi.length, 4);
  }
});

test('townMusicIdentity: distinct names usually pick distinct keys (good spread across the palette)', () => {
  const names = ['Aaa', 'Bbb', 'Ccc', 'Ddd', 'Eee', 'Fff', 'Ggg', 'Hhh'];
  const roots = new Set(names.map((n) => townMusicIdentity(n).rootMidi));
  assert.ok(roots.size >= 3, `expected a spread of keys, got ${roots.size}`);
});

// ---- Docked cue (#129): the per-town landfall flourish ----

test('townDockedCue: deterministic — same port → identical cue every call (a town greets you the same way)', () => {
  for (const name of PORTS) {
    const a = townDockedCue(name);
    const b = townDockedCue(name);
    assert.deepEqual(a, b, `${name} docked cue must be stable across calls`);
  }
});

test('townDockedCue: the real ports get DISTINCT docked cues (each harbour greets you with its own character)', () => {
  const sigs = PORTS.map((n) => {
    const c = townDockedCue(n);
    return `${c.notes.join(',')}|${c.shape}|${c.type}`;
  });
  const unique = new Set(sigs);
  assert.equal(unique.size, PORTS.length, `each town needs its own docked flourish, got ${sigs.join(' / ')}`);
});

test('townDockedCue: the cue is voiced in the town\'s own key/mode + timbre, an octave up (bright, bell-like)', () => {
  for (const name of PORTS) {
    const id = townMusicIdentity(name);
    const cue = townDockedCue(name);
    assert.equal(cue.port, name);
    assert.equal(cue.mode, id.mode, 'cue carries the town mode');
    assert.equal(cue.type, id.leadType, 'cue is coloured by the town timbre (leadType)');
    assert.ok(TOWN_CUE_SHAPES.some((s) => s.name === cue.shape), 'shape from the palette');
    assert.equal(cue.notes.length, 4, 'a 4-note flourish');
    // Every note is one of the town's chord degrees lifted an octave — so the cue is IN the town's key.
    const upChord = id.chordMidi.map((m) => m + 12);
    for (const n of cue.notes) {
      assert.ok(upChord.includes(n), `note ${n} must come from the town chord (octave up)`);
      assert.ok(Number.isFinite(midiToFreq(n)) && midiToFreq(n) > 0, 'note is an audible frequency');
    }
    // The mode third is reachable in the flourish → the cue carries the town's major/minor colour.
    assert.ok(cue.notes.includes(id.rootMidi + id.thirdInterval + 12), 'the mode third rings in the cue');
    assert.ok(cue.rollSec > 0 && cue.peak > 0 && cue.tailSec > 0, 'sane roll/peak/tail timing');
  }
});

test('townDockedCue: accepts an already-resolved identity or a name interchangeably', () => {
  for (const name of PORTS) {
    assert.deepEqual(townDockedCue(townMusicIdentity(name)), townDockedCue(name),
      'identity-in and name-in must yield the same cue');
  }
});

test('townDockedCue: headless-safe — junk / empty input never throws, returns a valid cue', () => {
  for (const junk of ['', undefined, null, 42, {}, '   ']) {
    const cue = townDockedCue(junk);
    assert.ok(cue && Array.isArray(cue.notes) && cue.notes.length === 4, `junk ${String(junk)} → safe cue`);
    for (const n of cue.notes) assert.ok(Number.isFinite(n), 'notes are finite');
    assert.ok(typeof cue.type === 'string' && cue.type.length > 0, 'a named timbre');
  }
});

test('townDockedCue: distinct names spread across the motif shapes (harbours don\'t all peal alike)', () => {
  const names = ['Aaa', 'Bbb', 'Ccc', 'Ddd', 'Eee', 'Fff', 'Ggg', 'Hhh', 'Iii', 'Jjj'];
  const shapes = new Set(names.map((n) => townDockedCue(n).shape));
  assert.ok(shapes.size >= 2, `expected a spread of cue shapes, got ${shapes.size}`);
});
