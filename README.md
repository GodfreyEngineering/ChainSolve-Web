# ChainSolve Web

A browser-based visual computation platform: wire together blocks on a canvas, and the Rust/WASM engine evaluates the graph in a Web Worker with results appearing in real time. Designed for engineers, scientists, and analysts who need fast, reproducible, interactive calculations.

---

## What is ChainSolve?

ChainSolve lets you build computation graphs visually — drag blocks onto a canvas, connect them with edges, and see results update instantly as you change inputs. All evaluation runs in a high-performance Rust/WASM engine inside a Web Worker, keeping the UI fully responsive even for large graphs.

Key capabilities:

- **150+ block types** across math, engineering, science, finance, signal processing, and more
- **Incremental evaluation**: only changed nodes re-evaluate; large graphs stay fast
- **Multiple value types**: Scalar, Vector, Table, Interval, Complex, Matrix, Text
- **Scientific correctness**: CODATA 2022 constants, NaN canonicalization, deterministic evaluation
- **Worker pool**: each canvas gets its own dedicated WASM Web Worker (ENG-04)
- **Export**: PDF, Excel, SVG/PNG plots
- **Collaboration**: save to cloud, share links, project snapshots
- **Pro features**: CSV import, all engineering/science block categories, plotting, groups/templates

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 (strict) |
| Compute engine | Rust → WASM (wasm-pack) in a dedicated Web Worker per canvas |
| Canvas | @xyflow/react (React Flow v12) |
| Auth + DB | Supabase (supabase-js v2, RLS on all tables) |
| Storage | Supabase Storage (projects + uploads buckets) |
| Billing | Stripe v20 SDK (Checkout + Customer Portal + webhooks) |
| Hosting | Cloudflare Pages (static + Pages Functions) |
| i18n | react-i18next — EN / DE / FR / ES / IT |
| E2E tests | Playwright (Chromium) |
| Unit tests | Vitest |
| Rust tests | Cargo (unit + golden fixtures + proptest + Criterion benchmarks) |

---

## Block Categories

### Core (free tier)

| Category | Blocks |
|---|---|
| Input | Number, Slider |
| Math | Add, Subtract, Multiply, Divide, Power, Sqrt, Abs, Floor, Ceil, Round, Mod, Clamp, Negate |
| Trig | Sin, Cos, Tan, Asin, Acos, Atan, Atan2, DegToRad, RadToDeg (with deg/rad preference) |
| Constants | π, e, τ, φ, and 30+ CODATA 2022 physical constants |
| Logic | Greater, Less, Equal, IfThenElse, Max, Min |
| Output | Display |

### Data & Analysis (Pro)

| Category | Blocks |
|---|---|
| Data | Table Input, CSV Import |
| Vector Ops | Length, Sum, Mean, Min, Max, Sort, Reverse, Slice, Concat, Map |
| Table Ops | Filter, Sort, Column, Add Column, Join |
| Plot | XY Plot (line/scatter), Histogram, Bar Chart, Heatmap |

### Engineering & Science (Pro)

| Category | Description |
|---|---|
| Complex | Complex arithmetic, magnitude, phase, conjugate, polar↔rect |
| Matrix | Determinant, inverse, linear solve (Ax=b), transpose, eigenvalues |
| Signal | FFT, inverse FFT |
| Interval | Interval arithmetic with guaranteed bounds |
| Chemical Engineering | Ideal gas law, Antoine VP, Raoult's law, Arrhenius rate, CSTR, enthalpy |
| Structural | Beam deflection (simply supported + cantilever), stress, section properties |
| Aerospace | Drag, dynamic pressure, escape velocity, Hohmann transfer delta-v |
| Control Systems | PID, step response, transfer functions |
| Life Sciences | Pharmacokinetics, growth models |
| Finance Options | Black-Scholes pricing, Greeks |
| Date/Time | Date arithmetic and formatting |
| Lookup Tables | 1-D and 2-D interpolation |
| Statistical Distributions | PDF/CDF for Normal, t, Chi², F, Binomial |
| Engineering Mechanics | Stress, strain, beam theory |
| Engineering Fluids | Bernoulli, Reynolds number, pipe flow |
| Engineering Conversions | Unit conversion across all SI/imperial units |
| Financial (TVM) | Time value of money, annuities, loan amortization |
| Statistics | Descriptive stats, regression, correlation |

