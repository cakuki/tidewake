#!/usr/bin/env bash
# Tidewake owner channel — thin wrapper over the notify-telegram skill so every studio agent has
# ONE stable in-repo entrypoint for the two-way owner link (see studio/comms/OWNER-CHANNEL.md).
# It only locates the skill, adds a quiet-hours guard for the heartbeat, and forwards. The skill's
# scripts stay the generic, owner-locked renderers; this wrapper carries Tidewake's meaning.
#
# Usage:
#   owner-channel.sh report [notify.sh args...]   # send out (text / --photo / --video / --caption)
#   owner-channel.sh peek                          # print new owner messages WITHOUT consuming
#   owner-channel.sh inbox                          # print new owner messages AND mark them read
#   owner-channel.sh ask "Question?" "Opt A" "Opt B" [...]   # tappable decision, prints the label
#   owner-channel.sh quiet-now                      # exit 0 if inside quiet hours (01:00-07:00 local)
set -euo pipefail

SKILL_DIR="${TIDEWAKE_NOTIFY_SKILL:-$HOME/.claude/skills/notify-telegram/scripts}"
if [ ! -x "$SKILL_DIR/notify.sh" ]; then
  echo "owner-channel: notify-telegram skill not found at $SKILL_DIR" >&2
  echo "  set TIDEWAKE_NOTIFY_SKILL to its scripts/ dir, or install the skill." >&2
  exit 1
fi

# Quiet hours: no proactive messages 01:00-07:00 local (owner sleeping). Returns 0 when quiet.
in_quiet_hours() {
  local h; h=$(date +%H); h=${h#0}
  [ "${h:-0}" -ge 1 ] && [ "${h:-0}" -lt 7 ]
}

cmd="${1:-}"; shift || true
case "$cmd" in
  report)
    # Heartbeat/roadmap chatter is held during quiet hours; release reports about a *just-shipped*
    # build still go (the owner asked to be told of releases) — pass --force to skip the guard.
    force=0
    if [ "${1:-}" = "--force" ]; then force=1; shift; fi
    if [ "$force" -eq 0 ] && in_quiet_hours; then
      echo "owner-channel: quiet hours (01:00-07:00) — report suppressed; batch for 07:00." >&2
      exit 0
    fi
    exec "$SKILL_DIR/notify.sh" "$@"
    ;;
  peek)   exec "$SKILL_DIR/inbox.sh" --peek "$@" ;;
  inbox)  exec "$SKILL_DIR/inbox.sh" "$@" ;;
  ask)    exec "$SKILL_DIR/ask.sh" "$@" ;;
  quiet-now)
    if in_quiet_hours; then exit 0; else exit 1; fi
    ;;
  ""|-h|--help)
    sed -n '2,16p' "$0"
    ;;
  *)
    echo "owner-channel: unknown command '$cmd' (try: report | peek | inbox | ask | quiet-now)" >&2
    exit 2
    ;;
esac
