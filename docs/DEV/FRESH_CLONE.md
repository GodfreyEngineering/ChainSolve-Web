# Fresh Clone Verification

How to verify ChainSolve Web builds and runs from a clean checkout.

## Prerequisites

| Tool | Version | How to install |
|------|---------|----------------|
| Rust | stable | `rustup toolchain install stable` |
| wasm-pack | 0.13+ | `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf \| sh` |
| Node | 20+ | `nvm install 20` or install from nodejs.org |
| npm | bundled | comes with Node |

The `.devcontainer/devcontainer.json` installs all of these automatically in
GitHub Codespaces or VS Code Dev Containers.

## Steps

```bash
# 1. Clone
git clone https://github.com/GodfreyEngineering/ChainSolve-Web
cd ChainSolve-Web

# 2. Install dependencies
npm ci

# 3. Run full CI gate
./scripts/verify-ci.sh

# 4. Start dev server
npm run dev
# Open http://localhost:5173 — the app loads with placeholder credentials
```

## What verify-ci.sh checks

1. Prettier format check
2. ESLint
3. Adapter boundary (no Supabase imports in UI components)
4. wasm-pack build (Rust to WASM)
5. TypeScript typecheck (app + Cloudflare Functions)
6. vitest (unit tests)
7. cargo test (Rust tests)
8. Vite production build
9. Bundle size budgets (initial JS, WASM gzip)

## Expected results

- `verify-ci.sh` exits 0 with "All CI checks passed."
- `npm run dev` starts Vite at http://localhost:5173 within seconds
- The app renders in the browser (auth calls fail silently without real
  Supabase credentials, which is expected for local development)

## Environment variables

No `.env` file is required for a basic fresh clone test. The app uses
placeholder credentials by default and auth operations fail gracefully.

To enable full functionality, copy `.env.example` to `.env` and fill in
real Supabase credentials. See the root README for details.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `wasm-pack: command not found` | Install wasm-pack (see Prerequisites) |
| `error[E0463]: can't find crate for std` | Run `rustup target add wasm32-unknown-unknown` |
| `npm ci` fails on node-gyp | Ensure Node 20+ and Python 3 are installed |
| Bundle size check fails | Run `npm run build` first, then check `dist/` output |

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for more common issues.
