#!/usr/bin/env bash
# scripts/setup.sh — One-command ChainSolve development setup.
#
# Usage:
#   bash scripts/setup.sh
#
# What this does:
#   1. Checks Node.js ≥ 20
#   2. Installs rustup + cargo if missing
#   3. Installs wasm-pack if missing
#   4. Runs npm ci
#   5. Builds the WASM engine in dev mode
#   6. Copies .env.example → .env (if .env doesn't exist)
#   7. Reports next steps
#
# The script prints [OK] / [SKIP] / [ERROR] for each step.
# It exits non-zero on the first unrecoverable error.

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────

RESET='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'

ok()   { echo -e " ${GREEN}[OK]${RESET}   $*"; }
skip() { echo -e " ${YELLOW}[SKIP]${RESET} $*"; }
info() { echo -e " ${BOLD}···${RESET}    $*"; }
fail() { echo -e " ${RED}[ERROR]${RESET} $*" >&2; exit 1; }

echo ""
echo -e "${BOLD}ChainSolve Web — Dev Setup${RESET}"
echo "────────────────────────────────────────"
echo ""

# ── 1. Node.js version check ──────────────────────────────────────────────────

info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install Node.js ≥ 20 from https://nodejs.org"
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  fail "Node.js $NODE_VERSION found but ≥ 20 required. Upgrade at https://nodejs.org"
fi
ok "Node.js $(node --version)"

# ── 2. npm check ──────────────────────────────────────────────────────────────

if ! command -v npm &>/dev/null; then
  fail "npm not found. It should be bundled with Node.js."
fi
ok "npm $(npm --version)"

# ── 3. Rust / cargo ───────────────────────────────────────────────────────────

info "Checking Rust toolchain..."
if ! command -v cargo &>/dev/null; then
  info "cargo not found — installing rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  # Source cargo env for this session
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env" 2>/dev/null || true
  if ! command -v cargo &>/dev/null; then
    fail "cargo install failed. Add ~/.cargo/bin to your PATH and re-run."
  fi
  ok "Rust installed ($(cargo --version))"
else
  ok "$(cargo --version)"
fi

# ── 4. wasm-pack ──────────────────────────────────────────────────────────────

info "Checking wasm-pack..."
if ! command -v wasm-pack &>/dev/null; then
  info "wasm-pack not found — installing..."
  cargo install wasm-pack --locked 2>&1 | tail -3
  ok "wasm-pack installed"
else
  ok "$(wasm-pack --version)"
fi

# ── 5. npm ci ─────────────────────────────────────────────────────────────────

info "Installing npm dependencies..."
npm ci --prefer-offline 2>&1 | tail -3
ok "npm dependencies installed"

# ── 6. WASM build (dev mode) ──────────────────────────────────────────────────

info "Building WASM engine (dev mode — this may take 1–3 minutes)..."
npm run wasm:build:dev
ok "WASM engine built"

# ── 7. .env setup ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info "Checking .env..."
if [ -f "$ROOT/.env" ]; then
  skip ".env already exists (not overwritten)"
else
  cp "$ROOT/.env.example" "$ROOT/.env"
  ok ".env created from .env.example — edit it with your Supabase credentials"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Setup complete.${RESET}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Supabase project URL and anon key"
echo "  2. npm run dev"
echo "  3. Open http://localhost:5173"
echo ""
echo "Tip: run 'npm run doctor' at any time to verify your setup."
echo ""
