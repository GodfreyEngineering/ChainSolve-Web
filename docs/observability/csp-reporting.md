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
Content-Security-Policy: …; report-uri /api/report/csp
Reporting-Endpoints: default="/api/report/csp"
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

Vite dev server does **not** serve `public/_headers`, so CSP reports are not
sent during local development.  To test the endpoint:

```bash
# Start the Vite preview server (serves _headers)
npm run build
npm run preview

# In another terminal — send a synthetic CSP report (legacy format)
curl -X POST http://localhost:4173/api/report/csp \
  -H 'Content-Type: application/csp-report' \
  -d '{
    "csp-report": {
      "document-uri": "http://localhost:4173/canvas/test",
      "blocked-uri": "https://evil.example.com/script.js",
      "violated-directive": "script-src",
      "original-policy": "script-src '\''self'\'' '\''wasm-unsafe-eval'\''",
      "disposition": "enforce"
    }
  }'
```

Expected response: `{"ok":true}` (HTTP 204 or 200).

> Note: Cloudflare Pages Functions are not executed by `vite preview`.
> Use `wrangler pages dev dist --compatibility-date=2024-09-23` to run
> Functions locally with the Wrangler dev server.

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
