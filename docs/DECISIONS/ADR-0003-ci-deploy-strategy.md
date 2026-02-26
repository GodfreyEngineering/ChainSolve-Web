# ADR-0003 — CI Two-Build Deploy Strategy

| Field | Value |
|-------|-------|
| Status | Accepted |
| Decided | W9.5.3 |
| Supersedes | — |
| Affects | `.github/workflows/ci.yml`, `.github/workflows/e2e-full.yml`, `src/lib/supabase.ts` |

---

## Context

ChainSolve uses Supabase for auth and database.  The Supabase credentials
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are baked into the JavaScript
bundle at build time by Vite (they become `import.meta.env.*` literals).

**The problem:** E2E tests (Playwright) need a runnable app bundle.  But:
- We don't want production Supabase credentials in CI artifacts (they would be
  visible in uploaded artifacts and logs).
- The app's `src/lib/supabase.ts` throws `[CONFIG_INVALID]` in production mode
  if placeholder credentials are detected — which is exactly what would happen
  if we built with placeholder creds and deployed.

A naive solution (build once with real creds, use for both e2e and deploy)
would put real credentials in an artifact retained for 7 days.

---

## Decision

Use **two separate Vite builds** in the CI pipeline:

### Build 1 — `node_checks` job (PR gate + e2e artifact)

```yaml
env:
  VITE_SUPABASE_URL: https://placeholder.supabase.co
  VITE_SUPABASE_ANON_KEY: placeholder
  VITE_IS_CI_BUILD: 'true'          # suppresses CONFIG_INVALID guard
```

- Placeholder credentials let the app boot without making real Supabase calls.
- `VITE_IS_CI_BUILD=true` tells `supabase.ts` to skip the production guard.
- The resulting `dist/` artifact is used by Playwright smoke tests.
- Supabase calls fail silently to a non-existent host (acceptable — smoke tests
  don't exercise auth).

### Build 2 — `deploy` job (production)

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  # VITE_IS_CI_BUILD is intentionally absent
```

- Real credentials from GitHub Secrets are injected.
- `VITE_IS_CI_BUILD` is **not set** — the guard runs and would catch any
  accidental placeholder credentials.
- A belt-and-suspenders `grep` guard scans `dist/` for `placeholder.supabase.co`
  before deploying.

### Why not just skip the WASM build in the deploy job?

The `deploy` job downloads the compiled WASM `.pkg` artifact from
`node_checks` (no Rust/wasm-pack toolchain needed) and runs only:
`tsc -b && vite build`.  This saves ~2-3 minutes per deploy.

---

## Consequences

**Positive:**
- Production credentials are never in a CI artifact.
- The `CONFIG_INVALID` guard provides a runtime safety net for both the deploy
  job (guard runs) and the smoke tests (guard suppressed, app boots).
- WASM is compiled once and reused, keeping deploy fast.
- The grep guard catches accidental placeholder-in-bundle scenarios before
  Cloudflare Pages ever sees them.

**Negative / trade-offs:**
- Two builds means any Vite configuration change must work correctly with both
  placeholder and real credentials.
- `VITE_IS_CI_BUILD` is a special escape hatch — it must never be set in the
  `deploy` job.  This is documented and enforced by the secret validation step.
- E2E smoke tests run against a build with placeholder credentials, so they
  cannot exercise auth flows.  This is acceptable because the smoke suite is
  intentionally scoped to "app boots + WASM loads" checks.

---

## `VITE_IS_CI_BUILD` lifecycle

| Job | `VITE_IS_CI_BUILD` | Effect |
|-----|-------------------|--------|
| `node_checks` | `'true'` | `supabase.ts` guard skipped; placeholder creds OK |
| `e2e_smoke` | Not set (no build) | Uses pre-built artifact from `node_checks` |
| `e2e-full.yml` build | `'true'` | Same as `node_checks` (full suite uses placeholder creds) |
| `deploy` | Not set | Guard runs; placeholder creds → deploy fails |

---

## See also

- `.github/workflows/ci.yml` — jobs: `rust_tests`, `node_checks`, `e2e_smoke`, `deploy`
- `.github/workflows/e2e-full.yml` — nightly full suite
- `src/lib/supabase.ts` — `CONFIG_INVALID` guard implementation
- `CONTRIBUTING.md §3` — "CI two-build strategy" invariant
