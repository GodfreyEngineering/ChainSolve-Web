# ChainSolve — Security Perimeter

> W8: CORS, CSP, reporting, and security header documentation.

---

## 1. CORS

### Where it lives

`functions/api/_middleware.ts` — a Cloudflare Pages middleware that runs
before **every** handler under `/api/*`.

### Allowed origins

| Origin | Purpose |
|--------|---------|
| `https://app.chainsolve.co.uk` | Production |
| `http://localhost:5173` | Vite dev server |

Staging is a TODO — add the origin to `ALLOWED_ORIGINS` in the middleware
when ready.

### Behaviour

| Request | What happens |
|---------|-------------|
| `OPTIONS` from allowed origin | Returns `204` with `Access-Control-Allow-*` headers |
| `OPTIONS` from unknown origin | Returns `204` with `Vary: Origin` only (no `Allow-Origin`) |
| `POST` / `GET` from allowed origin | Proxies to handler, adds CORS headers to response |
| No `Origin` header (Stripe webhook, cURL) | Proxies to handler, no CORS headers added |

Every response includes `Vary: Origin` to prevent CDN cache poisoning.

### Testing locally

```bash
# Preflight
curl -s -o /dev/null -w '%{http_code}' \
  -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:8788/api/stripe/create-checkout-session
# → 204

# Disallowed origin
curl -s -D- \
  -X OPTIONS \
  -H "Origin: https://evil.example.com" \
  http://localhost:8788/api/stripe/create-checkout-session | grep -i access-control
# → (no Access-Control-Allow-Origin header)
```

---

## 2. Content Security Policy (CSP)

> F4-3 audit 2026-03-02: headers consistent, doc current, no console spam.

### Current state

Both headers are set in `public/_headers` for all routes (`/*`):

| Header | Purpose |
|--------|---------|
| `Content-Security-Policy` | **Enforced** — blocks violations and reports them |
| `Content-Security-Policy-Report-Only` | **Report-only** — identical baseline policy, edit to test stricter rules |

Both include `report-uri /api/report/csp; report-to csp-endpoint`.

The `Reporting-Endpoints` header maps `csp-endpoint` to the report URL.

### Policy directives

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Fallback: only same-origin |
| `script-src` | `'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com` | No inline scripts; `'wasm-unsafe-eval'` for WASM engine (§2.1); Turnstile CAPTCHA loader (§5) |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | `unsafe-inline` required by React Flow inline styles + Vite CSS injection; Google Fonts for Montserrat/JetBrains Mono |
| `font-src` | `'self' https://fonts.gstatic.com` | Google Fonts file delivery |
| `img-src` | `'self' data: blob:` | SVG data URIs, canvas blob exports |
| `connect-src` | `'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com` | Supabase REST + Realtime, Stripe API |
| `frame-src` | `https://js.stripe.com https://challenges.cloudflare.com` | Stripe Checkout iframe; Turnstile managed challenge (§5) |
| `worker-src` | `'self' blob:` | CSV Web Worker (blob URL) |
| `object-src` | `'none'` | Block Flash/plugins |
| `base-uri` | `'self'` | Prevent base tag hijacking |
| `form-action` | `'self'` | Restrict form submissions |

### 2.1 Why `'wasm-unsafe-eval'` is required

ChainSolve ships a Rust/WASM compute engine (`crates/engine-wasm/`). At
runtime it is loaded via `WebAssembly.instantiateStreaming()` inside a
dedicated Web Worker (`src/engine/worker.ts`). Browsers gate WebAssembly
compilation under the `script-src` directive — including inside workers that
carry no own CSP, which inherit the parent page's policy.

Without `'wasm-unsafe-eval'` in `script-src`, all major browsers block the
call with:

> Refused to compile or instantiate WebAssembly module because neither
> `'unsafe-eval'` nor `'wasm-unsafe-eval'` appears in the `script-src`
> directive of the Content Security Policy.

The worker detects this failure and surfaces the error code `WASM_CSP_BLOCKED`
so `EngineFatalError` can display a clear, actionable message.

**Why `'wasm-unsafe-eval'` and not `'unsafe-eval'`?**

`'wasm-unsafe-eval'` (CSP Level 3, 2021) is a precise directive that permits
only WebAssembly compilation. It does **not** allow:

