# ADR-0009: Interval Arithmetic for Propagated Uncertainty

**Status:** Proposed
**Date:** 2026-03-11
**Ticket:** SCI-01 (blocked — pending Rust implementation)

---

## Context

Scientific calculations involving physical measurements always carry uncertainty. A resistance of 10 Ω ± 5% propagated through Ohm's law should produce a power estimate with a meaningful ± bound, not just a point value. Users currently have no way to express or propagate uncertainty through a graph; they must do separate worst-case calculations by hand.

Interval arithmetic represents each value as a closed interval `[lo, hi]` and defines all arithmetic operations on intervals such that the true result is guaranteed to lie within the output interval (assuming inputs are exact at the endpoints). This is provably correct — unlike Monte Carlo estimation — and has O(1) overhead per operation rather than O(N) for N samples.

The `inari` crate provides IEEE 1788-compliant interval arithmetic for Rust, including correct rounding-mode handling. It is `no_std` compatible and compiles to WASM.

---

## Decision

Add an `Interval` variant to `Value` in `engine-core`:

```rust
pub enum Value {
    Scalar(f64),
    Interval { lo: f64, hi: f64 },  // new
    Vector(Arc<[f64]>),
    Table { ... },
    Error(EngineError),
}
```

Extend all arithmetic ops to handle `Interval` inputs using `inari`. A scalar input to a binary op with an interval operand is widened to `Interval { lo: x, hi: x }`. A source block can emit an interval by specifying `lo` and `hi` directly.

Display blocks render intervals as `3.14 ± 0.02` (midpoint ± half-width) or `[3.12, 3.16]` (raw bounds), per user preference.

Bump `ENGINE_CONTRACT_VERSION` when this lands.

---

## Consequences

**Positive:**
- Users get scientifically valid uncertainty propagation for all ~100 existing ops with no new blocks required (ops are polymorphic over `Value`).
- Engineers can replace manual worst-case analyses with a single graph.

**Negative / risks:**
- Interval arithmetic is **pessimistic**: repeated use of the same variable (dependency problem) widens the interval faster than the true uncertainty. Users must be warned of this limitation. Affine arithmetic would solve it but is far more complex.
- Adds a new `Value` variant — all match arms in `ops.rs` must handle `Interval`. This is a significant Rust change touching every op.
- `inari` adds ~50 KB to the WASM binary (estimated).
- `ENGINE_CONTRACT_VERSION` must be bumped, invalidating all cached results.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Monte Carlo (N samples per node) | O(N) per op; user must choose N; probabilistic, not guaranteed |
| Affine arithmetic | Eliminates dependency problem but 3–5× more complex to implement |
| Symbolic uncertainty (first-order Taylor) | Only valid for smooth functions near the nominal; misses discontinuities |
