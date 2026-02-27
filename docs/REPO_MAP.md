# ChainSolve — Repo Map

> **Task-oriented guide.** Use this when you know *what* you want to change
> but aren't sure *where* to find the code.

For a structural overview of the whole system, see [ARCHITECTURE.md](ARCHITECTURE.md).
For step-by-step recipes on the most common tasks, see [CONVENTIONS.md](CONVENTIONS.md).

---

## "I want to add / change a block operation"

| Step | File(s) | Notes |
|------|---------|-------|
| 1. Implement the op in Rust | `crates/engine-core/src/ops.rs` | Pure functions; add to the appropriate `match` arm |
| 2. Register op in catalog | `crates/engine-core/src/catalog.rs` | `CATALOG` constant; sets op name, arity, output type |
| 3. Add Rust tests | `crates/engine-core/tests/` | Golden fixtures (`.fixture.json`) + unit tests |
| 4. Bump contract version? | `crates/engine-core/src/catalog.rs` | Only if evaluation semantics change — see `CONTRIBUTING.md §1` |
| 5. Add block metadata in TS | `src/blocks/` (pick the right pack file) | `reg()` call with ports, label, category |
| 6. Register the pack | `src/blocks/registry.ts` | Already imported; just call `reg()` in the right section |
| 7. Add i18n label | `src/i18n/locales/en.json` (+ es/fr/it/de) | Key: `blocks.<blockType>` |
| 8. Build + test | `npm run wasm:build && npm run build` | Then `npm run test:e2e:smoke` |

