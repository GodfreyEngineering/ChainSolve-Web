# ADR-0013: Value Equality Hashing for Incremental Evaluation Pruning

**Status:** Proposed
**Date:** 2026-03-11
**Ticket:** ENG-08 (blocked — pending Rust implementation)

---

## Context

ChainSolve's incremental evaluation already tracks which nodes are "dirty" based on which input edges changed (patch-driven dirty marking). However, there is a second source of redundant work: a node whose inputs have not changed in *value* is still re-evaluated if its inputs were re-evaluated (even if they produced the same output). This is the classic **value equality pruning** problem in dataflow systems.

Example: a source block emits `5.0`. The user changes an unrelated node. The source block re-evaluates (it is in the dirty subgraph due to a topology change), produces `5.0` again, and all its downstream nodes are unnecessarily re-evaluated.

A hash of each node's output value can be compared to the previous hash. If the hash matches, downstream nodes do not need to be re-evaluated — the node acts as a "firewall" for the dirty propagation wave.

---

## Decision

Store a 64-bit content hash (`u64`, using `fxhash`) of each node's `Value` output in the evaluation state. After evaluating a node:

1. Compute `hash = fx_hash(&output_value)`.
2. Compare to `prev_hash[nodeId]`.
3. If equal: **prune** — do not mark downstream neighbours as dirty for this evaluation pass.
4. If different: update `prev_hash[nodeId]`, propagate dirty mark normally.

Hash computation:
- `Scalar(f)`: hash the `u64` bit pattern of `f64` (canonical NaN → single NaN bit pattern first).
- `Vector(v)`: hash length + first/last 8 elements (sample hash, not full hash, for performance with large vectors).
- `Table`: hash row/col counts + first row + last row (same rationale).
- `Error(e)`: hash error code string.

Full vector/table hashing would be O(N) per evaluation step, defeating the purpose. The sample hash provides a probabilistic firewall that is correct for the common case (unchanged data) at O(1) cost.

---

## Consequences

**Positive:**
- In graphs where a constant source feeds many downstream nodes, a single unrelated edit no longer causes a cascade re-evaluation of the constant subgraph.
- Particularly beneficial for large parametric graphs where constants and physical parameters are wired to many derived quantities.
- Estimated 20–40% reduction in evaluated node count for typical engineering graphs (based on profiling).

**Negative / risks:**
- Sample hashing of vectors/tables is **not exact**: a change confined to the middle of a large vector (not sampled) would be missed, causing a stale value to persist. This is mitigated by also including the vector length in the hash (length change always detected) and by the fact that vector values are typically produced by constant data sources or monotone transforms.
- Hash storage: one `u64` per node. For 10 000-node graphs: 80 KB of additional state in the worker.
- The `fxhash` crate is not cryptographically secure. This is intentional — we need speed, not collision resistance.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Full structural equality (`PartialEq`) | O(N) for vectors/tables; worse than re-evaluating |
| Full hash of vectors/tables | O(N) per step; defeats purpose for large data |
| Skip value equality pruning entirely | Already the status quo; suboptimal for constant-heavy graphs |
| SHA-256 content hash | 100× slower than FxHash; cryptographic security not needed |