- `eval(string)` — arbitrary JS string execution
- `new Function(string)` — runtime function creation
- `setTimeout("string")` / `setInterval("string")` — string-as-timer

`'unsafe-eval'` permits all of the above and is broadly dangerous (XSS
escalation). We use `'wasm-unsafe-eval'` to keep the attack surface minimal.

**Browser support**: Chrome 95+ (Sep 2021), Firefox 102+ (Jun 2022),
Safari 16+ (Sep 2022). The engine already requires modern browsers; these
versions are a subset of our supported range.

---

### Rollout plan: Report-Only → Enforce

1. **Current**: Enforced CSP + identical Report-Only with reporting.
2. **To tighten**: Edit ONLY the `Content-Security-Policy-Report-Only` header
   (e.g., remove `'unsafe-inline'` from `style-src`, or drop a connect-src host).
3. **Deploy** and wait 24–48 hours. Check the `observability_events` table for violations:

   ```sql
   SELECT payload->>'effectiveDirective' AS violated_directive,
          payload->>'blockedUrl'         AS blocked_uri,
          count(*)
   FROM observability_events
   WHERE event_type = 'csp_violation'
     AND ts > now() - interval '48 hours'
   GROUP BY 1, 2
   ORDER BY count DESC;
   ```

4. **If zero reports**: Copy the Report-Only policy to the enforced
   `Content-Security-Policy` header and redeploy.
5. **If reports exist**: Investigate each violation. Adjust the policy or fix
   the code, then return to step 2.

### Inspecting violations in DevTools

1. Open Chrome DevTools → **Console**
2. CSP violations appear as `[Report Only]` warnings (for Report-Only)
   or errors (for enforced)
3. Open **Network** tab → filter by `csp-report` to see the POST requests
   to the report endpoint

---

## 3. CSP Report Endpoint

### Location

`functions/api/report/csp.ts` — Cloudflare Pages Function.

### How it works

1. Browser detects a CSP violation
2. Browser POSTs `application/csp-report` JSON to `/api/report/csp`
3. Endpoint parses the report, computes a dedup key
   (`SHA-256(effectiveDirective | blockedUrl | documentUrl | minute_bucket)`)
4. Inserts into `public.observability_events` as `event_type = 'csp_violation'`
   (fingerprint uniqueness prevents duplicate rows)
5. Returns `204 No Content`

### Abuse mitigation

- **Content-Type validation**: Only `application/csp-report`, `application/json`,
  `application/reports+json` accepted; everything else gets `415`.
- **Body size limit**: 16 KB max; larger payloads get `413`.
- **Dedup**: Same violation from the same page within the same minute is stored
  once (UNIQUE constraint on `dedup_key`).
- **No auth required**: CSP reports are browser-initiated fire-and-forget requests
  that don't carry auth tokens. The endpoint uses `SUPABASE_SERVICE_ROLE_KEY`
  to write.

### Storage

CSP violations are stored in `public.observability_events` (shared with all
observability events) with `event_type = 'csp_violation'`.

Key `payload` fields (from the normalised CSP report):

| Field | Notes |
|-------|-------|
| `effectiveDirective` | e.g., `script-src` |
| `blockedUrl` | Origin + path only (query stripped) |
| `documentUrl` | Path of the page that triggered the violation |
| `disposition` | `enforce` or `report` |
| `ua` | User-Agent string (truncated to 500 chars) |

The `fingerprint` column (SHA-256 of `effectiveDirective|blockedUrl|documentUrl|minute`)
prevents duplicate rows for the same violation within a 60-second window.

### Simulating a CSP report

```bash
curl -X POST https://app.chainsolve.co.uk/api/report/csp \
  -H "Content-Type: application/csp-report" \
  -d '{
    "csp-report": {
      "document-uri": "https://app.chainsolve.co.uk/app",
      "violated-directive": "script-src '\''self'\''",
      "blocked-uri": "https://evil.example.com/bad.js",
      "effective-directive": "script-src",
      "original-policy": "default-src '\''self'\''"
    }
  }'
# → 204

# Verify in Supabase SQL Editor:
# SELECT * FROM observability_events WHERE event_type = 'csp_violation' ORDER BY ts DESC LIMIT 5;
```

