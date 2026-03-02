# ChainSolve Web — Repository Audit Report

Generated: 2026-03-02
Scope: `src/`, `crates/`, `functions/`, `supabase/`, `scripts/`, `docs/`

---

## 1. Directory Map and Purpose

### Top-Level Layout

```
ChainSolve-Web/
├── crates/                 Rust engine (pure computation + WASM bindings)
│   ├── engine-core/        Pure Rust engine — ops, eval, graph, catalog (~6,730 LOC)
│   └── engine-wasm/        WASM bindings (wasm-bindgen) + compiled pkg/ output
├── src/                    React + Vite frontend (~328 TS/TSX files, ~45k LOC)
│   ├── assets/             Brand logos and icons (6 files)
│   ├── blocks/             Block definitions and registry (11 files)
│   ├── components/         UI components — app chrome, canvas, editors, primitives
│   ├── contexts/           React context providers (9 files)
│   ├── docs/               In-app documentation index (2 files)
│   ├── engine/             WASM integration: worker, job manager, bridge (24 files)
│   ├── hooks/              Custom React hooks (7 files)
│   ├── i18n/               Internationalization config + 6 locale files
│   ├── lib/                Core business logic and service adapters (~107 files)
│   ├── observability/      Logging, redaction, telemetry (9 files)
│   ├── pages/              Page components (10 files + 5 settings sub-pages)
│   ├── perf/               Performance instrumentation (1 file)
│   ├── stores/             Zustand stores (11 files)
│   └── templates/          Template system (2 files)
├── functions/              Cloudflare Pages serverless functions (~2,108 LOC)
│   └── api/                14 endpoints: AI, Stripe, CSP reports, health checks
├── supabase/               Database schema
│   └── migrations/         46 SQL migration files (0001–0046)
├── scripts/                CI/build scripts (12 files)
├── e2e/                    Playwright E2E tests (18 spec files)
├── docs/                   Documentation (~64 markdown files)
└── public/                 Static assets, _headers (CSP), brand assets
```

### src/lib/ Breakdown (Core Business Logic)

| Subdirectory | Files | Purpose |
|---|---|---|
| `lib/` (root) | ~55 | Auth, entitlements, projects, canvases, storage, validation, export utils |
| `lib/aiCopilot/` | 10 | AI Copilot: risk scoring, patch execution, context minimization |
| `lib/chainsolvejson/` | 13 | .chainsolvejson export/import: model, hashes, roundtrip tests |
| `lib/pdf/` | 6 | PDF audit export: canvas capture, equations, SHA-256 |
| `lib/xlsx/` | 6 | Excel export: audit tables, project data |

### functions/api/ Breakdown

| File/Directory | Purpose |
|---|---|
| `_middleware.ts` | CORS middleware (origin allowlist) |
| `health.ts`, `healthz.ts`, `readyz.ts` | Health/liveness/readiness probes |
| `ai.ts` | AI Copilot endpoint (672 LOC — largest function) |
| `stripe/` | 6 handlers: webhook, checkout, portal, marketplace, connect |
| `report/` | CSP violation + client observability event ingestion |
| `security/csp-report.ts` | Legacy CSP endpoint (deprecated, kept for compat) |

---

## 2. Architectural Boundaries

### Adapter Boundary (UI vs Services)

**Rule**: UI components (`src/components/`) must not import Supabase directly.
**Enforcement**: `scripts/check-adapter-boundary.sh` (runs in CI).

**Compliant**: All `src/components/**` files. Type-only imports allowed.

**Known violations** (pages, not yet refactored):
- `src/pages/AppShell.tsx`
- `src/pages/CanvasPage.tsx`
- `src/pages/Settings.tsx`
- `src/pages/settings/BillingSettings.tsx`

### Engine Worker Boundary

The Rust/WASM engine runs in a Web Worker (`src/engine/worker.ts`). Communication is message-based via `jobManager.ts`. The engine has zero DOM/network access — pure computation only.

### Service Layer (`src/lib/`)

| Module | Key Exports | Boundary Role |
|---|---|---|
| `auth.ts` | `getCurrentUser()`, `signInWithPassword()`, MFA functions | Auth adapter |
| `profilesService.ts` | `getProfile(userId)` | Profile adapter |
| `entitlements.ts` | `resolveEffectivePlan()`, `isPro()`, feature gates | Pure logic (no I/O) |
| `reauth.ts` | `isReauthed()`, `markReauthed()` (10-min window) | Billing security |
| `sessionService.ts` | Device session CRUD | Session adapter |
| `storage.ts` | `uploadCsv()`, `uploadAssetBytes()` (50 MB limit) | Storage adapter |
| `supabase.ts` | Singleton Supabase client | Infrastructure |

