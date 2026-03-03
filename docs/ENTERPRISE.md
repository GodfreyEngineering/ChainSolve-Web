# Enterprise Security Expectations

## Policy Philosophy

Organization policies **restrict** capabilities; they never grant them.
A free user in an enterprise org with `policy_ai_enabled=true` still
cannot use AI -- their plan must also allow it. Org policy is AND'd
with plan entitlements.

## Policy Flags

| Flag | Default | Effect when disabled |
| --- | --- | --- |
| `policy_explore_enabled` | `true` | Members cannot browse the Company Library |
| `policy_installs_allowed` | `true` | Members cannot install marketplace items |
| `policy_comments_allowed` | `true` | Members cannot post marketplace comments |
| `policy_single_session` | `false` | When **enabled**, each user may have only one active session |
| `policy_ai_enabled` | `true` | Members cannot use AI-assisted features |
| `policy_export_enabled` | `true` | Members cannot export projects (PDF, XLSX, JSON) |
| `policy_custom_fns_enabled` | `true` | Members cannot create custom function blocks |

## Audit Log Retention

`policy_data_retention_days` controls how long audit log entries are kept.

- `NULL` (default): indefinite retention.
- Integer value (e.g. 30, 90, 180, 365): entries older than the specified
  number of days are automatically purged by the `cleanup_expired_audit_logs`
  database function.

The cleanup function runs as `SECURITY DEFINER` and iterates over all
organizations that have a non-null retention policy.

## Seat Management

Each organization may have a `max_seats` limit (NULL = unlimited). The
`inviteOrgMember` service function checks seat availability before
inserting a new member row. The OrgsPage UI displays current usage and
warns when the limit is reached.

## Single-Session Enforcement

When `policy_single_session` is enabled, `enforceAndRegisterSession()`
revokes all prior sessions for the user before registering the new one.
This prevents concurrent logins from multiple devices.

## Admin Controls

Only the **org owner** can modify policy flags and data retention settings.
This is enforced at the database level via RLS update policies on the
`organizations` table. Admins can invite/remove members but cannot
change policies.

## Data Flow

```
Plan entitlements (entitlements.ts)
        |
        v
applyOrgPolicyOverrides() -- AND gate with org policy flags
        |
        v
Effective entitlements used by UI components
```

## Related Files

- `src/lib/entitlements.ts` -- plan-level entitlement definitions
- `src/lib/orgPolicyEnforcement.ts` -- org policy override logic
- `src/lib/orgsService.ts` -- organization CRUD and policy queries
- `src/lib/sessionService.ts` -- single-session enforcement
- `src/pages/OrgsPage.tsx` -- admin UI for policies and seats
- `supabase/migrations/0051_enterprise_policies.sql` -- schema migration
