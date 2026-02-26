# ChainSolve — Troubleshooting

Common failure modes and how to diagnose and fix them.

---

## 1. WASM Engine Init Failures

The Rust/WASM engine (`crates/engine-wasm/`) is loaded in a Web Worker at
runtime.  When it fails to initialize, the app shows `data-testid="engine-fatal"`
with an error code badge instead of `data-testid="engine-ready"`.

### 1a. CSP blocking WASM (`WASM_CSP_BLOCKED`)

**Symptom:** `engine-fatal` with code `WASM_CSP_BLOCKED`.  Browser console:
```
Refused to compile or instantiate WebAssembly module because neither
'unsafe-eval' nor 'wasm-unsafe-eval' appears in the script-src directive
of the Content Security Policy.
```

**Cause:** The `Content-Security-Policy` header in `public/_headers` is missing
`'wasm-unsafe-eval'` from the `script-src` directive.  A Playwright smoke test
(`e2e/smoke.spec.ts`) guards against this at build time.

**Fix:** Ensure both CSP lines in `public/_headers` include `'wasm-unsafe-eval'`:
```
script-src 'self' 'wasm-unsafe-eval';
```
See `docs/SECURITY.md §2.1` for the full rationale.

**Note:** `'wasm-unsafe-eval'` is intentionally different from `'unsafe-eval'`.
`'wasm-unsafe-eval'` allows only WebAssembly compilation; it does **not** enable
`eval()` or `new Function()`.  Never replace it with `'unsafe-eval'`.

### 1b. Browser extensions blocking WASM

**Symptom:** Engine fails locally but works in an incognito window or a
browser profile without extensions.

**Cause:** Some ad-blockers and security extensions intercept WebAssembly
fetch requests or add their own CSP headers that conflict with the app's headers.

**Fix:** Test in a clean Chromium profile.  If the issue is extension-caused,
instruct the user to allowlist the domain or disable the conflicting extension.

### 1c. WASM file missing from build output

**Symptom:** `engine-fatal` with a network error; browser DevTools shows the
`.wasm` fetch returning 404.

**Cause:** The WASM binary is missing from `dist/assets/`.  This happens if
`npm run build` was run without first running `npm run wasm:build` (or
`npm run wasm:build:dev` for a debug build).

**Fix:**
```bash
npm run wasm:build:dev   # or wasm:build for release
npm run build            # full build: wasm:build is a prerequisite
```

In CI, the `node_checks` job runs `wasm-pack build` before `vite build`.  The
`e2e_smoke` job does a sanity-check: it `ls dist/assets/` and fails fast if no
`.wasm` file is present.

### 1d. WASM network timeout (slow connection)

**Symptom:** `engine-fatal` with a timeout error on a slow connection.

**Cause:** The `.wasm` file is ~500 KB (release build).  On a very slow
connection (or behind a proxy with a short timeout), the fetch can time out
before compilation starts.

**Fix:** This is a network infrastructure problem, not a code bug.  The app
retries once on failure.  If it fails consistently, check:
- CDN configuration: Cloudflare Pages should serve `.wasm` with
  `Content-Type: application/wasm` and proper caching headers.
- Confirm the WASM MIME type: `Content-Type: application/wasm`.  Incorrect MIME
  (`application/octet-stream`) can prevent `instantiateStreaming()` and fall
  back to a slower path.

---

## 2. Placeholder Environment Variable Protections

### 2a. `CONFIG_INVALID` at production boot

**Symptom:** The app shows a fatal error screen immediately on production load.
Browser console:
```
[CONFIG_INVALID] VITE_SUPABASE_URL is missing or still set to the placeholder value.
```

**Cause:** The production build was made without setting the real
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` GitHub Secrets.  The guard
in `src/lib/supabase.ts` throws at module initialization in production builds
when it detects the placeholder URL (`https://placeholder.supabase.co`).

