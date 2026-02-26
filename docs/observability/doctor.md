# Observability — Doctor Checks

> W9.8 | Added 2026-02-26

The in-app doctor runs a set of lightweight health checks and surfaces the
results on the `/diagnostics` page.  It never throws — all failures are
captured as `DoctorCheck` results with `status: 'fail'`.

---

## Available checks

| Check name        | What it tests                                              |
|-------------------|------------------------------------------------------------|
| `healthz`         | GET `/api/healthz` — Cloudflare Function liveness          |
| `readyz`          | GET `/api/readyz` — Supabase connectivity                  |
| `wasm_engine`     | `window.__chainsolve_engine` is set (WASM init succeeded)  |
| `supabase_rest`   | GET `{SUPABASE_URL}/rest/v1/` — Supabase REST reachable    |

Each check produces a `DoctorCheck`:

```typescript
interface DoctorCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  durationMs: number
}
```

---

## Running checks

### From the UI

Navigate to `/diagnostics` (dev) or enable it in production:

```
localStorage.setItem('cs_diag', '1')
// then visit /diagnostics
```

Click **Run checks** to execute all doctor checks.  Results appear inline.
Passed checks are green; failed checks are red with the error message.

### Programmatically

```typescript
import { runDoctorChecks } from './observability/doctor'

const checks = await runDoctorChecks()
console.table(checks)
```

`runDoctorChecks()` is async but always resolves (never rejects).

---

## Adding a new check

1. Open `src/observability/doctor.ts`.
2. Add a `check()` call returning a `DoctorCheck`:

```typescript
async function checkMyThing(): Promise<DoctorCheck> {
  return check('my_thing', async () => {
    const ok = await someAsyncTest()
    if (!ok) throw new Error('my_thing not reachable')
  })
}
```

3. Add it to the `runDoctorChecks` array:

```typescript
export async function runDoctorChecks(): Promise<DoctorCheck[]> {
  return Promise.all([
    checkHealthz(),
    checkReadyz(),
    checkWasm(),
    checkStorage(),
    checkMyThing(),  // ← add here
  ])
}
```

4. Add a row to the table above.

---

## Health endpoints

### `GET /api/healthz`

Fast liveness probe.  No external dependencies.

Response (200):
```json
{ "ok": true, "app_version": "1.2.3", "env": "production", "ts": "2026-02-26T…Z" }
```

### `GET /api/readyz`

Readiness probe.  Checks Supabase connectivity.

Response (200): `{ "ok": true, "supabase": "ok" }`
Response (503): `{ "ok": false, "supabase": "error", "detail": "…" }`

---

## Interpreting results

| Check      | Fail reason                                     | Action                                   |
|------------|-------------------------------------------------|------------------------------------------|
| `healthz`  | Function not deployed / CORS issue              | Check Cloudflare Pages deploy logs        |
| `readyz`   | Supabase down / wrong URL / CORS                | Check Supabase status page                |
| `wasm_engine` | WASM init hung / CSP blocked               | Check browser console for `[WASM_*]` codes |
| `supabase_rest` | Network / Supabase downtime              | Retry after a few minutes                 |
