# ADR-0010: Complex Number Value Type

**Status:** Proposed
**Date:** 2026-03-11
**Ticket:** SCI-02 (blocked — pending Rust implementation)

---

## Context

Electrical engineering (impedance, phasors, AC circuit analysis), control systems (transfer functions, poles/zeros), and quantum mechanics all require complex arithmetic. ChainSolve currently only supports `f64` scalars and vectors. Users doing AC circuit analysis must manually split real/imaginary parts, which is error-prone and verbose.

The `num-complex` crate is the Rust ecosystem standard for complex arithmetic. It is `no_std`, `serde`-compatible, and compiles cleanly to WASM.

---

## Decision

Add `Value::Complex { re: f64, im: f64 }` to the engine. Extend ops polymorphically:

- Arithmetic ops (`add`, `sub`, `mul`, `div`) work on complex inputs.
- New ops: `complex(re, im)` (constructor), `real(z)`, `imag(z)`, `abs(z)` (magnitude), `arg(z)` (phase angle in radians), `conj(z)`, `exp(z)`, `ln(z)`, `sqrt(z)`, `pow(z, n)`.
- Existing trig ops (`sin`, `cos`, etc.) extended to complex domain.
- Display blocks render complex values as `a + bj` (engineering notation) or `r∠θ°` (polar), per preference.

Source blocks gain a "Complex" mode with two inputs: `re` and `im`.

`Vector` of complex: represented as `Value::ComplexVector(Arc<[Complex64]>)` for FFT output (separate ADR for FFT/signal processing).

Bump `ENGINE_CONTRACT_VERSION`.

---

## Consequences

**Positive:**
- Impedance, phasors, transfer function evaluation become natural single-block operations.
- FFT output (complex spectrum) can be represented natively.
- `num-complex` is battle-tested; no new algorithms to write for core complex arithmetic.

**Negative / risks:**
- New `Value` variants require every match arm across `ops.rs`, `eval.rs`, `validate.rs` to be updated. Significant Rust change.
- Mixed real/complex arithmetic: should `scalar + complex` promote scalar to complex? Rust operator overloading via `num-complex` handles this, but the engine's match-dispatch must too.
- Serialisation: `Complex { re, im }` must be stable JSON across `ENGINE_CONTRACT_VERSION` bumps. Chosen over `[re, im]` tuple for readability.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Two-scalar convention (user wires re + im separately) | Already the status quo; eliminates type safety and is verbose |
| `num-complex` only in ops, not as a `Value` variant | Requires explicit unwrap/wrap at every op boundary; leaks implementation detail |
| User-defined struct type | Requires a full type system — out of scope for v1 |
