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

### [ENV_SECRETS.md](ENV_SECRETS.md)

**Purpose:** Environment variable and secrets management.

**Read this when:** You're adding a new env var, configuring secrets for
CI/CD, or setting up `.dev.vars` for local Pages function development.

**Covers:**
- Client-safe `VITE_*` variables
- Server-only variables (Cloudflare context.env)
- `.dev.vars` usage for local development
- Secret rotation procedures

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

### [RELEASE.md](RELEASE.md)

**Purpose:** Release process and deployment checklist.

**Read this when:** You're preparing a release, checking migration
attribution, or following the deploy checklist.

**Covers:**
- Release process steps
- Migration attribution and numbering
- Deploy verification checklist

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
| [ADR-0005](DECISIONS/ADR-0005-worker-cancellation.md) | Worker Cancellation Strategy | Accepted |

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
| [UX.md](UX.md) | Canvas UX interaction rules and design decisions |

### Exports

| Document | Purpose |
|----------|---------|
| [CHAINSOLVEJSON_FORMAT.md](CHAINSOLVEJSON_FORMAT.md) | `.chainsolvejson` portable format: schema, hashing, import/export workflow |
| [PDF_EXPORT.md](PDF_EXPORT.md) | PDF audit report generation: layout, equations, metadata |
| [EXCEL_EXPORT.md](EXCEL_EXPORT.md) | Excel/XLSX export: sheet layout, styling, data mapping |

### AI Copilot

| Document | Purpose |
|----------|---------|
| [AI_COPILOT.md](AI_COPILOT.md) | AI copilot feature: capabilities, model selection, UI integration |
| [AI_PRIVACY.md](AI_PRIVACY.md) | AI privacy model: data handling, redaction, opt-out controls |
| [AI_WORKFLOWS.md](AI_WORKFLOWS.md) | AI-assisted workflows: prompt templates, task dispatch, quota |

### Block catalog

| Document | Purpose |
|----------|---------|
| [BLOCK_CATALOG_GOVERNANCE.md](BLOCK_CATALOG_GOVERNANCE.md) | Block catalog governance: adding, deprecating, and versioning ops |
| [FUNCTION_PACK_STAGING.md](FUNCTION_PACK_STAGING.md) | Function pack staging: block registration, category mapping, entitlements |

### Presentation

| Document | Purpose |
|----------|---------|
| [BRANDING.md](BRANDING.md) | Brand asset paths, logo variants, theme selection helper |

---

## Dev environment

### [DEVCONTAINER.md](DEVCONTAINER.md)

**Purpose:** Devcontainer and GitHub Codespaces configuration.

**Read this when:** You're setting up a Codespace, debugging the post-create
script, or modifying the dev container image.

**Covers:**
- Rust/wasm-pack auto-installation
- Node dependency setup
- WASM dev build
- PATH persistence for non-interactive shells

---

### [TESTING_GOLDENS.md](TESTING_GOLDENS.md)

**Purpose:** Golden fixture test system for the Rust engine.

**Read this when:** You're adding a new engine op, updating expected values,
or debugging a golden test failure.

**Covers:**
- Fixture JSON format (snapshot, expected, diagnostics, tolerance)
- How to regenerate expected values (`GOLDEN_UPDATE=1`)
- Adding new fixtures

---

### [TEST_PERSONAS.md](TEST_PERSONAS.md)

**Purpose:** Test user personas for QA and E2E testing.

**Read this when:** You're writing E2E tests or designing QA scenarios that
need realistic user profiles.

**Covers:**
- Persona definitions (roles, plans, usage patterns)
- Scenario mapping

---

### [DEV/DEPENDENCIES.md](DEV/DEPENDENCIES.md)

**Purpose:** Dependency policy for the project.

