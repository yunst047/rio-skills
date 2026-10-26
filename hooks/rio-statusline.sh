#!/usr/bin/env bash
# rio — statusline badge. Prints the active mode if the flag file exists.
# Reads ~/.claude/.rio-active (or $CLAUDE_CONFIG_DIR/.rio-active).
set -euo pipefail

claude_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
flag="$claude_dir/.rio-active"

[ -f "$flag" ] || exit 0

mode="$(tr -d '[:space:]' < "$flag" 2>/dev/null || true)"
case "$mode" in
  lite)  label="MEMO" ;;
  full)  label="SEMINAR" ;;
  ultra) label="BIG-SISTER" ;;
  "")    exit 0 ;;
  *)     label="$(printf '%s' "$mode" | tr '[:lower:]' '[:upper:]')" ;;
esac

printf '[RIO:%s]' "$label"
