# W9 — Deterministic Rust/WASM Compute Engine

## Overview

W9 introduces a **single compute engine** written in Rust, compiled to WebAssembly,
and executed in a Web Worker.

**W9.1** made Rust/WASM the **sole evaluation path** — the TypeScript evaluation
engine (`evaluate.ts`) has been removed. If the WASM engine fails to initialize, the
app shows a fatal error screen with retry. There is no silent TS fallback.

### Architecture

```
┌──────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│  React UI        │  msg  │  Web Worker          │  FFI  │  Rust/WASM      │
│  (main thread)   │──────▶│  src/engine/worker.ts│──────▶│  engine-core    │
│                  │◀──────│                      │◀──────│  engine-wasm    │
│  src/engine/     │       │  loads & calls WASM  │       │  crates/        │
│  index.ts        │       └─────────────────────┘       └─────────────────┘
└──────────────────┘
```

The boundary is JSON strings: the worker serializes the graph snapshot to JSON,
passes it to the WASM `evaluate()` function, and deserializes the result.

### Crate structure

| Crate | Path | Purpose |
|-------|------|---------|
| `engine-core` | `crates/engine-core/` | Pure Rust: types, validation, evaluation, ops. No web/wasm deps. |
| `engine-wasm` | `crates/engine-wasm/` | wasm-bindgen wrapper. Thin JSON boundary over engine-core. |

### TS integration files

| File | Purpose |
|------|---------|
| `src/engine/index.ts` | Public API: `createEngine()` → `EngineAPI` with `evaluateGraph()`, `catalog`, `engineVersion` |
| `src/engine/worker.ts` | Web Worker entry. Loads WASM, handles messages, sends catalog on ready. |
| `src/engine/wasm-types.ts` | Shared TypeScript types for worker messages, engine I/O, and `CatalogEntry`. |
| `src/engine/bridge.ts` | Converts React Flow graph → `EngineSnapshotV1`. |
| `src/engine/wasm.d.ts` | Type declarations for wasm-pack output. |
| `src/engine/value.ts` | Value type system + `formatValue()` for display nodes. |
| `src/contexts/EngineContext.ts` | React context providing `EngineAPI` to components via `useEngine()`. |
| `src/components/EngineFatalError.tsx` | Full-screen error shown when WASM fails, with retry + reload. |

## Prerequisites

- **Rust** (stable channel) with `wasm32-unknown-unknown` target
- **wasm-pack** (`cargo install wasm-pack` or `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`)

The `rust-toolchain.toml` at the repo root ensures the correct target is installed.

## Building

```bash
# Build WASM (required before npm build/dev)
npm run wasm:build            # release (optimized, ~small)
npm run wasm:build:dev        # debug (fast compile, larger)

# Full build (wasm + typecheck + vite)
npm run build

# Run Rust tests
npm run wasm:test
# or
cargo test --workspace
```

## Local development

```bash
# First time: build WASM
npm run wasm:build

# Then start dev server as usual
npm run dev
```

The WASM engine initializes asynchronously on app boot in `main.tsx`. The React
tree is not rendered until the engine is ready. If initialization fails, a
full-screen `EngineFatalError` component is shown with retry and reload buttons.
There is **no TypeScript fallback** — the app requires WASM.

## Debugging

### Worker/WASM issues

1. **WASM fails to load**: Check browser console for `[engine] WASM engine unavailable`.
   Run `npm run wasm:build` and restart the dev server.

2. **Worker errors**: Open DevTools → Sources → look for the worker thread.
   The worker posts structured error messages with codes.

3. **Rust panics**: `console_error_panic_hook` is installed, so panics show
   a full backtrace in the browser console.

4. **JSON serialization mismatch**: The Rust types use `#[serde(rename_all = "camelCase")]`
   to match JavaScript conventions. If you add a field, ensure the casing matches
   in both `wasm-types.ts` and the Rust struct.

### Inspecting the engine from DevTools

The engine is exposed on `window.__chainsolve_engine` in all environments:

```javascript
// In the browser console:
const result = await window.__chainsolve_engine.evaluateGraph({
  version: 1,
  nodes: [
    { id: 'a', blockType: 'number', data: { value: 10 } },
    { id: 'b', blockType: 'number', data: { value: 20 } },
    { id: 'c', blockType: 'add', data: {} },
  ],
  edges: [
    { id: 'e1', source: 'a', sourceHandle: 'out', target: 'c', targetHandle: 'a' },
    { id: 'e2', source: 'b', sourceHandle: 'out', target: 'c', targetHandle: 'b' },
  ],
})
console.log(result.values.c)  // { kind: 'scalar', value: 30 }
```

## Extending operations

To add a new block type:

1. **Add the op** in `crates/engine-core/src/ops.rs` → `evaluate_node()` match block.
2. **Add catalog entry** in `crates/engine-core/src/catalog.rs` → `catalog()` function.
3. **Add a test** in the ops.rs `#[cfg(test)]` module.
4. **Run tests**: `cargo test --workspace`
5. **Rebuild WASM**: `npm run wasm:build`
6. **Register in TS** in `src/blocks/registry.ts` (or a block-pack file) with `reg()` — metadata only, no evaluate function.
7. On app boot, `validateCatalog()` will log a warning if the TS registry and Rust catalog are out of sync.

