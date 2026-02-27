# Observability — CSP Reporting

> W9.8 | Added 2026-02-26

Content-Security-Policy violation reports flow from the browser to
`/api/report/csp` and are stored alongside other observability events in
the `observability_events` table.

---

## How it works

### 1. Browser sends report

When a resource is blocked by the CSP, Chrome/Firefox send an HTTP POST to
the endpoint declared in the `report-uri` directive (legacy) or
`Reporting-Endpoints` header (Reporting API v1).

ChainSolve declares both:

```
# public/_headers (Cloudflare Pages)
Content-Security-Policy: …; report-uri /api/report/csp; report-to csp-endpoint
Reporting-Endpoints: csp-endpoint="/api/report/csp"
```

### 2. Endpoint normalises the report

`functions/api/report/csp.ts` handles two Content-Type formats:

| Format                       | Sent by                |
|------------------------------|------------------------|
| `application/csp-report`     | Legacy (all browsers)  |
| `application/reports+json`   | Reporting API v1 (Chrome 70+) |

Both are normalised to the same shape before storage.

### 3. Sensitive data is stripped

- The `sample` field (may contain blocked code snippet) is dropped.
- `blocked-uri` is reduced to origin + path (query and fragment stripped).
- `document-uri` is reduced to origin + path.
- Minute-level dedup key prevents flooding from a single broken page.

### 4. Stored as `csp_violation` event

The normalised report is inserted into `observability_events` with
`event_type = 'csp_violation'`.  The `payload` field contains the CSP
report body (after sanitisation).

---

## Reading CSP reports (Supabase)

```sql
select
  ts,
  payload->>'blocked-uri'          as blocked_uri,
  payload->>'violated-directive'   as directive,
  payload->>'document-uri'         as page,
  tags->>'app_version'             as version
from observability_events
where event_type = 'csp_violation'
order by ts desc
limit 50;
```

---

## Testing CSP reports locally

### Option A — Wrangler (full Pages Function support, recommended)

Wrangler executes Cloudflare Pages Functions locally, including the CSP
report endpoint.  Run it after building the app:

```bash
# 1. Build the app
npm run build

# 2. Start Wrangler dev server (Functions + static assets)
npx wrangler pages dev dist --compatibility-date=2024-09-23

# 3. In another terminal — send a synthetic CSP report (legacy format)
curl -X POST http://localhost:8788/api/report/csp \
  -H 'Content-Type: application/csp-report' \
  -d '{
    "csp-report": {
      "document-uri": "http://localhost:8788/app",
      "blocked-uri": "https://evil.example.com/script.js",
      "violated-directive": "script-src",
      "original-policy": "script-src '\''self'\'' '\''wasm-unsafe-eval'\''",
      "effective-directive": "script-src",
      "disposition": "enforce"
    }
  }'
# → 204 No Content

# 4. Verify the event was stored (Supabase SQL Editor or psql):
# SELECT ts, payload->>'effectiveDirective' AS directive,
#        payload->>'blockedUrl' AS blocked
# FROM observability_events
# WHERE event_type = 'csp_violation'
# ORDER BY ts DESC LIMIT 5;
```

### Option B — Vite preview server (endpoint only)

Vite dev server does **not** execute Pages Functions, so the report
endpoint is unavailable.  `npm run preview` serves `public/_headers`
(so CSP headers are sent) but calls to `/api/report/csp` will 404.
Use Option A for end-to-end testing.

### Verifying CSP headers

```bash
# Check that both CSP headers and Reporting-Endpoints are present
curl -sI http://localhost:8788/app | grep -iE 'content-security|reporting'
# Expected output includes:
#   content-security-policy: …; report-uri /api/report/csp; report-to csp-endpoint
#   content-security-policy-report-only: …; report-uri /api/report/csp; …
#   reporting-endpoints: csp-endpoint="/api/report/csp"
```

### Testing the Reporting API v1 format (Chrome 70+)

```bash
curl -X POST http://localhost:8788/api/report/csp \
  -H 'Content-Type: application/reports+json' \
  -d '[{
    "type": "csp-violation",
    "url": "http://localhost:8788/app",
    "body": {
      "effectiveDirective": "script-src",
      "blockedURL": "https://evil.example.com/script.js",
      "documentURL": "http://localhost:8788/app",
      "disposition": "enforce"
    }
  }]'
# → 204 No Content
```

### Testing abuse mitigations

```bash
# Wrong Content-Type → 415
curl -sI -X POST http://localhost:8788/api/report/csp \
  -H 'Content-Type: text/plain' -d '{}' | head -1
# HTTP/2 415

# Oversized payload → 413
curl -sI -X POST http://localhost:8788/api/report/csp \
  -H 'Content-Type: application/csp-report' \
  --data-binary @<(python3 -c "print('x'*40000)") | head -1
# HTTP/2 413
```

---

## Common false positives

| Blocked URI pattern          | Likely cause                                    |
|------------------------------|-------------------------------------------------|
| `chrome-extension://…`       | Browser extension injecting scripts — ignore    |
| `moz-extension://…`          | Firefox extension — ignore                      |
| `about` / `data`             | Browser UI actions — ignore                     |
| Supabase CDN URLs            | New CDN region not in CSP `connect-src` — fix   |
| `blob:`                      | Web Worker WASM blob — needs `worker-src blob:` |

---

## Updating the CSP

The CSP lives in `public/_headers`.  After editing:

1. Run `npm run build && npm run preview` to verify the page loads.
2. Check the browser console — any `Content Security Policy` warnings?
3. Run `npm run test:e2e:smoke` to confirm `wasm-unsafe-eval` guard passes.
4. Deploy; monitor `observability_events` for new `csp_violation` rows.
