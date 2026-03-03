# Phase M Inventory

> Repo map, hot zones, dead code candidates, duplicated helpers.
> Generated 2026-03-03 as input for Phase M housekeeping.

---

## 1. Repo Map

```
ChainSolve-Web/
├── crates/
│   ├── engine-core/       Pure Rust engine (ops, eval, graph, catalog)
│   └── engine-wasm/       wasm-bindgen bindings → pkg/
├── src/
│   ├── assets/            Brand SVGs
│   ├── blocks/            Block definitions, catalog, registry, search metadata
│   ├── boot.ts            App bootstrap (WASM init + React mount)
│   ├── components/
│   │   ├── app/           App-chrome (AppHeader, SheetsBar, CommandPalette, OnboardingOverlay, etc.)
│   │   ├── canvas/        Canvas surface, Inspector, BlockLibrary, ContextMenu, nodes/, edges/, editors/
│   │   └── ui/            Primitive UI kit (Button, Modal, Toast, Input, Select, Tabs, etc.)
│   ├── contexts/          React contexts (Engine, Canvas, Theme, SettingsModal, WindowManager)
│   ├── docs/              In-app docs system
│   ├── engine/            Web Worker bridge, job manager, value formatters, WASM init
│   ├── hooks/             Custom hooks (useDebounce, useSessionGuard, useGraphEngine)
│   ├── i18n/              i18next config + 6 locale files (en, de, es, fr, it, he)
│   ├── lib/               Service layer + utilities (~100 files)
│   ├── observability/     Client telemetry (client, logger, diagnostics, redact, doctor)
│   ├── pages/             Route-level pages (AppShell, CanvasPage, Login, Settings, etc.)
│   ├── perf/              Performance marks helper
│   ├── stores/            Zustand stores (project, canvases, preferences, variables, debug)
│   ├── templates/         Built-in starter templates
│   └── units/             Unit catalog, compatibility, symbols
├── functions/             Cloudflare Pages Functions
│   └── api/
│       ├── _env.ts        Canonical CfEnv type + requireEnv()
│       ├── _middleware.ts CORS middleware
│       ├── ai.ts          POST /api/ai (AI copilot proxy)
│       ├── health.ts      GET /api/health
│       ├── healthz.ts     GET /api/healthz
│       ├── readyz.ts      GET /api/readyz
│       ├── report/        csp.ts + client.ts (active receivers)
│       ├── security/      csp-report.ts (LEGACY, no new traffic)
│       ├── stripe/        Checkout, portal, marketplace, connect, webhook
│       └── student/       Student license request + confirm
├── e2e/                   Playwright E2E tests (19 spec files)
├── supabase/migrations/   54 SQL migration files (0001-0054)
├── docs/                  74 markdown files across 8 subdirectories
├── scripts/               13 CI/tooling scripts (all actively used)
├── packages/              Stubs only (desktop/, mobile/, shared/ — README.md each)
├── perf/                  Standalone graph generator for benchmarks
├── public/                Static assets (_headers, _redirects, favicons, og images, robots.txt, sitemap.xml)
├── cs                     Custom dev CLI (./cs new/test/push/ship/hotfix)
└── [config files]         package.json, Cargo.toml, vite.config.ts, vitest.config.ts, etc.
```

---

## 2. Scripts Inventory

### scripts/ directory (13 files, all actively used in verify-ci.sh)

| Script | Purpose |
|---|---|
| `verify-ci.sh` | Full CI gate (prettier, eslint, adapter-boundary, wasm, tsc, vitest, cargo, vite, bundle) |
| `verify-fast.sh` | Quick subset (no WASM/cargo) |
| `check-adapter-boundary.sh` | No Supabase calls from src/components/ |
| `check-bundle-size.mjs` | JS/WASM bundle budgets |
| `check-bundle-splits.mjs` | Lazy-split verification |
| `check-csp-allowlist.mjs` | CSP origin validation |
| `check-i18n-hardcoded.mjs` | Hardcoded UI string detection |
| `check-i18n-keys.mjs` | Locale key parity |
| `check-perf-budget.mjs` | Lazy chunk counts, WASM gzip ratio |
| `check-robots-meta.mjs` | Robots noindex guard |
| `check-wasm-exports.mjs` | Required WASM export validation |
| `generate-licenses.mjs` | THIRD_PARTY_NOTICES.md generation/check |
| `optimize-wasm.mjs` | wasm-opt on WASM binary |

