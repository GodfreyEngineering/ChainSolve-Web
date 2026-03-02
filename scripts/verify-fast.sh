#!/usr/bin/env bash
# verify-fast.sh — Quick local checks (no wasm-pack / cargo required).
# Use for pre-push sanity. For the full CI-equivalent, run verify-ci.sh.
#
# This is a SUBSET of verify-ci.sh. It skips: WASM build, cargo test,
# vite build, bundle checks, adapter boundary, CSP allowlist, i18n checks,
# and performance budget. The authoritative gate is verify-ci.sh.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}── $1 ──${NC}"; }

section "Lockfile sync check"
node -e "
  const pkg = require('./package.json');
  const lock = require('./package-lock.json');
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const lockPkgs = lock.packages?.['']?.dependencies ?? {};
  const lockDev  = lock.packages?.['']?.devDependencies ?? {};
  const lockAll  = { ...lockPkgs, ...lockDev };
  const missing = Object.keys(all).filter(k => !lockAll[k] && !lock.packages?.['node_modules/' + k]);
  if (missing.length) {
    console.error('Lockfile out of sync! Missing: ' + missing.join(', '));
    console.error('Run: npm install --package-lock-only');
    process.exit(1);
  }
" || fail "lockfile sync"
pass "lockfile sync"

section "Robots meta guard (source)"
node scripts/check-robots-meta.mjs || fail "robots meta guard"
pass "robots meta guard"

section "npm audit (zero vulnerabilities)"
npm audit --audit-level=high || fail "npm audit"
pass "npm audit"

section "Prettier format check"
npm run format:check || fail "prettier"
pass "prettier"

section "ESLint"
npm run lint || fail "eslint"
pass "eslint"

section "WASM export guard"
node scripts/check-wasm-exports.mjs || fail "WASM export check"
pass "WASM exports"

section "TypeScript typecheck (app)"
npx tsc -b --noEmit || fail "tsc (app)"
pass "tsc (app)"

section "TypeScript typecheck (functions)"
npm run typecheck:functions || fail "tsc (functions)"
pass "tsc (functions)"

section "Unit tests (vitest)"
npm run test:unit || fail "vitest"
pass "vitest"

echo -e "\n${GREEN}${BOLD}All fast checks passed.${NC}"
echo "For full CI-equivalent checks (WASM build + cargo test), run: npm run verify:ci"
