# Performance Baseline

> W9.9 | Measured 2026-02-26 | Branch w9.9-performance-guardrails

This document records the performance baseline measured before W9.9 hardening.
It is intentionally a snapshot — not updated on every change.
See [budgets.md](./budgets.md) for the hard limits derived from these numbers.

---

## Environment

- **Machine:** GitHub Codespace (4 vCPU, 8 GB RAM) — representative of CI
- **Build mode:** release (`wasm-pack build --release`)
- **Measurement method:** `std::time::Instant` (Rust smoke tests); `performance.now()` (browser)

---

## Engine evaluation (Rust side, via `cargo test`)

Measured by `crates/engine-core/tests/perf_smoke.rs`:

| Scenario | Nodes | Time (Codespace) | CI budget |
|----------|-------|------------------|-----------|
| Full eval — chain | 1 000 | ~15–50 ms | < 500 ms |
| Incremental — chain | 1 000 | ~3–10 ms | < 200 ms |
| Full eval — chain | 10 000 | ~150–500 ms | < 8 000 ms |
| Fan-out full eval | 1 000 | ~10–30 ms | < 500 ms |
| Incremental, value unchanged | any | ~1–5 ms | < 50 ms |
| vectorSum on 1M dataset | 1M f64 | ~30–100 ms | < 2 000 ms |

*Rust timings use `std::time::Instant` — no JIT warmup, no GC pauses.*

---

## Engine evaluation (WASM boundary, browser)

Measured in dev via PerfHud (`?perf=1`) with a local Chromium build:

| Scenario | Nodes | `lastEvalMs` | `workerRoundTripMs` |
|----------|-------|-------------|---------------------|
| Snapshot load | 7 (default) | ~1 ms | ~3–5 ms |
| Patch (1 change) | 7 (default) | ~0.1 ms | ~2–3 ms |
| Patch (no change) | 7 (default) | ~0.1 ms | ~2–3 ms |

*Note: `lastEvalMs` is derived from `elapsed_us` which is measured by `js_sys::Date::now()`
in the WASM wrapper. Precision is ±1 ms. Sub-millisecond values round to 0.*

---

## Bundle sizes (uncompressed)

Measured from `dist/assets/` after `npm run build`:

| File | Size |
|------|------|
| `main-*.js` | ~796 KB |
| `index-*.js` | ~245 KB |
| `engine_wasm_bg-*.wasm` | ~493 KB |
| `vega.module-*.js` (lazy) | ~484 KB |
| `PlotExpandModal-*.js` (lazy) | ~3.2 KB |
| `PerfHud-*.js` (lazy) | ~760 B |
| `csv-worker-*.js` | ~920 B |
| Total JS | ~1 052 KB (excl. lazy Vega) |
| Total JS (all) | ~1 537 KB |

*Cloudflare Pages serves Brotli-compressed assets; on-wire sizes are ~40–60% smaller.*

---

## User Timing measures (after W9.9)

After W9.9, `performance.getEntriesByType('measure')` emits:

| Measure name | What it covers |
|-------------|----------------|
| `cs:eval:snapshot` | `loadSnapshot()` round-trip (full engine reload) |
| `cs:eval:patch` | `applyPatch()` round-trip (incremental eval) |

---

## Known unknowns

1. **Per-node eval time** — not measured inside Rust (no `Instant` in wasm32). Only total elapsed.
2. **JSON marshalling cost** — included in `elapsed_us` (in/out boundary hidden from Rust).
3. **Large fan-in graphs** — no benchmark coverage; expected slower than chains for same N.
4. **Table operations** — only scalar/vector benchmarked in perf_smoke.
5. **Multi-canvas memory** — planned for W10; no baseline yet.
6. **First-paint time** — auth-gated; Lighthouse can't measure reliably without credentials.
7. **Mobile performance** — all baseline numbers are desktop-class hardware.
