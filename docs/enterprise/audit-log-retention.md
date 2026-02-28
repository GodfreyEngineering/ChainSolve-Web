# Audit Log Retention Policy

**Status**: Architecture document for Phase C (Enterprise v1.2)
**Relates to**: P126 (schema), P127 (viewer), P128 (redaction)

---

## Overview

The `audit_log` table records key user and system actions for compliance,
debugging, and security investigations. This document defines:

- How long audit events are retained
- How they are deleted
- GDPR / data-subject rights handling
- Export and portability guarantees

---

## Retention Tiers

| Plan | Default retention | Notes |
|------|-------------------|-------|
| Free | 30 days | Rolling window; events older than 30 d are eligible for purge |
| Pro | 90 days | Rolling window |
| Enterprise (future) | 1 year (configurable) | Can be extended by agreement |

> **Note**: These are target retention periods. Until automated purge is
> implemented, audit events accumulate indefinitely. Implement the purge
> job (see below) before general availability.

---

## Purge Strategy

### Recommended approach — scheduled function

A Cloudflare Cron trigger (or Supabase Edge Function) runs nightly and
deletes rows beyond the retention window:

```sql
-- Delete audit_log events older than 90 days for pro users
-- (or 30 days for free users). In practice, a per-user scheduled job
-- or a single bulk purge with a JOIN on profiles.plan.

DELETE FROM public.audit_log
WHERE created_at < now() - INTERVAL '90 days';
```

For a tiered purge, join against `profiles`:

```sql
DELETE FROM public.audit_log al
USING public.profiles p
WHERE al.user_id = p.id
  AND (
    (p.plan IN ('free', 'canceled', 'past_due') AND al.created_at < now() - INTERVAL '30 days')
    OR
    (p.plan IN ('trialing', 'pro') AND al.created_at < now() - INTERVAL '90 days')
  );
```

### Org events

Events with `org_id IS NOT NULL` should use the **org owner's** plan to
determine retention. Until org billing is implemented, use the 90-day
window as a safe default.

---

## GDPR — Right to Erasure

When a user requests deletion of their account:

1. Set `user_id = NULL` on all `audit_log` rows for that user (anonymisation,
   not deletion, so org-level audit trails are preserved).
2. Delete the `profiles` row (cascades to `org_members`; `audit_log.user_id`
   becomes NULL due to `ON DELETE SET NULL`).
3. Purge any remaining `audit_log` rows where `user_id = NULL` and
   `org_id = NULL` after 30 days.

**Anonymisation vs. deletion**: Org admins need the event timeline intact
for compliance. The `ON DELETE SET NULL` FK constraint ensures the event is
preserved (anonymised) even after the user is deleted.

---

## Export / Portability

- Users may request an export of their audit events via a future
  "Download my data" feature.
- Exports MUST pass through `redactObject()` before delivery (same
  guarantee as the append path — see P128).
- Export format: JSON array of `AuditLogEntry` objects.

---

## Privacy Invariants (enforced)

- `user_id` values in `audit_log` are UUIDs — never email addresses.
- `metadata` is deep-scrubbed via `redactObject()` at insert time (P128).
- Exports are also redacted before delivery.
- Logs are not sent to any third-party analytics or error-tracking service.

---

## Future Considerations

- **Immutability**: Consider using Supabase `audit` extension or a separate
  append-only data store for tamper-evident logs (enterprise tier).
- **Long retention**: For regulated industries (HIPAA, SOC2), retention up to
  7 years may be required — evaluate PostgreSQL partitioning or archive export.
- **Alerting**: Unusual event spikes (e.g. bulk project deletes) could trigger
  security alerts via the Cloudflare Workers notification path.

---

*Last updated: 2026-02-28*
