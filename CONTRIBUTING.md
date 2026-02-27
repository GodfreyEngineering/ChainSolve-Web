# Contributing to ChainSolve Web

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Rust | stable | `rustup toolchain install stable` |
| wasm-pack | latest | `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf \| sh` |
| Node | 20+ | `nvm use 20` or install from nodejs.org |
| npm | bundled with Node | do not use yarn/pnpm |

## First-time setup

```bash
git clone https://github.com/your-org/ChainSolve-Web
cd ChainSolve-Web

npm ci                       # install Node dependencies
npm run wasm:build:dev       # compile Rust → WASM (debug, faster)
npm run dev                  # start Vite dev server at http://localhost:5173
```

The dev server starts without real Supabase credentials — the app loads but
auth calls fail silently to `placeholder.supabase.co`. Add a `.env` file with
real credentials to enable auth locally:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Scripts reference

### Node / TypeScript

```bash
npm run dev                  # Vite dev server
npm run build                # full build: wasm:build + tsc + vite build
npm run wasm:build           # release WASM build only
npm run wasm:build:dev       # debug WASM build (faster, larger output)
npm run wasm:test            # cargo test --workspace
npm run format               # prettier --write src/**/*.{ts,tsx,css}
npm run format:check         # prettier --check (CI gate)
npm run lint                 # eslint .
npm run lint:fix             # eslint . --fix
npm run typecheck            # wasm:build + tsc -b --noEmit (app)
npm run typecheck:functions  # tsc -p functions/tsconfig.json --noEmit
```

### Playwright

```bash
npm run test:e2e:smoke       # smoke suite only (mirrors CI; ~30 s)
npm run test:e2e             # full suite (wasm-engine, groups, plots)
npm run test:e2e:ui          # Playwright UI mode
```

Repeat smoke 5× for flakiness check (use before merging engine changes):

```bash
CI=true npx playwright test --project=smoke --repeat-each=5
```

### Rust / WASM

```bash
cargo test --workspace                         # run all Rust unit tests
cargo test -p engine-core                      # engine-core only
cargo bench -p engine-core                     # benchmarks (criterion)
wasm-pack build crates/engine-wasm --target web --release   # manual release build
```

## CI structure

| Trigger | Jobs |
|---------|------|
| Pull request to `main` | `rust_tests` + `node_checks` (typecheck + lint + format + build with placeholder creds) |
| Push to `main` | above + `e2e_smoke` (10 Playwright tests) + `deploy` (production build + Cloudflare Pages) |
| Nightly schedule | full e2e suite (all specs) |

**Key point:** Playwright does NOT run on PRs to keep the gate fast. Smoke e2e runs
only after merging to `main`, before (and as a precondition for) the deploy job.

## Codespaces quick start

A `.devcontainer/devcontainer.json` is provided. On first launch it installs
Rust, wasm-pack, Node 20, and runs `npm ci` + `npm run wasm:build:dev`
automatically. Once the container is ready:

```bash
npm run dev                  # start dev server
npm run verify:fast          # quick local checks (no cargo/wasm-pack needed)
npm run verify:ci            # full CI-equivalent pipeline
```

If you're in an existing Codespace without devcontainer support, bootstrap
manually:

```bash
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
npm ci
npm run wasm:build:dev
```

## Pre-commit hook (recommended)

Enable the formatting + lint pre-commit hook to catch issues before they
reach CI:

```bash
git config core.hooksPath .githooks
```

The hook runs `format:check` and `lint` — fast enough to run on every commit.
If it flags issues, fix them with `npm run format` and `npm run lint:fix`.

## Verification workflow

Two verification scripts mirror what CI runs. Use them before pushing.

### `npm run verify:fast` (pre-push)

Runs checks that don't require wasm-pack or cargo:

- Prettier format check
- ESLint
- WASM export guard (`scripts/check-wasm-exports.mjs`)
- TypeScript typecheck (app + functions)
- Unit tests (vitest)

### `npm run verify:ci` (full CI-equivalent)

Mirrors the GitHub Actions pipeline exactly:

1. `npm ci`
2. `wasm-pack build` (release)
3. `wasm-opt -Oz` (via `binaryen` devDependency)
4. WASM export guard
5. `tsc -b --noEmit` (app + functions)
6. ESLint + Prettier
7. vitest
8. `cargo test --workspace`
9. Vite build + bundle size check

**When to use which:**

- `verify:fast` — quick iteration, before every push
- `verify:ci` — before merging to main, after WASM/Rust changes

## Bundle size budgets

The CI gate (`scripts/check-bundle-size.mjs`) enforces two hard budgets:

| Metric | Budget | Notes |
|--------|--------|-------|
| Initial JS (gzip) | 350 KB | Entry + main chunk — what the CDN serves on first paint |
| WASM (raw) | 600 KB | Per-file, before Brotli on the wire |

Total JS is reported for visibility but does **not** fail the build, since lazy
chunks (dialogs, panels) only load on demand.