**Fix:** Set the real secrets in GitHub → Settings → Secrets and variables →
Actions → Repository secrets:
- `VITE_SUPABASE_URL` → your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` → your Supabase anon key

Then re-run the deploy job.

**Local dev note:** For local development, add a `.env` file in the repo root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
Without a `.env` file, the dev server starts with placeholder credentials — the
app loads, but auth calls fail silently (which is fine for canvas-only dev work).

### 2b. `VITE_IS_CI_BUILD` must NOT be set in deploy

**Background:** The CI pipeline uses two Vite builds:
1. `node_checks` job: `VITE_IS_CI_BUILD=true` + placeholder creds → artifact used by e2e smoke tests
2. `deploy` job: **no** `VITE_IS_CI_BUILD` + real credentials from Secrets

`VITE_IS_CI_BUILD=true` suppresses the `CONFIG_INVALID` guard.  If it were
accidentally set in the deploy job, placeholder credentials would reach
production silently.

**Belt-and-suspenders:** The deploy job also runs a `grep` guard that searches
the `dist/` bundle for `placeholder.supabase.co` and fails before deploying if
found.  See `.github/workflows/ci.yml §deploy.Guard` for details.

---

## 3. Common CI Failures

### 3a. Format check fails (`npm run format:check`)

**Symptom:** CI `node_checks` job fails on the "Format check" step.

**Fix locally:**
```bash
npm run format   # auto-fix all src/**/*.{ts,tsx,css} files
```
Prettier config is in `.prettierrc`: `singleQuote: true, semi: false, tabWidth: 2`.

### 3b. TypeScript typecheck fails (`npx tsc -b --noEmit`)

**Symptom:** CI fails on the "Typecheck (app)" step with `TS2xxx` errors.

**Common causes:**
- Unused local variable or parameter (strict mode: `noUnusedLocals`, `noUnusedParameters`)
  — prefix the name with `_` to suppress, or remove it.
- Type-only import not using `import type` (`verbatimModuleSyntax`) — change to `import type`.
- `erasableSyntaxOnly` violation — only use TypeScript syntax that can be erased
  (no `const enum`, no `namespace` with values).

**Reproduce locally:**
```bash
npm run wasm:build:dev   # tsc needs the WASM pkg types
npx tsc -b --noEmit
```

For Cloudflare Functions types:
```bash
npm run typecheck:functions
```

### 3c. ESLint fails (`npm run lint`)

**Reproduce locally:**
```bash
npm run lint        # check only
npm run lint:fix    # auto-fix safe rules
```

### 3d. WASM build fails (`cargo test` or `wasm-pack build`)

**Symptom:** CI `rust_tests` or `node_checks` job fails with a Rust compiler
or linker error.

**Common causes:**
- `wasm32-unknown-unknown` target not installed.
  Fix: `rustup target add wasm32-unknown-unknown`
- `wasm-pack` not installed.
  Fix: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
- Rust edition / toolchain mismatch.
  Check `rust-toolchain.toml` in the repo root for the pinned toolchain.

**Reproduce locally:**
```bash
cargo test --workspace                            # unit tests only (fast)
wasm-pack build crates/engine-wasm --target web --dev   # WASM build (slower)
```

### 3e. Playwright smoke tests fail

**Symptom:** CI `e2e_smoke` job fails.  The test uploads a Playwright report
artifact on failure (`playwright-report/`).

**Reproduce locally (fastest path):**
```bash
npm run wasm:build:dev
npx tsc -b && npx vite build \
  VITE_SUPABASE_URL=https://placeholder.supabase.co \
  VITE_SUPABASE_ANON_KEY=placeholder \
  VITE_IS_CI_BUILD=true
npm run test:e2e:smoke
```

Or use the single convenience script that matches CI exactly:
```bash
# Set env vars first, then:
VITE_SUPABASE_URL=https://placeholder.supabase.co \
VITE_SUPABASE_ANON_KEY=placeholder \
VITE_IS_CI_BUILD=true \
  npx tsc -b && npx vite build && npx playwright test --project=smoke
```

**Reading the boot ladder diagnostic:**

When a test times out waiting for `engine-ready`, the helper dumps:
```
[boot] URL: http://localhost:4173/
[boot] boot-html: ✓  boot-js: ✓  react-mounted: ✓  boot-fatal: –
[boot] engine-ready: –  engine-fatal: –
[boot] WASM resources: 1 entry (504 KB, loaded in 312 ms)
```

| Testid | Meaning |
|--------|---------|
| `boot-html` | HTML document loaded |
| `boot-js` | Boot script executed (`src/boot.ts`) |
| `react-mounted` | React tree mounted (`src/main.tsx`) |
| `boot-fatal` | Fatal error before React mount (e.g. `CONFIG_INVALID`) |
| `engine-ready` | WASM engine initialized successfully |
| `engine-fatal` | WASM engine failed (check error code badge) |

If `react-mounted` is missing, the error is in `src/main.tsx` or its imports.
If `engine-fatal` is present, see §1 above for WASM failure diagnosis.

### 3f. Deploy job fails: placeholder URL in bundle

**Symptom:** CI `deploy` job fails on the "Guard — no placeholder Supabase URL" step.

**Cause:** Either the `VITE_SUPABASE_URL` secret is not set, is empty, or is
still set to `https://placeholder.supabase.co`.

**Fix:** Update the GitHub Secret with the real Supabase project URL.
GitHub → Settings → Secrets → Actions → `VITE_SUPABASE_URL`.

---

## 4. Engine Contract Version Mismatch

**Symptom:** The app boots but all node outputs show wrong values, or the
engine reports a version mismatch warning.

**Cause:** `ENGINE_CONTRACT_VERSION` in `crates/engine-core/src/catalog.rs`
was bumped without updating the expected version in `src/engine/index.ts`.

**Fix:** Update `src/engine/index.ts` — search for `contractVersion` and
change the expected value to match `catalog.rs`.  Document the semantic change
in `docs/W9_3_CORRECTNESS.md`.

See `CONTRIBUTING.md §1` for the full invariant.

---

## 5. Database / Migration Issues

### 5a. RLS preventing inserts

**Symptom:** Supabase client returns a 403/404 error when a user tries to
create a project or upload a file.

**Check:** Run the migrations in order (`supabase/migrations/` — numeric order).
Each migration is idempotent where possible, so re-running them is safe.

**Common cause:** Migrations 0006, 0009, or 0011 not yet applied.  These
migrations tighten RLS policies and add helper functions used by storage bucket
policies.

### 5b. Stripe webhook not updating plan

**Symptom:** User subscribes successfully in Stripe but plan in the app remains `free`.

**Check:**
1. Stripe Dashboard → Developers → Webhooks → recent deliveries → look for failures.
2. Confirm `STRIPE_WEBHOOK_SECRET` in Cloudflare Pages env vars matches the
   signing secret shown in the Stripe webhook endpoint detail page.
3. Check that the webhook endpoint URL is `https://app.chainsolve.co.uk/api/stripe/webhook`
   (not a preview URL).

See `docs/SETUP.md §4b` for the full webhook setup guide.
