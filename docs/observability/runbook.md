# Observability — Operational Runbook

> W9.8 | Added 2026-02-26

Quick reference for investigating production issues using the observability
pipeline.

---

## 1. Querying observability events

All events land in the `observability_events` Supabase table.  Use the
Supabase Dashboard SQL editor or `psql`.

### Recent errors (last 24 h)

```sql
select
  ts,
  event_type,
  route_path,
  payload->>'message'  as message,
  payload->>'stack'    as stack_top,
  tags->>'app_version' as version
from observability_events
where event_type in ('client_error', 'client_unhandledrejection', 'react_errorboundary')
  and ts > now() - interval '24 hours'
order by ts desc
limit 100;
```

### Error frequency by fingerprint

```sql
select
  fingerprint,
  payload->>'message'  as message,
  count(*)             as occurrences,
  min(ts)              as first_seen,
  max(ts)              as last_seen
from observability_events
where event_type in ('client_error', 'client_unhandledrejection', 'react_errorboundary')
  and ts > now() - interval '7 days'
group by fingerprint, payload->>'message'
order by occurrences desc
limit 20;
```

### CSP violations (last 7 d)

```sql
select
  ts,
  payload->>'blocked-uri'        as blocked_uri,
  payload->>'violated-directive' as directive,
  count(*) over (partition by fingerprint) as dedup_count
from observability_events
where event_type = 'csp_violation'
  and ts > now() - interval '7 days'
order by ts desc
limit 50;
```

### Events for a specific session

```sql
select ts, event_type, route_path, payload
from observability_events
where session_id = '<paste-session-id-from-diagnostics-page>'
order by ts asc;
```

### Events for a specific user

```sql
select ts, event_type, route_path, payload->>'message' as message
from observability_events
where user_id = '<supabase-auth-user-uuid>'
order by ts desc
limit 50;
```

---

## 2. Checking CSP headers are live

```bash
# Fetch just the headers from the deployed site
curl -sI https://app.chainsolve.co.uk/ | grep -i 'content-security\|reporting'
```

Expected output includes:
- `content-security-policy: … 'wasm-unsafe-eval' … report-uri /api/report/csp`
- `content-security-policy-report-only: … report-uri /api/report/csp`
- `reporting-endpoints: default="/api/report/csp"`

---

## 3. Verifying health endpoints

```bash
# Liveness
curl https://app.chainsolve.co.uk/api/healthz

# Readiness (should return {"ok":true,"supabase":"ok"})
curl https://app.chainsolve.co.uk/api/readyz
```

If `/api/readyz` returns 503, check:
1. Supabase status page (https://status.supabase.com)
2. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Cloudflare Pages
   environment variables (Production environment).

---

## 4. Enabling diagnostics UI in production

The `/diagnostics` page is gated in production by:

1. `VITE_DIAGNOSTICS_UI_ENABLED=true` build flag **and**
2. `localStorage['cs_diag'] = '1'` on the client

To enable for a specific browser session without a redeploy:

```javascript
// Open browser DevTools → Console on app.chainsolve.co.uk
localStorage.setItem('cs_diag', '1')
location.reload()
// Navigate to /diagnostics
```

This does NOT expose the diagnostics page to other users — the check is
purely client-side and keyed to the browser's localStorage.

To disable again:
```javascript
localStorage.removeItem('cs_diag')
```

---

## 5. Exporting and sending a diagnostics bundle

On the `/diagnostics` page:

1. **Export JSON** — downloads a `cs-diagnostics-<timestamp>.json` bundle
   (≤ 64 KB, no dataset contents).  Share with the engineering team for
   offline analysis.

2. **Send to server** — POSTs the bundle to `/api/report/client` as an
   `engine_diagnostics` event.  Useful when the user is remote and cannot
   attach the file.

The bundle includes:
- Recent error buffer (last 20 events, already redacted)
- Engine metadata (version, contract version, uptime)
- Evaluation stats (node/edge count, eval times — no computed values)
- Worker lifecycle events

---

## 6. Investigating a WASM boot failure

Symptoms: app shows "Engine failed to initialise" banner.

1. Check browser console for `[WASM_CSP_BLOCKED]` or `[WASM_INIT_FAILED]`
   error codes.
2. If CSP blocked:
   - Verify `_headers` contains `'wasm-unsafe-eval'` in `script-src`.
   - Check CSP violation reports in `observability_events`.
3. If init failed for another reason:
   - Check network tab for the `.wasm` fetch — did it return 200?
   - Check `Content-Type` — must be `application/wasm`.
4. Run doctor checks from `/diagnostics` → `wasm_engine` check shows
   `pass` only after the engine is fully ready.

---

## 7. Clearing stale events (data hygiene)

Events are not automatically expired.  To prune old rows:

```sql
-- Preview: count rows older than 90 days
select count(*) from observability_events
where created_at < now() - interval '90 days';

-- Delete (run in Supabase Dashboard — requires service_role)
delete from observability_events
where created_at < now() - interval '90 days';
```

Consider adding a `pg_cron` job for automated retention once event volume
justifies it.

---

## 8. Environment variables reference

| Variable                        | Where set                         | Purpose                               |
|---------------------------------|-----------------------------------|---------------------------------------|
| `SUPABASE_URL`                  | Cloudflare Pages → Settings → Env | Supabase project URL (server-side)    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Cloudflare Pages → Settings → Env | Service role key for event writes     |
| `VITE_SUPABASE_URL`             | GitHub Secrets                    | Supabase URL baked into client bundle |
| `VITE_SUPABASE_ANON_KEY`        | GitHub Secrets                    | Anon key baked into client bundle     |
| `VITE_OBS_ENABLED`              | `.env` / Cloudflare build vars    | Set `false` to disable client obs     |
| `VITE_OBS_SAMPLE_RATE`          | `.env` / Cloudflare build vars    | Float 0.0–1.0 (default 1.0)           |
| `VITE_DIAGNOSTICS_UI_ENABLED`   | Cloudflare build vars             | Set `true` to allow `/diagnostics`    |
| `CF_PAGES_COMMIT_SHA`           | Auto-set by Cloudflare Pages      | Build SHA surfaced in `/api/healthz`  |
| `CF_PAGES_ENV`                  | Auto-set by Cloudflare Pages      | `production` or `preview`             |
