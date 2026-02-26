# Stress Tests

> W9.9 | Added 2026-02-26

Reference for the two stress test layers: Rust engine tests and the
TypeScript graph generator used by Playwright perf smoke.

---

## Rust perf smoke tests (`crates/engine-core/tests/perf_smoke.rs`)

### Running locally

```bash
# Run all tests including perf_smoke (fast — native Rust, no WASM)
npm run wasm:test

# Run only perf_smoke tests
cargo test --package engine-core perf_smoke -- --nocapture
```

`--nocapture` shows timing output in the assertion messages on failure.

### Running in CI

Automatically run by `ci.yml` in the `rust_checks` job:
```yaml
- run: cargo test --workspace
```

Perf smoke tests are included here. A failure blocks the PR.

### Test matrix

| Test name | Shape | N | Budget | What it exercises |
|-----------|-------|---|--------|-------------------|
| `perf_smoke_1k_chain_under_500ms` | chain | 1 000 | 500 ms | Full eval baseline |
| `perf_smoke_incremental_1k_under_200ms` | chain | 1 000 | 200 ms | Dirty-set incremental |
| `perf_smoke_10k_chain_under_8000ms` | chain | 10 000 | 8 000 ms | Large graph full eval |
| `perf_smoke_fanout_1k_under_500ms` | fan-out | 1 000 | 500 ms | Wide dirty propagation |
| `perf_smoke_incremental_unchanged_under_50ms` | chain | 1 000 | 50 ms | Unchanged-value pruning |
| `perf_smoke_dataset_1m_under_2000ms` | 1M dataset | 1M f64 | 2 000 ms | Dataset + vectorSum |

### Adding a new test

1. Add a helper function in `perf_smoke.rs` to construct the DAG.
2. Write the test using `Instant::now()` + `elapsed.as_millis() < N`.
3. Document the budget in [budgets.md](./budgets.md).
4. Keep budgets 10–50× observed baseline to avoid flakiness on CI hardware.

---

## TypeScript graph generator (`perf/graphGen.ts`)

Zero-dependency deterministic graph generator used by the Playwright perf
spec and available for manual console testing.

### Shapes

| Shape | Description | Stresses |
|-------|-------------|---------|
| `chain` | Linear: n0 → n1 → … → n(N-1) | Sequential topo traversal |
| `fanOut` | Star: n0 → {n1 … n(N-1)} | Wide dirty-set on source change |
| `fanIn` | Binary tree of `add` ops converging to root | Deep fan-in merge |
| `grid` | Serpentine row-major grid | Non-linear memory access pattern |
| `sparse` | Random DAG (seeded LCG, one predecessor each) | Unpredictable dirty-set patterns |

### Preset sizes

| Size | Node count |
|------|-----------|
| `small` | 200 |
| `medium` | 2 000 |
| `large` | 10 000 |

### Usage

```typescript
import { generateGraph, makeSnapshot, SeededRandom } from '../perf/graphGen.ts'

// Get nodes + edges directly
const { nodes, edges, nodeCount, edgeCount } = generateGraph({
  shape: 'chain',
  size: 'medium',
})

// Get a ready-to-inject EngineSnapshotV1
const snap = makeSnapshot({ shape: 'fanOut', n: 5000 })

// Use a custom seed for reproducibility
const rng = new SeededRandom(1337)
const sparseGraph = generateGraph({ shape: 'sparse', n: 1000, seed: 1337 })
```

### Used by

- `e2e/perf-smoke.spec.ts` — injects `makeSnapshot({ shape: 'chain', size: 'medium' })`
  via `window.__cs_engine.loadSnapshot()` and measures `cs:eval:patch` times.

---

## Criterion benchmarks (local only)

Criterion benchmarks live in `crates/engine-core/benches/`. They are **not**
run in CI (too slow, no threshold gates) but produce HTML reports useful for
local optimization work.

```bash
# Run all Criterion benchmarks (takes 2–5 minutes)
npm run perf:engine

# Or directly:
cargo bench --package engine-core

# Open HTML report
open target/criterion/report/index.html
```

The nightly `perf.yml` workflow runs Criterion and uploads
`target/criterion/` as a GitHub Actions artifact for trend tracking.

---

## Tips for accurate local measurements

1. **Close browser tabs and IDEs** — background JS/Electron workloads skew
   results significantly on shared hardware.
2. **Use release build** — `wasm-pack build --release` (default in `npm run build`).
   Debug WASM is 10–50× slower.
3. **Rust tests use native CPU** — `cargo test` runs on your native architecture,
   not through WASM. Browser numbers will differ (WASM JIT overhead + GC).
4. **Repeat 3× and take the median** — first run may include JIT warmup.
5. **CI hardware (Codespace)** — 4 vCPU / 8 GB RAM. Rust tests are ~2–5×
   slower than a modern laptop. Budgets account for this.
