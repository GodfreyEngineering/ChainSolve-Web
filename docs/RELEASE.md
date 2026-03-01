# ChainSolve — Release & Go-Live Checklist (v2)

> **E11-2 / P100** — Run this checklist top-to-bottom for every production release.
> Each section contains a `[ ]` checkbox. Tick as you go.
> Acceptance: "anyone can release" — no tribal knowledge required.

---

## 1. Pre-release gate (local, before pushing)

```bash
./scripts/verify-ci.sh   # Must print "All CI checks passed."
```

- [ ] `verify-ci.sh` exits 0 with **All CI checks passed**.
- [ ] No ESLint **errors** (warnings are acceptable).
- [ ] Bundle initial-JS gzip ≤ 370 KB (enforced by size check).
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

### 4a. Webhook

- [ ] Stripe webhook endpoint points to `https://app.chainsolve.co.uk/api/billing/webhook`.
- [ ] Webhook is listening for at minimum:
      `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.payment_failed`.
- [ ] Live-mode keys are in use (not test-mode `sk_test_...`).

### 4b. Price IDs (all plans)

All six price IDs must be configured in Cloudflare Pages secrets.
Confirm each matches a live Stripe price object.

| Env var | Plan | Interval |
|---------|------|----------|
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Pro | Monthly |
| `STRIPE_PRICE_ID_PRO_ANNUAL` | Pro | Annual |
| `STRIPE_PRICE_ID_ENT_10_MONTHLY` | Enterprise 10 seats | Monthly |
| `STRIPE_PRICE_ID_ENT_10_ANNUAL` | Enterprise 10 seats | Annual |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY` | Enterprise Unlimited | Monthly |
| `STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL` | Enterprise Unlimited | Annual |

- [ ] All six price IDs set in Cloudflare Pages production secrets.
- [ ] Each price ID resolves to an active Stripe price
      (`stripe prices retrieve <id>` → `active: true`).
- [ ] Customer Portal enabled in Stripe with return URL
      `https://app.chainsolve.co.uk/settings/billing`.

### 4c. Billing smoke tests

- [ ] Pro monthly checkout completes in test mode (before live keys).
- [ ] Pro annual checkout shows correct annual amount.
- [ ] Enterprise 10-seat checkout includes seat quantity.
- [ ] Customer Portal allows plan switch (monthly ↔ annual).

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
- [ ] Pro user has unlimited projects and all exports enabled.
- [ ] Developer/admin accounts bypass plan restrictions (`resolveEffectivePlan`).

### 6e. Block library & search (E5-5)

- [ ] Block library search returns ranked results (best match first).
- [ ] Searching "force" finds F=ma via synonym.
- [ ] Searching "average" finds Mean via synonym.
- [ ] Category filter tabs work correctly.

### 6f. Explore & moderation (E10-1)

- [ ] Comments can be posted on Explore items.
- [ ] Own comments can be deleted.
- [ ] Reporting a comment flags it (hidden from non-moderators).
- [ ] Server-side rate limit blocks > 5 comments per minute.

### 6h. Observability

- [ ] Trigger a test error in browser console:
      `window.dispatchEvent(new ErrorEvent('error', { message: 'test-obs' }))`
- [ ] Check Supabase → Table Editor → `observability_events` for a new row
      (within ~30 seconds, if `VITE_OBS_ENABLED=true`).

---

## 7. CSP and security headers

### 7a. Header verification

```bash
curl -sI https://app.chainsolve.co.uk | grep -iE "content-security|x-frame|x-content|referrer|permissions|strict-transport|x-xss"
```

- [ ] `Content-Security-Policy` present and includes `'wasm-unsafe-eval'` (required for WASM engine).
- [ ] CSP does NOT include `'unsafe-eval'` or `'unsafe-inline'` for scripts.
- [ ] `X-Frame-Options: DENY`.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] `Permissions-Policy` present (camera/microphone/geolocation denied).
- [ ] `Strict-Transport-Security` present with `max-age >= 31536000`.

### 7b. CSP report endpoint

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://app.chainsolve.co.uk/api/report/csp \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"document-uri":"https://test","violated-directive":"script-src"}}'
```

- [ ] Returns `204` (accepted).
- [ ] Row appears in `observability_events` within 30 seconds.

### 7c. CSP regression check

- [ ] No browser console CSP violations on: login page, canvas page, settings page, Explore page.
- [ ] Stripe checkout iframe loads without CSP errors (do NOT enable COEP/COOP).
- [ ] WASM engine loads successfully (no `EvalError` or `CompileError` in console).

See `docs/SECURITY.md` §2–3 and `docs/DECISIONS/ADR-0002-csp-wasm-unsafe-eval.md`
for rationale and detailed CSP configuration.

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

## 12. Test persona checklist

Use the personas defined in `docs/TEST_PERSONAS.md` to verify role-based behaviour.
All four personas must be bootstrapped before smoke tests.

| Persona | Email | Key tests |
|---------|-------|-----------|
| Free | `free@test.chainsolve.local` | Plan gating (1 project, 2 canvases, no export, no CSV) |
| Pro | `pro@test.chainsolve.local` | All features unlocked, Explore installs, all exports |
| Enterprise | `enterprise@test.chainsolve.local` | Org policy flags, company-only Explore, audit log |
| Developer | `dev@test.chainsolve.local` | `is_developer=true`, all features, diagnostics page |
| Admin | `admin@test.chainsolve.local` | `is_admin=true`, moderation tools, flagged comments |
| Moderator | `mod@test.chainsolve.local` | `is_moderator=true`, comment moderation workflow |

- [ ] All personas created and plans set (see `docs/TEST_PERSONAS.md`).
- [ ] Free user verifies plan gating works.
- [ ] Pro user verifies all paid features.
- [ ] Enterprise user verifies org membership and policy.
- [ ] Developer user verifies diagnostics and admin tools.
- [ ] Admin user verifies moderation functions.

---

*This document lives at `docs/RELEASE.md`. Update it whenever infrastructure
or deployment steps change.*
