# W9 — Deterministic Rust/WASM Compute Engine

## Overview

W9 introduces a **single compute engine** written in Rust, compiled to WebAssembly,
and executed in a Web Worker. This replaces the TypeScript evaluation engine with a
deterministic, high-performance alternative that runs off the main thread.

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
| `src/engine/index.ts` | Public API: `createEngine()` → `EngineAPI` with `evaluateGraph()` |
| `src/engine/worker.ts` | Web Worker entry. Loads WASM, handles messages. |
| `src/engine/wasm-types.ts` | Shared TypeScript types for worker messages + engine I/O. |
| `src/engine/bridge.ts` | Converts React Flow graph → `EngineSnapshotV1`. |
| `src/engine/wasm.d.ts` | Type declarations for wasm-pack output. |

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

The WASM engine initializes asynchronously on app boot. If the WASM files are
missing (e.g. you haven't run `wasm:build`), the engine logs a warning and the
existing TypeScript engine continues to serve the UI. No features break.

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

To add a new block type to the Rust engine:

1. **Add the case** in `crates/engine-core/src/ops.rs` → `evaluate_node()` match block.
2. **Add a test** in the same file's `#[cfg(test)]` module.
3. **Run tests**: `cargo test --workspace`
4. **Rebuild WASM**: `npm run wasm:build`
5. No changes needed in the WASM wrapper or TS layer.

### Input port conventions

| Block kind | Input ports |
|-----------|-------------|
| Unary ops (sin, abs, negate, ...) | `in` |
| Binary ops (add, multiply, ...) | `a`, `b` |
| Special (clamp) | `in`, `min`, `max` |
| Special (ifThenElse) | `cond`, `then`, `else` |
| Display | `in` |
| Sources (number, slider, constants) | none (read from `data`) |

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

## Migration plan (TS engine removal)

The TypeScript engine (`src/engine/evaluate.ts`) remains active during W9.
Once all block types have Rust implementations and golden tests confirm parity:

1. Wire `CanvasArea` to call `evaluateGraph()` via the WASM engine API
2. Remove `src/engine/evaluate.ts` and `wrapScalarEvaluate()` adapter
3. Remove block `evaluate` functions from the registry (keep metadata only)
4. Delete the bridge compatibility layer
5. Update `ComputedContext` to consume WASM results directly

This is tracked in W10+.
