# ChainSolve — Architecture

> Updated at each milestone. Current: **W5.3 (Production Hardening)**

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 | Strict mode: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` |
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
  components/
    canvas/       Canvas UI components
      nodes/      Custom React Flow node renderers (SourceNode, OperationNode, DisplayNode, DataNode)
      editors/    Inline editors for data nodes (VectorEditor, TableEditor, CsvPicker) (W5)
      BlockLibrary.tsx  Left-sidebar draggable block palette
      Inspector.tsx     Right-sidebar node property editor
      CanvasArea.tsx    ReactFlow wrapper with drag-drop, keyboard shortcuts
      ContextMenu.tsx   Right-click context menus (canvas/node/edge)
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
    evaluate.ts   Pure function: nodes + edges → Map<nodeId, Value>
                  Topological sort (Kahn's algorithm), NaN/Error propagation
    csv-parse.ts  Lightweight CSV parser (auto-detect separator, quoted fields) (W5)
    csv-worker.ts Web Worker for off-thread CSV parsing (W5)
  i18n/           Internationalization (W3)
    config.ts     i18next initialization + language detector
    locales/
      en.json     English (default)
      es.json     Spanish
      fr.json     French
      it.json     Italian
      de.json     German
  lib/
    supabase.ts     Browser Supabase client (anon key)
    build-info.ts   Build metadata: version, SHA, build time, environment (W5.3)
    entitlements.ts Plan-based feature gating: getEntitlements, isPro, isReadOnly, canCreateProject (W4)
    projects.ts     Project CRUD: list, create, load, save, rename, delete, duplicate, import
    storage.ts      Storage helpers: saveProjectJson, uploadCsv, listProjectAssets, etc.
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
  api/stripe/
    create-checkout-session.ts   POST /api/stripe/create-checkout-session
    create-portal-session.ts     POST /api/stripe/create-portal-session
    webhook.ts                   POST /api/stripe/webhook (Stripe events)
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

e2e/
  smoke.spec.ts   Playwright smoke tests: title, meta tags, robots.txt, #root, no errors (W5.3)

.github/
  workflows/
    ci.yml        GitHub Actions: typecheck, lint, build, e2e tests (W5.3)

public/
  _headers        Cloudflare Pages security headers (CSP, HSTS, etc.) (W5.3)
  _redirects      SPA fallback for Cloudflare Pages
  robots.txt      Crawler policy: block app routes (W5.3)

docs/
  SETUP.md        Production deploy guide
  UX.md           Canvas UX interaction rules
  PROJECT_FORMAT.md  project.json schema + versioning contract
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

Block types are defined in `src/blocks/types.ts` to avoid circular imports. Block packs (data-blocks, vector-blocks, table-blocks) export registration functions instead of importing `regValue` from registry:

```
types.ts ← registry.ts (imports types, re-exports for backward compat)
types.ts ← data-blocks.ts (imports BlockDef, NodeData)
data-blocks.ts ← registry.ts (imports registerDataBlocks, calls with regValue)
```

This eliminates the `registry → pack → registry` cycle that caused TDZ crashes (`ReferenceError: can't access lexical declaration before initialization`).

### Evaluation (src/engine/evaluate.ts)

1. Build in-edge map from `edges[]`
2. Kahn's topological sort (detects cycles → cycle nodes get `mkError(...)`)
3. Evaluate nodes in order: source nodes return configured value; operation nodes call `def.evaluate(inputs, data)`
4. Disconnected input ports → `null` → scalar operations emit `NaN`, Value operations emit `mkError(...)`
5. Returns `Map<nodeId, Value>`

### React Flow node types

| RF type key | Component | Used for |
|---|---|---|
| `csSource` | SourceNode | Number, Slider, Pi, E, Tau, Phi (0 inputs) |
| `csOperation` | OperationNode | All math/trig/logic/vector/table ops (1+ inputs, 1 output) |
| `csDisplay` | DisplayNode | Output/Display (1 input, shows computed value) |
| `csData` | DataNode | Vector Input, Table Input, CSV Import (0 inputs, 1 output) (W5) |

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
- Translation keys organized by namespace: app, nav, auth, projects, billing, canvas, settings, ui, time, entitlements, blocks

---

## Entitlements (W4)

Plan-based feature gating with **two layers of enforcement**:

### 1. Frontend (`src/lib/entitlements.ts`)

| Plan | maxProjects | CSV | Arrays | Plots | Rules | Groups | Canvas |
|------|-------------|-----|--------|-------|-------|--------|--------|
| free | 1 | No | No | No | No | No | Read-write |
| trialing | Unlimited | Yes | Yes | Yes | Yes | Yes | Read-write |
| pro | Unlimited | Yes | Yes | Yes | Yes | Yes | Read-write |
| past_due | 1 | No | No | No | No | No | Read-write + banner |
| canceled | 1 | No | No | No | No | No | **Read-only** + banner |

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
| `VITE_SUPABASE_URL` | Browser (build-time injection) |
| `VITE_SUPABASE_ANON_KEY` | Browser |
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
| W6 | Planned | Deterministic JS compute engine (Web Worker, golden test suite) |
| W7 | Planned | Plot output nodes (Pro, uPlot) |
| W8 | Planned | Branching/rules for conditional flows (Pro) |
| W9 | Planned | Custom blocks editor + block groups (Pro) |
| W10 | Planned | Project/file browser with folders, search, tags |
| W11 | Planned | WASM/Rust compute engine swap-in |
| W12 | Planned | Block versioning (blockVersions manifest) |
