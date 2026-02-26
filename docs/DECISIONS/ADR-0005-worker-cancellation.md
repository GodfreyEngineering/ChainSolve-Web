# ADR-0005 — Worker Cancellation Strategy

**Status:** Accepted
**Date:** 2026-02-26
**Milestone:** W9.9 Performance + Scale Guardrails

---

## Context

ChainSolve runs the WASM compute engine in a dedicated Web Worker to keep the
main thread responsive. Two problems emerged as graphs grow large:

1. **Interactive eval blocking**: A 10 000-node graph can take seconds to
   evaluate. While WASM runs synchronously inside the worker, the main thread
   remains responsive, but the worker becomes unresponsive to new requests.

2. **WASM hang**: Pathological graphs (or Rust bugs) can cause WASM to loop
   indefinitely, permanently blocking the worker.

We needed a strategy for:
- Returning partial results quickly for interactive use
- Recovering from a completely stuck worker

---

## Options Considered

### Option A: Cooperative cancellation only (timeBudgetMs)

The Rust engine supports `EvalOptions.time_budget_ms`. When the elapsed time
exceeds this value in the progress callback, evaluation returns `partial: true`
with the nodes evaluated so far.

**Pros:**
- Simple, no worker lifecycle complexity
- Partial results are useful (user sees some values immediately)
- Tested and working in CI

**Cons:**
- Doesn't handle WASM infinite loops (progress callback never fires)
- Doesn't handle `load_snapshot` hangs (no budget on first load by design)

### Option B: Terminate on every cancel

Terminate the worker immediately when the main thread sends `cancel`. Recreate
for each new request.

**Pros:**
- Guaranteed cancellation
- Simple to reason about

**Cons:**
- WASM JIT compilation cost (~1–3 s on first load) on every recreation
- Loss of all worker-side state (dataset registry, compiled WASM module)
- Very disruptive for the UX

### Option C: timeBudgetMs + 5-second watchdog (chosen)

Apply a 300 ms time budget to all interactive `applyPatch` calls. Add a
5-second watchdog timer that hard-kills and recreates the worker only when no
response arrives within the timeout.

**Pros:**
- Best UX: 300 ms budget returns partial results quickly for large graphs
- Catastrophic hang recovery: 5 s watchdog ensures the canvas always recovers
- Worker recreation is rare (only on genuine WASM hang)
- Snapshot cache allows automatic worker state restoration after recreation
- No false positives: 5 s is far beyond any normal eval time

**Cons:**
- After a watchdog recovery, the canvas shows stale values until the next
  user interaction triggers re-evaluation
- Two failure modes (timeBudget vs watchdog) to document and reason about

---

## Decision

**Option C** — cooperative `timeBudgetMs: 300` on `applyPatch` + 5-second
watchdog that terminates and recreates the worker.

---

## Implementation

### timeBudgetMs: 300

Applied in `src/engine/useGraphEngine.ts` for all `applyPatch` calls:

```typescript
engine.applyPatch(ops, { timeBudgetMs: 300, ...options })
```

Callers can override by passing a higher `timeBudgetMs` in `options`.
`loadSnapshot` (first load) has no budget — it must complete fully to populate
initial canvas state.

### 5-second watchdog

Implemented in `src/engine/index.ts`:

```typescript
function startWatchdog(requestId) {
  clearWatchdog()
  watchdogTimer = setTimeout(() => {
    console.warn(`[cs:engine] Watchdog fired — requestId=${requestId}, recreating worker`)
    void doRecreate()
  }, WATCHDOG_TIMEOUT_MS /* 5000 ms */)
}
```

The watchdog is started before each eval request and cleared on any response
(including `error` and `stats`).

### recreateWorker (doRecreate)

`doRecreate()` in `src/engine/index.ts`:
1. Clears the watchdog
2. Terminates the old worker (`worker.terminate()`)
3. Rejects all pending requests with `[WORKER_WATCHDOG]` error
4. Creates a new Worker via the stored factory
5. Waits for the new worker's `ready` message (10 s timeout)
6. Calls `loadSnapshot` with the cached snapshot args to restore worker state

### Snapshot cache

`lastSnapshotArgs` stores the snapshot and options from the last `loadSnapshot`
call. After recreation, this is used to restore the worker's engine state.

### Worker-side seq tracking (defence-in-depth)

`src/engine/worker.ts` tracks `latestEvalSeq`. When `cancel` is received,
`latestEvalSeq` is set to `Number.MAX_SAFE_INTEGER`. Any applyPatch that was
already queued (before the cancel was processed) checks `patchSeq !== latestEvalSeq`
after WASM returns and discards its result if the seq was invalidated.

In practice, WASM is synchronous so no cancel can arrive while WASM is
running. The seq check handles the edge case where cancel + eval are both
queued and cancel is processed first. The main thread's `pendingRef` coalescing
in `useGraphEngine.ts` provides the primary stale-result guard.

---

## Consequences

**Positive:**
- Canvas never permanently stuck on large graphs
- 300 ms budget gives fast interactive feedback for moderate graphs
- Worker recreation is rare and automatic
- All protocol behavior tested in `src/engine/jobManager.test.ts`

**Negative:**
- After watchdog fires, canvas shows stale values until next user interaction
- Worker recreation has a ~1–5 s "warmup" cost (WASM re-init + snapshot reload)
- The 5 s watchdog will fire spuriously if someone evaluates a 50 000-node
  graph (the time budget + watchdog interact: 300 ms budget on patches, no
  budget on loadSnapshot which is what the watchdog typically guards)

**Future work:**
- Once WASM shared-memory/thread support matures in browsers, true cooperative
  cancellation via `Atomics.store` could replace the `timeBudgetMs` approach
- The snapshot cache could be extended to save dataset registrations (currently
  lost on recreation)
- Expose `watchdogFired` event in `EngineAPI` so the UI can show a recovery
  notification to the user
