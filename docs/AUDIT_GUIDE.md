# ChainSolve Web -- Operational Readiness Audit Guide

Revision: 1.0 (L3-2)

This document is written for an external consultant or internal auditor who
needs to evaluate the repository for production readiness.  It covers three
areas: repository structure and code quality, test execution, and security
posture.

---

## 1. Repository overview

### Tech stack

| Layer | Technology | Version | Location |
|-------|-----------|---------|----------|
| Compute engine | Rust (compiled to WASM) | stable toolchain | `crates/engine-core/`, `crates/engine-wasm/` |
| Frontend | React + TypeScript (Vite) | React 18, TS 5 | `src/` |
| Backend | Cloudflare Pages Functions | - | `functions/` |
| Database | Supabase (Postgres + Auth + Storage) | - | `supabase/migrations/` |
| Payments | Stripe (Checkout + Customer Portal) | - | `functions/api/stripe/` |
| CI gate | `scripts/verify-ci.sh` | - | `scripts/` |

### Directory structure

```
ChainSolve-Web/
  crates/
    engine-core/       Rust compute engine (pure, no async, no I/O)
      src/             ops.rs (operations), eval.rs (evaluator), graph.rs (topo sort)
      tests/           Integration tests + golden fixtures
    engine-wasm/       WASM bindings (thin layer over engine-core)
  src/
    blocks/            Block type registry (TS metadata for each op)
    components/        React UI components
    docs/              In-app documentation content (tree-shaken)
    engine/            Worker bridge, WASM loader, diff engine
    hooks/             React hooks
    i18n/              Internationalization (6 locales: en, de, es, fr, it, he)
    lib/               Service layer (auth, billing, storage, profiles)
    observability/     Client-side telemetry
    pages/             Top-level route components
    stores/            Zustand stores
  functions/
    api/               Cloudflare Pages Functions (Stripe, CSP reports, etc.)
  supabase/
    migrations/        53 numbered SQL migrations (0001 through 0053)
  scripts/             CI scripts, WASM optimisation, license checks
  docs/                Engineering documentation (you are here)
  e2e/                 Playwright end-to-end tests
  public/              Static assets, headers, sitemap
```

For a full annotated map, see [ARCHITECTURE.md](ARCHITECTURE.md).
For task-oriented navigation, see [REPO_MAP.md](REPO_MAP.md).

### Key design decisions

Architectural decisions are recorded as ADRs in [docs/DECISIONS/](DECISIONS/):

| ADR | Decision |
|-----|----------|
| ADR-0001 | Rust/WASM worker engine (deterministic, sandboxed) |
| ADR-0002 | CSP `'wasm-unsafe-eval'` (not `'unsafe-eval'`) |
| ADR-0003 | CI two-build deploy strategy (placeholder creds in CI) |
| ADR-0004 | Supabase RLS canonicalisation (`(select auth.uid())`) |
| ADR-0005 | Worker cancellation strategy |

---

## 2. How to audit the repository

### 2.1 Prerequisites

```bash
# Required tools
rustup toolchain install stable     # Rust compiler
cargo install wasm-pack             # or: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
node --version                      # Node 20+
npm --version                       # bundled with Node
```

Alternatively, open the repository in GitHub Codespaces -- the devcontainer
installs all tools automatically (see [DEVCONTAINER.md](DEVCONTAINER.md)).

### 2.2 First-time setup

```bash
npm ci                              # install Node dependencies (locked)
npm run wasm:build:dev              # compile Rust to WASM (debug mode, faster)
```

### 2.3 Run the full CI gate

```bash
./scripts/verify-ci.sh
```

This runs 20 checks in sequence.  Every check must pass before code is
merged.  The checks are:

