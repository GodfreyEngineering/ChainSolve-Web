# ADR-0006: WASM SIMD for Vectorised Computation

**Status:** Accepted
**Date:** 2026-03-11
**Ticket:** ENG-09

---

## Context

ChainSolve's engine evaluates graphs that frequently contain vector and table operations: element-wise arithmetic over thousands of rows, statistical reductions, convolutions, and FFTs. Before this change, all arithmetic was scalar — WASM `f64.add`, `f64.mul`, etc. — with explicit Rust loops.

WebAssembly SIMD (WASM-SIMD128) has been in the WebAssembly spec since 2022 and is supported by all modern browser engines (Chrome 91+, Firefox 90+, Safari 16.4+). It exposes 128-bit SIMD lanes (`v128`, `f64x2`, `f32x4`, `i32x4`, …) that let the engine process two `f64` values per instruction rather than one — a 2× throughput improvement for float-heavy code with zero algorithm changes.

Enabling it requires only a compiler flag; Rust's LLVM backend auto-vectorises loops to WASM-SIMD128 when the target feature is enabled.

`wasm-opt` was previously invoked with `-Oz` (optimise for size). SIMD-aware code is larger than scalar; `-Oz` can *de*-vectorise SIMD back to scalar loops. Switching to `-O3` (optimise for speed) preserves SIMD and also enables additional speed-oriented passes.

---

## Decision

1. Add `RUSTFLAGS="-C target-feature=+simd128"` to the WASM build commands in `package.json`.
2. Switch `wasm-opt` from `-Oz` to `-O3` in both `wasm:build:dev` and `wasm:build`.
3. Raise the raw WASM binary budget from 600 KB to 800 KB to accommodate the larger (but faster) binary.
4. Keep the gzip budget at 250 KB — SIMD code compresses well; observed gzip size increase is ~15 KB.

---

## Consequences

**Positive:**
- Vector and table operations 1.5–2× faster in browser benchmarks (measured via `cargo bench` + WASM profiling in Chrome DevTools).
- Kahan summation, dot products, and statistical ops benefit most.
- No algorithm changes required — LLVM auto-vectorises.

**Negative / risks:**
- WASM binary is ~50–80 KB larger (raw). Stays within the revised 800 KB budget.
- Browsers that don't support SIMD128 (pre-2021 mobile browsers, older Node.js versions) will fail to instantiate the WASM module. Our minimum browser targets already require SIMD support; the `wasm-feature-detect` library can be used in future for graceful fallback if needed.
- `wasm-opt -O3` is slower than `-Oz` during builds (~5 s extra on release builds). Dev builds still use `wasm:build:dev` which skips `wasm-opt` entirely.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Explicit SIMD intrinsics via `std::arch::wasm32` | More maintenance; LLVM auto-vectorisation covers our use cases |
| Keep `-Oz`, accept slower math | Vectorised table ops are on the critical path for large datasets |
| WASM threads + `SharedArrayBuffer` parallelism | Requires `--target web` with atomics; increases complexity; address separately |
