# Performance Overview

> W9.9 | Added 2026-02-26

Entry point for performance tooling and documentation.

---

## What's measured

| Layer | Tool | When |
|-------|------|------|
| Engine (Rust) | `cargo test` — `perf_smoke.rs` threshold tests | Every PR |
| Engine (Rust) | `cargo bench` — Criterion reports | Weekly (nightly) |
| Bundle size (JS/WASM) | `scripts/check-bundle-size.mjs` | Every PR |
| Browser eval timing | `e2e/perf-smoke.spec.ts` — Playwright | Weekly (nightly) |
| In-app timing | `src/perf/marks.ts` — User Timing API | Always (in browser) |

---

## Quick links

| Document | Contents |
|----------|---------|
| [baseline.md](./baseline.md) | Measured numbers before W9.9 |
| [budgets.md](./budgets.md) | All hard limits + rationale |
| [instrumentation.md](./instrumentation.md) | User Timing API naming, querying, ring buffer |
| [stress-tests.md](./stress-tests.md) | How to run both test layers |
| [memory.md](./memory.md) | Dataset disposal, worker lifecycle, leak detection |
| [runbook.md](./runbook.md) | Triage checklist for performance incidents |
| [ADR-0005](../DECISIONS/ADR-0005-worker-cancellation.md) | Worker cancellation decision record |

---

## Running everything locally

```bash
# 1. Full app build (needed for bundle check and Playwright)
npm run build

# 2. Bundle size check (PR-gated)
npm run perf:bundle

# 3. Rust threshold tests (PR-gated via cargo test --workspace)
npm run wasm:test

# 4. Playwright perf smoke (scheduled; run locally if needed)
npx playwright test --project=perf

# 5. Criterion benchmarks (local only, not CI-gated)
npm run perf:engine
```

---

## CI overview

```
On every PR / push to main:
  ci.yml → node_checks job:
    1. Typecheck
    2. Lint + Format
    3. Unit tests (vitest)
    4. Build (WASM + Vite)
    5. Bundle size check ← W9.9 addition (PR-gating)

  ci.yml → rust_tests job:
    cargo test --workspace  ← includes perf_smoke.rs threshold tests

Weekly (Monday 03:00 UTC):
  perf.yml → perf_ui job:
    Playwright perf smoke (engine boot, applyPatch timing)

  perf.yml → rust_bench job:
    cargo bench (Criterion, report-only, no gate)
```

---

## In-browser performance data

The canvas exposes real-time perf data in two ways:

### PerfHud (`?perf=1`)
Navigate to any canvas URL with `?perf=1` appended:
```
http://localhost:5173/canvas?perf=1
```
Shows a floating HUD with:
- `lastEvalMs`: last WASM eval duration
- `workerRoundTripMs`: total round-trip including serialization
- `nodesEvaluated / totalNodes`
- `isPartial`: true if eval was cut short by 300 ms budget
- Dataset count + bytes

### User Timing measures
```javascript
// Browser console — shows recent cs:eval:* measures
performance.getEntriesByType('measure')
  .filter(m => m.name.startsWith('cs:'))
  .map(m => ({ name: m.name, ms: m.duration.toFixed(2) }))
```

Note: `perfMeasure()` clears measures from the timeline after capture.
Use the ring buffer instead (see [instrumentation.md](./instrumentation.md)).

### Diagnostics export
Navigate to `/diagnostics` → **Export JSON** → look for `userTimingMeasures` array.
Contains the last 20 `cs:eval:*` measures captured since page load.
