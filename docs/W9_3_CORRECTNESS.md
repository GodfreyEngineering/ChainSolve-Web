# W9.3 — Scientific Correctness Contract

## Overview

W9.3 establishes the **correctness contract** for the ChainSolve compute engine:
deterministic broadcasting, NaN/precision policies, an audit trace for debugging,
and progress/cancellation for long-running graphs.

**Contract version**: `1` (accessible at `engine.contractVersion`). Bumped when
correctness-affecting behavior changes.

---

## Broadcasting Rules

All unary and binary math/trig/logic ops support broadcasting across value kinds.

### Unary Broadcasting

| Input Kind | Result Kind | Behavior |
|---|---|---|
| Scalar | Scalar | `f(x)` |
| Vector | Vector | Elementwise `f(xi)` |
| Table | Table | Elementwise `f(cell)` for all numeric cells |
| Error | Error | Propagate error |
| None (missing) | Scalar | `f(NaN)` |

**Applies to**: `negate`, `abs`, `sqrt`, `floor`, `ceil`, `round`, `sin`, `cos`,
`tan`, `asin`, `acos`, `atan`, `degToRad`, `radToDeg`

### Binary Broadcasting

| Left \ Right | Scalar | Vector | Table | None | Error |
|---|---|---|---|---|---|
| **Scalar** | Scalar | Vector | Table | Scalar(NaN) | Error |
| **Vector** | Vector | Vector* | Error | Vector(NaN) | Error |
| **Table** | Table | Error | Table** | Table(NaN) | Error |
| **None** | Scalar(NaN) | Vector(NaN) | Table(NaN) | Scalar(NaN) | Error |
| **Error** | Error | Error | Error | Error | Error |

\* Vector⊕Vector: same length required, otherwise Error.
\*\* Table⊕Table: same shape (rows × columns) required, otherwise Error.

**Applies to**: `add`, `subtract`, `multiply`, `divide`, `mod`, `greater`, `less`,
`equal`, `max`, `min`, `power`, `atan2`

### Scalar-only (not broadcast)

These ternary ops use `scalar_or_nan()` on each port:
- `clamp` (val/min/max)
- `ifthenelse` (cond/then/else)

---

## NaN Canonicalization

All op outputs are canonicalized:

- **NaN**: Any NaN variant → canonical `f64::NAN` (quiet NaN, positive)
- **Negative zero**: `-0.0` → `+0.0`
- **Infinity**: `±Inf` propagates unchanged (standard IEEE 754)

This ensures bitwise-identical results regardless of platform NaN payloads.

Applied via `canonicalize_value()` after every node evaluation.

---

## Determinism Guarantees

The engine is **fully deterministic**:

- Pure `f64` arithmetic (no random, no time-dependent ops)
- Evaluation order: topological sort (Kahn's algorithm), stable
- Same graph + same inputs → same outputs, every time
- No floating-point fast-math optimizations
- Canonicalized NaN ensures cross-platform consistency

---

## Audit Trace

### Enabling Trace

Pass `{ trace: true }` in eval options:

```javascript
const result = await engine.evaluateGraph(snapshot, { trace: true })
console.log(result.trace) // TraceEntry[]
```

### TraceEntry Format

```typescript
interface TraceEntry {
  nodeId: string
  opId: string
  inputs: Record<string, ValueSummary>
  output: ValueSummary
  diagnostics: Diagnostic[]
}

type ValueSummary =
  | { kind: 'scalar'; value: number }
  | { kind: 'vector'; length: number; sample: number[] }  // first 5 elements
  | { kind: 'table'; rows: number; columns: number }
  | { kind: 'error'; message: string }
```

### Capping Trace Size

Use `maxTraceNodes` to limit trace entries:

```javascript
const result = await engine.evaluateGraph(snapshot, {
  trace: true,
  maxTraceNodes: 50,
})
// result.trace.length <= 50
```

---

## Progress & Cancellation

### Progress Events

Subscribe to progress events from the main thread:

```javascript
const unsub = engine.onProgress((event) => {
  console.log(`${event.evaluatedNodes}/${event.totalNodesEstimate} nodes`)
  console.log(`Elapsed: ${event.elapsedMs}ms`)
})

// Later: unsub()
```

Progress events fire after each node during evaluation when using the
`*_with_options` path (i.e., when `trace` or `timeBudgetMs` is set).

### Time Budget

Set a time budget in milliseconds. The engine will cooperatively abort
evaluation when the budget is exceeded:

```javascript
const result = await engine.evaluateGraph(snapshot, {
  timeBudgetMs: 100, // 100ms budget
})

if (result.partial) {
  console.log('Evaluation was cut short — not all nodes evaluated')
}
```

### Partial Results

When evaluation is aborted (via time budget):

- `result.partial === true`
- `result.values` contains values for all nodes evaluated so far
- Un-evaluated nodes remain dirty in the persistent graph
- The next `evaluate_dirty()` call resumes from where it left off

### Cancellation

Client-side cancellation via stale-result discard:

1. `useGraphEngine` increments a `pendingRef` counter on each evaluation
2. When results arrive, they're discarded if the counter has moved on
3. The WASM worker is synchronous — it can't be interrupted mid-evaluation
4. The `cancel` worker message is a no-op placeholder for future async support

---

## EvalOptions Reference

```typescript
interface EvalOptions {
  trace?: boolean       // Collect per-node trace entries (default: false)
  maxTraceNodes?: number // Cap trace entries (default: unlimited)
  timeBudgetMs?: number  // Time budget in ms (default: 0 = no budget)
}
```

Pass to any evaluation method:

```javascript
engine.evaluateGraph(snapshot, options)
engine.loadSnapshot(snapshot, options)
engine.applyPatch(ops, options)
```

---

## Contract Version

The contract version is a monotonically increasing integer that tracks
correctness-affecting changes to engine behavior.

- Accessible at `engine.contractVersion` after engine init
- Included in the worker handshake `ready` message
- Current version: **1** (W9.3 baseline)

Bump criteria:
- Changes to broadcasting rules
- Changes to NaN/precision handling
- Changes to evaluation order
- Changes to error propagation semantics

Non-bump changes:
- Performance improvements (same results, faster)
- New ops (additive, don't change existing behavior)
- Trace/progress format changes (observability, not correctness)

---

## DevTools Quick Reference

```javascript
// Check contract version
window.__chainsolve_engine.contractVersion  // 1

// Evaluate with trace
const r = await window.__chainsolve_engine.evaluateGraph(
  { version: 1, nodes: [...], edges: [...] },
  { trace: true }
)
console.table(r.trace)

// Monitor progress
window.__chainsolve_engine.onProgress(e =>
  console.log(`${e.evaluatedNodes}/${e.totalNodesEstimate}`)
)

// Test time budget
const r2 = await window.__chainsolve_engine.evaluateGraph(
  { version: 1, nodes: [...], edges: [...] },
  { timeBudgetMs: 50 }
)
console.log('Partial?', r2.partial)
```
