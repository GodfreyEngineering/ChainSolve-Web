# W9.4 — Performance Lab: Benchmarks + Budgets

## Performance Budgets

| Scenario | Budget | Measured (approx) |
|---|---|---|
| Full eval, 100-node chain | < 2 ms | ~0.1 ms |
| Full eval, 1k-node chain | < 20 ms | ~1.4 ms |
| Full eval, 10k-node chain | < 200 ms | ~17 ms |
| Incremental 1-input change, 1k chain | < 10 ms | ~1.4 ms |
| vectorSum on 1M-element dataset | < 50 ms | ~12 ms |
| Worker round-trip overhead | < 5 ms | (varies) |

Budgets are generous (10x measured) to avoid flaky failures across hardware.
The perf smoke tests in `crates/engine-core/tests/perf_smoke.rs` use even more
generous thresholds (500ms / 200ms) to catch catastrophic regressions only.

## Running Benchmarks

```bash
# Criterion benchmarks (detailed HTML reports in target/criterion/)
cargo bench --package engine-core

# npm alias
npm run bench:rust
```

Criterion generates HTML reports at `target/criterion/report/index.html`.

## Perf HUD

Add `?perf=1` to any canvas URL to activate the dev-only performance overlay:

```
/canvas?perf=1
/canvas/abc123?perf=1
```

The overlay shows:
- **eval** — WASM engine evaluation time (from `elapsedUs`)
- **rtrip** — total worker round-trip time (includes serialization + postMessage)
- **nodes** — evaluated / total node count, with `(partial)` flag if time-budgeted
- **dsets** — registered dataset count and total memory

The PerfHud component is lazy-loaded — zero bundle cost when `?perf=1` is not set.
It uses `pointerEvents: 'none'` so it never intercepts clicks.

## Dataset Hygiene

The engine tracks registered datasets via `EngineGraph::dataset_count()` and
`EngineGraph::dataset_total_bytes()`. These are exposed through:

- WASM: `dataset_count()`, `dataset_total_bytes()`
- Worker protocol: `getStats` request → `stats` response
- EngineAPI: `engine.getStats()` → `Promise<EngineStats>`

The Perf HUD automatically queries these after each evaluation cycle.

## Architecture

```
┌─────────────┐   ?perf=1    ┌───────────┐
│ CanvasPage  │──lazy-load──▶│  PerfHud  │
└─────────────┘              └─────┬─────┘
                                   │ useSyncExternalStore
                             ┌─────▼──────┐
                             │ perfMetrics │ (subscribe/getSnapshot)
                             └─────▲──────┘
                                   │ updatePerfMetrics()
                          ┌────────┴─────────┐
                          │ useGraphEngine.ts │
                          │ (timing wrapper)  │
                          └────────┬─────────┘
                                   │ engine.loadSnapshot / applyPatch
                          ┌────────▼─────────┐
                          │   Worker thread   │
                          │   (WASM engine)   │
                          └──────────────────┘
```

## Files

| File | Purpose |
|---|---|
| `crates/engine-core/benches/engine_benchmarks.rs` | Criterion benchmarks |
| `crates/engine-core/tests/perf_smoke.rs` | Perf regression guards |
| `crates/engine-core/src/graph.rs` | `dataset_count()`, `dataset_total_bytes()` |
| `crates/engine-wasm/src/lib.rs` | WASM exports for introspection |
| `src/engine/perfMetrics.ts` | Subscribe/getSnapshot metrics store |
| `src/engine/useGraphEngine.ts` | Timing instrumentation |
| `src/lib/devFlags.ts` | `isPerfHudEnabled()` — `?perf=1` detection |
| `src/components/PerfHud.tsx` | Dev overlay component |
| `src/pages/CanvasPage.tsx` | Lazy PerfHud wiring |
