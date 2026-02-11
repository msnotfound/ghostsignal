#!/usr/bin/env bash
# ============================================================================
# GhostSignal — One-Shot Setup
#
# Installs dependencies, compiles the Compact contract, and starts the
# frontend dev server.  Run from the project root:
#
#   chmod +x scripts/setup.sh && ./scripts/setup.sh
# ============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           👻  GhostSignal — Setup Script  👻          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# ---------- 1. Dependencies ------------------------------------------------
echo "📦  Installing npm dependencies …"
npm install
echo "   ✅ Dependencies installed."
echo ""

# ---------- 2. Contract compilation ----------------------------------------
echo "🔧  Compiling Compact contract …"
cd "$ROOT/contract"

if ! npm run compact 2>&1; then
  echo ""
  echo "⚠️  Compact compiler not found or compilation failed."
  echo "   Make sure 'compactc' is on your PATH."
  echo "   See: https://docs.midnight.network/develop/tutorial/building"
  echo ""
  echo "   Continuing without compilation — you can retry later with:"
  echo "     cd contract && npm run compact"
  echo ""
else
  echo "   ✅ Contract compiled."
fi

# ---------- 3. Contract build (copy managed/ + .compact to dist/) ----------
echo "📁  Building contract package …"
npm run build || echo "   ⚠️  Contract build skipped (compile first)."
cd "$ROOT"
echo ""

# ---------- 4. Python agent (optional) -------------------------------------
if command -v python3 &>/dev/null; then
  echo "🐍  Setting up Python agent …"
  cd "$ROOT/agent"
  python3 -m venv .venv 2>/dev/null || true
  source .venv/bin/activate 2>/dev/null || true
  pip install -q -r requirements.txt 2>/dev/null || true
  cd "$ROOT"
  echo "   ✅ Python agent ready."
  echo ""
fi

# ---------- 5. Frontend dev server -----------------------------------------
echo "🚀  Starting frontend dev server …"
echo "   URL: http://localhost:5173"
echo ""
cd "$ROOT/frontend"
npx vite --open