---

## Quick Start

**Prerequisites:** Rust stable toolchain, [wasm-pack](https://rustwasm.github.io/wasm-pack/), Node 20+, npm.

```bash
# Clone and install
git clone <repo-url>
cd ChainSolve-Web
npm ci

# Build the Rust/WASM engine (required before first dev start)
npm run wasm:build:dev       # fast debug build (~15s)

# Start the dev server
npm run dev                  # http://localhost:5173
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Without real credentials, auth calls fail silently — this is fine for local UI development. See [docs/DEV/SERVICE_SETUP_CHECKLIST.md](docs/DEV/SERVICE_SETUP_CHECKLIST.md) for full service configuration.

For Cloudflare Pages Functions, create `.dev.vars` (gitignored):

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
STRIPE_PRICE_ID_PRO_MONTHLY=<price_id>
```

---

## Development Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | Full production build (WASM + tsc + Vite) |
| `npm run wasm:build` | Release WASM build only |
| `npm run wasm:build:dev` | Debug WASM build (faster) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI gate) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run typecheck` | WASM build + tsc app |
| `npm run typecheck:functions` | tsc for Cloudflare Functions |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:coverage` | Unit test coverage report |
| `npm run test:e2e:smoke` | Playwright smoke suite (~30s, mirrors CI) |
| `npm run test:e2e` | Full Playwright suite |
| `npm run bench:rust` | Criterion benchmarks (engine-core) |
| `npm run perf:bundle` | Check JS bundle sizes |
| `npm run verify:fast` | Quick checks: format + lint + typecheck (no cargo/wasm) |
| `npm run verify:ci` | Full CI-equivalent pipeline |
| `npm run doctor` | Diagnose missing dependencies |
| `npm run storybook` | Component library (Storybook) |

### Rust commands

```bash
cargo test --workspace           # All Rust tests (unit + golden + proptest + perf smoke)
cargo test -p engine-core        # engine-core only
cargo bench -p engine-core       # Criterion benchmarks
```

---

## Testing

### Unit tests (Vitest)

```bash
npm run test:unit
```

Covers: block registry, engine value types, service layer (mocked Supabase), block manifest sanity, catalog sync.

### Rust tests (Cargo)

```bash
cargo test --workspace
```

Includes:
- **Unit tests**: ops correctness, graph structure, evaluation
- **Golden fixtures** (`crates/engine-core/tests/golden.rs`): 16 JSON fixtures pinning exact outputs
- **Property tests** (`crates/engine-core/src/tests/proptest_properties.rs`): determinism, incremental consistency, no-panic on random ops
- **Performance smoke** (`crates/engine-core/tests/perf_smoke.rs`): regression guards (500ms budget, catches catastrophic regressions)

To regenerate golden fixtures after changing ops:

```bash
GOLDEN_UPDATE=1 cargo test -p engine-core --test golden
```

### E2E tests (Playwright)

```bash
npm run test:e2e:smoke    # CI smoke suite (10 tests, ~30s)
npm run test:e2e          # Full suite
```

---

## Architecture Overview

### Data Flow

```
User edits canvas
  → React Flow nodes/edges
  → useGraphEngine (diffGraph → PatchOp[])
  → postMessage to Web Worker
  → Rust/WASM engine (incremental evaluation)
  → IncrementalEvalResult (changed values only)
  → ComputedContext
  → UI re-renders
```

### Layer Boundaries

| Layer | Path | Rule |
|---|---|---|
| UI components | `src/components/` | Cannot import `src/lib/supabase` directly |
| Service layer | `src/lib/` | All Supabase/Stripe calls |
| Engine bridge | `src/engine/` | WASM bridge, worker, diff, value types |
| Block definitions | `src/blocks/` | Metadata + port schemas only — no evaluation |
| Stores | `src/stores/` | Zustand stores (project metadata, variables) |
| Contexts | `src/contexts/` | React Contexts (engine API, plan, theme, canvas settings) |
| Functions | `functions/` | Cloudflare Pages Functions (Stripe webhooks, CSP reports) |

