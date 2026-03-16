# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project stage: PRE-RELEASE / ACTIVE DEVELOPMENT

**There are zero active users.** This app has not been publicly released. We are building toward a v1.0 launch.

**What this means for you (Claude):**

- **You have full authority and autonomy.** Edit, delete, refactor, rewrite, restructure anything — code, schemas, migrations, workflows, tests, entire subsystems. There is no backwards-compatibility constraint. No API contract is sacred. No migration history needs preserving. No user data exists to migrate.
- **Make big, bold changes when they improve the product.** Don't patch around bad foundations — rip them out and rebuild properly. The goal is to ship a rock-solid v1.0, not to preserve the current state.
- **Supabase schema is fully mutable.** Drop tables, rename columns, rewrite migrations from scratch, restructure RLS policies — whatever produces the cleanest schema. There are no deployed databases with user data.
- **CI/CD workflows are fully mutable.** Rewrite, consolidate, or delete workflows as needed.
- **Tests can be rewritten or restructured freely.** Change test infrastructure, frameworks, fixture formats, golden files — whatever makes the test suite most effective.

**Core pillars (in priority order):**

1. **Performance** — The engine must be fast. The UI must be responsive. Bundle sizes must stay within budget. Lazy-load aggressively. Zero wasted renders.
2. **Accuracy** — Computation results must be scientifically correct. NaN handling, broadcasting, deterministic evaluation, CODATA constants — no compromises on correctness.
3. **UI/UX** — The interface must be intuitive, polished, and delightful. Clean visual design, smooth interactions, helpful error states, accessible.

