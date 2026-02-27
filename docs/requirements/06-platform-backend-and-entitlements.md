# 06 — Platform, Backend & Entitlements

> Revision: 1.0 · Date: 2026-02-26

This document specifies the backend services, data layer, entitlements system,
and marketplace model that support all ChainSolve platforms.

---

## 1. Architecture principle: adapter boundary

The UI layer MUST call **service abstractions**, never Supabase (or any backend)
directly. This enables:

- Swapping backends (Supabase → local SQLite for Desktop).
- Testing with mock adapters.
- Future migration to a different backend without UI changes.

```
┌─────────────────────────┐
│  UI Components / Stores  │
│                         │
│  import { loadProject } │
│    from 'lib/projects'  │
└──────────┬──────────────┘
           │  calls service function
┌──────────▼──────────────┐
│  Service layer           │
│  (src/lib/projects.ts,   │
│   canvases.ts, etc.)     │
│                         │
│  calls adapter.get()     │
└──────────┬──────────────┘
           │  calls adapter
┌──────────▼──────────────┐
│  PersistenceAdapter      │
│  (interface)             │
│                         │
│  ├─ SupabaseAdapter     │
│  └─ LocalAdapter        │
└─────────────────────────┘
```

| ID | Requirement | Priority |
|----|-------------|----------|
| AB-1 | All data access MUST go through service functions in `src/lib/`. Components MUST NOT import `supabase` directly. | MUST |
| AB-2 | Service functions MUST be adapter-agnostic: they call a `PersistenceAdapter` interface, not Supabase-specific APIs. | MUST |
| AB-3 | The adapter MUST be selected at app initialization (web = Supabase, desktop = local, test = mock). | MUST |
| AB-4 | The adapter interface MUST cover: auth, project CRUD, canvas CRUD, variable CRUD, asset CRUD, storage read/write. | MUST |

---

## 2. Supabase / Database requirements

### 2.1 Tables (current)

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profile + plan status + Stripe IDs. | Owner-only via `auth.uid()`. |
| `projects` | Project metadata + variables JSONB. | Owner-only via `owner_id = auth.uid()`. |
| `canvases` | Per-project canvas metadata (name, position, storage path). | Owner-only via `owner_id`. |
| `project_assets` | Uploaded file metadata (CSV, images). | Owner-only via `owner_id`. |
| `group_templates` | Saved group templates (Pro). | Owner-only via `owner_id`. |
| `fs_items` | Virtual file system (legacy, may be deprecated). | Owner-only via `owner_id`. |
| `stripe_events` | Stripe webhook audit log. | Service-role only (no user access). |
| `bug_reports` | User-submitted bug reports. | Insert-only for authenticated users. |
| `csp_reports` | CSP violation reports. | Insert-only (public). |
| `observability_events` | Analytics events. | Owner-only via `owner_id`. |

### 2.2 Table requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DB-1 | All user-facing tables MUST have RLS enabled with the canonical `(select auth.uid())` pattern. | MUST |
| DB-2 | All tables MUST have `created_at` and `updated_at` timestamps. `updated_at` MUST be auto-set via trigger or application. | MUST |
| DB-3 | Foreign keys MUST be defined for all relationships (`project_id`, `owner_id`). | MUST |
| DB-4 | Indexes MUST exist on: `projects.owner_id`, `canvases.project_id`, `canvases.(project_id, position)` UNIQUE, `project_assets.project_id`. | MUST |
| DB-5 | `projects.active_canvas_id` intentionally has no FK (avoids circular dep with `canvases`). Validation is at the app level. | — |
| DB-6 | `projects.variables` MUST be validated before write (valid JSON, correct shape). Invalid shapes MUST be rejected. | MUST |

### 2.3 Storage requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ST-1 | Two storage buckets: `projects` (graph JSON) and `uploads` (user files). | MUST |
| ST-2 | Storage paths MUST start with `{auth.uid()}/`. RLS policies MUST enforce this. | MUST |
| ST-3 | Path traversal (`../`) MUST be rejected. | MUST |
| ST-4 | Maximum file size: 10 MB per canvas JSON, 50 MB per uploaded asset. | SHOULD |
| ST-5 | Legacy `project.json` (V1–V3) MUST be preserved during migration to V4. | MUST |

### 2.4 Migration requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| MG-1 | SQL migrations MUST be numbered sequentially (`0001_`, `0002_`, ...). | MUST |
| MG-2 | Migrations MUST be idempotent (`IF NOT EXISTS`, `IF EXISTS` guards). | MUST |
| MG-3 | Migrations MUST NOT delete data. Column additions MUST have defaults. | MUST |
| MG-4 | Migration files MUST include a header comment with purpose and milestone. | SHOULD |
| MG-5 | Running all migrations in sequence on an empty database MUST produce a valid schema. | MUST |

---