### Input port conventions

| Block kind | Input ports |
|-----------|-------------|
| Unary ops (sin, abs, negate, ...) | `a` |
| Binary ops (add, multiply, ...) | `a`, `b` |
| Power | `base`, `exp` |
| Atan2 | `y`, `x` |
| Clamp | `val`, `min`, `max` |
| If/Then/Else | `cond`, `then`, `else` |
| Deg→Rad | `deg` |
| Rad→Deg | `rad` |
| Display | `value` |
| Sources (number, slider, constants) | none (read from `data`) |
| Data (vectorInput, tableInput, csvImport) | none (read from `data`) |
| Vector ops (length, sum, mean, ...) | `vec` |
| Vector ops (slice) | `vec`, `start`, `end` |
| Vector ops (concat) | `a`, `b` |
| Vector ops (map/scalar multiply) | `vec`, `scalar` |
| Table ops (filter, sort, column) | `table`, `col`, optional `threshold` |
| Table ops (addColumn) | `table`, `vec` |
| Table ops (join) | `a`, `b` |
| Plot blocks | `data` |

## EngineSnapshotV1 schema

```typescript
interface EngineSnapshotV1 {
  version: 1
  nodes: Array<{
    id: string
    blockType: string
    data: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    sourceHandle: string
    target: string
    targetHandle: string
  }>
}
```

## EvalResult schema

```typescript
interface EvalResult {
  values: Record<string, Value>       // computed value per node
  diagnostics: Diagnostic[]           // warnings/errors
  elapsedUs: number                   // wall-clock microseconds
}

type Value =
  | { kind: 'scalar'; value: number }
  | { kind: 'vector'; value: number[] }
  | { kind: 'table'; columns: string[]; rows: number[][] }
  | { kind: 'error'; message: string }

interface Diagnostic {
  nodeId?: string
  level: 'info' | 'warning' | 'error'
  code: string                        // e.g. "CYCLE_DETECTED", "UNKNOWN_BLOCK"
  message: string
}
```

## Ops Catalog (W9.1)

The Rust engine exports a canonical **ops catalog** — the single source of truth for
all block metadata. The catalog is returned in the worker handshake `ready` message
and available at `engine.catalog` and `window.__chainsolve_engine.catalog`.

Each `CatalogEntry` contains: `opId`, `label`, `category`, `nodeKind`, `inputs[]`
(port id + label), and `proOnly` flag.

On boot, `validateCatalog()` in `src/blocks/registry.ts` cross-checks the TS
registry against the Rust catalog and logs warnings for any drift.

```javascript
// DevTools console:
window.__chainsolve_engine.catalog       // array of 57+ entries
window.__chainsolve_engine.engineVersion // e.g. "0.1.0"
```

## Worker handshake protocol

1. Main thread creates worker → worker loads WASM via `initWasm()`
2. Worker sends `{ type: 'ready', catalog: CatalogEntry[], engineVersion: string }`
3. Main thread resolves `createEngine()` promise and provides `EngineAPI`
4. If init fails, worker sends `{ type: 'init-error', error: { code, message } }`
5. Main thread shows `EngineFatalError` screen with retry button

## portOverrides / manualValues

The Rust engine supports the same manual-value system as the former TS engine:

- `data.manualValues: Record<string, number>` — per-port manual scalar values
- `data.portOverrides: Record<string, boolean>` — when `true`, use manual value even if port is connected

This allows users to set manual input values on disconnected ports and override
connected port values via the Inspector panel.

## W9.1 changes (TS engine removal)

Completed in W9.1:

- Removed `src/engine/evaluate.ts` (TS evaluation engine)
- Removed `evaluate` field from `BlockDef` interface
- Removed `wrapScalarEvaluate()` adapter from registry
- Block definitions in registry are metadata-only (no evaluate functions)
- `CanvasArea.tsx` evaluates via async `engine.evaluateGraph()` + `useEffect`
- `main.tsx` gates entire React tree on engine readiness via `EngineContext`
- Fatal error screen (`EngineFatalError.tsx`) shown if WASM init fails
- All `formatValue` imports point to `engine/value.ts` directly
- Added 22 missing block implementations (data, vector, table, plot)
- Fixed all port name mismatches between Rust and TS
- Added portOverrides/manualValues support to Rust evaluator

## W9.2 changes (Engine Scale Upgrade)

Completed in W9.2:

- Added persistent `EngineGraph` struct with dirty tracking and incremental evaluation
- Worker protocol v2: `loadSnapshot`, `applyPatch`, `setInput`, `registerDataset`, `releaseDataset`
- `IncrementalEvalResult` returns only changed values (evaluated_count vs total_count)
- Dirty propagation via BFS forward through adjacency list
- Value-unchanged pruning: if a node produces the same output, downstream nodes are skipped
- Dataset registry for zero-copy transfer of large Float64Arrays via `Transferable`
- `useGraphEngine` hook replaces manual `useEffect` + snapshot evaluation in CanvasArea
- `diffGraph` function diffs React Flow state into `PatchOp[]` for incremental updates
- `evaluate_node_with_datasets()` checks `data.datasetRef` before inline data
- WASM-side persistent state via `thread_local!` + `RefCell<Option<EngineGraph>>`

See [W9_2_SCALE.md](W9_2_SCALE.md) for full architecture details.
