# ChainSolve — Architecture

> Updated at each milestone. Current: **W3 (Design System + i18n + Settings)**

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 | Strict mode: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` |
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
  blocks/         Block definitions and registry
    registry.ts   All block types, categories, port definitions, evaluate fns
  components/
    canvas/       Canvas UI components
      nodes/      Custom React Flow node renderers (SourceNode, OperationNode, DisplayNode)
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
    ErrorBoundary.tsx   Top-level class-based error boundary
  contexts/
    ComputedContext.ts  React context for computed Map<nodeId,number>
  engine/
    evaluate.ts   Pure function: nodes + edges → Map<nodeId, number>
                  Topological sort (Kahn's algorithm), NaN propagation
  i18n/           Internationalization (W3)
    config.ts     i18next initialization + language detector
    locales/
      en.json     English (default)
      es.json     Spanish
      fr.json     French
      it.json     Italian
      de.json     German
  lib/
    supabase.ts   Browser Supabase client (anon key)
    projects.ts   Project CRUD: list, create, load, save, rename, delete, duplicate, import
    storage.ts    Storage helpers: saveProjectJson, uploadCsv, listProjectAssets, etc.
  pages/
    Login.tsx     Email/password login + signup
    AppShell.tsx  Protected dashboard: plan status, billing, project browser
    CanvasPage.tsx  Full-page node-graph editor (BlockLibrary + CanvasArea + Inspector)
    Settings.tsx  Settings layout with sidebar nav (W3)
    settings/
      ProfileSettings.tsx    Account info (email, user ID, plan, member since)
      BillingSettings.tsx    Subscription management (upgrade/manage)
      PreferencesSettings.tsx  Language selector, theme (dark only for now)
  stores/
    projectStore.ts  Zustand store: save lifecycle, project metadata
  App.tsx         Route tree (BrowserRouter)
  main.tsx        Entry point, ErrorBoundary + ToastProvider wrapper

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
```

RLS: all tables enable row-level security. Users own their rows via `owner_id = auth.uid()`.
Trigger: `handle_new_user()` auto-creates a `profiles` row on `auth.users` INSERT.

---

## Storage Conventions

| Bucket | Key pattern |
|--------|-------------|
| `projects` | `{userId}/{projectId}/project.json` |
| `uploads` | `{userId}/{projectId}/uploads/{timestamp}_{safeFilename}` |

RLS policy: `(storage.foldername(name))[1] = auth.uid()::text`

---

## Node Graph Engine

### Block types (M1, scalar only)

| Category | Blocks |
|---|---|
| Input | Number, Slider |
| Math | Add, Subtract, Multiply, Divide, Negate, Abs, Sqrt, Power, Floor, Ceil, Round, Mod, Clamp |
| Trig | Sin, Cos, Tan, Asin, Acos, Atan, Atan2, DegToRad, RadToDeg |
| Constants | Pi, E, Tau, Phi |
| Logic | Greater, Less, Equal, IfThenElse, Max, Min |
| Output | Display |

### Evaluation (src/engine/evaluate.ts)

1. Build in-edge map from `edges[]`
2. Kahn's topological sort (detects cycles → cycle nodes get `NaN`)
3. Evaluate nodes in order: source nodes return configured value; operation nodes call `def.evaluate(inputs, data)`
4. Disconnected input ports → `null` → operation emits `NaN`
5. Returns `Map<nodeId, number>` (NaN for errors/cycles/disconnected)

### React Flow node types

| RF type key | Component | Used for |
|---|---|---|
| `csSource` | SourceNode | Number, Slider, Pi, E, Tau, Phi (0 inputs) |
| `csOperation` | OperationNode | All math/trig/logic blocks (1+ inputs, 1 output) |
| `csDisplay` | DisplayNode | Output/Display (1 input, shows computed value) |

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
- Translation keys organized by namespace: app, nav, auth, projects, billing, canvas, settings, ui, time

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
| W4 | Planned | Deterministic JS compute engine (Web Worker, golden test suite) |
| W5 | Planned | Free limit enforcement, code-splitting, Stripe plan gating UX |
| W6 | Planned | Arrays + CSV import (Pro) |
| W7 | Planned | Plot output nodes (Pro, uPlot) |
| W8 | Planned | Branching/rules for conditional flows (Pro) |
| W9 | Planned | Custom blocks editor + block groups (Pro) |
| W10 | Planned | Project/file browser with folders, search, tags |
| W11 | Planned | WASM/Rust compute engine swap-in |
| W12 | Planned | Block versioning (blockVersions manifest) |
