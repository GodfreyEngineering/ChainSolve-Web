# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ChainSolve Web is a browser-based visual computation platform. Users wire together blocks on a canvas; a Rust/WASM engine evaluates the graph in a Web Worker and results appear in real time. Stack: Vite 7 + React 19 + TypeScript 5.9 (strict), Rust/WASM compute engine, Supabase (auth + DB), Stripe (billing), Cloudflare Pages (hosting + Functions).

## Setup

```bash
npm ci
npm run wasm:build:dev   # compile Rust → WASM (debug; required before first dev start)
npm run dev              # http://localhost:5173
```

Without a `.env` with real Supabase credentials, auth fails silently — fine for local UI work.

## Key commands

```bash
# Development
npm run dev                   # Vite dev server
npm run wasm:build:dev        # Fast debug WASM build

# Build
npm run build                 # Full: wasm:build + tsc + vite build
npm run wasm:build            # Release WASM build only

# Code quality
npm run format                # Prettier write
npm run format:check          # Prettier check (CI gate)
npm run lint                  # ESLint check
npm run lint:fix              # ESLint auto-fix
npm run typecheck             # wasm:build + tsc (app)
npm run typecheck:functions   # tsc for Cloudflare Functions only

# Testing
npm run test:unit             # Vitest unit tests
npm run test:coverage         # Unit test coverage report
npm run test:e2e:smoke        # Smoke suite (~30 s, mirrors CI)
npm run test:e2e              # Full Playwright suite
npm run test:e2e:ui           # Playwright UI mode

# Rust / WASM
cargo test --workspace        # All Rust tests
cargo test -p engine-core     # engine-core only
cargo bench -p engine-core    # Criterion benchmarks

# Verification
npm run verify:fast           # Quick checks (no cargo/wasm) — use before every push
npm run verify:ci             # Full CI-equivalent pipeline — use before merging
```

To check flakiness before merging engine changes:
```bash
CI=true npx playwright test --project=smoke --repeat-each=5
```

## Architecture

### Data flow

1. User edits canvas → React Flow nodes/edges updated in `CanvasArea.tsx`
2. `useGraphEngine` hook diffs the graph → produces `PatchOp[]` via `src/engine/diffGraph.ts`
3. Patch is sent to a Web Worker via `postMessage`
4. Worker (`src/engine/worker.ts`) applies patch and runs incremental evaluation via the WASM engine
5. Results posted back → `ComputedContext` updates → UI re-renders

### Layer boundaries (enforced by ESLint adapter-boundary rule)

- `src/components/` — React UI; **cannot** import `src/lib/supabase` directly
- `src/lib/` — Service layer; all Supabase/Stripe calls live here
- `src/engine/` — WASM bridge, worker, diff logic, value types
- `src/blocks/` — Block definitions (metadata + port schemas); no evaluation logic
- `src/stores/` — Zustand stores (project metadata, variables, published outputs)
- `src/contexts/` — React Contexts (engine API, plan/entitlements, theme, canvas settings)
- `functions/` — Cloudflare Pages Functions (server-side: Stripe webhooks, CSP reports)

### Rust/WASM engine

- `crates/engine-core/` — Pure Rust: graph structure, value types (Scalar/Vector/Table), ~100+ ops, validation
- `crates/engine-wasm/` — wasm-bindgen bindings; persistent `EngineGraph` via thread-local storage
- Protocol: snapshot load on first render, then incremental patches. Watchdog restarts worker after 5 s hang.
- `ENGINE_CONTRACT_VERSION` in `crates/engine-core/src/catalog.rs` versions the evaluation contract.

### Worker pool (ENG-04)

Each open canvas gets a dedicated WASM Web Worker from the pool (`src/engine/workerPool.ts`). Pool size is `min(navigator.hardwareConcurrency - 1, 4)`, minimum 1.

