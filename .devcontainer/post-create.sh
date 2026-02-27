#!/usr/bin/env bash
# Codespace / devcontainer post-create setup.
# Ensures Rust, wasm-pack, wasm32 target, and Node deps are available.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${BOLD}── $1 ──${NC}"; }
ok()   { echo -e "${GREEN}OK${NC} $1"; }

# ── Ensure cargo is on PATH ──────────────────────────────────────────────────
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.cargo/env"
fi

# ── Rust toolchain ───────────────────────────────────────────────────────────
step "Rust toolchain"
if command -v rustup &>/dev/null; then
  ok "rustup found"
  # Ensure rust-toolchain.toml targets are installed
  rustup target add wasm32-unknown-unknown 2>/dev/null || true
  ok "wasm32-unknown-unknown target installed"
else
  echo "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --target wasm32-unknown-unknown
  . "$HOME/.cargo/env"
  ok "Rust installed: $(rustc --version)"
fi
echo "  cargo: $(cargo --version)"
echo "  rustc: $(rustc --version)"

# ── wasm-pack ────────────────────────────────────────────────────────────────
step "wasm-pack"
if command -v wasm-pack &>/dev/null; then
  ok "$(wasm-pack --version)"
else
  echo "Installing wasm-pack..."
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
  ok "$(wasm-pack --version)"
fi

# ── Ensure PATH persists for non-interactive shells ──────────────────────────
step "PATH persistence"
CARGO_ENV_LINE='. "$HOME/.cargo/env"'
for rc in "$HOME/.bashrc" "$HOME/.profile"; do
  if [ -f "$rc" ] && ! grep -qF '.cargo/env' "$rc" 2>/dev/null; then
    echo "$CARGO_ENV_LINE" >> "$rc"
    ok "Added cargo env to $rc"
  fi
done

# ── Node dependencies ───────────────────────────────────────────────────────
step "Node dependencies"
npm ci
ok "npm ci"

# ── WASM dev build ───────────────────────────────────────────────────────────
step "WASM dev build"
npm run wasm:build:dev
ok "wasm-pack build (dev)"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Devcontainer ready!${NC}"
echo ""
echo "  npm run dev          Start the dev server (http://localhost:5173)"
echo "  npm run verify:fast  Quick checks (no Rust required)"
echo "  npm run verify:ci    Full CI-equivalent checks"
echo ""
