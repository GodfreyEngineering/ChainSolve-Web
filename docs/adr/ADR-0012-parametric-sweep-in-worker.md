# ADR-0012: Parametric Sweep Execution in Worker

**Status:** Proposed
**Date:** 2026-03-11
**Ticket:** SCI-09 (blocked — pending Rust implementation)

---

## Context

A parametric sweep varies one or more input values over a range and records output values at each step, producing a table of results (e.g. beam deflection vs. load). This is one of the most common engineering workflows.

A naive implementation runs the sweep on the main thread by repeatedly calling `engine.evaluate()` with different input values. For 1 000 steps × a 50-node graph this can take 2–5 seconds of synchronous main-thread computation, blocking UI input.

Two options exist for off-main-thread execution:
1. **Run inside the engine worker** — the sweep loop executes in the existing worker, avoiding `postMessage` round-trips per step.
2. **Separate sweep worker** — spawn a dedicated worker that calls the engine worker per step via `postMessage` (adds message-passing overhead).

---

## Decision

Execute the parametric sweep **inside the engine worker**:

Add a `sweep` message type to the worker protocol:
```ts
{ type: 'sweep'; requestId: number; nodeId: string; portId: string;
  start: number; stop: number; steps: number; logScale: boolean;
  options?: EvalOptions }
```

The worker loads the current snapshot, iterates the range internally (no round-trips), and posts a single `sweep-result` response containing a `Table` value with rows = steps and columns = [parameter, ...outputNodeIds].

The engine does **not** need to reload the snapshot between steps — it reuses the already-loaded `EngineGraph`, sets the input for the swept node, evaluates incrementally (only dirty subgraph), and records results. Incremental evaluation makes each step O(dirty subgraph) rather than O(full graph).

Progress events (`{ type: 'progress', ... }`) are posted every 50 steps so the UI can show a progress bar without blocking.

---

## Consequences

**Positive:**
- Zero UI jank during sweep — execution is entirely in the worker.
- Incremental evaluation makes sweeps of large graphs with small dirty subgraphs ~10–50× faster than full re-evaluation per step.
- 1 000-step sweep completes in < 2 s for typical engineering graphs.

**Negative / risks:**
- The sweep occupies the worker for its duration. Other `evaluate` requests issued during the sweep must be queued (existing request queue). If the user edits the graph during a long sweep, the sweep is cancelled and re-run with the updated graph.
- Only one parameter can be swept per request (v1). 2D sweeps require running two nested sweeps in sequence on the client side (not ideal, addressed in a future ADR).
- `logScale` sweep requires careful endpoint handling: 0 is invalid (log undefined). The worker returns an error if `start ≤ 0` with `logScale = true`.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Main-thread sweep loop | Blocks UI for 2–5 s; unacceptable for interactive tool |
| Separate sweep worker (per step postMessage) | ~10 µs message-passing overhead × 1000 steps = 10 ms extra; also requires snapshot duplication |
| WebGL compute shader | No float64 support in WebGL; WASM-SIMD is faster for this workload |
