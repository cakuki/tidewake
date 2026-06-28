import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotAshore, composeAshoreDigest, ASHORE_DIGEST_TITLE } from '../../src/systems/ashore-digest.js';

// ---- snapshotAshore: a tiny, robust capture of the delta-able state at landfall ----------------
test('snapshotAshore captures purse, hold and standing from live state', () => {
  const snap = snapshotAshore({ coins: 140, cargo: { rum: 2, spice: 1 }, infamy: 0, standing: 30, renown: 30 });
  assert.equal(snap.coins, 140);
  assert.equal(snap.hold, 3);
  assert.equal(snap.standing, 30);
  assert.equal(typeof snap.tier, 'number');
  assert.equal(typeof snap.pole, 'string');
  assert.equal(snap.objective, null);
});

test('snapshotAshore reads a chased objective by its target port name', () => {
  const snap = snapshotAshore({ coins: 100, objective: { target: { kind: 'port', name: "Gullet's Rest" } } });
  assert.equal(snap.objective, "Gullet's Rest");
});

test('snapshotAshore never throws on null/garbage (fail-open like the rest of the loop)', () => {
  const a = snapshotAshore(null);
  assert.equal(a.coins, 0);
  assert.equal(a.hold, 0);
  assert.equal(a.objective, null);
  assert.doesNotThrow(() => snapshotAshore({ coins: 'x', cargo: 7, infamy: NaN }));
});

// ---- composeAshoreDigest: the pure delta -> in-character digest --------------------------------
test('composeAshoreDigest always returns a titled, non-empty digest', () => {
  const before = snapshotAshore({ coins: 100 });
  const d = composeAshoreDigest(before, before, { port: 'Saltpurse Quay' });
  assert.equal(d.title, ASHORE_DIGEST_TITLE);
  assert.ok(Array.isArray(d.lines) && d.lines.length >= 1, 'a digest always speaks');
  assert.ok(/ashore/i.test(d.title), 'the signature "while you were ashore" phrasing');
});

test('composeAshoreDigest reports a heavier purse after a profitable visit', () => {
  const before = snapshotAshore({ coins: 100, standing: 0, infamy: 0 });
  const after = snapshotAshore({ coins: 160, standing: 0, infamy: 0 });
  const d = composeAshoreDigest(before, after, { port: 'Saltpurse Quay' });
  const body = d.lines.join(' ');
  assert.ok(/60 coins heavier/.test(body), `expected purse delta, got: ${body}`);
  assert.ok(body.includes('Saltpurse Quay'));
});

test('composeAshoreDigest reports a lighter purse and singular/plural coins correctly', () => {
  const many = composeAshoreDigest(snapshotAshore({ coins: 100 }), snapshotAshore({ coins: 70 }), { port: 'X' });
  assert.ok(/30 coins lighter/.test(many.lines.join(' ')));
  const one = composeAshoreDigest(snapshotAshore({ coins: 100 }), snapshotAshore({ coins: 99 }), { port: 'X' });
  assert.ok(/1 coin lighter/.test(one.lines.join(' ')), `singular coin, got: ${one.lines.join(' ')}`);
});

test('composeAshoreDigest names a freshly chased rumour as a heading to chase', () => {
  const before = snapshotAshore({ coins: 100 });
  const after = snapshotAshore({ coins: 100, objective: { target: { kind: 'port', name: 'Barnacle Bottom' } } });
  const body = composeAshoreDigest(before, after, { port: 'X' }).lines.join(' ');
  assert.ok(/Barnacle Bottom/.test(body), `names the chased port, got: ${body}`);
  assert.ok(/chase|heading|word/i.test(body));
});

test('composeAshoreDigest does not re-announce a rumour that was already being chased', () => {
  const obj = { objective: { target: { kind: 'port', name: 'Barnacle Bottom' } } };
  const before = snapshotAshore({ coins: 100, ...obj });
  const after = snapshotAshore({ coins: 100, ...obj });
  const body = composeAshoreDigest(before, after, { port: 'X' }).lines.join(' ');
  assert.ok(!/Barnacle Bottom/.test(body), `should not repeat a standing chase, got: ${body}`);
});

test('composeAshoreDigest marks a reputation rise (tier climbed while ashore)', () => {
  // standing 0 -> a high standing crosses a renown tier threshold
  const before = snapshotAshore({ coins: 100, standing: 0, infamy: 0 });
  const after = snapshotAshore({ coins: 100, standing: 9999, infamy: 0 });
  assert.ok(after.tier > before.tier, 'precondition: the tier actually climbs');
  const body = composeAshoreDigest(before, after, { port: 'Saltpurse Quay' }).lines.join(' ');
  assert.ok(/name|figure|standing|rates/i.test(body), `expected a reputation note, got: ${body}`);
});

test('composeAshoreDigest notes turning to a darker flag while ashore', () => {
  const before = snapshotAshore({ coins: 100, standing: 100, infamy: 0 });   // governor-leaning
  const after = snapshotAshore({ coins: 100, standing: 100, infamy: 100000 }); // now pirate-leaning
  assert.equal(before.pole, 'governor');
  assert.equal(after.pole, 'pirate');
  const body = composeAshoreDigest(before, after, { port: 'X' }).lines.join(' ');
  assert.ok(/darker|black|name/i.test(body), `expected a darker-flag note, got: ${body}`);
});

test('composeAshoreDigest falls back to a deterministic ambient line on a quiet visit', () => {
  const s = snapshotAshore({ coins: 100, standing: 10, infamy: 0 });
  const a = composeAshoreDigest(s, s, { port: 'Saltpurse Quay' });
  const b = composeAshoreDigest(s, s, { port: 'Saltpurse Quay' });
  assert.equal(a.lines.length, 1, 'a quiet visit gets exactly one ambient line');
  assert.deepEqual(a.lines, b.lines, 'ambient is deterministic for a given port');
  assert.ok(a.lines[0].includes('Saltpurse Quay'));
});

test('composeAshoreDigest caps the number of lines (concise toast)', () => {
  const before = snapshotAshore({ coins: 100, standing: 0, infamy: 0 });
  const after = snapshotAshore({
    coins: 250, standing: 9999, infamy: 0,
    objective: { target: { kind: 'port', name: 'Far Reach' } },
  });
  const d = composeAshoreDigest(before, after, { port: 'X', max: 2 });
  assert.ok(d.lines.length <= 2, `respects max, got ${d.lines.length}`);
});

test('composeAshoreDigest leaves no template tokens and is deterministic', () => {
  const before = snapshotAshore({ coins: 100 });
  const after = snapshotAshore({ coins: 175 });
  const a = composeAshoreDigest(before, after, { port: "Gullet's Rest" });
  const b = composeAshoreDigest(before, after, { port: "Gullet's Rest" });
  assert.deepEqual(a, b, 'same deltas -> identical digest');
  for (const line of a.lines) assert.ok(!/\{port\}|\{n\}/.test(line), `no stray tokens: ${line}`);
});

test('composeAshoreDigest never throws on null snapshots', () => {
  assert.doesNotThrow(() => composeAshoreDigest(null, null, { port: 'X' }));
  const d = composeAshoreDigest(null, snapshotAshore({ coins: 100 }), {});
  assert.ok(d.lines.length >= 1);
});