For local testing with Wrangler, see `docs/observability/csp-reporting.md`.

---

## 4. Security Headers

All set in `public/_headers` under the `/*` catch-all.

| Header | Value | Why |
|--------|-------|-----|
| `X-Frame-Options` | `DENY` | Prevent clickjacking (framing) |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Send origin for cross-origin, full URL for same-origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=()` | Disable unused browser APIs |
| `X-XSS-Protection` | `0` | Disabled — modern CSP is the protection; the legacy XSS filter can cause issues |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years, all subdomains, eligible for HSTS preload |
| `Content-Security-Policy` | *(see §2)* | Enforced CSP with reporting |
| `Content-Security-Policy-Report-Only` | *(see §2)* | Report-only baseline for testing |
| `Reporting-Endpoints` | `csp-endpoint="/api/report/csp"` | Maps report-to group to URL |

### Why X-XSS-Protection is set to 0

The `X-XSS-Protection: 1; mode=block` header enabled a legacy XSS filter in
older browsers that could itself be exploited as an attack vector (information
leakage). Modern browsers have removed this filter. With a strong CSP in place,
`X-XSS-Protection: 0` is the recommended setting per OWASP.

### COEP / COOP

**Not enabled.** Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy
can break Stripe's iframe-based checkout flow. Do not enable without testing
the full Stripe checkout + portal flow first. If needed in the future:

```
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

Test thoroughly before deploying.

---

## 5. Third-Party Analytics and CSP

### Decision: No Cloudflare Web Analytics beacon

Cloudflare Pages offers opt-in Web Analytics, which injects a JavaScript beacon
(`beacon.min.js` from `static.cloudflareinsights.com`) into every page.
**This feature is intentionally disabled** on ChainSolve.

**Reason:** Enabling the beacon would require adding `static.cloudflareinsights.com`
to `script-src` and `connect-src` in the Content Security Policy.  This weakens
the CSP by allowing a third-party script and additional outbound connections that
are not necessary for the application to function.  See `docs/DECISIONS/ADR-0002-csp-wasm-unsafe-eval.md`
for the full CSP rationale.

**If Cloudflare Web Analytics is ever enabled:**

1. Add to the `script-src` directive in `public/_headers`:
   ```
   https://static.cloudflareinsights.com
   ```
2. Add to the `connect-src` directive:
   ```
   https://cloudflareinsights.com
   ```
3. Update both the enforced `Content-Security-Policy` and the
   `Content-Security-Policy-Report-Only` lines (they must stay in sync).
4. Verify no new CSP violations appear in `csp_reports` after deploy.
5. Update this section to document the trade-off.

Until then: **do not enable Cloudflare Web Analytics in the Cloudflare dashboard**
unless the CSP is updated simultaneously.

### Troubleshooting: CSP console errors for beacon.min.js

If you see console errors like:

```
Refused to load the script 'https://static.cloudflareinsights.com/beacon.min.js'
because it violates the following Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval'"
```

**Cause:** "Web Analytics" was enabled in the Cloudflare Pages dashboard. Cloudflare
auto-injects `beacon.min.js` at the edge, but the CSP correctly blocks it.

**Resolution:**
1. Go to Cloudflare dashboard → Workers & Pages → chainsolve-web → Settings
2. Navigate to the "Web Analytics" section
3. Disable "Web Analytics"
4. Verify the console errors stop on next page load

This is the intended behavior — the CSP is doing its job. Do **not** weaken the CSP
to accommodate the beacon. If analytics are needed, evaluate Cloudflare Zaraz (which
supports CSP nonces) or use the existing `observability_events` pipeline.

### CI enforcement (P050)

`scripts/check-csp-allowlist.mjs` runs as part of `verify-ci.sh` and parses
`public/_headers` to verify that every external origin in the enforced
`Content-Security-Policy` is present in the `APPROVED_ORIGINS` allowlist
inside that script.

**Adding a new external resource requires:**

1. Add the origin to `APPROVED_ORIGINS` in `scripts/check-csp-allowlist.mjs`
   with a comment explaining the rationale.
2. Add it to `public/_headers` (both enforced CSP and Report-Only).
3. Document the trade-off in this section (§5).

The CI check will fail with a `CSP ALLOWLIST VIOLATION` error if an external
origin appears in the enforced header without a matching allowlist entry.

