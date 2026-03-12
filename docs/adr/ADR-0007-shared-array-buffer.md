# ADR-0007: SharedArrayBuffer for Zero-Copy Dataset Transfer

**Status:** Accepted
**Date:** 2026-03-11
**Ticket:** ENG-02

---

## Context

ChainSolve allows users to upload large CSV or tabular datasets and wire them into the computation graph. Before this change, each time a dataset was registered with the WASM engine worker the Float64 data was serialised via structured-clone — an O(N) memory copy on both the sender and receiver side. For a 500 000-row dataset (~4 MB of Float64 values) this copy was visible as a ~40 ms stall on the main thread.

The Web platform provides two mechanisms for zero-copy data sharing with workers:

1. **Transferable `ArrayBuffer`** — transfers ownership to the worker; the sender can no longer access the buffer. Zero-copy but one-way.
2. **`SharedArrayBuffer` (SAB)** — both main thread and worker map the same memory region. Requires COOP + COEP headers to be active (`crossOriginIsolated === true`).

SAB is strictly better for datasets that may be reused or reloaded across engine restarts (e.g. pool worker eviction + re-acquire), because ownership is not transferred.

However, `SharedArrayBuffer` was disabled by default in all browsers after the Spectre/Meltdown disclosure (2018) and is only re-enabled when the page opts in to cross-origin isolation via response headers.

---

## Decision

**Detect `crossOriginIsolated` at runtime and branch:**

```ts
if (typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated) {
  // Zero-copy: allocate SAB, write once, send reference
  const sab = new SharedArrayBuffer(data.byteLength)
  new Float64Array(sab).set(...)
  worker.postMessage({ ..., buffer: sab })
} else {
  // Transfer: copy into plain ArrayBuffer, transfer ownership
  const buffer = data.buffer.slice(...)
  worker.postMessage({ ..., buffer }, [buffer])
}
```

Add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to `public/_headers` for all routes so that production deployments on Cloudflare Pages get `crossOriginIsolated === true`.

The `WorkerRequest` type for `registerDataset` accepts `ArrayBuffer | SharedArrayBuffer` to document both paths at the type level.

---

## Consequences

**Positive:**
- Datasets > 1 MB are transferred to workers in ~0 ms (SAB path) rather than ~N/8 µs per MB.
- When a pool worker is evicted and a new one re-registered, re-sending the dataset is cheap.
- Fallback path ensures the feature still works on non-isolated origins (localhost without COOP/COEP, iframes, older browser configs).

**Negative / risks:**
- COOP breaks `window.opener` references. Any OAuth popup flow that relies on `window.opener.postMessage` must be tested after adding the headers.
- COEP blocks sub-resources (iframes, images) that do not send `Cross-Origin-Resource-Policy: cross-origin`. Third-party embeds (e.g. Stripe Elements) must be verified to work.
- `SharedArrayBuffer` requires the worker to not mutate the buffer after the main thread has read it. The current protocol treats datasets as immutable after registration, which upholds this invariant.

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Always use `ArrayBuffer` transfer | 40 ms stall on large datasets; re-upload required after worker restart |
| `Atomics` + SAB for live streaming | Premature; datasets are batch-loaded, not streamed |
| OPFS (Origin Private File System) | Complex, async, no performance advantage for in-memory graphs |
