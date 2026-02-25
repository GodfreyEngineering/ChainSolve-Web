# ChainSolve — Architecture

> Updated at each milestone. Current: **M1 (Canvas MVP)**

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite 7 + React 19 + TypeScript 5.9 | Strict mode: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` |
| Routing | react-router-dom v7 | BrowserRouter; `/` → `/app` → `/canvas` |
| Canvas | @xyflow/react (React Flow v12) | Node graph editor |
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
    ErrorBoundary.tsx   Top-level class-based error boundary
  engine/
    evaluate.ts   Pure function: nodes + edges → Map<nodeId, number>
                  Topological sort (Kahn's algorithm), NaN propagation
  lib/
    supabase.ts   Browser Supabase client (anon key)
    storage.ts    Storage helpers: saveProjectJson, uploadCsv, listProjectAssets, etc.
  pages/
    Login.tsx     Email/password login + signup
    AppShell.tsx  Protected dashboard: plan status, billing, workspace smoke-test
    CanvasPage.tsx  Full-page node-graph editor (BlockLibrary + CanvasArea + Inspector)
  App.tsx         Route tree (BrowserRouter)
  main.tsx        Entry point, ErrorBoundary wrapper

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

docs/
  SETUP.md        Production deploy guide
  ARCHITECTURE.md This file
```

---

## Data Model (Supabase)

```sql
plan_status ENUM: free | trialing | pro | past_due | canceled

profiles        id (FK auth.users), email, plan (plan_status), stripe_customer_id,
                stripe_subscription_id, current_period_end

projects        id, user_id (FK profiles), name, description, storage_key

fs_items        id, project_id, user_id, parent_id (self-ref), name, type, content

project_assets  id, project_id, user_id, name (original filename), storage_path,
                mime_type, size (bytes), kind ('csv' | ...)

stripe_events   id (= Stripe event ID), type, payload (jsonb)
```

RLS: all tables enable row-level security. Users own their rows via `user_id = auth.uid()`.
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

## Milestone Map

| Milestone | Status | Description |
|---|---|---|
| M0 | ✅ Done | Repo hygiene, build stability, ErrorBoundary, scripts |
| M1 | ✅ Done | Canvas MVP: drag-drop blocks, scalar evaluation, inspector |
| M2 | Planned | Deterministic JS compute engine (Web Worker, full test suite) |
| M3 | Planned | Projects + autosave (project browser, 1-project free limit) |
| M4 | Planned | Stripe plan gating (feature locks, upgrade CTA) |
| M5 | Planned | Arrays + CSV import (Pro only) |
| M6 | Planned | Plot output nodes (Pro only, uPlot) |
| M7 | Planned | WASM/Rust compute engine swap-in |
| M8 | Planned | Function library + custom function editor |