### Cloudflare Turnstile CAPTCHA (E2-2)

`https://challenges.cloudflare.com` is allowlisted in both `script-src` (JavaScript
widget loader) and `frame-src` (managed challenge iframe).

**Rationale:** Turnstile provides bot protection on login, signup, and password-reset
forms. It is a first-party Cloudflare service and does not require `unsafe-eval`.

**Configuration:**
- Set `VITE_TURNSTILE_SITE_KEY` in the frontend environment to enable the widget.
- Configure the Turnstile secret key in the Supabase project dashboard
  (Authentication → Captcha protection).
- When the site key is absent (local dev), CAPTCHA is disabled and auth works
  without a token.

---

## 6. Verification Checklist

### After deploy

- [ ] **CORS preflight**: Open DevTools Network, trigger a billing action →
      the OPTIONS preflight to `/api/stripe/create-checkout-session` should
      return `204` with `Access-Control-Allow-Origin: https://app.chainsolve.co.uk`
- [ ] **No wildcard CORS**: `grep -r "Access-Control-Allow-Origin: \*"` returns
      nothing in the codebase
- [ ] **CSP report endpoint**: Run the curl test from §3 → verify `204` and
      row appears in `observability_events` table with `event_type = 'csp_violation'`
- [ ] **CSP headers**: In DevTools → Network → click the document request →
      Response Headers should show both `Content-Security-Policy` and
      `Content-Security-Policy-Report-Only` with `report-uri`
- [ ] **Reporting-Endpoints**: Same response should include
      `Reporting-Endpoints: csp-endpoint="/api/report/csp"`
