import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manual = () => readFileSync('studio/feedback/PM-DESK.md', 'utf8');

test('manual states the hard write-limits (no game code)', () => {
  const m = manual();
  assert.match(m, /MUST NOT/);
  assert.match(m, /src\//);
});

test('manual requires explicit owner confirmation before ticketing', () => {
  const m = manual();
  assert.match(m, /explicit/i);
  assert.match(m, /[Nn]ever self-accept/);
});

test('manual specifies a Tech Lead feasibility subagent', () => {
  const m = manual();
  assert.match(m, /Tech Lead subagent/);
  assert.match(m, /effort.*S\/M\/L/i);
});

test('manual covers the four funnel stages and roadmap Q&A', () => {
  const m = manual();
  for (const s of ['Clarify', 'Value', 'Feasibility', 'Recommend', 'Roadmap Q&A']) {
    assert.ok(m.includes(s), `manual should cover: ${s}`);
  }
});