### Rust/WASM Engine

The compute engine is split into two crates:

| Crate | Path | Purpose |
|---|---|---|
| `engine-core` | `crates/engine-core/` | Pure Rust: value types, graph, ops (150+), validation. No web/WASM deps. |
| `engine-wasm` | `crates/engine-wasm/` | wasm-bindgen wrapper. Persistent `EngineGraph` via thread-local storage. |

**Value types** (Rust `Value` enum in `crates/engine-core/src/types.rs`):
`Scalar`, `Vector`, `Table`, `Error`, `Interval`, `Text`, `Complex`, `Matrix`

**ENGINE_CONTRACT_VERSION = 3** (in `crates/engine-core/src/catalog.rs`)

Key engine features:
- **Incremental evaluation**: dirty propagation via BFS; only changed nodes re-evaluate
- **Value hash pruning (ENG-05)**: downstream nodes skipped when output is unchanged
- **Incremental topo sort (ENG-08)**: `AddNode` is O(1); full rebuild only on structural changes
- **Worker pool (ENG-04)**: each canvas gets a dedicated WASM Web Worker (LRU eviction, pool size = `min(hardwareConcurrency - 1, 4)`)
- **Zero-copy datasets**: `SharedArrayBuffer` (COOP+COEP) or `Transferable ArrayBuffer` fallback
- **Correctness**: NaN canonicalization, -0 → +0, deterministic topological order
- **Time budget**: cooperative abort with partial results; dirty state preserved for resumption

### Worker Pool

Each open canvas acquires a dedicated engine from `src/engine/workerPool.ts`. The primary engine (global singleton) handles the first render; once a dedicated engine is ready, `engineSwitchCount` increments and a full snapshot reload fires.

### CI Structure

| Trigger | Jobs |
|---|---|
| PR to `main` | `rust_tests` + `node_checks` (typecheck + lint + format + build) |
| Push to `main` | above + `e2e_smoke` (Playwright smoke) + `deploy` |
| Manual (`workflow_dispatch`) | Full E2E suite (`e2e-full.yml`) or Performance suite (`perf.yml`) |

### Bundle Size Budgets

| Metric | Budget |
|---|---|
| Initial JS (gzip) | 300 KB |
| WASM (raw) | 800 KB |
| WASM (gzip) | 250 KB |

---

## Pre-commit Hook

```bash
git config core.hooksPath .githooks
```

Runs `format:check` and `lint` before every commit.

---

## Database Setup (fresh Supabase project)

Run migrations in order via the Supabase SQL Editor:

```
supabase/migrations/0001_init.sql  (and subsequent migrations)
```

See [docs/DEV/SUPABASE_BOOTSTRAP.md](docs/DEV/SUPABASE_BOOTSTRAP.md) for full bootstrap instructions.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, CI structure, and hard invariants you must not break (engine contract versioning, CSP headers, COOP+COEP, migration append-only rule).

## Documentation

Full documentation index: [docs/README.md](docs/README.md)

Key docs:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Directory map, data model, engine design, milestone history
- [docs/W9_ENGINE.md](docs/W9_ENGINE.md) — Rust/WASM engine: build, debug, extend ops
- [docs/W9_3_CORRECTNESS.md](docs/W9_3_CORRECTNESS.md) — Scientific correctness contract (broadcasting, NaN, determinism)
- [docs/W9_4_PERF.md](docs/W9_4_PERF.md) — Performance budgets and benchmarks
- [docs/W9_5_VERIFICATION.md](docs/W9_5_VERIFICATION.md) — Golden tests, property tests, determinism harness
- [docs/SECURITY.md](docs/SECURITY.md) — CORS, CSP, security headers
- [docs/PLOTTING.md](docs/PLOTTING.md) — Plot blocks: chart types, export, CSP
- [docs/GROUPS.md](docs/GROUPS.md) — Block groups and templates
