# ChainSolve Web

A browser-based visual computation platform: wire together blocks on a canvas, the
Rust/WASM engine evaluates the graph in a Web Worker, and results appear in real time.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 (strict) |
| Compute engine | Rust → WASM (wasm-pack) in a Web Worker |
| Canvas | @xyflow/react (React Flow v12) |
| Auth + DB | Supabase (supabase-js v2, RLS) |
| Storage | Supabase Storage (projects + uploads buckets) |
| Billing | Stripe v20 SDK (Checkout + Customer Portal + webhooks) |
| Hosting | Cloudflare Pages (static + Pages Functions) |
| i18n | react-i18next — EN / DE / FR / ES / IT / HE |
| E2E tests | Playwright (Chromium) |

## Quick start

**Prerequisites:** Rust stable, [wasm-pack](https://rustwasm.github.io/wasm-pack/), Node 20+, npm.

```bash
# Install dependencies
npm ci

# Build the Rust/WASM engine (required before first dev start)
npm run wasm:build:dev       # fast debug build

# Start the dev server
npm run dev                  # http://localhost:5173
```

## Environment setup

Copy `.env.example` to `.env` to configure Supabase and other services:

```bash
cp .env.example .env
```

Without real credentials, auth calls fail silently. This is fine for local UI
development. See [docs/DEV/SERVICE_SETUP_CHECKLIST.md](docs/DEV/SERVICE_SETUP_CHECKLIST.md)
for full service configuration.

For Cloudflare Pages Functions, create `.dev.vars` (gitignored) with:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>
```

## Verify CI (the single gate)

All changes must pass the full CI gate before merge:

```bash
./scripts/verify-ci.sh
```

This runs, in order: prettier, eslint, adapter-boundary check, wasm-pack build,
tsc, vitest, cargo test, vite build, and bundle size checks.

For a faster local check (skips WASM and cargo):

```bash
./scripts/verify-fast.sh
```

## Key commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Full production build (WASM + tsc + Vite) |
| `npm run wasm:build` | Release WASM build only |
| `npm run wasm:build:dev` | Debug WASM build (faster) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI gate) |
| `npm run lint` | ESLint |
| `npm run typecheck` | WASM build + tsc app |
| `npm run typecheck:functions` | tsc for Cloudflare Functions |
| `npm run wasm:test` | `cargo test --workspace` |
| `npm run test:e2e:smoke` | Playwright smoke suite (mirrors CI) |
| `npm run test:e2e` | Full Playwright suite |

## Database setup (fresh Supabase project)

Run the single baseline migration in the Supabase SQL Editor:

```
supabase/migrations/0001_baseline_schema.sql
```

See [docs/DEV/SUPABASE_BOOTSTRAP.md](docs/DEV/SUPABASE_BOOTSTRAP.md) for details.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full directory map,
data model, engine design, and milestone history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, CI structure, and
the invariants you must not break.

## Documentation

See [docs/README.md](docs/README.md) for a full index of all documentation:
architecture, security, exports, AI copilot, engine internals, and more.

Product requirements: [docs/requirements/README.md](docs/requirements/README.md).
