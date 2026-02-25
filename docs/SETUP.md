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
| `0006_entitlements_enforcement.sql` | Plan-based limits: project count trigger, storage RLS tightening, helper functions |

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

## 5. Cloudflare Pages — Deploy

### 5a. Connect your repository

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages → Connect to Git**
2. Select your GitHub/GitLab repository
3. Use these **build settings**:

   | Setting | Value |
   |---------|-------|
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(leave blank)* |

### 5b. Add environment variables

Go to **Settings → Environment variables** and add **all** of the following for **Production** (and optionally Preview):

| Variable | Where to find it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_URL` | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → signing secret |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Stripe → Products → your price ID |

> **Note**: Variables prefixed `VITE_` are injected into the browser bundle at build time. All others are server-side only (Functions).

### 5c. Deploy

Click **Save and Deploy**. The first deploy will take ~1 minute.

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

## 11. Go-live checklist

- [ ] SQL migration applied successfully
- [ ] Supabase Auth site URL set to `https://app.chainsolve.co.uk`
- [ ] Supabase redirect URLs include both `https://app.chainsolve.co.uk/**` and `https://chainsolve-web.pages.dev/**`
- [ ] Resend SMTP verified (send a test email)
- [ ] Stripe in **Live mode** (not test mode)
- [ ] Stripe webhook endpoint set to `https://app.chainsolve.co.uk/api/stripe/webhook`
- [ ] Stripe Customer Portal return URL set to `https://app.chainsolve.co.uk/app`
- [ ] All 7 Cloudflare environment variables set for Production
- [ ] Cloudflare Pages deploy succeeded (`npm run build` → `dist/`)
- [ ] Stripe test webhook returns `200 ok` and `stripe_events` row appears
- [ ] End-to-end test: sign up → upgrade (7-day trial) → portal → cancel

---

## 12. Prod Debug — Billing / Token issues

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
