import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function runCheck() {
  return execFileSync('bash', ['scripts/pm-desk.sh', '--check'], { encoding: 'utf8' });
}

test('--check is a dry run that exits 0 and prints the resolved config', () => {
  const out = runCheck();
  assert.match(out, /DRY RUN/);
  assert.match(out, /tidewake-pm/, 'should print the worktree path');
  assert.match(out, /pm-desk/, 'should print the branch name');
  assert.match(out, /PM-DESK\.md/, 'should print the manual path');
});

test('--check never launches claude', () => {
  const out = runCheck();
  assert.doesNotMatch(out, /Launching the PM desk session/, '--check must not launch claude');
});