**Read this when:** You're adding a new npm package, reviewing supply chain
health, or wondering why a particular library is (or isn't) used.

**Covers:**
- What is allowed vs discouraged (with rationale)
- Step-by-step guide to adding a new dependency
- Lazy-loading requirements for heavy packages
- Supply chain checks (automated and manual)
- Current dependency inventory

### [DEV/RELEASE_DRY_RUN.md](DEV/RELEASE_DRY_RUN.md)

**Purpose:** Step-by-step release rehearsal playbook.

**Read this when:** You're about to deploy to production and want a
structured pre-flight checklist.

**Covers:**
- Local gate (verify-ci.sh), E2E smoke tests
- Auth, CSP, exports, billing, and AI quota validation
- CI pipeline monitoring and post-deploy smoke tests
- Rollback procedures

### [DEV/SERVICE_SETUP_CHECKLIST.md](DEV/SERVICE_SETUP_CHECKLIST.md)

**Purpose:** Idiot-proof service setup checklist for production.

**Read this when:** Setting up a new environment from scratch, or
verifying that all external services and secrets are properly configured.

**Covers:**
- Supabase (DB, Auth, Storage, RLS)
- Stripe (payments, webhooks, Customer Portal, 6 price IDs)
- Cloudflare Pages (hosting, env vars, deploy credentials)
- Resend (transactional email via SMTP)
- GitHub Actions (CI/CD secrets)
- Optional: Turnstile (CAPTCHA), OpenAI (AI Copilot)
- Complete env var reference (client + server + CI)

---

## Observability

### [observability/](observability/)

**Purpose:** Observability architecture and operational runbooks.

**Read this when:** You're working on telemetry, debugging CSP reports, or
triaging client-side errors.

| Document | Purpose |
|----------|---------|
| [observability/overview.md](observability/overview.md) | Architecture: event pipeline, sampling, storage |
| [observability/csp-reporting.md](observability/csp-reporting.md) | CSP report endpoint: validation, dedup, local Wrangler testing |
| [observability/doctor.md](observability/doctor.md) | Client-side health checks and diagnostics |
| [observability/runbook.md](observability/runbook.md) | Operational runbook: alerts, triage, common issues |

---

## Performance

### [performance/](performance/)

**Purpose:** Performance strategy, budgets, instrumentation, and runbooks.

**Read this when:** You're optimising bundle size, profiling memory, or
investigating a performance regression.

| Document | Purpose |
|----------|---------|
| [performance/overview.md](performance/overview.md) | Strategy: goals, metrics, tooling |
| [performance/budgets.md](performance/budgets.md) | Performance budgets: bundle size, LCP, TTI thresholds |
| [performance/baseline.md](performance/baseline.md) | Baseline measurements and benchmarks |
| [performance/instrumentation.md](performance/instrumentation.md) | Marks, measures, reporting |
| [performance/memory.md](performance/memory.md) | WASM heap, JS heap, leak detection |
| [performance/stress-tests.md](performance/stress-tests.md) | Large graphs, concurrent operations |
| [performance/runbook.md](performance/runbook.md) | Regression triage and optimization |
| [perf-budget.md](perf-budget.md) | Bundle size budget thresholds (CI-enforced) |

---

## Enterprise

### [enterprise/](enterprise/)

**Purpose:** Enterprise-tier features and policies.

**Read this when:** You're working on organisation billing, audit logs, or
desktop app deployment policies.

| Document | Purpose |
|----------|---------|
| [enterprise/org-billing.md](enterprise/org-billing.md) | Organisation-level billing: team plans, seat management |
| [enterprise/audit-log-retention.md](enterprise/audit-log-retention.md) | Audit log retention policies and compliance |
| [enterprise/desktop-policy.md](enterprise/desktop-policy.md) | Desktop app enterprise policies: MDM, auto-update, offline |

---

## Architecture deep-dives

| Document | Purpose |
|----------|---------|
| [architecture/stripe-connect.md](architecture/stripe-connect.md) | Stripe Connect integration: marketplace payouts, onboarding |

---

## Audit & hygiene

### [AUDIT/](AUDIT/)

**Purpose:** Repository audit findings and cleanup plan.

**Read this when:** You're looking for tech debt to address, reviewing code
quality, or planning a cleanup sprint.

| Document | Purpose |
|----------|---------|
| [AUDIT/REPO_AUDIT_REPORT.md](AUDIT/REPO_AUDIT_REPORT.md) | Full audit: structure, boundaries, hot zones, duplications, findings |
| [AUDIT/REPO_HYGIENE_PLAN.md](AUDIT/REPO_HYGIENE_PLAN.md) | Prioritized cleanup tasks derived from audit |

---

## Product & marketing

| Document | Purpose |
|----------|---------|
| [ANALYTICS_STRATEGY.md](ANALYTICS_STRATEGY.md) | Analytics strategy: events, funnels, privacy-first approach |
| [MARKETING_QA.md](MARKETING_QA.md) | Marketing QA checklist: landing page, SEO, social cards |

---

## Requirements suite

### [requirements/](requirements/)

**Purpose:** Complete product requirements from vision to non-functional specs.

| Document | Purpose |
|----------|---------|
| [requirements/README.md](requirements/README.md) | Requirements suite overview and reading guide |
| [requirements/01-product-vision.md](requirements/01-product-vision.md) | Product vision, target users, value proposition |
| [requirements/02-domain-model-and-schema.md](requirements/02-domain-model-and-schema.md) | Domain model, data schema, entity relationships |
| [requirements/03-web-app-requirements.md](requirements/03-web-app-requirements.md) | Web application functional requirements |
| [requirements/04-mobile-app-requirements.md](requirements/04-mobile-app-requirements.md) | Mobile application requirements |
| [requirements/05-desktop-app-requirements.md](requirements/05-desktop-app-requirements.md) | Desktop application requirements |
| [requirements/06-platform-backend-and-entitlements.md](requirements/06-platform-backend-and-entitlements.md) | Platform backend, entitlements, billing |
| [requirements/07-nonfunctional-security-and-quality.md](requirements/07-nonfunctional-security-and-quality.md) | Non-functional, security, and quality requirements |

---

## Roadmap

| Document | Purpose |
|----------|---------|
| [ROADMAP_CHECKLIST.md](ROADMAP_CHECKLIST.md) | Implementation roadmap: phases, checklist items, progress tracking |
