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
#   owner-channel.sh photo [--latest|--id <file_id>] [--out <path>]   # fetch an owner-sent photo
#                                                  #   to a local file and PRINT its path (so a cycle
#                                                  #   can SEE a visual bug report). --latest is peek-
#                                                  #   semantic (non-consuming) and finds the newest
#                                                  #   unread owner photo. Exit 3 = no photo found.
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
  photo)
    # Fetch an owner-sent photo to a local file and PRINT its path, so any cycle can SEE what the
    # owner sent (e.g. a visual bug report — view the FULL frame before dispatching a fix). The bot
    # token is read from the skill config and never echoed/placed in argv (curl -K - from stdin).
    # --latest (default) is non-consuming (peek semantics): it finds the newest UNREAD owner photo
    # without advancing the inbox cursor, so a later `inbox` still delivers the message. --id fetches
    # a specific file_id. Stays owner-locked in spirit: only photos from the configured owner+chat.
    # shellcheck disable=SC1091
    . "$SKILL_DIR/lib.sh"
    mode="latest" file_id="" out=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --latest) mode="latest"; shift ;;
        --id)     file_id="${2:-}"; mode="id"; shift 2 ;;
        --out)    out="${2:-}"; shift 2 ;;
        -h|--help)
          echo "usage: owner-channel.sh photo [--latest|--id <file_id>] [--out <path>]"
          echo "  --latest        newest UNREAD owner photo (default; non-consuming peek)"
          echo "  --id <file_id>  a specific Telegram file_id"
          echo "  --out <path>    where to save (default: \$TMPDIR/owner-photo-<ts>.<ext>)"
          echo "  prints the saved file path on success; exit 3 if no photo is found."
          exit 0 ;;
        *) echo "owner-channel photo: unknown option '$1'" >&2; exit 2 ;;
      esac
    done

    load_config

    if [ "$mode" = "latest" ]; then
      # Peek getUpdates from the current read cursor (offset=last+1, like inbox.sh --peek) and take
      # the most recent owner photo's largest-resolution file_id. Non-consuming: no cursor advance.
      OFFSET_FILE="$CONFIG_DIR/last_update_id"
      last=0; [ -f "$OFFSET_FILE" ] && last="$(cat "$OFFSET_FILE" 2>/dev/null || echo 0)"
      resp="$(tg_call getUpdates "offset=$((last + 1))" "timeout=0" 'allowed_updates=["message"]')" \
        || { echo "owner-channel photo: getUpdates failed (another reader polling?)." >&2; exit 1; }
      file_id="$(printf '%s' "$resp" | MY_USER="$TELEGRAM_USER_ID" MY_CHAT="$TELEGRAM_CHAT_ID" python3 -c '
import sys, json, os
u = str(os.environ.get("MY_USER") or ""); c = str(os.environ.get("MY_CHAT") or "")
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
fid = ""
for up in d.get("result", []):
    m = up.get("message") or up.get("edited_message") or {}
    if not m:
        continue
    if u and str((m.get("from") or {}).get("id", "")) != u:
        continue
    if c and str((m.get("chat") or {}).get("id", "")) != c:
        continue
    ph = m.get("photo") or []
    if isinstance(ph, list) and ph:
        fid = ph[-1].get("file_id", "")   # largest resolution; keep the LAST (newest) photo
print(fid)
' 2>/dev/null || true)"
      if [ -z "$file_id" ]; then
        echo "owner-channel photo: no owner photo found (none unread). Ask the owner to (re)send it, or pass --id <file_id>." >&2
        exit 3
      fi
    fi

    [ -n "$file_id" ] || { echo "owner-channel photo: --id requires a file_id" >&2; exit 2; }

    finfo="$(tg_call getFile "file_id=$file_id")" \
      || { echo "owner-channel photo: getFile failed for $file_id" >&2; exit 1; }
    fpath="$(printf '%s' "$finfo" | python3 -c 'import sys,json; print((json.load(sys.stdin).get("result") or {}).get("file_path",""))' 2>/dev/null || true)"
    [ -n "$fpath" ] || { echo "owner-channel photo: could not resolve file_path (bad/expired file_id)" >&2; exit 1; }

    if [ -z "$out" ]; then
      ext="${fpath##*.}"; [ "$ext" = "$fpath" ] && ext="jpg"
      tmpbase="${TMPDIR:-/tmp}"; tmpbase="${tmpbase%/}"
      out="$tmpbase/owner-photo-$(date +%Y%m%d%H%M%S).$ext"
    fi

    # Download the file. Token stays out of argv via the -K - stdin curl config.
    if printf 'url = "%s/file/bot%s/%s"\n' "$API" "$TELEGRAM_BOT_TOKEN" "$fpath" \
        | curl --silent --show-error --max-time 120 -K - -o "$out"; then
      echo "$out"
    else
      echo "owner-channel photo: download failed" >&2; exit 1
    fi
    ;;
  quiet-now)
    if in_quiet_hours; then exit 0; else exit 1; fi
    ;;
  ""|-h|--help)
    sed -n '2,20p' "$0"
    ;;
  *)
    echo "owner-channel: unknown command '$cmd' (try: report | peek | inbox | ask | photo | quiet-now)" >&2
    exit 2
    ;;
esac
