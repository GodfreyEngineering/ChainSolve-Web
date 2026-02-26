# ADR-0004 — Supabase RLS Canonicalization

| Field | Value |
|-------|-------|
| Status | Accepted |
| Decided | W5.3.1 (canonical pattern); W8 (enforcement migration 0011) |
| Supersedes | Earlier ad-hoc RLS policies from migrations 0001–0009 |
| Affects | All `supabase/migrations/` files after 0011 |

---

## Context

Supabase Row Level Security (RLS) policies protect each table so that users
can only access their own rows.  The canonical check in almost every policy is:
"does the authenticated user's ID match the `owner_id` (or `user_id`) column?"

In PostgreSQL, `auth.uid()` is a function provided by Supabase that returns
the UUID of the currently authenticated user.  There are two ways to call it:

```sql
-- Style A: direct call (evaluated per row)
owner_id = auth.uid()

-- Style B: subquery (evaluated once per query, then reused)
owner_id = (select auth.uid())
```

**The problem with Style A:**
PostgreSQL's query planner treats `auth.uid()` as `VOLATILE` (may return
different values on each call).  This prevents the planner from "hoisting"
the call — it re-evaluates `auth.uid()` for **every row** the policy is
checked against.  On a table with 10,000 rows, this means 10,000 function
calls per query instead of one.

This is known as the "RLS initplan" problem and is documented in Supabase's
own performance advisor.

---

## Decision

All RLS policies use the **subquery pattern** (Style B):

```sql
-- Correct — auth.uid() called once per query
CREATE POLICY "users_own_rows" ON projects
  FOR ALL USING (owner_id = (select auth.uid()));
```

The canonical migration (`0011_rls_perf_canonical.sql`) rewrites all existing
policies to use this pattern and deduplicates any redundant policies created
by earlier migrations.

---

## Policy structure rules

1. **Use `(select auth.uid())`** — never bare `auth.uid()`.
2. **One policy per operation per table** — no duplicate `SELECT` policies,
   etc.  Duplicates cancel each other out in confusing ways.
3. **`ENABLE ROW LEVEL SECURITY`** on every table — even tables with no data
   yet (defense in depth).
4. **Service role bypass** — the `service_role` key bypasses RLS by design.
   It is used by Cloudflare Functions (server-side) and CSP report endpoint.
   Never expose the service role key to the browser.
5. **`FOR ALL` policies** — prefer a single `FOR ALL` policy over separate
   `FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE` where access rules
   are identical.

---

## The `csp_reports` table exception

The `csp_reports` table allows unauthenticated (browser) INSERT for CSP
reports.  This is intentional:

- CSP reports are fired by browsers without auth tokens (fire-and-forget).
- The endpoint uses `service_role` to write, bypassing user-level RLS.
- No SELECT/UPDATE/DELETE is exposed to users via RLS.
- Dedup via `UNIQUE (dedup_key)` prevents flood abuse.

---

## Storage RLS

Storage bucket policies in Supabase use a different DSL:

```sql
-- Correct pattern for storage
((storage.foldername(name))[1] = (select auth.uid()::text))
```

The `[1]` extracts the first folder segment from the storage path.  Storage
keys follow the pattern `{userId}/{...}`, so this check enforces that a user
can only access objects in their own folder.

---

## Consequences

**Positive:**
- Queries that filter by user are significantly faster (one `auth.uid()` call
  vs. N calls per table scan).
- Policy deduplication makes the RLS configuration easier to audit.
- The Supabase Performance Advisor no longer flags these tables.

**Negative / trade-offs:**
- The canonicalization migration (`0011`) rewrites many policies.  On a live
  database, running it requires no downtime (policy changes are transactional
  in PostgreSQL) but should be tested on a staging Supabase project first.
- Future policies must use the `(select auth.uid())` pattern consistently —
  a style guide is needed (this ADR serves that purpose).

---

## Migration history

| Migration | RLS change |
|-----------|-----------|
| `0001_init.sql` | Initial policies (bare `auth.uid()`) |
| `0003_projects_owner_id.sql` | Renamed `user_id` → `owner_id`; policy rebuilt |
| `0006_entitlements_enforcement.sql` | Storage RLS tightened; helper functions added |
| `0008_advisor_fixes.sql` | First attempt at advisor fixes (superseded) |
| `0009_advisor_fixes_v2.sql` | Owner_id-safe advisor fixes (partial) |
| `0011_rls_perf_canonical.sql` | **Canonical rewrite:** all tables use `(select auth.uid())`, deduplicated policies, FK indexes |

---

## See also

- `supabase/migrations/0011_rls_perf_canonical.sql` — canonical policy migration
- [Supabase RLS performance guide](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- `docs/CONVENTIONS.md §6` — migration naming and RLS conventions