| # | Check | What it verifies |
|---|-------|------------------|
| 1 | Pre-flight | Rust, wasm-pack, and Node are installed |
| 2 | npm ci | Dependencies install without errors |
| 3 | Robots meta guard (source) | `noindex` meta tag present (pre-launch) |
| 4 | npm audit | Zero known vulnerabilities in dependencies |
| 5 | License inventory | THIRD_PARTY_NOTICES.md is up to date |
| 6 | Prettier | Code formatting is consistent |
| 7 | ESLint | No lint errors (warnings are allowed) |
| 8 | Adapter boundary | UI components do not import Supabase directly |
| 9 | CSP allowlist | No unapproved third-party domains in CSP |
| 10 | i18n attribute check | No hardcoded English strings in JSX attributes |
| 11 | i18n missing-key check | All i18n keys used in code exist in locale files |
| 12 | Billing stack-trace guard | Billing functions do not leak stack traces |
| 13 | WASM build (release) | Rust compiles to WASM without errors |
| 14 | WASM optimise | wasm-opt shrinks the binary |
| 15 | WASM export guard | Only expected symbols are exported |
| 16 | TypeScript typecheck (app) | Zero type errors in the frontend |
| 17 | TypeScript typecheck (functions) | Zero type errors in backend functions |
| 18 | Unit tests (vitest) | All TypeScript unit tests pass |
| 19 | Rust tests | All Rust unit and integration tests pass |
| 20 | Vite build | Production bundle builds successfully |

After the build, three more structural checks run:

| # | Check | What it verifies |
|---|-------|------------------|
| 21 | Bundle size | Total JS stays within budget |
| 22 | Lazy chunks audit | Minimum number of code-split chunks exist |
| 23 | Performance budget | WASM gzip ratio and initial JS file count |

Expected runtime: 3-4 minutes on a modern machine.

### 2.4 Code style and conventions

- **Formatting**: Prettier with the project `.prettierrc` config.  Run
  `npm run format:check` to verify.
- **Linting**: ESLint with React, TypeScript, and accessibility rules.
  Run `npm run lint`.
- **Naming**: see [CONVENTIONS.md](CONVENTIONS.md) for file naming,
  component exports, error code format, and the Rust/TS boundary.
