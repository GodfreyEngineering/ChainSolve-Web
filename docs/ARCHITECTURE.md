# ChainSolve — Architecture

> Updated at each milestone. Current: **W9.5.5 (Production Hardening)**

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 | Strict mode: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` |
| Compute Engine | Rust → WASM (via wasm-pack) | `engine-core` (pure Rust) + `engine-wasm` (wasm-bindgen), runs in Web Worker (W9) |
| E2E Testing | Playwright | Chromium smoke tests (`e2e/smoke.spec.ts`) |
| CI | GitHub Actions | Typecheck, lint, build, e2e tests |
| Routing | react-router-dom v7 | BrowserRouter; `/` → `/app` → `/canvas` → `/settings` |
| Canvas | @xyflow/react (React Flow v12) | Node graph editor |
| i18n | react-i18next + i18next | EN/ES/FR/IT/DE; browser language detection |
| Hosting | Cloudflare Pages | Static build output + Pages Functions for APIs |
| Auth + DB | Supabase (supabase-js v2) | RLS enabled on all tables |
| Storage | Supabase Storage | Two private buckets: `projects`, `uploads` |
| Billing | Stripe v20 SDK | Checkout + Customer Portal + webhooks |
| Email | Resend via Supabase SMTP | Transactional auth emails |

---

## Directory Map

```
src/
  boot.ts         True bootloader (no static imports): catches import-time TDZ/module errors (W5.2)
  blocks/         Block definitions and registry
    types.ts      Shared types: BlockCategory, NodeKind, PortDef, NodeData, BlockDef (W5.2)
    registry.ts   All block types, categories, port definitions, evaluate fns
    data-blocks.ts    Data input blocks: vectorInput, tableInput, csvImport (W5)
    vector-blocks.ts  Vector operation blocks: length, sum, mean, min, max, sort, etc. (W5)
    table-blocks.ts   Table operation blocks: filter, sort, column, addColumn, join (W5)
    plot-blocks.ts    Plot blocks: xyPlot, histogram, barChart, heatmap (W6, Pro-only)
  components/
    canvas/       Canvas UI components
      nodes/      Custom React Flow node renderers (SourceNode, OperationNode, DisplayNode, DataNode, PlotNode, GroupNode)
      editors/    Inline editors for data nodes (VectorEditor, TableEditor, CsvPicker) (W5)
      BlockLibrary.tsx  Left-sidebar draggable block palette + templates section (W7)
      Inspector.tsx     Right-sidebar node property editor
      GroupInspector.tsx Group property sub-panel in Inspector (W7)
      PlotInspector.tsx Plot configuration sub-panel in Inspector (W6)
      PlotExpandModal.tsx Full-size plot modal with export buttons (W6)
      CanvasArea.tsx    ReactFlow wrapper with drag-drop, keyboard shortcuts, group ops
      ContextMenu.tsx   Right-click context menus (canvas/node/edge/selection/group)
      QuickAddPalette.tsx  Floating block picker
    ui/           Design system components (W3)
      Button.tsx  Primary/secondary/danger/ghost button
      Input.tsx   Text input with label/hint/error
      Modal.tsx   Dialog overlay with ESC close
      Toast.tsx   Toast notification provider + useToast hook
      Tabs.tsx    Tab bar component
      Select.tsx  Dropdown select with label/hint
      index.ts    Barrel export
    UpgradeModal.tsx  Upgrade prompt when project limit or feature gate is hit (W4)
    BugReportModal.tsx  In-app bug reporting modal (W5.3)
    ErrorBoundary.tsx   Top-level class-based error boundary
  contexts/
    ComputedContext.ts  React context for computed Map<nodeId,number>
  engine/
    value.ts      Polymorphic Value type system: Scalar | Vector | Table | Error (W5)
    evaluate.ts   TS evaluation engine (legacy, to be replaced by WASM engine)
                  Topological sort (Kahn's algorithm), NaN/Error propagation
    csv-parse.ts  Lightweight CSV parser (auto-detect separator, quoted fields) (W5)
    csv-worker.ts Web Worker for off-thread CSV parsing (W5)
    index.ts      WASM engine public API: createEngine() → EngineAPI (W9)
    worker.ts     Web Worker: loads WASM, protocol v2 message handlers (W9/W9.2)
    wasm-types.ts Typed messages, PatchOp, IncrementalEvalResult (W9/W9.2)
    bridge.ts     React Flow graph → EngineSnapshotV1 conversion (W9)
    wasm.d.ts     Type declarations for wasm-pack output (W9/W9.2)
    diffGraph.ts  React Flow state diff → PatchOp[] (W9.2)
    useGraphEngine.ts  Incremental evaluation hook for CanvasArea (W9.2)
  i18n/           Internationalization (W3)
    config.ts     i18next initialization + language detector
    locales/
      en.json     English (default)
      es.json     Spanish
      fr.json     French
      it.json     Italian
      de.json     German
  lib/
    supabase.ts     Browser Supabase client (anon key); throws CONFIG_INVALID in production if credentials missing/placeholder (W9.5.5)
    build-info.ts   Build metadata: version, SHA, build time, environment (W5.3)
    entitlements.ts Plan-based feature gating: getEntitlements, isPro, isReadOnly, canCreateProject, isBlockEntitled (W4/W6)
    projects.ts     Project CRUD: list, create, load, save, rename, delete, duplicate, import
    storage.ts      Storage helpers: saveProjectJson, uploadCsv, listProjectAssets, etc.
    vega-loader.ts  Lazy Vega/Vega-Lite/vega-interpreter loader (singleton, CSP-safe) (W6)
    groups.ts       Pure group operations: create, ungroup, collapse, expand, resize, template insert (W7)
    templates.ts    Template CRUD (Supabase group_templates table) (W7)
    plot-spec.ts    Pure Vega-Lite spec generation: inline (node) + full (modal) (W6)
    plot-export.ts  SVG/PNG/CSV export utilities + open-in-tab (W6)
    downsample.ts   LTTB downsampling algorithm for large datasets (W6)
    brand.ts        Centralized brand asset paths + theme helper (W6.1)
  assets/
    brand/          SVG brand assets for Vite bundling (only logo-wide-text.svg is small enough) (W6.1)
  pages/
    Login.tsx     Email/password login + signup
    AppShell.tsx  Protected dashboard: plan status, billing, project browser
    CanvasPage.tsx  Full-page node-graph editor (BlockLibrary + CanvasArea + Inspector)
    Settings.tsx  Settings layout with sidebar nav (W3)
    settings/
      ProfileSettings.tsx    Account info (email, user ID, plan, member since)
      BillingSettings.tsx    Subscription management (upgrade/manage)
      PreferencesSettings.tsx  Language, theme, build info, bug report (W5.3)
  stores/
    projectStore.ts  Zustand store: save lifecycle, project metadata
  App.tsx         Route tree (BrowserRouter)
  main.tsx        React entry point, ErrorBoundary + ToastProvider wrapper (loaded by boot.ts)

functions/
  api/
    _middleware.ts               CORS middleware for all /api/* routes (W8)
    health.ts                    GET /api/health — server-side env var presence check (W9.5.5)
    stripe/
      create-checkout-session.ts   POST /api/stripe/create-checkout-session
      create-portal-session.ts     POST /api/stripe/create-portal-session
      webhook.ts                   POST /api/stripe/webhook (Stripe events)
    security/
      csp-report.ts              POST /api/security/csp-report — CSP violation receiver (W8)
  tsconfig.json   Separate tsconfig for @cloudflare/workers-types

supabase/
  migrations/
    0001_init.sql             Full schema, RLS, storage buckets, triggers
    0002_storage_columns.sql  Adds projects.storage_key + project_assets.kind
    0003_projects_owner_id.sql  Renames user_id → owner_id + RLS fix
    0004_projects_description.sql  Adds projects.description
    0005_projects_storage_key_nullable.sql  Drops NOT NULL on storage_key
    0006_entitlements_enforcement.sql       Plan limit trigger, storage RLS tightening (W4)
    0007_bug_reports.sql                    In-app bug reporting table + RLS (W5.3)
    0008_advisor_fixes.sql                 ~~Superseded by 0009~~ — kept for history (W5.3.1)
    0009_advisor_fixes_v2.sql              Owner_id-safe advisor fixes: dynamic SQL auto-detection (W5.3.1b)
    0010_group_templates.sql             Group templates table + RLS (W7)

crates/
  engine-core/    Pure Rust compute engine: types, validation, evaluation, ops, graph (W9/W9.2)
  engine-wasm/    wasm-bindgen wrapper — persistent EngineGraph via thread_local (W9/W9.2)

e2e/
  smoke.spec.ts   Playwright smoke tests: title, meta tags, #root, engine-ready, _headers CSP check (W5.3/W9.5.x)
  plot-smoke.spec.ts  Plot feature smoke tests: block library, no CSP violations (W6)
  groups.spec.ts      Group feature smoke tests: DOM structure, keyboard shortcuts (W7)
  wasm-engine.spec.ts WASM engine e2e: init + evaluate via worker (W9)

.github/
  workflows/
    ci.yml        GitHub Actions: typecheck, lint, build, e2e tests (W5.3)

public/
  _headers        Cloudflare Pages security headers (CSP, HSTS, etc.) (W5.3)
  _redirects      SPA fallback for Cloudflare Pages
  robots.txt      Crawler policy: block app routes (W5.3)
  brand/          Static brand assets (SVGs + PNGs) served at /brand/* URLs (W6.1)

docs/
  SETUP.md        Production deploy guide
  UX.md           Canvas UX interaction rules
  PROJECT_FORMAT.md  project.json schema + versioning contract
  BRANDING.md     Brand asset management, naming conventions, theme variants (W6.1)
  PLOTTING.md     Plot blocks: chart types, export, CSP, downsampling, architecture (W6)
  GROUPS.md       Block groups + templates: usage, schema V3, Pro gating (W7)
  SECURITY.md     CORS, CSP, security headers, rollout docs (W8)
  W9_ENGINE.md    Rust/WASM compute engine: build, debug, extend ops (W9)
  ARCHITECTURE.md This file
```

---

## Data Model (Supabase)

```sql
plan_status ENUM: free | trialing | pro | past_due | canceled

profiles        id (FK auth.users), email, plan (plan_status), stripe_customer_id,
                stripe_subscription_id, current_period_end

projects        id, owner_id (FK profiles), name, description, storage_key

fs_items        id, project_id, user_id, parent_id (self-ref), name, type, content

project_assets  id, project_id, user_id, name (original filename), storage_path,
                mime_type, size (bytes), kind ('csv' | ...)

stripe_events   id (= Stripe event ID), type, payload (jsonb)

bug_reports     id, user_id (FK profiles), title, description, metadata (jsonb),
                created_at (W5.3)

group_templates id, owner_id (FK profiles), name, color, payload (jsonb),
                created_at, updated_at (W7)
```

RLS: all tables enable row-level security. Users own their rows via `owner_id = auth.uid()`.
Trigger: `handle_new_user()` auto-creates a `profiles` row on `auth.users` INSERT.
Trigger: `enforce_project_limit()` — BEFORE INSERT on projects, checks plan-based project limits (W4).

---

## Storage Conventions

| Bucket | Key pattern |
|--------|-------------|
| `projects` | `{userId}/{projectId}/project.json` |
| `uploads` | `{userId}/{projectId}/uploads/{timestamp}_{safeFilename}` |

RLS policy: `(storage.foldername(name))[1] = auth.uid()::text`

**Plan-gated policies (W4):**

- `uploads` INSERT/UPDATE: requires `user_has_active_plan(uid)` (trialing/pro only)
- `projects` INSERT/UPDATE: requires `user_can_write_projects(uid)` (blocked for canceled)

---

## Node Graph Engine

### Block types

**Scalar blocks (M1)**

| Category | Blocks |
|---|---|
| Input | Number, Slider |
| Math | Add, Subtract, Multiply, Divide, Negate, Abs, Sqrt, Power, Floor, Ceil, Round, Mod, Clamp |
| Trig | Sin, Cos, Tan, Asin, Acos, Atan, Atan2, DegToRad, RadToDeg |
| Constants | Pi, E, Tau, Phi |
| Logic | Greater, Less, Equal, IfThenElse, Max, Min |
| Output | Display |

**Data/Vector/Table blocks (W5, Pro-only)**

| Category | Blocks |
|---|---|
| Data | Vector Input, Table Input, CSV Import |
| Vector Ops | Length, Sum, Mean, Min, Max, Sort, Reverse, Slice, Concat, Map |
| Table Ops | Filter, Sort, Column, Add Column, Join |

**Plot blocks (W6, Pro-only)**

| Category | Blocks |
|---|---|
| Plot | XY Plot (line/scatter), Histogram, Bar Chart, Heatmap |

### Value type system (W5)

The engine uses a polymorphic `Value` type (`src/engine/value.ts`):

| Kind | Structure | Display |
|---|---|---|
| `scalar` | `{ kind: 'scalar', value: number }` | 6-sig-fig number |
| `vector` | `{ kind: 'vector', value: number[] }` | `[N items]` |
| `table` | `{ kind: 'table', columns: string[], rows: number[][] }` | `R×C table` |
| `error` | `{ kind: 'error', message: string }` | Error text |

Existing scalar blocks use the `wrapScalarEvaluate()` adapter — their registration code is unchanged.

### Block registration pattern (W5.2)

Block types are defined in `src/blocks/types.ts` to avoid circular imports. Block packs (data-blocks, vector-blocks, table-blocks, plot-blocks) export registration functions instead of importing `reg` from registry:

```
types.ts ← registry.ts (imports types, re-exports for backward compat)
types.ts ← data-blocks.ts (imports BlockDef)
data-blocks.ts ← registry.ts (imports registerDataBlocks, calls with reg)
```

Since W9.1, block definitions are **metadata only** — no `evaluate` functions. All
evaluation is handled by the Rust/WASM engine.

This eliminates the `registry → pack → registry` cycle that caused TDZ crashes (`ReferenceError: can't access lexical declaration before initialization`).

### Evaluation (Rust/WASM — incremental since W9.2)

All evaluation runs in the Rust/WASM engine via Web Worker. The TS evaluation
engine (`evaluate.ts`) was removed in W9.1.

1. `CanvasArea.tsx` uses `useGraphEngine(nodes, edges, engine)` hook
2. On first render: `loadSnapshot()` sends full graph to persistent `EngineGraph` in Rust
3. On changes: `diffGraph()` computes `PatchOp[]`, `applyPatch()` sends to Rust
4. Rust: dirty propagation → only re-evaluates changed nodes → returns `IncrementalEvalResult`
5. Result merged into `Map<nodeId, Value>` provided via `ComputedContext`

Block definitions in `src/blocks/registry.ts` are metadata-only (no evaluate functions).
See `docs/W9_ENGINE.md` and `docs/W9_2_SCALE.md` for full engine documentation.

### React Flow node types

| RF type key | Component | Used for |
|---|---|---|
| `csSource` | SourceNode | Number, Slider, Pi, E, Tau, Phi (0 inputs) |
| `csOperation` | OperationNode | All math/trig/logic/vector/table ops (1+ inputs, 1 output) |
| `csDisplay` | DisplayNode | Output/Display (1 input, shows computed value) |
| `csData` | DataNode | Vector Input, Table Input, CSV Import (0 inputs, 1 output) (W5) |
| `csPlot` | PlotNode | XY Plot, Histogram, Bar Chart, Heatmap (1 input, 0 outputs, Vega render) (W6) |
| `csGroup` | GroupNode | Visual container for grouped nodes (no I/O, parentId mechanism) (W7) |

---

## Design System (W3)

Reusable UI components in `src/components/ui/`:

| Component | Props | Description |
|---|---|---|
| `Button` | variant (primary/secondary/danger/ghost), size (sm/md/lg) | Styled button with hover transitions |
| `Input` | label, hint, error | Text input with label, hint text, error state |
| `Modal` | open, onClose, title, width | Dialog overlay with ESC close + click-outside |
| `Toast` | via `useToast()` hook | Toast notifications (info/success/error), auto-dismiss 3.5s |
| `Tabs` | tabs, active, onChange | Tab bar with underline active indicator |
| `Select` | label, hint, options | Dropdown select with custom arrow |

Design tokens defined in `src/index.css`:
- Primary: `#1CABB0`
- Background: `#1a1a1a`
- Card: `#383838`
- Text: `#F4F4F3`
- Fonts: Montserrat (UI) + JetBrains Mono (numbers)

---

## Internationalization (W3)

- Framework: react-i18next + i18next + i18next-browser-languagedetector
- Languages: English (default), Spanish, French, Italian, German
- Detection: localStorage key `cs:lang`, falls back to browser language
- Translation keys organized by namespace: app, nav, auth, projects, billing, canvas, settings, ui, time, entitlements, blocks, plot, groups

---

## Entitlements (W4)

Plan-based feature gating with **two layers of enforcement**:

### 1. Frontend (`src/lib/entitlements.ts`)

| Plan | maxProjects | CSV | Arrays | Plots | Rules | Groups/Templates | Canvas |
|------|-------------|-----|--------|-------|-------|------------------|--------|
| free | 1 | No | No | No | No | View only | Read-write |
| trialing | Unlimited | Yes | Yes | Yes | Yes | Full | Read-write |
| pro | Unlimited | Yes | Yes | Yes | Yes | Full | Read-write |
| past_due | 1 | No | No | No | No | View only | Read-write + banner |
| canceled | 1 | No | No | No | No | View only | **Read-only** + banner |

UI gating:

- **UpgradeModal** — shown when free/past_due users hit project limit or feature gate
- **Project limit** — "New Project" / "Import" / "Duplicate" disabled when at limit
- **Read-only canvas** — canceled users: no drag-drop, no delete, no connect, no node dragging
- **Billing banners** — past_due (amber) and canceled (red) banners on AppShell + CanvasPage

### 2. Backend (`0006_entitlements_enforcement.sql`)

- **`enforce_project_limit()`** — BEFORE INSERT trigger on `projects`: free/past_due max 1, canceled max 0
- **`user_has_active_plan(uid)`** — helper function: true for trialing/pro
- **`user_can_write_projects(uid)`** — helper function: false for canceled
- **Storage RLS** — uploads bucket INSERT/UPDATE gated by active plan; projects bucket blocked for canceled
- **Indexes** — `idx_projects_owner_id`, `idx_projects_owner_updated` for fast lookups

### Storage cleanup

`deleteProject()` now removes storage files from both `projects` and `uploads` buckets before deleting the DB row. Errors are best-effort (logged, not blocking).

---

## Environment Variables

| Variable | Used in |
|---|---|
| `VITE_SUPABASE_URL` | Browser (build-time injection). GitHub Secret. |
| `VITE_SUPABASE_ANON_KEY` | Browser. GitHub Secret. |
| `VITE_IS_CI_BUILD` | Set to `'true'` in `node_checks` CI build only — suppresses the placeholder-credential check in `supabase.ts`. **Must NOT be set in the `deploy` job.** (W9.5.5) |
| `SUPABASE_URL` | Cloudflare Pages Functions (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Pages Functions |
| `STRIPE_SECRET_KEY` | Cloudflare Pages Functions |
| `STRIPE_WEBHOOK_SECRET` | Cloudflare Pages Functions |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Cloudflare Pages Functions |

---

## Milestone / Wave Map

| Wave | Status | Description |
|---|---|---|
| M0 | ✅ Done | Repo hygiene, build stability, ErrorBoundary, scripts |
| M1 | ✅ Done | Canvas MVP: drag-drop blocks, scalar evaluation, inspector |
| W2 | ✅ Done | Projects: browser, autosave, conflict detection, import/export |
| W3 | ✅ Done | Design system, i18n (5 languages), settings pages, favicon/metadata |
| W4 | ✅ Done | Entitlements + backend enforcement: plan gating, UpgradeModal, read-only canvas, storage cleanup |
| W5 | ✅ Done | Arrays/Tables + CSV import (Pro): Value type system, 18 new blocks, DataNode + editors, CSV Web Worker |
| W5.1 | ✅ Done | Save fixpack: forwardRef snapshot, Save button, Ctrl+S, beforeunload, boot guard |
| W5.2 | ✅ Done | Circular import fix (TDZ crash), true bootloader, mobile baseline |
| W5.3 | ✅ Done | Production hardening: security headers, CI, Playwright e2e, build info, bug reporting |
| W6 | ✅ Done | Scientific plotting + export: 4 chart types (Vega-Lite), SVG/PNG/CSV export, CSP-safe, theme presets |
| W6.1 | ✅ Done | Brand pack integration: logos, favicon, login header, nav branding, plot export branding toggle |
| W7 | ✅ Done | Block groups + templates: csGroup node, collapse/expand, proxy handles, templates (Supabase), Pro gating |
| W8 | Done | Security perimeter: CORS middleware, CSP reporting, security headers |
| W9 | Done | Rust/WASM compute engine foundation: engine-core, engine-wasm, Worker integration, e2e |
| W9.1 | Done | Single source of truth: WASM sole engine, TS eval removed, ops catalog, fatal error screen |
| W9.2 | ✅ Done | Engine scale upgrade: persistent EngineGraph, dirty propagation, patch protocol, dataset registry |
| W9.5 | ✅ Done | Boot reliability: WASM worker, engine hook, smoke tests baseline |
| W9.5.1 | ✅ Done | Boot ladder fixpack: `boot-fatal` sentinel, `waitForEngineOrFatal` helper, smoke suite green |
| W9.5.2 | ✅ Done | Smoke suite hardening: 8-test suite, `dumpBootDiagnostics`, retry-safe timing |
| W9.5.3 | ✅ Done | CI preview parity: placeholder Supabase creds in `node_checks` build, two-build split, `VITE_IS_CI_BUILD` flag |
| W9.5.4 | ✅ Done | CSP fix for WASM: `'wasm-unsafe-eval'` in `script-src`, `WASM_CSP_BLOCKED` error code, `EngineFatalError` rewrite, `_headers` smoke test |
| W9.5.5 | ✅ Done | Production guardrails: strict `CONFIG_INVALID` in `supabase.ts`, CI secret validation + bundle grep, `GET /api/health` endpoint |
| W10 | Planned | Branching/rules for conditional flows (Pro) |
| W11 | Planned | Custom blocks editor (Pro) |
| W12 | Planned | Project/file browser with folders, search, tags |
