# ChainSolve — Documentation Index

> For first-time setup see [SETUP.md](SETUP.md).
> For contributor workflow see [CONTRIBUTING.md](../CONTRIBUTING.md) (repo root).

---

## Start here

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, full directory map, data model, engine design, milestone history |
| [SETUP.md](SETUP.md) | Production deploy guide: Supabase, Stripe, Cloudflare Pages, env vars, go-live checklist |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Dev setup, npm/cargo scripts, CI structure, "do not break" invariants |

---

## Security & operations

| Document | Description |
|----------|-------------|
| [SECURITY.md](SECURITY.md) | CORS policy, Content Security Policy (including `'wasm-unsafe-eval'`), CSP report endpoint, security headers |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | WASM init failures, placeholder env protections, common CI failures and local reproduction steps |

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
| [W9_ENGINE.md](W9_ENGINE.md) | Rust/WASM engine: build, debug, add new ops, op semantics reference |
| [W9_2_SCALE.md](W9_2_SCALE.md) | Patch protocol, dirty propagation, incremental evaluation, dataset registry |
| [W9_3_CORRECTNESS.md](W9_3_CORRECTNESS.md) | NaN/Error propagation rules, `ENGINE_CONTRACT_VERSION` policy, correctness tests |
| [W9_4_PERF.md](W9_4_PERF.md) | Performance metrics, profiling with `?perf=1`, optimization notes |
| [W9_5_VERIFICATION.md](W9_5_VERIFICATION.md) | Verification checklist, test strategy, known limitations, smoke vs full e2e |