### Root: `./cs` CLI

Custom Bash dev CLI with commands: `new`, `test`, `test --full`, `push`, `ship`, `hotfix`, `help`.
Actively used but should be documented in M1-2 or replaced by npm scripts.

---

## 3. Hot Zones (files > 500 lines)

### TypeScript/TSX

| File | Lines | Notes |
|---|---|---|
| `src/components/canvas/CanvasArea.tsx` | ~2,314 | Largest file. Node placement, drag, group ops, keyboard handlers. |
| `src/pages/CanvasPage.tsx` | ~1,997 | Project load/save, autosave, history, modal orchestration. |
| `src/pages/AppShell.tsx` | ~1,807 | Navigation, session guard, project management. |
| `src/components/app/AppHeader.tsx` | ~1,508 | All menu definitions, lazy modals, keyboard shortcuts. |
| `src/components/canvas/BlockLibrary.tsx` | ~1,209 | Search, filter, drag, favorites. |
| `src/pages/DocsPage.tsx` | ~1,116 | In-app docs rendering. |
| `src/pages/ItemDetailPage.tsx` | ~1,045 | Marketplace item detail. |
| `src/blocks/registry.ts` | ~927 | All block definitions + custom function registration. |
| `src/pages/MarketplacePage.tsx` | ~906 | Marketplace listing + filtering. |
| `src/components/app/SheetsBar.tsx` | ~865 | Multi-canvas tab bar. |
| `src/blocks/eng-blocks.ts` | ~857 | Engineering block definitions. |
| `src/components/canvas/Inspector.tsx` | ~756 | Node inspector panel. |
| `src/components/canvas/CanvasToolbar.tsx` | ~698 | Toolbar actions. |
| `src/blocks/fin-stats-blocks.ts` | ~690 | Finance + stats block definitions. |

### Rust

| File | Lines | Notes |
|---|---|---|
| `crates/engine-core/src/ops.rs` | ~2,863 | All op implementations. Expected large. |
| `crates/engine-core/src/catalog.rs` | ~1,508 | Op catalog metadata. |
| `crates/engine-core/src/graph.rs` | ~1,034 | Graph eval + DAG traversal. |

---

## 4. Dead Code Candidates

### 4a. Replaced modals (safe to delete)

| File | Replaced by | Evidence |
|---|---|---|
| `src/components/BugReportModal.tsx` | `FeedbackModal.tsx` | Zero production imports; tests assert NOT imported |
| `src/components/SuggestionModal.tsx` | `FeedbackModal.tsx` | Zero production imports; tests assert NOT imported |

### 4b. Test-only modules (no production consumers)

| File | Exports | Notes |
|---|---|---|
| `src/lib/tokens.ts` | `Z`, `FONT_WEIGHT` | Only imported in `tokens.test.ts`. Inline values used instead. |
| `src/lib/wcagContrast.ts` | `contrastRatio`, `meetsAA`, `meetsAAA` | Only imported in `wcagContrast.test.ts`. No component uses it. |
| `src/lib/platform.ts` | `IS_WEB`, `IS_DESKTOP`, `PLATFORM` | Only imported in `platform.test.ts`. Stub for future desktop/mobile. |
| `src/lib/offlineQueue.ts` | `OfflineQueue`, `offlineQueue` | Singleton never imported in production. |
| `src/lib/orgPolicyEnforcement.ts` | `applyOrgPolicyOverrides`, `getBlockedFeatures` | Never called in production code. |

### 4c. Legacy endpoint

| File | Notes |
|---|---|
| `functions/api/security/csp-report.ts` | Legacy `/api/security/csp-report`. CSP now routes to `/api/report/csp`. Safe to delete after drain period. |

### 4d. Stub packages