**When v1.0 launches (you'll be told explicitly),** the rules flip: minimal edits, always backwards-compatible, incremental versioning, migration safety, deprecation cycles. Until then, build the best possible foundation.

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

### verify:fast vs verify:ci

**`verify:fast`** (pre-push) — no wasm-pack/cargo needed: lockfile sync, npm audit, Prettier, ESLint, WASM export guard, tsc (app + functions), vitest.

**`verify:ci`** (full CI) — everything above plus: wasm-pack release build, wasm-opt, cargo test, Vite build, bundle size check.

### Flakiness check (before merging engine changes)

```bash
CI=true npx playwright test --project=smoke --repeat-each=5
```

### Regenerating golden fixtures (after changing ops)

```bash
GOLDEN_UPDATE=1 cargo test -p engine-core --test golden
```

## Architecture

### Data flow

1. User edits canvas → React Flow nodes/edges updated in `CanvasArea.tsx`
2. `useGraphEngine` hook diffs the graph → produces `PatchOp[]` via `src/engine/diffGraph.ts`
3. Patch is sent to a Web Worker via `postMessage`
4. Worker (`src/engine/worker.ts`) applies patch and runs incremental evaluation via the WASM engine
5. Results posted back → `ComputedContext` updates → UI re-renders

### Layer boundaries (enforced by ESLint adapter-boundary rule)

- `src/components/` — React UI; **cannot** import `src/lib/supabase` directly (type-only imports OK)
- `src/lib/` — Service layer; all Supabase/Stripe calls live here (named exports only, no defaults)
- `src/engine/` — WASM bridge, worker, diff logic, value types
- `src/blocks/` — Block definitions (metadata + port schemas); no evaluation logic
- `src/stores/` — Zustand stores (project metadata, variables, published outputs)
- `src/contexts/` — React Contexts (engine API, plan/entitlements, theme, canvas settings)
- `functions/` — Cloudflare Pages Functions (server-side: Stripe webhooks, CSP reports)

### Rust vs TypeScript boundary

If it affects computed values, it **must** live in Rust. If it affects presentation only, it lives in TypeScript.

| Responsibility | Rust (`engine-core`) | TypeScript |
| --- | --- | --- |
| Math evaluation, NaN/Infinity canonicalization | ✅ | ❌ |
| Topological sort, dirty propagation, incremental eval | ✅ | ❌ |
| Broadcasting rules, value type system (runtime) | ✅ | Mirror types in `src/engine/value.ts` |
| Graph snapshot serialization | Bridge (`src/engine/bridge.ts`) | React Flow → EngineSnapshotV1 |
| Patch diffing | — | `src/engine/diffGraph.ts` (Rust only applies patches) |
| Block metadata (labels, ports, categories) | ❌ | `src/blocks/` |
| Auth, storage, billing | ❌ | `src/lib/`, `functions/api/` |

The `src/engine/value.ts` mirror types let the UI pattern-match on value kinds without importing from the WASM pkg. Do not add evaluation logic to these mirror types.

### Rust/WASM engine

- `crates/engine-core/` — Pure Rust: graph structure, value types (Scalar/Vector/Table/Interval/Text/Complex/Matrix), 150+ ops, validation
- `crates/engine-wasm/` — wasm-bindgen bindings; persistent `EngineGraph` via thread-local storage
- Protocol: snapshot load on first render, then incremental patches. Watchdog restarts worker after 5 s hang.
- `ENGINE_CONTRACT_VERSION = 3` in `crates/engine-core/src/catalog.rs` versions the evaluation contract.

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

Blocks are defined in `src/blocks/` as metadata (`BlockDef`) with port schemas — no evaluation. The Rust engine owns all computation. `src/blocks/registry.ts` is the master registry. Block categories are defined as `BlockCategory` in `src/blocks/types.ts`. Block definition files follow the naming convention `*-blocks.ts`.

## Adding a new block op (end-to-end)

This is the most common engine change. Follow these steps in order:

1. **Implement in Rust** — add a `match` arm in `crates/engine-core/src/ops.rs`
2. **Register in catalog** — add an `OpSpec` entry to `CATALOG` in `crates/engine-core/src/catalog.rs`
3. **Write golden test** — add a fixture to `crates/engine-core/tests/fixtures/`, run `GOLDEN_UPDATE=1 cargo test -p engine-core --test golden`
4. **Bump `ENGINE_CONTRACT_VERSION`** if you changed evaluation semantics (see Hard Invariant #1)
5. **Add block metadata** — create/edit the appropriate `src/blocks/*-blocks.ts` file, register in `src/blocks/registry.ts`
6. **Add i18n label** — add to `src/i18n/locales/en.json` under `"blocks"`, repeat for `es.json`, `fr.json`, `it.json`, `de.json`
7. **Build and test** — `npm run wasm:build:dev && npm run check && npm run test:e2e:smoke`

## Code style

- **TypeScript**: `singleQuote: true`, `semi: false`, `tabWidth: 2` (Prettier). Strict mode: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Use `import type` for type-only imports. Unused vars/params: prefix with `_`.
- **Rust**: Edition 2021, standard `cargo fmt` defaults. Module-level `//!` doc comments on every `.rs` file. Error codes: `SCREAMING_SNAKE_CASE`.

### File naming

| Type | Convention | Example |
| --- | --- | --- |
| React component | PascalCase `.tsx` | `CanvasArea.tsx` |
| React hook | camelCase `.ts`, `use` prefix | `useGraphEngine.ts` |
| Library module | camelCase `.ts` | `entitlements.ts` |
| Block pack | camelCase `.ts`, `-blocks` suffix | `vector-blocks.ts` |
| Web Worker | camelCase `.ts`, `-worker` suffix | `csv-worker.ts` |

### Export conventions

- **Components**: one default export per file.
- **Libraries (`src/lib/`)**: named exports only (no default).
- **Barrel files (`index.ts`)**: only in `src/components/ui/`. Do not add barrels elsewhere.

### Error codes

TypeScript error codes use `[SCREAMING_SNAKE_CASE]` as the first token in thrown `Error` messages (e.g. `[CONFIG_INVALID]`, `[WASM_CSP_BLOCKED]`, `[ENGINE_CONTRACT_MISMATCH]`). Rust diagnostic codes live in `crates/engine-core/src/catalog.rs`.

### Styling

- Inline styles for canvas nodes (React Flow constraint) — shared constants in `src/components/canvas/nodes/nodeStyles.ts`
- Global design tokens in `src/index.css` (CSS custom properties)
- No CSS modules; prefer inline styles or global CSS
- Design tokens: Primary `#1CABB0`, Background `#1a1a1a`, Card `#383838`, Text `#F4F4F3`
- Fonts: Montserrat (UI), JetBrains Mono (numbers)

## Hard invariants — do not break

### 1. Engine contract versioning

When changing anything affecting engine evaluation (broadcasting, error propagation, value semantics):

1. Bump `ENGINE_CONTRACT_VERSION` in `crates/engine-core/src/catalog.rs` (currently `3`)
2. Update the expected version in `src/engine/index.ts` (search `contractVersion`)
3. Document in `docs/W9_3_CORRECTNESS.md`

### 2. CSP must keep `'wasm-unsafe-eval'`

Both `Content-Security-Policy` lines in `public/_headers` must include `'wasm-unsafe-eval'` in `script-src`. Without it, `WebAssembly.instantiateStreaming()` is blocked and the engine fails to load.

### 3. CI two-build strategy

`VITE_IS_CI_BUILD=true` suppresses the `CONFIG_INVALID` guard in `src/lib/supabase.ts`. It is set only for the `node_checks` (PR) job — **never** for the `deploy` job. Setting it in deploy will send placeholder credentials to production silently.

### 4. Migrations (pre-release: fully mutable)

**Pre-release:** Migrations can be edited, deleted, squashed, or rewritten freely — there is no deployed database with user data. Optimize for the cleanest possible schema. When writing migrations, still use good habits: `IF NOT EXISTS`, `CREATE OR REPLACE`, idempotent statements, RLS on new tables, `public.` qualification, `SET search_path = public` on functions.

**Post-v1.0 (you'll be told):** Migrations become append-only. Never edit or delete an existing migration file. Create a new numbered migration to fix a past one.

### 5. COOP+COEP headers must stay in `public/_headers`

The `/*` section in `public/_headers` must include:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these, `crossOriginIsolated` is `false`, `SharedArrayBuffer` is unavailable, and dataset transfer falls back to ArrayBuffer copy. Never remove them.

## CI structure

| Trigger | Jobs |
| ------- | ---- |
| PR to `main` | `rust_tests` + `node_checks` (typecheck + lint + format + build with placeholder creds) |
| Push to `main` | above + `e2e_smoke` (10 Playwright tests) + `deploy` |
| Manual (`workflow_dispatch`) | Full E2E suite (`e2e-full.yml`) or Performance suite (`perf.yml`) |

Playwright does **not** run on PRs — only after merge to `main`, as a pre-condition for deploy.

## Bundle size budgets (enforced by CI)

| Metric | Budget |
| ------ | ------ |
| Initial JS (gzip) | 400 KB |
| WASM (raw) | 800 KB |
| WASM (gzip) | 250 KB |

Use `React.lazy()` to keep new components out of the initial load. Run `npm run perf:bundle` after a build to check locally.

## Rust test locations

| Test suite | Path |
| --- | --- |
| Unit tests | `crates/engine-core/src/` (inline `#[cfg(test)]` modules) |
| Golden fixtures | `crates/engine-core/tests/golden.rs` + `tests/fixtures/*.fixture.json` |
| Property tests (external) | `crates/engine-core/tests/properties.rs` |
| Proptest properties (inline) | `crates/engine-core/src/tests/proptest_properties.rs` |
| Perf smoke tests | `crates/engine-core/tests/perf_smoke.rs` |
| Criterion benchmarks | `crates/engine-core/benches/engine_benchmarks.rs` |

## Pre-commit hook (recommended)

```bash
git config core.hooksPath .githooks
```

Runs `format:check` and `lint` on every commit.