- [ ] **Stripe webhook**: Send a test webhook from Stripe Dashboard →
      returns `200 ok` (CORS middleware doesn't break it)
- [ ] **Stripe checkout**: Click Upgrade → redirected to Stripe Checkout
      (frame-src allows js.stripe.com)
- [ ] **Security headers**: Check `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy` are present
- [ ] **WASM engine loads**: Navigate to the app — `data-testid="engine-ready"` appears
      in the DOM within ~60 s; no `data-testid="engine-fatal"` with code `WASM_CSP_BLOCKED`
- [ ] **No browser console errors**: Load the app — zero CSP violations in Console

---

## 7. Row-Level Security (RLS) Audit

> W9 P044 — all tables confirmed 2026-02-27. F4-2 consolidation pass 2026-03-02.

### Policy summary

All 23 application tables have RLS enabled. The canonical ownership expression
`(select auth.uid())` is used throughout (not bare `auth.uid()`, which causes
a per-row function call; the subquery form is evaluated once per query).

| Table | RLS | Policies | Notes |
|-------|-----|----------|-------|
| `profiles` | ✓ | SELECT own, UPDATE own | `(select auth.uid()) = id` |
| `projects` | ✓ | SELECT / INSERT / UPDATE / DELETE own | `(select auth.uid()) = owner_id` |
| `fs_items` | ✓ | SELECT / INSERT / UPDATE / DELETE own | `(select auth.uid()) = user_id` |
| `project_assets` | ✓ | SELECT / INSERT / UPDATE / DELETE own | `(select auth.uid()) = user_id` |
| `canvases` | ✓ | SELECT / INSERT / UPDATE / DELETE own | `(select auth.uid()) = user_id` |
| `group_templates` | ✓ | SELECT / INSERT / UPDATE / DELETE own | `(select auth.uid()) = user_id` |
| `bug_reports` | ✓ | INSERT own, SELECT own | `(select auth.uid()) = user_id` |
| `stripe_events` | ✓ | **None** — service_role only | Webhook receiver; no user access needed |
| `csp_reports` | ✓ | INSERT only | Browser fire-and-forget; service_role writes |
| `observability_events` | ✓ | Explicit deny-all for authenticated | Service_role writes; no user reads |
| `marketplace_items` | ✓ | Unified SELECT / author INSERT / unified UPDATE / author DELETE | Consolidated in 0038 |
| `marketplace_purchases` | ✓ | SELECT own, INSERT own | `(select auth.uid()) = user_id` |
| `marketplace_likes` | ✓ | SELECT / INSERT / DELETE own | `(select auth.uid()) = user_id` |
| `marketplace_comments` | ✓ | 7 policies (public read, user CRUD, mod CRUD, flag) | Role-gated via moderator check |
| `marketplace_install_events` | ✓ | SELECT own, INSERT own | `(select auth.uid()) = user_id` |
| `organizations` | ✓ | SELECT / INSERT / UPDATE / DELETE member | Via `org_members` join |
| `org_members` | ✓ | SELECT / INSERT / UPDATE / DELETE | Role-gated (owner/admin) |
| `audit_log` | ✓ | Unified SELECT (own + org admin), INSERT own | Consolidated in 0038 |
| `avatar_reports` | ✓ | INSERT own, SELECT own + mod, UPDATE mod | Role-gated via moderator check |
| `ai_org_policies` | ✓ | SELECT + UPDATE org owner | Owner-only via `org_members` join |
| `ai_usage_monthly` | ✓ | SELECT own | Service_role inserts |
| `ai_request_log` | ✓ | SELECT own | Service_role inserts |
| `user_sessions` | ✓ | SELECT / INSERT / UPDATE / DELETE own | `(select auth.uid()) = user_id` |

### Canonical migration reference

Migration `0011_rls_perf_canonical.sql` drops and recreates all policies on
user-owned tables using the `(select auth.uid())` pattern. No bare `auth.uid()`
calls remain.

### Policy consolidation (0038)

Migration `0038_consolidate_permissive_policies.sql` merged multiple permissive
SELECT/UPDATE policies into single policies with explicit OR logic:
- `audit_log`: 2 SELECT → 1 unified SELECT (own OR org-admin)
- `marketplace_items`: 4 SELECT → 1 unified SELECT; 2 UPDATE → 1 unified UPDATE

### Intentional no-access tables

`stripe_events` and `observability_events` have RLS enabled but grant
**zero** rows to authenticated users.  This is intentional and explicit:

- `stripe_events` — written only by the Stripe webhook handler via
  `service_role` (which bypasses RLS). Users must not read raw webhook payloads.
- `observability_events` — has an explicit `obs_events_deny_all` policy
  (`USING (false)`) added in `0016_*` to make the intent unmissable in
  Supabase's policy UI.

### Verification

```sql
-- List all tables, RLS status, and policy count
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  count(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- Confirm no bare auth.uid() calls in policy definitions
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
  AND (qual NOT LIKE '%(select auth.uid())%' AND with_check NOT LIKE '%(select auth.uid())%');
-- → should return 0 rows
```

---

## 8. Storage ACL Audit

> W9 P045 — confirmed 2026-02-27.

### Buckets

| Bucket | Public | File size limit | Purpose |
|--------|--------|-----------------|---------|
| `projects` | No | 50 MB | Project JSON snapshots |
| `uploads` | No | 50 MB | User-uploaded assets (CSV, images) |

Both buckets are private; all access requires signed URLs or authenticated
session tokens.

### Path-prefix enforcement

All storage policies enforce that the first path component matches the
authenticated user's ID:

```sql
(storage.foldername(name))[1] = auth.uid()::text
```

This means files stored at `{userId}/...` can only be accessed by that user.
The application layer (see `src/lib/storage.ts`) hardcodes this prefix in
every upload and download path.

### Additional plan-gated policies

The `uploads` bucket INSERT/UPDATE policies (added in
`0006_entitlements_enforcement.sql`) also check `public.user_has_active_plan(auth.uid())`.
Free/canceled users cannot upload files to the `uploads` bucket.

The `projects` bucket INSERT/UPDATE policies check
`public.user_can_write_projects(auth.uid())`.  Canceled users cannot write
project files.

### Manual verification

```bash
# After deploy, confirm bucket policies in Supabase SQL Editor:
SELECT
  b.name AS bucket,
  b.public,
  b.file_size_limit,
  p.name AS policy,
  p.operation,
  p.definition
FROM storage.buckets b
LEFT JOIN storage.policies p ON p.bucket_id = b.id
WHERE b.name IN ('projects', 'uploads')
ORDER BY b.name, p.operation;
```

Expected: each bucket has 4 policies (SELECT / INSERT / UPDATE / DELETE), all
containing `(storage.foldername(name))[1] = auth.uid()::text`.
