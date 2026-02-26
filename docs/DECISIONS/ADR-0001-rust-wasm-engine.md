# ADR-0001 — Rust/WASM Worker Engine

| Field | Value |
|-------|-------|
| Status | Accepted |
| Decided | W9 |
| Supersedes | — |
| Affects | `crates/`, `src/engine/`, CI build |

---

## Context

ChainSolve evaluates a directed acyclic graph of mathematical operations in
real time as users wire blocks together.  The original implementation ran a
TypeScript evaluation engine (`src/engine/evaluate.ts`) synchronously on the
main thread.

**Problems with the TypeScript engine:**
1. **Performance ceiling** — large graphs with array/table operations blocked
   the main thread, causing visible frame drops.
2. **Correctness fragility** — floating-point edge cases (NaN canonicalization,
   negative-zero, broadcasting rules) were hard to test exhaustively in TS.
3. **No incremental evaluation** — every graph change triggered a full
   re-evaluation of all nodes, even unchanged ones.
4. **No determinism guarantee** — TS results varied across JS engines in
   subtle ways.

---

## Decision

Replace the TypeScript evaluation engine with a **Rust compute core** compiled
to WebAssembly, running in a **dedicated Web Worker**.

Architecture:

```
Main thread (React)
    ↕ postMessage (PatchOp[] or FullSnapshot)
Web Worker (src/engine/worker.ts)
    ↕ JSON boundary
Rust/WASM (crates/engine-wasm / crates/engine-core)
    ↕ returns IncrementalEvalResult
Web Worker
    ↕ postMessage (Map<nodeId, Value>)
Main thread → ComputedContext → all nodes re-render only if their value changed
```

Key design choices within this decision:

1. **Two crates:** `engine-core` (pure Rust, no WASM deps, fully testable with
   `cargo test`) and `engine-wasm` (thin wasm-bindgen wrapper, `thread_local!`
   for persistent `EngineGraph` state).

2. **JSON at the boundary:** The TS↔WASM boundary uses JSON serialization
   (not typed WASM memory sharing).  This accepts a small serialization cost
   in exchange for a clean, version-able protocol.

3. **Persistent `EngineGraph`:** The WASM module keeps a single `EngineGraph`
   in thread-local storage.  Full snapshots are sent only on first load;
   subsequent updates use `PatchOp[]` (add/remove/update node or edge).

4. **Incremental evaluation:** `EngineGraph` tracks a dirty set.  Only nodes
   downstream of a change are re-evaluated.  Unchanged nodes return their
   cached values.

5. **`ENGINE_CONTRACT_VERSION`:** A u32 constant in `catalog.rs` that must
   be acknowledged by `src/engine/index.ts`.  Bumped when evaluation
   semantics change in a way consumers must handle.

---

## Consequences

**Positive:**
- Evaluation is off the main thread (no jank).
- Rust's type system + `cargo test` + property tests + golden fixtures give
  strong correctness guarantees.
- Incremental eval means large graphs stay fast after the first load.
- NaN/negative-zero canonicalization is enforced in one place.
- The engine is fully independent of the UI — it can be tested with pure
  `cargo test`, no browser needed.

**Negative / trade-offs:**
- Rust/WASM build step (`wasm-pack`) is required before `npm run dev`.
- WASM requires `'wasm-unsafe-eval'` in CSP (see ADR-0002).
- The JSON boundary adds a small serialization cost per evaluation cycle.
- Adding new ops requires touching both Rust (`ops.rs`, `catalog.rs`) and
  TypeScript (`src/blocks/`).
- Debugging the Rust engine requires `cargo test` + golden fixtures, not the
  browser DevTools.

---

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Keep TS engine, add Web Worker | Doesn't solve correctness/determinism; still JS semantics |
| AssemblyScript | Less mature type system; weaker test ecosystem |
| WASM on main thread (no Worker) | Blocks UI during evaluation; CSP `wasm-unsafe-eval` still required |
| Shared memory (SharedArrayBuffer) | Requires COOP/COEP headers that break Stripe iframe checkout |

---

## See also

- `docs/W9_ENGINE.md` — Build, debug, add ops
- `docs/W9_2_SCALE.md` — Patch protocol + incremental eval architecture
- `docs/W9_3_CORRECTNESS.md` — NaN/error propagation, golden tests
- `docs/W9_4_PERF.md` — Performance profiling
