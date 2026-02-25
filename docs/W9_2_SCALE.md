# W9.2 — Engine Scale Upgrade

## Overview

W9.2 upgrades the Rust/WASM engine from **stateless full evaluation** to **stateful incremental
evaluation** with dirty propagation. This eliminates redundant computation for large graphs and
adds zero-copy dataset transfer for large numeric arrays.

### Key changes

| Feature | Before (W9.1) | After (W9.2) |
|---------|---------------|-------------|
| Evaluation | Full graph every time | Only dirty nodes |
| State | Stateless (rebuild topo each call) | Persistent `EngineGraph` with cached values |
| Protocol | Single `evaluate` message | `loadSnapshot`, `applyPatch`, `setInput` |
| Large data | Embedded in `node.data`, JSON-serialized | Dataset registry with `Transferable` ArrayBuffer |
| UI integration | `useEffect` + full snapshot | `useGraphEngine` hook with diff-based patching |

## Architecture

```
┌──────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│  React UI        │  msg  │  Web Worker          │  FFI  │  Rust/WASM      │
│  (main thread)   │──────▶│  src/engine/worker.ts│──────▶│  engine-core    │
│                  │◀──────│                      │◀──────│  engine-wasm    │
│  useGraphEngine  │       │  protocol v2 msgs    │       │  EngineGraph    │
│  diffGraph       │       └─────────────────────┘       │  (persistent)   │
└──────────────────┘                                      └─────────────────┘
```

## Worker Protocol v2

### Messages: Main → Worker

| Type | Fields | Description |
|------|--------|-------------|
| `evaluate` | `requestId`, `snapshot` | Stateless full eval (backward compat) |
| `loadSnapshot` | `requestId`, `snapshot` | Load into persistent graph, full eval |
| `applyPatch` | `requestId`, `ops: PatchOp[]` | Incremental patch, dirty eval |
| `setInput` | `requestId`, `nodeId`, `portId`, `value` | Set manual input, dirty eval |
| `registerDataset` | `datasetId`, `buffer` | Register large array (Transferable) |
| `releaseDataset` | `datasetId` | Remove dataset from memory |

### Messages: Worker → Main

| Type | Fields | Description |
|------|--------|-------------|
| `ready` | `catalog`, `engineVersion` | WASM initialized |
| `result` | `requestId`, `result: EvalResult` | Full evaluation result |
| `incremental` | `requestId`, `result: IncrementalEvalResult` | Incremental result (changed only) |
| `error` | `requestId`, `error` | Evaluation error |

### PatchOp types

```typescript
type PatchOp =
  | { op: 'addNode'; node: EngineNodeDef }
  | { op: 'removeNode'; nodeId: string }
  | { op: 'updateNodeData'; nodeId: string; data: Record<string, unknown> }
  | { op: 'addEdge'; edge: EngineEdgeDef }
  | { op: 'removeEdge'; edgeId: string }
```

### IncrementalEvalResult

```typescript
interface IncrementalEvalResult {
  changedValues: Record<string, EngineValue>  // only re-evaluated nodes
  diagnostics: EngineDiagnostic[]
  elapsedUs: number
  evaluatedCount: number   // nodes that were actually evaluated
  totalCount: number       // total nodes in graph
}
```

## Dirty Propagation Algorithm

1. When a node is marked dirty (data change, edge add/remove, `setInput`):
   - BFS forward through `out_adj` — all reachable descendants become dirty

2. On `evaluate_dirty()`:
   - If structure changed, rebuild topo order via Kahn's algorithm
   - Walk topo order, skip clean nodes
   - For each dirty node: gather inputs from cached values + adjacency, call `evaluate_node()`
   - Compare result with cached value using `f64::to_bits()` (handles NaN correctly)
   - If value unchanged: prune downstream nodes from dirty set (avoid unnecessary re-eval)
   - If value changed: update cache, keep downstream dirty
   - Collect changed values into `IncrementalEvalResult`

This means that if you change a slider from 5 to 5 (same value), nothing downstream gets
re-evaluated. If a node in a deep chain doesn't change its output, propagation stops there.

## Dataset Registry

Large numeric arrays (>1000 elements) can be registered with the engine to avoid repeated
JSON serialization:

```typescript
// Register (zero-copy from main thread → worker via Transferable)
engine.registerDataset('ds_nodeId', float64Array)

// Reference in node data
node.data.datasetRef = 'ds_nodeId'

// Release when node is deleted
engine.releaseDataset('ds_nodeId')
```

On the Rust side, `vectorInput` blocks check `data.datasetRef` first. If a registered dataset
exists, it's used directly (avoiding JSON parsing of large arrays). Falls back to inline
`data.vectorData` for small arrays.

## UI Integration

### useGraphEngine hook

```typescript
const computed = useGraphEngine(nodes, edges, engine)
```

Replaces the old `useEffect` + `toEngineSnapshot` + `evaluateGraph` pattern. Internally:

1. **First render**: calls `engine.loadSnapshot()` with full snapshot
2. **Subsequent renders**: calls `diffGraph()` to compute `PatchOp[]`, then `engine.applyPatch()`
3. **Result merging**: incremental results are merged into existing map (not replaced)
4. **Coalescing**: uses a pending counter to discard stale results from rapid updates

### diffGraph

```typescript
const ops = diffGraph(prevNodes, prevEdges, nextNodes, nextEdges)
```

Pure function that diffs React Flow state to produce `PatchOp[]`. Detects:
- Added/removed nodes
- Changed node data (via `JSON.stringify` comparison)
- Added/removed edges
- Ignores group nodes (`blockType === '__group__'`)
- Ignores position-only changes (position not engine-relevant)

## Files

| File | Purpose |
|------|---------|
| `crates/engine-core/src/graph.rs` | `EngineGraph` struct, dirty propagation, incremental eval |
| `crates/engine-core/src/types.rs` | `IncrementalEvalResult` type |
| `crates/engine-core/src/ops.rs` | `evaluate_node_with_datasets()` — dataset registry support |
| `crates/engine-wasm/src/lib.rs` | WASM bindings: `load_snapshot`, `apply_patch`, `set_input`, `register/release_dataset` |
| `src/engine/wasm-types.ts` | `PatchOp`, `IncrementalEvalResult`, updated `WorkerRequest/Response` |
| `src/engine/worker.ts` | Protocol v2 message handlers |
| `src/engine/index.ts` | Extended `EngineAPI` with new methods |
| `src/engine/diffGraph.ts` | React Flow state diff → `PatchOp[]` |
| `src/engine/useGraphEngine.ts` | Incremental evaluation hook for CanvasArea |

## Performance Characteristics

| Scenario | Before (W9.1) | After (W9.2) |
|----------|---------------|-------------|
| Slider drag on 100-node graph | Eval all 100 nodes per frame | Eval slider node + downstream only |
| Add node to 50-node graph | Eval all 51 nodes | Eval new node only |
| Change data on leaf node | Eval all nodes | Eval 1 node |
| Same value assigned | Eval all nodes | Eval 1 node, prune downstream |
| 10K vector in vectorInput | 10K elements JSON-serialized per eval | Registered once via Transferable |