## 3. Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| AU-1 | Authentication MUST use Supabase Auth (email/password + optional OAuth). | MUST |
| AU-2 | Sessions MUST use JWTs with automatic refresh. | MUST |
| AU-3 | The `profiles` table MUST be auto-populated on first sign-up via a database trigger or hook. | MUST |
| AU-4 | Password reset MUST be supported via Supabase Auth email flow. | MUST |
| AU-5 | OAuth providers (Google, GitHub) SHOULD be supported. | SHOULD |
| AU-6 | Desktop offline mode MUST support a local "offline profile" when no auth server is reachable. | MUST |
| AU-7 | Mobile auth MUST use the system browser for OAuth redirects (ASWebAuthenticationSession / Custom Tabs). | MUST |

---

## 4. Org accounts & RBAC

> **Status**: Future feature. Specified now to ensure the data model supports it.

### 4.1 Org model

```
Organization
 ├── has 1..N Members (User + Role)
 │     Role: owner | admin | member | viewer
 └── has 0..N Projects (org-owned, not user-owned)
```

### 4.2 Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ORG-1 | An `organizations` table MUST store org metadata (id, name, plan, created_at). | SHOULD |
| ORG-2 | An `org_members` table MUST map users to orgs with a role enum (`owner`, `admin`, `member`, `viewer`). | SHOULD |
| ORG-3 | Projects MAY have an `org_id` FK (nullable). If set, org RBAC applies; if NULL, personal ownership. | SHOULD |
| ORG-4 | RBAC rules: | SHOULD |
| | `owner` — full control, delete org, manage billing. | |
| | `admin` — manage members, manage all projects. | |
| | `member` — create projects, edit own and shared projects. | |
| | `viewer` — read-only access to org projects. | |
| ORG-5 | RLS policies for org-scoped projects MUST check the user's org membership and role. | SHOULD |
| ORG-6 | Org billing MUST be separate from personal billing (enterprise plans). | SHOULD |

### 4.3 Out of scope

- Nested orgs / teams within orgs.
- Per-project role overrides (all members have the same access within an org).
- SAML / SSO (future enterprise feature).

---

## 5. Marketplace

> **Status**: Future feature. Specified now for architectural alignment.

### 5.1 Marketplace object model

```
MarketplaceItem
 ├── type: 'project_template' | 'block_pack' | 'theme'
 ├── author: User (or Org)
 ├── title, description, tags, thumbnail
 ├── version (semver)
 ├── price: free | paid (Stripe Connect)
 ├── plan_required: 'free' | 'pro' | 'enterprise'
 ├── payload: (stored in marketplace storage bucket)
 └── stats: downloads, rating (future)
```

### 5.2 Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| MK-1 | A `marketplace_items` table MUST store item metadata. | COULD |
| MK-2 | A `marketplace_purchases` table MUST track purchases per user. | COULD |
| MK-3 | Item payloads MUST be stored in a separate `marketplace` storage bucket. | COULD |
| MK-4 | Authors MUST be verified (email confirmed) before publishing. | COULD |
| MK-5 | Published items MUST go through a review process (manual or automated) before becoming visible. | COULD |
| MK-6 | Users MUST be able to browse, search, and filter marketplace items by type, category, price, and rating. | COULD |
| MK-7 | Installing a `project_template` MUST fork it into the user's project list (not modify the original). | COULD |
| MK-8 | Installing a `block_pack` MUST register the blocks in the user's catalog (scoped to their session/account). | COULD |
| MK-9 | Installing a `theme` MUST apply the theme CSS variables (reversible). | COULD |
| MK-10 | Paid items MUST use Stripe Connect for author payouts. | COULD |

### 5.3 Marketplace UI

| ID | Requirement | Priority |
|----|-------------|----------|
| MU-1 | A marketplace page MUST be accessible from the app shell navigation. | COULD |
| MU-2 | Item detail pages MUST show: title, description, author, version, screenshots, install button, price. | COULD |
| MU-3 | Authors MUST have a dashboard for managing their published items. | COULD |

### 5.4 Out of scope

- User reviews / ratings (future).
- Marketplace API for third-party integrations.
- Revenue share negotiation (default 70/30 author/platform).

---

## 6. Entitlements & plan gating

### 6.1 Plan tiers

| Plan | Monthly price | Description |
|------|--------------|-------------|
| `free` | $0 | Core blocks, limited projects/canvases. |
| `trialing` | $0 (14 days) | Full Pro features during trial. |
| `pro` | TBD | All blocks, unlimited projects/canvases, plots, tables, groups. |
| `past_due` | — | Payment failed. Read-only access. Retains data. |
| `canceled` | — | Subscription ended. Read-only access. Retains data. |
| `enterprise` | Custom | Org accounts, RBAC, airgapped desktop, audit logging, priority support. |

### 6.2 Entitlement matrix

| Capability | Free | Trialing | Pro | Past_due | Canceled | Enterprise |
|-----------|------|----------|-----|----------|----------|-----------|
| `maxProjects` | 1 | ∞ | ∞ | 1 | 1 | ∞ |
| `maxCanvases` (per project) | 2 | ∞ | ∞ | 2 | 2 | ∞ |
| `canUploadCsv` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `canUseArrays` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `canUsePlots` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `canUseRules` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `canUseGroups` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `canPublishMarketplace` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `canUseOrgFeatures` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `canUseAuditLog` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.3 Gating rules