- `src/engine/workerPool.ts` — LRU pool; `acquireEngine(canvasId)` / `releaseCanvas(canvasId)` / `evictCanvas(canvasId)`
- `src/contexts/WorkerPoolContext.ts` — React context exposing the pool
- `src/hooks/useCanvasEngine.ts` — per-canvas hook; falls back to global primary engine while dedicated engine initialises
- `CanvasArea.tsx` uses `combinedEngineKey = engineKey + engineSwitchCount` so `useGraphEngine` reloads its snapshot when the primary → dedicated engine transition happens

The **primary engine** (global singleton, always ready) handles the first render of every canvas. Once the pool gives back a dedicated engine, `engineSwitchCount` increments and a full snapshot reload fires.

### Dataset transfer (ENG-02)

`registerDataset()` in `src/engine/index.ts` detects `crossOriginIsolated` at runtime:
- **COOP+COEP active** → allocates a `SharedArrayBuffer` and writes the Float64 data once, zero-copy to the worker.
- **Not isolated** → copies data into a plain `ArrayBuffer` and *transfers* it (structured-clone transfer, still zero-copy but one-way).

The required COOP/COEP response headers live in `public/_headers` (see Hard Invariant #5 below).

### Block system

Blocks are defined in `src/blocks/` as metadata (`BlockDef`) with port schemas — no evaluation. The Rust engine owns all computation. `src/blocks/registry.ts` is the master registry.

## Code style

- **TypeScript**: `singleQuote: true`, `semi: false`, `tabWidth: 2` (Prettier). Strict mode: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Use `import type` for type-only imports.
- **Rust**: Edition 2021, standard `cargo fmt` defaults.

## Hard invariants — do not break

### 1. Engine contract versioning
When changing anything affecting engine evaluation (broadcasting, error propagation, value semantics):
1. Bump `ENGINE_CONTRACT_VERSION` in `crates/engine-core/src/catalog.rs`
2. Update the expected version in `src/engine/index.ts` (search `contractVersion`)
3. Document in `docs/W9_3_CORRECTNESS.md`

### 2. CSP must keep `'wasm-unsafe-eval'`
Both `Content-Security-Policy` lines in `public/_headers` must include `'wasm-unsafe-eval'` in `script-src`. Without it, `WebAssembly.instantiateStreaming()` is blocked and the engine fails to load.

### 3. CI two-build strategy
`VITE_IS_CI_BUILD=true` suppresses the `CONFIG_INVALID` guard in `src/lib/supabase.ts`. It is set only for the `node_checks` (PR) job — **never** for the `deploy` job. Setting it in deploy will send placeholder credentials to production silently.

### 4. Migrations are append-only
`supabase/migrations/` is a numbered, append-only history. Never edit or delete an existing migration file. Create a new numbered migration to fix a past one.

### 5. COOP+COEP headers must stay in `public/_headers`
The `/*` section in `public/_headers` must include:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
Without these, `crossOriginIsolated` is `false`, `SharedArrayBuffer` is unavailable, and dataset transfer falls back to ArrayBuffer copy. Never remove them.

## CI structure

| Trigger | Jobs |
|---------|------|
| PR to `main` | `rust_tests` + `node_checks` (typecheck + lint + format + build with placeholder creds) |
| Push to `main` | above + `e2e_smoke` (10 Playwright tests) + `deploy` |
| Manual (`workflow_dispatch`) | Full E2E suite (`e2e-full.yml`) or Performance suite (`perf.yml`) |

Playwright does **not** run on PRs — only after merge to `main`, as a pre-condition for deploy.

## Bundle size budgets (enforced by CI)

| Metric | Budget |
|--------|--------|
| Initial JS (gzip) | 300 KB |
| WASM (raw) | 800 KB |
| WASM (gzip) | 250 KB |

JS budget tightened (UI-PERF-05 target): use `React.lazy()` for heavy components (Settings, block descriptions, vega-lite, KaTeX, AI Copilot, exceljs). WASM budgets updated (ENG-09): switched wasm-opt from `-Oz` (size) to `-O3` (speed). Larger binary is acceptable for better runtime performance.

Use `React.lazy()` to keep new components out of the initial load. Run `npm run perf:bundle` after a build to check locally.

## Pre-commit hook (recommended)

```bash
git config core.hooksPath .githooks
```

Runs `format:check` and `lint` on every commit.
