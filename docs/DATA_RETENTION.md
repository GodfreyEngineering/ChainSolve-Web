# Data Retention Policy

This document defines how long ChainSolve retains different types of data and how expired data is cleaned up.

## Retention Periods

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| **User projects & canvases** | Until user deletes or account deleted | User-owned content |
| **Audit log** | 90 days | Operational monitoring; account deletion entries kept 30 days for GDPR compliance |
| **Observability events** | 30 days | RUM metrics, error reports, rate limit events |
| **CSP reports** | 30 days | Security monitoring — trends matter, individual reports don't |
| **User sessions** | 30 days after last activity | Stale session cleanup |
| **AI request log** | 90 days | Usage analytics and abuse detection |
| **AI usage monthly** | Indefinite | Billing aggregates — no personal content |
| **Stripe events** | 180 days | Payment dispute resolution window |
| **User preferences** | Until account deleted | User-owned settings |
| **Account deletion records** | 30 days post-deletion | GDPR Article 17 compliance proof |

## Enterprise Configuration

Enterprise organisations can configure their data retention period via the `ai_org_policies.policy_data_retention_days` column:

- **Minimum:** 30 days
- **Default:** 90 days
- **Maximum:** 3,650 days (10 years)

This affects audit log retention for the organisation's data.

## Cleanup Mechanism

Data cleanup is handled by the `cleanup_expired_data()` PostgreSQL function:

```sql
SELECT public.cleanup_expired_data();
```

This function:
1. Deletes audit log entries older than 90 days (except account deletion entries)
2. Deletes account deletion audit entries older than 30 days
3. Deletes observability events older than 30 days
4. Deletes CSP reports older than 30 days
5. Deletes stale user sessions (no activity for 30 days)
6. Deletes AI request log entries older than 90 days
7. Deletes Stripe events older than 180 days

Returns a JSON summary of rows deleted per category.

### Scheduling

The cleanup function should be called daily. Options:

**Option A: Supabase pg_cron (recommended)**
```sql
SELECT cron.schedule(
  'cleanup-expired-data',
  '0 3 * * *',  -- Daily at 03:00 UTC
  $$SELECT public.cleanup_expired_data()$$
);
```

**Option B: GitHub Action**
The existing `.github/workflows/backup.yml` can be extended to call this function after the daily backup.

**Option C: Cloudflare Cron Trigger**
Create a Cloudflare Pages Function triggered by a cron schedule that calls the RPC.

### Access Control

The `cleanup_expired_data()` function is restricted to `service_role` only. Authenticated users cannot call it directly.

## Account Deletion

When a user deletes their account:

1. **Immediate:** Profile row deleted, cascading to all user-owned data (projects, canvases, preferences, etc.)
2. **Immediate:** Auth user row deleted (cascading marketplace items, likes, comments)
3. **Immediate:** Storage files purged (uploads and projects buckets)
4. **Retained 30 days:** Audit log entry with `event_type = 'account_deleted'` (contains email and display name for compliance proof)
5. **Retained 30 days:** Audit log entry with `event_type = 'account_deletion_requested'` (user_id SET NULL after cascade)

After 30 days, the `cleanup_expired_data()` function removes these entries.

## GDPR Compliance

- **Right to erasure (Article 17):** Account deletion removes all personal data immediately except audit trail (retained 30 days for compliance proof)
- **Right of access (Article 15):** Data export endpoint (`POST /api/account/export-data`) provides all personal data as JSON
- **Data minimisation:** AI requests use `store: false` with OpenAI; no raw prompts/responses are persisted
- **Purpose limitation:** Usage metadata retained for billing and abuse detection only
