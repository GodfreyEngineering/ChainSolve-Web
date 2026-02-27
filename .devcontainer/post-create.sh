#!/usr/bin/env bash
# Codespace / devcontainer post-create setup.
# Ensures wasm-pack + wasm target are available and deps are installed.
set -euo pipefail

echo "── Installing wasm32-unknown-unknown target ──"
rustup target add wasm32-unknown-unknown

echo "── Installing wasm-pack ──"
if ! command -v wasm-pack &>/dev/null; then
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi
echo "wasm-pack: $(wasm-pack --version)"

echo "── Installing Node dependencies ──"
npm ci

echo "── Building WASM (dev) ──"
npm run wasm:build:dev

echo "── Done! Run 'npm run dev' to start the dev server. ──"
echo "── Run 'npm run verify:fast' for quick checks. ──"
echo "── Run 'npm run verify:ci' for full CI-equivalent checks. ──"
