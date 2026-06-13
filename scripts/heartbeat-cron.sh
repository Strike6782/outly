#!/usr/bin/env bash
# Optional cron backup for the Healthchecks.io heartbeat.
# Use when the worker is not running but the API is (or as a second signal).
#
# Install (every 5 minutes):
#   crontab -e
#   */5 * * * * /home/user1/Documents/outly/scripts/heartbeat-cron.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"

# Load Healthchecks URL and API port from server/.env.
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      HEALTHCHECKS_PING_URL=*|PORT=*)
        line="${line%$'\r'}"
        export "$line"
        ;;
    esac
  done < "$ENV_FILE"
fi

PING_URL="${HEALTHCHECKS_PING_URL:-}"
PORT="${PORT:-8000}"

# Nothing to do when heartbeat is not configured.
if [ -z "$PING_URL" ]; then
  exit 0
fi

# Ping success when API + DB + Redis are healthy; otherwise signal failure.
if curl -fsS -m 10 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  curl -fsS -m 10 --retry 2 "$PING_URL" >/dev/null
else
  curl -fsS -m 10 --retry 2 "${PING_URL%/}/fail" >/dev/null || true
fi