---

## 3. Hot Zones

### Security / CSP

| File | Risk | Notes |
|---|---|---|
| `public/_headers` | HIGH | CSP policy definitions — must include `wasm-unsafe-eval` |
| `functions/api/report/csp.ts` | MEDIUM | CSP violation ingestion (32 KB limit, SHA-256 dedup) |
| `functions/api/security/csp-report.ts` | LOW | Legacy endpoint — deprecated |
| `src/observability/redact.ts` | HIGH | All PII/secret redaction centralized here |

### Auth

| File | Risk | Notes |
|---|---|---|
| `src/lib/auth.ts` | HIGH | MFA enrolment, session management, reauthentication |
| `src/lib/reauth.ts` | MEDIUM | 10-minute re-auth window for billing ops |
| `src/lib/sessionService.ts` | MEDIUM | Device session tracking, revocation |
| `src/lib/rememberMe.ts` | LOW | Client-side session persistence preference |

### Billing / Stripe

| File | Risk | Notes |
|---|---|---|
| `functions/api/stripe/webhook.ts` | HIGH | Subscription lifecycle, signature verification |
| `functions/api/stripe/create-checkout-session.ts` | HIGH | Pro/Enterprise checkout with trial logic |
| `functions/api/stripe/marketplace-checkout.ts` | HIGH | Platform fees (15%), Connect payouts |
| `src/pages/settings/BillingSettings.tsx` | MEDIUM | Re-auth gate before billing ops |

### Persistence

| File | Risk | Notes |
|---|---|---|
| `src/lib/storage.ts` | MEDIUM | 50 MB upload limit, path validation |
| `src/lib/validateStoragePath.ts` | HIGH | Prevents directory traversal |
| `src/lib/canvasStorage.ts` | MEDIUM | Auto-save with conflict detection |
| `supabase/migrations/0011_rls_perf_canonical.sql` | HIGH | Canonical RLS form for 6 tables |

### Exports

| File | Risk | Notes |
|---|---|---|
| `src/lib/chainsolvejson/` | MEDIUM | Full project export with SHA-256 integrity |
| `src/lib/pdf/` | MEDIUM | PDF audit report with equations |
| `src/lib/xlsx/` | MEDIUM | Excel audit export |
| `src/lib/export-file-utils.ts` | LOW | Download blob, safe filename helpers |

### AI Copilot

| File | Risk | Notes |
|---|---|---|
| `functions/api/ai.ts` | HIGH | LLM proxy, token quota, enterprise policy |
| `src/lib/aiCopilot/riskScoring.ts` | MEDIUM | Safety assessment before patch application |
| `src/lib/aiCopilot/patchExecutor.ts` | MEDIUM | Graph mutation with error recovery |
| `src/lib/aiCopilot/contextMinimizer.ts` | LOW | Token budget management |

---

## 4. Dead Code Candidates

### Confirmed Dead / Stale

| Location | Evidence | Recommendation |
|---|---|---|
| `functions/api/security/csp-report.ts` (114 LOC) | Legacy endpoint — replaced by `functions/api/report/csp.ts`. Both still active. | Document deprecation; remove after migration window |
| `.gitignore` line `crates/engine-wasm/pkg.claude/` | Stale entry — directory never existed. `pkg/.gitignore` handles the actual output. | **Already removed** (F1-1) |

### Verified NOT Dead

All `src/lib/*.ts` exports are imported somewhere. Zero orphan modules detected. Test files (44 `.test.ts`) are exercised by vitest and must remain.

---

## 5. Duplicated Logic Candidates

### SHA-256 Hashing (3 implementations)

| Location | Function | Signature | Use Case |
|---|---|---|---|
| `src/lib/pdf/sha256.ts` | `sha256Hex(text)` | `(string) => Promise<string>` | PDF export integrity |
| `src/lib/chainsolvejson/hashes.ts` | `sha256BytesHex(bytes)` | `(Uint8Array) => Promise<string>` | .chainsolvejson export |
| `src/observability/redact.ts` | `hashString(input)` | `(string) => Promise<string>` | Event fingerprinting |

**Finding**: `sha256Hex()` and `hashString()` are byte-for-byte identical implementations. `sha256BytesHex()` differs only in accepting `Uint8Array` instead of `string`.