- **Imports**: UI components must never import `./supabase` or
  `@supabase/supabase-js` directly.  All data access goes through
  service functions in `src/lib/`.  This is enforced by
  `scripts/check-adapter-boundary.sh` (check #8 above).

### 2.5 Dependency hygiene

- **Lock file**: `package-lock.json` is committed and used by `npm ci`.
- **Zero audit vulnerabilities**: enforced by check #4.
- **License inventory**: `THIRD_PARTY_NOTICES.md` lists every npm and
  Cargo dependency with its license.  Updated automatically by
  `scripts/check-license-inventory.sh`.
- **Dependency policy**: documented in [DEV/DEPENDENCIES.md](DEV/DEPENDENCIES.md).

### 2.6 What to look for during a manual audit

| Area | Where to look | What to verify |
|------|---------------|----------------|
| Secrets | `.env.example`, `docs/ENV_SECRETS.md` | No real keys committed; `.env` is in `.gitignore` |
| Database schema | `supabase/migrations/` | Migrations are numbered, idempotent, reviewed |
| RLS policies | `supabase/migrations/0011_*`, `0044_*` | Every table has RLS enabled; `(select auth.uid())` form |
| Auth flows | `src/lib/auth.ts` | Thin wrappers; no raw SQL or token manipulation |
| Payment logic | `functions/api/stripe/` | Webhook signature verification; no amount manipulation client-side |
| CSP headers | `public/_headers` | No `unsafe-eval`; only `wasm-unsafe-eval` |
| Error messages | `src/lib/`, `functions/` | No stack traces or internal details exposed to users |
| Console output | `src/` | Only in error handlers and dev-gated features |
| i18n completeness | `src/i18n/locales/*.json` | All 6 locale files have matching key sets |

---

## 3. How to run tests

### 3.1 TypeScript unit tests

```bash
npx vitest run                      # run all unit tests
npx vitest run src/lib/             # run tests in a specific directory
npx vitest run src/lib/auth.test.ts # run a single test file
npx vitest --watch                  # watch mode for development
```

Unit tests use vitest with jsdom environment.  Supabase is mocked
at the module level in each test file.

### 3.2 Rust engine tests

```bash
cargo test -p engine-core           # engine-core unit + integration tests
cargo test --workspace              # all Rust crates
```

### 3.3 Golden fixture tests

The engine has golden fixture tests that verify specific input graphs
produce expected output values.

```bash
# Run golden tests
cargo test -p engine-core --test golden

# Regenerate expected values after an intentional change
GOLDEN_UPDATE=1 cargo test -p engine-core --test golden
```

Fixture files live in `crates/engine-core/tests/fixtures/` as JSON.
See [TESTING_GOLDENS.md](TESTING_GOLDENS.md) for the format.

### 3.4 Property tests

```bash
cargo test -p engine-core properties
```

Property tests use `proptest` to generate random acyclic graphs and
verify invariants (determinism, no panics, consistent results).

### 3.5 End-to-end tests (Playwright)

```bash
npm run test:e2e:smoke              # smoke suite (~30 seconds)
npm run test:e2e                    # full suite (requires running app)
npm run test:e2e:ui                 # Playwright UI mode for debugging
```

Smoke tests run in CI on every PR.  Full tests require a running
application with real Supabase credentials.

### 3.6 Flakiness check

Before merging engine changes, run the smoke suite 5 times:

```bash
CI=true npx playwright test --project=smoke --repeat-each=5
```

### 3.7 Test coverage summary

| Layer | Framework | Approximate count | Location |
|-------|-----------|--------------------|----------|
| TS unit | vitest | 200+ tests | `src/**/*.test.ts` |
| Rust unit | cargo test | 100+ tests | `crates/engine-core/src/` |
| Rust integration | cargo test | 50+ tests | `crates/engine-core/tests/` |
| Golden fixtures | cargo test | 20+ fixtures | `crates/engine-core/tests/fixtures/` |
| Property tests | proptest | 64 cases/test | `crates/engine-core/tests/properties.rs` |
| E2E smoke | Playwright | 10+ scenarios | `e2e/` |

---

## 4. How to review the security posture

This section is safe to share with external auditors.  It does not
contain secrets, internal URLs, or exploitation details.

### 4.1 Architecture security model

| Boundary | Protection |
|----------|------------|
| Browser to API | CORS allowlist (production + localhost only) |
| Browser to Supabase | Anon key + RLS policies (row-level security) |
| API functions | Server-side service role key; never exposed to client |
| Stripe webhooks | Signature verification with `STRIPE_WEBHOOK_SECRET` |
| WASM engine | Runs in a Web Worker; no network access, no DOM access |
| File uploads | 50 MB limit; path-scoped to `auth.uid()` via storage ACL |

### 4.2 Content Security Policy

The CSP is defined in `public/_headers` and applies to all routes.

Key restrictions:
- `script-src 'self' 'wasm-unsafe-eval'` -- no `eval()`, no inline scripts
- `object-src 'none'` -- no plugins
- `base-uri 'self'` -- no base tag hijacking
- `form-action 'self'` -- no cross-origin form submissions

Full policy breakdown: [SECURITY.md](SECURITY.md) section 2.

### 4.3 Row-Level Security (RLS)

All 10 database tables have RLS enabled.  Policies use the canonical
`(select auth.uid())` subquery form (locked by migration 0011).

| Table | Access pattern |
|-------|---------------|
| `profiles` | Users read/update own row only |
| `projects` | Owner or org member |
| `canvas_storage` | Via project ownership |
| `project_assets` | Via project ownership |
| `variables` | Via project ownership |
| `user_sessions` | Own sessions only |
| `org_members` | Members of same org |
| `organizations` | Members only |
| `stripe_events` | Service role only (no user access) |
| `observability_events` | Service role only (no user access) |

### 4.4 Storage ACL

Two private buckets: `projects` and `uploads`.

- Both enforce 50 MB file size limit
- Path format: `{auth.uid()}/...`
- Storage policy: `(storage.foldername(name))[1] = auth.uid()::text`
- Users can only read/write files in their own folder

### 4.5 Authentication

| Feature | Implementation |
|---------|---------------|
| Password auth | Supabase Auth (bcrypt, server-side) |
| Email verification | Required before app access (`AuthGate`) |
| MFA/TOTP | Optional enrollment; challenge on login |
| Session tracking | `user_sessions` table; device label, last active |
| Single-session policy | Opt-in per org (`policy_single_session`); multi-session by default |
| Re-authentication | 10-minute window for billing operations |
| Remember me | Opt-out clears auth tokens on browser close |

### 4.6 Secret management

- All secrets are environment variables, never committed to the repository
- `.env` is in `.gitignore`; `.env.example` contains placeholder values only
- CI secrets are stored in GitHub Actions encrypted secrets
- Server-side secrets (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
  are only available in Cloudflare Pages Functions, never in client code
- Client-side variables use the `VITE_` prefix and contain only public keys

Full reference: [ENV_SECRETS.md](ENV_SECRETS.md).

### 4.7 Security verification commands

```bash
# Verify CSP headers
grep -A 20 'Content-Security-Policy' public/_headers

# Check for Supabase imports in UI components (should find zero)
./scripts/check-adapter-boundary.sh

# Verify RLS is enabled on all tables
grep -l 'ENABLE ROW LEVEL SECURITY' supabase/migrations/*.sql

# Check for secrets in code (should find zero real values)
grep -rn 'sk_live\|sk_test\|service_role' src/ functions/ --include='*.ts' --include='*.tsx'

# Verify .env is gitignored
git check-ignore .env

# Run the full CI gate (includes all security checks)
./scripts/verify-ci.sh
```

### 4.8 Security-related CI checks

These checks run on every commit via `verify-ci.sh`:

| Check | Purpose |
|-------|---------|
| Adapter boundary | Prevents UI from bypassing the service layer |
| CSP allowlist | Prevents unapproved domains in security headers |
| Billing stack-trace guard | Prevents internal errors from leaking to users |
| npm audit | Catches known dependency vulnerabilities |
| License inventory | Ensures all dependencies have acceptable licenses |

### 4.9 Incident response

- CSP violations are reported to `/api/report/csp` and stored in
  `observability_events` for triage
- Client-side errors are captured by the observability layer (opt-in)
- Operational runbooks: [observability/runbook.md](observability/runbook.md)

---

## 5. Operational readiness checklist

Use this checklist to verify the repository is production-ready.

### Code quality

- [ ] `./scripts/verify-ci.sh` passes with zero errors
- [ ] No `TODO` comments referencing incomplete features in shipped code
- [ ] No `console.log` statements outside error handlers or dev tooling
- [ ] All TypeScript strict mode errors resolved (`tsc -b --noEmit`)
- [ ] ESLint reports zero errors (warnings are acceptable)

### Testing

- [ ] Unit tests pass: `npx vitest run`
- [ ] Rust tests pass: `cargo test --workspace`
- [ ] Golden fixtures are up to date: `cargo test -p engine-core --test golden`
- [ ] E2E smoke tests pass: `npm run test:e2e:smoke`

### Security

- [ ] CSP does not include `'unsafe-eval'`
- [ ] All tables have RLS enabled
- [ ] No secrets in committed code (grep for `sk_live`, `sk_test`, `service_role`)
- [ ] `.env` is in `.gitignore`
- [ ] Adapter boundary check passes
- [ ] npm audit reports zero vulnerabilities

### Documentation

- [ ] ARCHITECTURE.md reflects current system design
- [ ] SECURITY.md covers current CSP, CORS, and RLS policies
- [ ] ENV_SECRETS.md lists all environment variables
- [ ] CONTRIBUTING.md has accurate setup instructions
- [ ] THIRD_PARTY_NOTICES.md is up to date

### Deployment

- [ ] Supabase migrations run in order without errors
- [ ] Stripe webhook endpoint is configured and verified
- [ ] Cloudflare Pages environment variables are set
- [ ] Production build completes without warnings

---

## 6. Related documents

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and data model |
| [SECURITY.md](SECURITY.md) | CSP, CORS, RLS, storage ACL details |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Developer setup and workflow |
| [REPO_MAP.md](REPO_MAP.md) | Task-oriented code navigation |
| [CONVENTIONS.md](CONVENTIONS.md) | Naming, patterns, and style |
| [ENV_SECRETS.md](ENV_SECRETS.md) | Environment variables and secrets |
| [SETUP.md](SETUP.md) | Production deployment guide |
| [DEV/RELEASE_DRY_RUN.md](DEV/RELEASE_DRY_RUN.md) | Release rehearsal playbook |
| [TESTING_GOLDENS.md](TESTING_GOLDENS.md) | Golden fixture test system |
| [AUDIT/REPO_AUDIT_REPORT.md](AUDIT/REPO_AUDIT_REPORT.md) | Previous audit findings |
