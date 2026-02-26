# ChainSolve — Documentation Index

> **Start here.** This file tells you which document covers what, who should
> read it, and what questions it answers.  New engineers and AI agents: read
> this first, then follow the links for the area you're working in.

---

## Core references

### [ARCHITECTURE.md](ARCHITECTURE.md)

**Purpose:** Single source of truth for the overall system design.

**Read this when:** You're new to the project, or you need to understand how
the pieces connect before modifying something.

**Covers:**
- Full tech stack table with version numbers
- Annotated directory map (`src/`, `functions/`, `crates/`, `supabase/`, `e2e/`)
- Data model (Supabase tables, RLS design)
- Node graph engine design (block types, value system, evaluation flow)
- Entitlements matrix (plan vs features)
- Environment variables reference
- Complete milestone/wave history (M0 → W9.6)

---

### [SETUP.md](SETUP.md)

**Purpose:** Step-by-step production deploy guide.

**Read this when:** You're deploying to a new environment (Supabase + Stripe +
Cloudflare Pages) for the first time, or you need to recall an exact
configuration step.

**Covers:**
- Supabase: running migrations in order, Auth configuration, RLS verification
- Resend: SMTP setup for transactional email
- Stripe: product + price creation, webhook endpoint, test mode checklist
- Cloudflare Pages: Pages project setup, environment variables, custom domain
- GitHub Secrets: which secrets go where, placeholder-protection guard
- Go-live checklist

---

### [CONTRIBUTING.md](../CONTRIBUTING.md)

**Purpose:** Everything a developer needs to contribute safely.

**Read this when:** You're setting up a local dev environment, writing a PR,
or debugging a CI failure.

**Covers:**
- Prerequisites (Rust, wasm-pack, Node, npm)
- First-time setup (`npm ci` + `npm run wasm:build:dev` + `npm run dev`)
- Full scripts reference (Node/TypeScript + Playwright + Rust/WASM)
- CI structure (PR gate vs merge gate vs nightly)
- Editor setup (.vscode/, rust-analyzer Codespaces tips)
- Code style (Prettier config, Rust edition, doc comment conventions)
- Hard invariants (engine contract, CSP, CI two-build strategy, migrations)
- Testing guide (smoke suite, full suite, boot ladder diagnostics)

---

## Security & operations

### [SECURITY.md](SECURITY.md)

**Purpose:** Security model — what we allow, what we block, and why.

**Read this when:** You're changing the CSP, adding a new external service,
modifying CORS, or reviewing the security posture before a release.

**Covers:**
- CORS policy (allowed origins, OPTIONS handling, Vary: Origin)
- Content Security Policy: all directives and their rationale
- Why `'wasm-unsafe-eval'` is required (and why `'unsafe-eval'` is not used)
- CSP Report endpoint (abuse mitigation, dedup, Supabase table schema)
- Security headers (`X-Frame-Options`, HSTS, `Permissions-Policy`, etc.)
- Third-party analytics decision (Cloudflare Web Analytics: disabled, why)
- Post-deploy verification checklist

---

### [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**Purpose:** Concrete diagnosis + fix steps for common failures.

**Read this when:** Something is broken — engine won't load, CI is failing, or
production is showing a fatal error screen.

**Covers:**
- WASM engine init failures: CSP blocked, browser extensions, missing binary,
  network timeout
- Placeholder env var protections: `CONFIG_INVALID` at boot, two-build CI guard
- Common CI failures: format check, typecheck, lint, WASM build, Playwright smoke
- Engine contract version mismatch (wrong computed values)
- Database / RLS / Stripe webhook issues

---

## Decisions

### [DECISIONS/](DECISIONS/)

**Purpose:** Architecture Decision Records (ADRs) — the *why* behind key
design choices that affect the whole system.

**Read this when:** You're wondering why something was built a certain way, or
you're proposing a change that touches a fundamental design decision.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](DECISIONS/ADR-0001-rust-wasm-engine.md) | Rust/WASM Worker Engine | Accepted |
| [ADR-0002](DECISIONS/ADR-0002-csp-wasm-unsafe-eval.md) | CSP `'wasm-unsafe-eval'` | Accepted |
| [ADR-0003](DECISIONS/ADR-0003-ci-deploy-strategy.md) | CI Two-Build Deploy Strategy | Accepted |
| [ADR-0004](DECISIONS/ADR-0004-supabase-rls.md) | Supabase RLS Canonicalization | Accepted |

---

## Navigating the codebase

### [REPO_MAP.md](REPO_MAP.md)

**Purpose:** "Where do I change X?" — a task-oriented guide to the repo layout.

**Read this when:** You know what you want to change but don't know where the
code lives.

**Covers:**
- Where to add a new block operation (Rust → TS → UI → i18n)
- Where to change the billing/entitlement logic
- Where to add a new API route
- Where to add a new DB table (migration + RLS)
- Where to change security headers
- File ownership map for the 6 main subsystems

---

### [CONVENTIONS.md](CONVENTIONS.md)

**Purpose:** Naming conventions, error code format, and "what goes in Rust vs TS".

**Read this when:** You're writing new code and want to match the existing style
and patterns used across the codebase.

**Covers:**
- TypeScript file naming, component exports, barrel policy
- Error code format (`[CODE]` prefix, known codes)
- What belongs in Rust vs TypeScript (the engine boundary)
- How to add a new block operation end-to-end (step-by-step recipe)
- Supabase migration naming and RLS policy patterns

---

## Feature deep-dives

### Engine

| Document | Purpose |
|----------|---------|
| [W9_ENGINE.md](W9_ENGINE.md) | Rust/WASM engine: build, debug, add ops, op semantics |
| [W9_2_SCALE.md](W9_2_SCALE.md) | Patch protocol, dirty propagation, incremental eval, dataset registry |
| [W9_3_CORRECTNESS.md](W9_3_CORRECTNESS.md) | NaN/Error propagation, `ENGINE_CONTRACT_VERSION` policy, golden tests |
| [W9_4_PERF.md](W9_4_PERF.md) | Performance metrics, `?perf=1` profiling, optimization notes |
| [W9_5_VERIFICATION.md](W9_5_VERIFICATION.md) | Test strategy, golden fixtures, property tests, smoke vs full e2e |

### Canvas features

| Document | Purpose |
|----------|---------|
| [GROUPS.md](GROUPS.md) | Block groups + templates: usage, collapse/expand, proxy handles, Pro gating |
| [PLOTTING.md](PLOTTING.md) | Plot blocks (Vega-Lite): chart types, export, CSP-safe loading, downsampling |
| [PROJECT_FORMAT.md](PROJECT_FORMAT.md) | `project.json` schema (schemaVersion 3), versioning contract, conflict detection |

### Presentation

| Document | Purpose |
|----------|---------|
| [BRANDING.md](BRANDING.md) | Brand asset paths, logo variants, theme selection helper |
| [UX.md](UX.md) | Canvas UX interaction rules and design decisions |
