# Performance Budget

This document records the performance targets for ChainSolve Web and explains
how they are measured and enforced.

---

## Bundle budget (CI-enforced)

| Metric | Budget | Check |
|--------|--------|-------|
| Initial JS (gzip) | ≤ 370 KB | `scripts/check-bundle-size.mjs` |
| WASM binary (raw) | ≤ 650 KB | `scripts/check-bundle-size.mjs` |
| WASM binary (gzip) | ≤ 200 KB | `scripts/check-bundle-size.mjs` |
| Lazy chunks (min) | ≥ 10 | `scripts/check-perf-budget.mjs` |
| Initial JS files (max) | ≤ 6 | `scripts/check-perf-budget.mjs` |
| WASM gzip ratio | ≤ 70% | `scripts/check-perf-budget.mjs` |
| Named lazy splits | allowlist | `scripts/check-bundle-splits.mjs` |

All three check scripts run in `./scripts/verify-ci.sh` and
`.github/workflows/ci.yml`. A build fails if any budget is exceeded.

---

## Runtime targets

### Engine evaluation

| Graph size | Full eval budget | Source |
|------------|-----------------|--------|
| 500 nodes | ≤ 200 ms | `perf_smoke_500_chain_under_200ms` |
| 500 nodes (fan-out) | ≤ 200 ms | `perf_smoke_fanout_500_under_200ms` |
| 1 000 nodes | ≤ 500 ms | `perf_smoke_1k_chain_under_500ms` |
| 1 000 nodes (fan-out) | ≤ 500 ms | `perf_smoke_fanout_1k_under_500ms` |
| 10 000 nodes | ≤ 8 000 ms | `perf_smoke_10k_chain_under_8000ms` |
| snapshot load only (1 k) | ≤ 50 ms | `perf_smoke_load_only_1k_under_50ms` |
| incremental patch (1 k) | ≤ 200 ms | `perf_smoke_incremental_1k_under_200ms` |
| incremental (no dirty) | ≤ 50 ms | `perf_smoke_incremental_unchanged_under_50ms` |

All Rust smoke tests live in `crates/engine-core/tests/perf_smoke.rs` and run
in `cargo test --workspace`.  The budgets are intentionally generous (≈ 5–10 ×
expected) to avoid flakes on slow CI runners while still catching major
regressions.

### Worker round-trip (main-thread perception)

| Scenario | Target |
|----------|--------|
| Small incremental patch (< 50 nodes dirty) | ≤ 50 ms |
| Typical working graph (100–300 nodes) | ≤ 200 ms |

These are measured by `workerRoundTripMs` in the perf metrics store and visible
in the `?perf=1` overlay.

### Rendering

| Metric | Target |
|--------|--------|
| Steady-state FPS (no eval, idle canvas) | 60 fps |
| FPS while eval is in flight | ≥ 30 fps |

Measured via the `fps` counter in the `?perf=1` HUD
(`src/components/PerfHud.tsx`).

### WASM initialisation

| Metric | Target |
|--------|--------|
| WASM module first load | ≤ 300 ms |

Tracked by `wasmInitMs` in `perfMetrics.ts` and visible in the `?perf=1` HUD.

---

## Web Vitals / Lighthouse targets

These apply to the initial page load on a simulated mid-tier device with
throttled network (Lighthouse "Mobile" preset).

| Metric | Target |
|--------|--------|
| Performance score | ≥ 80 |
| First Contentful Paint | ≤ 2.5 s |
| Time to Interactive | ≤ 5 s |
| Total Blocking Time | ≤ 200 ms |

> **Note:** Lighthouse is not yet automated in CI.  See the "How to measure"
> section below for manual verification.

---

## How to measure

### In-app overlay (`?perf=1`)

Append `?perf=1` to any canvas URL:

```
https://app.chainsolve.com/canvas/my-project?perf=1
```

The HUD (bottom-right corner) shows live:

- `eval` — engine computation time (ms)
- `rtrip` — full worker round-trip (ms)
- `nodes` — evaluated / total
- `dsets` — dataset count and total bytes
- `fps` — rendered frames per second
- `wasm` — WASM init time on last worker boot (ms)

A `[cs:perf]` line is also emitted to the browser console every 5 seconds for
easy copy-paste into bug reports.

### Rust perf smoke tests

```bash
cargo test --workspace --test perf_smoke
```

### Lighthouse CLI

```bash
# Start the dev server first:
npm run dev

# Run Lighthouse (requires Node 18+):
npx lighthouse http://localhost:5173 --view --preset=desktop

# Or mobile (applies CPU/network throttling):
npx lighthouse http://localhost:5173 --view
```

### Canvas rendering features (LOD + animated edges)

LOD (Level of Detail) and animated edges are performance-sensitive features.
To verify they don't regress:

1. Open a canvas with 50+ nodes at `http://localhost:5173/canvas`
2. Append `?perf=1` to enable the HUD
3. Toggle LOD on (Alt+L) — verify FPS stays ≥ 30 while zooming in/out
4. Toggle animated edges on (Alt+E) — verify FPS stays ≥ 30 on idle canvas
5. With 400+ edges, animated edges should auto-disable (check `CanvasSettingsContext`)

The LOD system uses CSS-only visibility (`data-lod` attribute) and does not
re-render React components — performance impact is minimal. Animated edges
use CSS `stroke-dashoffset` animation which the browser GPU-accelerates.

### Bundle size check

```bash
# After a production build:
node scripts/check-bundle-size.mjs

# Structural budget (lazy chunks, initial file count, WASM ratio):
node scripts/check-perf-budget.mjs

# Lazy-split allowlist (named components stay in separate chunks):
node scripts/check-bundle-splits.mjs
```

---

## Optional future CI integration

To automate Lighthouse in CI, add a step after `vite build` in
`.github/workflows/ci.yml`:

```yaml
- name: Lighthouse CI
  run: npx lhci autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

A `lighthouserc.json` budget file would be needed:

```json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.8 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 5000 }]
      }
    }
  }
}
```

This is intentionally left as optional because Lighthouse scores are sensitive
to the CI runner environment and can produce noisy results.