Full walkthrough: [CONVENTIONS.md §Adding a new block op](CONVENTIONS.md#adding-a-new-block-op-end-to-end).

---

## "I want to change how the engine evaluates something"

| What | File(s) |
|------|---------|
| Add or modify a scalar op | `crates/engine-core/src/ops.rs` |
| Change broadcasting rules | `crates/engine-core/src/eval.rs` |
| Change NaN/Infinity handling | `crates/engine-core/src/eval.rs` + golden tests |
| Change the evaluation order | `crates/engine-core/src/graph.rs` (Kahn's topo sort) |
| Change the incremental eval / dirty propagation | `crates/engine-core/src/graph.rs` |
| Update the TypeScript ↔ Rust boundary | `src/engine/bridge.ts`, `src/engine/wasm-types.ts`, `crates/engine-wasm/src/lib.rs` |
| Add a new patch operation type | `src/engine/wasm-types.ts` + `crates/engine-wasm/src/lib.rs` + `src/engine/diffGraph.ts` |

---

## "I want to change the canvas UI"

| What | File(s) |
|------|---------|
| Node appearance (scalar/math) | `src/components/canvas/nodes/OperationNode.tsx` |
| Node appearance (source/constants) | `src/components/canvas/nodes/SourceNode.tsx` |
| Node appearance (display/output) | `src/components/canvas/nodes/DisplayNode.tsx` |
| Node appearance (data/CSV) | `src/components/canvas/nodes/DataNode.tsx` |
| Node appearance (plot/chart) | `src/components/canvas/nodes/PlotNode.tsx` |
| Node appearance (group) | `src/components/canvas/nodes/GroupNode.tsx` |
| Shared inline styles | `src/components/canvas/nodes/nodeStyles.ts` |
| Block palette (left sidebar) | `src/components/canvas/BlockLibrary.tsx` |
| Property inspector (right sidebar) | `src/components/canvas/Inspector.tsx` |
| Canvas drag-drop, keyboard shortcuts, layout | `src/components/canvas/CanvasArea.tsx` |
| Right-click context menus | `src/components/canvas/ContextMenu.tsx` |
| Quick-add palette (floating picker) | `src/components/canvas/QuickAddPalette.tsx` |

---

## "I want to change the billing / plan gating"

| What | File(s) |
|------|---------|
| Plan tier definitions + entitlement matrix | `src/lib/entitlements.ts` |
| Upgrade prompt modal | `src/components/UpgradeModal.tsx` |
| Billing settings page (manage/upgrade UI) | `src/pages/settings/BillingSettings.tsx` |
| Stripe checkout session | `functions/api/stripe/create-checkout-session.ts` |
| Stripe customer portal | `functions/api/stripe/create-portal-session.ts` |
| Stripe webhook (subscription sync) | `functions/api/stripe/webhook.ts` |
| DB enforcement trigger | `supabase/migrations/0006_entitlements_enforcement.sql` |
| Storage RLS for paid plans | `supabase/migrations/0006_entitlements_enforcement.sql` |

---

## "I want to add a new API route (Cloudflare Function)"

1. Create `functions/api/<route>.ts` exporting `onRequest` or `onRequestPost`.
2. Add it to `functions/tsconfig.json` (or confirm it's covered by the glob).
3. Add a module header comment (see `functions/api/health.ts` as template).
4. Run `npm run typecheck:functions` to verify.
5. Test locally: `wrangler pages dev dist --compatibility-date=...`
6. The CORS middleware (`functions/api/_middleware.ts`) runs automatically for
   all `/api/*` routes — no extra wiring needed.

---

## "I want to add a new DB table"

1. Create `supabase/migrations/NNNN_description.sql` (next number in sequence).
2. Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
3. Write policies using the `(select auth.uid())` pattern (not `auth.uid()` —
   see [ADR-0004](DECISIONS/ADR-0004-supabase-rls.md) for why).
4. Add indexes for foreign keys (Supabase advisor requirement).
5. Update `docs/ARCHITECTURE.md` (Data Model section).
6. Update `docs/SETUP.md` (migrations table).
7. Never edit or delete existing migration files — migrations are append-only.

---

## "I want to change the Content Security Policy"

Files to edit:

- `public/_headers` — the actual deployed headers (both enforced + report-only lines)

Read [SECURITY.md §2](SECURITY.md#2-content-security-policy-csp) before changing
anything.  The `'wasm-unsafe-eval'` directive in `script-src` is load-bearing
(the Rust/WASM engine fails without it) and is protected by a Playwright smoke
test.

---

## "I want to add a new language / update translations"

| What | File(s) |
|------|---------|
| Add/update translation keys | `src/i18n/locales/en.json` (master) |
| Sync other languages | `src/i18n/locales/{es,fr,it,de}.json` |
| Add a new language | `src/i18n/config.ts` (add to `supportedLngs`) + new locale file |
| Add a language picker option | `src/pages/settings/PreferencesSettings.tsx` |

---

## "I want to understand the boot sequence"

```
index.html
  └── src/boot.ts              (no static imports — catches module init errors)
        └── dynamic import('./main')
              └── src/main.tsx (React root: ErrorBoundary + ToastProvider + App)
                    └── src/App.tsx (BrowserRouter + routes)
```

WASM engine boot (parallel to React mount):

```
src/engine/index.ts  createEngine()
  └── new Worker(src/engine/worker.ts)
        └── worker: import '@engine-wasm' (loads .wasm via Vite/fetch)
              └── worker: WasmEngine.new() → EngineGraph initialized
                    └── worker: postMessage({type:'ready'})
  └── index.ts: sets testid 'engine-ready' | 'engine-fatal'
```

---

## File ownership map

| Subsystem | Primary files | Secondary |
|-----------|---------------|-----------|
| Compute engine (Rust) | `crates/engine-core/` | `crates/engine-wasm/` |
| Engine bridge (TS) | `src/engine/` | `src/blocks/` |
| Canvas UI | `src/components/canvas/` | `src/contexts/` |
| Auth + data | `src/lib/supabase.ts`, `src/lib/projects.ts`, `src/lib/storage.ts` | `src/stores/` |
| Billing | `functions/api/stripe/`, `src/lib/entitlements.ts` | `src/pages/settings/BillingSettings.tsx` |
| Database schema | `supabase/migrations/` | — |
| Security headers | `public/_headers` | `functions/api/_middleware.ts` |
| i18n | `src/i18n/` | — |
| CI / deploy | `.github/workflows/ci.yml`, `.github/workflows/e2e-full.yml` | `wrangler.jsonc` |
| Exports | `src/lib/pdf/`, `src/lib/xlsx/`, `src/lib/chainsolvejson/` | `src/lib/export-file-utils.ts` |
| Observability | `src/observability/` | — |

---

## Folder purpose map

| Path | Purpose |
|------|---------|
| `crates/engine-core/` | Pure Rust computation engine: ops, eval, graph topo-sort, catalog, validation |
| `crates/engine-wasm/` | WASM wrapper generated by wasm-pack; exposes `WasmEngine` to TypeScript |
| `src/engine/` | TypeScript engine facade: Web Worker management, WASM bridge, watchdog |
| `src/blocks/` | Block registry and metadata packs (ops, constants, eng, fin, data, plot) |
| `src/components/` | React UI components (canvas nodes, sidebar, modals, app shell) |
| `src/contexts/` | React context providers (engine, bindings, computed values, settings modal) |
| `src/stores/` | Zustand global stores (project, canvases, variables, debug console) |
| `src/hooks/` | Custom React hooks (graph history, mobile detect, focus trap) |
| `src/pages/` | Route-level page components (app shell, canvas, login, settings) |
| `src/lib/` | Service layer: Supabase adapters, export infrastructure, helpers |
| `src/lib/pdf/` | PDF export (pdf-lib, audit model, sha256, stableStringify) |
| `src/lib/xlsx/` | Excel export (write-excel-file, workbook builders) |
| `src/lib/chainsolvejson/` | .chainsolvejson export/import/validate/round-trip |
| `src/observability/` | Error reporting, telemetry, redaction, diagnostics |
| `src/i18n/` | i18next config + locale JSON files (en/es/fr/de/it) |
| `src/assets/` | Brand SVGs; no raster images committed |
| `functions/` | Cloudflare Workers API routes (Stripe, health, CSP report) |
| `supabase/migrations/` | Append-only SQL migrations; never edit existing files |
| `docs/` | Human-readable specs, ADRs, guides |
| `e2e/` | Playwright end-to-end tests |
| `perf/` | Performance graph generators for stress testing |
| `scripts/` | Build automation (verify-ci, check-bundle-size, optimize-wasm, etc.) |
| `public/` | Static assets served at root (brand images, _headers CSP) |

---

## Key architectural boundaries

### 1. Engine Worker boundary (critical)
- Main thread uses `src/engine/index.ts` (`EngineAPI`) — never import WASM directly from UI.
- Worker entry: `src/engine/worker.ts`; protocol: `src/engine/wasm-types.ts`.
- 5-second watchdog auto-respawns hung workers.
- Do not change the `WorkerRequest`/`WorkerResponse` message shape without updating both sides.

### 2. Adapter / Supabase boundary (global invariant)
- `src/lib/supabase.ts` — the singleton client; import only from service files in `src/lib/`.
- **UI components and canvas components must NOT import `supabase` directly.**
- Pages (`src/pages/`) may import Supabase for auth/session checks; canvas nodes may not.
- Enforcement: see `P043` in ROADMAP_CHECKLIST.md.

### 3. Export infrastructure boundary
- All downloads go through helpers in `src/lib/export-file-utils.ts` (canonical `downloadBlob`, `safeName`, `formatTimestampForFilename`).
- Hash utilities: `src/lib/pdf/sha256.ts` and `src/lib/pdf/stableStringify.ts` are the single canonical implementations; `src/lib/chainsolvejson/hashes.ts` re-exports them — do not duplicate.
- Redaction: `src/observability/redact.ts` is the single canonical implementation — do not duplicate.

### 4. CSP boundary (critical)
- `public/_headers` controls the deployed CSP.
- `wasm-unsafe-eval` in `script-src` is load-bearing — do not remove.
- No `unsafe-eval`, no inline scripts, no new external origins without review.
- Validated by a Playwright smoke test on every CI run.

---

## "Do not touch casually" list

These files have disproportionate blast radius. Changes need explicit review:

| File / path | Why it's sensitive |
|-------------|-------------------|
| `public/_headers` | The actual deployed CSP; regression breaks the app for all users |
| `scripts/verify-ci.sh` | Gate for all roadmap items; weakening it breaks the whole process |
| `crates/engine-core/src/catalog.rs` | Contract version; changing semantics requires version bump + migration |
| `crates/engine-core/src/eval.rs` | Core evaluation logic; bugs are silent and affect all users |
| `src/engine/wasm-types.ts` | Worker protocol; schema mismatches cause silent hangs |
| `src/lib/supabase.ts` | Boot-time validation; misconfiguration causes prod outages |
| `supabase/migrations/` | Append-only; editing existing files corrupts deployed DBs |
| `src/lib/pdf/stableStringify.ts` | Determinism contract; changes break golden test hashes |
| `src/lib/pdf/sha256.ts` | CSP-safe crypto; must stay on Web Crypto API |
| `src/observability/redact.ts` | Privacy guarantees; weakening allows secret leakage |
| `.github/workflows/ci.yml` | The authoritative CI definition; drift from verify-ci.sh is confusing |

---

## Hygiene findings (RH-1 report — 2026-02-27)

### Confirmed unused files
| File | Status |
|------|--------|
| `src/assets/react.svg` | Never imported; Vite scaffold artifact → **removed in RH-3** |

### Duplicate helpers (consolidated in RH-4)
| Helper | Was duplicated in | Canonical location after RH-4 |
|--------|-------------------|-------------------------------|
| `downloadBlob()` | `src/lib/pdf/exportAuditPdf.ts`, `src/lib/chainsolvejson/exportChainsolveJson.ts` | `src/lib/export-file-utils.ts` |
| `safeName()` | all three export modules | `src/lib/export-file-utils.ts` |
| `formatTimestampForFilename()` | `src/lib/pdf/exportAuditPdf.ts`, `src/lib/chainsolvejson/exportChainsolveJson.ts` | `src/lib/export-file-utils.ts` |

### No other dead code found
All folders and components are referenced. No dead menu stubs. No legacy paths. All routes are wired.
