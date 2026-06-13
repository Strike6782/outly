#!/usr/bin/env bash
# Start Outly dev servers (API, worker, frontend) in the background.
# Prerequisites: Docker running, migrations applied, GOOGLE_CLIENT_ID set.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_DIR="$HOME/.local/node-v22.14.0-linux-x64"
export PATH="$NODE_DIR/bin:$PATH"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

# Ensure PostgreSQL is reachable on the port from server/.env (default 5433).
pg_port="$(grep -E '^DATABASE_URL=' "$ROOT/server/.env" | sed -n 's/.*:\([0-9][0-9]*\)\/.*/\1/p')"
pg_port="${pg_port:-5433}"
if ! (command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p "$pg_port" >/dev/null 2>&1) \
  && ! ([ -x "$HOME/.local/pgsql/bin/pg_isready" ] && "$HOME/.local/pgsql/bin/pg_isready" -h 127.0.0.1 -p "$pg_port" >/dev/null 2>&1); then
  if [ -x "$HOME/.local/pgsql/bin/pg_ctl" ]; then
    echo "Starting local PostgreSQL on port $pg_port..."
    "$HOME/.local/pgsql/bin/pg_ctl" -D "$HOME/.local/pgsql/data" -l "$HOME/.local/pgsql/logs/postgres.log" -o "-p $pg_port" start || true
    sleep 2
  fi
fi
if ! ([ -x "$HOME/.local/pgsql/bin/pg_isready" ] && "$HOME/.local/pgsql/bin/pg_isready" -h 127.0.0.1 -p "$pg_port" >/dev/null 2>&1) \
  && ! pg_isready -h 127.0.0.1 -p "$pg_port" >/dev/null 2>&1; then
  echo "PostgreSQL is not running on port $pg_port."
  echo "Start Docker: cd $ROOT/server && docker compose up -d"
  echo "Or local PG:  $HOME/.local/pgsql/bin/pg_ctl -D $HOME/.local/pgsql/data -l $HOME/.local/pgsql/logs/postgres.log -o \"-p $pg_port\" start"
  exit 1
fi

# Ensure Redis is running for the email worker queue.
if ! redis-cli -p 6379 ping >/dev/null 2>&1; then
  mkdir -p "$HOME/.local/redis/data"
  redis-server --daemonize yes --port 6379 --dir "$HOME/.local/redis/data" --logfile "$HOME/.local/redis/redis.log" || true
  sleep 1
fi
if ! redis-cli -p 6379 ping >/dev/null 2>&1; then
  echo "Redis is not running on port 6379."
  exit 1
fi

start_proc() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  if [ -f "$LOG_DIR/$name.pid" ] && kill -0 "$(cat "$LOG_DIR/$name.pid")" 2>/dev/null; then
    echo "$name already running (pid $(cat "$LOG_DIR/$name.pid"))"
    return
  fi
  echo "Starting $name..."
  (
    cd "$dir"
    export PATH="$NODE_DIR/bin:/usr/bin:/bin:$PATH"
    nohup bash -c "$cmd" >"$LOG_DIR/$name.log" 2>&1 &
    echo $! >"$LOG_DIR/$name.pid"
  )
  echo "$name started (pid $(cat "$LOG_DIR/$name.pid"), log: $LOG_DIR/$name.log)"
}

start_proc api "$ROOT/server" "npm run dev"
start_proc worker "$ROOT/server" "npm run worker"
start_proc client "$ROOT/client" "npm run dev"

echo ""
echo "Outly is starting up."
echo "  Frontend: http://localhost:3100"
echo "  API:      http://localhost:8000"
echo "  Logs:     $LOG_DIR/"
echo ""
echo "Stop all: bash $ROOT/scripts/stop-dev.sh"
