# ChainSolve — Documentation

> For a comprehensive doc index with purpose, audience, and content guide for
> each document, see **[INDEX.md](INDEX.md)**.
>
> For first-time setup see [SETUP.md](SETUP.md).
> For contributor workflow see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Start here

| Document | Description |
|----------|-------------|
| [INDEX.md](INDEX.md) | Comprehensive index — purpose, audience, and "what's in it" for every doc |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, directory map, data model, engine design, milestone history |
| [REPO_MAP.md](REPO_MAP.md) | "Where do I change X?" — task-oriented file ownership guide |
| [SETUP.md](SETUP.md) | Production deploy guide: Supabase, Stripe, Cloudflare Pages, go-live checklist |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Dev setup, scripts, CI structure, hard invariants |
| [CONVENTIONS.md](CONVENTIONS.md) | Naming rules, error codes, Rust vs TS boundary, adding new block ops |

---

## Security & operations

| Document | Description |
|----------|-------------|
| [SECURITY.md](SECURITY.md) | CORS, CSP (`'wasm-unsafe-eval'`), CSP reporting, security headers, analytics policy |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | WASM init failures, placeholder env, common CI failures + local repro steps |

---

## Architecture decisions

| Document | Decision |
|----------|---------|
| [DECISIONS/ADR-0001](DECISIONS/ADR-0001-rust-wasm-engine.md) | Why Rust/WASM in a Worker (not a TS engine) |
| [DECISIONS/ADR-0002](DECISIONS/ADR-0002-csp-wasm-unsafe-eval.md) | Why `'wasm-unsafe-eval'` and not `'unsafe-eval'` |
| [DECISIONS/ADR-0003](DECISIONS/ADR-0003-ci-deploy-strategy.md) | Two-build CI/CD strategy with placeholder credentials |
| [DECISIONS/ADR-0004](DECISIONS/ADR-0004-supabase-rls.md) | Supabase RLS canonicalization (`(select auth.uid())` pattern) |

---

## Features

| Document | Description |
|----------|-------------|
| [PROJECT_FORMAT.md](PROJECT_FORMAT.md) | `project.json` schema (schemaVersion 3), versioning contract, conflict detection |
| [GROUPS.md](GROUPS.md) | Block groups and templates: usage, collapse/expand, proxy handles, Pro gating |
| [PLOTTING.md](PLOTTING.md) | Plot blocks (Vega-Lite): chart types, export, CSP-safe loading, downsampling |
| [BRANDING.md](BRANDING.md) | Brand asset paths, logo variants, theme selection helper |
| [UX.md](UX.md) | Canvas UX interaction rules and design decisions |

---

## Engine deep-dives

| Document | Description |
|----------|-------------|
| [W9_ENGINE.md](W9_ENGINE.md) | Build, debug, add ops, op semantics reference |
| [W9_2_SCALE.md](W9_2_SCALE.md) | Patch protocol, dirty propagation, incremental evaluation |
| [W9_3_CORRECTNESS.md](W9_3_CORRECTNESS.md) | NaN/Error propagation, `ENGINE_CONTRACT_VERSION` policy, golden tests |
| [W9_4_PERF.md](W9_4_PERF.md) | Performance metrics, `?perf=1` profiling, optimization notes |
| [W9_5_VERIFICATION.md](W9_5_VERIFICATION.md) | Test strategy, golden fixtures, property tests, smoke vs full e2e |
