#!/usr/bin/env bash
# ============================================================================
# GhostSignal — Start Local DevNet
#
# Checks for Docker & starts the Midnight local network containers
# (proof-server, indexer, node) at the static ports expected by GhostSignal.
#
#   Proof Server:  http://localhost:6300
#   Indexer:       http://localhost:8088  /  ws://localhost:8088
#   Node:          ws://localhost:9944
#
# Usage:
#   chmod +x scripts/start-devnet.sh && ./scripts/start-devnet.sh
# ============================================================================

set -euo pipefail

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║      👻  GhostSignal — Local DevNet Launcher  👻      ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# ---------- Prerequisites ---------------------------------------------------
if ! command -v docker &>/dev/null; then
  echo "❌  Docker not found. Please install Docker Desktop / Docker Engine."
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo "❌  Docker daemon is not running. Start Docker and try again."
  exit 1
fi

# ---------- Locate compose file ---------------------------------------------
# Try local midnight-local-network repo first, then fall back to parent workspace
COMPOSE=""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

for candidate in \
  "$ROOT/../../../midnight-local-network/compose.yml" \
  "$ROOT/../../midnight-local-network/compose.yml" \
  "$ROOT/../midnight-local-network/compose.yml" \
  "$HOME/midnight-local-network/compose.yml"; do
  if [[ -f "$candidate" ]]; then
    COMPOSE="$(realpath "$candidate")"
    break
  fi
done

if [[ -z "$COMPOSE" ]]; then
  echo "⚠️  Could not find midnight-local-network/compose.yml"
  echo ""
  echo "   Clone the local network repo:"
  echo "     git clone https://github.com/midnight-ntwrk/midnight-local-network.git"
  echo ""
  echo "   Or start containers manually with the right ports:"
  echo "     Proof Server → :6300"
  echo "     Indexer      → :8088"
  echo "     Node         → :9944"
  exit 1
fi

COMPOSE_DIR="$(dirname "$COMPOSE")"
echo "📂  Using compose file: $COMPOSE"
echo ""

# ---------- Start containers ------------------------------------------------
echo "🐳  Starting Midnight local network …"
cd "$COMPOSE_DIR"
docker compose up -d

echo ""
echo "⏳  Waiting for services to be ready …"

wait_for() {
  local name="$1" url="$2" max_tries=30 i=0
  while ! curl -sf "$url" >/dev/null 2>&1; do
    sleep 2
    i=$((i + 1))
    if (( i >= max_tries )); then
      echo "   ⚠️  $name did not start within 60 s"
      return 1
    fi
  done
  echo "   ✅ $name is up ($url)"
}

wait_for "Node"         "http://localhost:9944" || true
wait_for "Indexer"      "http://localhost:8088"  || true
wait_for "Proof Server" "http://localhost:6300"  || true

echo ""
echo "🟢  DevNet is running!"
echo ""
echo "   Node:          ws://localhost:9944"
echo "   Indexer:       http://localhost:8088"
echo "   Proof Server:  http://localhost:6300"
echo ""
echo "   Stop with:  cd $(dirname "$COMPOSE") && docker compose down"
echo ""