Run `npm run perf:bundle` after a build to check locally. The script reads the
Vite manifest (`dist/.vite/manifest.json`) to compute the initial-load closure
and reports both raw and gzip sizes.

To reduce initial JS: use `React.lazy()` for components that are conditionally
rendered (dialogs, panels, popovers). To reduce WASM: the `wasm-opt -Oz` step
in the build pipeline handles this automatically via the `binaryen` devDependency.

## Editor setup

`.vscode/extensions.json` contains recommended VS Code extensions (Prettier,
ESLint, rust-analyzer, Playwright).  Install them via the Extensions panel →
"Show Recommended Extensions".

**rust-analyzer on Codespaces / memory-limited machines:** If rust-analyzer
becomes slow or crashes (spinning "loading…" spinner), add the following to
your local `.vscode/settings.json` (gitignored — user-specific):

```json
{
  "rust-analyzer.cargo.buildScripts.enable": false,
  "rust-analyzer.procMacro.enable": false
}
```

These settings reduce memory pressure by skipping proc-macro expansion.  You
lose some IDE completions for macro-generated items, but the server stays
stable.  Remove them on a powerful local machine for a richer experience.

## Code style

- **TypeScript** — Prettier with `singleQuote: true, semi: false, tabWidth: 2`.
  Run `npm run format` to auto-fix. TypeScript strict mode: `noUnusedLocals`,
  `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.
  Use `import type` for type-only imports.

- **Rust** — Edition 2021, `cargo fmt` (standard rustfmt defaults). Doc comments
  use `///` for items and `//!` for module-level.

## Do not break — hard invariants

These four rules exist to prevent silent production failures. CI may not catch
all violations; the cost of breaking them is a broken production deployment.

### 1. Engine contract versioning

`ENGINE_CONTRACT_VERSION` in `crates/engine-core/src/catalog.rs` is the
semantic version of the engine's evaluation contract (broadcasting rules, error
propagation, value semantics). When you change anything that affects how the
engine evaluates a graph:

1. Bump `ENGINE_CONTRACT_VERSION` in `catalog.rs`
2. Update the expected version check in `src/engine/index.ts` (search for
   `contractVersion`)
3. Document the change in `docs/W9_3_CORRECTNESS.md`

If the contract version mismatch is not caught, the UI may silently display
wrong values.

### 2. CSP must keep `'wasm-unsafe-eval'`

Both `Content-Security-Policy` lines in `public/_headers` must include
`'wasm-unsafe-eval'` in their `script-src` directive. Without it, browsers
block `WebAssembly.instantiateStreaming()` and the engine fails to load.

A Playwright smoke test (`e2e/smoke.spec.ts`) asserts this at build time.
Do not remove this directive without understanding the full impact on all
supported browsers (Chrome 95+, Firefox 102+, Safari 16+).

See `docs/SECURITY.md §2.1` for the full rationale.

### 3. CI two-build strategy — `VITE_IS_CI_BUILD`

The CI pipeline uses **two separate Vite builds**:

- `node_checks` job: builds with `VITE_IS_CI_BUILD=true` + placeholder Supabase
  creds. This artifact is used by the smoke e2e tests.
- `deploy` job: rebuilds with **real** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  from GitHub Secrets. `VITE_IS_CI_BUILD` is intentionally absent.

`VITE_IS_CI_BUILD=true` suppresses the `CONFIG_INVALID` guard in
`src/lib/supabase.ts` that would otherwise throw at module init. If you set
`VITE_IS_CI_BUILD` in the deploy job, placeholder credentials will reach
production silently.

See `.github/workflows/ci.yml` for the exact structure.

### 4. Migrations are append-only

`supabase/migrations/` is a numbered, append-only migration history. Never:
- Delete a migration file
- Rename a migration file
- Edit an already-applied migration

To fix a past migration, create a new numbered migration that applies the
correction. This preserves the ability to replay migration history on a fresh
Supabase project.

## Testing guide

### Smoke suite (`e2e/smoke.spec.ts`)

10 tests. Checks: page title, meta tags, robots.txt, SPA routing, no console
errors, WASM engine reaches `engine-ready` state, `_headers` CSP file check.

Run time: ~10–30 s on a warm machine.

### Full suite

All 4 spec files: smoke + wasm-engine + groups + plot-smoke. Takes ~2–5 min.

### Boot ladder

If a test fails with a timeout, the helper dumps a structured diagnostic:

```
[boot] URL: http://localhost:4173/
[boot] boot-html: ✓  boot-js: ✓  react-mounted: ✓  boot-fatal: –
[boot] engine-ready: –  engine-fatal: –
[boot] WASM resources: 1 entry (504 KB, loaded in 312 ms)
```

The 6 boot ladder testids and their meaning are documented at the top of
`e2e/helpers.ts`.

## Docs structure

See `docs/README.md` for a full index of all documentation.
