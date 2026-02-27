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
| i18n | react-i18next — EN / ES / FR / IT / DE |
| E2E tests | Playwright (Chromium) |

## Quick start

**Prerequisites:** Rust stable, [wasm-pack](https://rustwasm.github.io/wasm-pack/), Node 20+, npm.

```bash
# Install dependencies
npm ci

# Build the Rust/WASM engine (required before first dev start)
npm run wasm:build:dev       # fast debug build

# Start the dev server
# VITE_SUPABASE_* defaults to placeholder — auth calls fail silently, which is fine
# for local UI dev.  Add a .env file with real credentials to enable auth locally.
npm run dev                  # http://localhost:5173
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

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full directory map,
data model, engine design, and milestone history.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, CI structure, and
the invariants you must not break.

## Docs

See [docs/README.md](docs/README.md) for a full index of the documentation.

Product requirements suite: [docs/requirements/README.md](docs/requirements/README.md).
