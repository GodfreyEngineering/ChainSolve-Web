# ADR-0017: Dedicated Simulation Web Worker

**Status:** Accepted
**Date:** 2026-03-17

---

## Context

ChainSolve supports two categories of block computation. The first is **reactive evaluation**: fast, stateless computation of a block's output given its inputs, expected to complete in under a few milliseconds. The second is **simulation**: long-running iterative algorithms — Runge-Kutta ODE solvers, nonlinear optimizers, Monte Carlo samplers — that may run for seconds or minutes and need to stream intermediate progress back to the UI.

Early architecture used a single Web Worker (`eval-worker`) to run both categories. This worked acceptably for small simulations but broke down in practice: a user triggering a 10-second ODE solve would completely block reactive evaluation for the duration. Editing an upstream parameter while a simulation was running produced no visible feedback until the simulation completed, making the interaction feel frozen. Cancellation was also difficult — terminating the eval worker to cancel a simulation destroyed the reactive evaluation state machine.

The WASM engine is compiled as a single binary that exposes both reactive evaluation exports and simulation exports. Running multiple workers means each worker loads and instantiates its own copy of the WASM module. While this increases memory usage, it provides complete thread isolation without shared mutable state between the two execution contexts.

Web Workers in browsers cannot share WASM memory safely without `SharedArrayBuffer`, which requires COOP/COEP headers (already present in `public/_headers`). However, for the simulation worker the key requirement is independent execution, not shared memory — isolated workers satisfy this with less architectural complexity.

---

## Decision

We introduce a **dedicated simulation Web Worker** (`src/engine/simulation-worker.ts`) that runs in parallel with the existing `eval-worker.ts`. Each worker loads an independent instantiation of `chainsolve_engine.wasm`. They communicate with the main thread via structured message passing; they do not communicate with each other.

**Separation of responsibilities:**

- `eval-worker` handles all reactive evaluation (graph snapshot → output map). It is always running and never blocked. Managed by `EvalScheduler` (see ADR-0014).
- `simulation-worker` handles all simulation requests: ODE integration, optimization loops, and any algorithm that produces a time-series or convergence sequence. Managed by `SimulationWorkerAPI`.

**`SimulationWorkerAPI`** is a typed wrapper around the simulation worker's `postMessage`/`onmessage` interface:

```typescript
class SimulationWorkerAPI {
  // Start a simulation; returns a unique runId
  start(spec: SimulationSpec): Promise<string>

  // Cancel an in-progress simulation by runId
  cancel(runId: string): Promise<void>

  // Subscribe to progress events for a runId
  onProgress(runId: string, cb: (frame: SimulationFrame) => void): () => void
}
```

**Progress streaming** uses a chunked message protocol. The simulation worker emits `{ type: 'PROGRESS', runId, frame }` messages at a configurable interval (default: every 100 ms of wall time or every 1000 solver steps, whichever comes first). The main thread accumulates frames and pushes them to subscribed React components via `useSimulationStore`. This decouples the simulation's internal step rate from the UI's render rate.

**Cancellation** is cooperative: the WASM simulation exports a `check_cancel(run_id: u32) -> bool` function that the Rust solver calls at the top of each iteration. When `SimulationWorkerAPI.cancel()` is called, it posts a `CANCEL` message to the worker, which sets a cancellation flag read by `check_cancel`. The solver exits its loop cleanly on the next iteration boundary, emitting a final `CANCELLED` frame with partial results.

**Error isolation** is explicit: an uncaught panic in the simulation worker crashes only that worker. The main thread detects the worker's `error` event, emits a `SIMULATION_CRASHED` notification, and respawns the worker. Reactive evaluation on the eval worker is unaffected.

**All simulations are finite.** Every simulation must have at least one of: `maxIterations`, `endTime`, or `convergenceThreshold`. Simulations with none of these are rejected with a validation error before the worker is invoked.

---

## Consequences

**Positive:**
- Reactive evaluation is never blocked by a running simulation — users can edit parameters and see live output updates even during a 60-second ODE solve.
- Cancellation is clean and cooperative — the solver exits at a well-defined boundary and emits partial results rather than the worker being `terminate()`d mid-computation.
- Progress streaming enables real-time time-series charts that update as the solver advances, giving users early confidence that a simulation is converging.
- Worker crash isolation means a buggy simulation block cannot take down the reactive evaluation system.
- The `SimulationWorkerAPI` abstraction hides all `postMessage` serialization from the rest of the frontend.

**Negative / risks:**
- Two WASM instantiations increase baseline memory usage by approximately the size of the WASM module's linear memory (~14 MB additional RSS on Chrome under a minimal graph).
- Structured cloning of `SimulationSpec` objects (graph snapshots + solver parameters) adds serialization overhead at simulation start. For very large graphs (500+ nodes) this clone can take 5-15 ms.
- Only one simulation can run per `simulation-worker` instance. Running multiple simultaneous simulations requires spawning multiple workers, which is not yet implemented. Users who start a second simulation while one is running implicitly cancel the first.
- The cooperative cancellation model means a simulation that calls into a tight WASM loop without yielding to `check_cancel` cannot be cancelled promptly. Simulation block authors must ensure their inner loops yield at reasonable intervals.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Single eval worker, run simulations sequentially | Blocks reactive evaluation for the entire simulation duration. User testing rated this as "the app freezes during simulation," which is unacceptable for an interactive tool. |
| Run simulations on the main thread with setTimeout chunking | Fragile, produces inconsistent step rates, and still occupies the main thread's task queue, degrading UI responsiveness. |
| SharedArrayBuffer + Atomics for cancellation signals | Requires COOP/COEP headers (already present) but adds complexity for a cancellation signal that cooperative `check_cancel` handles more cleanly. |
| Server-side simulation via Supabase Edge Functions | Introduces network latency on every progress frame, requires serializing simulation state over the wire, and eliminates offline capability. Appropriate only for cluster-scale simulations. |
