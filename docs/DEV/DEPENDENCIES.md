# Dependency Policy

> How we choose, add, and maintain third-party dependencies in ChainSolve Web.

---

## Principles

1. **Fewer is better.** Every dependency is a liability — maintenance burden,
   bundle size, and supply chain risk. Prefer built-in APIs (Web Crypto, Intl,
   CSS) over libraries when the built-in covers the need.

2. **Lazy-load heavy deps.** PDF, Excel, Vega, and AI libraries must use
   dynamic `import()` so they never appear in the initial bundle. See
   `src/lib/pdf-loader.ts`, `src/lib/xlsx-loader.ts`, `src/lib/vega-loader.ts`
   for the cached-promise pattern.

3. **CSP compliance.** Dependencies must not use `eval()`, `new Function()`,
   or inline scripts. The CSP only allows `'wasm-unsafe-eval'` for the Rust
   engine — nothing else gets an exception.

4. **No native/binary deps in the frontend bundle.** The only native artifact
   is the Rust/WASM engine, built via wasm-pack.

---

## What is allowed

| Category | Examples | Notes |
|----------|----------|-------|
| React ecosystem | `react`, `react-dom`, `react-router-dom`, `react-i18next` | Core framework |
| Canvas/graph | `@xyflow/react`, `dagre` | Node graph rendering and layout |
| State management | `zustand` | Lightweight, no boilerplate |
| Backend client | `@supabase/supabase-js` | Auth, DB, storage |
| Payments | `stripe` (server-side only) | Cloudflare Pages Functions only |
| Visualization | `vega`, `vega-lite`, `vega-interpreter` | Must be lazy-loaded |
| Export | `pdf-lib`, `html-to-image`, `write-excel-file` | Must be lazy-loaded |
| Dev tooling | `vite`, `vitest`, `eslint`, `prettier`, `playwright` | devDependencies only |
| Type packages | `@types/*`, `@cloudflare/workers-types` | devDependencies only |

## What is discouraged

| Category | Reason | Alternative |
|----------|--------|-------------|
| CSS-in-JS (styled-components, emotion) | CSP complexity, bundle bloat | CSS variables + plain CSS modules |
| Large utility libraries (lodash, ramda) | Tree-shaking issues, native alternatives | Native JS (Array methods, structuredClone) |
| Date libraries (moment, dayjs) | Intl.DateTimeFormat covers our needs | `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` |
| Animation libraries (framer-motion, GSAP) | Bundle weight, CSS handles our needs | CSS transitions + `@keyframes` |
| GraphQL clients (Apollo, urql) | We use Supabase REST, not GraphQL | `@supabase/supabase-js` |
| Alternative state managers (Redux, MobX) | Zustand is sufficient and lighter | `zustand` |

---

## How to add a new dependency

### 1. Justify the addition

Before adding a dep, answer:
- Can this be done with browser APIs or existing code?
- Is this a one-time use or a recurring need?
- What is the gzipped size impact? (check [bundlephobia.com](https://bundlephobia.com))
- Does it have CSP implications (eval, inline scripts)?

### 2. Check supply chain health

- **Maintenance:** Last published < 12 months ago, open issues triaged
- **Popularity:** Reasonable download count (not abandoned)
- **License:** MIT, Apache-2.0, or BSD — no copyleft (GPL) in runtime deps
- **Security:** Run `npm audit` — no high/critical vulnerabilities

### 3. Install correctly

```bash
# Runtime dependency (ships in the bundle)
npm install <package>

# Dev-only dependency (build tools, types, test frameworks)
npm install --save-dev <package>
```

### 4. Lazy-load if heavy

If the package is > 50 KB gzipped, it **must** be lazy-loaded:

```typescript
// src/lib/<name>-loader.ts
let cached: Promise<typeof import('<package>')> | null = null

export function load<Name>() {
  if (!cached) cached = import('<package>')
  return cached
}
```

Add the source file to `MUST_BE_LAZY` in `scripts/check-bundle-splits.mjs`.

### 5. Update CI guards

- Run `./scripts/verify-ci.sh` — must pass (bundle size, splits, audit)
- If the bundle size budget is exceeded, update `scripts/check-bundle-size.mjs`
  budgets with justification in the commit message
- If adding a new lazy chunk, add the entry point to `check-bundle-splits.mjs`

### 6. Add type declarations

If the package has no built-in types:
- Check if `@types/<package>` exists on npm
- If not, add a minimal `.d.ts` in `src/` or use `declare module '<package>'`

---

## Supply chain checks

### Automated (CI)

- `npm audit --audit-level=high` runs in both `verify-ci.sh` and GitHub Actions
- Bundle size budgets enforced by `scripts/check-bundle-size.mjs`
- Lazy-split audit by `scripts/check-bundle-splits.mjs`

### Manual (periodic)

- Review `npm outdated` quarterly for major version bumps
- Check GitHub Advisories for newly disclosed vulnerabilities
- Verify lockfile integrity: `npm ci` (fails on lockfile mismatch)

---

## Current inventory

As of March 2026: **18 runtime** + **20 dev** dependencies.

All 6 heavy dependencies (pdf-lib, html-to-image, write-excel-file, vega,
vega-lite, vega-interpreter) are lazy-loaded via dynamic imports.

See [AUDIT/REPO_AUDIT_REPORT.md](../AUDIT/REPO_AUDIT_REPORT.md) for the
full dependency audit.
