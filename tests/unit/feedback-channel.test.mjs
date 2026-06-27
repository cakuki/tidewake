import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PM agent references the feedback desk channel', () => {
  const pm = readFileSync('studio/agents/product-manager.md', 'utf8');
  assert.match(pm, /studio\/feedback/);
  assert.match(pm, /feedback desk/i);
});

test('comms README lists the feedback store', () => {
  const readme = readFileSync('studio/comms/README.md', 'utf8');
  // comms/README.md uses relative paths (e.g. ../memory/<role>.md), so the
  // feedback store is referenced as ../feedback/ to match that convention.
  assert.match(readme, /\.\.\/feedback\//);
});
