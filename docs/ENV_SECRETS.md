# Environment Variables & Secrets

> **Source of truth** for every secret, API key, and configuration variable used
> by ChainSolve Web.  Keep this file up-to-date when adding or rotating keys.

---

## 1. Frontend (Vite — baked into browser bundle)

These are injected at **build time** by Vite.  They appear in the shipped JS
bundle and are **not secrets** — Supabase Row-Level Security (RLS) protects all
data even though the anon key is public.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_SUPABASE_URL` | Yes | — | Supabase project REST endpoint |
| `VITE_SUPABASE_ANON_KEY` | Yes | — | Supabase anonymous client key |
| `VITE_OBS_ENABLED` | No | `false` (opt-in) | Set `true` to enable browser-side error reporting |
| `VITE_OBS_SAMPLE_RATE` | No | `1.0` | Fraction of events to send (`0.0`–`1.0`) |
| `VITE_DIAGNOSTICS_UI_ENABLED` | No | — | Set `true` + `localStorage cs_diag=1` to show `/diagnostics` in prod |
| `VITE_IS_CI_BUILD` | No | — | Set `true` **only** in CI `node_checks` job; permits placeholder creds |
| `VITE_LLM_API_KEY` | No | — | Optional LLM API key for AI graph builder (future) |

**Where to set (local dev):** `.env` file (git-ignored, copy from `.env.example`).

---

## 2. Cloudflare Pages Functions (server-side runtime secrets)

These are available **only** to Pages Functions via `context.env`.  They never
appear in the browser bundle.

| Variable | Required | Secret? | Purpose |
|----------|----------|---------|---------|
| `SUPABASE_URL` | Yes | No | Supabase REST endpoint (same value as `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **YES** | Bypasses RLS for webhook handlers and observability writes |
| `STRIPE_SECRET_KEY` | Yes | **YES** | Stripe API secret (`sk_live_...` prod / `sk_test_...` dev) |
| `STRIPE_WEBHOOK_SECRET` | Yes | **YES** | HMAC signing secret for webhook signature verification |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Yes | No | Stripe Price ID for Pro Monthly subscription |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | Yes | No | Stripe Price ID for Pro Annual subscription |
| `STRIPE_PRICE_ID_ENT_10_MONTHLY` | No | No | Stripe Price ID for Enterprise 10-seat Monthly |
| `STRIPE_PRICE_ID_ENT_10_ANNUAL` | No | No | Stripe Price ID for Enterprise 10-seat Annual |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY` | No | No | Stripe Price ID for Enterprise Unlimited Monthly |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL` | No | No | Stripe Price ID for Enterprise Unlimited Annual |
| `MARKETPLACE_PLATFORM_FEE_RATE` | No | No | Platform fee fraction for marketplace purchases (default `0.15`) |

**Where to set:** Cloudflare Dashboard → Workers & Pages → `chainsolve-web` →
Settings → Environment variables.  Must be set for **both Production and
Preview** (they do not inherit from each other).

---

## 3. GitHub Actions Secrets

Used only during CI/CD — never baked into the deployed app.

| Secret | Source | Purpose |
|--------|--------|---------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Frontend build in `deploy` job |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | Frontend build in `deploy` job |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens | Authenticate `wrangler pages deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard sidebar or URL | Cloudflare account for Pages deployment |

> **Note:** `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_*` secrets are stored
> **only** in Cloudflare environment variables, **not** in GitHub Actions
> secrets.

---

## 4. Build-time Constants (auto-generated)

These are injected automatically by `vite.config.ts` and require no manual
configuration.

| Constant | Value | Purpose |
|----------|-------|---------|
| `__CS_VERSION__` | `package.json` version | App version string |
| `__CS_SHA__` | Git commit SHA | Build provenance |
| `__CS_BUILD_TIME__` | ISO timestamp | Build timestamp |
| `__CS_ENV__` | `development` or `production` | Runtime environment |

---

## 5. Where Each Variable Lives

```
┌─────────────────────────────────────────────────────────────┐
│ .env (local dev — git-ignored)                              │
│  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,                │
│  VITE_OBS_ENABLED, VITE_OBS_SAMPLE_RATE                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GitHub Repository Secrets                                    │
│  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,                │
│  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID                │
└──────────────────────────┬──────────────────────────────────┘
                           │ used by deploy job
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Pages Environment Variables                       │
│  (Production + Preview — set independently)                  │
│                                                              │
│  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (build-time)   │
│  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    (runtime)       │
│  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET   (runtime)       │
│  STRIPE_PRICE_ID_*                          (runtime)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Key Rotation Procedures

### Supabase anon key
1. Regenerate in Supabase Dashboard → Project Settings → API.
2. Update: `.env`, GitHub Secrets, Cloudflare env vars (Production + Preview).
3. Redeploy via CI or `wrangler pages deploy`.

### Supabase service-role key
1. Regenerate in Supabase Dashboard → Project Settings → API.
2. Update: Cloudflare env vars only (Production + Preview).
3. No redeploy needed — Pages Functions read env at runtime.

### Stripe secret key
1. Roll key in Stripe Dashboard → Developers → API keys.
2. Update: Cloudflare env var `STRIPE_SECRET_KEY` (Production + Preview).
3. Ensure the webhook endpoint is updated if the endpoint URL changed.

### Stripe webhook secret
1. In Stripe Dashboard → Webhooks → select endpoint → Signing secret → Roll.
2. Update: Cloudflare env var `STRIPE_WEBHOOK_SECRET` (Production + Preview).

### Cloudflare API token
1. Regenerate in Cloudflare Dashboard → My Profile → API Tokens.
2. Update: GitHub Secrets `CLOUDFLARE_API_TOKEN`.

---

## 7. New Team Member Setup

To set up a fresh development environment from scratch:

1. Clone the repo and `cp .env.example .env`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase
   Dashboard → Project Settings → API.
3. Run `npm ci` to install dependencies.
4. Run `npm run dev` to start the dev server.

For **server-side function testing** (Stripe webhooks, etc.):

5. Set Stripe test-mode keys in `.env`:
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_PRICE_ID_PRO_MONTHLY=price_...`
6. Run `npx wrangler pages dev dist` for local Pages Functions.

For **CI/CD deployment** (admin only):

7. Ensure GitHub Secrets are configured (see Section 3).
8. Ensure Cloudflare env vars are configured for both Production and Preview
   (see Section 2).

---

## 8. Security Checklist

- [ ] No secrets committed to git (`.env` is in `.gitignore`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Cloudflare env vars, never in
  GitHub Secrets or frontend code
- [ ] `STRIPE_SECRET_KEY` uses `sk_test_` in dev/preview, `sk_live_` in
  production
- [ ] Webhook signatures are verified for every Stripe event
- [ ] CI deploy job validates Supabase credentials are not placeholder values
- [ ] CI guard checks for `placeholder.supabase.co` in production build output
- [ ] Frontend bundle does not contain any `sk_live`, `sk_test`, `service_role`,
  or `whsec_` strings
