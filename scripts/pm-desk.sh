#!/usr/bin/env bash
# Tidewake PM Desk — launch a separate, pre-prompted Product Manager session in an
# isolated git worktree, so owner feedback can be triaged without disturbing the build loop.
#
# Usage:
#   scripts/pm-desk.sh           launch the desk
#   scripts/pm-desk.sh --check   dry run: validate setup, print config, do not launch
set -euo pipefail

BRANCH="pm-desk"
MANUAL_REL="studio/feedback/PM-DESK.md"

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE="$(dirname "$REPO_ROOT")/tidewake-pm"
MANUAL="$REPO_ROOT/$MANUAL_REL"

OPEN_PROMPT="You are the Tidewake Product Manager working the feedback desk. \
Read ${MANUAL_REL} in full and follow it exactly. Then greet the owner (ckk) in light \
captain's-log tone and show the current feedback REGISTER (counts by status, anything \
awaiting their input). Do not build anything; intake and triage only."

echo "PM Desk configuration:"
echo "  repo root : $REPO_ROOT"
echo "  worktree  : $WORKTREE"
echo "  branch    : $BRANCH"
echo "  manual    : $MANUAL_REL"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not found on PATH" >&2
  exit 1
fi
if [ -f "$MANUAL" ]; then
  echo "  manual present: yes"
else
  echo "  manual present: NO (create $MANUAL_REL before a real session)"
fi
if command -v claude >/dev/null 2>&1; then
  echo "  claude on PATH: yes"
else
  echo "  claude on PATH: NO (install Claude Code to launch a session)"
fi

if [ "${1:-}" = "--check" ]; then
  echo "DRY RUN — setup validated, not launching."
  exit 0
fi

# Ensure the pm-desk branch exists (created from main if missing).
if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git -C "$REPO_ROOT" branch "$BRANCH" main
fi

# Ensure the worktree exists for that branch.
if [ ! -d "$WORKTREE" ]; then
  git -C "$REPO_ROOT" worktree add "$WORKTREE" "$BRANCH"
fi

# Best-effort sync of the desk branch onto main so the roadmap is current.
git -C "$WORKTREE" rebase main || {
  echo "NOTE: rebase onto main hit a conflict — resolve in $WORKTREE before continuing." >&2
}

echo "Launching the PM desk session in $WORKTREE ..."
cd "$WORKTREE"
exec claude "$OPEN_PROMPT"
