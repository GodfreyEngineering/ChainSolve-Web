# Performance Budgets

> W9.9 | Established 2026-02-26

Hard limits used by CI and local checks. Exceeding any of these causes a
build/test failure. Budgets are intentionally conservative — enough headroom
to absorb normal growth but tight enough to catch accidents.

---

## Bundle size budgets (uncompressed)

Checked by `npm run perf:bundle` (`scripts/check-bundle-size.mjs`).
Run after `npm run build`. PR-gated in CI (`ci.yml`).

| File pattern | Budget | Baseline | Headroom |
|-------------|--------|---------|---------|
| `main-*.js` | 900 KB | ~796 KB | +13% |
| Total JS (`*.js` sum) | 1 600 KB | ~1 537 KB | +4% |
| `*.wasm` (each) | 600 KB | ~493 KB | +22% |

**Notes:**
- Cloudflare Pages serves Brotli; on-wire sizes are ~40–60% smaller than the
  uncompressed numbers above.
- `vega.module-*.js` (~484 KB) is lazy-loaded; it counts toward total JS.
- Budgets are uncompressed on disk — that is what the script measures.

---

## Engine evaluation budgets (Rust, `cargo test`)

Checked by `crates/engine-core/tests/perf_smoke.rs`. Run as part of
`npm run wasm:test` (and CI `cargo test --workspace`). PR-gated.

| Scenario | Node count | Budget | Rationale |
|----------|-----------|--------|-----------|
| Full eval — chain | 1 000 | 500 ms | Existing baseline |
| Incremental — value changed | 1 000 | 200 ms | Existing baseline |
| Full eval — chain | 10 000 | 8 000 ms | Codespace-safe upper bound |
| Fan-out full eval | 1 000 | 500 ms | Wide dirty-set propagation |
| Incremental — value **unchanged** | 1 000 | 50 ms | Pruning sanity check |
| Dataset (1M f64) + vectorSum | 1 000 000 | 2 000 ms | Large dataset boundary |

Budgets are 10–50× the observed baseline (see [baseline.md](./baseline.md)) to
avoid flakiness on slow CI hardware while still catching catastrophic
regressions.

---

## Interactive eval time budget

Applied by `src/engine/useGraphEngine.ts` via `timeBudgetMs` on all
`applyPatch` calls.

| Metric | Budget | Mechanism |
|--------|--------|-----------|
| Interactive eval (patch) | **300 ms** | `EvalOptions.timeBudgetMs` → `partial: true` |
| Worker watchdog hard-kill | **5 000 ms** | `setTimeout` → `worker.terminate()` + recreate |

When the 300 ms budget is hit, the engine returns `partial: true` and the UI
merges the partial result. The worker stays responsive for the next request.

The 5 s watchdog handles the catastrophic case (WASM hang, infinite loop)
by terminating and recreating the worker, then reloading the last snapshot.

---

## Playwright perf smoke (browser, scheduled)

Checked by `e2e/perf-smoke.spec.ts` in the `perf` playwright project.
**Scheduled only** (Monday 03:00 UTC via `.github/workflows/perf.yml`).
Not PR-gated — these are nightly health checks, not gates.

| Metric | Budget | Notes |
|--------|--------|-------|
| `cs:eval:patch` p50 | 500 ms | 2 000-node graph injected via `window.__cs_engine` |
| `cs:eval:patch` p95 | 1 000 ms | Same graph |
| Engine boot (`cs:engine:boot`) | 10 000 ms | Worker creation → `ready` message |

---

## Rationale for each budget

### 900 KB main-*.js
React (45 KB) + React Router (15 KB) + @xyflow/react (496 KB) + app logic
already add up to ~796 KB. +13% headroom absorbs ~100 KB of new features
before requiring deliberate optimization.

### 1 600 KB total JS
Sum of all chunks including lazy Vega (~484 KB). Tight headroom (+4%) keeps
pressure on avoiding new large dependencies.

### 300 ms interactive eval time budget
At 300 ms the UI can display a progress indicator without the canvas feeling
unresponsive. Faster than the typical JavaScript 16 ms frame budget, but WASM
evaluation is synchronous — we can't interrupt mid-node.

### 5 s watchdog
5× the interactive budget. Generous enough not to fire on slow hardware
during legitimate large evaluations; tight enough to recover from a genuine
WASM hang within a few seconds.

### 50 ms unchanged incremental
An unchanged input should not re-evaluate downstream nodes. If this takes
> 50 ms, the dirty-set pruning is broken.

---

## Updating budgets

1. Run `npm run build && npm run perf:bundle` locally to see current sizes.
2. If a legitimate feature pushes a file over budget, raise the budget with
   explicit justification in this file (PR comment explaining the increase).
3. Do not raise budgets silently — every increase should be reviewed.
