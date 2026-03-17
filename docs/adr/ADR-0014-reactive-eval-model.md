# ADR-0014: Reactive Evaluation Model

**Status:** Accepted
**Date:** 2026-03-17

---

## Context

ChainSolve is a block-based computational graph tool where users wire together nodes (blocks) to build data pipelines and simulations. Every block has inputs and outputs, and the graph must re-evaluate whenever upstream data changes. The central design question was: when does evaluation happen, and who triggers it?

Early prototypes evaluated the entire graph on every user interaction — every mouse move, every keystroke in a parameter field. This produced a system that felt responsive for tiny graphs but degraded sharply as graph complexity grew. A 30-node ODE simulation re-evaluating on every keystroke introduced visible lag and made the UX feel "sticky." A model was needed that felt instantaneous for structural changes while being forgiving of rapid sequential data edits.

The evaluation model also had to integrate cleanly with the Rust/WASM compute engine. The WASM module is synchronous and single-threaded within its execution context; the JS side must decide when to call into it and with what inputs. A poorly chosen trigger strategy could cause re-entrant calls, stale reads, or race conditions between the UI thread and the evaluation worker.

Finally, users building iterative or simulation-heavy graphs needed an escape hatch: the ability to freeze evaluation entirely and trigger it manually. Any model that hard-coded a single trigger strategy would fail these power users.

---

## Decision

We implement a **reactive evaluation model** managed by the `EvalScheduler` class (`src/engine/evalScheduler.ts`), with the following rules:

1. **Structural changes fire immediately.** Adding a block, removing a block, connecting an edge, or disconnecting an edge triggers a synchronous graph topology re-analysis followed by an immediate evaluation dispatch to the WASM worker. These events are infrequent and semantically significant — a stale graph after a rewire is confusing.

2. **Data changes are debounced at 50 ms.** Changes to block parameter values (typing in an input field, dragging a slider) start a 50 ms debounce timer. If additional data changes arrive within the window, the timer resets. Only when 50 ms of silence passes does `EvalScheduler` dispatch to the WASM worker. This keeps the UI responsive during rapid edits while ensuring the engine sees a settled value.

3. **Evaluation never loops.** Cycles in the graph are detected during topology analysis (Kahn's algorithm on the dependency DAG). If a cycle is found, `EvalScheduler` emits a `CYCLE_DETECTED` error event and halts — it does not attempt to converge. Iterative algorithms that need feedback loops must be encapsulated inside a single simulation block rather than expressed as graph-level cycles.

4. **Manual mode is opt-in per-graph.** A graph-level `evalMode` flag (`'reactive' | 'manual'`) disables all automatic dispatch when set to `'manual'`. The user triggers evaluation explicitly via the Run button or `Ctrl+Enter`. `EvalScheduler` still tracks dirty state internally so the UI can show a "stale" badge on affected blocks.

```typescript
// EvalScheduler dispatch logic (simplified)
onStructuralChange() {
  this.clearDebounce()
  if (this.evalMode === 'reactive') this.dispatch()
  else this.markDirty()
}

onDataChange() {
  if (this.evalMode === 'manual') { this.markDirty(); return }
  this.scheduleDebounced(50, () => this.dispatch())
}
```

The WASM evaluation worker receives a serialized graph snapshot (node list + edge list + parameter values) and returns an output map keyed by block ID. `EvalScheduler` diffs incoming outputs against the previous run and notifies only the React components whose blocks actually changed, preventing full re-renders.

---

## Consequences

**Positive:**
- Structural changes feel instantaneous — rewiring a node produces visible output immediately.
- Typing in a parameter field does not overwhelm the WASM worker; the 50 ms debounce absorbs burst edits without perceptible delay for single keystrokes.
- Manual mode gives simulation-heavy workflows full control, preventing accidental expensive re-runs during graph construction.
- Cycle detection at the scheduler layer keeps the WASM engine simple — it always receives a valid DAG and never needs to handle convergence logic.
- Dirty-state tracking in manual mode enables the "stale" badge UX without requiring a separate diffing pass.

**Negative / risks:**
- The 50 ms debounce is a heuristic. On very slow machines or very large graphs, 50 ms may not be enough to avoid queuing multiple in-flight evaluations; this is mitigated by dropping dispatches when a worker evaluation is already in-flight and re-queuing once it completes.
- Manual mode requires user discipline — a graph in manual mode with stale outputs can silently produce wrong results if the user forgets to re-run. The "stale" badge helps but does not prevent misreading outputs.
- Reactive evaluation assumes the WASM engine is pure/deterministic for a given input snapshot. Side-effectful blocks will be called on every dispatch, which may cause unintended repeated side effects.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Continuous polling (RAF loop) | Evaluates even when nothing changed, wasting CPU on idle graphs. Produces unnecessary WASM call overhead. |
| Event-driven batching (React 18 transitions) | React's batching is UI-render-level, not compute-level. It does not prevent multiple in-flight WASM calls, and mixing React scheduling semantics with a Web Worker message queue created ordering ambiguities in testing. |
| Purely manual evaluation | Early user testing showed that new users consistently forgot to press Run and assumed the graph was live. The cognitive overhead of manual mode as the default made simple graphs feel broken. |
| Node-level incremental evaluation (dirty-flag propagation) | Incrementally re-evaluating only dirty subgraphs reduces redundant work but requires the WASM engine to maintain mutable state between runs. This breaks the stateless snapshot model and complicates serialization/undo. Deferred to a future ADR. |
