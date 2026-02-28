# ChainSolve — Release & Go-Live Checklist

> **P100** — Run this checklist top-to-bottom for every production release.
> Each section contains a `[ ]` checkbox. Tick as you go.

---

## 1. Pre-release gate (local, before pushing)

```bash
./scripts/verify-ci.sh   # Must print "All CI checks passed."
```

- [ ] `verify-ci.sh` exits 0 with **All CI checks passed**.
- [ ] No ESLint **errors** (warnings are acceptable).
- [ ] Bundle initial-JS gzip ≤ 350 KB (enforced by size check).
- [ ] WASM gzip ≤ 200 KB (enforced by size check).

---

## 2. Database migrations (Supabase)

Run each migration **in numeric order** via Supabase → SQL Editor.

- [ ] All migrations in `supabase/migrations/` have been applied (check
      Supabase → Table Editor for the expected tables).
- [ ] `observability_events` table present (from `0012_csp_reports.sql`).
- [ ] RLS enabled on all user-facing tables — verify in Supabase →
      Authentication → Policies.

**Quick sanity query** (paste in SQL Editor):

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

All rows should have `rowsecurity = true`.

---

## 3. Environment variables

All vars below must be set in **Cloudflare Pages → Settings → Environment
Variables** (production environment).

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project → Settings → API → URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project → Settings → API → anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys |
| `VITE_OBS_ENABLED` | Set to `true` to enable client error reporting |
| `VITE_OBS_SAMPLE_RATE` | `1.0` for production (or lower to reduce volume) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Supabase → Settings → API → service_role key |
| `STRIPE_SECRET_KEY` | **Secret.** Stripe → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | **Secret.** Stripe → Webhooks → endpoint → Signing secret |
| `RESEND_API_KEY` | **Secret.** Resend → API Keys |

- [ ] All variables set in Cloudflare Pages production environment.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `RESEND_API_KEY` are in the **Secret** (encrypted) bucket, **not** plain text.
- [ ] No secrets committed to the repository (`git log --all -S "sk_live_"` returns nothing).

---

## 4. Stripe configuration

- [ ] Stripe webhook endpoint points to `https://app.chainsolve.co.uk/api/billing/webhook`.
- [ ] Webhook is listening for at minimum:
      `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] Stripe product/price IDs match what the billing code expects
      (confirm in `functions/api/billing/`).
- [ ] Live-mode keys are in use (not test-mode `sk_test_...`).

---

## 5. Cloudflare Pages deployment

```bash
# From main branch — push triggers a Pages build automatically.
git push origin main
```

- [ ] Cloudflare Pages build succeeds (check Pages dashboard → Deployments).
- [ ] Deployment URL matches `https://app.chainsolve.co.uk` (custom domain
      configured under Pages → Custom domains).
- [ ] HTTPS certificate is valid (browser shows padlock).

---

## 6. Post-deploy smoke tests

Run each smoke test in an **incognito window** against the production URL.

### 6a. App load & engine init

- [ ] `https://app.chainsolve.co.uk` loads without console errors.
- [ ] WASM engine starts (canvas editor shows blocks, no "engine failed" banner).
- [ ] Service worker or caching headers do not serve a stale build
      (check `app_version` in network → `/api/report/client` payload, or press
      Ctrl+Shift+I → Application → Service Workers → "Update on reload").

### 6b. Auth flow

- [ ] Sign-up with a new email → confirmation email arrives within 2 minutes.
- [ ] Email link → redirected back to app, logged in.
- [ ] Log out → redirected to `/login`.
- [ ] Log back in with password → lands on project list.

### 6c. Core canvas workflow

- [ ] Create a new project and canvas.
- [ ] Add a **Number** block (value 10), an **F = ma** block, a **Display** block.
- [ ] Connect Number → F=ma (port `m`), add another Number → F=ma (port `a`).
- [ ] Connect F=ma → Display. Display shows `100` (10 × 10).
- [ ] Save (Ctrl+S or toolbar). Reload page. Canvas reloads with values intact.

### 6d. Billing (free plan limits)

- [ ] Free account cannot create a second project (upgrade modal appears).
- [ ] Stripe checkout page opens when user clicks upgrade.

### 6e. Observability

- [ ] Trigger a test error in browser console:
      `window.dispatchEvent(new ErrorEvent('error', { message: 'test-obs' }))`
- [ ] Check Supabase → Table Editor → `observability_events` for a new row
      (within ~30 seconds, if `VITE_OBS_ENABLED=true`).

---

## 7. CSP and security headers

Verify headers with:

```bash
curl -sI https://app.chainsolve.co.uk | grep -iE "content-security|x-frame|x-content"
```

Expected:
- `Content-Security-Policy` present and not empty.
- `X-Frame-Options: DENY` (or `SAMEORIGIN`).
- `X-Content-Type-Options: nosniff`.

- [ ] All three headers present and non-empty.
- [ ] CSP report endpoint `/api/report/csp` returns `204` for a POST with
      a valid JSON body (test with curl or Postman).

---

## 8. Performance quick-check

Open DevTools → Lighthouse → run on production URL (mobile preset):

- [ ] LCP ≤ 2.5 s.
- [ ] CLS ≤ 0.1.
- [ ] No "render-blocking resources" from external origins not already in CSP
      font allowlist.

---

## 9. Rollback procedure

If a deployed build is broken:

1. **Instant rollback** — Cloudflare Pages → Deployments → pick previous
   successful deployment → "Rollback to this deployment".
2. **Code rollback** — revert the commit and push:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```
3. **Database rollback** — migrations are forward-only. If a migration must
   be reversed, write a compensating SQL script and apply it via SQL Editor.
   Never delete migrations from the `supabase/migrations/` directory.

---

## 10. Post-launch monitoring (first 24 h)

- [ ] Check Supabase → Logs → API for unexpected 4xx/5xx spikes.
- [ ] Check Stripe → Dashboard → Events for failed webhook deliveries.
- [ ] Check Cloudflare → Analytics → for traffic anomalies or error-rate spikes.
- [ ] Check `observability_events` table for any surge in `client_error` or
      `react_errorboundary` events.

---

## 11. Release sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Engineer | | | |
| QA / Reviewer | | | |

---

*This document lives at `docs/RELEASE.md`. Update it whenever infrastructure
or deployment steps change.*