| Path | Contents |
|---|---|
| `packages/desktop/` | README.md only |
| `packages/mobile/` | README.md only |
| `packages/shared/` | README.md only |

---

## 5. Duplicated Helpers

### 5a. `readLocale()` — 4 test files

Identical function in:
- `src/components/feedbackModal.test.ts`
- `src/components/powerUserWorkflows.test.ts`
- `src/pages/projectManager.test.ts`
- `src/i18n/microcopy.test.ts` (slightly different return type)

**Fix:** Extract to `src/i18n/testHelpers.ts`.

### 5b. `sha256()` — 3 function files

Identical Web Crypto helper in:
- `functions/api/report/csp.ts`
- `functions/api/report/client.ts`
- `functions/api/security/csp-report.ts` (legacy)

**Fix:** Extract to `functions/api/_crypto.ts`.

### 5c. `str()` / truncation helpers — 3 function files

Similar stringify+truncate in:
- `functions/api/report/csp.ts` — `str(v, max=2000)`
- `functions/api/report/client.ts` — `str(v, max=2048)`
- `functions/api/security/csp-report.ts` — `str(v)` + `trunc(s, max)`

**Fix:** Extract to `functions/api/_utils.ts`.

### 5d. `type Env` — 12+ function files

Each defines its own local `type Env` despite `_env.ts` exporting `CfEnv`.
**Fix:** Migrate to `import type { CfEnv } from '../_env'`.

### 5e. Performance budget docs overlap

- `docs/perf-budget.md` (193 lines, flat legacy)
- `docs/performance/budgets.md` (114 lines, structured)

Significant overlap in tables and thresholds.
**Fix:** Merge into `docs/performance/budgets.md`, delete flat file.

---

## 6. Supabase Migrations (54 files)

`supabase/migrations/0001_init.sql` through `0054_project_folders.sql`.

Key clusters:
- **0001-0005**: Core schema (profiles, projects, storage)
- **0006-0011**: Entitlements, bug reports, RLS hardening
- **0012-0013**: Observability tables
- **0014-0016**: Multi-canvas, variables, advisor fixes
- **0017**: Asset SHA-256
- **0018-0025**: Marketplace (items, versions, reviews, installs, analytics)
- **0026**: Moderator flag
- **0027-0029**: Organizations + org-scoped RLS
- **0030-0035**: Audit log, explore, comments, org scope, policy flags
- **0036-0038**: Seat limits, trigger security, policy consolidation
- **0039-0044**: Avatar reports, AI copilot, roles, rate limits, org enforcement
- **0045-0046**: Terms/marketing, user sessions
- **0047-0048**: Suggestions, screenshots
- **0049-0054**: Official flag, student license, enterprise, user data model, developer role, folders

---

## 7. Documentation (74 files in docs/)

Key directories:
- `docs/AUDIT/` (3 files including this one)
- `docs/DECISIONS/` (5 ADRs)
- `docs/DEV/` (3 developer guides)
- `docs/enterprise/` (3 enterprise docs)
- `docs/observability/` (4 observability docs)
- `docs/performance/` (7 perf docs)
- `docs/requirements/` (8 requirement docs)
- 50+ flat files in `docs/` root

---

## 8. Cleanup Priority Summary

| Priority | Item | Risk |
|---|---|---|
| **P1 (safe delete)** | `BugReportModal.tsx`, `SuggestionModal.tsx` | None — fully replaced |
| **P1 (safe delete)** | `functions/api/security/csp-report.ts` | Low — legacy, no new traffic |
| **P2 (dedup)** | Extract `readLocale()` test helper | None |
| **P2 (dedup)** | Extract `sha256()` + `str()` in functions/ | None |
| **P2 (dedup)** | Migrate local `type Env` to `CfEnv` | None |
| **P3 (verify first)** | Dead modules: tokens, wcagContrast, platform, offlineQueue, orgPolicyEnforcement | May be future-facing stubs |
| **P3 (docs)** | Merge `perf-budget.md` into `performance/budgets.md` | None |
| **P4 (stubs)** | Decide: keep or remove `packages/desktop,mobile,shared/` | Informational only |
