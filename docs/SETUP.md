# ChainSolve — Production Setup Guide

Follow these steps **in order** to get a fully working deployment.

---

## 1. Prerequisites

- Node.js 20+ and npm
- A [Cloudflare](https://dash.cloudflare.com/) account (free tier is fine)
- A [Supabase](https://supabase.com/) project (free tier is fine)
- A [Stripe](https://dashboard.stripe.com/) account (test mode to start)
- A [Resend](https://resend.com/) account for transactional email

---

## 2. Supabase — Database & Auth

### 2a. Run the SQL migrations

Run each file in `supabase/migrations/` **in numeric order** via **Supabase → SQL Editor**:

| File | What it does |
| ---- | ------------ |
| `0001_init.sql` | Full schema: all tables, enums, RLS policies, triggers |
| `0002_storage_columns.sql` | Adds `projects.storage_key` and `project_assets.kind` |
| `0003_projects_owner_id.sql` | Renames `projects.user_id` → `owner_id`, rebuilds RLS |
| `0004_projects_description.sql` | Ensures `projects.description` column exists |
| `0005_projects_storage_key_nullable.sql` | Drops NOT NULL on `projects.storage_key` (safety net) |
| `0006_entitlements_enforcement.sql` | Plan-based limits: project count trigger, storage RLS tightening, helper functions. Casts `plan` to text to avoid enum-name coupling. Includes `NOTIFY pgrst, 'reload schema'` to refresh PostgREST. |
| `0007_bug_reports.sql` | In-app bug reporting table (`bug_reports`) with RLS (users insert/read own). |
| `0008_advisor_fixes.sql` | ~~Superseded by 0009~~ — kept for history. Fails on schemas where `fs_items`/`project_assets` use `owner_id`. |
| `0009_advisor_fixes_v2.sql` | Advisor fixpack v2: same fixes as 0008 but auto-detects `owner_id` vs `user_id` at runtime. See §15 below. |

After running 0001, confirm these tables appear under **Table Editor**:
`profiles`, `projects`, `fs_items`, `project_assets`, `stripe_events`

> **Keep migrations in sync:** If you apply schema changes directly in the
> Supabase SQL editor, also commit an equivalent migration file to
> `supabase/migrations/` so the repo stays the authoritative source of truth.

### 2b. Configure Auth settings

1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to `https://app.chainsolve.co.uk`
3. Under **Redirect URLs**, add:
   - `https://app.chainsolve.co.uk/**`
   - `https://chainsolve-web.pages.dev/**` (Cloudflare preview domain)
   - `http://localhost:5173/**` (local dev)

### 2c. Enable Email/Password auth

1. **Authentication → Providers → Email** — ensure it is enabled
2. Optionally disable "Confirm email" while testing, re-enable before going live

### 2d. Grab your keys

From **Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
- **anon / public** key → `VITE_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(keep this secret)*

---

## 3. Resend — Transactional Email via Supabase SMTP

1. Sign up at [resend.com](https://resend.com/) and add your sending domain
2. In Resend → **API Keys**, create a key with full access; copy it
3. In Supabase → **Project Settings → Authentication → SMTP Settings**:
   - **Enable custom SMTP**: on
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: your Resend API key
   - **Sender name / email**: e.g. `ChainSolve <hello@yourdomain.com>`
4. Save and send a test email to verify

---

## 4. Stripe — Subscription & Billing

### 4a. Create a Product and Price

1. **Stripe Dashboard → Products → + Add product**
   - Name: `ChainSolve Pro`
   - Pricing model: **Recurring**, **Monthly**
   - Amount: `£10.00 GBP`
2. After saving, copy the **Price ID** (looks like `price_1ABC...`) → this is `STRIPE_PRICE_ID_PRO_MONTHLY`

### 4b. Create a Webhook endpoint

1. **Stripe Dashboard → Developers → Webhooks → + Add endpoint**
2. **Endpoint URL**: `https://app.chainsolve.co.uk/api/stripe/webhook`
3. **Events to subscribe to** (select all of these):
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
4. After saving, reveal the **Signing secret** (starts with `whsec_`) → `STRIPE_WEBHOOK_SECRET`

### 4c. Enable the Customer Portal

1. **Stripe Dashboard → Settings → Billing → Customer portal**
2. Toggle on: allow customers to cancel, update payment method, view invoices
3. Set **Return URL**: `https://app.chainsolve.co.uk/app`
4. Save

---

## 5. Cloudflare Pages — Project Setup

> **How deploys work:** GitHub Actions builds the project (Rust + WASM + Vite)
> and pushes the output to Cloudflare via Wrangler Direct Upload. The Cloudflare
> Git-integrated build image is **never used** — see §17 for full details.

### 5a. Create the Pages project

**Option A — existing project (migrating from Git-integrated builds):**

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → chainsolve-web → Settings → Builds**
2. **Disable automatic builds** (the setting may be labelled "Pause builds" or
   "Disconnect Git"). This stops Cloudflare from attempting its own build when
   you push — GitHub Actions takes over that role.
3. The project itself (and all its environment variables) stays intact.

**Option B — fresh project (no existing Cloudflare project):**

GitHub Actions creates the project automatically on the first successful deploy
via `wrangler pages deploy --project-name=chainsolve-web`. No manual project
creation is needed.

### 5b. Add environment variables

In Cloudflare Dashboard → Workers & Pages → `chainsolve-web` →
**Settings → Environment variables**, add all of the following for **both
Production and Preview** (they do not inherit from each other):

| Variable | Where to find it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_URL` | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → signing secret |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Stripe → Products → your price ID |

> **Note**: Variables prefixed `VITE_` are injected into the browser bundle at
> build time by Vite (they are baked into `dist/`). All others are runtime
> secrets used exclusively by Pages Functions.

### 5c. Add GitHub Actions secrets

In your GitHub repository → **Settings → Secrets and variables → Actions**,
add two repository secrets (see §17 for details on how to obtain them):

| Secret                  | Description                                           |
|-------------------------|-------------------------------------------------------|
| `CLOUDFLARE_API_TOKEN`  | CF API token with *Cloudflare Pages: Edit* permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                            |

Once these are in place, pushing to `main` triggers the full CI + deploy pipeline
automatically.

---

## 6. Local Development

```bash
# 1. Copy env file
cp .env.example .env
# Fill in real values in .env

# 2. Install dependencies
npm install

# 3. Start the Vite dev server
npm run dev
# → http://localhost:5173
```

For testing Cloudflare Pages Functions locally, install [Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npm install -D wrangler
npx wrangler pages dev dist --compatibility-date=2024-01-01
```

For Stripe webhooks during local development, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:8788/api/stripe/webhook
```

---

## 7. Stripe SDK version note

`stripe` is pinned to `^20.x` in `package.json`. This is intentional.

The webhook handler uses `stripe.webhooks.constructEventAsync()` with
`Stripe.createSubtleCryptoProvider()` instead of the synchronous
`constructEvent()`. The reason: the synchronous variant depends on the
Node.js built-in `crypto` module, which is **not available** in the
Cloudflare Workers/Pages runtime. `constructEventAsync` with a SubtleCrypto
provider uses `globalThis.crypto.subtle` (the Web Crypto API), which is
available in all Cloudflare Workers environments and produces identical
HMAC-SHA256 verification. This API has been stable in the Stripe SDK since
v10 and is present in all v20.x releases.

Do **not** downgrade to `stripe@<10` — `constructEventAsync` was added in v10.

---

## 8. Acceptance tests — Stripe webhook

### How to send a test event from the Stripe Dashboard

1. Open **Stripe Dashboard → Developers → Webhooks**
2. Click your endpoint (`https://app.chainsolve.co.uk/api/stripe/webhook`)
3. Click **Send test event** (top-right of the endpoint detail page)
4. Choose an event type — start with **`customer.subscription.updated`**
5. Click **Send test webhook**

Stripe will POST a signed event to your live endpoint and show the HTTP
response code. You should see `200 OK` with body `ok`.

> To test a full subscription flow without real money, use Stripe's
> [test clock](https://stripe.com/docs/billing/testing/test-clocks) feature
> or the Stripe CLI (see §6 above).

### What "success" looks like in Supabase

After a verified subscription event is processed, query the `profiles` table
in **Supabase → Table Editor → profiles** (or SQL editor):

```sql
SELECT id, email, plan, stripe_customer_id, stripe_subscription_id, current_period_end
FROM profiles
WHERE stripe_customer_id = 'cus_XXXX'; -- replace with the customer ID from Stripe
```

Expected outcome per event type:

| Stripe event | `plan` value in profiles | `current_period_end` |
|---|---|---|
| `customer.subscription.created` (trial) | `trialing` | set to trial end date |
| `customer.subscription.updated` (active) | `pro` | set to next renewal date |
| `customer.subscription.updated` (past_due) | `past_due` | unchanged |
| `customer.subscription.deleted` | `canceled` | unchanged |

The `stripe_events` table will also contain one row per event ID — check it to
confirm the event was received and stored:

```sql
SELECT id, type, created_at FROM stripe_events ORDER BY created_at DESC LIMIT 5;
```

If `stripe_events` has the row but `profiles` was **not** updated, the most
likely cause is that `stripe_customer_id` on the profile row does not match
the `customer` field in the event. Verify by running:

```sql
SELECT id, email, stripe_customer_id FROM profiles WHERE stripe_customer_id IS NOT NULL;
```

---

## 10. Storage — key conventions and RLS

### Why the `{userId}/` prefix is mandatory

The RLS policies on `storage.objects` check:

```sql
(storage.foldername(name))[1] = auth.uid()::text
```

`storage.foldername(name)` splits the object path on `/` and returns an array.
Element `[1]` (1-indexed in PostgreSQL) is the **first folder component**.
A path of `abc-user-id/proj-id/project.json` passes only for the user whose
`auth.uid()` equals `abc-user-id`. Any other user gets a 403 — even with the
anon key. This is enforced at the database level, not in application code.

### Exact key patterns

| Bucket | Key pattern | Example |
|--------|-------------|---------|
| `projects` | `{userId}/{projectId}/project.json` | `uuid-a/.../project.json` |
| `uploads`  | `{userId}/{projectId}/uploads/{ms}_{safeFilename}` | `uuid-a/.../uploads/1700000000000_data.csv` |

`safeFilename` = original filename with every character outside `[a-zA-Z0-9._-]`
replaced by `_`.

### Run migration 0002 before using storage

The helper module requires two columns added in `0002_storage_columns.sql`:

```sql
ALTER TABLE projects       ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS kind TEXT;
```

Run `supabase/migrations/0002_storage_columns.sql` in **Supabase → SQL Editor**
after running `0001_init.sql`.

### Column mapping (storage.ts ↔ DB)

| `storage.ts` concept | DB column | Table |
|---|---|---|
| storage key / path | `projects.storage_key` | projects |
| original filename | `project_assets.name` | project_assets |
| storage path | `project_assets.storage_path` | project_assets |
| file size | `project_assets.size` | project_assets |
| file type discriminator | `project_assets.kind` | project_assets |

---

## 11. How to smoke-test storage in the browser

### Dev (localhost)

1. Run `npm run dev` and open `http://localhost:5173`
2. Sign in (or sign up if first run)
3. Click **Create project**
   - A new row must appear in **Supabase → Table Editor → projects** with
     `storage_key` set to `{userId}/{projectId}/project.json`
   - **Supabase → Storage → projects** → browse to that path and confirm the
     file exists; its content should be `{"nodes":[],"edges":[],"version":1}`
4. Click **Upload CSV** and pick any `.csv` file from your machine
   - The file must appear in the asset table below the buttons
   - **Supabase → Storage → uploads** → browse to
     `{userId}/{projectId}/uploads/` and confirm the file exists
   - **Supabase → Table Editor → project_assets** → confirm a row with
     `kind = csv` and the original filename was inserted
5. Click **Create project** again — a second project row should appear
   independently; each project gets its own scoped key path

### Production (https://app.chainsolve.co.uk)

Same steps as above, using the live URL. Open **browser DevTools → Console**
if any step fails — every storage helper throws with a descriptive message.

### Diagnosing RLS failures

If uploads return a `403` or the asset list is empty unexpectedly:

```sql
-- Confirm the bucket policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Confirm the user's ID matches the path prefix
SELECT auth.uid();   -- run in Supabase SQL editor while logged in
```

The `auth.uid()` value must be the exact first path segment of every object
you expect the user to access.

---

## 9. Debugging Cloudflare Error 1101

**What it means:** HTTP 1101 = an uncaught exception was thrown inside a Pages Function (Worker). Cloudflare caught it and returned a generic error page instead.

### Where to find logs

1. **Cloudflare Dashboard** → **Workers & Pages** → select `chainsolve-web` → **Functions** tab → **Real-time logs**
2. Enable **Log level: Error** and trigger the action that failed (e.g. click Upgrade).
3. The log entry will show the exception message, stack trace, and the request ID (`[checkout xxxx]` / `[portal xxxx]`) printed by `console.error`.

### Most common causes and fixes

| Symptom | Root cause | Fix |
|---|---|---|
| 1101 on `/api/stripe/create-checkout-session` | Missing `STRIPE_SECRET_KEY` or `STRIPE_PRICE_ID_PRO_MONTHLY` env var | Set vars in CF Dashboard → Settings → Environment Variables → **Production** |
| 1101 on `/api/stripe/create-portal-session` | Customer Portal not enabled in Stripe | Dashboard → Billing → Customer portal → Activate |
| 1101 on `/api/stripe/webhook` | Wrong `STRIPE_WEBHOOK_SECRET` (test vs live) | Copy the correct `whsec_…` from the Stripe webhook endpoint for your domain |
| 1101 immediately after deploy | Build deployed with wrong/missing env var | Check Functions tab → "Environment variables" column per deployment |

### Required env vars — Production vs Preview

All 7 vars must be set. Preview deployments (branch deploys, PRs) share the **Preview** environment in Cloudflare; Production deployments use the **Production** environment.

| Variable | Production | Preview |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ same value | ✅ same value |
| `VITE_SUPABASE_ANON_KEY` | ✅ same value | ✅ same value |
| `SUPABASE_URL` | ✅ same value | ✅ same value |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **live** service role key | ✅ same (or test project) |
| `STRIPE_SECRET_KEY` | `sk_live_…` | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (live endpoint) | `whsec_…` (test endpoint / Stripe CLI) |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | `price_1T40yZCYM0atbSlvxvrIZjSf` | test mode price ID |

> **Important:** Cloudflare does NOT inherit Production vars into Preview automatically. You must set them separately in **Settings → Environment Variables → Preview**.

### Quick diagnosis steps

```bash
# 1. Test the function locally with Wrangler
npx wrangler pages dev dist --compatibility-date=2025-01-01

# 2. Send a test checkout request
curl -X POST http://localhost:8788/api/stripe/create-checkout-session \
  -H "Authorization: Bearer <supabase-access-token>"

# 3. Check the terminal — errors print with request ID
```

---

## 10. PostgREST schema cache

If you add or rename columns in Supabase (e.g. `projects.owner_id`) and PostgREST returns a 404 or "column does not exist" error despite the migration running, the schema cache may be stale.

Run this in the **SQL Editor** to force a reload:

```sql
NOTIFY pgrst, 'reload schema';
```

PostgREST (the Supabase REST API layer) caches the DB schema at startup. The `NOTIFY` command reloads it without restarting the service.

---

## 11. Persistence smoke test

Run through this checklist after any change to the save/load pipeline.

### Basic save/load round-trip

- [ ] Open `/app`, click **Create project** → canvas opens
- [ ] Add 2–3 blocks, connect them with edges
- [ ] Wait for status bar to show **Saved** (with node/edge counts, e.g. `Saved 3n / 2e`)
- [ ] Close the browser tab entirely
- [ ] Reopen the app → open the same project → graph is identical (same blocks, same connections, same values)

### Save Now button

- [ ] Make a change on the canvas (add or move a block)
- [ ] Click the **Save** button in the top bar before autosave fires
- [ ] Status changes to **Saving…** then **Saved** with correct counts
- [ ] Reload the page — change is persisted

### Keyboard shortcut

- [ ] Make a change, press **Ctrl+S** (or **Cmd+S** on macOS)
- [ ] Status shows **Saved** — change persists after reload

### Node/edge counts in status bar

- [ ] With a saved project open, verify the status text shows `Saved Xn / Ye` where X = number of nodes and Y = number of edges on the canvas
- [ ] Add a node → save → count increments
- [ ] Delete a node → save → count decrements

### Tab close protection

- [ ] Make a change (status shows unsaved/dirty)
- [ ] Close the tab — browser shows a "Leave site?" confirmation dialog
- [ ] Click **Stay** → project still open, change still present

### Back-to-projects navigation

- [ ] Make a change on the canvas
- [ ] Click **← Projects** in the top bar
- [ ] The app saves before navigating (status briefly shows Saving…)
- [ ] Reopen the project → change is persisted

### Scratch canvas (no project)

- [ ] Open `/canvas` (no project ID) — scratch mode
- [ ] Verify no save button, no autosave, no status bar save indicators
- [ ] Changes are ephemeral — closing and reopening `/canvas` starts fresh

---

## 12. Go-live checklist

- [ ] SQL migration applied successfully
- [ ] Supabase Auth site URL set to `https://app.chainsolve.co.uk`
- [ ] Supabase redirect URLs include both `https://app.chainsolve.co.uk/**` and `https://chainsolve-web.pages.dev/**`
- [ ] Resend SMTP verified (send a test email)
- [ ] Stripe in **Live mode** (not test mode)
- [ ] Stripe webhook endpoint set to `https://app.chainsolve.co.uk/api/stripe/webhook`
- [ ] Stripe Customer Portal return URL set to `https://app.chainsolve.co.uk/app`
- [ ] All 7 Cloudflare environment variables set for Production
- [ ] Cloudflare Pages deploy succeeded (`npm run build` → `dist/`)
- [ ] `/assets/*` responses show `Cache-Control: public, max-age=31536000, immutable`
- [ ] HTML pages show `Cache-Control: public, max-age=0, must-revalidate`
- [ ] Stripe test webhook returns `200 ok` and `stripe_events` row appears
- [ ] End-to-end test: sign up → upgrade (7-day trial) → portal → cancel
- [ ] CSP report endpoint receiving: `curl -X POST .../api/security/csp-report` returns 204, row in `csp_reports`
- [ ] OPTIONS preflight: `curl -X OPTIONS -H "Origin: https://app.chainsolve.co.uk" .../api/stripe/create-checkout-session` returns 204 with `Access-Control-Allow-Origin`
- [ ] No wildcard CORS: grep codebase for `Access-Control-Allow-Origin: *` returns nothing
- [ ] CSP headers present: document response includes both `Content-Security-Policy` and `Content-Security-Policy-Report-Only` with `report-uri`
- [ ] Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy` all present

---

## 13. Debugging blank screen / TDZ errors

### Symptom: completely blank white page, no visible UI

**What to check first:** Open browser DevTools (F12) → Console. Look for:

- `ReferenceError: can't access lexical declaration 'X' before initialization` — **circular import / TDZ crash**
- `TypeError: ... is not a function` or `... is undefined` — module resolution failure
- Boot error screen ("Something went wrong during startup") — the bootloader caught the error; the message will indicate the cause

### How it works

The app loads via a two-stage boot sequence:

1. **`src/boot.ts`** — loaded directly by `index.html`. Has **zero static imports**. Attaches `error` + `unhandledrejection` listeners, then dynamically imports `./main`.
2. **`src/main.tsx`** — mounts React with ErrorBoundary and ToastProvider.

If any module fails to load (circular dependency, missing export, syntax error), the bootloader catches it and renders a visible error screen with the error message instead of leaving a blank page.

### Quick local reproduction

```bash
# 1. Build for production
npm run build

# 2. Preview with a local server
npm run preview

# 3. Open http://localhost:4173 — the app should load normally
# 4. If blank: check the console for the exact error
```

### Common causes

| Console error | Cause | Fix |
|---|---|---|
| `can't access lexical declaration before initialization` | Circular import creating a TDZ (temporal dead zone) | Check import chains: no A → B → A cycles. Use `types.ts` for shared types. |
| `Failed to fetch dynamically imported module` | Build artifact missing or Vite config issue | Run `npm run build` again; check `dist/` contents |
| `X is not a constructor` | Module loaded but export not yet initialized | Break the circular dependency chain |

### Architecture fix (W5.2)

The circular dependency `registry.ts → data-blocks.ts → registry.ts` was broken by:
1. Extracting shared types to `src/blocks/types.ts`
2. Block packs export registration functions instead of importing `regValue` from registry
3. `registry.ts` calls the registration functions after defining `regValue`

---

## 14. Prod Debug — Billing / Token issues

### Symptom: "Authentication failed" or "Invalid or expired token"

**Root cause:** The frontend was sending a stale Supabase access token. Supabase JWTs expire after 1 hour by default. If a user has the app open for a while and then clicks "Upgrade", the token may have expired.

**Fix applied:** The frontend now calls `supabase.auth.refreshSession()` before every billing API call. This forces a fresh access token. If the refresh itself fails (e.g. refresh token is also expired), the user is signed out and redirected to `/login`.

### Symptom: "Server configuration error" (HTTP 500)

This means one or more server-side env vars are missing. Check Cloudflare logs for the specific variable name:

1. **Cloudflare Dashboard** → Workers & Pages → `chainsolve-web` → Functions → Real-time logs
2. Look for log lines like `[checkout abc123] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`

**Important:** Cloudflare Pages has **separate env vars** for Production vs Preview. If billing works on preview but not production (or vice versa), check that all 7 env vars are set for **both** environments in Settings → Environment Variables.

### Symptom: "null value in column storage_key violates not-null constraint"

This happens when `projects.storage_key` has a NOT NULL constraint in the DB but the app INSERT didn't include it.

**Fix applied:**
1. The app now generates a `storage_key` (`{userId}/{projectId}/project.json`) upfront and includes it in every INSERT.
2. Migration `0005_projects_storage_key_nullable.sql` drops the NOT NULL constraint as a safety net.
3. Run the migration: Supabase → SQL Editor → paste contents of `0005`.

---

## 15. Supabase Advisor Fixes (0009)

> **Note:** `0008_advisor_fixes.sql` is **superseded** by `0009_advisor_fixes_v2.sql`.
> 0008 failed in production because it hardcoded `user_id` for `fs_items` and
> `project_assets`, but the live schema has `owner_id` (from the 0003 rename
> propagating to those tables). **Do not run 0008** — it is kept in the repo
> for history only. Run **0009** instead.

Migration `0009_advisor_fixes_v2.sql` addresses the same four categories of Supabase Advisor warnings as 0008, but uses dynamic SQL to auto-detect whether `fs_items` and `project_assets` use `owner_id` or `user_id`. It works on any schema variant.

### What it fixes

#### 1. `function_search_path_mutable` — function security

**Problem:** Functions `set_updated_at()`, `set_updated_at_metadata()`, `trigger_set_updated_at()`, and `handle_new_user()` were created without `SET search_path`, making them vulnerable to search_path manipulation.

**Fix:** All public functions now include `SET search_path = public` in their declaration. This covers both the names flagged by the Supabase advisor (`set_updated_at`, `set_updated_at_metadata`) and our own function names.

#### 2. `auth_rls_initplan` — RLS performance

**Problem:** RLS policies on `profiles`, `projects`, `fs_items`, `project_assets`, and `bug_reports` used `auth.uid()` directly. PostgreSQL re-evaluates this function call for every row, which becomes expensive at scale.

**Fix:** All policies now use `(select auth.uid())` instead of bare `auth.uid()`. This forces PostgreSQL to evaluate the UID once as a subquery (an "initplan") and reuse the result across all rows — turning an O(n) function-call overhead into O(1).

Example:
```sql
-- Before (slow at scale):
USING (owner_id = auth.uid())

-- After (initplan-optimized):
USING (owner_id = (select auth.uid()))
```

#### 3. `multiple_permissive_policies` — duplicate projects policies

**Problem:** The `projects` table had duplicate permissive policies for the same actions (leftover from the `user_id` → `owner_id` rename in 0003).

**Fix:** All existing policies on `projects` are dropped and replaced with a single clean set using consistent naming (`projects_select_own`, `projects_insert_own`, etc.).

#### 4. `unindexed_foreign_keys` — missing FK indexes

**Problem:** Foreign key columns on `fs_items` and `project_assets` may lack covering indexes, which degrades JOIN and CASCADE performance.

**Fix:** Uses dynamic SQL to detect the actual column name (`owner_id` or `user_id`) from `information_schema.columns`, then creates indexes on the detected column. Also creates static indexes for `parent_id`, `project_id`.

### How the auto-detection works

The migration uses `DO $$ ... $$` blocks with dynamic SQL:

```sql
SELECT column_name INTO _col
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'fs_items'
   AND column_name  IN ('owner_id', 'user_id')
 ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
 LIMIT 1;

EXECUTE format(
  'CREATE POLICY "fs_items_select_own" ON public.fs_items FOR SELECT
   TO authenticated USING (%I = (select auth.uid()))',
  _col
);
```

This pattern is used for both `fs_items` and `project_assets` policies and indexes.

### Apply checklist

- [ ] **Skip 0008** — do NOT run it (it will fail on `owner_id` schemas)
- [ ] Run `0009_advisor_fixes_v2.sql` in **Supabase → SQL Editor**
- [ ] Confirm it completes without errors (it's wrapped in `BEGIN/COMMIT`)
- [ ] Check the NOTICE messages — they report which column was detected for each table

### How to verify advisors are cleared

After running 0009, go to **Supabase Dashboard → Advisors** and rerun all checks:

- [ ] `function_search_path_mutable` — no warnings for any `public.*` functions
- [ ] `auth_rls_initplan` — no warnings for `profiles`, `projects`, `fs_items`, `project_assets`, `bug_reports`
- [ ] `multiple_permissive_policies` — no warnings for `projects`
- [ ] `unindexed_foreign_keys` — no warnings for `fs_items` or `project_assets`

If any advisor warning persists, check:

1. **Function warnings** — run `\df+ public.set_updated_at` in psql or check function definition in Supabase → Database → Functions. The `SET search_path = public` must appear in the function attributes, not just inside the body.
2. **RLS warnings** — run `SELECT policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public'` and verify every policy uses `(select auth.uid())` (with parentheses), not bare `auth.uid()`.
3. **Index warnings** — run `SELECT indexname FROM pg_indexes WHERE tablename IN ('fs_items', 'project_assets')` and confirm covering indexes exist for all FK columns.

### Smoke test

- [ ] Sign in → create project → CRUD works → cannot see other users' data
- [ ] Upload a CSV → appears in asset list → download works
- [ ] Delete a project → storage files cleaned up

---

## 16. Cloudflare Performance — Caching & Compatibility

### Cache-Control strategy

The file `public/_headers` configures Cloudflare's edge cache. The rules are
evaluated top-to-bottom; **specific paths come before the catch-all**.

| Path | `Cache-Control` | Why |
|------|----------------|-----|
| `/assets/*` | `public, max-age=31536000, immutable` | Vite adds content hashes to filenames (`index-abc123.js`). A new deploy produces new filenames, so old files never need revalidation. |
| `/brand/*` | `public, max-age=31536000, immutable` | Logo/icon files with stable names. Replace the file in `public/brand/` and redeploy to bust the cache. |
| `/favicon.svg`, `/robots.txt` | `public, max-age=86400` | Change infrequently. 24-hour cache is a good balance. |
| `/*` (everything else) | `public, max-age=0, must-revalidate` | HTML pages, SPA routes. The browser always checks with Cloudflare for the latest `index.html`. Cloudflare still returns `304 Not Modified` when the content hasn't changed, so this is fast. |

### How to verify after deploy

1. Open `https://app.chainsolve.co.uk` in Chrome
2. Open **DevTools → Network** tab
3. Hard-refresh (Ctrl+Shift+R) to bypass local cache
4. Click on any `/assets/index-*.js` request → **Response Headers** should show:
   ```
   cache-control: public, max-age=31536000, immutable
   ```
5. Click on the document request (`/` or `/app`) → should show:
   ```
   cache-control: public, max-age=0, must-revalidate
   ```

> **Note:** `vite preview` (local) does not apply `_headers` rules — those are
> Cloudflare-specific. Verify on a real deployment or Preview URL.

### Compatibility date

The file `wrangler.jsonc` at the repo root sets:

```jsonc
{ "compatibility_date": "2026-02-25" }
```

This locks the Cloudflare Workers runtime to a known API surface for Pages
Functions. It prevents surprise breakage when Cloudflare ships runtime changes.
Update the date periodically (e.g. quarterly) after reviewing the
[compatibility flags changelog](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

> **Alternative:** You can also set the compatibility date in the Cloudflare
> Dashboard → Workers & Pages → `chainsolve-web` → Settings → Compatibility
> date. The repo file takes precedence if present.

### Local verification

After building, you can preview the app locally and spot-check the output:

```bash
# Build and preview
npm run build && npm run preview
# → http://localhost:4173

# In another terminal, check that hashed assets exist:
ls dist/assets/index-*.js
# Should list 1+ files with content hashes in the filename
```

`vite preview` does **not** apply `_headers` caching rules (those are
Cloudflare-specific), but it confirms the build output is correct and SPA
routing works. To verify actual cache headers, deploy to a Cloudflare Preview
URL and use DevTools as described above.

### Preview vs Production env vars

Cloudflare Pages has **separate** environment variable sets for Production and
Preview. They do **not** inherit from each other. If billing works on one
environment but not the other, check that all 7 env vars (see §5b) are set for
**both** environments in Settings → Environment Variables.

---

## 17. Deployments (GitHub Actions → Cloudflare Pages)

The Cloudflare Pages Git-integrated build image does **not** have Rust or
wasm-pack installed, so it cannot run `npm run build`. All builds and deployments
are therefore driven exclusively by GitHub Actions using **Wrangler Direct Upload**.

### How it works

1. Every push to `main` (and every PR) runs two jobs in parallel in the `CI` workflow:
   - **rust_tests**: `cargo test --workspace` (no wasm-pack, no Node)
   - **node_checks**: wasm-pack build → typecheck → lint → format check →
     Vite build with **placeholder** Supabase credentials (allows the app to
     boot in e2e without real auth) → uploads `dist/` and `wasm-pkg/` artifacts
2. **e2e_smoke** runs after `node_checks` (push to `main` only, skipped on PRs).
   Downloads `dist/`, runs a sanity check (verifies `.wasm` present), installs
   Playwright, then runs `smoke.spec.ts` (8 tests). Target: < 90 s.
3. If all jobs pass, **deploy** runs. It downloads the `wasm-pkg/` artifact
   (skips re-running wasm-pack), then re-runs only the Vite build with **real**
   Supabase credentials from GitHub secrets, then calls:

   ```text
   wrangler pages deploy dist --project-name=chainsolve-web --branch=main
   ```

4. Wrangler uploads `dist/` as static assets and compiles `functions/` (TypeScript
   Pages Functions) using its own bundler. The `wrangler.jsonc` at the repo root
   provides the `compatibility_date`.
5. Cloudflare Pages serves the result from its edge network.

> **Key gotcha — Pages Functions:** `functions/` must exist in the working
> directory where `wrangler pages deploy` is run (the repo root), **not** inside
> `dist/`. The deploy job checks out the repo so `functions/` is always present.

### Required GitHub secrets

Add these in your GitHub repository →
**Settings → Secrets and variables → Actions → Repository secrets**:

| Secret                   | How to obtain                                                         |
|--------------------------|-----------------------------------------------------------------------|
| `VITE_SUPABASE_URL`      | Supabase Dashboard → Project → Settings → API → Project URL.          |
|                          | This is the **public** anon URL — safe to store as a secret or plain  |
|                          | repository variable. Already visible in your deployed JS bundle.      |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project → Settings → API → `anon` `public` key.  |
|                          | Same — publicly visible in the bundle, protected by Supabase RLS.     |
| `CLOUDFLARE_API_TOKEN`   | Cloudflare Dashboard → My Profile → API Tokens → Create Token.        |
|                          | Use the **Edit Cloudflare Workers** template, scope to                |
|                          | *Cloudflare Pages: Edit* on your account. Copy the token immediately. |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare Dashboard → right-hand sidebar on any zone/Workers page.   |
|                          | Alternatively: the Dashboard URL contains `/ACCOUNT_ID/`.             |

> **Why are the Supabase credentials needed here?**  The `node_checks` build bakes
> **placeholder** credentials into `dist/` so that CI smoke tests can boot the app
> without real auth (Supabase calls fail silently to a non-existent hostname). The
> `deploy` job re-runs only the Vite build with **real** credentials so the deployed
> production app has a functioning Supabase connection.

### Required manual step in Cloudflare UI

**Disable Git-integrated auto-builds** so Cloudflare never attempts to build the
repo itself:

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) →
   **Workers & Pages → chainsolve-web → Settings → Builds**
2. Click **Disable automatic builds** (or "Pause builds" / "Disconnect Git",
   depending on the Dashboard version).

> Failing to disable this means every push to `main` triggers *two* deploy
> attempts: one from GitHub Actions (succeeds) and one from Cloudflare
> (fails with `wasm-pack: not found`). The Cloudflare failure is cosmetic but
> creates noise in the deployment history.

### Re-deploying manually

To redeploy without a code change (e.g. after updating a Cloudflare environment
variable):

1. GitHub → **Actions** tab → select the `CI` workflow
2. Find the last successful run on `main`
3. Click **Re-run jobs → Re-run all jobs**

This re-runs the full CI pipeline and, on success, re-deploys to Cloudflare.

### Preview deployments (PRs)

Pull requests trigger the `build` job but **not** the `deploy` job (the deploy
condition requires `github.event_name == 'push'` on `main`). PR builds are
verification-only; no Cloudflare deployment is created.

If you need per-PR preview URLs in the future, add a second deploy job with
`--branch=${{ github.head_ref }}` and a separate Cloudflare Pages preview
environment.

### Troubleshooting deploy failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Error: No such file or directory 'dist'` | Download artifact step failed or build job failed before uploading | Check the `build` job logs; re-run if transient |
| `Authentication error` | `CLOUDFLARE_API_TOKEN` missing or expired | Re-create the token in Cloudflare → API Tokens, update the GitHub secret |
| `Project not found` | First-ever deploy on a fresh account | Run once locally: `npx wrangler pages project create chainsolve-web` |
| Functions 500 / 1101 after deploy | Cloudflare env vars missing | Add all 7 vars in CF Dashboard → Settings → Environment Variables → Production |

---

## 18. CI tiers — speed, coverage, and how to run each

### Overview

| Tier         | Workflow                    | Trigger                                 | Tests                       | Target time |
|--------------|-----------------------------|-----------------------------------------|-----------------------------|-------------|
| **CI smoke** | `CI` (`e2e_smoke` job)      | every push / PR                         | `smoke.spec.ts` (8 tests)   | < 90 s      |
| **Full E2E** | `Full E2E suite`            | nightly 02:00 UTC + `workflow_dispatch` | all `*.spec.ts` (~35 tests) | < 5 min     |

### CI workflow (`CI`)

Three jobs run on every push to `main` and on every PR:

- **`rust_tests`** and **`node_checks`** run **in parallel**:
  - `rust_tests`: `cargo test --workspace` — pure Rust unit + property tests.
  - `node_checks`: wasm-pack → typecheck → lint → format → Vite build → upload
    `dist/` artifact.
- **`e2e_smoke`** runs after `node_checks`. It downloads the artifact, starts
  `vite preview`, and runs only the Playwright `smoke` project
  (`smoke.spec.ts`).

The `smoke` project has one WASM compilation (for the "no console errors"
test); the other 7 tests are instant (HTTP, meta-tag, title checks).

On a **warm runner** (Swatinem/rust-cache + npm cache hit) the entire CI
pipeline completes in roughly:

- `rust_tests`: ~1 min  ┐
- `node_checks`: ~3 min ┘ parallel → wall clock ~3 min
- `e2e_smoke`: ~1 min (sequential after node_checks)
- **Total**: ~4 min

### Full E2E workflow (`Full E2E suite`)

Runs all spec files via the Playwright `full` project:

- `smoke.spec.ts`, `groups.spec.ts`, `plot-smoke.spec.ts`, `wasm-engine.spec.ts`
- `wasm-engine.spec.ts` uses a **worker-scoped `enginePage` fixture**: WASM is
  compiled once per Playwright worker then shared across all ~16 API tests in
  that file — no repeated cold-compilation cost.

#### How to trigger manually

```bash
# Option A: GitHub UI
# Actions → "Full E2E suite" → Run workflow

# Option B: GitHub CLI
gh workflow run e2e-full.yml --ref main

# Option C: run locally against the preview server
npm run build && npm run test:e2e:full
```

### Running E2E locally

```bash
# Smoke only (mirrors CI)
npm run build && npm run test:e2e:smoke

# Full suite
npm run build && npm run test:e2e:full

# Interactive UI mode (full suite, headed)
npm run build && npm run test:e2e:ui
```

### Playwright projects reference

| Project | Spec files            | Use case                                  |
|---------|-----------------------|-------------------------------------------|
| `smoke` | `smoke.spec.ts` only  | CI gate (fast, stable)                    |
| `full`  | all `*.spec.ts`       | Nightly / pre-release / manual deep check |

### `engine-fatal` sentinel

If the WASM engine fails to initialise in any environment, every test that
waits for engine boot will now **fail immediately** with the error message from
`data-fatal-message` on `[data-testid="engine-fatal"]` — instead of hanging
until the 60-second per-test deadline.

This means a broken WASM build in CI shows a 1-second failure like:

```text
Error: [engine-fatal] RuntimeError: unreachable executed at ...
```

rather than 20 tests each timing out after 60 s.
