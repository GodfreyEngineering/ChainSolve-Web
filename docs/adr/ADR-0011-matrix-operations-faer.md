# ADR-0011: Matrix Operations via faer

**Status:** Proposed
**Date:** 2026-03-11
**Ticket:** SCI-03 (blocked — pending Rust implementation)

---

## Context

Structural analysis (stiffness matrices), control systems (state-space), finite element methods, and linear regression all require matrix operations beyond what vector ops can express. Users currently have no matrix multiply, solve, or decomposition blocks.

Two main Rust WASM-compatible linear algebra options exist:

1. **`nalgebra`** — feature-rich, generic types, well-documented. Statically sized (stack) or heap-allocated. Compiles to WASM but does not use WASM-SIMD without manual feature flags.
2. **`faer`** — a newer crate designed for high performance on modern CPUs. Uses SIMD aggressively (including WASM-SIMD128). Column-major storage (cache-friendly for typical BLAS operations). Provides LU, QR, SVD, Cholesky, eigendecomposition. Heap-only (dynamic sizes), which matches our use case (user-defined matrix dimensions).

---

## Decision

Use **`faer`** for all matrix operations.

Add `Value::Matrix { rows: usize, cols: usize, data: Arc<[f64]> }` (row-major flat storage for JSON serialisation; converted to `faer::Mat` column-major internally for computation).

New ops: `matrix(rows, cols, flat_data_vector)` (constructor from vector), `mat_mul(A, B)`, `mat_add(A, B)`, `mat_transpose(A)`, `mat_inv(A)`, `mat_solve(A, b)` (LU), `mat_det(A)`, `mat_eig(A)` (eigenvalues, real symmetric only for v1), `mat_svd(A)`, `mat_rank(A)`, `mat_trace(A)`, `mat_norm_fro(A)`, `identity(n)`, `zeros(rows, cols)`.

Bump `ENGINE_CONTRACT_VERSION`.

---

## Consequences

**Positive:**
- `faer` auto-vectorises to WASM-SIMD128 (our ADR-0006 decision); matrix multiply on 100×100 matrices is ~40× faster than a naive triple-loop scalar implementation.
- Dynamic sizing matches user-defined graph dimensions perfectly.
- SVD and eigendecomposition cover the most common linear algebra needs in engineering.

**Negative / risks:**
- `faer` is a relatively new crate (first stable 2023). API may have breaking changes. Pin to a specific minor version in `Cargo.lock`.
- Column-major ↔ row-major conversion overhead for small matrices. Negligible for matrices > 10×10; for smaller matrices scalar ops are fine.
- Binary size: `faer` adds ~80–100 KB (estimated raw WASM). Combined with ADR-0009 and ADR-0010, the WASM binary approaches the 800 KB budget ceiling. Monitor with `wasm-size` CI check.
- Matrix types are a new `Value` variant — all match arms must be updated.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| `nalgebra` | Slower in benchmarks for dynamic heap-allocated matrices; less SIMD utilisation |
| `ndarray` + `blas-src` | BLAS requires linking a native BLAS library; not available in WASM |
| Hand-rolled operations | Correctness risk; no SVD/eigendecomp without significant effort |