| ID | Requirement | Priority |
|----|-------------|----------|
| EN-1 | Entitlements MUST be derived from the user's `plan` field in the `profiles` table. | MUST |
| EN-2 | Plan status MUST be synced from Stripe webhooks. The app MUST NOT trust client-side plan claims. | MUST |
| EN-3 | Pro-only blocks MUST be visible but disabled for Free users. A tooltip or badge MUST explain the requirement. | MUST |
| EN-4 | Exceeding a limit (e.g. creating a 2nd project on Free) MUST show a clear upgrade prompt, not a generic error. | MUST |
| EN-5 | `past_due` and `canceled` plans MUST allow read-only access (view projects, view canvases). Creating/editing MUST be blocked. | MUST |
| EN-6 | Entitlement checks MUST happen both client-side (UX) and server-side (DB triggers / RLS). Client-side checks are for UX; server-side checks are the security boundary. | MUST |
| EN-7 | DB-level enforcement: `check_project_limit()` trigger MUST prevent exceeding `maxProjects`. | MUST |

### 6.4 Stripe integration

| ID | Requirement | Priority |
|----|-------------|----------|
| SP-1 | Billing MUST use Stripe Checkout for subscription creation. | MUST |
| SP-2 | Stripe webhooks MUST update `profiles.plan`, `stripe_subscription_id`, and `current_period_end`. | MUST |
| SP-3 | Webhook events MUST be logged to the `stripe_events` table for audit. | MUST |
| SP-4 | The billing settings page MUST link to the Stripe Customer Portal for plan management. | MUST |
| SP-5 | Stripe webhook endpoint MUST be a Cloudflare Pages Function (`functions/api/stripe/`). | MUST |
| SP-6 | Webhook signature verification MUST be performed on every event. | MUST |

---

## 7. Auditing and logging (enterprise)

| ID | Requirement | Priority |
|----|-------------|----------|
| AL-1 | Enterprise plans MUST support an audit log of significant actions: project create/edit/delete, canvas create/edit/delete, variable changes, member additions, export events. | SHOULD |
| AL-2 | Audit log entries MUST include: timestamp, user ID, action type, resource type, resource ID, metadata (e.g. old/new values). | SHOULD |
| AL-3 | Audit logs MUST be stored locally (desktop) or in the `observability_events` table (web). | SHOULD |
| AL-4 | Audit logs MUST NOT be shipped to external services by default. An enterprise admin MAY configure an internal endpoint. | MUST |
| AL-5 | Audit log retention: default 90 days; configurable via policy. | SHOULD |
| AL-6 | The debug console's export feature MUST NOT include audit log data (separate concerns). | MUST |

---

## 8. API / Functions layer

### 8.1 Current Cloudflare Pages Functions

| Route | Purpose |
|-------|---------|
| `GET /api/health`, `/api/healthz`, `/api/readyz` | Health checks. |
| `POST /api/stripe/webhook` | Stripe event handler. |
| `_middleware.ts` | CORS headers. |

### 8.2 Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| API-1 | All API routes MUST set CORS headers via the middleware. | MUST |
| API-2 | Authenticated routes MUST validate the Supabase JWT. | MUST |
| API-3 | Rate limiting SHOULD be applied to public endpoints (health checks are exempt). | SHOULD |
| API-4 | Error responses MUST use a consistent JSON envelope: `{ "error": { "code": "...", "message": "..." } }`. | MUST |
| API-5 | API routes MUST NOT expose internal stack traces in production. | MUST |
| API-6 | Future API routes (marketplace, org management) MUST follow the same conventions. | MUST |

---

## 9. Observability (backend)

| ID | Requirement | Priority |
|----|-------------|----------|
| OBS-1 | Stripe webhook processing MUST log success/failure to `stripe_events` and/or structured logs. | MUST |
| OBS-2 | API error rates MUST be monitorable (Cloudflare Analytics or equivalent). | SHOULD |
| OBS-3 | Database query performance SHOULD be monitored (Supabase Dashboard metrics). | SHOULD |
| OBS-4 | Storage usage per user SHOULD be trackable for billing and quota enforcement. | SHOULD |

---

## 10. Out of scope (for now)

- GraphQL API (REST / Supabase client is sufficient).
- Real-time subscriptions (Supabase Realtime for live collaboration).
- Multi-region deployment (single Cloudflare region + Supabase region is fine).
- Custom domain support for org accounts.
- SSO / SAML (enterprise auth federation).
- Webhooks for external integrations (e.g. notify Slack on project change).

---

## 11. Future extensions

1. **Supabase Realtime subscriptions**: Live canvas updates for collaborative editing.
2. **Multi-region storage**: Replicate projects to regions closer to the user.
3. **SSO / SAML**: Enterprise identity federation.
4. **Webhooks API**: Notify external services on project lifecycle events.
5. **Usage-based billing**: Charge for compute (large evaluations) or storage above a threshold.
6. **API keys**: Service-to-service access for CI/CD integration (batch evaluation).

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-26 | — | Initial version (v1.0). |
