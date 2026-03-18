# ChainSolve JS/TS SDK — Overview

ChainSolve exposes a TypeScript API for embedding, extending, and automating the
computation engine in your own applications.

## Architecture

```
Browser / Node
  └── src/engine/        ← WASM bridge, worker pool, diff protocol
  └── src/lib/           ← Service layer (auth, export, plugins, GPU)
  └── src/blocks/        ← Block metadata registry
        │
        ▼
  WASM (engine-core)     ← Pure Rust: all evaluation logic
```

## Quick start

### Evaluate a graph snapshot

```typescript
import { createEngine } from './src/engine'

const engine = await createEngine()
const result = await engine.evaluateSnapshot(snapshot)
console.log(result.values)
```

### One-click example graphs

```typescript
import { getExamplesByDomain, searchExamples } from './src/lib/exampleGraphs'

const mechanical = getExamplesByDomain('mechanical')
const ode = searchExamples('ODE')
```

### Hybrid CPU/GPU evaluation

```typescript
import { hybridEvaluate } from './src/lib/hybridCompute'

const result = await hybridEvaluate(snapshot, localEvalFn)
// Automatically routes to GPU or native server for large graphs
```

### Algorithm reference

```typescript
import { getAlgorithmDoc, searchAlgorithmDocs } from './src/lib/algorithmDocs'

const rk45 = getAlgorithmDoc('ode.rk45')
console.log(rk45?.equations)   // LaTeX equations
console.log(rk45?.complexity)  // { time: 'O(N)', space: 'O(1)' }
```

### WASM plugin system

```typescript
import { loadPlugin, evaluatePluginBlock } from './src/lib/pluginLoader'

const plugin = await loadPlugin('https://example.com/my-block.wasm')
const result = evaluatePluginBlock(plugin.id, 0, { x: 42.0 })
```

## Rust API

The Rust API is documented at [`../rust/engine_core/index.html`](../rust/engine_core/index.html).

Key entry points:

| Function | Description |
|---|---|
| `engine_core::run(snapshot_json)` | One-shot evaluation |
| `engine_core::run_patch(graph, patch_json)` | Incremental patch evaluation |
| `engine_core::run_load_snapshot(graph, json)` | Load + full eval |
| `engine_core::run_validate(graph)` | Pre-eval validation |

## Python SDK

The Python SDK (`crates/chainsolve-py`) wraps `engine-core` via PyO3.

```python
import chainsolve

result = chainsolve.run(snapshot_json)
print(result['values'])
```

See the [Python SDK guide](https://docs.chainsolve.dev/python) for installation and examples.
