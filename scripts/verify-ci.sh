#!/usr/bin/env bash
# verify-ci.sh — Full CI-equivalent verification pipeline.
# Mirrors .github/workflows/ci.yml (rust_tests + node_checks jobs).
# Requires: rust toolchain, wasm-pack, node 20+.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}── $1 ──${NC}"; }

# ── Pre-flight checks ─────────────────────────────────────────────────────
section "Pre-flight"
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}ERROR: cargo not found. Install Rust: https://rustup.rs${NC}"; exit 1; }
command -v wasm-pack >/dev/null 2>&1 || { echo -e "${RED}ERROR: wasm-pack not found. Install: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}ERROR: node not found. Install Node 20+: https://nodejs.org${NC}"; exit 1; }
echo "cargo: $(cargo --version)"
echo "wasm-pack: $(wasm-pack --version)"
echo "node: $(node --version)"

# ── Install deps ───────────────────────────────────────────────────────────
section "Install Node dependencies"
npm ci || fail "npm ci"
pass "npm ci"

# ── WASM build ─────────────────────────────────────────────────────────────
section "Build WASM (release)"
wasm-pack build crates/engine-wasm --target web --release || fail "wasm-pack build"
pass "wasm-pack build"

# ── WASM export guard ─────────────────────────────────────────────────────
section "WASM export guard"
node scripts/check-wasm-exports.mjs || fail "WASM export check"
pass "WASM exports"

# ── TypeScript typecheck ───────────────────────────────────────────────────
section "TypeScript typecheck (app)"
npx tsc -b --noEmit || fail "tsc (app)"
pass "tsc (app)"

section "TypeScript typecheck (functions)"
npm run typecheck:functions || fail "tsc (functions)"
pass "tsc (functions)"

# ── Lint + format ──────────────────────────────────────────────────────────
section "ESLint"
npm run lint || fail "eslint"
pass "eslint"

section "Prettier format check"
npm run format:check || fail "prettier"
pass "prettier"

# ── Unit tests ─────────────────────────────────────────────────────────────
section "Unit tests (vitest)"
npm run test:unit || fail "vitest"
pass "vitest"

# ── Rust tests ─────────────────────────────────────────────────────────────
section "Rust tests"
cargo test --workspace || fail "cargo test"
pass "cargo test"

# ── Vite build ─────────────────────────────────────────────────────────────
section "Vite build (placeholder creds)"
VITE_SUPABASE_URL=https://placeholder.supabase.co \
VITE_SUPABASE_ANON_KEY=placeholder \
VITE_IS_CI_BUILD=true \
npx tsc -b && npx vite build || fail "vite build"
pass "vite build"

# ── Bundle size ────────────────────────────────────────────────────────────
section "Bundle size check"
node scripts/check-bundle-size.mjs || fail "bundle size"
pass "bundle size"

echo -e "\n${GREEN}${BOLD}All CI checks passed.${NC}"
