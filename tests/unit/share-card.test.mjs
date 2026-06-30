// Unit: the share-card PURE layout/data assembly (#149; #78/#90 follow-up; #53 standard).
// "Share the Ballad as an image" splits, like every flourish, into a PURE testable core
// (word-wrap + a positioned card model + canvas dimensions — no DOM) and a thin DOM raster
// (src/ui/ballad.js paints the model onto a 2D canvas + triggers the download). These tests
// pin the pure core: deterministic, browser-free, faithful to every ballad line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapText, buildShareCard, CARD_LAYOUT } from '../../src/share-card.js';
import { composeBallad } from '../../src/voyage-log.js';

const wordsOf = (s) => String(s).split(/\s+/).filter(Boolean);

// ---- wrapText -------------------------------------------------------------------------

test('wrapText greedily fills lines and never exceeds maxChars (multi-word lines)', () => {
  const lines = wrapText('the quick brown fox jumped over the lazy dog', 12);
  for (const l of lines) {
    if (wordsOf(l).length > 1) assert.ok(l.length <= 12, `"${l}" (${l.length}) exceeds 12`);
  }
});

test('wrapText preserves every word, in order', () => {
  const text = 'You raised Gallows Cay out of the haze and wrote it onto your chart forever';
  const joined = wrapText(text, 20).join(' ');
  assert.deepEqual(wordsOf(joined), wordsOf(text));
});

test('wrapText keeps an over-long word intact on its own line (a long ship name)', () => {
  const lines = wrapText('met the Insufferablenavigator at sea', 10);
  assert.ok(lines.includes('Insufferablenavigator'));
});

test('wrapText is deterministic and tolerant of junk input', () => {
  assert.deepEqual(wrapText('a b c', 4), wrapText('a b c', 4));
  assert.deepEqual(wrapText('', 10), ['']);
  assert.deepEqual(wrapText(null, 10), ['']);
  assert.deepEqual(wrapText('hello', 0), ['hello']); // bad width floors to 1 word/line, never throws
});

// ---- buildShareCard -------------------------------------------------------------------

const sampleLog = [
  { type: 'landfall', name: 'Gallows Cay' },
  { type: 'cannon', foe: 'HMS Folly', infamy: 40, coins: 120 },
  { type: 'duel', foe: 'Black Sal', infamy: 12, coins: 30 },
  { type: 'legend', pole: 'pirate', title: 'Terror of the Tidewake' },
];

test('buildShareCard returns positive integer dimensions at the fixed card width', () => {
  const card = buildShareCard(composeBallad(sampleLog));
  assert.equal(card.width, CARD_LAYOUT.width);
  assert.ok(Number.isInteger(card.height) && card.height > 0);
  assert.ok(card.width > 0);
});

test('buildShareCard includes the title and one block per ballad line, in order', () => {
  const ballad = composeBallad(sampleLog);
  const card = buildShareCard(ballad);
  assert.equal(card.title.text, ballad.title);
  assert.equal(card.blocks.length, ballad.lines.length);
  assert.equal(card.blocks[0].role, 'opening');
  assert.equal(card.blocks[card.blocks.length - 1].role, 'footer');
});

test('buildShareCard wraps faithfully — reassembled words equal the source ballad', () => {
  const ballad = composeBallad(sampleLog);
  const card = buildShareCard(ballad);
  card.blocks.forEach((b, i) => {
    assert.deepEqual(wordsOf(b.wrapped.join(' ')), wordsOf(ballad.lines[i]));
    b.wrapped.forEach((w) => assert.ok(w.length > 0)); // no empty wrapped lines on real text
  });
});

test('buildShareCard grows taller with more deeds (more verses → more height)', () => {
  const small = buildShareCard(composeBallad([sampleLog[0]]));
  const big = buildShareCard(composeBallad(sampleLog));
  assert.ok(big.height > small.height);
});

test('buildShareCard is fully deterministic (same ballad → identical model)', () => {
  const ballad = composeBallad(sampleLog);
  assert.deepEqual(buildShareCard(ballad), buildShareCard(ballad));
});

test('buildShareCard block y-positions are monotonically increasing (no overlap)', () => {
  const card = buildShareCard(composeBallad(sampleLog));
  assert.ok(card.title.y > 0);
  assert.ok(card.divider.y > card.title.y);
  let prev = card.divider.y;
  for (const b of card.blocks) {
    assert.ok(b.y > prev, 'each block sits below the previous');
    prev = b.y + (b.wrapped.length - 1) * b.lineHeight;
  }
  assert.ok(card.watermark.y > prev);
  assert.ok(card.height >= card.watermark.y);
});

test('buildShareCard handles the empty "yet unwritten" ballad as a single warm block', () => {
  const card = buildShareCard(composeBallad([]));
  assert.equal(card.blocks.length, 1);
  assert.ok(card.height > 0);
});

test('buildShareCard tolerates a junk/missing ballad without throwing', () => {
  const card = buildShareCard(null);
  assert.equal(card.title.text, 'The Ballad of Your Voyage');
  assert.deepEqual(card.blocks, []);
  assert.ok(card.height > 0);
});
