#!/usr/bin/env bash
# verify-ci.sh — Full CI-equivalent verification pipeline.
# Mirrors .github/workflows/ci.yml (rust_tests + node_checks jobs).
# Requires: rust toolchain, wasm-pack, node 20+.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}── $1 ──${NC}"; }

# ── Source cargo env if available (non-interactive shells may not have it) ──
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.cargo/env"
fi

# ── Pre-flight checks ─────────────────────────────────────────────────────
section "Pre-flight"

missing=0

if ! command -v cargo >/dev/null 2>&1; then
  echo -e "${RED}ERROR: cargo not found.${NC}"
  echo -e "  ${YELLOW}Install Rust:${NC}  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo -e "  ${YELLOW}Or in Codespaces:${NC} bash .devcontainer/post-create.sh"
  missing=1
fi

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo -e "${RED}ERROR: wasm-pack not found.${NC}"
  echo -e "  ${YELLOW}Install:${NC}  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
  echo -e "  ${YELLOW}Or in Codespaces:${NC} bash .devcontainer/post-create.sh"
  missing=1
fi

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}ERROR: node not found.${NC}"
  echo -e "  ${YELLOW}Install Node 20+:${NC}  https://nodejs.org"
  echo -e "  ${YELLOW}Or in Codespaces:${NC} the devcontainer image includes Node."
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}Missing required tools. Fix the above errors and retry.${NC}"
  echo -e "If you're in a GitHub Codespace, run: ${BOLD}bash .devcontainer/post-create.sh${NC}"
  exit 1
fi

echo "cargo: $(cargo --version)"
echo "wasm-pack: $(wasm-pack --version)"
echo "node: $(node --version)"

# ── Install deps ───────────────────────────────────────────────────────────
section "Install Node dependencies"
npm ci || fail "npm ci"
pass "npm ci"

# ── Format + lint (fast-fail before heavy steps) ──────────────────────────
section "Robots meta guard (source)"
node scripts/check-robots-meta.mjs || fail "robots meta guard"
pass "robots meta guard (source)"

section "npm audit (zero vulnerabilities)"
npm audit --audit-level=high || fail "npm audit"
pass "npm audit"

section "Prettier format check"
npm run format:check || fail "prettier"
pass "prettier"

section "ESLint"
npm run lint || fail "eslint"
pass "eslint"

section "Adapter boundary check"
bash scripts/check-adapter-boundary.sh || fail "adapter boundary"
pass "adapter boundary"

section "CSP third-party allowlist"
node scripts/check-csp-allowlist.mjs || fail "CSP allowlist"
pass "CSP allowlist"

section "i18n hardcoded-attribute check"
node scripts/check-i18n-hardcoded.mjs || fail "i18n hardcoded attributes"
pass "i18n hardcoded attributes"

section "i18n missing-key check"
node scripts/check-i18n-keys.mjs || fail "i18n missing keys"
pass "i18n missing keys"

section "Billing functions — no stack-trace exposure"
if grep -n 'err\.stack\|error\.stack' \
     functions/api/stripe/create-checkout-session.ts \
     functions/api/stripe/create-portal-session.ts 2>/dev/null | grep -v '^\s*//' ; then
  fail "Billing function exposes err.stack in response body"
fi
pass "No err.stack exposure in billing JSON functions"

# ── WASM build ─────────────────────────────────────────────────────────────
section "Build WASM (release)"
wasm-pack build crates/engine-wasm --target web --release || fail "wasm-pack build"
pass "wasm-pack build"

section "Optimize WASM pkg (wasm-opt -Oz)"
node scripts/optimize-wasm.mjs || fail "wasm-opt (pkg)"
pass "wasm-opt (pkg)"

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

# ── Optimize dist WASM ────────────────────────────────────────────────────
section "Optimize dist WASM (wasm-opt -Oz)"
node scripts/optimize-wasm.mjs || fail "wasm-opt (dist)"
pass "wasm-opt (dist)"

# ── Bundle size ────────────────────────────────────────────────────────────
section "Bundle size check"
node scripts/check-bundle-size.mjs || fail "bundle size"
pass "bundle size"

section "Bundle splits audit (lazy chunks)"
node scripts/check-bundle-splits.mjs || fail "bundle splits"
pass "bundle splits"

section "Robots meta guard (dist)"
node scripts/check-robots-meta.mjs || fail "robots meta guard (dist)"
pass "robots meta guard (dist)"

echo -e "\n${GREEN}${BOLD}All CI checks passed.${NC}"
