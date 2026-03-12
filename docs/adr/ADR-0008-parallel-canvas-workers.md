# ADR-0008: Parallel Canvas Workers (Worker Pool)

**Status:** Accepted
**Date:** 2026-03-11
**Ticket:** ENG-04

---

## Context

ChainSolve supports multiple canvases within a single project (tabs). Before this change, all canvases shared a single WASM engine worker — the global "primary" engine. Switching tabs caused the previous canvas's evaluation to be interrupted (or finish and be discarded), and the new canvas had to load its snapshot from scratch into the same worker.

This is wasteful when a user switches between tabs rapidly or runs a parametric sweep on one canvas while editing another. The CPU and WASM runtime have spare capacity on multi-core machines.

Browser `navigator.hardwareConcurrency` reports logical CPU count. Spawning one worker per CPU minus one (up to 4) is a well-understood pattern (e.g. Webpack's `thread-loader`). Beyond 4 dedicated workers the overhead of context-switching and WASM instantiation cost outweighs the gain for typical graph workloads.

---

## Decision

Implement a **LRU worker pool** (`src/engine/workerPool.ts`):

- Pool size: `Math.max(1, Math.min(navigator.hardwareConcurrency - 1, 4))`
- `acquireEngine(canvasId)` — return existing engine for `canvasId`, or initialise a new one (evicting the LRU canvas when at capacity)
- `releaseCanvas(canvasId)` — move to LRU tail (lower priority for eviction)
- `evictCanvas(canvasId)` — terminate worker, free memory

`useCanvasEngine(canvasId, primaryEngine)` (hook) wraps the pool:
1. Returns `primaryEngine` immediately (no render delay).
2. Calls `pool.acquireEngine(canvasId)` async.
3. When the dedicated engine is ready, bumps `engineSwitchCount`.
4. `CanvasArea` uses `combinedEngineKey = engineKey + engineSwitchCount` as the `refreshKey` for `useGraphEngine`, forcing a snapshot reload into the new worker.

A **generation counter** in the hook rejects stale `acquireEngine` results if `canvasId` changes while the promise is in-flight.

---

## Consequences

**Positive:**
- Each open canvas evaluates in its own worker; tab-switch latency drops from cold-load (~150 ms) to near-zero (snapshot already loaded).
- Parametric sweeps and expensive graphs on one canvas do not block input on another.
- Primary engine remains as a reliable fallback — pool unavailability (e.g. COOP header absent preventing `SharedArrayBuffer`) does not break the app.

**Negative / risks:**
- Memory cost: each idle WASM worker holds ~15–25 MB resident (wasm linear memory + JS overhead). On a 4-core machine with 4 workers this is ~100 MB overhead. Acceptable for a power-user desktop app, but worth noting on low-RAM devices.
- Worker initialisation is async (~80–200 ms for WASM instantiation). The primary→dedicated engine switch fires a full snapshot reload, which causes a brief extra evaluation. The `engineSwitchCount` mechanism avoids stale values being shown during the transition.
- LRU eviction on tab switch discards the worker for the least-recently-used canvas, so returning to an evicted canvas pays cold-load cost again. Eviction only fires when the pool is at capacity.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| One shared worker for all canvases | Evaluation serialised; tab switch requires full snapshot reload |
| One worker per canvas with no LRU cap | Unbounded workers; 10-tab project → 10 WASM instances (~200 MB+) |
| SharedWorker with multiplexed canvases | SharedWorker cannot use wasm-bindgen thread-local state; would require a Mutex around `EngineGraph` |
| OffscreenCanvas + separate render threads | Out of scope; rendering is handled by React Flow on main thread |