**Recommendation**: Consolidate into a single `src/lib/crypto.ts` with `sha256Text()` and `sha256Bytes()`.

### String Truncation (3 implementations in functions/)

| Location | Function | Default Max |
|---|---|---|
| `functions/api/report/client.ts:45` | `str(v, max)` | 2048 |
| `functions/api/report/csp.ts:38` | `str(v, max)` | 2000 |
| `functions/api/security/csp-report.ts:100` | `str(v, max)` | (none) |

**Recommendation**: Extract to `functions/api/_lib.ts` alongside existing `jsonError()`.

### SHA-256 in functions/ (3 implementations)

| Location |
|---|
| `functions/api/report/client.ts:69` |
| `functions/api/report/csp.ts:67` |
| `functions/api/security/csp-report.ts:108` |

All three are identical `crypto.subtle.digest('SHA-256', ...)` wrappers.

**Recommendation**: Extract to `functions/api/_lib.ts`.

### JWT Verification Pattern (4 repetitions in functions/)

The same ~8-line Bearer token extraction + `supabaseAdmin.auth.getUser(token)` pattern appears in all four Stripe checkout handlers.

**Recommendation**: Extract to `functions/api/stripe/_lib.ts` as `authenticateRequest(request, env)`.

### localStorage Keys (28 keys across 15 modules)

Keys follow consistent `cs:*` naming but are defined locally in each module:

```
cs:recent, cs:favs           → blockLibraryUtils.ts
cs:remember_me               → rememberMe.ts
cs:prefs                     → preferencesStore.ts
cs:pinnedProjects             → pinnedProjects.ts
cs:session_id                → sessionService.ts
cs:active-theme, cs:custom-themes → customThemesStore.ts
cs:custom-materials           → customMaterialsStore.ts
cs:blockedUsers              → blockedUsers.ts
cs:lang                      → i18nPersistence
cs:dockHeight                → BottomDock.tsx
cs:window-geometry           → WindowManagerContext.tsx
cs:debug.*                   → debugConsoleStore.ts
```

**Finding**: No actual duplicates — each key is defined once. Scattered but intentional (co-located with usage).

**Recommendation**: Optional: create `src/lib/storageKeys.ts` constant map for discoverability. Low priority.

---

## 6. Dependency Risk Summary

### npm Dependencies (Production)

| Package | Version | Footprint | Risk | Notes |
|---|---|---|---|---|
| `@supabase/supabase-js` | ^2.97.0 | ~150 KB | LOW | Auth, DB, storage — core dependency |
| `@xyflow/react` | ^12.10.1 | ~200 KB | LOW | Canvas graph UI — core dependency |
| `react` / `react-dom` | ^19.2.0 | ~140 KB | LOW | Framework |
| `vega` + `vega-lite` | ^6.2.0 / ^6.4.2 | ~800 KB | MEDIUM | Heavy — lazy-loaded for plot blocks |
| `pdf-lib` | ^1.17.1 | ~400 KB | LOW | Lazy-loaded for PDF export |
| `write-excel-file` | ^3.0.5 | ~50 KB | LOW | Lazy-loaded for Excel export |
| `stripe` | ^20.3.1 | ~300 KB | LOW | Server-only (functions/), not in client bundle |
| `html-to-image` | ^1.11.13 | ~30 KB | LOW | Canvas screenshot capture |
| `dagre` | ^0.8.5 | ~50 KB | LOW | Graph layout algorithm |
| `i18next` | ^25.8.13 | ~40 KB | LOW | i18n framework |
| `zustand` | ^5.0.11 | ~10 KB | LOW | State management |

**Key observation**: Heavy deps (vega, pdf-lib, write-excel-file) are all lazy-loaded via dynamic `import()` — confirmed by bundle splits check in CI.

### Rust Dependencies

| Crate | Version | Risk | Notes |
|---|---|---|---|
| `serde` / `serde_json` | 1.x | LOW | Ubiquitous, well-audited |
| `wasm-bindgen` | 0.2 | LOW | Official Rust WASM bindings |
| `js-sys` | 0.3 | LOW | JS interop |
| `console_error_panic_hook` | 0.1 | LOW | Dev-only panic messages |

**WASM binary**: 424 KB raw, 145 KB gzipped (34.3% ratio). Well within budget.

---

## 7. Supabase Migration Summary

**Total**: 46 migrations (0001–0046), all transactional.

### Tables with RLS (10 total)

