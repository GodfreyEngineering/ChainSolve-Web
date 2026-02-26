# Memory Management

> W9.9 | Added 2026-02-26

Reference for memory management in ChainSolve's engine + Worker layer.
Covers dataset disposal, worker lifecycle, and leak detection.

---

## Dataset disposal

Datasets (large `Float64Array` values from CSV import or `vectorInput` blocks)
are registered in the WASM engine's `DatasetRegistry`. They are stored
as `Vec<f64>` on the Rust heap and persist until explicitly released.

### Registration

```typescript
engine.registerDataset('ds_abc123', float64Array)
// → worker.ts: register_dataset(id, arr) → stored in WASM engine
```

Transfer uses `ArrayBuffer` detach (zero-copy):
```typescript
worker.postMessage({ type: 'registerDataset', datasetId: id, buffer }, [buffer])
// After transfer, the original Float64Array is detached (empty)
```

### Release

```typescript
engine.releaseDataset('ds_abc123')
// → worker.ts: release_dataset(id) → removed from WASM HashMap
```

**Important:** `releaseDataset` must be called when a `DataNode` unmounts.
This is handled in `src/components/canvas/nodes/DataNode.tsx` via `useEffect`
cleanup:
```typescript
useEffect(() => {
  engine.registerDataset(id, data)
  return () => engine.releaseDataset(id)  // ← unmount cleanup
}, [id, data])
```

If cleanup is missing, datasets accumulate on the WASM heap indefinitely.
Use `engine.getStats()` to audit:
```typescript
const { datasetCount, datasetTotalBytes } = await engine.getStats()
```

### Checking for leaks

```javascript
// Browser console:
const stats = await window.__cs_engine?.getStats()
console.log(stats)
// → { datasetCount: 2, datasetTotalBytes: 16000000 }  // 2 datasets, 16 MB
```

Expected: `datasetCount` matches the number of visible DataNodes on the canvas.
If it grows without bound, a dataset is not being released on unmount.

---

## Worker lifecycle

### Normal lifecycle

```
createEngine() called
  → new Worker() created
  → wait for 'ready' (WASM init)
  → EngineAPI returned
    ↓
User interactions → applyPatch / loadSnapshot calls
    ↓
engine.dispose()
  → worker.terminate()
  → all pending rejected
  → EngineAPI unusable
```

### Watchdog recreation (W9.9)

```
Eval request sent + watchdog timer started (5 s)
    ↓ (no response within 5 s)
doRecreate() called:
  → old worker terminated
  → pending rejected with [WORKER_WATCHDOG]
  → new Worker() created
  → wait for 'ready' (WASM re-init, ~1–3 s)
  → snapshot cache reloaded via loadSnapshot
  → EngineAPI continues to work
```

After recreate, `datasetCount` will be 0 (datasets are NOT preserved across
worker recreation). DataNodes will need to re-register their datasets on the
next render. This happens automatically when DataNode's `useEffect` fires after
the component re-renders in response to the rejected eval promise.

---

## Measuring JS heap

For debugging memory growth, use Chrome's heap snapshot:

1. Open DevTools → Memory tab
2. Take a heap snapshot ("Take Snapshot" button)
3. Interact with a large canvas (add many nodes, load large CSVs)
4. Take another snapshot
5. Switch to "Comparison" view to see allocations

Common sources of JS heap growth:
- `perfMetrics.ts` `current` snapshot — tiny (1 object, < 1 KB)
- `perf/marks.ts` ring buffer — capped at 30 entries, < 3 KB
- React Flow node positions — proportional to node count
- Observable event buffer — capped at 20 events (`getErrorBuffer()`)

### `performance.measureUserAgentSpecificMemory()` (feature-detect)

```javascript
// Chrome 89+ only. Only works in cross-origin isolated pages.
if ('measureUserAgentSpecificMemory' in performance) {
  const mem = await performance.measureUserAgentSpecificMemory()
  console.log(mem.bytes, mem.breakdown)
}
```

ChainSolve's `doctor.ts` includes a `checkMemory` check (dev-only) that
calls this API if available and logs the result.

---

## Ring buffers and bounded structures

| Structure | Location | Bound | Purpose |
|-----------|----------|-------|---------|
| Error buffer | `src/observability/client.ts` | 20 events | Recent errors for /diagnostics |
| Perf measures ring buffer | `src/perf/marks.ts` | 30 measures | User Timing export |
| Offline obs queue | `src/observability/client.ts` | 20 events | Retry queue |
| Breadcrumbs | `src/observability/client.ts` | 20 items | Pre-error context |

All are bounded and never flush to the server automatically.

---

## Production considerations

- WASM memory is allocated in a single `WebAssembly.Memory` buffer (default 16 MB,
  grows on demand). Each 64 KB page can be grown but never shrunk — releasing
  datasets frees Rust allocations but does not shrink the WASM memory buffer.
- For very large datasets (> 100 MB), watch for browser memory pressure
  warnings. The recommended approach is to keep large CSVs on the server and
  load only what's needed for the current canvas.
- Worker recreation resets the entire WASM memory; this IS a way to fully
  reclaim leaked WASM heap at the cost of re-initializing everything.
