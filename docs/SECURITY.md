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

### Current state

Both headers are set in `public/_headers` for all routes (`/*`):

| Header | Purpose |
|--------|---------|
| `Content-Security-Policy` | **Enforced** — blocks violations and reports them |
| `Content-Security-Policy-Report-Only` | **Report-only** — identical baseline policy, edit to test stricter rules |

Both include `report-uri /api/security/csp-report; report-to csp-endpoint`.

The `Reporting-Endpoints` header maps `csp-endpoint` to the report URL.

### Policy directives

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Fallback: only same-origin |
| `script-src` | `'self'` | No inline scripts, no CDN scripts |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | `unsafe-inline` required by React Flow inline styles + Vite CSS injection; Google Fonts for Montserrat/JetBrains Mono |
| `font-src` | `'self' https://fonts.gstatic.com` | Google Fonts file delivery |
| `img-src` | `'self' data: blob:` | SVG data URIs, canvas blob exports |
| `connect-src` | `'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com` | Supabase REST + Realtime, Stripe API |
| `frame-src` | `https://js.stripe.com` | Stripe Checkout iframe |
| `worker-src` | `'self' blob:` | CSV Web Worker (blob URL) |
| `object-src` | `'none'` | Block Flash/plugins |
| `base-uri` | `'self'` | Prevent base tag hijacking |
| `form-action` | `'self'` | Restrict form submissions |

### Rollout plan: Report-Only → Enforce

1. **Current**: Enforced CSP + identical Report-Only with reporting.
2. **To tighten**: Edit ONLY the `Content-Security-Policy-Report-Only` header
   (e.g., remove `'unsafe-inline'` from `style-src`, or drop a connect-src host).
3. **Deploy** and wait 24–48 hours. Check the `csp_reports` table for violations:

   ```sql
   SELECT violated_directive, blocked_uri, count(*)
   FROM csp_reports
   WHERE created_at > now() - interval '48 hours'
   GROUP BY violated_directive, blocked_uri
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

`functions/api/security/csp-report.ts` — Cloudflare Pages Function.

### How it works

1. Browser detects a CSP violation
2. Browser POSTs `application/csp-report` JSON to `/api/security/csp-report`
3. Endpoint parses the report, computes a dedup key
   (`SHA-256(violated_directive | blocked_uri | document_uri | minute_bucket)`)
4. Upserts into `public.csp_reports` with `ON CONFLICT (dedup_key) DO NOTHING`
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

### Database table

`public.csp_reports` — created by `supabase/migrations/0012_csp_reports.sql`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `created_at` | timestamptz | Default `now()` |
| `user_id` | uuid (nullable) | FK → profiles; null for browser CSP reports |
| `page` | text | Page URL (from Referer header) |
| `document_uri` | text | Document that violated the policy |
| `referrer` | text | |
| `violated_directive` | text | e.g., `script-src 'self'` |
| `effective_directive` | text | |
| `original_policy` | text | Full CSP string |
| `blocked_uri` | text | URI that was blocked |
| `disposition` | text | `enforce` or `report` |
| `user_agent` | text | |
| `raw` | jsonb | Full original report payload |
| `dedup_key` | text (UNIQUE) | SHA-256 dedup hash |

RLS: Enabled. Authenticated users can INSERT own (user_id match).
No SELECT/UPDATE/DELETE for authenticated users. service_role bypasses RLS.

### Simulating a CSP report

```bash
curl -X POST https://app.chainsolve.co.uk/api/security/csp-report \
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
# SELECT * FROM csp_reports ORDER BY created_at DESC LIMIT 5;
```

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
| `Reporting-Endpoints` | `csp-endpoint="/api/security/csp-report"` | Maps report-to group to URL |

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

## 5. Verification Checklist

### After deploy

- [ ] **CORS preflight**: Open DevTools Network, trigger a billing action →
      the OPTIONS preflight to `/api/stripe/create-checkout-session` should
      return `204` with `Access-Control-Allow-Origin: https://app.chainsolve.co.uk`
- [ ] **No wildcard CORS**: `grep -r "Access-Control-Allow-Origin: \*"` returns
      nothing in the codebase
- [ ] **CSP report endpoint**: Run the curl test from §3 → verify `204` and
      row appears in `csp_reports` table
- [ ] **CSP headers**: In DevTools → Network → click the document request →
      Response Headers should show both `Content-Security-Policy` and
      `Content-Security-Policy-Report-Only` with `report-uri`
- [ ] **Reporting-Endpoints**: Same response should include
      `Reporting-Endpoints: csp-endpoint="/api/security/csp-report"`
- [ ] **Stripe webhook**: Send a test webhook from Stripe Dashboard →
      returns `200 ok` (CORS middleware doesn't break it)
- [ ] **Stripe checkout**: Click Upgrade → redirected to Stripe Checkout
      (frame-src allows js.stripe.com)
- [ ] **Security headers**: Check `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy` are present
- [ ] **No browser console errors**: Load the app — zero CSP violations in Console
