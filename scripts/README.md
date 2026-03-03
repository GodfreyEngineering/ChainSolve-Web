# Scripts

All scripts in this directory support the CI pipeline. `verify-ci.sh` is the
single gate that must pass before any commit.

## Primary scripts

| Script | Purpose | Usage |
|---|---|---|
| `verify-ci.sh` | **Full CI gate** — runs every check in sequence | `./scripts/verify-ci.sh` |
| `verify-fast.sh` | Quick pre-push check (no WASM build, no cargo tests) | `./scripts/verify-fast.sh` |

## CI check scripts (called by verify-ci.sh)

| Script | What it checks |
|---|---|
| `check-adapter-boundary.sh` | No Supabase client imports inside `src/components/` |
| `check-bundle-size.mjs` | Initial JS + WASM size budgets (gzip) |
| `check-bundle-splits.mjs` | Lazy-loaded components remain in separate chunks |
| `check-csp-allowlist.mjs` | Only approved external origins in CSP headers |
| `check-i18n-hardcoded.mjs` | No hardcoded UI strings bypassing i18n |
| `check-i18n-keys.mjs` | All locale files have matching i18n key sets |
| `check-perf-budget.mjs` | Structural budgets (lazy chunk count, WASM gzip ratio) |
| `check-robots-meta.mjs` | `<meta name="robots" content="noindex">` present in HTML |
| `check-wasm-exports.mjs` | Required WASM function exports exist in `.wasm` binary |

## Build helpers

| Script | Purpose | Usage |
|---|---|---|
| `optimize-wasm.mjs` | Run `wasm-opt -Oz` on WASM binaries | Called by `npm run wasm:build` |
| `generate-licenses.mjs` | Generate/check `THIRD_PARTY_NOTICES.md` | `--check` mode in CI |

## Pipeline order (verify-ci.sh)

1. prettier (format check)
2. eslint
3. adapter-boundary check
4. wasm-pack build (release)
5. tsc (typecheck)
6. vitest (unit tests)
7. cargo test (Rust tests)
8. vite build (production bundle)
9. wasm-opt (optimize dist WASM)
10. bundle size check
11. bundle splits audit
12. performance budget
13. robots meta guard
