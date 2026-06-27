import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const REQUIRED_KEYS = ['id', 'date', 'type', 'status', 'value', 'feasibility', 'decision', 'issue', 'assets'];
const STATUSES = ['raw', 'triaging', 'needs-clarification', 'assessed', 'accepted', 'parked', 'declined'];

test('TEMPLATE.md frontmatter declares every required key', () => {
  const tpl = readFileSync('studio/feedback/TEMPLATE.md', 'utf8');
  for (const key of REQUIRED_KEYS) {
    assert.match(tpl, new RegExp(`^${key}:`, 'm'), `TEMPLATE.md missing key: ${key}`);
  }
});

test('TEMPLATE.md documents the canonical pipeline states', () => {
  const tpl = readFileSync('studio/feedback/TEMPLATE.md', 'utf8');
  for (const s of STATUSES) {
    assert.ok(tpl.includes(s), `TEMPLATE.md should mention status: ${s}`);
  }
});

test('REGISTER.md exists and shows the status legend', () => {
  const reg = readFileSync('studio/feedback/REGISTER.md', 'utf8');
  for (const s of STATUSES) {
    assert.ok(reg.includes(s), `REGISTER.md should list status: ${s}`);
  }
});