| Table | RLS | Policies | Access Model |
|---|---|---|---|
| profiles | Enabled | 4 | User owns own profile |
| projects | Enabled | 4 | User owns + org membership |
| fs_items | Enabled | 4 | Via project ownership |
| project_assets | Enabled | 4 | Via project ownership |
| bug_reports | Enabled | 2 | User inserts own |
| group_templates | Enabled | 4 | User owns own |
| marketplace_items | Enabled | 4 | Author + public read |
| marketplace_comments | Enabled | 3 | Author + public read |
| org_members | Enabled | 3+ | Org role hierarchy |
| user_sessions | Enabled | 4 | User owns own sessions |

### Service-Role-Only Tables (no user access)

| Table | Migration | Purpose |
|---|---|---|
| stripe_events | 0001 | Webhook event log |
| observability_events | 0013 | Telemetry sink |
| csp_reports | 0012 | CSP violation log |

### Restricted Schema Touches

No migrations directly modify `auth`, `storage`, or `realtime` schemas. All reference `auth.uid()` only in RLS policy expressions.

---

## 8. Scripts Inventory

### CI-Critical (verify-ci.sh pipeline)

| Order | Check | Script |
|---|---|---|
| 1 | Prettier format | `npm run format:check` |
| 2 | ESLint | `npm run lint` |
| 3 | Adapter boundary | `check-adapter-boundary.sh` |
| 4 | CSP allowlist | `check-csp-allowlist.mjs` |
| 5 | i18n hardcoded | `check-i18n-hardcoded.mjs` |
| 6 | i18n keys | `check-i18n-keys.mjs` |
| 7 | Billing functions | Inline check (no err.stack) |
| 8 | WASM build | `wasm-pack build --release` |
| 9 | WASM optimize | `optimize-wasm.mjs` |
| 10 | WASM exports | `check-wasm-exports.mjs` |
| 11 | TypeScript (app) | `tsc --noEmit` |
| 12 | TypeScript (functions) | `tsc -p functions/tsconfig.json` |
| 13 | Vitest | `npx vitest run` |
| 14 | Cargo test | `cargo test -p engine-core` |
| 15 | Vite build | `vite build` |
| 16 | Bundle size | `check-bundle-size.mjs` |
| 17 | Bundle splits | `check-bundle-splits.mjs` |
| 18 | Perf budget | `check-perf-budget.mjs` |
| 19 | Robots meta | `check-robots-meta.mjs` |

### Optional

| Script | Purpose |
|---|---|
| `verify-fast.sh` | Quick local checks (no Rust build) |
| `optimize-wasm.mjs` | wasm-opt post-processor (also called by verify-ci) |

---

## 9. Documentation Gaps

### Stale References

| Document | Issue |
|---|---|
| `docs/SETUP.md` (~line 70) | References deprecated `/api/security/csp-report` — should be `/api/report/csp` |
| `docs/ARCHITECTURE.md` (~line 85) | Same stale CSP endpoint reference |
| `docs/RELEASE.md` (line 28) | Attributes `observability_events` to migration 0012 — should be 0013 |

### Undocumented Features

| Feature | Migration | Status |
|---|---|---|
| User session management | 0046 | No dedicated doc |
| Comment rate limiting | 0043 | No dedicated doc |
| Avatar reports | 0039 | No dedicated doc |

### Doc Organization

The existing `docs/INDEX.md` is a comprehensive hub. The doc tree is well-organized with `DECISIONS/`, `observability/`, `performance/`, `architecture/`, `enterprise/`, `requirements/` subdirectories.

---

## 10. Overall Assessment

| Area | Score | Summary |
|---|---|---|
| **Code organization** | 9/10 | Clear boundaries, barrel exports, service layer |
| **Security** | 9/10 | RLS on all tables, centralized redaction, CSP enforced |
| **Test coverage** | 8/10 | 44 unit test files, 18 E2E specs, 20 golden fixtures |
| **Dependencies** | 9/10 | Minimal, heavy deps lazy-loaded, Rust deps clean |
| **Documentation** | 8/10 | Comprehensive but 3 stale refs and 3 undocumented features |
| **Code duplication** | 7/10 | SHA-256 x3 (src) + str/sha256 x3 (functions), JWT pattern x4 |
| **Dead code** | 9/10 | Only legacy CSP endpoint; zero unused exports |

**Overall: HEALTHY (8.4/10)**

The codebase is production-ready with well-enforced architectural boundaries. Primary cleanup opportunities are: consolidating duplicate hash/string utilities, fixing 3 stale doc references, and documenting 3 recent features.
