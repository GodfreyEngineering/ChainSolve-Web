# Service Setup Checklist

> F7-4 — Idiot-proof checklist for setting up every external service and
> secret so ChainSolve-Web works flawlessly in production.

---

## Service overview

| # | Service | Purpose | Required? |
|---|---------|---------|-----------|
| 1 | Supabase | Database, Auth, Storage, Realtime | Yes |
| 2 | Stripe | Payments, Billing, Customer Portal | Yes |
| 3 | Cloudflare Pages | Hosting, CDN, Edge Functions | Yes |
| 4 | Resend | Transactional email (via Supabase SMTP) | Yes |
| 5 | GitHub Actions | CI/CD pipeline | Yes |
| 6 | Cloudflare Turnstile | CAPTCHA on auth forms | Optional |
| 7 | OpenAI | AI Copilot | Optional |

---

## 1. Supabase

### 1.1 Create project

- [ ] Go to [supabase.com](https://supabase.com) > New Project
- [ ] Choose region closest to your users
- [ ] Set a strong database password (save it securely)
- [ ] Wait for project to finish provisioning

### 1.2 Get credentials

- [ ] **Project URL**: Settings > API > Project URL
  - Save as `VITE_SUPABASE_URL` and `SUPABASE_URL`
- [ ] **Anon key**: Settings > API > anon public
  - Save as `VITE_SUPABASE_ANON_KEY`
- [ ] **Service role key**: Settings > API > service_role (SECRET - never expose client-side)
  - Save as `SUPABASE_SERVICE_ROLE_KEY`

### 1.3 Run migrations

- [ ] Open SQL Editor in Supabase Dashboard
- [ ] Run each file in `supabase/migrations/` in order (0001 through 0046)
- [ ] Verify: run `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
  - Should return 23 tables

### 1.4 Configure Auth

- [ ] Authentication > Providers > Email: Enable
- [ ] Authentication > URL Configuration:
  - Site URL: `https://app.chainsolve.co.uk`
  - Redirect URLs: add `https://app.chainsolve.co.uk/**`
  - Add `http://localhost:5173/**` for local dev
- [ ] Authentication > Email Templates: customize if desired

### 1.5 Create storage buckets

- [ ] Storage > New Bucket: `projects` (Private, 50 MB limit)
- [ ] Storage > New Bucket: `uploads` (Private, 50 MB limit)
- [ ] Verify RLS policies are active (migration 0001 creates them)

### 1.6 Verify RLS

- [ ] Run in SQL Editor:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public' ORDER BY tablename;
  ```
- [ ] All 23 tables should show `rowsecurity = true`

---

## 2. Stripe

### 2.1 Create account

- [ ] Sign up at [stripe.com](https://stripe.com)
- [ ] Complete account verification (business details, bank account)
- [ ] Start in **Test mode** (toggle in dashboard header)

### 2.2 Get API keys

- [ ] Developers > API Keys:
  - **Secret key** (`sk_test_...` / `sk_live_...`): Save as `STRIPE_SECRET_KEY`
  - **Publishable key**: not needed (Stripe.js loaded from CDN)

### 2.3 Create products and prices

Create these 6 prices (Products > Add product):

| Product | Interval | Save as |
|---------|----------|---------|
| Pro | Monthly | `STRIPE_PRICE_ID_PRO_MONTHLY` |
| Pro | Annual | `STRIPE_PRICE_ID_PRO_ANNUAL` |
| Enterprise 10 seats | Monthly | `STRIPE_PRICE_ID_ENT_10_MONTHLY` |
| Enterprise 10 seats | Annual | `STRIPE_PRICE_ID_ENT_10_ANNUAL` |
| Enterprise Unlimited | Monthly | `STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY` |
| Enterprise Unlimited | Annual | `STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL` |

- [ ] All 6 price IDs saved (format: `price_...`)

### 2.4 Configure webhook

- [ ] Developers > Webhooks > Add endpoint
- [ ] URL: `https://app.chainsolve.co.uk/api/stripe/webhook`
- [ ] Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- [ ] Copy the **Signing secret** (`whsec_...`): Save as `STRIPE_WEBHOOK_SECRET`

### 2.5 Configure Customer Portal

- [ ] Settings > Billing > Customer Portal
- [ ] Enable: Cancel subscription, Update payment method
- [ ] Return URL: `https://app.chainsolve.co.uk/settings?tab=billing`

### 2.6 Go live

- [ ] When ready for production: switch to **Live mode** in Stripe dashboard
- [ ] Repeat 2.2-2.4 with live keys (replace `sk_test_` with `sk_live_`)
- [ ] Update all Stripe env vars with live values

---

## 3. Cloudflare Pages

### 3.1 Create project

- [ ] Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
- [ ] Pages > Create a project > Direct Upload (NOT Git integration)
- [ ] Project name: `chainsolve-web`

### 3.2 Custom domain

- [ ] Pages > chainsolve-web > Custom domains > Add
- [ ] Enter `app.chainsolve.co.uk`
- [ ] Add the CNAME record to your DNS (Cloudflare shows the value)
- [ ] Wait for SSL certificate provisioning

### 3.3 Environment variables (Production)

Go to Pages > chainsolve-web > Settings > Environment variables > Production:

| Variable | Value | Type |
|----------|-------|------|
| `SUPABASE_URL` | Your Supabase project URL | Plain text |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Encrypted |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Encrypted |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Encrypted |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | `price_...` | Plain text |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | `price_...` | Plain text |
| `STRIPE_PRICE_ID_ENT_10_MONTHLY` | `price_...` | Plain text |
| `STRIPE_PRICE_ID_ENT_10_ANNUAL` | `price_...` | Plain text |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY` | `price_...` | Plain text |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL` | `price_...` | Plain text |
| `OPEN_AI_API_KEY` | (optional) OpenAI key | Encrypted |
| `AI_MODEL` | (optional) e.g. `gpt-4.1` | Plain text |

- [ ] All 10 required variables set
- [ ] Encrypted fields marked as encrypted (lock icon)

### 3.4 Disable Git-integrated builds

- [ ] Pages > chainsolve-web > Settings > Builds & deployments
- [ ] **Disable** automatic builds (GitHub Actions handles this)

### 3.5 Disable Web Analytics

- [ ] Pages > chainsolve-web > Web Analytics: **OFF**
- [ ] (CSP blocks the analytics beacon; enabling it causes console errors)

### 3.6 Get deploy credentials

- [ ] My Profile > API Tokens > Create Token
  - Permissions: Cloudflare Pages > Edit
  - Zone: your domain
- [ ] Save token as `CLOUDFLARE_API_TOKEN` (for GitHub Actions)
- [ ] Account ID: found at Overview > right sidebar
- [ ] Save as `CLOUDFLARE_ACCOUNT_ID`

---

## 4. Resend (Transactional Email)

### 4.1 Create account

- [ ] Sign up at [resend.com](https://resend.com)
- [ ] Add and verify your sending domain (DNS records)

### 4.2 Create API key

- [ ] API Keys > Create API Key (Full access)
- [ ] Copy the key (shown once)

### 4.3 Configure Supabase SMTP

- [ ] Supabase > Project Settings > Authentication > SMTP Settings
- [ ] Enable custom SMTP: **ON**
- [ ] Host: `smtp.resend.com`
- [ ] Port: `465`
- [ ] Username: `resend`
- [ ] Password: your Resend API key
- [ ] Sender email: `noreply@yourdomain.com` (must match verified domain)

### 4.4 Test

- [ ] Sign up with a new email in the app
- [ ] Confirm the email arrives with correct branding

---

## 5. GitHub Actions

### 5.1 Repository secrets

Go to GitHub > Settings > Secrets and variables > Actions > New repository secret:

| Secret | Value | Used by |
|--------|-------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | Build (baked into dist/) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Build |
| `VITE_TURNSTILE_SITE_KEY` | (optional) Turnstile site key | Build |
| `CLOUDFLARE_API_TOKEN` | CF Pages deploy token | Deploy job |
| `CLOUDFLARE_ACCOUNT_ID` | CF account ID | Deploy job |

- [ ] All 5 secrets set (3 required + 2 optional)

### 5.2 Verify CI

- [ ] Push to main and check Actions tab
- [ ] All 4 jobs should pass: `rust_tests`, `node_checks`, `e2e_smoke`, `deploy`

---

## 6. Cloudflare Turnstile (Optional)

### 6.1 Create widget

- [ ] Cloudflare Dashboard > Turnstile > Add Site
- [ ] Domain: `app.chainsolve.co.uk`
- [ ] Widget mode: Managed (recommended)
- [ ] Copy **Site Key**: Save as `VITE_TURNSTILE_SITE_KEY`
- [ ] Copy **Secret Key**: (not needed server-side currently)

### 6.2 Configure

- [ ] Add `VITE_TURNSTILE_SITE_KEY` to GitHub Secrets
- [ ] Redeploy (key is baked into the build)
- [ ] Verify CAPTCHA appears on login/signup forms

---

## 7. OpenAI (Optional — AI Copilot)

### 7.1 Get API key

- [ ] Go to [platform.openai.com](https://platform.openai.com) > API Keys
- [ ] Create a new key with usage limits
- [ ] Save as `OPEN_AI_API_KEY`

### 7.2 Configure

- [ ] Add `OPEN_AI_API_KEY` to Cloudflare Pages env vars (Production, encrypted)
- [ ] Optionally set `AI_MODEL` (default: `gpt-4.1`)
- [ ] Redeploy

### 7.3 Verify

- [ ] Open AI Copilot panel in the app
- [ ] Submit a prompt (e.g., "Calculate the drag force on a sphere")
- [ ] Verify response arrives without errors

---

## Final verification checklist

Run through after all services are configured:

```
[ ] App loads at https://app.chainsolve.co.uk
[ ] Sign up works (email sent via Resend)
[ ] Login works (redirects to /app)
[ ] Password reset works (email sent)
[ ] Create project + add blocks + compute values
[ ] Save project + reload = persisted
[ ] Upgrade button opens Stripe Checkout
[ ] Complete test payment = Pro tier activated
[ ] Manage Billing opens Stripe Portal
[ ] Block library shows all blocks
[ ] PDF export works (Pro)
[ ] Excel export works (Pro)
[ ] .chainsolvejson export works (any tier)
[ ] AI Copilot responds (if configured)
[ ] CAPTCHA appears on auth (if Turnstile configured)
[ ] Console: zero CSP errors
[ ] Console: zero network errors
```

---

## Quick reference: all env vars

### Client-side (baked into build via Vite)

| Variable | Required | Where set |
|----------|----------|-----------|
| `VITE_SUPABASE_URL` | Yes | GitHub Secrets |
| `VITE_SUPABASE_ANON_KEY` | Yes | GitHub Secrets |
| `VITE_TURNSTILE_SITE_KEY` | No | GitHub Secrets |
| `VITE_OBS_ENABLED` | No | GitHub Secrets |
| `VITE_OBS_SAMPLE_RATE` | No | GitHub Secrets |
| `VITE_LLM_API_KEY` | No | GitHub Secrets |
| `VITE_DIAGNOSTICS_UI_ENABLED` | No | GitHub Secrets |

### Server-side (Cloudflare Pages env vars)

| Variable | Required | Type |
|----------|----------|------|
| `SUPABASE_URL` | Yes | Plain |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Encrypted |
| `STRIPE_SECRET_KEY` | Yes | Encrypted |
| `STRIPE_WEBHOOK_SECRET` | Yes | Encrypted |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Yes | Plain |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | Yes | Plain |
| `STRIPE_PRICE_ID_ENT_10_MONTHLY` | Yes | Plain |
| `STRIPE_PRICE_ID_ENT_10_ANNUAL` | Yes | Plain |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY` | Yes | Plain |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL` | Yes | Plain |
| `OPEN_AI_API_KEY` | No | Encrypted |
| `AI_MODEL` | No | Plain |

### CI/CD (GitHub Secrets)

| Secret | Required |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Yes |
