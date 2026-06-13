#!/usr/bin/env bash
# Local development setup for Outly on Linux (Kali/Debian).
# Run from the repo root: bash scripts/setup-linux.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_DIR="$HOME/.local/node-v22.14.0-linux-x64"
export PATH="$NODE_DIR/bin:$PATH"

echo "==> Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 22 to $NODE_DIR first, or add node to PATH."
  exit 1
fi
node -v
npm -v

echo "==> Starting PostgreSQL and Redis (Docker)..."
cd "$ROOT/server"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Run:"
  echo "  sudo apt update && sudo apt install -y docker.io docker-compose"
  echo "  sudo usermod -aG docker $USER"
  echo "Then log out/in and re-run this script."
  exit 1
fi

docker compose up -d
echo "Waiting for database..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Installing server dependencies..."
npm install

echo "==> Running database migrations..."
npx prisma migrate deploy
npm run prisma:seed

echo "==> Installing client dependencies..."
cd "$ROOT/client"
npm install

echo ""
echo "Setup complete."
echo ""
echo "Before starting the app, set GOOGLE_CLIENT_ID in:"
echo "  - server/.env"
echo "  - client/.env  (NEXT_PUBLIC_GOOGLE_CLIENT_ID)"
echo ""
echo "Create a Google OAuth Web client at:"
echo "  https://console.cloud.google.com/apis/credentials"
echo "Authorized JavaScript origins: http://localhost:3100"
echo ""
echo "Start the app (3 terminals):"
echo "  export PATH=\"$NODE_DIR/bin:\$PATH\""
echo "  cd $ROOT/server && npm run dev"
echo "  cd $ROOT/server && npm run worker"
echo "  cd $ROOT/client && npm run dev"
echo ""
echo "Open http://localhost:3100"
